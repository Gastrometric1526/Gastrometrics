"use client"

/**
 * Estado del plan para el indicador del menú lateral y la ventana de vencimiento
 * (docs/165): vencimiento del plan asignado y pago programado. Lo da /api/plan/renewal,
 * que además aplica un pago programado si Stripe ya lo cobró.
 */

import { useEffect, useSyncExternalStore } from "react"
import { useAuth } from "@/contexts/auth-context"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { expiryInfo, type ExpiryInfo } from "@/lib/plan-expiry"

export interface PlanStatus {
  planSlug: string
  planExpiresAt: string | null
  hasSubscription: boolean
  renewal: { status: "scheduled" | "payment_failed"; planSlug: string; startsAt: string } | null
}

/** Abre la ventana de vencimiento desde cualquier parte (el indicador del menú lateral). */
export const OPEN_PLAN_EXPIRY_EVENT = "gm:plan-expiry:open"

const STALE_MS = 10 * 60 * 1000
let snapshot: { userId: string; status: PlanStatus; at: number } | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export async function refreshPlanStatus(userId: string): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch("/api/plan/renewal", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      // Stripe confirmó el cobro del pago programado: el plan nuevo ya está aplicado.
      if (data.justApplied) setCurrentPlanSlug(data.justApplied)
      snapshot = {
        userId,
        at: Date.now(),
        status: {
          planSlug: data.planSlug,
          planExpiresAt: data.planExpiresAt,
          hasSubscription: Boolean(data.hasSubscription),
          renewal: data.renewal,
        },
      }
      emit()
    } catch {
      // Sin conexión: el indicador simplemente no aparece.
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePlanStatus(): PlanStatus | null {
  const { user, isLoggedIn } = useAuth()
  const current = useSyncExternalStore(subscribe, () => snapshot, () => null)
  const userId = isLoggedIn ? user?.id : undefined

  useEffect(() => {
    if (!userId) return
    if (!snapshot || snapshot.userId !== userId || Date.now() - snapshot.at > STALE_MS) refreshPlanStatus(userId)
  }, [userId])

  return current && current.userId === userId ? current.status : null
}

/** Vencimiento relevante para avisar: solo planes asignados (sin suscripción de Stripe) que no son Foodie. */
export function planExpiryOf(status: PlanStatus | null): ExpiryInfo | null {
  if (!status?.planExpiresAt || status.hasSubscription || status.planSlug === "foodie") return null
  const info = expiryInfo(status.planExpiresAt)
  return info.urgency === "expired" ? null : info
}
