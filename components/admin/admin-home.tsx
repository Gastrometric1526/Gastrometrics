"use client"

/**
 * Inicio de /admin (pedido del dueño, docs/281): «Para atender hoy» arriba y 6 tarjetas
 * grandes, como apps en un celular, cada una con su número del momento. Tocar una abre su
 * área a pantalla completa. Sin barra lateral ni submenús.
 */

import type React from "react"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SECTIONS, HOME_AREAS, type AdminTab, type AdminTask } from "@/lib/admin/nav"
import type { RevenueSummary } from "@/lib/admin/revenue"
import type { RetentionSummary } from "@/lib/admin/retention"
import type { HealthResponse } from "@/components/admin/health-panel"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { TodoCard } from "@/components/admin/overview-panel"
import { QuickTasks } from "@/components/admin/guide-panel"
import { formatMoney, useAdminData } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

type Tone = "default" | "attention" | "good" | "bad"

export function AdminHome({
  inboxCount,
  supportWaiting,
  feedbackCounts,
  expiringSoon,
  legalPending,
  onGo,
  onTask,
}: {
  inboxCount: number
  supportWaiting: number
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

  // El número de cada tarjeta: lo que más importa de esa área ahora mismo.
  const metric: Record<string, { text: string; tone: Tone } | null> = {
    buzon: inboxCount > 0 ? { text: t("admin_tile_unanswered").replace("{count}", String(inboxCount)), tone: "attention" } : { text: t("admin_tile_all_answered"), tone: "good" },
    cuentas: ret ? { text: t("admin_tile_accounts").replace("{count}", String(ret.totalAccounts)), tone: "default" } : null,
    ingresos: rev ? { text: t("admin_tile_collected").replace("{amount}", formatMoney(rev.collected30d, rev.currency)), tone: "default" } : null,
    crecimiento: ret ? { text: t("admin_tile_active").replace("{count}", String(ret.active7d)), tone: "default" } : null,
    comunicacion: legalPending > 0 ? { text: t("admin_tile_legal_pending").replace("{count}", String(legalPending)), tone: "attention" } : null,
    sistema: !health.data
      ? null
      : problems
        ? { text: t("admin_ov_health_n").replace("{count}", String(problems)), tone: "bad" }
        : { text: t("admin_ov_health_ok"), tone: "good" },
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">{t("admin_home_greeting")}</h2>
        <p className="text-muted-foreground">{t("admin_tabdesc_resumen")}</p>
      </div>

      <div data-tour="admin-todo">
        <TodoCard feedbackCounts={feedbackCounts} supportWaiting={supportWaiting} expiringSoon={expiringSoon} legalPending={legalPending} goTo={(tab, sub) => onGo(tab as AdminTab, sub)} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {HOME_AREAS.map((id) => (
          <AreaTile key={id} id={id} metric={metric[id]} onOpen={() => onGo(id)} />
        ))}
      </div>

      <div data-tour="admin-quick">
        <QuickTasks onTask={onTask} onOpenGuide={() => onGo("guia")} />
      </div>

    </div>
  )
}

const TONE_CLS: Record<Tone, string> = {
  default: "text-foreground",
  attention: "text-primary",
  good: "text-success",
  bad: "text-destructive",
}

function AreaTile({ id, metric, onOpen }: { id: AdminTab; metric: { text: string; tone: Tone } | null; onOpen: () => void }) {
  const { t } = useLanguage()
  const section = ADMIN_SECTIONS[id]
  const Icon: React.ComponentType<{ className?: string }> = SECTION_ICONS[id]
  return (
    <button
      type="button"
      onClick={onOpen}
      data-area-tile={id}
      className="group flex min-h-[11rem] flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
      <div className="space-y-1.5">
        <p className="text-xl font-semibold text-foreground">{t(section.label)}</p>
        {section.short && <p className="text-sm leading-snug text-muted-foreground">{t(section.short)}</p>}
        <p className={cn("min-h-[1.25rem] text-sm font-semibold", metric ? TONE_CLS[metric.tone] : "text-transparent")}>{metric?.text ?? "·"}</p>
      </div>
    </button>
  )
}
