"use client"

/**
 * Coordina cuándo pedir una opinión (docs/173), montado en app/layout.tsx:
 * - guarda los momentos de valor (primera receta con costo, primer PDF, recálculo de varias
 *   recetas, primer ingrediente, primer negocio, primera lectura con foto);
 * - en el Dashboard, si toca, abre la calificación (components/quick-rating-dialog.tsx);
 * - en cualquier pantalla de la app, si toca, muestra una pregunta corta (QuestionCard);
 * - nunca encima de otra ventana, nunca en páginas públicas ni en /admin, nunca en la
 *   Vista previa de equipo, y como mucho una pregunta cada 5 días (lib/feedback/ask-rules.ts).
 */

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { QuickRatingDialog } from "@/components/quick-rating-dialog"
import { QuestionCard } from "@/components/feedback/question-card"
import { nextQuestion, ratingDue, recordAsk, recordMoment, type QuestionDef, type ValueMoment } from "@/lib/feedback/ask-rules"
import { VALUE_MOMENT_EVENT, loadAskState, migrateLegacyRating, saveAskState, touchActiveDay } from "@/lib/feedback/ask-store"
import { countOwnRecipesAllBusinesses } from "@/lib/storage/recipes"
import { usePlanStatus, planExpiryOf } from "@/lib/plan-status"
import { useTeamPreview } from "@/lib/plan-access"

const QUIET_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/planes", "/about", "/contacto", "/admin", "/recursos", "/caracteristicas", "/software", "/resenas", "/terminos", "/politica", "/aviso"]

function isQuiet(pathname: string | null): boolean {
  if (!pathname || pathname === "/") return true
  return QUIET_PREFIXES.some((p) => pathname.startsWith(p))
}

export function FeedbackOrchestrator() {
  const { user, userProfile } = useAuth()
  const pathname = usePathname()
  const planStatus = usePlanStatus()
  const { active: previewActive } = useTeamPreview()
  const [rating, setRating] = useState<{ moment: string | null } | null>(null)
  const [question, setQuestion] = useState<QuestionDef | null>(null)
  const expiry = planExpiryOf(planStatus)
  const planExpiringSoon = expiry?.urgency === "urgent" || expiry?.urgency === "today"
  const latest = useRef({ planExpiringSoon, createdAt: userProfile?.createdAt })
  latest.current = { planExpiringSoon, createdAt: userProfile?.createdAt }

  // Momentos de valor.
  useEffect(() => {
    if (!user) return
    const save = (moment: ValueMoment) => saveAskState(user.id, recordMoment(loadAskState(user.id), moment, Date.now()))
    const onMoment = (e: Event) => {
      const moment = (e as CustomEvent<{ moment?: ValueMoment }>).detail?.moment
      if (moment) save(moment)
    }
    const onRecalc = (e: Event) => {
      const detail = (e as CustomEvent<{ affectedRecipes?: unknown[] }>).detail
      if ((detail?.affectedRecipes?.length ?? 0) >= 2) save("cascade_recalc")
    }
    window.addEventListener(VALUE_MOMENT_EVENT, onMoment)
    window.addEventListener("priceRecalculated", onRecalc)
    return () => {
      window.removeEventListener(VALUE_MOMENT_EVENT, onMoment)
      window.removeEventListener("priceRecalculated", onRecalc)
    }
  }, [user])

  // ¿Toca preguntar algo? Unos segundos después de entrar a una pantalla.
  useEffect(() => {
    if (!user || previewActive || isQuiet(pathname) || rating || question) return
    const activeDays = touchActiveDay(user.id)
    let cancelled = false
    let tries = 0
    const decide = async () => {
      if (cancelled) return
      // Si otra ventana está abierta (novedades, vencimiento, tutorial…), se espera.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-tour-overlay]')) {
        if (++tries < 15) timer = setTimeout(decide, 4000) // hasta ~1 minuto
        return
      }
      const state = migrateLegacyRating(user.id, loadAskState(user.id))
      const recipeCount = await countOwnRecipesAllBusinesses(user.id).catch(() => null)
      if (cancelled) return
      const ctx = {
        now: Date.now(),
        accountCreatedAt: latest.current.createdAt,
        activeDays,
        recipeCount,
        planExpiringSoon: latest.current.planExpiringSoon,
        onboardingDone: (() => {
          try {
            return window.localStorage.getItem("onboarding_completed") === "true"
          } catch {
            return false
          }
        })(),
      }
      if (pathname === "/dashboard" && ratingDue(state, ctx)) {
        const m = state.moments
        const moment = m.cascade_recalc ? "cascade_recalc" : m.first_pdf ? "first_pdf" : m.first_priced_recipe ? "first_priced_recipe" : null
        setRating({ moment })
        return
      }
      const q = nextQuestion(state, ctx)
      if (q) setQuestion(q)
    }
    let timer: ReturnType<typeof setTimeout> = setTimeout(decide, 6000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname, previewActive])

  const finish = (target: "rating" | QuestionDef["key"], status: "answered" | "dismissed") => {
    if (user) saveAskState(user.id, recordAsk(loadAskState(user.id), target, status, Date.now()))
    if (target === "rating") setRating(null)
    else setQuestion(null)
  }

  if (!user) return null
  return (
    <>
      {rating && <QuickRatingDialog open moment={rating.moment} onFinish={(s) => finish("rating", s)} />}
      {question && <QuestionCard question={question} onFinish={(s) => finish(question.key, s)} />}
    </>
  )
}
