"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Button } from "@/components/ui/button"
import type { ResourceArticleDef } from "@/lib/resource-articles"
import { getFeaturePage } from "@/lib/feature-pages"
import { useLanguage } from "@/contexts/language-context"
import { ArrowLeft, ArrowRight, CheckCircle, BookOpen } from "lucide-react"

export function ResourceArticleContent({ article }: { article: ResourceArticleDef }) {
  const { t } = useLanguage()
  const relatedFeature = article.relatedFeatureSlug ? getFeaturePage(article.relatedFeatureSlug) : null

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 space-y-12 max-w-3xl">
        <div>
          <Link href="/recursos">
            <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-6">
              <ArrowLeft className="h-4 w-4" />
              {t("resource_back_to_index")}
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground text-balance">{t(article.titleKey)}</h1>
              <p className="text-lg text-muted-foreground">{t(article.taglineKey)}</p>
            </div>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed">{t(article.introKey)}</p>
        </div>

        <div className="space-y-10">
          {article.sections.map((section) => (
            <section key={section.headingKey} className="space-y-3">
              <h2 className="text-2xl font-bold text-foreground">{t(section.headingKey)}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{t(section.bodyKey)}</p>
            </section>
          ))}
        </div>

        {relatedFeature && (
          <div className="rounded-lg border border-border bg-muted/30 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-sm text-foreground">
              {t("resource_related_feature_prefix")} <span className="font-semibold">{t(relatedFeature.titleKey)}</span>
            </p>
            <Link href={`/caracteristicas/${relatedFeature.slug}`}>
              <Button variant="outline" size="sm" className="gap-2 shrink-0 bg-transparent">
                {t("resource_related_feature_cta")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        <section className="text-center space-y-6 py-8 border-t border-border/50">
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t(article.ctaHeadingKey)}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t(article.ctaBodyKey)}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                <CheckCircle className="mr-2 h-5 w-5" />
                {t("about_cta_button1")}
              </Button>
            </Link>
            <Link href="/recursos">
              <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-border hover:bg-accent hover:text-accent-foreground bg-transparent">
                {t("resource_view_all")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
