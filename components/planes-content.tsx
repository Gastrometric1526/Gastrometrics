"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { PlansGrid } from "@/components/plans-grid"
import { useLanguage } from "@/contexts/language-context"

export function PlanesContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-3 mb-12 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("planes_page_title")}</h1>
          <p className="text-lg text-muted-foreground">{t("planes_page_subtitle")}</p>
        </div>

        <PlansGrid />

        <div className="max-w-3xl mx-auto mt-16 text-center space-y-3">
          <h2 className="text-xl font-bold text-foreground">{t("planes_questions_title")}</h2>
          <p className="text-muted-foreground">
            {t("planes_questions_body1")}{" "}
            <Link href="/contacto" className="text-primary hover:underline">
              /contacto
            </Link>{" "}
            {t("planes_questions_body2")} <span className="text-foreground">GastroMetrics@outlook.com</span>,{" "}
            {t("planes_questions_body3")}
          </p>
        </div>
      </div>
      <MarketingFooter />
    </div>
  )
}
