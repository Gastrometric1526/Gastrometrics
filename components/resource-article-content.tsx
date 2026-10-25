"use client"

/**
 * Artículo de /recursos/[slug], rediseñado en docs/196: portada como el resto del sitio, texto
 * a ancho de lectura con índice lateral en escritorio, la pantalla REAL del módulo relacionado
 * a mitad del artículo y el cierre de la landing.
 */

import Link from "next/link"
import type { ResourceArticleDef } from "@/lib/resource-articles"
import { getFeaturePage } from "@/lib/feature-pages"
import { useLanguage } from "@/contexts/language-context"
import { ArrowRight } from "lucide-react"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero, RealScreen, Reveal } from "@/components/marketing-ui"

export function ResourceArticleContent({ article }: { article: ResourceArticleDef }) {
  const { t } = useLanguage()
  const relatedFeature = article.relatedFeatureSlug ? getFeaturePage(article.relatedFeatureSlug) : null
  const shot = relatedFeature?.screenshots.find((s) => s.screen !== "pdf")
  const middle = Math.ceil(article.sections.length / 2)

  return (
    <MarketingPage>
      <PageHero kicker={t("resource_guide_label")} title={t(article.titleKey)} subtitle={t(article.taglineKey)} back={{ href: "/recursos", label: t("resource_back_to_index") }} />

      <div className={`${PAGE_WIDTH} pb-12 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]`}>
        <nav aria-label={t("resource_toc")} className="hidden lg:block">
          <div className="sticky top-24 space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-4">{t("resource_toc")}</p>
            <ol className="space-y-2 border-l border-hairline">
              {article.sections.map((section, i) => (
                <li key={section.headingKey}>
                  <a href={`#s${i + 1}`} className="-ml-px block border-l border-transparent pl-3 text-sm text-text-3 hover:border-primary hover:text-foreground">
                    {t(section.headingKey)}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="max-w-[720px] space-y-10">
          <p className="text-lg text-foreground leading-relaxed text-pretty">{t(article.introKey)}</p>
          {article.sections.map((section, i) => (
            <div key={section.headingKey} className="space-y-10">
              <Reveal as="section" id={`s${i + 1}`} className="scroll-mt-24 space-y-3">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{t(section.headingKey)}</h2>
                <p className="text-text-3 leading-relaxed whitespace-pre-line text-pretty">{t(section.bodyKey)}</p>
              </Reveal>
              {shot && relatedFeature && i === middle - 1 && (
                <Reveal as="section">
                  <figure className="space-y-3">
                    <RealScreen screen={shot.screen} alt={t(shot.altKey)} url={`gastrometrics.org${shot.route}`} focus={shot.focus} />
                    <figcaption className="text-sm text-text-3 text-center text-pretty">{t(shot.captionKey)}</figcaption>
                  </figure>
                </Reveal>
              )}
            </div>
          ))}

          {relatedFeature && (
            <Reveal>
              <Link
                href={`/caracteristicas/${relatedFeature.slug}`}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border border-hairline bg-canvas-alt p-5 hover:border-primary/40 transition-colors"
              >
                <span className="text-sm text-foreground">
                  {t("resource_related_feature_prefix")} <span className="font-semibold">{t(relatedFeature.titleKey)}</span>
                </span>
                <span className="text-sm font-medium text-primary inline-flex items-center gap-1 shrink-0">
                  {t("resource_related_feature_cta")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          )}
        </article>
      </div>

      <CtaBand
        title={t(article.ctaHeadingKey)}
        desc={t(article.ctaBodyKey)}
        primary={{ href: "/signup", label: t("about_cta_button1") }}
        secondary={{ href: "/recursos", label: t("resource_view_all") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
