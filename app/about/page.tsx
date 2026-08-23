"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { featurePages } from "@/lib/feature-pages"
import { useLanguage } from "@/contexts/language-context"
import {
  ChefHat,
  Package,
  BarChart3,
  UtensilsCrossed,
  ShoppingCart,
  Building2,
  Globe,
  Calculator,
  ArrowRight,
  CheckCircle,
} from "lucide-react"

const detailPageSlugs = new Set(featurePages.map((f) => f.slug))

const moduleDefs = [
  {
    slug: "fichas-tecnicas",
    icon: ChefHat,
    titleKey: "about_m_fichas_title",
    descKey: "about_m_fichas_desc",
    pointKeys: ["about_m_fichas_point1", "about_m_fichas_point2", "about_m_fichas_point3"],
  },
  {
    slug: "ingredientes-inventario",
    icon: Package,
    titleKey: "about_m_ingredientes_title",
    descKey: "about_m_ingredientes_desc",
    pointKeys: ["about_m_ingredientes_point1", "about_m_ingredientes_point2", "about_m_ingredientes_point3"],
  },
  {
    slug: "menus",
    icon: UtensilsCrossed,
    titleKey: "about_m_menus_title",
    descKey: "about_m_menus_desc",
    pointKeys: ["about_m_menus_point1", "about_m_menus_point2", "about_m_menus_point3"],
  },
  {
    slug: "ordenes-compra",
    icon: ShoppingCart,
    titleKey: "about_m_ordenes_title",
    descKey: "about_m_ordenes_desc",
    pointKeys: ["about_m_ordenes_point1", "about_m_ordenes_point2", "about_m_ordenes_point3"],
  },
  {
    slug: "estadisticas",
    icon: BarChart3,
    titleKey: "about_m_estadisticas_title",
    descKey: "about_m_estadisticas_desc",
    pointKeys: ["about_m_estadisticas_point1", "about_m_estadisticas_point2", "about_m_estadisticas_point3"],
  },
  {
    slug: "multi-negocio",
    icon: Building2,
    titleKey: "about_m_multinegocio_title",
    descKey: "about_m_multinegocio_desc",
    pointKeys: ["about_m_multinegocio_point1", "about_m_multinegocio_point2", "about_m_multinegocio_point3"],
  },
  {
    slug: "costeo",
    icon: Calculator,
    titleKey: "about_m_costeo_title",
    descKey: "about_m_costeo_desc",
    pointKeys: ["about_m_costeo_point1", "about_m_costeo_point2", "about_m_costeo_point3"],
  },
  {
    slug: "multi-idioma",
    icon: Globe,
    titleKey: "about_m_multiidioma_title",
    descKey: "about_m_multiidioma_desc",
    pointKeys: ["about_m_multiidioma_point1", "about_m_multiidioma_point2"],
  },
] as const

export default function AboutPage() {
  const { t } = useLanguage()

  const modules = moduleDefs.map((def) => ({
    slug: def.slug,
    icon: def.icon,
    title: t(def.titleKey),
    description: t(def.descKey),
    points: def.pointKeys.map((key) => t(key)),
  }))

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 space-y-20">
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">{t("about_hero_title")}</h1>
          <p className="text-lg md:text-xl text-muted-foreground">{t("about_hero_body1")}</p>
          <p className="text-lg text-muted-foreground">{t("about_hero_body2")}</p>
        </section>

        <section className="space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">{t("about_modules_title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("about_modules_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {modules.map((module) => (
              <Card id={module.slug} key={module.title} className="border-border shadow-lg bg-card scroll-mt-24">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <module.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{module.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{module.description}</p>
                  <ul className="space-y-2">
                    {module.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  {detailPageSlugs.has(module.slug) && (
                    <Link
                      href={`/caracteristicas/${module.slug}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {t("about_view_detail")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="text-center space-y-8 py-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">{t("about_cta_title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("about_cta_subtitle")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                <CheckCircle className="mr-2 h-5 w-5" />
                {t("about_cta_button1")}
              </Button>
            </Link>
            <Link href="/planes">
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 border-border hover:bg-accent hover:text-accent-foreground bg-transparent"
              >
                {t("about_cta_button2")}
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
