"use client"

/**
 * /about rediseñada en docs/196 con las piezas de la landing (components/marketing-ui.tsx):
 * portada, por qué existe (nota del fundador), cada módulo con su pantalla REAL de la app en el
 * idioma de la página —alternando lados— y, al final, lo que va en todos (multi-negocio, idiomas
 * y monedas) y el cierre.
 */

import Link from "next/link"
import { featurePages } from "@/lib/feature-pages"
import { CURRENCY_OPTIONS } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import type { TranslationKey } from "@/lib/i18n/translations"
import { ChefHat, Package, BarChart3, UtensilsCrossed, ShoppingCart, Building2, Globe, Calculator, ArrowRight, CheckCircle2, ListChecks } from "lucide-react"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero, RealPdf, RealScreen, Reveal, SectionHeading } from "@/components/marketing-ui"

const detailPageSlugs = new Set(featurePages.map((f) => f.slug))

type ModuleDef = {
  slug: string
  icon: typeof ChefHat
  titleKey: TranslationKey
  descKey: TranslationKey
  pointKeys: readonly TranslationKey[]
  /** Pantalla real (public/landing/{idioma}/desk-*.webp) o "pdf". */
  screen: string
  route: string
}

const moduleDefs: ModuleDef[] = [
  { slug: "fichas-tecnicas", icon: ChefHat, titleKey: "about_m_fichas_title", descKey: "about_m_fichas_desc", pointKeys: ["about_m_fichas_point1", "about_m_fichas_point2", "about_m_fichas_point3"], screen: "ficha", route: "/ficha-tecnica" },
  { slug: "costeo", icon: Calculator, titleKey: "about_m_costeo_title", descKey: "about_m_costeo_desc", pointKeys: ["about_m_costeo_point1", "about_m_costeo_point2", "about_m_costeo_point3"], screen: "precio", route: "/ficha-tecnica" },
  { slug: "ingredientes-inventario", icon: Package, titleKey: "about_m_ingredientes_title", descKey: "about_m_ingredientes_desc", pointKeys: ["about_m_ingredientes_point1", "about_m_ingredientes_point2", "about_m_ingredientes_point3"], screen: "inventario", route: "/inventario" },
  { slug: "menus", icon: UtensilsCrossed, titleKey: "about_m_menus_title", descKey: "about_m_menus_desc", pointKeys: ["about_m_menus_point1", "about_m_menus_point2", "about_m_menus_point3"], screen: "menus", route: "/menus" },
  { slug: "mep", icon: ListChecks, titleKey: "about_m_mep_title", descKey: "about_m_mep_desc", pointKeys: ["about_m_mep_point1", "about_m_mep_point2", "about_m_mep_point3"], screen: "mep", route: "/mep" },
  { slug: "ordenes-compra", icon: ShoppingCart, titleKey: "about_m_ordenes_title", descKey: "about_m_ordenes_desc", pointKeys: ["about_m_ordenes_point1", "about_m_ordenes_point2", "about_m_ordenes_point3"], screen: "ordenes", route: "/ordenes-compra" },
  { slug: "estadisticas", icon: BarChart3, titleKey: "about_m_estadisticas_title", descKey: "about_m_estadisticas_desc", pointKeys: ["about_m_estadisticas_point1", "about_m_estadisticas_point2", "about_m_estadisticas_point3"], screen: "reportes", route: "/estadisticas" },
]

const LANGS = ["Español", "English", "Dansk", "Français", "Português", "中文"]
// Los símbolos reales de las monedas que soporta la app (lib/currency.ts).
const CURRENCIES = Array.from(new Set(CURRENCY_OPTIONS.map((c) => c.symbol)))

function ModuleRow({ m, index }: { m: ModuleDef; index: number }) {
  const { t } = useLanguage()
  const flip = index % 2 === 1
  return (
    <div id={m.slug} className="scroll-mt-24 grid gap-8 lg:gap-14 lg:grid-cols-2 lg:items-center">
      <Reveal className={`space-y-5 ${flip ? "lg:order-2" : ""}`}>
        <span className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <m.icon className="h-5 w-5 text-primary" />
        </span>
        <h3 className="text-2xl md:text-[32px] font-semibold tracking-[-0.03em] text-foreground leading-[1.12]">{t(m.titleKey)}</h3>
        <p className="text-text-3 leading-relaxed text-pretty">{t(m.descKey)}</p>
        <ul className="space-y-2.5">
          {m.pointKeys.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        {detailPageSlugs.has(m.slug) && (
          <Link href={`/caracteristicas/${m.slug}`} className="group inline-flex items-center gap-1 text-sm font-medium text-primary">
            {t("about_view_detail")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </Reveal>
      <Reveal delay={120} className={flip ? "lg:order-1" : ""}>
        <RealScreen screen={m.screen} alt={t(m.titleKey)} url={`gastrometrics.org${m.route}`} />
      </Reveal>
    </div>
  )
}

export function AboutContent() {
  const { t } = useLanguage()

  return (
    <MarketingPage>
      <PageHero kicker={t("marketing_nav_about")} title={t("about_hero_title")} subtitle={t("about_hero_body1")} />

      {/* Por qué existe: la nota del fundador y el PDF real que sale de la app. */}
      <section className="bg-canvas-alt border-y border-hairline">
        <div className={`${PAGE_WIDTH} py-16 md:py-24 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center`}>
          <Reveal className="space-y-6">
            <SectionHeading kicker={t("about_story_kicker")} title={t("about_story_title")} subtitle={t("about_hero_body2")} />
            <figure className="rounded-2xl border border-hairline bg-card p-6 md:p-7 space-y-4">
              <ChefHat className="h-6 w-6 text-primary" />
              <blockquote className="text-lg text-foreground leading-relaxed tracking-[-0.01em]">“{t("landing_founder_quote")}”</blockquote>
              <figcaption>
                <p className="text-sm font-semibold text-foreground">{t("landing_founder_name")}</p>
                <p className="text-xs text-text-4">{t("landing_founder_role")}</p>
              </figcaption>
              <Link href="/contacto" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                {t("landing_founder_contact")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </figure>
          </Reveal>
          <div className="mx-auto w-full max-w-sm">
            <RealPdf alt={t("feat_fichas_shot2_alt")} />
            <p className="mt-5 text-center text-sm text-text-3 text-pretty">{t("feat_fichas_shot2_caption")}</p>
          </div>
        </div>
      </section>

      <section className={`${PAGE_WIDTH} py-16 md:py-24 space-y-16 md:space-y-24`}>
        <SectionHeading kicker={t("about_modules_kicker")} title={t("about_modules_title")} subtitle={t("about_modules_subtitle")} center />
        {moduleDefs.map((m, i) => (
          <ModuleRow key={m.slug} m={m} index={i} />
        ))}
      </section>

      {/* Lo que va en todos los planes y módulos. */}
      <section className="bg-canvas-alt border-y border-hairline">
        <div className={`${PAGE_WIDTH} py-16 md:py-20 grid gap-5 md:grid-cols-2`}>
          <Reveal id="multi-negocio" className="scroll-mt-24 rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-4">
            <Building2 className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">{t("about_m_multinegocio_title")}</h3>
            <p className="text-text-3 leading-relaxed text-pretty">{t("about_m_multinegocio_desc")}</p>
            <ul className="space-y-2.5">
              {(["about_m_multinegocio_point1", "about_m_multinegocio_point2", "about_m_multinegocio_point3"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal id="multi-idioma" delay={120} className="scroll-mt-24 rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-4">
            <Globe className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">{t("about_m_multiidioma_title")}</h3>
            <p className="text-text-3 leading-relaxed text-pretty">{t("about_m_multiidioma_desc")}</p>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <span key={l} className="rounded-full border border-hairline bg-canvas-alt px-3 py-1 text-xs text-foreground">
                  {l}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary tabular-nums">
                  {c}
                </span>
              ))}
            </div>
            <ul className="space-y-2.5">
              {(["about_m_multiidioma_point1", "about_m_multiidioma_point2"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title={t("about_cta_title")}
        desc={t("about_cta_subtitle")}
        primary={{ href: "/signup", label: t("about_cta_button1") }}
        secondary={{ href: "/planes", label: t("about_cta_button2") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
