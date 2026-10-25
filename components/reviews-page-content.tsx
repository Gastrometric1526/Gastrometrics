"use client"

/** Página /resenas (docs/173): todas las opiniones publicadas, o una invitación si aún no hay suficientes. */

import { Button } from "@/components/ui/button"
import { PublicReviews } from "@/components/public-reviews"
import { useLanguage } from "@/contexts/language-context"
import { GOOGLE_REVIEW_URL, TRUSTPILOT_URL } from "@/lib/site-links"
import { CtaBand, MarketingPage, PAGE_WIDTH, PageHero } from "@/components/marketing-ui"

export function ReviewsPageContent() {
  const { t } = useLanguage()
  return (
    <MarketingPage>
      <PageHero kicker={t("reviews_kicker")} title={t("reviews_page_title")} subtitle={t("reviews_page_desc")} />
      <div className={`${PAGE_WIDTH} pb-8`}>
        <PublicReviews
          variant="page"
          fallback={
            <div className="max-w-2xl mx-auto rounded-2xl border border-hairline bg-canvas-alt p-8 text-center space-y-4">
              <p className="text-foreground">{t("reviews_empty")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
                    {t("reviews_trustpilot")}
                  </a>
                </Button>
                {/* Google junto a Trustpilot (docs/177), para todos por igual. */}
                {GOOGLE_REVIEW_URL && (
                  <Button asChild variant="outline">
                    <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                      {t("reviews_google")}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          }
        />
      </div>
      <CtaBand
        title={t("landing_closing_title")}
        desc={t("landing_closing_desc")}
        primary={{ href: "/signup", label: t("landing_closing_cta") }}
        note={t("landing_closing_sub")}
      />
    </MarketingPage>
  )
}
