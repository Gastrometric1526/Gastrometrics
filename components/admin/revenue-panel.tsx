"use client"

/** /admin → Ingresos (docs/195): lo que Stripe cobró de verdad, MRR real, cancelaciones y cobros fallidos. */

import { DollarSign, Repeat, CalendarDays, UserMinus, AlertOctagon, UserPlus, BarChart3, Layers, CreditCard, LogOut } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { getPlanBySlug } from "@/lib/plans"
import { formatDate, formatDateTime } from "@/lib/date-format"
import type { RevenueSummary } from "@/lib/admin/revenue"
import { AdminCard, BarList, DailyBars, ErrorState, KpiCard, KpiGrid, LoadingBlock, SimpleTable, StatusPill, formatMoney, formatPercent, percentChange, useAdminData } from "@/components/admin/ui"
import { AccountLink } from "@/components/admin/account-link"

type RevenueResponse = RevenueSummary & { mode: "live" | "test"; checkedAt: string; configured?: boolean }

const planName = (slug: string | null) => (slug && slug !== "?" ? getPlanBySlug(slug)?.name || slug : "—")

export function RevenuePanel({ estimatedMrrUsdCents }: { estimatedMrrUsdCents?: number }) {
  const { t } = useLanguage()
  const { data, error, loading, reload } = useAdminData<RevenueResponse>("/api/admin/revenue")

  if (error && !data) return <ErrorState onRetry={() => reload(true)} />
  if (data && data.configured === false) return <p className="text-sm text-muted-foreground">{t("admin_rev_not_configured")}</p>
  const money = (n: number) => formatMoney(n, data?.currency)

  return (
    <div className="space-y-6">
      {data?.mode === "test" && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">{t("admin_rev_test_mode")}</p>}

      <KpiGrid cols={6}>
        <KpiCard
          label={t("admin_rev_mrr")}
          help={t("admin_rev_mrr_help")}
          icon={Repeat}
          loading={loading}
          value={data ? money(data.mrr) : "—"}
          sub={data ? t("admin_rev_active_subs").replace("{count}", String(data.activeSubscriptions)) : undefined}
        />
        <KpiCard
          label={t("admin_rev_collected_30d")}
          help={t("admin_rev_collected_30d_help")}
          icon={DollarSign}
          tone="good"
          loading={loading}
          value={data ? money(data.collected30d) : "—"}
          change={data ? percentChange(data.collected30d, data.collectedPrev30d) : undefined}
          changeLabel={t("admin_rev_vs_prev_30d")}
        />
        <KpiCard
          label={t("admin_rev_this_month")}
          help={t("admin_rev_this_month_help")}
          icon={CalendarDays}
          loading={loading}
          value={data ? money(data.collectedThisMonth) : "—"}
          sub={data ? t("admin_rev_paid_invoices").replace("{count}", String(data.paidInvoices30d)) : undefined}
        />
        <KpiCard
          label={t("admin_rev_new_subs")}
          help={t("admin_rev_new_subs_help")}
          icon={UserPlus}
          loading={loading}
          value={data ? data.newSubscriptions30d : "—"}
          sub={data && data.trialingSubscriptions > 0 ? t("admin_rev_trialing").replace("{count}", String(data.trialingSubscriptions)) : undefined}
        />
        <KpiCard
          label={t("admin_rev_cancellations")}
          help={t("admin_rev_cancellations_help")}
          icon={UserMinus}
          tone={data && data.cancellations30d.length > 0 ? "warn" : "default"}
          loading={loading}
          value={data ? data.cancellations30d.length : "—"}
          sub={data ? `${t("admin_rev_churn")}: ${formatPercent(data.churnRate30d, 1)}` : undefined}
        />
        <KpiCard
          label={t("admin_rev_failed")}
          help={t("admin_rev_failed_help")}
          icon={AlertOctagon}
          tone={data && data.failed.length > 0 ? "bad" : "good"}
          loading={loading}
          value={data ? data.failed.length : "—"}
          sub={data && data.failed.length > 0 ? money(data.failed.reduce((s, f) => s + f.amount, 0)) : undefined}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title={t("admin_rev_daily_title")} icon={BarChart3} help={t("admin_rev_daily_help")} className="lg:col-span-2">
          {loading && !data ? <LoadingBlock rows={4} /> : <DailyBars data={(data?.daily ?? []).map((d) => ({ label: d.day, value: d.amount }))} format={money} />}
        </AdminCard>
        <AdminCard
          title={t("admin_rev_by_plan_title")}
          icon={Layers}
          help={t("admin_rev_by_plan_help")}
          description={
            estimatedMrrUsdCents !== undefined ? t("admin_rev_estimated_vs").replace("{amount}", formatMoney(estimatedMrrUsdCents, "usd")) : undefined
          }
        >
          {loading && !data ? (
            <LoadingBlock />
          ) : (
            <BarList
              rows={(data?.mrrByPlan ?? []).map((p) => ({ key: p.planSlug, label: planName(p.planSlug), value: p.mrr, sub: t("admin_rev_subs_count").replace("{count}", String(p.count)) }))}
              format={money}
              empty={t("admin_rev_no_subs")}
            />
          )}
        </AdminCard>
      </div>

      <AdminCard title={t("admin_rev_failed_title")} icon={CreditCard} help={t("admin_rev_failed_help")}>
        {loading && !data ? (
          <LoadingBlock />
        ) : (
          <SimpleTable
            columns={[
              { key: "email", label: t("admin_col_account") },
              { key: "plan", label: t("admin_col_plan") },
              { key: "status", label: t("admin_col_status") },
              { key: "attempts", label: t("admin_col_attempts"), align: "right" },
              { key: "amount", label: t("admin_col_amount"), align: "right" },
              { key: "date", label: t("admin_col_date"), align: "right" },
            ]}
            rows={(data?.failed ?? []).map((f, i) => ({
              key: `${f.email}-${i}`,
              cells: {
                email: <AccountLink email={f.email} />,
                plan: planName(f.planSlug),
                status: <StatusPill status="bad" label={t(`admin_rev_status_${f.status}` as never) || f.status} />,
                attempts: f.attempts || "—",
                amount: money(f.amount),
                date: formatDate(new Date(f.at).toISOString()),
              },
            }))}
            empty={t("admin_rev_failed_empty")}
          />
        )}
      </AdminCard>

      <AdminCard title={t("admin_rev_cancel_title")} icon={LogOut} help={t("admin_rev_cancellations_help")}>
        {loading && !data ? (
          <LoadingBlock />
        ) : (
          <SimpleTable
            columns={[
              { key: "email", label: t("admin_col_account") },
              { key: "plan", label: t("admin_col_plan") },
              { key: "state", label: t("admin_col_status") },
              { key: "date", label: t("admin_col_date"), align: "right" },
            ]}
            rows={[
              ...(data?.scheduledCancellations ?? []).map((c, i) => ({
                key: `s-${i}`,
                cells: {
                  email: <AccountLink email={c.email} />,
                  plan: planName(c.planSlug),
                  state: <StatusPill status="warn" label={t("admin_rev_cancel_scheduled")} />,
                  date: c.at ? formatDate(new Date(c.at).toISOString()) : "—",
                },
              })),
              ...(data?.cancellations30d ?? []).map((c, i) => ({
                key: `c-${i}`,
                cells: {
                  email: <AccountLink email={c.email} />,
                  plan: planName(c.planSlug),
                  state: <StatusPill status="bad" label={t("admin_rev_cancel_done")} />,
                  date: formatDate(new Date(c.at).toISOString()),
                },
              })),
            ]}
            empty={t("admin_rev_cancel_empty")}
          />
        )}
      </AdminCard>
      {data && <p className="text-xs text-muted-foreground">{t("admin_rev_source").replace("{time}", formatDateTime(data.checkedAt))}</p>}
    </div>
  )
}
