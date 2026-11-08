"use client"

/**
 * Invitación final a la reseña pública (docs/265): sale cuando la persona ya respondió varias
 * preguntas y no queda ninguna. Va igual para todos, sin mirar su nota (docs/173: nunca
 * filtrar quién recibe la invitación), siempre con «Ahora no».
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { GOOGLE_REVIEW_URL, TRUSTPILOT_URL } from "@/lib/site-links"

export function ReviewInviteDialog({ onFinish }: { onFinish: (status: "answered" | "dismissed") => void }) {
  const { t } = useLanguage()
  return (
    <Dialog open onOpenChange={(open) => !open && onFinish("dismissed")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("review_invite_title")}</DialogTitle>
          <DialogDescription>{t("review_invite_desc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={() => onFinish("dismissed")}>
            {t("quick_rating_later")}
          </Button>
          {GOOGLE_REVIEW_URL && (
            <Button variant="outline" asChild onClick={() => onFinish("answered")}>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                {t("quick_rating_google")}
              </a>
            </Button>
          )}
          <Button asChild onClick={() => onFinish("answered")}>
            <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
              {t("quick_rating_trustpilot")}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
