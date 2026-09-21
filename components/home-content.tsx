"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { InstallAppButton } from "@/components/install-app-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { getLocalizedPlans } from "@/lib/plans"
import { useLanguage } from "@/contexts/language-context"
import { AnimatedNumber } from "@/components/animated-number"
import { LandingAdminPdfPreview } from "@/components/landing-admin-pdf-preview"
import { LandingCostCalculator } from "@/components/landing-cost-calculator"
import { ChefHat, Calculator, BarChart3, ArrowRight, Star, CheckCircle2 } from "lucide-react"

// Landing recortada — docs/80-rediseno-visual-y-logo-oficial.md fue el diseño
// original (hero + investigación + fuga invisible + tres pasos + seis módulos + un
// vistazo por dentro + planes + Trustpilot + cierre); esta versión sigue el hallazgo
// de una auditoría externa (ver docs/98, Parte 3.2 y 3.6: "el comprador no compra
// módulos, compra alivio de un dolor" — recortar a hero + antes/después + 3
// beneficios + prueba social + CTA único + precios más abajo). Se quitaron la
// sección aparte de cuatro cifras, la grilla de seis módulos, y el segundo bloque de
// capturas (Inventario/Menu Engineering/tipos de PDF) — ver los comentarios en cada
// sección para el detalle de qué se fusionó y qué se cortó del todo. El FAQ se
// conserva (responde preguntas reales de compra, no vende funciones).
export function HomeContent() {
  const { t, language } = useLanguage()
  const plans = getLocalizedPlans(language)
  const sousChef = plans.find((p) => p.slug === "sous-chef")

  const stats = [
    { value: 42, prefix: "", suffix: "%", descKey: "landing_stat1_desc", sourceKey: "landing_stat1_source" },
    { value: 35, prefix: "+", suffix: "%", descKey: "landing_stat2_desc", sourceKey: "landing_stat2_source" },
    { value: 7, prefix: "$", suffix: "", descKey: "landing_stat3_desc", sourceKey: "landing_stat3_source" },
    { value: 26, prefix: "", suffix: "%", descKey: "landing_stat4_desc", sourceKey: "landing_stat4_source" },
  ] as const

  const leakItems = ["landing_leak_item1", "landing_leak_item2", "landing_leak_item3", "landing_leak_item4"] as const

  const steps = [
    { titleKey: "landing_step1_title", descKey: "landing_step1_desc", timeKey: "landing_step1_time" },
    { titleKey: "landing_step2_title", descKey: "landing_step2_desc", timeKey: "landing_step2_time" },
    { titleKey: "landing_step3_title", descKey: "landing_step3_desc", timeKey: "landing_step3_time" },
  ] as const

  // Tres beneficios orientados a resultado, no a módulo — reemplaza la grilla de seis
  // módulos (hallazgo de auditoría externa, ver docs/98: "el comprador no compra
  // módulos, compra alivio de un dolor"; PDF 3.6 "Foco de producto"). Cada uno mapea
  // a lo que el propio PDF señala como más sólido del producto: costeo real, ventas
  // sin POS (docs/90, "una de las mejores decisiones de producto"), y el motor de
  // recálculo en cascada (antes enterrado como la frase de cierre de la grilla vieja).
  const benefits = [
    { icon: Calculator, titleKey: "landing_benefit1_title", descKey: "landing_benefit1_desc" },
    { icon: ChefHat, titleKey: "landing_benefit2_title", descKey: "landing_benefit2_desc" },
    { icon: BarChart3, titleKey: "landing_benefit3_title", descKey: "landing_benefit3_desc" },
  ] as const

  // Mismas tres cifras que la tarjeta real de Estadísticas → Finanzas
  // (components/estadisticas-finanzas-tab.tsx: realCostPercent, theoreticalCostPercent,
  // variance) — antes esta tarjeta mostraba barras de kg por ingrediente comparando
  // "teórico" contra "real" por semana, una funcionalidad que no existe en ningún lado
  // de la app real (la única comparación teórico-vs-real real es esta, agregada en
  // dinero/porcentaje, no por ingrediente ni en kilogramos).
  const realCostPercent = 34.8
  const theoreticalCostPercent = 30.6
  const costVariance = realCostPercent - theoreticalCostPercent

  const trustCards = [
    { quoteKey: "landing_trust1_quote", nameKey: "landing_trust1_name", businessKey: "landing_trust1_business", stars: 5 },
    { quoteKey: "landing_trust2_quote", nameKey: "landing_trust1_name", businessKey: "landing_trust2_business", stars: 5 },
    { quoteKey: "landing_trust3_quote", nameKey: "landing_trust1_name", businessKey: "landing_trust3_business", stars: 4 },
  ] as const

  const sources = ["landing_source1", "landing_source2", "landing_source3", "landing_source4"] as const

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main>
        {/* Hero — producto real, no ilustración (docs/03: "Producto, no ilustración").
            Texto arriba, tarjeta ancha abajo (en vez de las 2 columnas lado a lado de
            antes) — la réplica del PDF administrativo es más alta/densa que la tarjeta
            simple que reemplaza, y no cabía bien al lado del texto sin verse apretada. */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-16 md:pb-24 space-y-12">
          <div className="space-y-6 text-center max-w-2xl mx-auto">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_hero_kicker")}</p>
            <h1 className="text-4xl md:text-5xl xl:text-[64px] font-semibold tracking-[-0.045em] leading-[1.04] text-balance">
              <span className="text-foreground">{t("landing_hero_title_line1")}</span>{" "}
              <span className="text-primary">{t("landing_hero_title_line2")}</span>
            </h1>
            <p className="text-lg text-text-3 max-w-xl mx-auto">{t("landing_hero_desc")}</p>
            {/* CTA único (hallazgo de auditoría externa, ver docs/98: "vende módulos
                en vez de un resultado claro"; PDF 3.2 pide "CTA único"). "Ver planes"
                pasa de botón a link de texto — sigue accesible, pero ya no compite
                visualmente con la acción principal.
                BUG CORREGIDO: el botón decía "Calcular mi primer plato" pero llevaba
                directo a /signup sin calcular nada — promesa rota, señalada por una
                auditoría externa. Ahora baja a la calculadora real (#calculadora,
                ver LandingCostCalculator), que sí calcula, y desde ahí es donde se
                invita a crear cuenta para guardar el resultado. */}
            <div className="flex flex-col items-center gap-3">
              <Link href="#calculadora">
                <Button size="lg" className="text-base px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                  {t("landing_hero_cta_primary")}
                </Button>
              </Link>
              <Link href="/planes" className="text-sm text-text-3 hover:text-primary inline-flex items-center gap-1">
                {t("landing_hero_cta_secondary")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-sm text-text-4 flex flex-wrap justify-center gap-x-2">
              <span>{t("landing_hero_micro_free")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("landing_hero_micro_nocard")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("landing_hero_micro_langs")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("landing_hero_micro_app")}</span>
            </p>
          </div>

          {/* Réplica del PDF Administrativo real — ver components/landing-admin-pdf-
              preview.tsx para el porqué del cambio (antes esta tarjeta imitaba solo la
              pantalla de Ficha Técnica; el dueño del proyecto pidió que muestre lo mismo
              que trae el PDF administrativo, ya que ahí están todos los datos juntos). */}
          <div className="max-w-3xl mx-auto">
            <LandingAdminPdfPreview />
          </div>
        </section>

        <LandingCostCalculator />

        {/* La fuga invisible — el mejor gancho (docs/03), ahora con la cifra más fuerte
            de la ex-sección "Investigación" incrustada como dato de apoyo en vez de
            una sección aparte con cuatro tarjetas (hallazgo de auditoría externa, ver
            docs/98: recortar a "hero + antes/después + 3 beneficios", no una landing
            larga por secciones). Las otras tres cifras de `stats` ya no se muestran
            como número individual, pero sus fuentes completas (las mismas cuatro
            organizaciones) siguen citadas abajo en "Fuentes de las cifras citadas" —
            no se inventó ni se ocultó ninguna fuente, solo se dejó de dedicarle una
            tarjeta grande a cada cifra. */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_leak_kicker")}</p>
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08]">{t("landing_leak_title")}</h2>
            <p className="text-text-3 leading-relaxed">{t("landing_leak_body")}</p>
            <p className="text-sm text-foreground bg-canvas-alt border border-hairline rounded-xl px-4 py-3">
              <AnimatedNumber value={stats[0].value} suffix={stats[0].suffix} className="font-semibold text-primary tabular-nums" />{" "}
              {t(stats[0].descKey)} <span className="text-text-4">— {t(stats[0].sourceKey)}</span>
            </p>
            <ol className="divide-y divide-hairline border-t border-hairline">
              {leakItems.map((key, i) => (
                <li key={key} className="flex gap-4 py-4">
                  <span className="text-text-4 text-sm tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-foreground">{t(key)}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Mismas tres cifras y misma etiqueta que la tarjeta real de Estadísticas
              → Finanzas (finanzas_card_real_food_cost/theoretical_food_cost/variance,
              components/estadisticas-finanzas-tab.tsx) — antes esta tarjeta mostraba
              barras de kilogramos por ingrediente ("Teórico 22.3 kg" / "Real 26.4 kg"
              para "Queso duro", etc.), una comparación que no existe en ningún lado de
              la app real. La única comparación teórico-vs-real real es esta, agregada
              en porcentaje de food cost, no por ingrediente ni en peso. */}
          <Card className="border-hairline bg-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground">{t("landing_leak_compare_title")}</p>
                <p className="text-xs text-text-4">{t("landing_leak_compare_subtitle")}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("finanzas_card_real_food_cost")}</p>
                  <AnimatedNumber
                    value={realCostPercent}
                    decimals={1}
                    suffix="%"
                    className="block text-xl font-semibold text-foreground tabular-nums mt-1"
                  />
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("finanzas_card_theoretical_food_cost")}</p>
                  <AnimatedNumber
                    value={theoreticalCostPercent}
                    decimals={1}
                    suffix="%"
                    className="block text-xl font-semibold text-foreground tabular-nums mt-1"
                  />
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("finanzas_card_variance")}</p>
                  <AnimatedNumber
                    value={costVariance}
                    decimals={1}
                    prefix="+"
                    suffix="%"
                    className="block text-xl font-semibold text-warning tabular-nums mt-1"
                  />
                  <p className="text-[11px] text-warning mt-0.5">{t("finanzas_variance_acceptable")}</p>
                </div>
              </div>
              <p className="text-xs text-text-4 pt-1 border-t border-hairline">{t("landing_leak_compare_caption")}</p>
            </CardContent>
          </Card>
        </section>

        {/* Tres pasos — con tiempos honestos (docs/03). */}
        <section className="bg-canvas-alt border-y border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground max-w-2xl">{t("landing_steps_title")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden">
              {steps.map((step, i) => (
                <div key={step.titleKey} className="bg-card p-6 space-y-3">
                  <span className="text-text-4 text-sm tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-lg font-semibold text-foreground">{t(step.titleKey)}</p>
                  <p className="text-sm text-text-3 leading-relaxed">{t(step.descKey)}</p>
                  <Badge variant="secondary" className="bg-secondary text-muted-foreground font-medium">{t(step.timeKey)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tres beneficios — resultado, no módulos (ver comentario del array `benefits`
            arriba). Reemplaza tanto la grilla de seis módulos como la sección completa
            "Así se ve por dentro" (capturas de Inventario/Menu Engineering/PDFs) que
            vendían funciones en vez de un resultado — hallazgo de auditoría externa,
            ver docs/98. */}
        <section className="bg-canvas-alt border-y border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_benefits_title")}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden">
              {benefits.map((benefit) => (
                <div key={benefit.titleKey} className="bg-card p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">{t(benefit.titleKey)}</p>
                  <p className="text-sm text-text-3 leading-relaxed">{t(benefit.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
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
                    <Link href={plan.comingSoon ? "/contacto" : plan.slug === "foodie" ? "/signup" : `/planes`} className="block">
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

        {/* Trustpilot — espacio reservado, sin testimonios inventados (docs/03). */}
        <section className="bg-canvas-alt border-y border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="space-y-2">
                <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_trust_title")}</h2>
                <p className="text-text-3 flex items-center gap-2">
                  <span className="flex text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </span>
                  {t("landing_trust_subtitle")}
                </p>
              </div>
              <a
                href="https://www.trustpilot.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1 shrink-0"
              >
                {t("landing_trust_link")} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trustCards.map((card, i) => (
                <Card key={i} className="border-hairline bg-card">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex text-primary">
                        {Array.from({ length: card.stars }).map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </span>
                      <Badge variant="secondary" className="bg-secondary text-muted-foreground font-medium">
                        {t("landing_trust_placeholder_badge")}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-3 leading-relaxed">{t(card.quoteKey)}</p>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t(card.nameKey)}</p>
                      <p className="text-xs text-text-4">{t(card.businessKey)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

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

        {/* Cierre (docs/03: «Cuesta menos medir la fuga que seguir pagándola»). */}
        <section className="border-t border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 text-center space-y-6">
            <h2 className="text-3xl md:text-[44px] font-semibold tracking-[-0.04em] text-foreground max-w-2xl mx-auto leading-[1.08]">
              {t("landing_closing_title")}
            </h2>
            <Link href="/signup">
              <Button size="lg" className="text-base px-7 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                {t("landing_closing_cta")}
              </Button>
            </Link>
            <p className="text-sm text-text-4">{t("landing_closing_sub")}</p>
          </div>
        </section>

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
