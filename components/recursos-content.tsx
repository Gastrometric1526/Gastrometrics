"use client"

/**
 * /recursos rediseñada en docs/196: cada guía con un recorte de la pantalla REAL de la app que
 * explica (en el idioma de la página), más la calculadora gratis como herramienta.
 */

import Link from "next/link"
import { resourceArticles } from "@/lib/resource-articles"
import { useLanguage } from "@/contexts/language-context"
import { ArrowRight, BookOpen, Calculator } from "lucide-react"
import { mediaLang } from "@/components/landing-showcase"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero, Reveal } from "@/components/marketing-ui"

/** Pantalla real que acompaña a cada guía, según el módulo relacionado. */
const SCREEN_BY_FEATURE: Record<string, { screen: string; focus: string }> = {
  costeo: { screen: "precio", focus: "50% 30%" },
  "fichas-tecnicas": { screen: "ficha", focus: "50% 20%" },
  "ingredientes-inventario": { screen: "inventario", focus: "50% 40%" },
}

export function RecursosContent() {
  const { t, language } = useLanguage()
  const lang = mediaLang(language)

  return (
    <MarketingPage>
      <PageHero kicker={t("marketing_footer_resources")} title={t("resource_index_title")} subtitle={t("resource_index_subtitle")} />

      <section className={`${PAGE_WIDTH} pb-8`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resourceArticles.map((article, i) => {
            const media = article.relatedFeatureSlug ? SCREEN_BY_FEATURE[article.relatedFeatureSlug] : undefined
            return (
              <Reveal key={article.slug} delay={i * 90}>
                <Link href={`/recursos/${article.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_40px_-25px_rgba(15,23,42,0.35)]">
                  <div className="relative h-44 overflow-hidden border-b border-hairline bg-canvas-alt">
                    {media ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/landing/${lang}/desk-${media.screen}.webp`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="gm-anim h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        style={{ objectPosition: media.focus }}
                      />
                    ) : (
                      <BookOpen className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-primary" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" /> {t("resource_guide_label")}
                    </p>
                    <h2 className="text-lg font-semibold text-foreground leading-snug text-balance">{t(article.titleKey)}</h2>
                    <p className="text-sm text-text-3 text-pretty flex-1">{t(article.taglineKey)}</p>
                    <p className="text-sm font-medium text-primary inline-flex items-center gap-1">
                      {t("resource_read_article")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>

        <Reveal className="mt-6">
          <Link href="/calculadora-food-cost" className="group flex flex-col md:flex-row md:items-center gap-5 justify-between rounded-2xl border border-primary/25 bg-primary/5 p-6 md:p-8 hover:border-primary/50 transition-colors">
            <span className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Calculator className="h-6 w-6" />
              </span>
              <span className="space-y-1">
                <span className="block text-lg font-semibold text-foreground">{t("calc_title")}</span>
                <span className="block text-sm text-text-3">{t("calc_subtitle")}</span>
              </span>
            </span>
            <span className="text-sm font-medium text-primary inline-flex items-center gap-1 shrink-0">
              {t("calc_link_short")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </Reveal>
      </section>

      <CtaBand
        title={t("landing_closing_title")}
        desc={t("landing_closing_desc")}
        primary={{ href: "/signup", label: t("landing_closing_cta") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
