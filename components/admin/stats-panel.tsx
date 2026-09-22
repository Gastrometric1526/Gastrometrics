"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/dashboard"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { formatActiveTime } from "@/lib/admin-format"
import { getPlanBySlug } from "@/lib/plans"
import { Users, Building2, MailWarning, Bug, Clock, CreditCard, UserCog, Receipt, CalendarClock } from "lucide-react"

interface Stats {
  totalUsers: number
  totalBusinesses: number
  totalTeamMembers: number
  planDistribution: { slug: string; name: string; count: number }[]
  estimatedMrrUsdCents: number
  countryDistribution: { code: string; name: string | null; count: number }[]
  avgActiveSecondsPerUser: number
  planOverview: { onStripe: number; manualOverride: number; free: number }
  expiringSoon: { email: string; planSlug: string; expiresAt: string }[]
  teamUsage: { accountsWithTeam: number; soloAccounts: number }
  manualSalesAdoption: { accountsUsingManual: number; totalManualEntries: number; accountsUsingPos: number }
}

// Mismo patrón visual que las tarjetas de estadística de app/dashboard/page.tsx (chip de
// ícono con tinte de color, usando los tokens --chart-* ya definidos en globals.css) —
// antes esta pestaña solo mostraba números planos, sin nada visual que los distinga.
const STAT_CARDS = [
  { key: "totalUsers" as const, labelKey: "admin_stat_users" as const, icon: Users, bg: "bg-chart-1/10", text: "text-chart-1" },
  { key: "totalBusinesses" as const, labelKey: "admin_stat_businesses" as const, icon: Building2, bg: "bg-chart-2/10", text: "text-chart-2" },
  { key: "unread" as const, labelKey: "admin_stat_unread" as const, icon: MailWarning, bg: "bg-chart-4/10", text: "text-chart-4" },
  { key: "bugs" as const, labelKey: "admin_stat_bugs" as const, icon: Bug, bg: "bg-chart-7/10", text: "text-chart-7" },
]

const PLAN_BAR_COLORS: Array<"blue" | "green" | "amber" | "red"> = ["blue", "green", "amber", "red"]
const COUNTRY_BAR_COLORS: Array<"blue" | "green" | "amber" | "red"> = ["blue", "green", "amber", "red"]

/** Estadísticas globales reales (no "este navegador") — pedido explícito del dueño del proyecto, ver docs/63. Rediseñado en docs/71. */
export function StatsPanel({ feedbackCounts }: { feedbackCounts: { total: number; nuevo: number; bug: number } }) {
  const { t, language } = useLanguage()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data)
      })
      .catch((error) => console.error("Error cargando estadísticas:", error))
  }, [])

  const mrr = stats
    ? (stats.estimatedMrrUsdCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—"
  const maxPlanCount = stats ? Math.max(1, ...stats.planDistribution.map((p) => p.count)) : 1
  const maxCountryCount = stats ? Math.max(1, ...stats.countryDistribution.map((c) => c.count)) : 1
  const values: Record<string, number> = {
    totalUsers: stats?.totalUsers ?? 0,
    totalBusinesses: stats?.totalBusinesses ?? 0,
    unread: feedbackCounts.nuevo,
    bugs: feedbackCounts.bug,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.key}>
            <CardContent className="p-4 space-y-3">
              <div className={`inline-flex p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.text}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(card.labelKey)}</p>
                {stats ? (
                  <p className="text-2xl font-bold text-foreground">{values[card.key]}</p>
                ) : (
                  <Skeleton className="h-8 w-12 mt-1" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="inline-flex p-2 rounded-lg bg-chart-3/10">
              <Clock className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("admin_stat_avg_time")}</p>
              {stats ? (
                <p className="text-2xl font-bold text-foreground">{formatActiveTime(stats.avgActiveSecondsPerUser, t)}</p>
              ) : (
                <Skeleton className="h-8 w-12 mt-1" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_plan_distribution_title")}</CardTitle>
          <CardDescription>
            {t("admin_stat_mrr")}: <span className="font-semibold text-foreground">{mrr}</span>
            <br />
            <span className="text-xs">{t("admin_mrr_disclaimer")}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-3">
              {stats.planDistribution.map((p, index) => (
                <div key={p.slug} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.count}</span>
                  </div>
                  <ProgressBar
                    value={(p.count / maxPlanCount) * 100}
                    color={PLAN_BAR_COLORS[index % PLAN_BAR_COLORS.length]}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_country_distribution_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            stats.countryDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("admin_country_distribution_empty")}</p>
            ) : (
              <div className="space-y-3">
                {stats.countryDistribution.map((c, index) => (
                  <div key={c.code} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">
                        {c.name ?? t("admin_country_distribution_others")}
                      </span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </div>
                    <ProgressBar
                      value={(c.count / maxCountryCount) * 100}
                      color={COUNTRY_BAR_COLORS[index % COUNTRY_BAR_COLORS.length]}
                    />
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("admin_plan_origin_title")}
            </CardTitle>
            <CardDescription>{t("admin_plan_origin_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-3">
                {(
                  [
                    ["onStripe", "admin_plan_origin_stripe", "green"],
                    ["manualOverride", "admin_plan_origin_manual", "amber"],
                    ["free", "admin_plan_origin_free", "blue"],
                  ] as const
                ).map(([key, labelKey, color]) => {
                  const value = stats.planOverview[key]
                  const max = Math.max(1, stats.planOverview.onStripe, stats.planOverview.manualOverride, stats.planOverview.free)
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{t(labelKey)}</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                      <ProgressBar value={(value / max) * 100} color={color} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              {t("admin_team_usage_title")}
            </CardTitle>
            <CardDescription>{t("admin_team_usage_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="space-y-3">
                {(
                  [
                    ["accountsWithTeam", "admin_team_usage_with_team", "green"],
                    ["soloAccounts", "admin_team_usage_solo", "blue"],
                  ] as const
                ).map(([key, labelKey, color]) => {
                  const value = stats.teamUsage[key]
                  const max = Math.max(1, stats.teamUsage.accountsWithTeam, stats.teamUsage.soloAccounts)
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{t(labelKey)}</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                      <ProgressBar value={(value / max) * 100} color={color} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              {t("admin_manual_sales_adoption_title")}
            </CardTitle>
            <CardDescription>{t("admin_manual_sales_adoption_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.manualSalesAdoption.accountsUsingManual}</p>
                  <p className="text-xs text-muted-foreground">{t("admin_manual_sales_accounts")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.manualSalesAdoption.totalManualEntries}</p>
                  <p className="text-xs text-muted-foreground">{t("admin_manual_sales_entries")}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.manualSalesAdoption.accountsUsingPos}</p>
                  <p className="text-xs text-muted-foreground">{t("admin_manual_sales_pos_accounts")}</p>
                </div>
              </div>
            ) : (
              <Skeleton className="h-14 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {t("admin_expiring_soon_title")}
            </CardTitle>
            <CardDescription>{t("admin_expiring_soon_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="h-14 w-full" />
            ) : stats.expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">{t("admin_expiring_soon_empty")}</p>
            ) : (
              <div className="space-y-2">
                {stats.expiringSoon.map((row) => (
                  <div key={row.email} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">{row.email}</p>
                      <p className="text-xs text-muted-foreground">{getPlanBySlug(row.planSlug).name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.expiresAt).toLocaleDateString(getDateLocale(language))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
