"use client"

import Link from "next/link"
import Image from "next/image"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { FeaturePageDef } from "@/lib/feature-pages"
import { resourceArticles } from "@/lib/resource-articles"
import { useLanguage } from "@/contexts/language-context"
import { ChefHat, Calculator, Package, UtensilsCrossed, ShoppingCart, BarChart3, ArrowRight, ArrowLeft, CheckCircle, BookOpen } from "lucide-react"

const icons: Record<string, typeof ChefHat> = {
  "fichas-tecnicas": ChefHat,
  costeo: Calculator,
  "ingredientes-inventario": Package,
  menus: UtensilsCrossed,
  "ordenes-compra": ShoppingCart,
  estadisticas: BarChart3,
}

export function CaracteristicasDetailContent({ feature }: { feature: FeaturePageDef }) {
  const { t } = useLanguage()

  const Icon = icons[feature.slug] ?? ChefHat
  const relatedArticle = resourceArticles.find((a) => a.relatedFeatureSlug === feature.slug)

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 space-y-16 max-w-4xl">
        <div>
          <Link href="/about">
            <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-6">
              <ArrowLeft className="h-4 w-4" />
              {t("feat_back_to_about")}
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t(feature.titleKey)}</h1>
              <p className="text-lg text-muted-foreground">{t(feature.taglineKey)}</p>
            </div>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed">{t(feature.introKey)}</p>
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">{t("feat_how_it_works")}</h2>
          <div className="space-y-6">
            {feature.steps.map((step, index) => (
              <div key={step.titleKey} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-semibold text-sm">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">{t(step.titleKey)}</h3>
                  <p className="text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {feature.screenshots.map((shot) => (
            <figure key={shot.src} className="space-y-2">
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <Image
                  src={shot.src}
                  alt={t(shot.altKey)}
                  width={1440}
                  height={900}
                  className="w-full h-auto"
                  sizes="(max-width: 768px) 100vw, 896px"
                />
              </div>
              <figcaption className="text-sm text-muted-foreground text-center">{t(shot.captionKey)}</figcaption>
            </figure>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{t("feat_summary_title")}</h2>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {feature.highlightKeys.map((key) => (
                  <li key={key} className="flex items-start gap-3 text-foreground">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {relatedArticle && (
          <div className="rounded-lg border border-border bg-muted/30 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-sm text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              {t("resource_related_article_prefix")} <span className="font-semibold">{t(relatedArticle.titleKey)}</span>
            </p>
            <Link href={`/recursos/${relatedArticle.slug}`}>
              <Button variant="outline" size="sm" className="gap-2 shrink-0 bg-transparent">
                {t("resource_read_article")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        <section className="text-center space-y-6 py-8 border-t border-border/50">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("feat_ready_title")}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                <CheckCircle className="mr-2 h-5 w-5" />
                {t("about_cta_button1")}
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-border hover:bg-accent hover:text-accent-foreground bg-transparent">
                {t("feat_view_all_modules")}
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
