"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { notifyAdminActivity } from "@/lib/services/activity-log"

const HEARTBEAT_INTERVAL_MS = 60_000
// Cada cuánto cuenta como un ingreso nuevo para el aviso a /admin (docs/248).
const APP_OPEN_GAP_MS = 6 * 60 * 60 * 1000

function notifyAppOpen(userId: string) {
  const key = `gm_app_open_${userId}`
  try {
    if (Date.now() - Number(localStorage.getItem(key) || 0) < APP_OPEN_GAP_MS) return
    localStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  notifyAdminActivity({ module: "app", action: "opened" })
}

/**
 * Presencia real (ver supabase/migrations/0014_user_presence.sql y docs/70) — un
 * heartbeat autenticado directo del navegador, cada ~60s, mientras haya sesión real y
 * NO se esté en /admin (mismo criterio de exclusión que ya usa AnalyticsTracker, para
 * no contaminar la propia navegación del dueño dentro de su panel).
 *
 * Llama al RPC bump_presence() (ver supabase/migrations/0016_presence_time_tracking.sql,
 * docs/78) en vez de hacer un upsert directo — la función suma el tiempo transcurrido
 * desde el heartbeat anterior a total_active_seconds de forma atómica del lado del
 * servidor, algo que un upsert de solo escritura no puede hacer sin exponer una carrera
 * entre pestañas. security definer + auth.uid() interno garantiza que cada quien solo
 * puede sumar tiempo a su propia fila, mismo criterio que ya usa RLS
 * (user_presence_self_all) para el resto de esta tabla.
 */
export function PresenceTracker() {
  const pathname = usePathname()
  const { isLoggedIn, user } = useAuth()

  useEffect(() => {
    if (!isLoggedIn || !user || (pathname && pathname.startsWith("/admin"))) return

    const ping = () => {
      const supabase = getSupabaseBrowserClient()
      supabase.rpc("bump_presence").then(({ error }) => {
        if (error) console.error("[presence] Error registrando presencia:", error)
      })
    }

    ping()
    notifyAppOpen(user.id)
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isLoggedIn, user, pathname])

  return null
}
