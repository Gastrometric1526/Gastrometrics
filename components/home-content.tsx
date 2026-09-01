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
import {
  ChefHat,
  Package,
  Calculator,
  UtensilsCrossed,
  BarChart3,
  ArrowRight,
  Star,
  CheckCircle2,
  Sparkles,
  Beef,
  Puzzle,
  Dog,
} from "lucide-react"

// Landing rediseñado — docs/80-rediseno-visual-y-logo-oficial.md, siguiendo el orden
// y el argumento de la entrega "Revisión visual y logo oficial" (docs/03-landing.md
// del paquete): hero con producto real (no ilustración), investigación con fuentes
// citadas, la fuga invisible, tres pasos, seis módulos con su plan de desbloqueo real
// (tomado de lib/plans.ts, no inventado), un vistazo real a Inventario/Menu
// Engineering/PDFs, planes reales, reseñas de Trustpilot en espera, y cierre. El FAQ
// que ya existía se conserva más abajo (no estaba en el paquete de diseño, pero
// responde preguntas reales de compra que sí conviene mantener).
export function HomeContent() {
  const { t, language } = useLanguage()
  const plans = getLocalizedPlans(language)
  const sousChef = plans.find((p) => p.slug === "sous-chef")

  const stats = [
    { value: "42%", descKey: "landing_stat1_desc", sourceKey: "landing_stat1_source" },
    { value: "+35%", descKey: "landing_stat2_desc", sourceKey: "landing_stat2_source" },
    { value: "$7", descKey: "landing_stat3_desc", sourceKey: "landing_stat3_source" },
    { value: "26%", descKey: "landing_stat4_desc", sourceKey: "landing_stat4_source" },
  ] as const

  const leakItems = ["landing_leak_item1", "landing_leak_item2", "landing_leak_item3", "landing_leak_item4"] as const

  const steps = [
    { titleKey: "landing_step1_title", descKey: "landing_step1_desc", timeKey: "landing_step1_time" },
    { titleKey: "landing_step2_title", descKey: "landing_step2_desc", timeKey: "landing_step2_time" },
    { titleKey: "landing_step3_title", descKey: "landing_step3_desc", timeKey: "landing_step3_time" },
  ] as const

  // Badge de cada módulo viene de la matriz real de planes (lib/plans.ts
  // unlockedFeatures), no de una suposición — ver docs/80.
  const modules = [
    { slug: "fichas-tecnicas", icon: ChefHat, titleKey: "landing_module1_title", descKey: "landing_module1_desc", badge: t("landing_module_badge_free") },
    { slug: "ingredientes-inventario", icon: Package, titleKey: "landing_module2_title", descKey: "landing_module2_desc", badge: t("landing_module_badge_free") },
    { slug: "costeo", icon: Calculator, titleKey: "landing_module3_title", descKey: "landing_module3_desc", badge: "Home Cook" },
    { slug: "ingredientes-inventario", icon: Package, titleKey: "landing_module4_title", descKey: "landing_module4_desc", badge: "Chef de Partie" },
    { slug: "menus", icon: UtensilsCrossed, titleKey: "landing_module5_title", descKey: "landing_module5_desc", badge: "Chef de Partie" },
    { slug: "estadisticas", icon: BarChart3, titleKey: "landing_module6_title", descKey: "landing_module6_desc", badge: "Sous Chef" },
  ] as const

  const leakBars = [
    { name: "Queso duro", pct: "+18.4%", theoretical: 22.3, real: 26.4 },
    { name: "Machaca de res", pct: "+11.2%", theoretical: 31.0, real: 34.5 },
    { name: "Mantequilla crema", pct: "+26.0%", theoretical: 9.6, real: 12.1 },
    { name: "Frijoles rojos", pct: "+3.1%", theoretical: 40.2, real: 41.4 },
  ]

  // Estados reales de Inventario — mismas tres palabras que usa la pantalla de
  // verdad (inventario_status_critical/low/normal en lib/i18n/translations.ts), no
  // etiquetas inventadas para el landing. Antes decía "Ordenar ya"/"Sugerido"/
  // "Suficiente", que no existen en ningún lado de la app real.
  const inventoryRows = [
    { name: "Queso duro", stock: "3.2 / 12 kg", statusKey: "inventario_status_critical" as const, tone: "danger" as const },
    { name: "Mantequilla crema", stock: "4.1 / 10 kg", statusKey: "inventario_status_critical" as const, tone: "danger" as const },
    { name: "Machaca de res", stock: "8.5 / 15 kg", statusKey: "inventario_status_low" as const, tone: "warning" as const },
    { name: "Harina de trigo", stock: "48 / 25 kg", statusKey: "inventario_status_normal" as const, tone: "success" as const },
  ]

  // Menu Engineering — misma estructura que el widget real (components/
  // estadisticas-finanzas-tab.tsx): icono + etiqueta + contador + una línea de
  // consejo + lista de nombres de plato, SIN cifras de margen/cantidad por plato
  // (esas viven en la tabla detallada aparte, no en estas tarjetas). Antes el
  // landing mostraba "71% · 412" junto a cada plato, algo que el componente real
  // nunca hace.
  const menuEngineering = [
    { titleKey: "landing_inside_menueng_stars", descKey: "landing_inside_menueng_stars_desc", icon: Sparkles, color: "text-chart-1", items: ["Baleada de machaca", "Pastelitos de carne"] },
    { titleKey: "landing_inside_menueng_cows", descKey: "landing_inside_menueng_cows_desc", icon: Beef, color: "text-chart-4", items: ["Plato típico", "Menú del día"] },
    { titleKey: "landing_inside_menueng_puzzles", descKey: "landing_inside_menueng_puzzles_desc", icon: Puzzle, color: "text-chart-2", items: ["Menú degustación", "Sopa de caracol"] },
    { titleKey: "landing_inside_menueng_dogs", descKey: "landing_inside_menueng_dogs_desc", icon: Dog, color: "text-chart-3", items: ["Brunch dominical", "Tres leches"] },
  ] as const

  const pdfTypes = [
    { titleKey: "landing_inside_pdf_kitchen", descKey: "landing_inside_pdf_kitchen_desc" },
    { titleKey: "landing_inside_pdf_presentation", descKey: "landing_inside_pdf_presentation_desc" },
    { titleKey: "landing_inside_pdf_admin", descKey: "landing_inside_pdf_admin_desc" },
  ] as const

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
        {/* Hero — producto real, no ilustración (docs/03: "Producto, no ilustración") */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-16 md:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_hero_kicker")}</p>
            <h1 className="text-4xl md:text-5xl xl:text-[64px] font-semibold tracking-[-0.045em] leading-[1.04] text-balance">
              <span className="text-foreground">{t("landing_hero_title_line1")}</span>{" "}
              <span className="text-primary">{t("landing_hero_title_line2")}</span>
            </h1>
            <p className="text-lg text-text-3 max-w-xl mx-auto lg:mx-0">{t("landing_hero_desc")}</p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <Link href="/signup">
                <Button size="lg" className="text-base px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                  {t("landing_hero_cta_primary")}
                </Button>
              </Link>
              <Link href="/planes">
                <Button size="lg" variant="outline" className="text-base px-6 py-3">
                  {t("landing_hero_cta_secondary")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-text-4 flex flex-wrap justify-center lg:justify-start gap-x-2">
              <span>{t("landing_hero_micro_free")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("landing_hero_micro_nocard")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("landing_hero_micro_langs")}</span>
            </p>
          </div>

          {/* Ficha técnica real como demo de producto — nombres/cifras ilustrativos,
              fijos en todos los idiomas (misma lógica que una captura de pantalla). */}
          <Card className="border-hairline bg-card overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_hero_card_kicker")} · FT-0087</p>
              </div>
              <p className="text-base font-semibold text-foreground">Hamburguesa clásica · 1 porción</p>
              <div className="divide-y divide-hairline border-t border-b border-hairline">
                {[
                  ["Pan de hamburguesa", "8%", "L 6.50"],
                  ["Carne de res 150g", "45%", "L 32.00"],
                  ["Queso cheddar", "12%", "L 10.80"],
                  ["Vegetales frescos", "9%", "L 7.20"],
                  ["Salsa de la casa", "4%", "L 3.60"],
                ].map(([name, pct, cost]) => (
                  <div key={name} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-foreground">{name}</span>
                    <span className="flex items-center gap-4 tabular-nums text-text-3">
                      <span className="text-text-4">{pct}</span>
                      <span>{cost}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_hero_card_cost_label")}</p>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">L 60.10</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">{t("landing_hero_card_foodcost_label")}</p>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">32.5%</p>
                </div>
              </div>
              <div className="rounded-xl bg-warning-soft text-warning text-xs font-medium px-3.5 py-2.5">
                {t("landing_hero_card_alert")}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Investigación — cuatro cifras con fuente citada (docs/03: prueba de que el
            problema existe, sin testimonios inventados). */}
        <section className="bg-canvas-alt border-y border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-20 space-y-10">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_stats_title")}</h2>
              <p className="text-text-3">{t("landing_stats_intro")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border border-hairline rounded-2xl overflow-hidden">
              {stats.map((stat) => (
                <div key={stat.value} className="bg-card p-6 space-y-3">
                  <p className="text-4xl font-semibold text-primary tabular-nums">{stat.value}</p>
                  <p className="text-sm text-foreground leading-snug">{t(stat.descKey)}</p>
                  <p className="text-xs text-text-4 leading-snug">{t(stat.sourceKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* La fuga invisible — el mejor gancho (docs/03). */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{t("landing_leak_kicker")}</p>
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08]">{t("landing_leak_title")}</h2>
            <p className="text-text-3 leading-relaxed">{t("landing_leak_body")}</p>
            <ol className="divide-y divide-hairline border-t border-hairline">
              {leakItems.map((key, i) => (
                <li key={key} className="flex gap-4 py-4">
                  <span className="text-text-4 text-sm tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-foreground">{t(key)}</span>
                </li>
              ))}
            </ol>
          </div>

          <Card className="border-hairline bg-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground">{t("landing_leak_compare_title")}</p>
                <p className="text-xs text-text-4">{t("landing_leak_compare_subtitle")}</p>
              </div>
              <div className="space-y-4">
                {leakBars.map((bar) => {
                  const max = 40
                  const theoreticalPct = Math.min(100, (bar.theoretical / max) * 100)
                  const realPct = Math.min(100, (bar.real / max) * 100)
                  return (
                    <div key={bar.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{bar.name}</span>
                        <span className="text-primary font-medium tabular-nums">{bar.pct}</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-text-4/50" style={{ width: `${theoreticalPct}%` }} />
                        <div
                          className="absolute inset-y-0 bg-primary rounded-r-full"
                          style={{ left: `${theoreticalPct}%`, width: `${Math.max(0, realPct - theoreticalPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-text-4 tabular-nums">
                        <span>Teórico {bar.theoretical.toFixed(1)} kg</span>
                        <span>Real {bar.real.toFixed(1)} kg</span>
                      </div>
                    </div>
                  )
                })}
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

        {/* Seis módulos — cada uno con el plan real desde el que se desbloquea. */}
        <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_modules_title")}</h2>
            <p className="text-text-3">{t("landing_modules_body")}</p>
          </div>
          <div className="divide-y divide-hairline border-t border-b border-hairline">
            {modules.map((mod, i) => (
              <Link
                key={`${mod.slug}-${i}`}
                href={`/caracteristicas/${mod.slug}`}
                className="flex items-center gap-5 py-5 group hover:bg-[#F9F9F8] transition-colors -mx-2 px-2 rounded-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                  <mod.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t(mod.titleKey)}</p>
                  <p className="text-sm text-text-3 mt-0.5">{t(mod.descKey)}</p>
                </div>
                <Badge variant="secondary" className="bg-secondary text-muted-foreground font-medium shrink-0 hidden sm:inline-flex">
                  {mod.badge}
                </Badge>
                <ArrowRight className="h-4 w-4 text-text-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        </section>

        {/* Así se ve por dentro — UI real, sin ilustración (docs/03). */}
        <section className="bg-canvas-alt border-y border-hairline">
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground">{t("landing_inside_title")}</h2>
              <p className="text-text-3">{t("landing_inside_subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inventario */}
              <Card className="border-hairline bg-card">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("landing_inside_inventory_title")}</p>
                    <p className="text-xs text-text-4">{t("landing_inside_inventory_subtitle")} · 7 / 318</p>
                  </div>
                  <div className="divide-y divide-hairline border-t border-hairline">
                    {inventoryRows.map((row) => (
                      <div key={row.name} className="flex items-center justify-between py-3 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{row.name}</p>
                          <p className="text-xs text-text-4 tabular-nums">{row.stock}</p>
                        </div>
                        <span
                          className={
                            "text-xs font-medium px-2.5 py-1 rounded-full shrink-0 " +
                            (row.tone === "danger"
                              ? "bg-danger-soft text-destructive"
                              : row.tone === "warning"
                                ? "bg-warning-soft text-warning"
                                : "bg-success-soft text-success")
                          }
                        >
                          {t(row.statusKey)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Menu Engineering — misma estructura que el widget real de Reportes:
                  icono + etiqueta + contador, una línea de consejo, y la lista de
                  platos de ese cuadrante (nada de cifras inline, esas viven en la
                  tabla detallada de la pantalla real). */}
              <Card className="border-hairline bg-card">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("landing_inside_menueng_title")}</p>
                    <p className="text-xs text-text-4">{t("landing_inside_menueng_period")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {menuEngineering.map((quad) => (
                      <div key={quad.titleKey} className="border border-hairline rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <quad.icon className={`h-3.5 w-3.5 ${quad.color}`} />
                          <p className="text-xs font-semibold text-foreground">{t(quad.titleKey)}</p>
                          <span className="ml-auto text-[10px] text-text-4 tabular-nums">{quad.items.length}</span>
                        </div>
                        <p className="text-[11px] text-text-4 leading-snug">{t(quad.descKey)}</p>
                        <div className="space-y-0.5 pt-0.5">
                          {quad.items.map((name) => (
                            <p key={name} className="text-[11px] text-text-3 truncate">
                              {name}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Un PDF para cada quien */}
            <Card className="border-hairline bg-card">
              <CardContent className="p-6 space-y-5">
                <p className="text-sm font-semibold text-foreground">{t("landing_inside_pdf_title")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline border border-hairline rounded-xl overflow-hidden">
                  {pdfTypes.map((pdf) => (
                    <div key={pdf.titleKey} className="bg-card p-4">
                      <p className="text-sm font-medium text-foreground">{t(pdf.titleKey)}</p>
                      <p className="text-xs text-text-4 mt-1">{t(pdf.descKey)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-4">{t("landing_inside_pdf_caption")}</p>
              </CardContent>
            </Card>
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
