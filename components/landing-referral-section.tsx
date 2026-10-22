"use client"

/** Sección de la página de inicio sobre «Regala un mes, gana un mes» (docs/179): tres pasos y las reglas. */

import { useState } from "react"
import Link from "next/link"
import { Gift, Share2, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReferralRulesDialog } from "@/components/referral-rules-dialog"
import { useLanguage } from "@/contexts/language-context"

export function LandingReferralSection() {
  const { t } = useLanguage()
  const [rulesOpen, setRulesOpen] = useState(false)
  const steps = [
    { icon: Share2, title: t("landing_referral_step1_title"), desc: t("landing_referral_step1_desc") },
    { icon: Gift, title: t("landing_referral_step2_title"), desc: t("landing_referral_step2_desc") },
    { icon: Sparkles, title: t("landing_referral_step3_title"), desc: t("landing_referral_step3_desc") },
  ]
  return (
    <section className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-20">
      <ReferralRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      <div className="rounded-2xl border border-hairline bg-canvas-alt px-6 py-8 md:px-10 md:py-10 space-y-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-foreground leading-[1.15]">{t("landing_referral_title")}</h2>
          <p className="text-text-3">{t("landing_referral_desc")}</p>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.title} className="space-y-2">
              <step.icon className="h-5 w-5 text-text-3" />
              <p className="font-semibold text-foreground">{step.title}</p>
              <p className="text-sm text-text-3">{step.desc}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild className="gap-2">
            <Link href="/signup">
              {t("landing_referral_cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <button type="button" onClick={() => setRulesOpen(true)} className="text-sm text-text-3 underline underline-offset-4 hover:text-foreground">
            {t("landing_referral_rules")}
          </button>
        </div>
      </div>
    </section>
  )
}
