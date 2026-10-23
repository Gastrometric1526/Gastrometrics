"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

/**
 * /admin en vivo (docs/192): un «tic» que sube cada 30 s mientras la pestaña está visible,
 * y al momento al volver a ella. Cada panel lo incluye en las dependencias de su carga y
 * vuelve a pedir sus datos en silencio (sin vaciar lo que ya muestra ni tocar lo que la
 * persona está escribiendo).
 *
 * No usa Realtime de Supabase: /admin lee con la sesión del código de acceso desde rutas
 * de servidor (service role), no con un usuario de Supabase, así que Realtime no tendría
 * permiso para leer esas tablas.
 */
export const ADMIN_LIVE_INTERVAL_MS = 30_000

interface AdminLive {
  tick: number
  lastUpdatedAt: number
  refreshNow: () => void
}

const AdminLiveContext = createContext<AdminLive>({ tick: 0, lastUpdatedAt: Date.now(), refreshNow: () => {} })

export function AdminLiveProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const [tick, setTick] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now())

  const refreshNow = useCallback(() => {
    setTick((n) => n + 1)
    setLastUpdatedAt(Date.now())
  }, [])

  useEffect(() => {
    if (!enabled) return
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) return
      interval = setInterval(refreshNow, ADMIN_LIVE_INTERVAL_MS)
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshNow()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, refreshNow])

  return <AdminLiveContext.Provider value={{ tick, lastUpdatedAt, refreshNow }}>{children}</AdminLiveContext.Provider>
}

export function useAdminLive(): AdminLive {
  return useContext(AdminLiveContext)
}

/** Número que cambia en cada actualización en vivo; ponlo en las dependencias de la carga. */
export function useAdminTick(): number {
  return useContext(AdminLiveContext).tick
}

/**
 * Llama a `reload` en cada actualización en vivo, pero no en el primer render (de eso
 * ya se encarga la carga normal del panel).
 */
export function useAdminLiveReload(reload: () => void) {
  const tick = useAdminTick()
  const first = useRef(true)
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    reloadRef.current()
  }, [tick])
}
