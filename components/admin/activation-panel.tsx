"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { Rocket, Clock3, Timer } from "lucide-react"

interface ActivationAccount {
  email: string
  createdAt: string
  emailConfirmed?: boolean
  firstRecipeAt: string | null
  hoursToActivation: number | null
}

interface ActivationData {
  totalAccounts: number
  activatedAccounts: number
  activationRatePercent: number
  medianHoursToActivation: number | null
  recentAccounts: ActivationAccount[]
  // Tiempo hasta el primer costo (docs/153)
  timeToFirstCost?: {
    reached: number
    reachedPercent: number
    medianMinutes: number | null
    buckets: { bucket: string; accounts: number; paying: number; conversionPercent: number }[]
  }
}

/**
 * Tasa de activación real y tiempo a primer valor (ver docs/96 y
 * referencia-estrategia-crecimiento-y-psicologia-del-usuario.md) — sin esto no había
 * forma de medir si el tour reescrito o el estado vacío del dashboard realmente suben
 * la activación, solo intuición.
 */
export function ActivationPanel() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<ActivationData | null>(null)

  useEffect(() => {
    fetch("/api/admin/activation")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json)
      })
      .catch((error) => console.error("Error cargando activación:", error))
  }, [])

  const formatDuration = (hours: number): string => {
    if (hours >= 48) {
      return t("admin_activation_median_days").replace("{n}", Math.round(hours / 24).toString())
    }
    return t("admin_activation_median_hours").replace("{n}", Math.round(hours).toString())
  }

  const hasData = !!data && data.totalAccounts > 0
  const ttfc = data?.timeToFirstCost
  const formatMinutes = (minutes: number) =>
    minutes < 60 ? t("admin_ttfc_minutes").replace("{n}", String(Math.round(minutes))) : formatDuration(minutes / 60)

  return (
    <div className="space-y-6">
      {/* "Activación" se confundía con confirmar el correo (docs/143): se explica arriba. */}
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t("admin_activation_explainer")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="inline-flex p-2 rounded-lg bg-chart-1/10">
              <Rocket className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("admin_activation_rate_label")}
              </p>
              {data ? (
                <p className="text-2xl font-bold text-foreground">
                  {data.activationRatePercent}%{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({data.activatedAccounts}/{data.totalAccounts})
                  </span>
                </p>
              ) : (
                <Skeleton className="h-8 w-24 mt-1" />
              )}
              <p className="text-xs text-muted-foreground mt-1">{t("admin_activation_rate_desc")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="inline-flex p-2 rounded-lg bg-chart-2/10">
              <Clock3 className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("admin_activation_median_time_label")}
              </p>
              {data ? (
                <p className="text-2xl font-bold text-foreground">
                  {data.medianHoursToActivation !== null
                    ? formatDuration(data.medianHoursToActivation)
                    : t("admin_activation_median_time_empty")}
                </p>
              ) : (
                <Skeleton className="h-8 w-24 mt-1" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {ttfc && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              {t("admin_ttfc_title")}
            </CardTitle>
            <CardDescription>{t("admin_ttfc_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">
              {t("admin_ttfc_reached").replace("{pct}", String(ttfc.reachedPercent))}
              {ttfc.medianMinutes !== null && <> · {t("admin_ttfc_median").replace("{time}", formatMinutes(ttfc.medianMinutes))}</>}
            </p>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin_ttfc_bucket")}</TableHead>
                    <TableHead className="text-right">{t("admin_ttfc_accounts")}</TableHead>
                    <TableHead className="text-right">{t("admin_ttfc_paying")}</TableHead>
                    <TableHead className="text-right">{t("admin_ttfc_conversion")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ttfc.buckets.map((row) => (
                    <TableRow key={row.bucket}>
                      <TableCell className="text-foreground">{t(`admin_ttfc_${row.bucket}` as Parameters<typeof t>[0])}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.accounts}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.paying}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.accounts ? `${row.conversionPercent}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_activation_table_title")}</CardTitle>
          <CardDescription>{t("admin_activation_rate_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="py-12 text-center text-muted-foreground">
              {data ? t("admin_activation_empty") : <Skeleton className="h-4 w-48 mx-auto" />}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin_activation_table_email")}</TableHead>
                    <TableHead>{t("admin_activation_table_created")}</TableHead>
                    <TableHead>{t("admin_activation_table_email_confirmed")}</TableHead>
                    <TableHead>{t("admin_activation_table_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.recentAccounts.map((account) => (
                    <TableRow key={account.email + account.createdAt}>
                      <TableCell className="text-foreground">{account.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(account.createdAt).toLocaleDateString(getDateLocale(language))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.emailConfirmed ? t("admin_activation_confirmed_yes") : t("admin_activation_confirmed_no")}
                      </TableCell>
                      <TableCell>
                        {account.hoursToActivation !== null ? (
                          <Badge variant="outline" className="bg-success-soft text-success border-transparent">
                            {t("admin_activation_status_activated").replace("{time}", formatDuration(account.hoursToActivation))}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t("admin_activation_status_pending")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
