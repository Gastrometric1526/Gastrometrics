"use client"

/**
 * «Regala un mes, gana un mes» (docs/179) como sección de Mi Plan (unificada en docs/181):
 * tu enlace con tres botones para compartirlo, lo que llevas ganado y a quién invitaste.
 * Las reglas completas viven en el botón «?» (ReferralRulesDialog).
 */

import { useState } from "react"
import { Copy, Check, Gift, Mail, MessageCircle, HelpCircle, Clock, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ReferralRulesDialog } from "@/components/referral-rules-dialog"
import { useLanguage } from "@/contexts/language-context"
import { formatDate } from "@/lib/date-format"
import type { PlanTimeline } from "@/lib/plan-timeline"
import type { TranslationKey } from "@/lib/i18n/translations"

type Invite = { name: string; status: "registered" | "active" | "rewarded" | "expired"; registeredAt: string; day: number; daysLeft: number }
export type ReferralOverview = {
  code: string
  link: string
  invites: Invite[]
  rewardsEarned: number
  rewardsThisYear: number
  maxRewardsPerYear: number
  bankDays: number
  planSlug: string
  timeline: PlanTimeline
}

const STATUS_KEY: Record<Invite["status"], TranslationKey> = {
  registered: "invita_status_registered",
  active: "invita_status_active",
  rewarded: "invita_status_rewarded",
  expired: "invita_status_expired",
}

export function ReferralSection({ data, failed }: { data: ReferralOverview | null; failed: boolean }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  const shareText = data ? t("invita_share_message").replace("{link}", data.link) : ""
  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* el campo de texto sigue ahí para copiarlo a mano */
    }
  }
  const remindUrl = (name: string) =>
    `https://wa.me/?text=${encodeURIComponent(t("invita_remind_message").replace("{name}", name).replace("{link}", data?.link || ""))}`
  const capReached = data ? data.rewardsThisYear >= data.maxRewardsPerYear : false

  return (
    <section id="invita" className="scroll-mt-24 space-y-6">
      <ReferralRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />

      <div data-tour="invita-header" className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("invita_title")}</h2>
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label={t("invita_rules_button")}
            data-tour="invita-rules"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-text-3">{t("invita_subtitle")}</p>
      </div>

      {/* Los dos lados del trato, en una línea cada uno. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">{t("invita_you_get_title")}</p>
          <p className="text-sm text-muted-foreground">{t("invita_you_get_desc")}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground">{t("invita_they_get_title")}</p>
          <p className="text-sm text-muted-foreground">{t("invita_they_get_desc")}</p>
        </div>
      </div>

      <div data-tour="invita-link" className="space-y-3 rounded-xl border border-border bg-canvas-alt p-4 md:p-5">
        <p className="font-semibold text-foreground">{t("invita_link_label")}</p>
        {failed ? (
          <p className="text-sm text-destructive">{t("invita_load_error")}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input readOnly value={data?.link || "…"} onFocus={(e) => e.currentTarget.select()} className="bg-background" />
              <Button onClick={copy} disabled={!data} className="shrink-0 gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t("invita_copied") : t("invita_copy")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-2" disabled={!data}>
                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {t("invita_share_whatsapp")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2" disabled={!data}>
                <a href={`mailto:?subject=${encodeURIComponent(t("invita_share_subject"))}&body=${encodeURIComponent(shareText)}`}>
                  <Mail className="h-4 w-4" />
                  {t("invita_share_email")}
                </a>
              </Button>
            </div>
          </>
        )}
      </div>

      {data && (
        <div data-tour="invita-rewards" className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-sm text-muted-foreground">
              <span className="text-2xl font-semibold text-foreground">{data.rewardsEarned}</span> {t("invita_rewards_earned")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("invita_rewards_year").replace("{n}", String(data.rewardsThisYear)).replace("{max}", String(data.maxRewardsPerYear))}
            </p>
          </div>
          {capReached && <p className="text-sm text-amber-700 dark:text-amber-400">{t("invita_cap_reached")}</p>}
        </div>
      )}

      <div data-tour="invita-list" className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">{t("invita_list_title")}</h3>
        {data && data.invites.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="h-4 w-4" />
            {t("invita_list_empty")}
          </p>
        )}
        <ul className="divide-y divide-border">
          {data?.invites.map((invite, index) => (
            <li key={`${invite.registeredAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{invite.name || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {t("invita_registered_on").replace("{date}", formatDate(invite.registeredAt))}
                  {invite.status === "registered" && ` · ${t("invita_days_left").replace("{n}", String(invite.daysLeft))}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={invite.status === "rewarded" ? "default" : "secondary"} className="gap-1">
                  {invite.status === "rewarded" || invite.status === "active" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : invite.status === "expired" ? (
                    <XCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {t(STATUS_KEY[invite.status])}
                </Badge>
                {invite.status === "registered" && (
                  <Button asChild variant="ghost" size="sm" className="gap-1">
                    <a href={remindUrl(invite.name)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      {t("invita_remind")}
                    </a>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={() => setRulesOpen(true)} className="text-sm text-text-3 underline underline-offset-4 hover:text-foreground">
        {t("invita_rules_link")}
      </button>
    </section>
  )
}
