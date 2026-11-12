"use client"

/**
 * Navegación de /admin (docs/279): barra lateral por grupos en computadora (con las
 * sub-secciones de la sección abierta debajo) y fila de secciones deslizable en el celular.
 * El mapa sale de lib/admin/nav.ts.
 */

import type React from "react"
import { BookOpen, DollarSign, HeartPulse, Inbox, LayoutDashboard, LineChart, Mail, TrendingUp, Users } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_GROUPS, ADMIN_SECTIONS, ADMIN_TABS, defaultSub, type AdminTab } from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

export const SECTION_ICONS: Record<AdminTab, React.ComponentType<{ className?: string }>> = {
  resumen: LayoutDashboard,
  buzon: Inbox,
  cuentas: Users,
  ingresos: DollarSign,
  crecimiento: TrendingUp,
  uso: LineChart,
  comunicacion: Mail,
  sistema: HeartPulse,
  guia: BookOpen,
}

export type AdminBadges = Partial<Record<AdminTab, number>>

function Badge({ count, active }: { count?: number; active?: boolean }) {
  if (!count) return null
  return (
    <span
      className={cn(
        "ml-auto min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
        active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
      )}
    >
      {count}
    </span>
  )
}

export function AdminSidebar({
  tab,
  sub,
  badges,
  subBadges,
  onGo,
}: {
  tab: AdminTab
  sub?: string
  badges: AdminBadges
  subBadges?: Record<string, number>
  onGo: (tab: AdminTab, sub?: string) => void
}) {
  const { t } = useLanguage()
  return (
    <nav aria-label={t("admin_nav_sections")} className="space-y-6">
      {ADMIN_GROUPS.map((group) => (
        <div key={group.id} className="space-y-1">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{t(group.label)}</p>
          {group.sections.map((id) => {
            const section = ADMIN_SECTIONS[id]
            const Icon = SECTION_ICONS[id]
            const active = tab === id
            const currentSub = sub || defaultSub(id)
            return (
              <div key={id}>
                <button
                  type="button"
                  onClick={() => onGo(id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(section.label)}</span>
                  <Badge count={badges[id]} active={active} />
                </button>
                {active && section.subs && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                    {section.subs.map((s) => {
                      const on = currentSub === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onGo(id, s.id)}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                            on ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{t(s.label)}</span>
                          {subBadges?.[`${id}.${s.id}`] ? (
                            <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{subBadges[`${id}.${s.id}`]}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/** Celular y tableta: las secciones en una fila que se desliza, con su número. */
export function AdminMobileNav({ tab, badges, onGo }: { tab: AdminTab; badges: AdminBadges; onGo: (tab: AdminTab) => void }) {
  const { t } = useLanguage()
  return (
    <nav aria-label={t("admin_nav_sections")} className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <div className="flex w-max gap-2">
        {ADMIN_TABS.map((id) => {
          const Icon = SECTION_ICONS[id]
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onGo(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(ADMIN_SECTIONS[id].label)}
              {badges[id] ? (
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>
                  {badges[id]}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
