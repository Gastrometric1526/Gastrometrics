"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import { formatDate } from "@/lib/date-format"
import { Gift } from "lucide-react"
import type { TranslationKey } from "@/lib/i18n/translations"
import { useAdminTick } from "@/components/admin/live"

interface Row {
  referrer: string | null
  invitee: string | null
  status: string
  registeredAt: string
  day: number
  activatedAt: string | null
}

const STATUS_KEY: Record<string, TranslationKey> = {
  registered: "invita_status_registered",
  active: "invita_status_active",
  rewarded: "invita_status_rewarded",
  expired: "invita_status_expired",
}

/** Referidos (docs/179): quién invitó a quién, en qué día de su ventana va y si ya activó. */
export function ReferralsPanel() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

  // En vivo (docs/192): se vuelve a cargar en cada actualización automática.
  const tick = useAdminTick()
  useEffect(() => {
    fetch("/api/admin/referrals")
      .then((res) => res.json())
      .then((json) => (json.error ? setFailed(true) : setRows(json.referrals || [])))
      .catch(() => setFailed(true))
  }, [tick])

  const count = (status: string) => rows?.filter((r) => r.status === status).length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          {t("admin_referrals_title")}
        </CardTitle>
        <CardDescription>{t("admin_referrals_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failed && <p className="text-sm text-destructive">{t("invita_load_error")}</p>}
        {rows && (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{t("admin_referrals_total").replace("{n}", String(rows.length))}</span>
              {(["registered", "active", "rewarded", "expired"] as const).map((s) => (
                <span key={s}>
                  {t(STATUS_KEY[s])}: <span className="font-semibold text-foreground tabular-nums">{count(s)}</span>
                </span>
              ))}
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin_referrals_empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">{t("admin_referrals_col_referrer")}</th>
                      <th className="py-2 pr-4 font-medium">{t("admin_referrals_col_invitee")}</th>
                      <th className="py-2 pr-4 font-medium">{t("admin_referrals_col_registered")}</th>
                      <th className="py-2 pr-4 font-medium">{t("admin_referrals_col_day")}</th>
                      <th className="py-2 font-medium">{t("admin_referrals_col_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, i) => (
                      <tr key={`${row.invitee}-${i}`}>
                        <td className="py-2 pr-4">{row.referrer || "—"}</td>
                        <td className="py-2 pr-4">{row.invitee || "—"}</td>
                        <td className="py-2 pr-4 tabular-nums">{formatDate(row.registeredAt)}</td>
                        <td className="py-2 pr-4 tabular-nums">{row.day}</td>
                        <td className="py-2">
                          <Badge variant="secondary">{STATUS_KEY[row.status] ? t(STATUS_KEY[row.status]) : row.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
