"use client"

/**
 * «Regala un mes, gana un mes» en la página de inicio (docs/179). Desde docs/288 es una sola
 * franja (antes una sección con 3 pasos y su propio botón): la página tiene un solo llamado a
 * la acción y esto le importa sobre todo a quien ya usa la app. Las reglas siguen a un toque.
 */

import { useState } from "react"
import { Gift } from "lucide-react"
import { ReferralRulesDialog } from "@/components/referral-rules-dialog"
import { useLanguage } from "@/contexts/language-context"

export function LandingReferralSection() {
  const { t } = useLanguage()
  const [rulesOpen, setRulesOpen] = useState(false)
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-6">
      <ReferralRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-canvas-alt px-5 py-4 sm:flex-row sm:items-center">
        <Gift className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-text-3">
          <span className="font-semibold text-foreground">{t("landing_referral_title")}.</span> {t("landing_referral_desc")}
        </p>
        <button type="button" onClick={() => setRulesOpen(true)} className="shrink-0 text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary">
          {t("landing_referral_rules")}
        </button>
      </div>
    </section>
  )
}
