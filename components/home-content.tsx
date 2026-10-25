"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { InstallAppButton } from "@/components/install-app-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { getLocalizedPlans } from "@/lib/plans"
import type { TranslationKey } from "@/lib/i18n/translations"
import { useLanguage } from "@/contexts/language-context"
import { LandingRecipeDemo } from "@/components/landing-recipe-demo"
import { LandingReferralSection } from "@/components/landing-referral-section"
import { LandingAppTour, LandingPriceStory, LandingInContext } from "@/components/landing-showcase"
import { LandingHeroDemo } from "@/components/landing-hero-demo"
import { LandingTrustStrip, LandingProblem, LandingHowItWorks, LandingBento, LandingRiskAndFounder, LandingClosing } from "@/components/landing-sections"
import { ChefHat, ArrowRight, CheckCircle2, UtensilsCrossed, Store, Building2, Wine } from "lucide-react"
import { PublicReviews } from "@/components/public-reviews"

// Qué plan encaja con cada tipo de negocio (docs/145) — funciones reales de cada plan.
const BUSINESS_FIT = [
  { key: "chef", icon: ChefHat, plan: "home-cook" },
  { key: "catering", icon: UtensilsCrossed, plan: "chef-de-partie" },
  { key: "bar", icon: Wine, plan: "chef-de-partie" },
  { key: "restaurant", icon: Store, plan: "sous-chef" },
  { key: "group", icon: Building2, plan: "chef-ejecutivo" },
] as const

// Landing rediseñada (docs/196, pedido del dueño: «rediseña todo, que tenga coherencia, que
// una persona entienda qué es GastroMetrics, cómo funciona, y la convenza o le dé
// curiosidad»). El orden sigue las preguntas que se hace quien llega, una por sección:
//   ¿Qué es? → portada con una ficha técnica que se arma sola (LandingHeroDemo).
//   ¿Por qué me importa? → la fuga invisible, con cifras y fuentes (LandingProblem).
//   ¿Cómo funciona? → 3 pasos con mini animación (LandingHowItWorks).
//   ¿Cómo se ve? → recorrido por la app real (LandingAppTour, docs/193).
//   ¿Qué más hace? → bento de beneficios (LandingBento).
//   ¿Qué lo hace distinto? → cambias un precio y todo se ajusta (LandingPriceStory).
//   ¿Lo puedo probar ya? → la calculadora sin cuenta (LandingRecipeDemo).
//   ¿Me sirve a mí? → donde estés, para quién, planes.
//   ¿Qué arriesgo? → sin riesgo + nota del fundador; dudas → FAQ; cierre.
// Un solo llamado a la acción («Crear mi cuenta gratis» → /signup), repetido. Sin
// testimonios inventados: las opiniones reales salen solo desde 3 publicadas (docs/173).
export function HomeContent() {
  const { t, language } = useLanguage()
  const plans = getLocalizedPlans(language)
  const sources = ["landing_source1", "landing_source2", "landing_source3", "landing_source4"] as const

  return (
    <div className="gm-landing-root min-h-screen bg-background">
      <MarketingHeader />

      <main>
        {/* Portada: titular claro (qué y para qué), un solo botón y el producto en
            movimiento al lado — se entiende qué es antes de leer el resto. */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_80%_10%,hsl(var(--primary)/0.10),transparent_70%)]" />
          <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-12 md:pt-20 pb-16 md:pb-24 space-y-12 md:space-y-16">
            <div className="space-y-6 text-center max-w-3xl mx-auto">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_hero_kicker")}</p>
              <h1 className="text-[40px] leading-[1.04] md:text-6xl xl:text-[72px] font-semibold tracking-[-0.045em] text-balance">
                <span className="text-foreground">{t("landing_hero_title_line1")}</span>{" "}
                <span className="text-primary">{t("landing_hero_title_line2")}</span>
              </h1>
              <p className="text-lg text-text-3 max-w-2xl mx-auto text-pretty">{t("landing_hero_desc")}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/signup">
                  <Button size="lg" className="text-base px-7 py-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)]">
                    {t("landing_hero_cta_primary")} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#como-funciona" className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1 px-3 py-2">
                  {t("landing_hero_cta_how")} <ArrowRight className="h-3.5 w-3.5 rotate-90" />
                </Link>
              </div>
              <p className="text-sm text-text-4">
                {t("landing_hero_micro_free")} · {t("landing_hero_micro_nocard")} ·{" "}
                <Link href="#calculadora" className="underline underline-offset-4 hover:text-primary">
                  {t("landing_hero_cta_secondary")}
                </Link>
              </p>
            </div>
            <LandingHeroDemo />
          </div>
        </section>

        <LandingTrustStrip />

        <LandingProblem />

        <LandingHowItWorks />

        <LandingAppTour />

        <LandingBento />

        <LandingPriceStory />

        <LandingRecipeDemo />

        <LandingInContext />

        {/* ¿Qué plan le sirve a cada negocio? (docs/145) — pedido del dueño: decir qué
            funciones encajan con cada tipo de negocio según el plan. Las funciones
            listadas son las reales de cada plan (lib/plans.ts → unlockedFeatures). */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_fit_title")}</h2>
            <p className="text-text-3">{t("landing_fit_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {BUSINESS_FIT.map((fit) => {
              const plan = plans.find((p) => p.slug === fit.plan)
              return (
                <div key={fit.key} className="rounded-2xl border border-hairline bg-card p-5 flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
                    <fit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-base font-semibold text-foreground leading-snug">{t(`landing_fit_${fit.key}_title` as TranslationKey)}</p>
                  <p className="text-xs font-medium text-primary">
                    {plan?.name} · {plan?.price}
                  </p>
                  <ul className="text-sm text-text-3 space-y-1.5 flex-1">
                    {[1, 2, 3].map((n) => (
                      <li key={n} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{t(`landing_fit_${fit.key}_f${n}` as TranslationKey)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-text-4">{t("landing_fit_note")}</p>
        </section>

        {/* Planes reales — los cinco de lib/plans.ts, Sous Chef destacado en negro. */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_plans_title")}</h2>
            <p className="text-text-3">{t("landing_plans_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {plans.map((plan) => {
              const isHighlighted = plan.highlighted
              return (
                <Card
                  key={plan.slug}
                  className={
                    "border-hairline flex flex-col " + (isHighlighted ? "bg-foreground text-background" : "bg-card")
                  }
                >
                  <CardContent className="p-5 flex flex-col flex-1 space-y-4">
                    <div className="space-y-1">
                      <p className={"text-sm font-semibold " + (isHighlighted ? "text-background" : "text-foreground")}>{plan.name}</p>
                      <p className={"text-2xl font-semibold tabular-nums " + (isHighlighted ? "text-background" : "text-foreground")}>
                        {plan.price === "Gratis" ? plan.price : plan.price.replace("/mes", "")}
                        {plan.price !== "Gratis" && (
                          <span className={"text-sm font-normal " + (isHighlighted ? "text-background/60" : "text-text-4")}>/mes</span>
                        )}
                      </p>
                    </div>
                    <p className={"text-xs " + (isHighlighted ? "text-background/70" : "text-text-3")}>{plan.tagline}</p>
                    <p className={"text-xs leading-relaxed flex-1 " + (isHighlighted ? "text-background/80" : "text-text-3")}>
                      {plan.description}
                    </p>
                    <Link href={plan.comingSoon ? `/contacto?plan=${plan.slug}` : plan.slug === "foodie" ? "/signup" : `/planes`} className="block">
                      <Button
                        size="sm"
                        className={
                          "w-full " +
                          (isHighlighted
                            ? "bg-background text-foreground hover:bg-background/90"
                            : plan.slug === "foodie"
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "")
                        }
                        variant={isHighlighted || plan.slug === "foodie" ? "default" : "outline"}
                      >
                        {plan.comingSoon ? t("landing_plans_cta_sales") : plan.slug === "foodie" ? t("landing_plans_cta_free") : t("landing_plans_cta_paid")}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <LandingRiskAndFounder />

        {/* Regala un mes, gana un mes (docs/179). */}
        <LandingReferralSection />

        {/* Opiniones reales de chefs (docs/173): solo con 3 o más publicadas con permiso. */}
        <PublicReviews variant="landing" max={3} wrapperClassName="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-20" />

        {/* FAQ — no forma parte del paquete de diseño, se conserva porque responde
            preguntas reales de compra (privacidad, POS, monedas, planes). */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
          <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground text-center">{t("landing_faq_title")}</h2>

          <div className="grid gap-8 md:grid-cols-2 max-w-6xl mx-auto">
            <Card className="border-hairline bg-card">
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
                  <AccordionItem value="item-start" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q11")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a11")}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-req" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q3")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a3")}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-hairline bg-card">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">{t("landing_faq_functions_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-import" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q12")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a12")}</AccordionContent>
                  </AccordionItem>
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

            <Card className="border-hairline bg-card">
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
                  <AccordionItem value="item-referral" className="border-border">
                    <AccordionTrigger className="text-foreground hover:text-primary">{t("landing_faq_q13")}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{t("landing_faq_a13")}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-hairline bg-card">
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

        <LandingClosing />

        {/* Fuentes de las cifras citadas (docs/03: "Footer con las cuatro fuentes
            completas"). */}
        <section className="bg-canvas-alt border-t border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 space-y-3">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_sources_title")}</p>
            <ul className="space-y-1.5">
              {sources.map((key) => (
                <li key={key} className="text-xs text-text-4 flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 opacity-40" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <MarketingFooter />
      <InstallAppButton />
    </div>
  )
}
