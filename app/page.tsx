"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeroIllustration } from "@/components/marketing-hero-illustration"
import { InstallAppButton } from "@/components/install-app-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { plans } from "@/lib/plans"
import { useLanguage } from "@/contexts/language-context"
import {
  ChefHat,
  Package,
  Calculator,
  UtensilsCrossed,
  BarChart3,
  ShoppingCart,
  ArrowRight,
  Mail,
} from "lucide-react"

export default function Home() {
  const { t } = useLanguage()

  // Copy en tono profesional/neutro, sin exageraciones ni prueba social inventada —
  // pedido explícito del dueño del proyecto ("eliminemos el marketing emocional
  // barato"). Nada de "miles de profesionales confían en..." si todavía no es
  // verificable. Dentro del componente (no a nivel de módulo) porque necesita `t()`.
  const features = [
    {
      slug: "fichas-tecnicas",
      icon: ChefHat,
      title: t("landing_feature_ficha_title"),
      description: t("landing_feature_ficha_desc"),
    },
    {
      slug: "costeo",
      icon: Calculator,
      title: t("landing_feature_costeo_title"),
      description: t("landing_feature_costeo_desc"),
    },
    {
      slug: "ingredientes-inventario",
      icon: Package,
      title: t("landing_feature_ingredientes_title"),
      description: t("landing_feature_ingredientes_desc"),
    },
    {
      slug: "menus",
      icon: UtensilsCrossed,
      title: t("landing_feature_menus_title"),
      description: t("landing_feature_menus_desc"),
    },
    {
      slug: "ordenes-compra",
      icon: ShoppingCart,
      title: t("landing_feature_ordenes_title"),
      description: t("landing_feature_ordenes_desc"),
    },
    {
      slug: "estadisticas",
      icon: BarChart3,
      title: t("landing_feature_estadisticas_title"),
      description: t("landing_feature_estadisticas_desc"),
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 space-y-24">
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground text-balance">{t("landing_hero_title")}</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">{t("landing_hero_desc")}</p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <Link href="/signup">
                <Button size="lg" className="text-base px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                  {t("landing_hero_cta_evaluate")}
                </Button>
              </Link>
              <Link href="/planes">
                <Button size="lg" variant="outline" className="text-base px-6 py-3 border-border hover:bg-accent hover:text-accent-foreground bg-transparent">
                  {t("landing_hero_cta_plans")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">{t("landing_hero_no_signup")}</p>
          </div>
          <MarketingHeroIllustration className="w-full h-auto max-w-lg mx-auto" />
        </section>

        {/* Contexto */}
        <section className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("landing_for_whom_title")}</h2>
          <p className="text-muted-foreground leading-relaxed">{t("landing_for_whom_body")}</p>
        </section>

        {/* Features Section */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("landing_features_title")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("landing_features_subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Link key={feature.slug} href={`/caracteristicas/${feature.slug}`} className="block h-full">
                <Card className="h-full border-border shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-300 bg-card cursor-pointer">
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center">{feature.description}</p>
                    <p className="text-primary text-sm font-medium text-center mt-4 inline-flex items-center gap-1 justify-center w-full">
                      {t("landing_feature_see_more")} <ArrowRight className="h-3.5 w-3.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Pricing summary */}
        <section className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("landing_pricing_title")}</h2>
            <p className="text-muted-foreground">{t("landing_pricing_subtitle")}</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left font-semibold text-foreground px-4 py-3">{t("landing_pricing_th_plan")}</th>
                  <th className="text-left font-semibold text-foreground px-4 py-3">{t("landing_pricing_th_price")}</th>
                  <th className="text-left font-semibold text-foreground px-4 py-3">{t("landing_pricing_th_scope")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((plan) => (
                  <tr key={plan.slug}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {plan.name}
                      {plan.comingSoon && <span className="ml-2 text-xs text-muted-foreground">{t("landing_pricing_coming_soon")}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.price}</td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("landing_faq_title")}</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-6xl mx-auto">
            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{t("landing_faq_general_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q1")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a1")}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q2")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a2")}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-req" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q3")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a3")}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{t("landing_faq_functions_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-3" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q4")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a4")}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q5")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a5")}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-pos" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q6")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a6")}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{t("landing_faq_plans_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-5" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q7")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("landing_faq_a7_prefix").replace("{name}", plans[0].name).replace("{desc}", plans[0].description.toLowerCase())}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q8")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      <ul className="list-disc pl-4 space-y-1">
                        {plans.slice(1).map((plan) => (
                          <li key={plan.slug}>
                            {plan.name} ({plan.price}): {plan.description}
                          </li>
                        ))}
                      </ul>
                      <Link href="/planes" className="text-primary hover:underline text-sm mt-2 inline-block">
                        {t("landing_faq_a8_see_full")}
                      </Link>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{t("landing_faq_usability_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-7" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q9")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {t("landing_faq_a9_before")}{" "}
                      <Link href="/politica-privacidad" className="text-primary hover:underline">
                        {t("privacidad_page_title")}
                      </Link>
                      .
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-8" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q10")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a10")}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center space-y-6 py-12 border-t border-border/50">
          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t("landing_cta_title")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("landing_cta_desc")}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="text-base px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg">
                {t("landing_cta_button1")}
              </Button>
            </Link>
            <Link href="/contacto">
              <Button size="lg" variant="outline" className="text-base px-6 py-3 border-border hover:bg-accent hover:text-accent-foreground bg-transparent">
                <Mail className="mr-2 h-4 w-4" />
                {t("landing_cta_button2")}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <InstallAppButton />
    </div>
  )
}
