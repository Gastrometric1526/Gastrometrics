"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { setCurrentPlanSlug } from "@/lib/plan-access"

/**
 * Programa automático "100 cocinas fundadoras" (docs/158). En el Dashboard pregunta una
 * vez por cuenta si le toca; si el servidor dice "espera", vuelve a preguntar cuando pasa
 * el minuto. Cuando se asigna, actualiza el plan en pantalla y pide al aviso de cambio de
 * plan que se muestre (con su tutorial del plan nuevo, docs/157).
 */
export function FounderGrantTrigger() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const doneKey = `gm_founder_checked:${user.id}`
    try {
      if (localStorage.getItem(doneKey)) return
    } catch {
      /* sin almacenamiento: se pregunta igual, el servidor es idempotente */
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const ask = async (attempt: number) => {
      if (cancelled || attempt > 5) return
      try {
        const res = await fetch("/api/plan/founder-grant", { method: "POST" })
        const data = await res.json()
        if (cancelled) return
        if (data?.action === "wait") {
          timer = setTimeout(() => ask(attempt + 1), Math.min(Math.max(Number(data.waitMs) || 60_000, 1_000), 120_000))
          return
        }
        if (data?.action === "grant" && data.planSlug) {
          setCurrentPlanSlug(data.planSlug)
          window.dispatchEvent(new CustomEvent("gm:plan-notice-refresh"))
        }
        try {
          localStorage.setItem(doneKey, "1")
        } catch {
          /* nada */
        }
      } catch {
        timer = setTimeout(() => ask(attempt + 1), 60_000)
      }
    }
    ask(0)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [user])

  return null
}
