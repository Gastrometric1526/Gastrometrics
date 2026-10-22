"use client"

/**
 * Las reglas de «Regala un mes, gana un mes» (docs/179) en lenguaje llano. Se abre con el
 * botón «?» de /invita y desde la sección de la página de inicio. Los números salen de
 * REFERRAL para que el texto nunca se desfase del código.
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"
import { REFERRAL } from "@/lib/referrals"
import type { TranslationKey } from "@/lib/i18n/translations"

const RULES: TranslationKey[] = [
  "referral_rule_1",
  "referral_rule_2",
  "referral_rule_3",
  "referral_rule_4",
  "referral_rule_5",
  "referral_rule_6",
  "referral_rule_7",
  "referral_rule_8",
]

export function ReferralRulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useLanguage()
  const fill = (text: string) =>
    text
      .replace("{days}", String(REFERRAL.giftDays))
      .replace("{window}", String(REFERRAL.activationWindowDays))
      .replace("{max}", String(REFERRAL.maxRewardsPerYear))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("referral_rules_title")}</DialogTitle>
          <DialogDescription>{t("referral_rules_intro")}</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          {RULES.map((key) => (
            <li key={key}>{fill(t(key))}</li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
