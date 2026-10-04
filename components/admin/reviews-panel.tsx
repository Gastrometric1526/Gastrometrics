"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { TRUSTPILOT_URL } from "@/lib/site-links"
import { Star, ExternalLink, MessageSquareQuote } from "lucide-react"

interface ReviewRow {
  id: string
  type: string
  message: string
  user_name: string | null
  user_email: string | null
  created_at: string
  status: string
}

/**
 * Reseñas de los usuarios (docs/144) — pedido del dueño: "en admin debería poder ver o
 * leer en alguna parte donde ellos hagan los reviews". Hay dos lugares donde la gente
 * deja su opinión, y los dos salen de la encuesta de experiencia (correo a las 4 horas de
 * uso, lib/services/notify-activation.ts):
 * 1. El comentario dentro de la app (/contacto?type=experiencia) → tabla feedback con
 *    type "experiencia". Se lista acá, en orden de llegada (antes solo estaba como una
 *    sub-pestaña del Buzón y era fácil no verlo).
 * 2. La reseña pública en Trustpilot → vive en Trustpilot; acá va el enlace directo.
 */
export function ReviewsPanel() {
  const { t, language } = useLanguage()
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((res) => res.json())
      .then((json) => {
        const rows: ReviewRow[] = Array.isArray(json.feedback) ? json.feedback : []
        setReviews(rows.filter((r) => r.type === "experiencia"))
      })
      .catch(() => setReviews([]))
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              {t("admin_reviews_title")}
            </CardTitle>
            <CardDescription>{t("admin_reviews_desc")}</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("admin_reviews_trustpilot")}
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviews === null ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <MessageSquareQuote className="h-6 w-6" />
              <p className="text-sm">{t("admin_reviews_empty")}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("admin_reviews_count").replace("{count}", String(reviews.length))}
              </p>
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{r.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.user_name, r.user_email].filter(Boolean).join(" · ") || t("admin_reviews_anonymous")} ·{" "}
                    {new Date(r.created_at).toLocaleDateString(getDateLocale(language))}
                  </p>
                </div>
              ))}
            </>
          )}
          <p className="text-xs text-muted-foreground pt-2">{t("admin_reviews_footnote")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
