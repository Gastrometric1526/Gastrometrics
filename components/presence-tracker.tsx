"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const HEARTBEAT_INTERVAL_MS = 60_000

/**
 * Presencia real (ver supabase/migrations/0014_user_presence.sql y docs/70) — un
 * upsert autenticado directo del navegador, cada ~60s, mientras haya sesión real y NO
 * se esté en /admin (mismo criterio de exclusión que ya usa AnalyticsTracker, para no
 * contaminar la propia navegación del dueño dentro de su panel). RLS
 * (user_presence_self_all) garantiza que cada quien solo puede tocar su propia fila —
 * no hace falta pasar por una ruta de servidor, mismo patrón ya usado por
 * syncPreferredLanguage/updateUserProfile en contexts/auth-context.tsx.
 */
export function PresenceTracker() {
  const pathname = usePathname()
  const { isLoggedIn, user } = useAuth()

  useEffect(() => {
    if (!isLoggedIn || !user || (pathname && pathname.startsWith("/admin"))) return

    const ping = () => {
      const supabase = getSupabaseBrowserClient()
      supabase
        .from("user_presence")
        .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error("[presence] Error registrando presencia:", error)
        })
    }

    ping()
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isLoggedIn, user, pathname])

  return null
}
