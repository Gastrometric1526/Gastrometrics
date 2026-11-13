import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { selectAll } from "@/lib/admin/select-all"
import { summarizePdfExports, toPdfExportRow } from "@/lib/admin/pdf-exports"

/**
 * «PDF descargados» (docs/291): cada PDF descargado en el período (?days=7|30|90|365, 30 por
 * defecto), con la cuenta, el tipo, el documento, la versión, el negocio y la fecha. Lee
 * todas las filas (sin el tope de 1000) y devuelve como mucho las 2000 más recientes.
 */
export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const admin = getSupabaseAdminClient()
  const requested = Number(new URL(request.url).searchParams.get("days"))
  const days = [7, 30, 90, 365].includes(requested) ? requested : 30
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const [activity, businesses] = await Promise.all([
    selectAll<{ user_id: string; business_id: string | null; entity_label: string | null; metadata: unknown; created_at: string }>((from, to) =>
      admin
        .from("activity_log")
        .select("user_id, business_id, entity_label, metadata, created_at")
        .eq("module", "pdf")
        .eq("action", "exported")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    selectAll<{ id: string; name: string }>((from, to) => admin.from("businesses").select("id, name").order("id").range(from, to)),
  ])
  if (activity.error || businesses.error) return NextResponse.json({ error: "No se pudieron leer las descargas." }, { status: 500 })

  const userIds = new Set((activity.data ?? []).map((a) => a.user_id))
  const emails = new Map<string, string>()
  if (userIds.size) {
    for (let page = 1; page < 200; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) break
      for (const u of data.users) if (userIds.has(u.id) && u.email) emails.set(u.id, u.email)
      if (data.users.length < 200) break
    }
  }
  const names = new Map((businesses.data ?? []).map((b) => [b.id, b.name]))
  const rows = (activity.data ?? []).map((a) => toPdfExportRow(a, names, emails))
  return NextResponse.json({ days, summary: summarizePdfExports(rows), rows: rows.slice(0, 2000), readAt: new Date().toISOString() })
}
