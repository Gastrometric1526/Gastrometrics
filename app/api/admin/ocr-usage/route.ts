/**
 * Uso del OCR (docs/153). El OCR está abierto en todos los planes (decisión del dueño):
 * esta ruta mide el uso real para decidir con datos si algún día hace falta un límite —
 * lecturas de los últimos 30 días por tipo (receta, ticket, conteo), lecturas por cuenta,
 * en los primeros 7 y 30 días de la cuenta, cuántas cuentas volvieron otro día, cuántas
 * pagan y cuántas lecturas hicieron antes de su primer costo. Fuente: activity_log con
 * module "ocr" (lib/ocr-usage.ts); cálculo en lib/activation-metrics.ts.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchAllPages } from "@/lib/services/notify-reengagement"
import { loadAdminMetricAccounts } from "@/lib/admin-metric-accounts"
import { summarizeOcrUsage } from "@/lib/activation-metrics"

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const admin = getSupabaseAdminClient()
    const rows = await fetchAllPages<{ user_id: string; metadata: { kind?: string } | null; created_at: string }>((from, to) =>
      admin.from("activity_log").select("user_id, metadata, created_at").eq("module", "ocr").order("created_at").range(from, to),
    )
    const reads = rows.map((r) => ({ userId: r.user_id, createdAt: r.created_at, kind: r.metadata?.kind ?? "recipe" }))

    // Última actividad (cualquier módulo) de quienes usaron el OCR, para saber si volvieron
    const lastActivityAt = new Map<string, string>()
    const ocrUsers = [...new Set(reads.map((r) => r.userId))]
    for (let i = 0; i < ocrUsers.length; i += 20) {
      await Promise.all(
        ocrUsers.slice(i, i + 20).map(async (userId) => {
          const { data, error } = await admin
            .from("activity_log")
            .select("created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
          if (error) throw error
          if (data?.[0]) lastActivityAt.set(userId, data[0].created_at)
        }),
      )
    }

    const accounts = new Map((await loadAdminMetricAccounts(admin)).map((a) => [a.id, a]))
    return NextResponse.json(summarizeOcrUsage({ reads, accounts, lastActivityAt }))
  } catch (error) {
    console.error("[api/admin/ocr-usage] Error:", error)
    return NextResponse.json({ error: "No se pudo calcular." }, { status: 500 })
  }
}
