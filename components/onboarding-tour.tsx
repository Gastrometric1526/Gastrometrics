"use client"

import { useRouter } from "next/navigation"
import { PageTour, type TourStep } from "@/components/page-tour"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { useLanguage } from "@/contexts/language-context"
import { Sparkles } from "lucide-react"

const ONBOARDING_KEY = "onboarding_completed"

export function OnboardingTour() {
  const router = useRouter()
  const { t } = useLanguage()

  const steps: TourStep[] = [
    {
      id: "welcome",
      title: t("tour_dash_welcome_title"),
      description: t("tour_dash_welcome_desc"),
      selector: '[data-tour="dash-header"]',
      icon: GastrometricsLogo,
    },
    {
      id: "sidebar",
      title: t("tour_dash_sidebar_title"),
      description: t("tour_dash_sidebar_desc"),
      selector: '[data-tour="sidebar"]',
    },
    { id: "dash-new-recipe", title: t("tour_dash_new_recipe_title"), description: t("tour_dash_new_recipe_desc"), selector: '[data-tour="dash-new-recipe"]' },
    { id: "dash-stats", title: t("tour_dash_stats_title"), description: t("tour_dash_stats_desc"), selector: '[data-tour="dash-stats"]' },
    { id: "dash-add-business", title: t("tour_dash_add_business_title"), description: t("tour_dash_add_business_desc"), selector: '[data-tour="dash-add-business"]' },
    { id: "dash-quick-actions", title: t("tour_dash_quick_actions_title"), description: t("tour_dash_quick_actions_desc"), selector: '[data-tour="dash-quick-actions"]' },
    { id: "dash-recent-activity", title: t("tour_dash_recent_activity_title"), description: t("tour_dash_recent_activity_desc"), selector: '[data-tour="dash-recent-activity"]' },
    { id: "dash-notifications", title: t("tour_dash_notifications_title"), description: t("tour_dash_notifications_desc"), selector: '[data-tour="dash-notifications"]' },
    {
      id: "done",
      title: t("tour_dash_done_title"),
      description: t("tour_dash_done_desc"),
      selector: null,
      icon: Sparkles,
    },
  ]

  return (
    <PageTour
      steps={steps}
      storageKey={ONBOARDING_KEY}
      finishLabel={t("tour_finish_go_ingredients")}
      onStart={() => window.dispatchEvent(new CustomEvent("gm:tour", { detail: { active: true } }))}
      // BUG CORREGIDO (pedido explícito: "forzar al usuario de llevarlo de la mano al
      // ingredientes"): antes el redirect a /ingredientes vivía en onFinish, que
      // page-tour.tsx SOLO dispara al terminar el último paso — si alguien saltaba el
      // tour con Escape o el botón (✕) en cualquier paso anterior, `onFinish` nunca se
      // llamaba y la persona se quedaba en el Dashboard sin ninguna guía. `onClose` en
      // cambio se dispara siempre que el tour se cierra, sea por salto o por fin
      // (ver close() en page-tour.tsx) — mismo destino sin importar cómo se cierre.
      onClose={() => {
        window.dispatchEvent(new CustomEvent("gm:tour", { detail: { active: false } }))
        router.push("/ingredientes")
      }}
      onStepChange={(step) =>
        window.dispatchEvent(new CustomEvent("gm:tour:step", { detail: { selector: step.selector } }))
      }
    />
  )
}
