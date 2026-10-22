"use client"

/**
 * «Tu plan» (docs/180): cuándo vence, cuál es el siguiente cobro y desde/hasta cuándo
 * corren los meses ganados por invitar. Arriba de Mi Plan, sobre la sección de invitar
 * (docs/181).
 */

import { CalendarClock, CreditCard, Gift, PiggyBank, CheckCircle2, AlertTriangle } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { formatDate } from "@/lib/date-format"
import { getPlanBySlug } from "@/lib/plans"
import type { PlanTimeline } from "@/lib/plan-timeline"
import type { PaymentRecord } from "@/lib/payment-notice"
import { formatMoney } from "@/components/payment-notice-dialog"

const price = (slug: string | null) => {
  const cents = getPlanBySlug(slug).priceUsdCents
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
}

function Row({ icon: Icon, children }: { icon: typeof CalendarClock; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-4" />
      <span className="text-sm text-foreground">{children}</span>
    </li>
  )
}

export function PlanTimelineCard({
  planSlug,
  timeline,
  bankDays,
  payments = [],
}: {
  planSlug: string
  timeline: PlanTimeline
  bankDays: number
  payments?: PaymentRecord[]
}) {
  const { t } = useLanguage()
  const plan = getPlanBySlug(planSlug)
  const month = t("plan_timeline_per_month")

  return (
    <section data-tour="plan-timeline" className="rounded-xl border border-hairline p-4 md:p-5 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">{t("plan_timeline_title")}</p>
        <p className="text-sm text-text-3">{plan.name}</p>
      </div>
      <ul className="divide-y divide-hairline">
        {timeline.kind === "free" && <Row icon={CreditCard}>{t("plan_timeline_free")}</Row>}
        {timeline.kind === "no_end" && <Row icon={CreditCard}>{t("plan_timeline_no_end")}</Row>}

        {timeline.kind === "paid" && (
          <>
            <Row icon={CreditCard}>
              {timeline.nextChargeAt
                ? t("plan_timeline_next_charge")
                    .replace("{date}", formatDate(timeline.nextChargeAt))
                    .replace("{price}", `${price(planSlug)} ${month}`)
                : t("plan_timeline_paid_renews")}
            </Row>
            <Row icon={Gift}>{t("plan_timeline_paid_credit_note")}</Row>
          </>
        )}

        {timeline.kind === "paid_ending" && (
          <Row icon={CalendarClock}>
            {timeline.endsAt ? t("plan_timeline_paid_ending").replace("{date}", formatDate(timeline.endsAt)) : t("plan_timeline_paid_ending_no_date")}
          </Row>
        )}

        {timeline.kind === "timed" && (
          <>
            <Row icon={CalendarClock}>
              {t("plan_timeline_ends").replace("{plan}", plan.name).replace("{date}", formatDate(timeline.endsAt))}
            </Row>
            {timeline.bankEndsAt && (
              <Row icon={PiggyBank}>
                {t("plan_timeline_bank")
                  .replace("{days}", String(bankDays))
                  .replace("{from}", formatDate(timeline.endsAt))
                  .replace("{to}", formatDate(timeline.bankEndsAt))}
              </Row>
            )}
            {timeline.nextChargeAt ? (
              <Row icon={CreditCard}>
                {t("plan_timeline_next_charge_plan")
                  .replace("{date}", formatDate(timeline.nextChargeAt))
                  .replace("{plan}", getPlanBySlug(timeline.nextChargePlanSlug).name)
                  .replace("{price}", `${price(timeline.nextChargePlanSlug)} ${month}`)}
              </Row>
            ) : (
              <Row icon={CreditCard}>{t("plan_timeline_no_charge").replace("{date}", formatDate(timeline.thenFoodieAt))}</Row>
            )}
          </>
        )}
      </ul>
      {/* Cobros confirmados (docs/183): hechos o fallidos, con la factura. */}
      {payments.length > 0 && (
        <div className="space-y-1.5 border-t border-hairline pt-3" data-tour="plan-payments">
          <p className="text-xs font-medium text-text-4">{t("plan_timeline_payments_title")}</p>
          <ul className="space-y-1">
            {payments.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-x-2 text-sm">
                {p.status === "paid" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span className="text-foreground tabular-nums">{formatDate(p.at)}</span>
                <span className="text-text-3">
                  {p.status === "paid"
                    ? t("plan_timeline_payment_paid").replace("{amount}", formatMoney(p.amountCents, p.currency))
                    : t("plan_timeline_payment_failed")}
                </span>
                {p.invoiceUrl && (
                  <a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-text-3 underline underline-offset-2 hover:text-foreground">
                    {t("payment_notice_invoice")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
