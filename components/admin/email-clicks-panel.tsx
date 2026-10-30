"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { type TranslationKey } from "@/lib/i18n/translations"
import { MousePointerClick, UserCheck, Moon, Repeat, CalendarDays } from "lucide-react"
import { KpiCard, KpiGrid } from "@/components/admin/ui"
import type { EmailReturnsSummary } from "@/lib/email-returns"
import { formatDateTime } from "@/lib/date-format"
import { useAdminTick } from "@/components/admin/live"
import { AccountLink } from "@/components/admin/account-link"

interface ClickData {
  days: number
  summary?: EmailReturnsSummary
  rows: { type: string; sent: number | null; clickedAccounts: number; ratePercent: number | null }[]
  recent: { email: string; campaign: string; at: string }[]
}

// Nombre legible de cada correo automático (los tipos internos no se muestran crudos).
const TYPE_LABEL: Record<string, TranslationKey> = {
  first_recipe_reminder: "admin_email_type_first_recipe_reminder",
  day7_margin_checkin: "admin_email_type_day7_margin_checkin",
  first_sale_reinforcement: "admin_email_type_first_sale_reinforcement",
  four_hour_experience: "admin_email_type_four_hour_experience",
  unfinished_recipe: "admin_email_type_unfinished_recipe",
  inventory_count: "admin_email_type_inventory_count",
  review_reports: "admin_email_type_review_reports",
  update_prices: "admin_email_type_update_prices",
  we_miss_you: "admin_email_type_we_miss_you",
  weekly_summary: "admin_email_type_weekly_summary",
  low_stock: "admin_email_type_low_stock",
  margin_alert: "admin_email_type_margin_alert",
  unused_feature: "admin_email_type_unused_feature",
  milestone: "admin_email_type_milestone",
  invite_pending: "admin_email_type_invite_pending",
  empty_business: "admin_email_type_empty_business",
  product_update: "admin_email_type_product_update",
  plan_changed: "admin_email_type_plan_changed",
  plan_expiry: "admin_email_type_plan_expiry",
  legal_update_notice: "admin_email_type_legal_update_notice",
  support_reply: "admin_email_type_support_reply",
}

// Tipos con variantes (docs/210): «payment_paid», «referral_gift_…», «plan_expiry_today_referral»…
const TYPE_PREFIX_LABEL: [string, TranslationKey][] = [
  ["plan_expiry", "admin_email_type_plan_expiry"],
  ["payment_", "admin_email_type_payment"],
  ["referral_", "admin_email_type_referral"],
  ["product_update", "admin_email_type_product_update"],
]

/** Clics desde correos (docs/145): qué correos hacen volver a la gente. */
export function EmailClicksPanel() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<ClickData | null>(null)
  const [failed, setFailed] = useState(false)

  // En vivo (docs/192): se vuelve a cargar en cada actualización automática.
  const tick = useAdminTick()
  useEffect(() => {
    fetch("/api/admin/email-clicks")
      .then((res) => res.json())
      .then((json) => (json.error ? setFailed(true) : setData(json)))
      .catch(() => setFailed(true))
  }, [tick])

  const label = (type: string) => {
    const key = TYPE_LABEL[type] ?? TYPE_PREFIX_LABEL.find(([prefix]) => type.startsWith(prefix))?.[1]
    return key ? t(key) : type
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MousePointerClick className="h-5 w-5 text-primary" />
          {t("admin_email_clicks_title")}
        </CardTitle>
        <CardDescription>{t("admin_email_clicks_desc").replace("{days}", String(data?.days ?? 90))}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {failed ? (
          <p className="text-sm text-muted-foreground">{t("admin_email_clicks_error")}</p>
        ) : !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          data.summary && <ReturnsSummary summary={data.summary} days={data.days} />
        )}
        {failed || !data ? null : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin_email_clicks_empty")}</p>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin_email_clicks_col_email")}</TableHead>
                    <TableHead className="text-right">{t("admin_email_clicks_col_sent")}</TableHead>
                    <TableHead className="text-right">{t("admin_email_clicks_col_clicked")}</TableHead>
                    <TableHead className="text-right">{t("admin_email_clicks_col_rate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.type}>
                      <TableCell className="font-medium text-foreground">{label(r.type)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.sent ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.clickedAccounts}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.ratePercent === null ? "—" : `${r.ratePercent}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.recent.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">{t("admin_email_clicks_recent")}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {data.recent.map((r, i) => (
                    <li key={i}>
                      <AccountLink email={r.email} /> · {label(r.campaign)} · {formatDateTime(r.at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">{t("admin_email_clicks_footnote")}</p>
      </CardContent>
    </Card>
  )
}

/** Resumen de docs/210: cuántas personas distintas volvieron por los correos. */
function ReturnsSummary({ summary, days }: { summary: EmailReturnsSummary; days: number }) {
  const { t } = useLanguage()
  const percent = summary.returnedPercent === null ? "—" : `${summary.returnedPercent}%`
  return (
    <KpiGrid cols={4}>
      <KpiCard
        label={t("admin_email_returns_returned")}
        help={t("admin_email_returns_returned_help").replace("{days}", String(days))}
        icon={UserCheck}
        tone="good"
        value={summary.returned}
        sub={t("admin_email_returns_of_recipients").replace("{count}", String(summary.recipients)).replace("{percent}", percent)}
      />
      <KpiCard label={t("admin_email_returns_inactive")} icon={Moon} value={summary.wereInactive} sub={t("admin_email_returns_inactive_sub")} />
      <KpiCard label={t("admin_email_returns_kept")} icon={Repeat} value={summary.keptUsing} sub={t("admin_email_returns_kept_sub")} />
      <KpiCard
        label={t("admin_email_returns_recent")}
        icon={CalendarDays}
        value={summary.last7Days}
        sub={t("admin_email_returns_recent_sub").replace("{count}", String(summary.last30Days))}
      />
    </KpiGrid>
  )
}
