/**
 * Retención por semana de registro y cuentas activas (docs/195). El cálculo vive en
 * lib/admin/retention.ts; aquí solo se leen las cuentas y la actividad de los últimos
 * ~110 días (10 semanas de cohortes + la ventana de la semana 4), de 1000 en 1000.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchAllPages } from "@/lib/services/notify-reengagement"
import { loadAdminMetricAccounts } from "@/lib/admin-metric-accounts"
import { summarizeRetention } from "@/lib/admin/retention"

export const dynamic = "force-dynamic"
const WEEKS = 10

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const admin = getSupabaseAdminClient()
    const since = new Date(Date.now() - (WEEKS * 7 + 40) * 24 * 60 * 60 * 1000).toISOString()
    const [accounts, rows] = await Promise.all([
      loadAdminMetricAccounts(admin),
      fetchAllPages<{ user_id: string; created_at: string }>((from, to) =>
        admin.from("activity_log").select("user_id, created_at").gte("created_at", since).order("id").range(from, to),
      ),
    ])
    const activity = rows.map((r) => ({ userId: r.user_id, at: new Date(r.created_at).getTime() }))
    return NextResponse.json(summarizeRetention(accounts, activity, WEEKS))
  } catch (error) {
    console.error("[api/admin/retention] Error:", error)
    return NextResponse.json({ error: "No se pudo calcular." }, { status: 500 })
  }
}
