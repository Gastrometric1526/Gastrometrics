/**
 * /admin → Uso de la app → Importaciones (pedido del dueño, docs/208): quién importó en masa
 * (ingredientes, recetas, conteo de inventario, ventas) con qué formato y cuántas filas, y quién
 * descargó el manual. Lee `activity_log` (acciones «imported» y el módulo «manual», últimos 90
 * días) y junta el correo de cada cuenta.
 *
 * docs/211: resumen aparte de ingredientes (cuántas por Excel, ingredientes nuevos, precios
 * actualizados) y de recetas (cuántas desde Excel, ingredientes creados al importar), con el
 * origen de cada una (archivo, lista pegada o ticket). Cálculo en lib/admin/import-summary.ts.
 */
import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { summarizeImports } from "@/lib/admin/import-summary"

interface Row {
  user_id: string
  user_name: string
  module: string
  action: string
  entity_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    const admin = getSupabaseAdminClient()
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const rows: Row[] = []
    for (let from = 0; from < 5000; from += 1000) {
      const { data, error } = await admin
        .from("activity_log")
        .select("user_id, user_name, module, action, entity_label, metadata, created_at")
        .or("action.eq.imported,module.eq.manual")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, from + 999)
      if (error) throw error
      rows.push(...((data as Row[]) ?? []))
      if (!data || data.length < 1000) break
    }

    const emails = new Map<string, string>()
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) break
      for (const u of data.users) emails.set(u.id, u.email || "")
      if (data.users.length < 200) break
    }

    const now = Date.now()
    const within = (iso: string, days: number) => now - new Date(iso).getTime() <= days * 86_400_000
    const events = rows.map((r) => {
      const m = r.metadata ?? {}
      const kind = r.module === "manual" ? "manual" : r.module
      return {
        createdAt: r.created_at,
        email: emails.get(r.user_id) || r.user_name,
        kind,
        format: typeof m.format === "string" ? m.format : null,
        count: typeof m.count === "number" ? m.count : null,
        file: r.entity_label || (typeof m.file === "string" ? m.file : null),
        language: typeof m.language === "string" ? m.language : null,
        source: typeof m.source === "string" ? m.source : null,
        updated: typeof m.updated === "number" ? m.updated : null,
        newIngredients: typeof m.newIngredients === "number" ? m.newIngredients : null,
      }
    })
    const imports = events.filter((e) => e.kind !== "manual")
    const manual = events.filter((e) => e.kind === "manual")
    const countBy = (list: typeof events, key: "kind" | "format") =>
      list.filter((e) => within(e.createdAt, 30)).reduce<Record<string, number>>((acc, e) => {
        const k = (e[key] as string | null) || "—"
        acc[k] = (acc[k] || 0) + 1
        return acc
      }, {})

    return NextResponse.json({
      totals: {
        imports7: imports.filter((e) => within(e.createdAt, 7)).length,
        imports30: imports.filter((e) => within(e.createdAt, 30)).length,
        importRows30: imports.filter((e) => within(e.createdAt, 30)).reduce((n, e) => n + (e.count || 0), 0),
        manual7: manual.filter((e) => within(e.createdAt, 7)).length,
        manual30: manual.filter((e) => within(e.createdAt, 30)).length,
        manualAccounts30: new Set(manual.filter((e) => within(e.createdAt, 30)).map((e) => e.email)).size,
      },
      byKind30: countBy(imports, "kind"),
      byFormat30: countBy(imports, "format"),
      kinds30: summarizeImports(imports.filter((e) => within(e.createdAt, 30))),
      events: events.slice(0, 500),
    })
  } catch (e) {
    console.error("[admin/usage-events]", e)
    return NextResponse.json({ error: "No se pudo leer." }, { status: 500 })
  }
}
