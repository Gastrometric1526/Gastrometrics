"use client"

/** /admin → Cuentas → Historial (docs/197): altas, cambios de plan, borrados, cancelaciones y cobros atrasados en una línea de tiempo. */

import { useMemo, useState } from "react"
import { UserPlus, Repeat, UserX, Trash2, LogOut, CalendarClock, AlertOctagon, Users, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/language-context"
import { getPlanBySlug } from "@/lib/plans"
import { formatDate, formatMonthYear } from "@/lib/date-format"
import { countryName } from "@/lib/admin-format"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { HistoryEvent, HistoryEventType, HistorySummary } from "@/lib/admin/account-history"
import { AdminCard, EmptyState, ErrorState, KpiCard, KpiGrid, LoadingBlock, StatusPill, type Status, useAdminData } from "@/components/admin/ui"
import { AccountLink } from "@/components/admin/account-link"

const TYPES: { type: HistoryEventType; icon: React.ComponentType<{ className?: string }>; status: Status }[] = [
  { type: "created", icon: UserPlus, status: "ok" },
  { type: "plan_changed", icon: Repeat, status: "unknown" },
  { type: "deletion_requested", icon: UserX, status: "warn" },
  { type: "purged", icon: Trash2, status: "bad" },
  { type: "subscription_canceled", icon: LogOut, status: "bad" },
  { type: "cancel_scheduled", icon: CalendarClock, status: "warn" },
  { type: "payment_overdue", icon: AlertOctagon, status: "bad" },
]
const META = new Map(TYPES.map((t) => [t.type, t]))
const planName = (slug: string | null | undefined) => (slug ? getPlanBySlug(slug)?.name || slug : "—")

export function AccountHistoryPanel() {
  const { t } = useLanguage()
  const { data, error, loading, reload } = useAdminData<{ events: HistoryEvent[]; summary: HistorySummary; stripe: boolean }>("/api/admin/account-history")
  const [filter, setFilter] = useState<HistoryEventType | "all">("all")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(100)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.events ?? []).filter((e) => (filter === "all" || e.type === filter) && (!q || (e.email || "").toLowerCase().includes(q)))
  }, [data, filter, query])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of data?.events ?? []) m.set(e.type, (m.get(e.type) || 0) + 1)
    return m
  }, [data])

  // Agrupado por mes (día/mes/año en todas las fechas, docs/170)
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: HistoryEvent[] }[] = []
    for (const e of filtered.slice(0, limit)) {
      const key = e.at.slice(0, 7)
      let g = out[out.length - 1]
      if (!g || g.key !== key) {
        g = { key, label: formatMonthYear(e.at), items: [] }
        out.push(g)
      }
      g.items.push(e)
    }
    return out
  }, [filtered, limit])

  if (error && !data) return <ErrorState onRetry={() => reload()} />
  const s = data?.summary

  const describe = (e: HistoryEvent) => {
    switch (e.type) {
      case "created":
        return t("admin_hist_desc_created").replace("{plan}", planName(e.plan))
      case "plan_changed":
        return t("admin_hist_desc_plan").replace("{from}", planName(e.fromPlan)).replace("{to}", planName(e.toPlan)) + (e.source ? ` · ${t(`admin_hist_source_${e.source}` as TranslationKey)}` : "")
      case "deletion_requested":
        return t("admin_hist_desc_deletion").replace("{date}", e.dueAt ? formatDate(e.dueAt) : "—")
      case "purged":
        return t("admin_hist_desc_purged")
          .replace("{created}", e.createdAt ? formatDate(e.createdAt) : "—")
          .replace("{plan}", planName(e.plan))
          .replace("{country}", e.country ? countryName(e.country) || e.country : "—")
      case "subscription_canceled":
        return t("admin_hist_desc_canceled").replace("{plan}", planName(e.plan))
      case "cancel_scheduled":
        return t("admin_hist_desc_scheduled").replace("{plan}", planName(e.plan)).replace("{date}", e.dueAt ? formatDate(e.dueAt) : "—")
      case "payment_overdue":
        return t("admin_hist_desc_overdue").replace("{plan}", planName(e.plan))
    }
  }

  return (
    <div className="space-y-6">
      <KpiGrid cols={5}>
        <KpiCard label={t("admin_hist_kpi_active")} icon={Users} loading={loading} value={s?.activeAccounts ?? "—"} sub={s ? t("admin_hist_kpi_new_30d").replace("{count}", String(s.created30d)) : undefined} />
        <KpiCard label={t("admin_hist_kpi_pending")} help={t("admin_hist_kpi_pending_help")} icon={UserX} tone={s && s.deletionPending > 0 ? "warn" : "default"} loading={loading} value={s?.deletionPending ?? "—"} />
        <KpiCard
          label={t("admin_hist_kpi_purged")}
          help={t("admin_hist_kpi_purged_help")}
          icon={Trash2}
          loading={loading}
          value={s?.purgedTotal ?? "—"}
          sub={s ? t("admin_hist_kpi_30d").replace("{count}", String(s.purged30d)) : undefined}
        />
        <KpiCard
          label={t("admin_hist_kpi_canceled")}
          help={t("admin_hist_kpi_canceled_help")}
          icon={LogOut}
          loading={loading}
          value={s?.canceledTotal ?? "—"}
          sub={s ? `${t("admin_hist_kpi_30d").replace("{count}", String(s.canceled30d))} · ${t("admin_hist_kpi_scheduled").replace("{count}", String(s.cancelScheduled))}` : undefined}
        />
        <KpiCard label={t("admin_hist_kpi_plan_changes")} icon={Repeat} loading={loading} value={s?.planChanges30d ?? "—"} sub={t("admin_hist_kpi_last_30d")} />
      </KpiGrid>

      <AdminCard title={t("admin_hist_title")} icon={CalendarClock} help={t("admin_hist_help")} description={data && !data.stripe ? t("admin_hist_no_stripe") : undefined}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={"rounded-full border px-3 py-1 text-xs " + (filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {t("admin_hist_filter_all")} · {data?.events.length ?? 0}
            </button>
            {TYPES.map((ty) => (
              <button
                key={ty.type}
                type="button"
                onClick={() => setFilter(ty.type)}
                className={
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs " +
                  (filter === ty.type ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                <ty.icon className="h-3.5 w-3.5" />
                {t(`admin_hist_type_${ty.type}` as TranslationKey)} · {counts.get(ty.type) || 0}
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin_hist_search")} className="pl-8 h-9" />
            </div>
          </div>

          {loading && !data ? (
            <LoadingBlock rows={8} />
          ) : filtered.length === 0 ? (
            <EmptyState text={t("admin_hist_empty")} />
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.key} className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
                  <ul className="relative space-y-1 border-l border-border pl-5">
                    {g.items.map((e, i) => {
                      const m = META.get(e.type)!
                      return (
                        <li key={`${e.type}-${e.at}-${i}`} className="relative py-1.5">
                          <span className="absolute -left-[29px] top-2 flex h-4 w-4 items-center justify-center rounded-full bg-card ring-2 ring-border">
                            <m.icon className="h-2.5 w-2.5 text-muted-foreground" />
                          </span>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <StatusPill status={m.status} label={t(`admin_hist_type_${e.type}` as TranslationKey)} />
                            <span className="text-sm text-foreground">{e.email ? <AccountLink email={e.email} /> : <span className="italic text-muted-foreground">{t("admin_hist_deleted_account")}</span>}</span>
                            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDate(e.at)}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{describe(e)}</p>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {filtered.length > limit && (
                <button type="button" onClick={() => setLimit((l) => l + 200)} className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground">
                  {t("admin_hist_more").replace("{count}", String(filtered.length - limit))}
                </button>
              )}
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  )
}
