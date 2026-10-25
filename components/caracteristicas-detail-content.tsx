"use client"

/**
 * Página de detalle de cada módulo (/caracteristicas/[slug]), rediseñada en docs/196 con las
 * piezas de la landing (components/marketing-ui.tsx): portada, la pantalla REAL del módulo en
 * el idioma de la página (no capturas viejas en español), cómo funciona paso a paso junto a la
 * captura, resumen, artículo relacionado, los demás módulos y el cierre.
 */

import Link from "next/link"
import { featurePages, type FeaturePageDef, type FeatureScreenshotDef } from "@/lib/feature-pages"
import { resourceArticles } from "@/lib/resource-articles"
import { useLanguage } from "@/contexts/language-context"
import { ChefHat, Calculator, Package, UtensilsCrossed, ShoppingCart, BarChart3, ArrowRight, CheckCircle2, BookOpen } from "lucide-react"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero, RealPdf, RealScreen, Reveal, SectionHeading } from "@/components/marketing-ui"

const icons: Record<string, typeof ChefHat> = {
  "fichas-tecnicas": ChefHat,
  costeo: Calculator,
  "ingredientes-inventario": Package,
  menus: UtensilsCrossed,
  "ordenes-compra": ShoppingCart,
  estadisticas: BarChart3,
}

function Shot({ shot }: { shot: FeatureScreenshotDef }) {
  const { t } = useLanguage()
  return (
    <figure className="space-y-3">
      {shot.screen === "pdf" ? (
        <div className="mx-auto max-w-md py-4">
          <RealPdf alt={t(shot.altKey)} />
        </div>
      ) : (
        <RealScreen screen={shot.screen} alt={t(shot.altKey)} url={`gastrometrics.org${shot.route}`} focus={shot.focus} />
      )}
      <figcaption className="text-sm text-text-3 text-center text-pretty">{t(shot.captionKey)}</figcaption>
    </figure>
  )
}

export function CaracteristicasDetailContent({ feature }: { feature: FeaturePageDef }) {
  const { t } = useLanguage()

  const Icon = icons[feature.slug] ?? ChefHat
  const relatedArticle = resourceArticles.find((a) => a.relatedFeatureSlug === feature.slug)
  const [mainShot, ...moreShots] = feature.screenshots
  const others = featurePages.filter((f) => f.slug !== feature.slug)

  return (
    <MarketingPage>
      <PageHero kicker={t(feature.taglineKey)} title={t(feature.titleKey)} subtitle={t(feature.introKey)} back={{ href: "/about", label: t("feat_back_to_about") }}>
        <div className="flex justify-center pt-1">
          <span className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </span>
        </div>
      </PageHero>

      {mainShot && (
        <div className={`${PAGE_WIDTH} pb-16 md:pb-20`}>
          <Reveal className="max-w-5xl mx-auto">
            <Shot shot={mainShot} />
          </Reveal>
        </div>
      )}

      <section className="bg-canvas-alt border-y border-hairline">
        <div className={`${PAGE_WIDTH} py-16 md:py-24 grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-start`}>
          <div className="space-y-10">
            <SectionHeading kicker={t(feature.titleKey)} title={t("feat_how_it_works")} />
            <ol className="space-y-7">
              {feature.steps.map((step, index) => (
                <Reveal as="li" key={step.titleKey} delay={index * 90} className="flex gap-4">
                  <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-semibold text-sm tabular-nums">{index + 1}</span>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">{t(step.titleKey)}</h3>
                    <p className="text-text-3 leading-relaxed text-pretty">{t(step.descKey)}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
          <div className="space-y-10 lg:sticky lg:top-24">
            {moreShots.length > 0 ? (
              moreShots.map((shot) => (
                <Reveal key={shot.screen}>
                  <Shot shot={shot} />
                </Reveal>
              ))
            ) : (
              <Reveal className="rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("feat_summary_title")}</p>
                <ul className="space-y-3">
                  {feature.highlightKeys.map((key) => (
                    <li key={key} className="flex items-start gap-3 text-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-pretty">{t(key)}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {moreShots.length > 0 && (
        <section className={`${PAGE_WIDTH} py-16 md:py-20 space-y-8`}>
          <SectionHeading title={t("feat_summary_title")} />
          <ul className="grid gap-4 sm:grid-cols-2">
            {feature.highlightKeys.map((key, i) => (
              <Reveal as="li" key={key} delay={i * 70} className="flex items-start gap-3 rounded-2xl border border-hairline bg-card p-5 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-pretty">{t(key)}</span>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <section className={`${PAGE_WIDTH} ${moreShots.length > 0 ? "pb-4" : "py-16 md:py-20"} space-y-10`}>
        {relatedArticle && (
          <Reveal>
            <Link
              href={`/recursos/${relatedArticle.slug}`}
              className="group flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border border-hairline bg-card p-5 md:p-6 hover:border-primary/40 transition-colors"
            >
              <span className="flex items-center gap-3 text-foreground">
                <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-primary" />
                </span>
                <span className="text-sm">
                  {t("resource_related_article_prefix")} <span className="font-semibold">{t(relatedArticle.titleKey)}</span>
                </span>
              </span>
              <span className="text-sm font-medium text-primary inline-flex items-center gap-1 shrink-0">
                {t("resource_read_article")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        )}

        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-4">{t("feat_other_modules")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {others.map((f, i) => {
              const OtherIcon = icons[f.slug] ?? ChefHat
              return (
                <Reveal key={f.slug} delay={i * 60}>
                  <Link href={`/caracteristicas/${f.slug}`} className="group flex h-full items-center gap-3 rounded-xl border border-hairline bg-card p-4 hover:border-primary/40 transition-colors">
                    <OtherIcon className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary">{t(f.titleKey)}</span>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <CtaBand
        title={t("feat_ready_title")}
        desc={t("landing_closing_desc")}
        primary={{ href: "/signup", label: t("about_cta_button1") }}
        secondary={{ href: "/about", label: t("feat_view_all_modules") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
