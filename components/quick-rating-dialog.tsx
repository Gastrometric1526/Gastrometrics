"use client"

/**
 * Calificación dentro de la app (docs/145, rehecha en docs/173).
 *
 * Cuándo sale lo decide components/feedback/feedback-orchestrator.tsx: en el Dashboard,
 * después de un momento de valor (primera receta con costo, primer PDF, un cambio de precio
 * que recalculó varias recetas) o a los 7 días de uso o con 3 recetas; como mucho una
 * pregunta cada 5 días.
 *
 * Flujo (sin filtrar quién opina en público, como exigen Trustpilot y Google):
 * 1. «¿Qué tan probable es que recomiendes Gastrometrics?» (0–10, escala NPS).
 * 2. Seguimiento según la nota: 0–6 «¿qué te está costando o qué mejoramos?»,
 *    7–8 «¿qué te falta para que sea excelente?», 9–10 «¿qué es lo que más te sirve?»;
 *    casilla de permiso para mostrar el comentario en el sitio.
 * 3. A TODOS por igual: «¿Nos ayudas con una reseña pública?» → Trustpilot, o «Ahora no».
 * Se guarda en el buzón como opinión («[9/10][publicable] comentario», lib/reviews.ts).
 */

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { TRUSTPILOT_URL, GOOGLE_REVIEW_URL } from "@/lib/site-links"
import { ratingBand } from "@/lib/feedback/ask-rules"
import { buildReviewMessage } from "@/lib/reviews"
import type { TranslationKey } from "@/lib/i18n/translations"

const ASK_BY_BAND: Record<"low" | "mid" | "high", TranslationKey> = {
  low: "quick_rating_ask_low",
  mid: "quick_rating_ask_mid",
  high: "quick_rating_ask_high",
}

export function QuickRatingDialog({
  open,
  moment,
  onFinish,
}: {
  open: boolean
  /** Qué momento disparó la pregunta (queda anotado en el buzón). */
  moment?: string | null
  onFinish: (status: "answered" | "dismissed") => void
}) {
  const { user, userProfile } = useAuth()
  const { t, language } = useLanguage()
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const band = score === null ? null : ratingBand(score)

  const submit = async () => {
    if (score === null) return
    setSending(true)
    try {
      await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "experiencia",
          message: buildReviewMessage({ score, publishable: consent && comment.trim() !== "", comment }),
          userName: userProfile?.fullName || "",
          userEmail: user?.email || "",
          page: `encuesta rápida${moment ? ` · momento: ${moment}` : ""}`,
          language,
        }),
      })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  const close = () => onFinish(sent ? "answered" : "dismissed")

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        {!sent ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("quick_rating_title")}</DialogTitle>
              <DialogDescription>{t("quick_rating_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={t("quick_rating_title")}>
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={score === n}
                    onClick={() => setScore(n)}
                    className={`h-9 rounded-md border text-sm font-semibold transition-colors ${
                      score === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("quick_rating_low")}</span>
                <span>{t("quick_rating_high")}</span>
              </div>
              {band && (
                <div className="space-y-2">
                  <Label htmlFor="rating-comment" className="text-sm font-medium text-foreground">
                    {t(ASK_BY_BAND[band])}
                  </Label>
                  <Textarea
                    id="rating-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("quick_rating_comment_placeholder")}
                    rows={3}
                  />
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={consent}
                      disabled={comment.trim() === ""}
                      onCheckedChange={(v) => setConsent(v === true)}
                      className="mt-0.5"
                    />
                    <span>{t("quick_rating_consent")}</span>
                  </label>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={close}>
                {t("quick_rating_later")}
              </Button>
              <Button onClick={submit} disabled={score === null || sending}>
                {t("quick_rating_send")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("quick_rating_public_title")}</DialogTitle>
              <DialogDescription>
                {band === "low" ? t("quick_rating_thanks_low") : t("quick_rating_thanks_desc")} {t("quick_rating_public_desc")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={close}>
                {t("quick_rating_later")}
              </Button>
              {GOOGLE_REVIEW_URL && (
                <Button variant="outline" asChild onClick={close}>
                  <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                    {t("quick_rating_google")}
                  </a>
                </Button>
              )}
              <Button asChild onClick={close}>
                <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
                  {t("quick_rating_trustpilot")}
                </a>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
