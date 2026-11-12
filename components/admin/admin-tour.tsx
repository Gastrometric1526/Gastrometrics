"use client"

/**
 * Recorrido completo del panel (pedido del dueño, docs/282): pensado para quien lo
 * administra sin haberlo armado. Sale solo la primera vez que entra una persona con rol
 * «admin» (no al dueño); cualquiera lo vuelve a abrir desde la Guía → «Ver el recorrido del
 * panel». Usa el mismo motor que los tutoriales de la app (components/page-tour.tsx).
 */

import { useEffect, useState } from "react"
import { PageTour, type TourStep } from "@/components/page-tour"
import { useLanguage } from "@/contexts/language-context"

export const ADMIN_TOUR_KEY = "tour_completed_admin-panel"

export function AdminPanelTour({ autoStart, forceStart }: { autoStart: boolean; forceStart: boolean }) {
  const { t } = useLanguage()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (forceStart) {
      try {
        localStorage.removeItem(ADMIN_TOUR_KEY)
      } catch {}
    }
    setReady(true)
  }, [forceStart])
  if (!ready || (!autoStart && !forceStart)) return null

  const step = (id: string, selector: string | null): TourStep => ({
    id,
    title: t(`admin_tour_${id}_title` as never),
    description: t(`admin_tour_${id}_desc` as never),
    selector,
  })
  const steps: TourStep[] = [
    step("welcome", '[data-tour="admin-title"]'),
    step("search", '[data-tour="admin-search"]'),
    step("today", '[data-tour="admin-todo"]'),
    step("messages", '[data-area-tile="buzon"]'),
    step("people", '[data-area-tile="cuentas"]'),
    step("money", '[data-area-tile="ingresos"]'),
    step("growth", '[data-area-tile="crecimiento"]'),
    step("notify", '[data-area-tile="comunicacion"]'),
    step("system", '[data-area-tile="sistema"]'),
    step("quick", '[data-tour="admin-quick"]'),
    step("bell", '[data-tour="admin-bell"]'),
    step("finish", '[data-tour="admin-logout"]'),
  ]
  return <PageTour steps={steps} storageKey={ADMIN_TOUR_KEY} ignoreJourney startDelay={600} />
}
