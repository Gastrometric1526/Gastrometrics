/**
 * Presencia real de un lote de cuentas — pedido explícito: mostrar "en línea"/"visto
 * hace X" en Cuentas sin re-pedir la lista completa cada 20-30s. Ver
 * supabase/migrations/0014_user_presence.sql y docs/70.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

// "En línea" = actividad registrada en los últimos 3 minutos (el heartbeat del
// navegador manda cada ~60s, ver components/presence-tracker.tsx — 3 min da margen
// de sobra para latencia de red o un ciclo de heartbeat perdido).
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000

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
        online: now - new Date(row.last_seen_at).getTime() < ONLINE_THRESHOLD_MS,
        lastSeenAt: row.last_seen_at,
      }
    }

    return NextResponse.json({ presence })
  } catch (error) {
    console.error("[api/admin/presence] Error leyendo presencia:", error)
    return NextResponse.json({ error: "No se pudo leer la presencia." }, { status: 500 })
  }
}
