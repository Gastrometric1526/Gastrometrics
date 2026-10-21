"use client"

/** Página /resenas (docs/173): todas las opiniones publicadas, o una invitación si aún no hay suficientes. */

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicReviews } from "@/components/public-reviews"
import { useLanguage } from "@/contexts/language-context"
import { TRUSTPILOT_URL } from "@/lib/site-links"

export function ReviewsPageContent() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("common_back")}
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">{t("reviews_page_title")}</h1>
          <p className="text-muted-foreground">{t("reviews_page_desc")}</p>
        </header>
        <PublicReviews
          variant="page"
          fallback={
            <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
              <p className="text-foreground">{t("reviews_empty")}</p>
              <Button asChild>
                <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
                  {t("reviews_trustpilot")}
                </a>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
