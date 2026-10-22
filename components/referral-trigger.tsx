"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { setCurrentPlanSlug } from "@/lib/plan-access"

/**
 * Programa de referidos (docs/179): al abrir la app, si la cuenta llegó por la invitación
 * de un colega, pide su mes regalo. El servidor espera primero al programa de fundadoras
 * (si le toca Chef Ejecutivo, el regalo se guarda detrás). El cron diario hace de respaldo.
 */
export function ReferralTrigger() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const doneKey = `gm_referral_claimed:${user.id}`
    try {
      if (localStorage.getItem(doneKey)) return
    } catch {
      /* sin almacenamiento: se pregunta igual, el servidor es idempotente */
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const markDone = () => {
      try {
        localStorage.setItem(doneKey, "1")
      } catch {
        /* nada */
      }
    }

    const ask = async (attempt: number) => {
      if (cancelled || attempt > 5) return
      try {
        const res = await fetch("/api/referral/claim", { method: "POST" })
        const data = await res.json()
        if (cancelled) return
        if (data?.status === "wait") {
          timer = setTimeout(() => ask(attempt + 1), Math.min(Math.max(Number(data.waitMs) || 60_000, 1_000), 120_000))
          return
        }
        if (data?.status === "applied" && data.planSlug) {
          setCurrentPlanSlug(data.planSlug)
          window.dispatchEvent(new CustomEvent("gm:plan-notice-refresh"))
        }
        markDone()
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
