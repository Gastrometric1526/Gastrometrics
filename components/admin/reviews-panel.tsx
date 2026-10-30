"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { TRUSTPILOT_URL } from "@/lib/site-links"
import { Star, ExternalLink, MessageSquareQuote } from "lucide-react"
import { formatDate } from "@/lib/date-format"
import { MIN_PUBLISHED_REVIEWS, parseReviewMessage } from "@/lib/reviews"
import { useAdminTick } from "@/components/admin/live"
import { AccountLink } from "@/components/admin/account-link"

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
 * Reseñas de los usuarios (docs/144, ampliado en docs/173).
 * - Opiniones de la calificación de la app, del correo de encuesta y los testimonios
 *   (feedback type «experiencia»), con nota y la marca de permiso para mostrarlas.
 * - «Mostrar en el sitio» / «Quitar del sitio»: solo con permiso; el sitio las muestra
 *   desde MIN_PUBLISHED_REVIEWS publicadas (/api/admin/reviews, /api/reviews).
 * - Las respuestas a las preguntas cortas pasaron a Buzón → Encuestas (docs/213).
 * - Enlace a Trustpilot (las reseñas públicas viven allá).
 */
export function ReviewsPanel() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)
  const [published, setPublished] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  // En vivo (docs/192).
  const tick = useAdminTick()
  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((res) => res.json())
      .then((json) => {
        const rows: ReviewRow[] = Array.isArray(json.feedback) ? json.feedback : []
        setReviews(rows.filter((r) => r.type === "experiencia"))
      })
      .catch(() => setReviews([]))
    fetch("/api/admin/reviews")
      .then((res) => res.json())
      .then((json) => setPublished(new Set(Array.isArray(json.publishedIds) ? json.publishedIds : [])))
      .catch(() => {})
  }, [tick])

  const togglePublish = async (id: string, publish: boolean) => {
    setBusy(id)
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, publish }),
      })
      if (!res.ok) throw new Error()
      setPublished((prev) => {
        const next = new Set(prev)
        if (publish) next.add(id)
        else next.delete(id)
        return next
      })
    } catch {
      toast({ title: t("admin_reviews_publish_error"), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

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
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            {t("admin_reviews_threshold").replace("{min}", String(MIN_PUBLISHED_REVIEWS)).replace("{count}", String(published.size))}
          </p>
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
              <p className="text-sm text-muted-foreground">{t("admin_reviews_count").replace("{count}", String(reviews.length))}</p>
              {reviews.map((r) => {
                const parsed = parseReviewMessage(r.message)
                const isPublished = published.has(r.id)
                return (
                  <div key={r.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {parsed.score !== null && <Badge variant="secondary">{parsed.score}/10</Badge>}
                      {parsed.testimonial && <Badge variant="outline">{t("admin_reviews_testimonial")}</Badge>}
                      {parsed.publishable && <Badge variant="outline">{t("admin_reviews_publishable")}</Badge>}
                      {isPublished && <Badge>{t("admin_reviews_published")}</Badge>}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{parsed.comment || "—"}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {r.user_email ? <AccountLink email={r.user_email}>{[r.user_name, r.user_email].filter(Boolean).join(" · ")}</AccountLink> : r.user_name || t("admin_reviews_anonymous")} · {formatDate(r.created_at)}
                      </p>
                      {parsed.publishable && parsed.comment && (
                        <Button size="sm" variant={isPublished ? "outline" : "default"} disabled={busy === r.id} onClick={() => togglePublish(r.id, !isPublished)}>
                          {isPublished ? t("admin_reviews_unpublish") : t("admin_reviews_publish")}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
          <p className="text-xs text-muted-foreground pt-2">{t("admin_reviews_footnote")}</p>
        </CardContent>
      </Card>

    </div>
  )
}
