"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale, type TranslationKey } from "@/lib/i18n/translations"
import { MousePointerClick } from "lucide-react"

interface ClickData {
  days: number
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
}

/** Clics desde correos (docs/145): qué correos hacen volver a la gente. */
export function EmailClicksPanel() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<ClickData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch("/api/admin/email-clicks")
      .then((res) => res.json())
      .then((json) => (json.error ? setFailed(true) : setData(json)))
      .catch(() => setFailed(true))
  }, [])

  const label = (type: string) => (TYPE_LABEL[type] ? t(TYPE_LABEL[type]) : type)

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
        ) : data.rows.length === 0 ? (
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
                      {r.email} · {label(r.campaign)} · {new Date(r.at).toLocaleString(getDateLocale(language))}
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
