"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { ArrowRight, ArrowLeft, X } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export type TourStep = {
  id: string
  title: string
  description: string
  // Selector del elemento real a resaltar. null = paso centrado, sin foco en un elemento.
  selector: string | null
  // Ícono opcional mostrado junto al contador de paso (logo de marca, un lucide-icon, etc).
  icon?: React.ComponentType<{ className?: string }>
  // Se ejecuta justo antes de buscar `selector` en el DOM — usado para tours dentro
  // de un Dialog con pestañas (ej. Configuración), donde el contenido de una pestaña
  // no activa no existe en el DOM hasta que se hace clic en su trigger. El elemento
  // puede tardar un render en aparecer después de esto, por eso la búsqueda de abajo
  // reintenta unos cuadros en vez de un solo document.querySelector.
  beforeShow?: () => void
}

type Rect = { top: number; left: number; width: number; height: number }
type Placement = "top" | "bottom" | "left" | "right" | "center"

const PADDING = 8
const TOOLTIP_WIDTH = 336
const TOOLTIP_EST_HEIGHT = 240
const GAP = 18
const SIDEBAR_COLUMN_WIDTH = 260

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function computePlacement(rect: Rect, vw: number, vh: number): Placement {
  const spaceBelow = vh - (rect.top + rect.height)
  const spaceAbove = rect.top
  const spaceRight = vw - (rect.left + rect.width)
  const spaceLeft = rect.left

  // Elementos angostos pegados al borde izquierdo (el sidebar, un botón chico) se
  // explican mejor con el tooltip a la derecha — pero solo si de verdad son angostos:
  // un encabezado ancho de página también puede empezar cerca del borde izquierdo en
  // pantallas chicas (justo después de un sidebar colapsado) y ahí bottom/top es lo
  // correcto, no forzar "right" y sacar el tooltip de la pantalla.
  if (rect.width < 300 && rect.left < SIDEBAR_COLUMN_WIDTH && spaceRight > TOOLTIP_WIDTH + GAP) return "right"

  if (spaceBelow > TOOLTIP_EST_HEIGHT + GAP) return "bottom"
  if (spaceAbove > TOOLTIP_EST_HEIGHT + GAP) return "top"
  if (spaceRight > TOOLTIP_WIDTH + GAP) return "right"
  if (spaceLeft > TOOLTIP_WIDTH + GAP) return "left"
  // Ningún lado tiene el espacio ESTIMADO ideal (viewport corto/angosto) — en vez de
  // asumir "bottom" a ciegas, se elige el lado con más espacio real disponible entre
  // arriba/abajo. overflowCorrection sigue siendo la red de seguridad final una vez que
  // se conoce el alto real de la tarjeta, pero partir del lado con más margen reduce
  // cuánto tiene que corregir y evita casos donde "bottom" empuja la tarjeta mucho más
  // fuera de pantalla que "top" lo hubiera hecho.
  return spaceAbove > spaceBelow ? "top" : "bottom"
}

type TooltipBox = { top: number; left: number; right?: never } | { top: number; right: number; left?: never }

// Fórmula única de posición, compartida entre el placement inicial (con el alto/ancho
// ESTIMADO, antes de que la tarjeta real exista en el DOM) y la corrección post-render
// (con el alto/ancho REAL). Antes había dos fórmulas separadas y la corrección decidía
// si aplicarse comparando la posición ya aplicada contra la que ella misma acababa de
// calcular — un elemento con posición fija no cambia de tamaño según su propio top/left,
// así que esa comparación de posición era innecesaria y, peor, causaba un bucle: al leer
// una posición YA corregida, concluía "coincide, no hace falta corregir" y volvía a la
// fórmula ingenua (con el alto estimado) en el siguiente render — sin que nada disparara
// una nueva corrección, porque `overflowCorrection` no es una dependencia del efecto.
// Con una sola fórmula, la corrección siempre devuelve un resultado definitivo a partir
// del tamaño real medido, nunca `null`, así que no hay nada que oscilar.
function computeTooltipPosition(
  rect: Rect,
  placement: Placement,
  vw: number,
  vh: number,
  boxWidth: number,
  boxHeight: number,
): TooltipBox {
  const effectiveWidth = Math.min(boxWidth, vw - 32)
  const effectiveHeight = Math.min(boxHeight, vh - 32)
  const clampLeft = (left: number) => Math.min(Math.max(left, 16), Math.max(16, vw - effectiveWidth - 16))
  const clampTop = (top: number) => Math.min(Math.max(top, 16), Math.max(16, vh - effectiveHeight - 16))

  if (placement === "top") {
    return { top: clampTop(rect.top - PADDING - GAP - boxHeight), left: clampLeft(rect.left + rect.width / 2 - boxWidth / 2) }
  }
  if (placement === "right") {
    return { top: clampTop(rect.top + rect.height / 2 - boxHeight / 2), left: clampLeft(rect.left + rect.width + PADDING + GAP) }
  }
  if (placement === "left") {
    return {
      top: clampTop(rect.top + rect.height / 2 - boxHeight / 2),
      right: Math.min(Math.max(vw - (rect.left - PADDING) + GAP, 16), Math.max(16, vw - effectiveWidth - 16)),
    }
  }
  // "bottom" (y fallback por defecto)
  return { top: clampTop(rect.top + rect.height + PADDING + GAP), left: clampLeft(rect.left + rect.width / 2 - boxWidth / 2) }
}

type PageTourProps = {
  steps: TourStep[]
  storageKey: string
  /** Ms antes de mostrar el primer paso — da tiempo a que el DOM (y animaciones como el sidebar) se asiente. */
  startDelay?: number
  /** Texto del botón en el último paso. Por defecto "Entendido". */
  finishLabel?: string
  /** Se llama al cerrar el tour desde el último paso (no al saltar). Típicamente una navegación. */
  onFinish?: () => void
  /** Se dispara justo antes de mostrar el primer paso — usado por Dashboard para forzar el sidebar expandido. */
  onStart?: () => void
  /** Se dispara al cerrar el tour (por salto o por fin) — para deshacer lo que hizo onStart. */
  onClose?: () => void
  /** Se dispara en cada cambio de paso mientras el tour está abierto — usado por Dashboard
   *  para abrir el drawer del sidebar en móvil SOLO durante el paso "sidebar" y cerrarlo en
   *  los demás pasos (si no, el drawer a pantalla completa tapa lo que se está resaltando). */
  onStepChange?: (step: TourStep) => void
}

export function PageTour({ steps, storageKey, startDelay = 350, finishLabel, onFinish, onStart, onClose, onStepChange }: PageTourProps) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [placement, setPlacement] = useState<Placement>("center")
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  // Corrección post-render: el placement de arriba (top/bottom/left/right) se calcula con
  // una altura ESTIMADA (TOOLTIP_EST_HEIGHT) antes de saber cuánto texto real tiene el
  // paso — una descripción larga (2 líneas, o un idioma más extenso como francés/
  // portugués) puede rendir bastante más alta que la estimación. Si eso empuja el borde
  // real de la tarjeta fuera del viewport, "Atrás"/"Siguiente" quedan inalcanzables. Esta
  // corrección mide la posición YA renderizada y la reacomoda dentro de los márgenes
  // reales — se ejecuta después de cada cambio de paso/posición, antes del pintado.
  const [overflowCorrection, setOverflowCorrection] = useState<TooltipBox | null>(null)

  useEffect(() => {
    const seen = localStorage.getItem(storageKey)
    if (seen) return
    startTimerRef.current = setTimeout(() => {
      onStart?.()
      setIsOpen(true)
      setStepIndex(0)
    }, startDelay)
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Permite reactivar el tour desde fuera (ver components/sidebar.tsx, botón "Reiniciar
  // tutorial") sin importar si ya se marco como visto — se dispara un evento global y
  // cada PageTour montado borra su propia bandera de localStorage y se vuelve a abrir
  // desde el paso 1. Normalmente solo hay un PageTour montado por página, pero
  // SettingsTour vive dentro de un Dialog que puede estar abierto ENCIMA de la página
  // que lo invocó — ahí sí hay dos PageTour montados a la vez (el de la página de atrás
  // y el de Configuración). Un `detail.storageKey` opcional en el evento apunta el
  // restart a un tour específico; sin ese detail (el botón genérico del sidebar) se
  // comporta como siempre, restarta el primero que esté montado.
  useEffect(() => {
    const onRestart = (event: Event) => {
      const targetKey = (event as CustomEvent<{ storageKey?: string }>).detail?.storageKey
      if (targetKey && targetKey !== storageKey) return
      localStorage.removeItem(storageKey)
      onStart?.()
      setStepIndex(0)
      setIsOpen(true)
    }
    window.addEventListener("gm:tour:restart", onRestart)
    return () => window.removeEventListener("gm:tour:restart", onRestart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const close = () => {
    localStorage.setItem(storageKey, "true")
    setIsOpen(false)
    onClose?.()
  }

  // Nota: `close()` ya dispara `onClose` en ambos caminos (saltar y terminar),
  // porque `goNext` en el último paso llama a `close()` antes de `onFinish`.

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  useEffect(() => {
    if (!isOpen) return
    onStepChange?.(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex])

  useEffect(() => {
    if (!isOpen) return
    if (!step.selector) {
      setRect(null)
      setPlacement("center")
      return
    }

    step.beforeShow?.()

    let cancelled = false
    let raf = 0
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    let cleanupTracking: (() => void) | null = null

    // beforeShow (ej. hacer clic en el trigger de una pestaña) actualiza estado de
    // React de forma asíncrona — el elemento buscado puede no existir todavía en el
    // mismo tick. Se reintenta por unos cuadros de animación en vez de un único
    // document.querySelector, que fallaría siempre en ese caso.
    const findAndTrack = (attemptsLeft: number) => {
      if (cancelled) return
      const el = document.querySelector(step.selector as string)
      if (!el) {
        if (attemptsLeft <= 0) {
          setRect(null)
          setPlacement("center")
          return
        }
        raf = requestAnimationFrame(() => findAndTrack(attemptsLeft - 1))
        return
      }

      el.scrollIntoView({ behavior: "smooth", block: "center" })

      const update = () => {
        const r = getRect(el)
        setRect(r)
        setPlacement(computePlacement(r, window.innerWidth, window.innerHeight))
      }
      update()

      let trackingRaf = 0
      const loop = () => {
        update()
        trackingRaf = requestAnimationFrame(loop)
      }
      trackingRaf = requestAnimationFrame(loop)
      stopTimer = setTimeout(() => cancelAnimationFrame(trackingRaf), 650)

      window.addEventListener("resize", update)
      window.addEventListener("scroll", update, { passive: true })
      cleanupTracking = () => {
        cancelAnimationFrame(trackingRaf)
        window.removeEventListener("resize", update)
        window.removeEventListener("scroll", update)
      }
    }

    findAndTrack(30) // ~30 cuadros (~0.5s a 60fps) de margen para que el DOM se asiente

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (stopTimer) clearTimeout(stopTimer)
      cleanupTracking?.()
    }
  }, [isOpen, stepIndex, step.selector])

  const goNext = () => {
    if (isLast) {
      close()
      onFinish?.()
      return
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1))
  }

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1))

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "ArrowRight") goNext()
      if (e.key === "ArrowLeft") goBack()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  // Corrección post-render contra desborde real (ver comentario en computeTooltipPosition
  // más arriba, y docs/47 para la historia completa del bug): usa el mismo
  // computeTooltipPosition que el placement inicial, pero con offsetWidth/offsetHeight —
  // el tamaño YA renderizado de la tarjeta, que no cambia según qué top/left se le haya
  // aplicado, así que no hay nada que comparar contra la posición actual. Siempre
  // devuelve una posición definitiva (nunca null) mientras placement no sea "center",
  // así que no puede oscilar entre "corregido" y "vuelto a la fórmula ingenua".
  // useLayoutEffect corre sincrónico antes del pintado, así que la corrección no se
  // llega a ver — no hay parpadeo.
  useLayoutEffect(() => {
    if (!isOpen || placement === "center" || !rect) {
      setOverflowCorrection(null)
      return
    }
    const el = tooltipRef.current
    if (!el) return
    setOverflowCorrection(
      computeTooltipPosition(rect, placement, window.innerWidth, window.innerHeight, el.offsetWidth, el.offsetHeight),
    )
  }, [isOpen, stepIndex, placement, rect])

  if (!isOpen) return null

  const holeStyle = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null

  // BUG CORREGIDO: el placement "center" pone `transform: translate(-50%, -50%)` — sin
  // limpiarlo explícitamente acá, ese transform se queda pegado al pasar a cualquier otro
  // placement (React no siempre lo limpia solo entre este objeto y el de arriba, dado el
  // orden en que cambian `placement`/`rect`/`overflowCorrection` entre renders), y se
  // suma al nuevo top/left — el tooltip terminaba desplazado hasta 168px+ fuera de
  // pantalla aunque el valor que se le asignaba fuera válido.
  // BUG CORREGIDO (viewport angosto/corto): el clamp usaba TOOLTIP_WIDTH/TOOLTIP_EST_HEIGHT
  // fijos para calcular el límite superior — ahora vive en computeTooltipPosition, que usa
  // el tamaño real disponible (viewport menos 16px de margen por lado) y se comparte con
  // la corrección post-render de más abajo, así ambas fórmulas nunca pueden divergir.
  let tooltipStyle: React.CSSProperties = { transform: "none" }
  if (rect && placement !== "center") {
    tooltipStyle = {
      ...computeTooltipPosition(rect, placement, window.innerWidth, window.innerHeight, TOOLTIP_WIDTH, TOOLTIP_EST_HEIGHT),
      transform: "none",
    }
  }

  const Icon = step.icon

  // BUG CORREGIDO: aunque este JSX viviera como hermano de DialogContent en el árbol de
  // React (para el tour de Configuración, ver docs/35/36), su salida real en el DOM
  // seguía anidada donde sea que <SettingsTour /> se haya invocado — dentro del propio
  // <div> del Sidebar, que en móvil carga `-translate-x-full` (un transform) cuando el
  // drawer está cerrado. Cualquier ancestro con transform se vuelve el "containing
  // block" real de un descendiente `position: fixed`, así que todo el cálculo de
  // top/left de este tooltip quedaba relativo a esa esquina movida, no al viewport real
  // — invisible en desktop (el sidebar expandido está en x:0, coincide con el viewport
  // por pura casualidad) pero rompía por completo en móvil con el drawer cerrado. Un
  // portal a document.body saca el DOM real de cualquier ancestro, sin importar dónde
  // se invoque el componente.
  // BUG CORREGIDO: el tour de Configuración (el único que convive con un Dialog de
  // Radix abierto — ver components/settings-dialog.tsx) se veía perfecto pero "Atrás"/
  // "Siguiente"/cerrar no reaccionaban a clics reales. Causa: Radix pone
  // `pointer-events: none` en <body> mientras un Dialog está abierto (para bloquear la
  // página de atrás) y su propio DialogContent se pone `pointer-events: auto` a sí
  // mismo para seguir siendo clickeable — pero este portal, al ser un HERMANO de
  // document.body (no un hijo del Dialog), hereda ese `none` de <body> y nunca lo
  // revierte. z-index más alto no alcanza: pointer-events controla a qué elemento le
  // llega el clic, no el orden de pintado, así que el clic caía a través del tour hacia
  // el contenido del diálogo de atrás (confirmado con elementFromPoint en vivo). Un
  // `.click()` programático nunca lo hubiera mostrado, porque ese método no pasa por
  // hit-testing real.
  return createPortal(
    <div
      className="fixed inset-0 z-[999] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={t("tour_dialog_aria")}
      data-gm-page-tour=""
    >
      <div
        className="fixed inset-0 transition-all duration-300 ease-out"
        style={
          holeStyle
            ? {
                top: holeStyle.top,
                left: holeStyle.left,
                width: holeStyle.width,
                height: holeStyle.height,
                position: "fixed",
                borderRadius: 12,
                boxShadow: "0 0 0 4px hsl(var(--primary)), 0 0 0 9999px rgba(8, 10, 20, 0.78)",
                pointerEvents: "auto",
              }
            : { boxShadow: "0 0 0 9999px rgba(8, 10, 20, 0.78)", pointerEvents: "auto" }
        }
      />

      <div
        ref={tooltipRef}
        // BUG CORREGIDO: esta tarjeta se reposiciona en cada paso Y se sigue re-renderizando
        // varias veces por segundo mientras `findAndTrack` sigue el elemento (rect es un
        // objeto nuevo en cada cuadro, aunque el elemento no se mueva) — con `transition-all`
        // sobre top/left/transform, esa cadena de renders nunca dejaba que la posición
        // terminara de asentarse, y el transform de "translate(-50%,-50%)" del paso central
        // se quedaba pegado (offset de más de 150px) aunque el top/left calculado fuera
        // correcto. La posición tiene que aplicarse de inmediato, sin animar.
        className="fixed z-[1000] w-[336px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
        style={
          placement === "center"
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
            : overflowCorrection
              ? { ...overflowCorrection, transform: "none" }
              : tooltipStyle
        }
      >
        <button
          onClick={close}
          aria-label={t("tour_skip_aria")}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            {Icon && <Icon className="h-7 w-7 text-primary" />}
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("tour_step")} {stepIndex + 1} {t("tour_of")} {steps.length}
            </span>
          </div>
          <h3 className="text-base font-bold text-foreground mb-1.5 text-balance pr-4">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{step.description}</p>
        </div>

        <div className="h-1 bg-muted mx-5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={stepIndex === 0} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {t("tour_back")}
          </Button>
          <Button size="sm" onClick={goNext} className="gap-1.5">
            {isLast ? finishLabel ?? t("tour_done_default") : t("tour_next")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
