"use client"

import Link from "next/link"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero, Reveal } from "@/components/marketing-ui"
import { PlansGrid } from "@/components/plans-grid"
import { useLanguage } from "@/contexts/language-context"
import { PublicReviews } from "@/components/public-reviews"

export function PlanesContent() {
  const { t } = useLanguage()

  return (
    <MarketingPage>
      <PageHero kicker={t("marketing_nav_plans")} title={t("planes_page_title")} subtitle={t("planes_page_subtitle")} />
      <div className={`${PAGE_WIDTH} pb-8`}>

        {/* Selector rápido por problema a resolver, en vez de solo comparar listas de
            funciones — pedido explícito: "¿qué estás intentando resolver?" en vez de
            "¿cuántas funciones trae?". Cada botón hace scroll a la tarjeta del plan
            correspondiente (id="plan-{slug}" en plans-grid.tsx), no navega ni cambia
            nada — es una guía, la decisión real sigue tomándose en la tarjeta. */}
        <Reveal className="max-w-3xl mx-auto mb-12 -mt-2">
          <p className="text-sm font-medium text-text-3 text-center mb-3">{t("planes_finder_title")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(
              [
                ["foodie", "planes_finder_foodie"],
                ["home-cook", "planes_finder_home_cook"],
                ["chef-de-partie", "planes_finder_chef_de_partie"],
                ["sous-chef", "planes_finder_sous_chef"],
                ["chef-ejecutivo", "planes_finder_chef_ejecutivo"],
              ] as const
            ).map(([slug, key]) => (
              <a
                key={slug}
                href={`#plan-${slug}`}
                className="text-sm px-3.5 py-2 rounded-full border border-hairline bg-card hover:border-primary hover:text-primary transition-colors"
              >
                {t(key)}
              </a>
            ))}
          </div>
        </Reveal>

        <PlansGrid />

        {/* Opiniones reales, filtrables por tipo de negocio (docs/173); solo con 3 o más publicadas. */}
        <div className="mt-16">
          <PublicReviews variant="planes" filterable max={6} />
        </div>

        <Reveal className="max-w-3xl mx-auto mt-16 rounded-2xl border border-hairline bg-canvas-alt p-6 md:p-8 text-center space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{t("planes_questions_title")}</h2>
          <p className="text-text-3">
            {t("planes_questions_body1")}{" "}
            <Link href="/contacto" className="text-primary hover:underline">
              /contacto
            </Link>{" "}
            {t("planes_questions_body2")} <span className="text-foreground">GastroMetrics@outlook.com</span>,{" "}
            {t("planes_questions_body3")}
          </p>
        </Reveal>
      </div>
      <CtaBand
        title={t("landing_closing_title")}
        desc={t("landing_closing_desc")}
        primary={{ href: "/signup", label: t("landing_closing_cta") }}
        secondary={{ href: "/calculadora-food-cost", label: t("calc_link_short") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
