"use client"

/**
 * Tutorial guiado progresivo (docs/221). Montado una vez en app/layout.tsx; decide qué etapa
 * toca según lo que la persona ya hizo (lib/journey.ts) y la acompaña:
 * - en la pantalla de la etapa, resalta cada botón o campo y explica qué hacer; la página
 *   sigue usable (el resaltado no bloquea los clics) y avanza cuando la persona actúa;
 * - en otra pantalla, una tarjeta «Ir a …»;
 * - una meta (p. ej. 3 ingredientes) queda como una píldora con el progreso;
 * - las etapas de módulos abren el tutorial ya existente de esa página.
 * Las cuentas que ya existían pueden saltárselo; las nuevas, pausarlo. «Reiniciar tutorial»
 * del menú lateral lo vuelve a empezar (components/sidebar.tsx).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Compass, Lightbulb, MousePointerClick, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/confirm-dialog"
import { computePlacement, computeTooltipPosition, getRect, type Placement, type Rect } from "@/components/page-tour"
import { CHAPTER_GO, CHAPTER_STEPS, type JourneyLive } from "@/components/journey/chapters"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { hasActiveMembership, hasFeatureAccess } from "@/lib/plan-access"
import type { FeatureKey } from "@/lib/plans"
import { ensureIngredientsLoaded, useIngredients } from "@/lib/storage/ingredients"
import { ensureRecipesLoaded, isSubRecipe, useRecipes } from "@/lib/storage/recipes"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
import {
  CHAPTERS,
  JOURNEY_EVENT,
  JOURNEY_PAUSED_KEY,
  JOURNEY_SIGNAL_EVENT,
  isJourneyRoute,
  journeyPosition,
  markDone,
  onChapterRoute,
  readJourney,
  skipJourney,
  startJourney,
  writeJourney,
  EMPTY_JOURNEY,
  type JourneyFacts,
  type JourneyState,
} from "@/lib/journey"

// Tocar una tarjeta del recorrido no debe mover el foco ni avisar «toque afuera» al diálogo
// de abajo (Radix lo cerraría): el evento se corta en la tarjeta y el foco se queda donde estaba.
const keepDialogsOpen = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  },
}

const CARD_WIDTH = 340
const CARD_EST_HEIGHT = 230
const EMPTY_FICHA: JourneyLive["ficha"] = { linesWithIngredient: 0, costedLines: 0, yieldAmount: 0, hasName: false }
const FEATURES = Array.from(new Set(CHAPTERS.flatMap((c) => c.features ?? []))) as FeatureKey[]

function readPaused(): boolean {
  try {
    return sessionStorage.getItem(JOURNEY_PAUSED_KEY) === "1"
  } catch {
    return false
  }
}

function writePaused(value: boolean) {
  try {
    if (value) sessionStorage.setItem(JOURNEY_PAUSED_KEY, "1")
    else sessionStorage.removeItem(JOURNEY_PAUSED_KEY)
  } catch {
    /* sin sessionStorage: la pausa dura hasta recargar */
  }
}

/** ¿Ya usaba la app antes del tutorial guiado? (puede saltárselo entero) */
function looksExisting(ingredients: number, recipes: number): boolean {
  if (ingredients > 0 || recipes > 0) return true
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || ""
      if (key === "onboarding_completed" || key.startsWith("tour_completed_")) return true
    }
  } catch {
    /* sin almacenamiento: cuenta nueva */
  }
  return false
}

function visibleRect(selector: string | null): Rect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = getRect(el)
  if (r.width <= 0 || r.height <= 0) return null
  if (r.left + r.width <= 0 || r.top + r.height <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight + 2000) return null
  return r
}

export function GuidedJourney() {
  const { user } = useAuth()
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const { t } = useLanguage()
  const [confirm, confirmDialog] = useConfirmDialog()
  const allIngredients = useIngredients()
  const allRecipes = useRecipes()
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<JourneyState | null>(null)
  const [paused, setPaused] = useState(false)
  const [features, setFeatures] = useState<Partial<Record<FeatureKey, boolean>>>({})
  const [member, setMember] = useState(false)
  const [ficha, setFicha] = useState(EMPTY_FICHA)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [ready, setReady] = useState(true)
  const [otherTourOpen, setOtherTourOpen] = useState(false)
  const [goalSeen, setGoalSeen] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const missesRef = useRef(0)
  const scrolledRef = useRef<string | null>(null)
  const tourAckRef = useRef<string | null>(null)

  const ingredients = useMemo(() => allIngredients.filter((i) => i.category !== SUBRECIPE_CLASSIFICATION).length, [allIngredients])
  const recipes = useMemo(() => allRecipes.filter((r) => !isSubRecipe(r)).length, [allRecipes])
  const facts: JourneyFacts = useMemo(() => ({ ingredients, recipes, features }), [ingredients, recipes, features])
  const enabled = !!user && loaded && isJourneyRoute(pathname) && !member

  // Carga inicial: datos de la cuenta y estado guardado.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setState(readJourney())
    setPaused(readPaused())
    Promise.all([ensureIngredientsLoaded().catch(() => null), ensureRecipesLoaded().catch(() => null)]).finally(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // Plan y sesión de invitado: se revisan al cambiar de pantalla y cuando cambia el plan.
  useEffect(() => {
    const refresh = () => {
      setMember(hasActiveMembership())
      setFeatures(Object.fromEntries(FEATURES.map((f) => [f, hasFeatureAccess(f)])))
    }
    refresh()
    window.addEventListener("planChanged", refresh)
    return () => window.removeEventListener("planChanged", refresh)
  }, [pathname])

  // Cambios desde fuera (reiniciar desde el menú lateral) y señales de las pantallas.
  useEffect(() => {
    const onState = () => {
      setState(readJourney())
      setPaused(readPaused())
      setStepIndex(0)
    }
    const onSignal = (event: Event) => {
      const detail = (event as CustomEvent<{ name: string; data?: Partial<JourneyLive["ficha"]> }>).detail
      if (detail?.name === "ficha") setFicha({ ...EMPTY_FICHA, ...detail.data })
    }
    const onAck = (event: Event) => {
      tourAckRef.current = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey ?? null
    }
    window.addEventListener(JOURNEY_EVENT, onState)
    window.addEventListener(JOURNEY_SIGNAL_EVENT, onSignal)
    window.addEventListener("gm:tour:ack", onAck)
    return () => {
      window.removeEventListener(JOURNEY_EVENT, onState)
      window.removeEventListener(JOURNEY_SIGNAL_EVENT, onSignal)
      window.removeEventListener("gm:tour:ack", onAck)
    }
  }, [])

  // Las tarjetas «Ir a …», de meta y de presentación esperan a que se cierre cualquier ventana
  // abierta (Novedades, una encuesta, un diálogo de la página).
  useEffect(() => {
    if (!enabled) return
    const check = () => setDialogOpen(!!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'))
    check()
    const interval = setInterval(check, 500)
    return () => clearInterval(interval)
  }, [enabled])

  // Al salir de la Ficha Técnica se olvida lo que reportó.
  useEffect(() => {
    if (!pathname.startsWith("/ficha-tecnica")) setFicha(EMPTY_FICHA)
  }, [pathname])

  // Cuenta nueva: empieza sola. Cuenta que ya existía: elige (tarjeta de presentación).
  const isExisting = useMemo(() => (loaded ? looksExisting(ingredients, recipes) : false), [loaded, ingredients, recipes])
  useEffect(() => {
    if (!enabled || state !== null || isExisting) return
    const next = startJourney(false)
    writeJourney(next)
    setState(next)
  }, [enabled, state, isExisting])

  const position = useMemo(() => journeyPosition(state ?? EMPTY_JOURNEY, facts), [state, facts])
  const autoDoneKey = position.autoDone.join(",")

  // Metas cumplidas y etapas que el plan no incluye se dan por hechas.
  useEffect(() => {
    if (!state || !autoDoneKey) return
    const next = markDone(state, autoDoneKey.split(","))
    if (next !== state) {
      writeJourney(next)
      setState(next)
    }
  }, [state, autoDoneKey])

  const chapter = position.status === "active" ? position.chapter : null
  const chapterId = chapter?.id ?? null
  const onRoute = chapter ? onChapterRoute(chapter, pathname) : false
  const steps = chapterId ? CHAPTER_STEPS[chapterId] ?? [] : []
  const runningSteps = enabled && !paused && !!chapter && chapter.kind === "steps" && position.status === "active" && position.unlocked && onRoute
  const step = runningSteps ? steps[Math.min(stepIndex, steps.length - 1)] : null

  useEffect(() => {
    setStepIndex(0)
    missesRef.current = 0
  }, [chapterId])

  const completeChapter = useCallback(
    (id: string) => {
      const current = readJourney() ?? state
      if (!current) return
      const next = markDone(current, [id])
      writeJourney(next)
      setState(next)
      setStepIndex(0)
    },
    [state],
  )

  // Avanza desde un paso concreto: un clic y una condición cumplida a la vez no saltan dos pasos.
  const currentRef = useRef<{ chapterId: string; stepId: string; index: number; length: number } | null>(null)
  currentRef.current = chapterId && step ? { chapterId, stepId: step.id, index: Math.min(stepIndex, steps.length - 1), length: steps.length } : null
  const advanceFrom = useCallback(
    (stepId: string) => {
      const cur = currentRef.current
      if (!cur || cur.stepId !== stepId) return
      currentRef.current = { ...cur, stepId: "" }
      missesRef.current = 0
      if (cur.index >= cur.length - 1) completeChapter(cur.chapterId)
      else setStepIndex(cur.index + 1)
    },
    [completeChapter],
  )
  const goNext = () => step && advanceFrom(step.id)

  const goBack = () => {
    missesRef.current = 0
    setStepIndex((i) => Math.max(0, i - 1))
  }

  // Seguimiento del paso: dónde está lo resaltado, si ya se cumplió y si desapareció.
  useEffect(() => {
    if (!step) {
      setRect(null)
      return
    }
    const live: JourneyLive = { ficha, ingredients, recipes }
    const tick = () => {
      setOtherTourOpen(!!document.querySelector("[data-tour-overlay]"))
      const r = visibleRect(step.selector)
      setRect((prev) =>
        prev && r && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : r,
      )
      if (step.selector && r && scrolledRef.current !== `${chapterId}:${step.id}`) {
        scrolledRef.current = `${chapterId}:${step.id}`
        document.querySelector(step.selector)?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      if (step.selector && !r) {
        missesRef.current += 1
        if (missesRef.current >= 6) {
          missesRef.current = 0
          if (step.optional) {
            advanceFrom(step.id)
            return
          }
          // Volver al último paso que sí se puede mostrar (p. ej. se cerró el diálogo).
          for (let j = stepIndex - 1; j >= 0; j--) {
            const s = steps[j]
            if (s.selector && visibleRect(s.selector)) {
              setStepIndex(j)
              return
            }
          }
          if (stepIndex > 0 && steps[0].selector) setStepIndex(0)
        }
        return
      }
      missesRef.current = 0
      const isReady = step.ready ? step.ready(live) : true
      setReady(isReady)
      if (isReady && step.ready && (step.advance === "auto" || step.advance === "click")) advanceFrom(step.id)
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [step, stepIndex, steps, chapterId, ficha, ingredients, recipes, advanceFrom])

  // Pasos que avanzan cuando la persona toca lo resaltado.
  useEffect(() => {
    if (!step || step.advance !== "click" || !step.selector) return
    const { selector, id } = step
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.(selector)) setTimeout(() => advanceFrom(id), 350)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [step, advanceFrom])

  // Etapas de módulo: abren el tutorial de esa página y siguen cuando se cierra.
  const pageTourKey = enabled && !paused && chapter?.kind === "page-tour" && position.status === "active" && position.unlocked && onRoute ? chapter.tourKey ?? null : null
  useEffect(() => {
    if (!pageTourKey || !chapterId) return
    tourAckRef.current = null
    const onClosed = (event: Event) => {
      if ((event as CustomEvent<{ storageKey?: string }>).detail?.storageKey === pageTourKey) completeChapter(chapterId)
    }
    window.addEventListener("gm:tour:closed", onClosed)
    const open = setTimeout(() => window.dispatchEvent(new CustomEvent("gm:tour:restart", { detail: { storageKey: pageTourKey } })), 900)
    // Si la página no tiene ese tutorial (p. ej. bloqueada por el plan), la etapa se da por vista.
    const fallback = setTimeout(() => {
      if (tourAckRef.current !== pageTourKey) completeChapter(chapterId)
    }, 4500)
    return () => {
      window.removeEventListener("gm:tour:closed", onClosed)
      clearTimeout(open)
      clearTimeout(fallback)
    }
  }, [pageTourKey, chapterId, completeChapter])

  const pause = () => {
    writePaused(true)
    setPaused(true)
  }
  const resume = () => {
    writePaused(false)
    setPaused(false)
  }
  const skip = async () => {
    const ok = await confirm(t("journey_skip_confirm_desc"), { title: t("journey_skip_confirm_title"), confirmLabel: t("journey_skip_confirm_ok") })
    if (!ok) return
    const next = skipJourney(state ?? { ...EMPTY_JOURNEY, existing: true })
    writeJourney(next)
    setState(next)
  }
  const canSkip = state ? state.existing : isExisting

  if (!enabled || typeof document === "undefined") return confirmDialog

  const stageLabel =
    position.status === "active" ? t("journey_progress").replace("{n}", String(position.index + 1)).replace("{total}", String(position.total)) : ""

  const header = (
    <div className="mb-2 flex items-center gap-2 pr-6">
      <Compass className="h-4 w-4 text-primary" />
      <span className="text-xs font-semibold text-primary">{t("journey_label")}</span>
      {stageLabel && <span className="text-xs text-muted-foreground">· {stageLabel}</span>}
    </div>
  )

  const closeButton = (
    <button
      type="button"
      onClick={pause}
      aria-label={t("journey_pause")}
      title={t("journey_pause")}
      className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  )

  const skipLink = canSkip ? (
    <button type="button" onClick={skip} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
      {t("journey_skip")}
    </button>
  ) : null

  const floating = (content: React.ReactNode) =>
    dialogOpen
      ? null
      : createPortal(
      <div
        data-gm-page-tour=""
        {...keepDialogsOpen}
        role="dialog"
        aria-label={t("journey_label")}
        className="pointer-events-auto fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-[1001] w-[min(380px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-2xl md:bottom-6 print:hidden"
      >
        {content}
      </div>,
      document.body,
    )

  const pill = (label: string, onClick: () => void) =>
    createPortal(
      <button
        type="button"
        data-gm-page-tour=""
        {...keepDialogsOpen}
        data-journey-pill=""
        onClick={onClick}
        className="pointer-events-auto fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[calc(100vw-6rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-lg transition hover:shadow-xl md:bottom-5 print:hidden"
      >
        <Compass className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{label}</span>
      </button>,
      document.body,
    )

  // Cuenta que ya existía y todavía no eligió.
  if (state === null) {
    if (!isExisting) return confirmDialog
    return (
      <>
        {floating(
          <>
            {header}
            <h3 className="mb-1 text-base font-bold text-foreground">{t("journey_existing_title")}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("journey_existing_desc")}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = skipJourney({ ...EMPTY_JOURNEY, existing: true })
                  writeJourney(next)
                  setState(next)
                }}
              >
                {t("journey_skip")}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const next = startJourney(true)
                  writeJourney(next)
                  setState(next)
                }}
                className="gap-1.5"
              >
                {t("journey_start")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>,
        )}
        {confirmDialog}
      </>
    )
  }

  if (position.status !== "active" || !chapter) return confirmDialog
  if (paused) return <>{pill(t("journey_paused_pill"), resume)}{confirmDialog}</>
  if (otherTourOpen && !step) return confirmDialog

  const go = CHAPTER_GO[chapter.id]
  const goTo = () => chapter.route && router.push(chapter.route)

  // Meta con progreso (3 ingredientes, 3 recetas).
  if (chapter.kind === "goal" && chapter.goal) {
    const { current, target } = chapter.goal(facts)
    const label = `${t(go?.title ?? "journey_label")} · ${Math.min(current, target)}/${target}`
    if (goalSeen[chapter.id] || !go) return <>{pill(label, () => setGoalSeen((g) => ({ ...g, [chapter.id]: false })))}{confirmDialog}</>
    return (
      <>
        {floating(
          <>
            {closeButton}
            {header}
            <h3 className="mb-1 text-base font-bold text-foreground">{t(go.title)}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(go.description)}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (current / target) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.min(current, target)}/{target}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              {skipLink ?? <span />}
              <div className="flex gap-2">
                {!onRoute && (
                  <Button size="sm" variant="outline" onClick={goTo}>
                    {t("journey_go").replace("{module}", t(go.module))}
                  </Button>
                )}
                <Button size="sm" onClick={() => setGoalSeen((g) => ({ ...g, [chapter.id]: true }))}>
                  {t("journey_got_it")}
                </Button>
              </div>
            </div>
          </>,
        )}
        {confirmDialog}
      </>
    )
  }

  // Etapa disponible pero en otra pantalla (o todavía bloqueada): tarjeta «Ir a …».
  if (!onRoute || !position.unlocked) {
    if (!go) return confirmDialog
    return (
      <>
        {floating(
          <>
            {closeButton}
            {header}
            <h3 className="mb-1 text-base font-bold text-foreground">{t(go.title)}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(go.description)}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              {skipLink ?? (
                <Button variant="ghost" size="sm" onClick={pause}>
                  {t("journey_later")}
                </Button>
              )}
              {!onRoute && (
                <Button size="sm" onClick={goTo} className="gap-1.5">
                  {t("journey_go").replace("{module}", t(go.module))}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>,
        )}
        {confirmDialog}
      </>
    )
  }

  // Etapa de módulo: el tutorial de la página se abre solo (efecto de arriba).
  if (chapter.kind === "page-tour" || !step) return confirmDialog
  if (otherTourOpen) return confirmDialog

  // Paso a paso dentro de la pantalla.
  const placement: Placement = rect ? computePlacement(rect, window.innerWidth, window.innerHeight) : "center"
  const cardStyle: React.CSSProperties =
    rect && placement !== "center"
      ? { ...computeTooltipPosition(rect, placement, window.innerWidth, window.innerHeight, CARD_WIDTH, CARD_EST_HEIGHT), transform: "none" }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
  const isLastStep = stepIndex >= steps.length - 1
  const isLastChapter = chapter.id === "finish"
  const waitingForAction = step.advance !== "next"

  return (
    <>
      {createPortal(
        <div className="print:hidden" data-journey-coach="">
          {/* Resaltado: no bloquea los clics, la pantalla sigue usable. */}
          <div
            aria-hidden
            className="pointer-events-none fixed z-[1000] transition-all duration-300 ease-out"
            style={
              rect
                ? {
                    top: rect.top - 6,
                    left: rect.left - 6,
                    width: rect.width + 12,
                    height: rect.height + 12,
                    borderRadius: 12,
                    boxShadow: "0 0 0 3px hsl(var(--primary)), 0 0 0 9999px rgba(8, 10, 20, 0.45)",
                  }
                : { inset: 0, boxShadow: "inset 0 0 0 9999px rgba(8, 10, 20, 0.45)" }
            }
          />
          {rect && waitingForAction && (
            <div
              aria-hidden
              className="pointer-events-none fixed z-[1000] animate-pulse rounded-xl"
              style={{ top: rect.top - 10, left: rect.left - 10, width: rect.width + 20, height: rect.height + 20, boxShadow: "0 0 0 3px hsl(var(--primary) / 0.5)" }}
            />
          )}
          <div
            data-gm-page-tour=""
        {...keepDialogsOpen}
            role="dialog"
            aria-label={t("journey_label")}
            className="pointer-events-auto fixed z-[1001] w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-2xl"
            style={cardStyle}
          >
            {closeButton}
            <div className="p-4 pb-3">
              {header}
              <h3 className="mb-1 pr-4 text-base font-bold text-foreground text-balance">{t(step.title)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{t(step.description)}</p>
              {step.tip && (
                <div className="mt-3 flex gap-2 rounded-lg bg-primary/5 p-2.5 text-xs leading-relaxed text-foreground">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold">{t("hint_tip_label")} </span>
                    {t(step.tip)}
                  </span>
                </div>
              )}
              {waitingForAction && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  {t(step.advance === "click" ? "journey_do_it" : "journey_auto")}
                </p>
              )}
              {!waitingForAction && !ready && <p className="mt-3 text-xs font-medium text-primary">{t("journey_fill_it")}</p>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("tour_back")}
                  </Button>
                )}
                {skipLink}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {stepIndex + 1}/{steps.length}
                </span>
                {!waitingForAction && (
                  <Button size="sm" onClick={goNext} disabled={!ready} className="gap-1.5">
                    {isLastStep ? t(isLastChapter ? "journey_finish_button" : "journey_continue") : t("tour_next")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {confirmDialog}
    </>
  )
}
