/**
 * Analíticas propias de tráfico para /admin (ver docs/67) — mismo patrón que el resto
 * de rutas admin (hasAdminSession + getSupabaseAdminClient, bypassa RLS).
 *
 * Trae los page_views de los últimos 30 días (tope razonable a esta escala, mismo
 * criterio ya aceptado en docs/63 para las otras rutas admin) y agrega en memoria —
 * el total histórico se pide aparte con count/head para no tener que traer todas las
 * filas de siempre solo para contarlas.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdminClient()
    const now = Date.now()
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [{ count: totalAllTime }, last30dRows] = await Promise.all([
      admin.from("page_views").select("id", { count: "exact", head: true }),
      admin.from("page_views").select("path, created_at, language").gte("created_at", since30d),
    ])

    const rows = last30dRows.data ?? []
    const total30d = rows.length
    const total7d = rows.filter((r) => r.created_at >= since7d).length

    const pathCounts = new Map<string, number>()
    const languageCounts = new Map<string, number>()
    const dayCounts = new Map<string, number>()
    for (const row of rows) {
      pathCounts.set(row.path, (pathCounts.get(row.path) || 0) + 1)
      const lang = row.language || "?"
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1)
      const day = row.created_at.slice(0, 10)
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1)
    }

    const topPaths = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))

    const languageBreakdown = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, count }))

    const viewsByDay = [...dayCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count }))

    return NextResponse.json({
      totalAllTime: totalAllTime || 0,
      total30d,
      total7d,
      topPaths,
      languageBreakdown,
      viewsByDay,
    })
  } catch (error) {
    console.error("[api/admin/analytics] Error calculando analíticas:", error)
    return NextResponse.json({ error: "No se pudieron calcular las analíticas." }, { status: 500 })
  }
}
