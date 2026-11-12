"use client"

/**
 * /admin → lo más importante en una sola vista (docs/195). Desde docs/281 se parte en dos:
 * - `TodoCard` («Para atender hoy»), arriba del Inicio: mensajes, errores reportados, cobros
 *   fallidos, problemas del sistema, planes por vencer, cancelaciones programadas y avisos
 *   legales pendientes; cada línea lleva a donde se resuelve.
 * - `OverviewNumbers` («En números»), primer bloque de Crecimiento y uso: los números
 *   generales con sus gráficas. Cada número lleva a su área.
 */

import { Users, UserCheck, CreditCard, DollarSign, Repeat, HeartPulse, CheckCircle2, ChevronRight, ListTodo, BarChart3, TrendingUp } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import type { RevenueSummary } from "@/lib/admin/revenue"
import type { RetentionSummary } from "@/lib/admin/retention"
import type { HealthResponse } from "@/components/admin/health-panel"
import { AdminCard, DailyBars, KpiCard, KpiGrid, LoadingBlock, formatMoney, percentChange, useAdminData } from "@/components/admin/ui"

export type AdminGoTo = (tab: string, sub?: string) => void

function useOverviewData() {
  const revenue = useAdminData<RevenueSummary & { configured?: boolean }>("/api/admin/revenue")
  const retention = useAdminData<RetentionSummary>("/api/admin/retention")
  const health = useAdminData<HealthResponse>("/api/admin/health")
  const rev = revenue.data && revenue.data.configured !== false ? revenue.data : null
  return { revenue, retention, health, rev, ret: retention.data }
}

export function TodoCard({
  feedbackCounts,
  supportWaiting = 0,
  expiringSoon,
  legalPending,
  goTo,
}: {
  feedbackCounts: { total: number; nuevo: number; bug: number }
  supportWaiting?: number
  expiringSoon: number
  legalPending: number
  goTo: AdminGoTo
}) {
  const { t } = useLanguage()
  const { rev, health } = useOverviewData()
  const todo: { key: string; count: number; label: string; tone: "bad" | "warn" | "info"; onClick: () => void }[] = [
    { key: "failed", count: rev?.failed?.length ?? 0, label: t("admin_todo_failed_payments"), tone: "bad" as const, onClick: () => goTo("ingresos") },
    { key: "system", count: health.data?.problems?.length ?? 0, label: t("admin_todo_system"), tone: "bad" as const, onClick: () => goTo("sistema") },
    { key: "chat", count: supportWaiting, label: t("admin_todo_chat"), tone: "warn" as const, onClick: () => goTo("buzon", "chat") },
    { key: "bugs", count: feedbackCounts.bug, label: t("admin_todo_bugs_short"), tone: "bad" as const, onClick: () => goTo("buzon", "mensajes") },
    { key: "unread", count: feedbackCounts.nuevo, label: t("admin_todo_unread_short"), tone: "warn" as const, onClick: () => goTo("buzon", "mensajes") },
    {
      key: "expiring",
      count: expiringSoon,
      label: t("admin_todo_expiring_short"),
      tone: "warn" as const,
      onClick: () => {
        // Abre Cuentas ya ordenada «por vencer» (docs/197).
        try {
          sessionStorage.setItem("gm_admin_accounts_sort", "expiring")
        } catch {}
        goTo("cuentas", "lista")
      },
    },
    { key: "cancel", count: rev?.scheduledCancellations?.length ?? 0, label: t("admin_todo_cancel_scheduled"), tone: "warn" as const, onClick: () => goTo("ingresos") },
    { key: "legal", count: legalPending, label: t("admin_todo_legal_short"), tone: "info" as const, onClick: () => goTo("comunicacion", "legal") },
  ].filter((i) => i.count > 0)

  const toneCls = { bad: "bg-destructive/10 text-destructive", warn: "bg-warning/10 text-warning", info: "bg-muted text-muted-foreground" }

  return (
    <AdminCard title={t("admin_todo_title")} icon={ListTodo} description={t("admin_todo_desc")}>
      {todo.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {t("admin_todo_clear")}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {todo.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onClick}
                className="group flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className={`inline-flex min-w-[2rem] justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${toneCls[item.tone]}`}>{item.count}</span>
                <span className="flex-1 text-foreground group-hover:text-primary">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  )
}

export function OverviewNumbers({ goTo }: { goTo: AdminGoTo }) {
  const { t } = useLanguage()
  const { revenue, retention, health, rev, ret } = useOverviewData()
  const money = (n: number) => formatMoney(n, rev?.currency)

  return (
    <div className="space-y-6">
      <KpiGrid cols={3}>
        <KpiCard
          label={t("admin_ov_accounts")}
          help={t("admin_ov_accounts_help")}
          icon={Users}
          loading={retention.loading && !ret}
          value={ret?.totalAccounts ?? "—"}
          sub={ret ? t("admin_ov_new_7d").replace("{count}", String(ret.newAccounts7d)) : undefined}
          onClick={() => goTo("cuentas")}
        />
        <KpiCard
          label={t("admin_ov_active_7d")}
          help={t("admin_ret_active_help")}
          icon={UserCheck}
          tone="good"
          loading={retention.loading && !ret}
          value={ret?.active7d ?? "—"}
          sub={ret && ret.totalAccounts ? `${Math.round((ret.active7d / ret.totalAccounts) * 100)}% ${t("admin_ret_of_accounts")}` : undefined}
          onClick={() => goTo("crecimiento", "retencion")}
        />
        <KpiCard
          label={t("admin_ov_paying")}
          help={t("admin_rev_mrr_help")}
          icon={CreditCard}
          loading={revenue.loading && !rev}
          value={rev?.activeSubscriptions ?? "—"}
          sub={rev && rev.trialingSubscriptions ? t("admin_rev_trialing").replace("{count}", String(rev.trialingSubscriptions)) : undefined}
          onClick={() => goTo("ingresos")}
        />
        <KpiCard
          label={t("admin_rev_collected_30d")}
          help={t("admin_rev_collected_30d_help")}
          icon={DollarSign}
          tone="good"
          loading={revenue.loading && !rev}
          value={rev ? money(rev.collected30d) : "—"}
          change={rev ? percentChange(rev.collected30d, rev.collectedPrev30d) : undefined}
          changeLabel={t("admin_rev_vs_prev_30d")}
          onClick={() => goTo("ingresos")}
        />
        <KpiCard label={t("admin_rev_mrr")} help={t("admin_rev_mrr_help")} icon={Repeat} loading={revenue.loading && !rev} value={rev ? money(rev.mrr) : "—"} onClick={() => goTo("ingresos")} />
        <KpiCard
          label={t("admin_ov_health")}
          icon={HeartPulse}
          tone={!health.data ? "default" : health.data.problems?.length ? "bad" : "good"}
          loading={health.loading && !health.data}
          value={!health.data ? "—" : health.data.problems?.length ? t("admin_ov_health_n").replace("{count}", String(health.data.problems.length)) : t("admin_ov_health_ok")}
          onClick={() => goTo("sistema")}
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title={t("admin_ov_signups_chart")} icon={TrendingUp} help={t("admin_ret_signups_help")}>
          {!ret ? <LoadingBlock rows={4} /> : <DailyBars data={(ret.signupsByWeek ?? []).map((w) => ({ label: w.weekStart, value: w.count }))} height={140} />}
        </AdminCard>
        <AdminCard title={t("admin_rev_daily_title")} icon={BarChart3} help={t("admin_rev_daily_help")}>
          {!rev ? <LoadingBlock rows={4} /> : <DailyBars data={(rev.daily ?? []).map((d) => ({ label: d.day, value: d.amount }))} format={money} height={140} />}
        </AdminCard>
      </div>
    </div>
  )
}
