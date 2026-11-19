"use client"

/**
 * «Regala un mes, gana un mes» a las 3 horas de uso real (pedido del dueño, docs/337). Lo
 * abre components/feedback/feedback-orchestrator.tsx cuando `referralInviteDue` lo permite.
 * «Invitar a un colega» lleva a Mi Plan y abre el tutorial de esa parte (solo los pasos de
 * invitar: `?desde=invita`, MiPlanTour). Siempre con «Ahora no».
 */

import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { GmInvite } from "@/components/icons/gm-icons"
import { REFERRAL } from "@/lib/referrals"
import { tourHref } from "@/lib/tour-links"

/** Tutorial de Mi Plan solo con los pasos de «Regala un mes, gana un mes». */
export const REFERRAL_TOUR_HREF = `${tourHref("mi-plan")}&desde=invita`

export function ReferralInviteDialog({ onFinish }: { onFinish: (status: "answered" | "dismissed") => void }) {
  const { t } = useLanguage()
  const router = useRouter()
  return (
    <Dialog open onOpenChange={(open) => !open && onFinish("dismissed")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GmInvite className="h-5 w-5" />
          </span>
          <DialogTitle>{t("referral_invite_title")}</DialogTitle>
          <DialogDescription>{t("referral_invite_desc").replace("{max}", String(REFERRAL.maxRewardsPerYear))}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="ghost" onClick={() => onFinish("dismissed")}>
            {t("quick_rating_later")}
          </Button>
          <Button
            onClick={() => {
              onFinish("answered")
              router.push(REFERRAL_TOUR_HREF)
            }}
          >
            {t("referral_invite_cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
