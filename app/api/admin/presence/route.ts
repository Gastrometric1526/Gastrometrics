/**
 * Presencia real de un lote de cuentas — pedido explícito: mostrar "en línea"/"visto
 * hace X" en Cuentas sin re-pedir la lista completa cada 20-30s. Ver
 * supabase/migrations/0014_user_presence.sql y docs/70.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { isOnline, ONLINE_THRESHOLD_MS } from "@/lib/admin/online-first"

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((id: unknown) => typeof id === "string") : []

  if (userIds.length === 0) {
    return NextResponse.json({ presence: {} })
  }

  try {
    const admin = getSupabaseAdminClient()
    const { data, error } = await admin.from("user_presence").select("user_id, last_seen_at").in("user_id", userIds)
    if (error) throw error

    const now = Date.now()
    const presence: Record<string, { online: boolean; lastSeenAt: string | null }> = {}
    for (const id of userIds) presence[id] = { online: false, lastSeenAt: null }
    for (const row of data ?? []) {
      presence[row.user_id] = {
        online: isOnline(row.last_seen_at, now),
        lastSeenAt: row.last_seen_at,
      }
    }

    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[api/admin/presence] Error leyendo presencia:", error)
    return NextResponse.json({ error: "No se pudo leer la presencia." }, { status: 500 })
  }
}

/**
 * Cuántas personas están en línea ahora (docs/266), para el contador del encabezado de
 * /admin: las cuentas con actividad en los últimos 3 minutos, con su nombre (como mucho 30).
 */
export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const admin = getSupabaseAdminClient()
    const since = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString()
    const { data, error } = await admin
      .from("user_presence")
      .select("user_id, last_seen_at")
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false })
      .limit(200)
    if (error) throw error
    const rows = (data ?? []) as { user_id: string; last_seen_at: string }[]
    const ids = rows.slice(0, 30).map((r) => r.user_id)
    const names = new Map<string, string>()
    if (ids.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids)
      for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) names.set(p.id, p.full_name)
    }
    return NextResponse.json({
      count: rows.length,
      people: rows.slice(0, 30).map((r) => ({ id: r.user_id, name: names.get(r.user_id) ?? null, lastSeenAt: r.last_seen_at })),
    })
  } catch (error) {
    console.error("[api/admin/presence] Error contando en línea:", error)
    return NextResponse.json({ error: "No se pudo leer la presencia." }, { status: 500 })
  }
}
