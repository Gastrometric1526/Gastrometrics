"use client"

/**
 * «Hoy», la primera pantalla de /admin (rediseño desde cero, docs/292). Responde, de arriba
 * abajo, lo que se pregunta quien entra:
 *   1. ¿Hay algo que atender? → «Para atender hoy», cada línea lleva a resolverla.
 *   2. ¿Cómo va todo? → 4 números grandes en palabras simples; cada uno abre su detalle.
 *   3. ¿Cómo hago…? → accesos rápidos a las tareas de la Guía.
 *   4. ¿Dónde está cada cosa? → el mapa de los otros 4 espacios con todas sus partes.
 */

import { ArrowRight, BarChart3, DollarSign, HeartPulse, Users } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SPACES, partInfo, type AdminPartRef, type AdminSpaceId, type AdminTab, type AdminTask } from "@/lib/admin/nav"
import type { RevenueSummary } from "@/lib/admin/revenue"
import type { RetentionSummary } from "@/lib/admin/retention"
import type { HealthResponse } from "@/components/admin/health-panel"
import { TodoCard } from "@/components/admin/overview-panel"
import { QuickTasks } from "@/components/admin/guide-panel"
import { SPACE_ICONS } from "@/components/admin/space-nav"
import { formatMoney, useAdminData } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

export function AdminToday({
  supportWaiting,
  recoveryPending,
  feedbackCounts,
  expiringSoon,
  legalPending,
  onGo,
  onTask,
}: {
  supportWaiting: number
  recoveryPending: number
  feedbackCounts: { total: number; nuevo: number; bug: number }
  expiringSoon: number
  legalPending: number
  onGo: (tab: AdminTab, sub?: string) => void
  onTask: (task: AdminTask) => void
}) {
  const { t } = useLanguage()
  const revenue = useAdminData<RevenueSummary & { configured?: boolean }>("/api/admin/revenue")
  const retention = useAdminData<RetentionSummary>("/api/admin/retention")
  const health = useAdminData<HealthResponse>("/api/admin/health")
  const rev = revenue.data && revenue.data.configured !== false ? revenue.data : null
  const ret = retention.data
  const problems = health.data?.problems?.length ?? 0

  const pulse: { key: string; icon: typeof Users; label: string; value: string | null; sub?: string; tone?: "good" | "bad"; go: AdminPartRef }[] = [
    { key: "accounts", icon: Users, label: t("admin_today_accounts"), value: ret ? String(ret.totalAccounts) : null, go: { tab: "cuentas", sub: "lista" } },
    {
      key: "active",
      icon: BarChart3,
      label: t("admin_today_active"),
      value: ret ? String(ret.active7d) : null,
      sub: ret && ret.totalAccounts ? t("admin_today_active_sub").replace("{pct}", String(Math.round((ret.active7d / ret.totalAccounts) * 100))) : undefined,
      go: { tab: "crecimiento", sub: "numeros" },
    },
    { key: "money", icon: DollarSign, label: t("admin_today_collected"), value: rev ? formatMoney(rev.collected30d, rev.currency) : null, go: { tab: "ingresos", sub: "dinero" } },
    {
      key: "system",
      icon: HeartPulse,
      label: t("admin_today_system"),
      value: health.data ? (problems ? t("admin_ov_health_n").replace("{count}", String(problems)) : t("admin_ov_health_ok")) : null,
      tone: health.data ? (problems ? "bad" : "good") : undefined,
      go: { tab: "sistema", sub: "salud" },
    },
  ]

  return (
    <div className="space-y-8" data-admin-today>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl" data-tour="admin-title">
          {t("admin_home_greeting")}
        </h2>
        <p className="text-muted-foreground">{t("admin_space_hoy_desc")}</p>
      </div>

      <div data-tour="admin-todo">
        <TodoCard
          feedbackCounts={feedbackCounts}
          supportWaiting={supportWaiting}
          recoveryPending={recoveryPending}
          expiringSoon={expiringSoon}
          legalPending={legalPending}
          goTo={(tab, sub) => onGo(tab as AdminTab, sub)}
        />
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin_today_pulse")}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pulse.map((p) => (
            <button
              key={p.key}
              type="button"
              data-today-pulse={p.key}
              onClick={() => onGo(p.go.tab, p.go.sub)}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary sm:p-5"
            >
              <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <p.icon className="h-4 w-4" />
                  {p.label}
                </span>
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              {p.value ? (
                <span className={cn("text-2xl font-semibold tabular-nums", p.tone === "bad" ? "text-destructive" : p.tone === "good" ? "text-success" : "text-foreground")}>{p.value}</span>
              ) : (
                // Cargando (docs/293): antes se veía un «·» suelto mientras llegaban los datos.
                <span className="h-8 w-16 animate-pulse rounded-md bg-muted" aria-label={t("common_loading")} />
              )}
              {p.sub && <span className="text-xs text-muted-foreground">{p.sub}</span>}
            </button>
          ))}
        </div>
      </section>

      <div data-tour="admin-quick">
        <QuickTasks onTask={onTask} onOpenGuide={() => onGo("guia", "guia")} />
      </div>

      {/* Dónde está cada cosa: los otros espacios con todas sus partes. */}
      <section className="space-y-3" data-admin-map>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("admin_today_map")}</h3>
          <p className="text-sm text-muted-foreground">{t("admin_today_map_desc")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ADMIN_SPACES.filter((s) => s.id !== "hoy").map((s) => {
            const Icon = SPACE_ICONS[s.id as AdminSpaceId]
            return (
              <div key={s.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(s.label)}
                </p>
                <p className="text-sm text-muted-foreground">{t(s.desc)}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {s.groups
                    .flatMap((g) => g.parts)
                    .map((p) => {
                      const info = partInfo(p.tab, p.sub)
                      if (!info) return null
                      return (
                        <button
                          key={`${p.tab}:${p.sub}`}
                          type="button"
                          onClick={() => onGo(p.tab, p.sub)}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          {t(info.label)}
                        </button>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
