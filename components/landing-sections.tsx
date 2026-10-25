"use client"

/**
 * Secciones de la landing rediseñada (docs/196). Cada una responde una pregunta del visitante,
 * en el orden en que se la hace: ¿qué es? (portada) → ¿por qué me importa? (la fuga) →
 * ¿cómo funciona? (3 pasos) → ¿qué más hace? (bento) → ¿qué arriesgo? (sin riesgo + fundador)
 * → ¿empiezo? (cierre). Movimiento solo con transform/opacity, al entrar en pantalla, y nada
 * con «reducir movimiento» (clase gm-anim).
 */

import type React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Calculator,
  Tag,
  RefreshCw,
  Camera,
  BarChart3,
  ShoppingCart,
  Gift,
  CreditCard,
  ShieldCheck,
  LifeBuoy,
  Languages,
  Coins,
  Smartphone,
  BadgeCheck,
  FileSpreadsheet,
  FileText,
  Receipt,
  Type,
  ChefHat,
  TrendingUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/animated-number"
import { useLanguage } from "@/contexts/language-context"
import { PhoneFrame, PhoneScreen, mediaLang } from "@/components/landing-showcase"
import type { TranslationKey } from "@/lib/i18n/translations"
import { TRUSTPILOT_URL } from "@/lib/site-links"
import { SectionHeading, reveal, useInViewOnce } from "@/components/marketing-ui"

// ─── Franja de confianza ────────────────────────────────────────────────────

export function LandingTrustStrip() {
  const { t } = useLanguage()
  const items = [
    { icon: Gift, text: t("landing_hero_micro_free") },
    { icon: CreditCard, text: t("landing_hero_micro_nocard") },
    { icon: Languages, text: t("landing_hero_micro_langs") },
    { icon: Coins, text: t("landing_trust_currencies") },
    { icon: Smartphone, text: t("landing_hero_micro_app") },
  ]
  return (
    <div className="border-y border-hairline bg-canvas-alt">
      <ul className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
        {items.map((i) => (
          <li key={i.text} className="flex items-center gap-2 text-sm text-text-3">
            <i.icon className="h-4 w-4 text-primary" />
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── La fuga invisible (cifras con fuente) ──────────────────────────────────

export function LandingProblem() {
  const { t } = useLanguage()
  const [ref, seen] = useInViewOnce<HTMLElement>()
  const stats = [
    { value: 42, prefix: "", suffix: "%", desc: "landing_stat1_desc", source: "landing_stat1_source" },
    { value: 35, prefix: "+", suffix: "%", desc: "landing_stat2_desc", source: "landing_stat2_source" },
    { value: 7, prefix: "$", suffix: "", desc: "landing_stat3_desc", source: "landing_stat3_source" },
  ] as const
  const leaks = ["landing_leak_item1", "landing_leak_item2", "landing_leak_item3", "landing_leak_item4"] as const
  return (
    <section ref={ref} className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-10">
      <SectionHeading kicker={t("landing_leak_kicker")} title={t("landing_leak_title")} subtitle={t("landing_problem_subtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s, i) => (
          <div key={s.desc} {...reveal(seen, i * 120)}>
            <div className="h-full rounded-2xl border border-hairline bg-card p-6 space-y-3">
              {seen ? (
                <AnimatedNumber
                  value={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  className="block text-5xl font-semibold tracking-[-0.04em] text-primary tabular-nums"
                />
              ) : (
                <span className="block text-5xl font-semibold text-primary">0</span>
              )}
              <p className="text-foreground leading-snug">{t(s.desc)}</p>
              <p className="text-xs text-text-4">{t(s.source)}</p>
            </div>
          </div>
        ))}
      </div>
      <div {...reveal(seen, 380)}>
        <div className="rounded-2xl border border-hairline bg-canvas-alt p-6 md:p-8 grid gap-6 md:grid-cols-[1fr_1.4fr] items-start">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">{t("landing_problem_where_title")}</p>
            <p className="text-sm text-text-3 leading-relaxed">{t("landing_leak_body")}</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {leaks.map((k, i) => (
              <li key={k} className="flex gap-3 rounded-xl bg-card border border-hairline p-4">
                <span className="text-text-4 text-sm tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm text-foreground leading-snug">{t(k)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ─── Cómo funciona: 3 pasos con mini animación ──────────────────────────────

/** Pantalla real del celular, que baja y sube sola sin parar (no se reinicia al hacer scroll). */
function StepPhone({ on, screen }: { on: boolean; screen: string }) {
  const { language } = useLanguage()
  const lang = mediaLang(language)
  return (
    <div className="relative h-56 overflow-hidden rounded-xl bg-canvas-alt border border-hairline">
      <div className="absolute left-1/2 top-4 w-[150px] -translate-x-1/2">
        <PhoneFrame className="!p-[5px] !rounded-[1.6rem]">
          {on && <PhoneScreen src={`/landing/${lang}/phone-${screen}.webp`} alt="" play={on} loop duration={7000} navSrc={`/landing/${lang}/phone-nav-${screen}.webp`} />}
        </PhoneFrame>
      </div>
    </div>
  )
}

/** El PDF real de la Ficha Técnica (capturado de la app en cada idioma). */
function StepPdf({ on }: { on: boolean }) {
  const { language } = useLanguage()
  const lang = mediaLang(language)
  return (
    <div className="relative h-56 overflow-hidden rounded-xl bg-canvas-alt border border-hairline">
      {on && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/landing/${lang}/pdf-ficha.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          className={"gm-anim absolute left-1/2 top-5 w-[92%] -translate-x-1/2 rounded-md border border-hairline bg-white shadow-lg transition-all duration-1000 ease-out " + (on ? "opacity-100 translate-y-0 rotate-[-1.5deg]" : "opacity-0 translate-y-6")}
        />
      )}
    </div>
  )
}

const StepImport = ({ on }: { on: boolean }) => <StepPhone on={on} screen="ingredientes" />
const StepRecipe = ({ on }: { on: boolean }) => <StepPhone on={on} screen="ficha" />
const StepProfit = ({ on }: { on: boolean }) => <StepPdf on={on} />

export function LandingHowItWorks() {
  const { t } = useLanguage()
  const [ref, seen] = useInViewOnce<HTMLElement>(0.2)
  const steps = [
    { title: "landing_step1_title", desc: "landing_step1_desc", time: "landing_step1_time", Visual: StepImport },
    { title: "landing_step2_title", desc: "landing_step2_desc", time: "landing_step2_time", Visual: StepRecipe },
    { title: "landing_step3_title", desc: "landing_step3_desc", time: "landing_step3_time", Visual: StepProfit },
  ] as const
  return (
    <section ref={ref} id="como-funciona" className="bg-canvas-alt border-y border-hairline scroll-mt-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-10">
        <SectionHeading kicker={t("landing_start_kicker")} title={t("landing_steps_title")} subtitle={t("landing_how_subtitle")} />
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} {...reveal(seen, i * 150)}>
              <div className="h-full rounded-2xl border border-hairline bg-card p-5 space-y-4">
                <s.Visual on={seen} />
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {i + 1}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{t(s.time)}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">{t(s.title)}</p>
                <p className="text-sm text-text-3 leading-relaxed">{t(s.desc)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-hairline bg-card p-5">
          <p className="text-sm text-text-3 max-w-2xl">{t("landing_start_reveal")}</p>
          <Link href="/signup" className="shrink-0">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("landing_start_cta")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Bento: todo lo que hace por ti ─────────────────────────────────────────

/**
 * Recorte de una captura REAL de la app (public/landing/{idioma}/desk-*.webp, 1800×1125), en el
 * idioma de la página. `focus` = [x, y] en % del punto a mostrar; `zoom` = cuánto se acerca. Al
 * entrar en pantalla se acerca despacio (solo transform).
 */
function RealCrop({ on, screen, focus, zoom = 1.6, height = "h-44", alt }: { on: boolean; screen: string; focus: [number, number]; zoom?: number; height?: string; alt: string }) {
  const { language } = useLanguage()
  const lang = mediaLang(language)
  return (
    <div className={`relative ${height} overflow-hidden rounded-xl border border-hairline bg-white`}>
      {on && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/landing/${lang}/desk-${screen}.webp`}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="gm-anim absolute inset-0 h-full w-full object-cover transition-transform duration-[2500ms] ease-out"
          style={{ objectPosition: `${focus[0]}% ${focus[1]}%`, transformOrigin: `${focus[0]}% ${focus[1]}%`, transform: `scale(${on ? zoom : zoom * 0.92})` }}
        />
      )}
    </div>
  )
}

function BentoCostBars({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="ficha" focus={[55, 88]} zoom={1.05} height="h-64 md:h-[300px]" alt="" />
}
function BentoPrice({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="precio" focus={[60, 45]} zoom={1.25} alt="" />
}
function BentoCascade({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="dashboard" focus={[30, 30]} zoom={1.35} alt="" />
}
function BentoImport({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="ingredientes" focus={[50, 20]} zoom={1.05} alt="" />
}
function BentoReports({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="reportes" focus={[50, 70]} zoom={1.15} alt="" />
}
function BentoStock({ on }: { on: boolean }) {
  return <RealCrop on={on} screen="inventario" focus={[50, 70]} zoom={1.0} height="h-56" alt="" />
}

export function LandingBento() {
  const { t } = useLanguage()
  const [ref, seen] = useInViewOnce<HTMLElement>(0.15)
  const tiles: { key: string; icon: React.ComponentType<{ className?: string }>; span: string; Visual: React.ComponentType<{ on: boolean }> }[] = [
    { key: "1", icon: Calculator, span: "md:col-span-2 md:row-span-2", Visual: BentoCostBars },
    { key: "2", icon: Tag, span: "", Visual: BentoPrice },
    { key: "3", icon: RefreshCw, span: "", Visual: BentoCascade },
    { key: "4", icon: Camera, span: "md:col-span-2", Visual: BentoImport },
    { key: "5", icon: BarChart3, span: "", Visual: BentoReports },
    { key: "6", icon: ShoppingCart, span: "md:col-span-3", Visual: BentoStock },
  ]
  return (
    <section ref={ref} className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-10">
      <SectionHeading kicker={t("landing_bento_kicker")} title={t("landing_benefits_title")} subtitle={t("landing_bento_subtitle")} />
      <div className="grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(190px,auto)]">
        {tiles.map((tile, i) => {
          const r = reveal(seen, i * 90)
          return (
            <div key={tile.key} className={`${tile.span} ${r.className}`} style={r.style}>
              <div
                className={
                  "group h-full rounded-2xl border border-hairline bg-card p-5 md:p-6 flex flex-col gap-4 transition-colors hover:border-primary/40 " +
                  (i === 0 ? "md:justify-between" : "")
                }
              >
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center">
                    <tile.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className={"font-semibold text-foreground " + (i === 0 ? "text-xl md:text-2xl tracking-[-0.02em]" : "text-base")}>
                    {t(`landing_benefit${tile.key}_title` as TranslationKey)}
                  </p>
                  <p className="text-sm text-text-3 leading-relaxed">{t(`landing_benefit${tile.key}_desc` as TranslationKey)}</p>
                </div>
                <div className="mt-auto">
                  <tile.Visual on={seen} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Sin riesgo + nota del fundador ─────────────────────────────────────────

export function LandingRiskAndFounder() {
  const { t } = useLanguage()
  const [ref, seen] = useInViewOnce<HTMLElement>(0.2)
  const risks = [
    { icon: Gift, title: "landing_risk1_title", desc: "landing_risk1_desc" },
    { icon: CreditCard, title: "landing_risk2_title", desc: "landing_risk2_desc" },
    { icon: ShieldCheck, title: "landing_risk3_title", desc: "landing_risk3_desc" },
    { icon: LifeBuoy, title: "landing_risk4_title", desc: "landing_risk4_desc" },
  ] as const
  return (
    <section ref={ref} className="bg-canvas-alt border-y border-hairline">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 grid gap-10 lg:grid-cols-[1.25fr_1fr] items-start">
        <div className="space-y-8">
          <SectionHeading title={t("landing_risk_title")} subtitle={t("landing_risk_subtitle")} />
          <div className="grid gap-4 sm:grid-cols-2">
            {risks.map((r, i) => (
              <div key={r.title} {...reveal(seen, i * 100)}>
                <div className="h-full rounded-2xl border border-hairline bg-card p-5 space-y-2">
                  <r.icon className="h-5 w-5 text-primary" />
                  <p className="text-base font-semibold text-foreground">{t(r.title)}</p>
                  <p className="text-sm text-text-3 leading-relaxed">{t(r.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <figure {...reveal(seen, 250)}>
          <div className="rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-5 lg:mt-24">
            <ChefHat className="h-7 w-7 text-primary" />
            <blockquote className="text-lg md:text-xl text-foreground leading-relaxed tracking-[-0.01em]">“{t("landing_founder_quote")}”</blockquote>
            <figcaption>
              <p className="text-sm font-semibold text-foreground">{t("landing_founder_name")}</p>
              <p className="text-xs text-text-4">{t("landing_founder_role")}</p>
            </figcaption>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/contacto" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                {t("landing_founder_contact")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href={TRUSTPILOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                {t("landing_trust_link")} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </figure>
      </div>
    </section>
  )
}

// ─── Cierre ─────────────────────────────────────────────────────────────────

export function LandingClosing() {
  const { t } = useLanguage()
  return (
    <section className="px-4 sm:px-6 md:px-10 py-16 md:py-24">
      <div className="relative max-w-[1200px] mx-auto overflow-hidden rounded-3xl bg-foreground px-6 py-14 md:px-16 md:py-20 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,hsl(var(--primary)/0.35),transparent_70%)]" />
        <div className="relative space-y-6">
          <h2 className="text-3xl md:text-[46px] font-semibold tracking-[-0.04em] text-background max-w-2xl mx-auto leading-[1.08] text-balance">
            {t("landing_closing_title")}
          </h2>
          <p className="text-background/70 max-w-xl mx-auto">{t("landing_closing_desc")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="text-base px-7 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                {t("landing_closing_cta")} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#por-dentro" className="text-sm text-background/80 hover:text-background inline-flex items-center gap-1">
              {t("landing_closing_secondary")} <ArrowDown className="h-3.5 w-3.5 rotate-180" />
            </Link>
          </div>
          <p className="text-sm text-background/60">{t("landing_closing_sub")}</p>
        </div>
      </div>
    </section>
  )
}
