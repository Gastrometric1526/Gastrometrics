"use client"

import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getPlanBySlug } from "@/lib/plans"
import { EMAIL_DATE_LOCALES, normalizeEmailLang } from "@/lib/i18n/email-labels"

interface PlanChangeNotice {
  fromPlanSlug: string
  toPlanSlug: string
  amountCents: number | null
  nextChargeAt: string | null
  expiresAt: string | null
  source: string | null
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

/**
 * Popup de "tu plan cambió" que aparece una sola vez en el dashboard, la primera vez
 * que carga después de un cambio real de plan — ya sea de verdad por Stripe (pago
 * propio o desde el Portal de Cliente) o asignado a mano desde /admin (docs/89). El
 * mismo cambio también se manda por correo (lib/services/notify-billing.ts) — este
 * componente es la mitad "en la app" de ese mismo aviso, no un sistema aparte.
 */
export function PlanChangeNoticeDialog() {
  const { isLoggedIn } = useAuth()
  const { t, language } = useLanguage()
  const [notice, setNotice] = useState<PlanChangeNotice | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    fetch("/api/plan/change-notice")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.notice) setNotice(data.notice)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  if (!notice) return null

  const fromPlan = getPlanBySlug(notice.fromPlanSlug)
  const toPlan = getPlanBySlug(notice.toPlanSlug)
  const locale = EMAIL_DATE_LOCALES[normalizeEmailLang(language)]
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })

  const handleClose = () => {
    setNotice(null)
    fetch("/api/plan/change-notice", { method: "POST" }).catch(() => {})
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("plan_change_notice_title")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span>{fromPlan.name}</span>
                <span aria-hidden="true">&rarr;</span>
                <span>{toPlan.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">{t("plan_change_notice_charged_label")}</span>
                <span className="font-medium text-foreground">
                  {notice.amountCents != null ? formatUsd(notice.amountCents) : t("plan_change_notice_no_charge")}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">
                  {notice.expiresAt ? t("plan_change_notice_expires_label") : t("plan_change_notice_next_charge_label")}
                </span>
                <span className="font-medium text-foreground">
                  {notice.expiresAt
                    ? formatDate(notice.expiresAt)
                    : notice.nextChargeAt
                      ? formatDate(notice.nextChargeAt)
                      : t("plan_change_notice_no_expiry")}
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleClose}>{t("plan_change_notice_close")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
