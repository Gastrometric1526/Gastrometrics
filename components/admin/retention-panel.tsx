"use client"

/** /admin → Crecimiento → Retención (docs/195): cuántos vuelven por semana de registro y cuántos están activos. */

import { Users, UserCheck, CalendarDays, CalendarRange, UserPlus, Grid3x3, BarChart3 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import type { RetentionSummary } from "@/lib/admin/retention"
import { AdminCard, DailyBars, ErrorState, KpiCard, KpiGrid, LoadingBlock, formatPercent, useAdminData } from "@/components/admin/ui"

const dm = (ymd: string) => ymd.slice(5).split("-").reverse().join("/")

/** Celda con fondo según el %: un solo tono (primario) más claro u oscuro. */
function HeatCell({ value }: { value: number | null }) {
  const { t } = useLanguage()
  if (value === null) return <td className="px-2 py-2 text-center text-xs text-muted-foreground">{t("admin_ret_not_yet")}</td>
  const alpha = Math.min(1, value / 100)
  return (
    <td className="px-2 py-2 text-center">
      <span
        className="inline-flex min-w-[3.25rem] justify-center rounded-md px-1.5 py-1 text-xs font-medium tabular-nums"
        style={{ backgroundColor: `hsl(var(--primary) / ${0.08 + alpha * 0.55})`, color: alpha > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))" }}
      >
        {formatPercent(value)}
      </span>
    </td>
  )
}

export function RetentionPanel() {
  const { t } = useLanguage()
  const { data, error, loading, reload } = useAdminData<RetentionSummary>("/api/admin/retention")
  if (error && !data) return <ErrorState onRetry={() => reload()} />

  const pctOf = (n: number) => (data && data.totalAccounts > 0 ? `${Math.round((n / data.totalAccounts) * 100)}% ${t("admin_ret_of_accounts")}` : undefined)

  return (
    <div className="space-y-6">
      <KpiGrid cols={6}>
        <KpiCard label={t("admin_ret_total")} icon={Users} loading={loading} value={data?.totalAccounts ?? "—"} help={t("admin_ret_total_help")} />
        <KpiCard label={t("admin_ret_new_7d")} icon={UserPlus} loading={loading} value={data?.newAccounts7d ?? "—"} sub={data ? t("admin_ret_new_30d").replace("{count}", String(data.newAccounts30d)) : undefined} />
        <KpiCard label={t("admin_ret_active_today")} icon={UserCheck} tone="good" loading={loading} value={data?.activeToday ?? "—"} help={t("admin_ret_active_help")} />
        <KpiCard label={t("admin_ret_active_7d")} icon={CalendarDays} loading={loading} value={data?.active7d ?? "—"} sub={data ? pctOf(data.active7d) : undefined} help={t("admin_ret_active_help")} />
        <KpiCard label={t("admin_ret_active_30d")} icon={CalendarRange} loading={loading} value={data?.active30d ?? "—"} sub={data ? pctOf(data.active30d) : undefined} help={t("admin_ret_active_help")} />
        <KpiCard
          label={t("admin_ret_stickiness")}
          help={t("admin_ret_stickiness_help")}
          icon={BarChart3}
          loading={loading}
          value={data && data.active30d > 0 ? formatPercent((data.active7d / data.active30d) * 100) : "—"}
        />
      </KpiGrid>

      <AdminCard title={t("admin_ret_cohorts_title")} icon={Grid3x3} help={t("admin_ret_cohorts_help")} description={t("admin_ret_cohorts_desc")}>
        {loading && !data ? (
          <LoadingBlock rows={6} />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 pb-2 text-left font-medium">{t("admin_ret_col_week")}</th>
                  <th className="px-2 pb-2 text-right font-medium">{t("admin_ret_col_signups")}</th>
                  <th className="px-2 pb-2 text-right font-medium">{t("admin_ret_col_activated")}</th>
                  <th className="px-2 pb-2 text-right font-medium">{t("admin_ret_col_paying")}</th>
                  <th className="px-2 pb-2 text-center font-medium">{t("admin_ret_col_w0")}</th>
                  <th className="px-2 pb-2 text-center font-medium">{t("admin_ret_col_w1")}</th>
                  <th className="px-2 pb-2 text-center font-medium">{t("admin_ret_col_w2")}</th>
                  <th className="px-2 pb-2 text-center font-medium">{t("admin_ret_col_w4")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...(data?.cohorts ?? [])].reverse().map((c) => (
                  <tr key={c.weekStart}>
                    <td className="px-2 py-2 text-foreground whitespace-nowrap">{t("admin_ret_week_of").replace("{date}", dm(c.weekStart))}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{c.size}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{c.size ? `${c.activated} · ${Math.round((c.activated / c.size) * 100)}%` : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{c.size ? c.paying : "—"}</td>
                    {c.size ? (
                      <>
                        <HeatCell value={c.week0} />
                        <HeatCell value={c.week1} />
                        <HeatCell value={c.week2} />
                        <HeatCell value={c.week4} />
                      </>
                    ) : (
                      <td colSpan={4} className="px-2 py-2 text-center text-xs text-muted-foreground">
                        {t("admin_ret_no_signups")}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard title={t("admin_ret_signups_title")} icon={BarChart3} help={t("admin_ret_signups_help")}>
        {loading && !data ? <LoadingBlock rows={4} /> : <DailyBars data={(data?.signupsByWeek ?? []).map((w) => ({ label: w.weekStart, value: w.count }))} labelFormat={dm} />}
      </AdminCard>
    </div>
  )
}
