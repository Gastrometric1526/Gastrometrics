"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"

const PENDING_KEY = "gm_email_click_pending"

/**
 * Detecta la llegada desde un correo (utm_source=email&utm_campaign=…, ver
 * lib/email-tracking.ts) y la registra a nombre de la cuenta. Si la persona llega sin
 * sesión (el enlace la manda a /login), el clic queda pendiente en sessionStorage y se
 * registra en cuanto inicia sesión.
 */
export function EmailClickTracker() {
  const { user } = useAuth()

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("utm_source") === "email" && params.get("utm_campaign")) {
        sessionStorage.setItem(PENDING_KEY, params.get("utm_campaign") as string)
      }
    } catch {
      /* sin sessionStorage: no se mide */
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let campaign: string | null = null
    try {
      campaign = sessionStorage.getItem(PENDING_KEY)
    } catch {
      return
    }
    if (!campaign) return
    try {
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      /* nada */
    }
    fetch("/api/track-email-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign }),
      keepalive: true,
    }).catch(() => {})
  }, [user])

  return null
}
