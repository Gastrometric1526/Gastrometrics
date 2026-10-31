"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, Lock, PartyPopper } from "lucide-react"
import { PageTour, type TourStep } from "@/components/page-tour"
import { useLanguage } from "@/contexts/language-context"
import { useModuleReveal } from "@/lib/module-reveal"
import { getPlanBySlug } from "@/lib/plans"
import { gainedCapabilities } from "@/lib/plan-capabilities"
import { PLAN_TOUR_PENDING_KEY, planTourModules } from "@/lib/plan-tour"

interface PendingPlanTour {
  id: string
  from: string
  to: string
}

function readPending(): PendingPlanTour | null {
  try {
    const raw = localStorage.getItem(PLAN_TOUR_PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id && parsed?.from && parsed?.to ? parsed : null
  } catch {
    return null
  }
}

/**
 * Tutorial del plan nuevo (docs/157). Sale en el Dashboard justo después de cerrar el
 * aviso de cambio de plan (components/plan-change-notice-dialog.tsx), una vez por cada
 * cambio. Recorre el menú lateral señalando cada módulo con algo nuevo y, para los que
 * todavía no aparecen porque la cuenta no tiene suficientes recetas (lib/module-reveal.ts),
 * explica cuándo se van a desbloquear en vez de señalar algo que no está. Al bajar de
 * plan, explica que los datos se conservan.
 *
 * Si el tutorial de bienvenida (components/onboarding-tour.tsx) todavía no se completó,
 * espera a la próxima visita para no encimar dos tutoriales.
 */
export function PlanTour() {
  const { t, language } = useLanguage()
  const reveal = useModuleReveal()
  const [pending, setPending] = useState<PendingPlanTour | null>(null)

  useEffect(() => {
    const check = () => {
      const onboardingDone = localStorage.getItem("onboarding_completed") === "true"
      setPending(onboardingDone ? readPending() : null)
    }
    check()
    window.addEventListener("gm:plan-tour", check)
    return () => window.removeEventListener("gm:plan-tour", check)
  }, [])

  const steps = useMemo<TourStep[] | null>(() => {
    if (!pending || !reveal.ready) return null
    const toPlan = getPlanBySlug(pending.to)
    const gained = gainedCapabilities(pending.from, pending.to, language)
    const modules = planTourModules(gained, reveal.recipeCount, reveal.showingAll)
    const isUpgrade = gained.length > 0

    const list: TourStep[] = [
      {
        id: "plan-intro",
        title: t("plan_tour_intro_title").replace("{plan}", toPlan.name),
        description: isUpgrade ? t("plan_tour_intro_desc_upgrade") : t("plan_tour_intro_desc_downgrade"),
        selector: null,
        icon: Sparkles,
      },
    ]

    for (const mod of modules) {
      const what = mod.labels.join(" · ")
      list.push(
        mod.waiting
          ? {
              id: `plan-${mod.href}`,
              title: t(mod.navKey as any),
              description: `${what}. ${t("plan_tour_module_waiting")
                .replace("{n}", String(mod.stage))
                .replace("{count}", String(reveal.recipeCount))}`,
              selector: null,
              icon: Lock,
            }
          : {
              id: `plan-${mod.href}`,
              title: t(mod.navKey as any),
              description: `${what}. ${t("plan_tour_module_ready")}`,
              selector: `[data-tour="nav-${mod.href}"]`,
            },
      )
    }

    const waiting = modules.filter((m) => m.waiting)
    const nextStage = waiting.length > 0 ? Math.min(...waiting.map((m) => m.stage)) : 0
    list.push({
      id: "plan-done",
      title: t("plan_tour_done_title"),
      description:
        waiting.length > 0
          ? t("plan_tour_done_desc_waiting").replace("{n}", String(Math.max(nextStage - reveal.recipeCount, 1)))
          : isUpgrade
            ? t("plan_tour_done_desc")
            : t("plan_tour_done_desc_downgrade"),
      selector: null,
      icon: PartyPopper,
    })
    return list
  }, [pending, reveal.ready, reveal.recipeCount, reveal.showingAll, language, t])

  if (!pending || !steps) return null

  return (
    <PageTour
      key={pending.id}
      steps={steps}
      storageKey={`gm_plan_tour_done:${pending.id}`}
      // Lo que trae el plan nuevo: siempre completo (docs/219).
      introSteps={Infinity}
      startDelay={500}
      finishLabel={t("plan_tour_finish")}
      onStart={() => window.dispatchEvent(new CustomEvent("gm:tour", { detail: { active: true } }))}
      onClose={() => {
        window.dispatchEvent(new CustomEvent("gm:tour", { detail: { active: false } }))
        try {
          localStorage.removeItem(PLAN_TOUR_PENDING_KEY)
        } catch {
          /* nada que limpiar */
        }
        setPending(null)
      }}
      onStepChange={(step) =>
        window.dispatchEvent(new CustomEvent("gm:tour:step", { detail: { selector: step.selector } }))
      }
    />
  )
}
