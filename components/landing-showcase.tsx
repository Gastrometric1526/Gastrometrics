"use client"

/**
 * «Mira por dentro» en la landing (docs/193, pedido del dueño: que se vea la app real antes de
 * crear la cuenta, con loops que corren solos y animación al hacer scroll, en computadora y
 * celular). Tres piezas:
 *
 * - LandingAppTour: recorrido por 6 pantallas reales (capturas de la app con un restaurante de
 *   ejemplo, en el idioma de la página: public/landing/{idioma}/, generadas con
 *   manual/scripts/landing-media.mjs). Avanza solo como un GIF y también se toca; en computadora
 *   muestra laptop + celular, en el celular solo el teléfono, que recorre la pantalla solo.
 * - LandingPriceStory: la regla real de precios (docs/162) contada al hacer scroll — sube el
 *   tomate, se recalculan las recetas, el precio sube solo si te deja corto y te avisa. En
 *   computadora el panel queda fijo mientras pasan los pasos; en el celular cada paso trae su
 *   propio panel (sin secciones fijadas en pantallas chicas).
 * - LandingInContext: fotos de personas en la cocina, el mercado y fuera del trabajo, con la app
 *   en el teléfono, más cómo instalarla.
 *
 * Movimiento solo con transform/opacity; con «reducir movimiento» del sistema no hay autoplay ni
 * animaciones (globals.css, clase gm-anim). Las imágenes se cargan cuando la sección se acerca.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { Pause, Play, ArrowRight, Bell, TrendingUp, ShieldCheck, Download, ChefHat, ShoppingBasket, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import type { LanguageCode, TranslationKey } from "@/lib/i18n/translations"
import type { Recipe } from "@/types/recipe"
import { applyPriceRule, suggestedUnitPrice } from "@/lib/recipe-pricing"

// ─── utilidades ──────────────────────────────────────────────────────────────

const LANDING_LANGS: LanguageCode[] = ["es", "en", "da", "fr", "pt", "zh"]
export const mediaLang = (lang: LanguageCode) => (LANDING_LANGS.includes(lang) ? lang : "es")

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

/** true en pantallas de computadora: las capturas de laptop no se descargan en el celular. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return desktop
}

function useInView<T extends Element>(options: IntersectionObserverInit & { once?: boolean } = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const { once, root, rootMargin, threshold } = options
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) io.disconnect()
      },
      { root, rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, root, rootMargin, threshold])
  return [ref, inView] as const
}

// ─── marcos de dispositivo ──────────────────────────────────────────────────

export function LaptopFrame({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div className="rounded-[18px] border border-hairline bg-card shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-hairline bg-canvas-alt">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 max-w-sm h-5 rounded-md bg-card border border-hairline text-[11px] text-text-4 flex items-center px-2 truncate">{url}</div>
      </div>
      <div className="relative aspect-[16/10] bg-white overflow-hidden">{children}</div>
    </div>
  )
}

export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[2.4rem] bg-neutral-900 p-[7px] shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] ${className}`}>
      <div className="relative aspect-[390/844] rounded-[2rem] overflow-hidden bg-white">
        {children}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-[18px] w-[34%] rounded-full bg-neutral-900" aria-hidden="true" />
      </div>
    </div>
  )
}

/** Captura alta de celular que el teléfono recorre sola hacia abajo (como si alguien la usara). */
export function PhoneScreen({
  src,
  alt,
  play,
  duration,
  navSrc,
  paused = false,
  loop = false,
}: {
  src: string
  alt: string
  play: boolean
  duration: number
  navSrc?: string
  /** Congela el recorrido donde va (no lo reinicia); al quitarlo sigue desde ahí. */
  paused?: boolean
  /** Baja y vuelve a subir sin parar mientras se vea. */
  loop?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [travel, setTravel] = useState(0)
  const measure = () => {
    const box = boxRef.current
    const img = imgRef.current
    if (!box || !img) return
    setTravel(Math.max(0, img.clientHeight - box.clientHeight))
  }
  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [src])
  const style = {
    "--gm-travel": `-${travel}px`,
    animation: play && travel > 0 ? `gm-phone-scroll ${duration}ms ease-in-out ${loop ? "infinite alternate" : "forwards"}` : undefined,
    animationPlayState: paused ? "paused" : "running",
  } as CSSProperties
  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={measure}
        className="gm-anim block w-full h-auto pt-6 will-change-transform"
        style={style}
        decoding="async"
      />
      {navSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={navSrc} alt="" aria-hidden="true" className="absolute bottom-0 left-0 w-full h-auto" decoding="async" />
      )}
    </div>
  )
}

// ─── 1. Recorrido que corre solo ────────────────────────────────────────────

const TOUR = [
  { id: "dashboard", path: "dashboard" },
  { id: "ingredientes", path: "ingredientes" },
  { id: "ficha", path: "ficha-tecnica" },
  { id: "precio", path: "ficha-tecnica" },
  { id: "inventario", path: "inventario" },
  { id: "reportes", path: "estadisticas" },
] as const
const STEP_MS = 6000

export function LandingAppTour() {
  const { t, language } = useLanguage()
  const lang = mediaLang(language)
  const reduced = useReducedMotion()
  const isDesktop = useIsDesktop()
  const [sectionRef, near] = useInView<HTMLElement>({
    rootMargin: "400px 0px",
    once: true,
  })
  // Solo se pausa cuando el escenario salió por completo de la pantalla (no al hacer un poco de
  // scroll), y al volver sigue donde iba: no reinicia la pantalla ni sus animaciones.
  const [stageRef, visible] = useInView<HTMLDivElement>({ threshold: 0 })
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hovering, setHovering] = useState(false)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0, 1]))
  const tabsRef = useRef<HTMLDivElement>(null)

  const engaged = playing && !reduced // animaciones puestas (pausadas o corriendo)
  const running = engaged && !hovering && visible

  // Tiempo ya corrido de la pantalla actual: al pausar se guarda y al seguir se espera solo lo
  // que falta. (Este efecto va antes del temporizador: al cambiar de pantalla vuelve a 0.)
  const elapsed = useRef(0)
  useEffect(() => {
    elapsed.current = 0
  }, [active])
  useEffect(() => {
    if (!running) return
    const start = performance.now()
    const id = window.setTimeout(() => setActive((a) => (a + 1) % TOUR.length), Math.max(0, STEP_MS - elapsed.current))
    return () => {
      window.clearTimeout(id)
      elapsed.current += performance.now() - start
    }
  }, [running, active])

  useEffect(() => {
    setSeen((prev) => (prev.has(active) && prev.has((active + 1) % TOUR.length) ? prev : new Set([...prev, active, (active + 1) % TOUR.length])))
    // La pestaña activa siempre a la vista en la fila deslizable del celular, sin mover la página.
    const row = tabsRef.current
    const tab = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
    if (row && tab)
      row.scrollTo({
        left: tab.offsetLeft - row.clientWidth / 2 + tab.clientWidth / 2,
        behavior: reduced ? "auto" : "smooth",
      })
  }, [active, reduced])

  const choose = (i: number) => {
    setActive(i)
    setPlaying(false) // quien toca toma el control; el botón de reproducir lo devuelve
  }

  const label = (i: number) => t(`landing_tour_tab_${TOUR[i].id}` as TranslationKey)
  const alt = (i: number) => t("landing_tour_screen_alt").replace("{screen}", label(i))

  return (
    <section ref={sectionRef} id="por-dentro" className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-8 scroll-mt-20">
      <div className="max-w-2xl mx-auto text-center space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_tour_kicker")}</p>
        <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08] text-balance">{t("landing_tour_title")}</h2>
        <p className="text-text-3">{t("landing_tour_subtitle")}</p>
      </div>

      {/* Pestañas: fila deslizable en el celular, centrada en computadora. */}
      <div className="flex items-center justify-center gap-2">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={t("landing_tour_kicker")}
          className="flex gap-1.5 overflow-x-auto no-scrollbar snap-x snap-mandatory rounded-full border border-hairline bg-canvas-alt p-1 max-w-full"
        >
          {TOUR.map((s, i) => {
            const isActive = i === active
            return (
              <button
                key={s.id}
                data-tab={i}
                role="tab"
                aria-selected={isActive}
                aria-controls="landing-tour-stage"
                onClick={() => choose(i)}
                className={
                  "relative shrink-0 snap-center overflow-hidden rounded-full px-3.5 sm:px-4 py-2 text-sm font-medium transition-colors " +
                  (isActive ? "bg-card text-foreground shadow-sm" : "text-text-3 hover:text-foreground")
                }
              >
                {label(i)}
                {isActive && (
                  <span
                    key={active}
                    aria-hidden="true"
                    className="gm-anim absolute left-3 right-3 bottom-1 h-[2px] origin-left rounded-full bg-primary"
                    style={{
                      animation: engaged ? `gm-progress ${STEP_MS}ms linear forwards` : undefined,
                      animationPlayState: running ? "running" : "paused",
                      transform: engaged ? undefined : "scaleX(1)",
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("landing_tour_pause") : t("landing_tour_play")}
            title={playing ? t("landing_tour_pause") : t("landing_tour_play")}
            className="shrink-0 h-9 w-9 rounded-full border border-hairline bg-card text-text-3 hover:text-foreground flex items-center justify-center"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}
      </div>

      <p
        key={active}
        className="gm-anim gm-fade-up text-center text-base md:text-lg text-foreground max-w-xl mx-auto min-h-[3.5rem] md:min-h-[2rem]"
        aria-live="polite"
      >
        {t(`landing_tour_tab_${TOUR[active].id}_desc` as TranslationKey)}
      </p>

      <div
        ref={stageRef}
        id="landing-tour-stage"
        role="tabpanel"
        className="relative mx-auto max-w-[1100px] md:flex md:items-end"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Computadora */}
        <div className="hidden md:block flex-1 min-w-0">
          <LaptopFrame url={`gastrometrics.org/${TOUR[active].path}`}>
            {near &&
              isDesktop &&
              TOUR.map((s, i) =>
                seen.has(i) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s.id}
                    src={`/landing/${lang}/desk-${s.id}.webp`}
                    alt={i === active ? alt(i) : ""}
                    aria-hidden={i !== active}
                    width={1800}
                    height={1125}
                    decoding="async"
                    className="gm-anim absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out"
                    style={{
                      opacity: i === active ? 1 : 0,
                      transformOrigin: "30% 0%",
                      // La que sale se queda acercada mientras se desvanece (sin salto).
                      transform: i === active ? undefined : "scale(1.045)",
                      animation: i === active && engaged ? `gm-kenburns ${STEP_MS}ms ease-out forwards` : undefined,
                      animationPlayState: running ? "running" : "paused",
                    }}
                  />
                ) : null,
              )}
          </LaptopFrame>
        </div>

        {/* Celular: solo en pantallas chicas; en computadora, al lado de la laptop (la tapa
            apenas en el borde, para no esconder los números de la derecha). */}
        <div className="mx-auto w-[min(78vw,290px)] md:mx-0 md:w-[200px] lg:w-[220px] md:shrink-0 md:-ml-10 md:translate-y-8 relative z-10">
          <PhoneFrame>
            {near &&
              TOUR.map((s, i) =>
                seen.has(i) ? (
                  <div
                    key={s.id}
                    className="gm-anim absolute inset-0 transition-opacity duration-700"
                    style={{ opacity: i === active ? 1 : 0 }}
                    aria-hidden={i !== active}
                  >
                    <PhoneScreen
                      src={`/landing/${lang}/phone-${s.id}.webp`}
                      alt={i === active ? alt(i) : ""}
                      play={i === active && engaged}
                      paused={!running}
                      duration={STEP_MS}
                      navSrc={`/landing/${lang}/phone-nav-${s.id}.webp`}
                    />
                  </div>
                ) : null,
              )}
          </PhoneFrame>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/signup">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
            {t("landing_tour_cta")} <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
        <p className="text-xs text-text-4">{t("landing_tour_example_note")}</p>
      </div>
    </section>
  )
}

// ─── 2. Historia al hacer scroll: cambia un precio, todo se ajusta ──────────

const TARGET_FC = 0.3
const TOMATO_BEFORE = 30
const TOMATO_AFTER = 42 // +40 %
// Platos del ejemplo: costo por porción sin tomate y kilos de tomate por porción (lempiras).
const DISHES = [
  { key: "landing_story_dish_soup", base: 5.274, tomato: 0.2 },
  { key: "landing_story_dish_pasta", base: 22, tomato: 0.12 },
  { key: "landing_story_dish_burger", base: 68.4, tomato: 0.03 },
] as const

function currencyFor(lang: LanguageCode) {
  return lang === "es" ? { symbol: "L ", rate: 1, code: "HNL" } : { symbol: "$", rate: 1 / 25, code: "USD" }
}

// Receta mínima con el método por defecto (Food Cost 30 %) para usar las funciones reales de la app.
function demoRecipe(unitPrice?: number): Recipe {
  return { pricingMethod: "food_cost", targetFoodCostPercent: TARGET_FC * 100, isv: 0, yieldAmount: 1, unitPrice } as unknown as Recipe
}

function priceModel(lang: LanguageCode) {
  const c = currencyFor(lang)
  const ctx = { currencyCode: c.code }
  return {
    c,
    tomatoBefore: TOMATO_BEFORE * c.rate,
    tomatoAfter: TOMATO_AFTER * c.rate,
    dishes: DISHES.map((d) => {
      const before = (d.base + d.tomato * TOMATO_BEFORE) * c.rate
      const after = (d.base + d.tomato * TOMATO_AFTER) * c.rate
      const priceBefore = suggestedUnitPrice(demoRecipe(), before, ctx)
      // La misma regla que aplica la app cuando cambia un costo (docs/162, lib/recipe-pricing.ts).
      const outcome = applyPriceRule(demoRecipe(priceBefore), before, after, ctx)
      const priceAfter = outcome.kind === "raised" ? outcome.newPrice : priceBefore
      return { ...d, before, after, priceBefore, priceAfter }
    }),
  }
}

const STORY_STEPS = ["s1", "s2", "s3", "s4"] as const

function PriceStoryVisual({ step, lang, compact = false }: { step: number; lang: LanguageCode; compact?: boolean }) {
  const { t } = useLanguage()
  const m = priceModel(lang)
  const decimals = 2
  const money = (n: number) => `${m.c.symbol}${n.toFixed(decimals)}`
  const pct = Math.round((TOMATO_AFTER / TOMATO_BEFORE - 1) * 100)
  const reveal = (from: number) =>
    "gm-anim transition-all duration-500 ease-out " + (step >= from ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none")

  return (
    <div className="relative w-full max-w-[460px] mx-auto">
      <div className="rounded-2xl border border-hairline bg-card shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] p-4 sm:p-5 space-y-4">
        {/* Ingrediente */}
        <div
          className={
            "rounded-xl border p-3.5 flex items-center gap-3 transition-colors duration-500 " +
            (step === 0 ? "border-primary/40 bg-primary-soft" : "border-hairline bg-canvas-alt")
          }
        >
          <div className="h-10 w-10 rounded-lg bg-card border border-hairline flex items-center justify-center text-lg" aria-hidden="true">
            🍅
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{t("landing_story_ingredient")}</p>
            <p className="hidden sm:block text-xs text-text-4 truncate">{t("landing_story_supplier")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-4 line-through tabular-nums">{money(m.tomatoBefore)}</p>
            <p className="text-base font-semibold text-foreground tabular-nums">
              {money(m.tomatoAfter)}
              <span className="text-xs font-normal text-text-4"> / kg</span>
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning text-xs font-semibold px-2 py-1">
            <TrendingUp className="h-3 w-3" />+{pct}%
          </span>
        </div>

        {/* Recetas recalculadas */}
        {(!compact || step >= 1) && (
          <div className={reveal(1)}>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-4">
              <span />
              <span className="text-right">{t("landing_story_cost")}</span>
              <span className="text-right w-[76px] sm:w-[92px]">{t("landing_story_price")}</span>
            </div>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {m.dishes.map((d) => {
                const up = d.priceAfter > d.priceBefore
                return (
                  <li key={d.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2.5">
                    <span className="text-sm text-foreground leading-snug">{t(d.key as TranslationKey)}</span>
                    <span className="text-right">
                      <span className="block text-[11px] text-text-4 line-through tabular-nums">{money(d.before)}</span>
                      <span className="block text-sm font-medium text-foreground tabular-nums">{money(d.after)}</span>
                    </span>
                    <span className="w-[76px] sm:w-[92px] text-right">
                      {step >= 2 ? (
                        <>
                          {up && <span className="block text-[11px] text-text-4 line-through tabular-nums">{money(d.priceBefore)}</span>}
                          <span className={"block text-sm font-semibold tabular-nums " + (up ? "text-primary" : "text-foreground")}>{money(d.priceAfter)}</span>
                          <span className={"block text-[10px] leading-tight " + (up ? "text-primary" : "text-success")}>
                            {up ? t("landing_story_price_up") : t("landing_story_price_kept")}
                          </span>
                        </>
                      ) : (
                        <span className="block text-sm font-medium text-foreground tabular-nums">{money(d.priceBefore)}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Food cost protegido */}
        {(!compact || step >= 2) && (
          <div className={reveal(2) + " flex items-center gap-3 rounded-xl bg-success/10 px-3.5 py-2.5"}>
            <ShieldCheck className="h-5 w-5 text-success shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{t("landing_story_food_cost")}</span>
              <span className="text-text-3"> · {t("landing_story_target").replace("{pct}", String(Math.round(TARGET_FC * 100)))}</span>
            </p>
          </div>
        )}
      </div>

      {/* Aviso */}
      {(!compact || step >= 3) && (
        <div
          className={
            reveal(3) + " absolute -bottom-6 -right-2 sm:-right-6 w-[min(88%,300px)] rounded-xl border border-hairline bg-card shadow-lg p-3 flex gap-2.5"
          }
        >
          <div className="h-8 w-8 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">{t("landing_story_notif_title").replace("{count}", String(m.dishes.length))}</p>
            <p className="text-xs text-text-3 leading-snug">{t("landing_story_notif_body").replace("{pct}", String(pct))}</p>
            <p className="text-[10.5px] text-text-4 mt-0.5">{t("landing_story_notif_time")}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StoryStepText({ i, active }: { i: number; active: boolean }) {
  const { t } = useLanguage()
  const id = STORY_STEPS[i]
  return (
    <div className={"space-y-3 transition-opacity duration-500 gm-anim " + (active ? "opacity-100" : "lg:opacity-35")}>
      <p className="text-xs font-medium text-primary tabular-nums">
        {t("landing_story_step")
          .replace("{n}", String(i + 1))
          .replace("{total}", String(STORY_STEPS.length))}
      </p>
      <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-foreground leading-tight">
        {t(`landing_story_${id}_title` as TranslationKey)}
      </h3>
      <p className="text-text-3 leading-relaxed max-w-md">{t(`landing_story_${id}_desc` as TranslationKey)}</p>
    </div>
  )
}

/** Paso de la historia en el celular: su propio panel, que se arma al entrar en pantalla. */
function MobileStoryStep({ i, lang }: { i: number; lang: LanguageCode }) {
  const [ref, inView] = useInView<HTMLDivElement>({
    threshold: 0.4,
    once: true,
  })
  return (
    <div ref={ref} className="space-y-8">
      <StoryStepText i={i} active />
      <div className="pb-8">
        <PriceStoryVisual step={inView ? i : Math.max(0, i - 1)} lang={lang} compact />
      </div>
    </div>
  )
}

export function LandingPriceStory() {
  const { t, language } = useLanguage()
  const lang = mediaLang(language)
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean) as HTMLDivElement[]
    if (!els.length || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
      },
      { rootMargin: "-45% 0px -45% 0px" },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section className="bg-canvas-alt border-y border-hairline">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24">
        <div className="max-w-2xl space-y-3 mb-10 lg:mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_story_kicker")}</p>
          <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08] text-balance">{t("landing_story_title")}</h2>
        </div>

        {/* Computadora: los pasos pasan y el panel queda fijo a la derecha. */}
        <div className="hidden lg:grid grid-cols-[1fr_1.05fr] gap-16">
          <div>
            {STORY_STEPS.map((s, i) => (
              <div
                key={s}
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                data-step={i}
                className="min-h-[68vh] flex items-center"
              >
                <StoryStepText i={i} active={i === active} />
              </div>
            ))}
          </div>
          <div>
            <div className="sticky top-[18vh] py-6">
              <div className="flex gap-1.5 mb-6 justify-center" aria-hidden="true">
                {STORY_STEPS.map((s, i) => (
                  <span key={s} className={"h-1.5 rounded-full transition-all duration-500 gm-anim " + (i <= active ? "w-8 bg-primary" : "w-4 bg-hairline")} />
                ))}
              </div>
              <PriceStoryVisual step={active} lang={lang} />
            </div>
          </div>
        </div>

        {/* Celular y tableta: pasos apilados, cada uno con su panel. */}
        <div className="lg:hidden space-y-14">
          {STORY_STEPS.map((s, i) => (
            <MobileStoryStep key={s} i={i} lang={lang} />
          ))}
        </div>

        <div className="mt-12 lg:mt-0 flex justify-center lg:justify-start">
          <Link href="/signup">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("landing_story_cta")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── 3. En contexto: personas usándola ──────────────────────────────────────

const CONTEXT = [
  {
    key: "kitchen",
    photo: "chefs-cocina-abierta",
    screen: "ficha",
    icon: ChefHat,
  },
  {
    key: "market",
    photo: "verduras-puesto",
    screen: "ingredientes",
    icon: ShoppingBasket,
  },
  {
    key: "away",
    photo: "trabajadora-laptop",
    screen: "precio",
    icon: Smartphone,
  },
] as const

export function LandingInContext() {
  const { t, language } = useLanguage()
  const lang = mediaLang(language)
  const [ref, near] = useInView<HTMLElement>({
    rootMargin: "400px 0px",
    once: true,
  })

  return (
    <section ref={ref} className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-10">
      <div className="max-w-2xl space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_ctx_kicker")}</p>
        <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08] text-balance">{t("landing_ctx_title")}</h2>
        <p className="text-text-3">{t("landing_ctx_desc")}</p>
      </div>

      {/* En el celular se desliza de lado; en computadora, tres columnas. */}
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex md:grid md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar pb-2">
        {CONTEXT.map((c) => (
          <figure
            key={c.key}
            className="relative shrink-0 w-[78%] sm:w-[46%] md:w-auto snap-start rounded-2xl overflow-hidden border border-hairline bg-canvas-alt aspect-[4/5]"
          >
            {near && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/landing/photos/${c.photo}.webp`}
                alt=""
                width={960}
                height={1200}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute right-3 top-3 w-[32%] rotate-[4deg]">
              <PhoneFrame className="!p-[4px] !rounded-[1.4rem]">
                {near && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/landing/${lang}/phone-${c.screen}.webp`} alt="" loading="lazy" decoding="async" className="block w-full h-auto pt-4" />
                )}
              </PhoneFrame>
            </div>
            <figcaption className="absolute left-0 right-0 bottom-0 p-5 space-y-1.5 text-white">
              <c.icon className="h-5 w-5 text-white/90" />
              <p className="text-lg font-semibold leading-tight">{t(`landing_ctx_${c.key}_title` as TranslationKey)}</p>
              <p className="text-sm text-white/85 leading-snug">{t(`landing_ctx_${c.key}_desc` as TranslationKey)}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Instalar la app (antes era una sección aparte con solo texto). */}
      <div className="rounded-2xl border border-hairline bg-canvas-alt px-5 py-6 md:px-8 md:py-7 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 md:gap-8 items-center">
        <div className="w-12 h-12 rounded-2xl bg-primary-soft flex items-center justify-center shrink-0">
          <Download className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">{t("landing_ctx_install_title")}</p>
          <p className="text-sm text-text-3">{t("landing_mobile_desc")}</p>
          <ul className="text-sm text-text-3 space-y-1 pt-1">
            <li>• {t("landing_mobile_step_android")}</li>
            <li>• {t("landing_mobile_step_ios")}</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export const __test = { priceModel }
