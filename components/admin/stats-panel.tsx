"use client"

import { useEffect, useState } from "react"
import { AdminCard, BarList, KpiCard, KpiGrid, LoadingBlock, SimpleTable } from "@/components/admin/ui"
import { useLanguage } from "@/contexts/language-context"
import { formatActiveTime } from "@/lib/admin-format"
import { getPlanBySlug } from "@/lib/plans"
import { Building2, Clock, CreditCard, UserCog, Receipt, CalendarClock, Layers, Globe2 } from "lucide-react"
import { formatDate } from "@/lib/date-format"
import { AccountLink } from "@/components/admin/account-link"

export interface AdminStats {
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

/** Estadísticas globales reales (no "este navegador") — pedido explícito del dueño del proyecto, ver docs/63. Rediseñado en docs/71. */
export function StatsPanel({
  feedbackCounts,
  stats: providedStats,
}: {
  feedbackCounts: { total: number; nuevo: number; bug: number }
  /** Si la página ya cargó las estadísticas (docs/191), no se vuelven a pedir. */
  stats?: AdminStats | null
}) {
  const { t, language } = useLanguage()
  const [ownStats, setOwnStats] = useState<AdminStats | null>(null)
  const stats = providedStats !== undefined ? providedStats : ownStats

  useEffect(() => {
    if (providedStats !== undefined) return
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setOwnStats(data)
      })
      .catch((error) => console.error("Error cargando estadísticas:", error))
  }, [providedStats])

  const loading = !stats
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title={t("admin_plan_distribution_title")} icon={Layers} help={t("admin_mrr_disclaimer")}>
          {loading ? (
            <LoadingBlock />
          ) : (
            <BarList rows={stats.planDistribution.map((p) => ({ key: p.slug, label: p.name, value: p.count }))} />
          )}
        </AdminCard>
        <AdminCard title={t("admin_country_distribution_title")} icon={Globe2}>
          {loading ? (
            <LoadingBlock />
          ) : (
            <BarList
              rows={stats.countryDistribution.map((c) => ({ key: c.code, label: c.name ?? t("admin_country_distribution_others"), value: c.count }))}
              empty={t("admin_country_distribution_empty")}
            />
          )}
        </AdminCard>
        <AdminCard title={t("admin_plan_origin_title")} icon={CreditCard} description={t("admin_plan_origin_desc")}>
          {loading ? (
            <LoadingBlock />
          ) : (
            <BarList
              rows={[
                { key: "stripe", label: t("admin_plan_origin_stripe"), value: stats.planOverview.onStripe },
                { key: "manual", label: t("admin_plan_origin_manual"), value: stats.planOverview.manualOverride },
                { key: "free", label: t("admin_plan_origin_free"), value: stats.planOverview.free },
              ]}
            />
          )}
        </AdminCard>
        <AdminCard title={t("admin_team_usage_title")} icon={UserCog} description={t("admin_team_usage_desc")}>
          {loading ? (
            <LoadingBlock />
          ) : (
            <BarList
              rows={[
                { key: "team", label: t("admin_team_usage_with_team"), value: stats.teamUsage.accountsWithTeam },
                { key: "solo", label: t("admin_team_usage_solo"), value: stats.teamUsage.soloAccounts },
              ]}
            />
          )}
        </AdminCard>
      </div>

      <KpiGrid cols={5}>
        <KpiCard label={t("admin_stat_businesses")} icon={Building2} loading={loading} value={stats?.totalBusinesses ?? "—"} />
        <KpiCard label={t("admin_stat_avg_time")} icon={Clock} loading={loading} value={stats ? formatActiveTime(stats.avgActiveSecondsPerUser, t) : "—"} />
        <KpiCard label={t("admin_manual_sales_accounts")} icon={Receipt} loading={loading} value={stats?.manualSalesAdoption.accountsUsingManual ?? "—"} help={t("admin_manual_sales_adoption_desc")} />
        <KpiCard label={t("admin_manual_sales_entries")} icon={Receipt} loading={loading} value={stats?.manualSalesAdoption.totalManualEntries ?? "—"} />
        <KpiCard label={t("admin_manual_sales_pos_accounts")} icon={Receipt} loading={loading} value={stats?.manualSalesAdoption.accountsUsingPos ?? "—"} />
      </KpiGrid>

      <AdminCard title={t("admin_expiring_soon_title")} icon={CalendarClock} description={t("admin_expiring_soon_desc")}>
        {loading ? (
          <LoadingBlock rows={2} />
        ) : (
          <SimpleTable
            columns={[
              { key: "email", label: t("admin_col_account") },
              { key: "plan", label: t("admin_col_plan") },
              { key: "date", label: t("admin_col_date"), align: "right" },
            ]}
            rows={stats.expiringSoon.map((row) => ({
              key: row.email,
              cells: { email: <AccountLink email={row.email} />, plan: getPlanBySlug(row.planSlug).name, date: formatDate(row.expiresAt) },
            }))}
            empty={t("admin_expiring_soon_empty")}
          />
        )}
      </AdminCard>
    </div>
  )
}
