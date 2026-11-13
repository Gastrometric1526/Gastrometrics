"use client"

/**
 * Los 5 espacios de /admin, siempre a la vista (docs/292): arriba en la computadora, abajo
 * como una app en el celular. Cada uno con su ícono, su nombre y, si hay algo pendiente, un
 * número. Un toque lleva a cualquier lugar; nunca hay que volver atrás para encontrar algo.
 */

import type React from "react"
import { BarChart3, HeartPulse, MessageCircle, Sun, Users } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SPACES, type AdminSpaceId } from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

export const SPACE_ICONS: Record<AdminSpaceId, React.ComponentType<{ className?: string }>> = {
  hoy: Sun,
  mensajes: MessageCircle,
  personas: Users,
  numeros: BarChart3,
  sistema: HeartPulse,
}

type Badges = Partial<Record<AdminSpaceId, { count: number; tone?: "primary" | "bad" }>>

function Badge({ badge, small }: { badge?: { count: number; tone?: "primary" | "bad" }; small?: boolean }) {
  if (!badge?.count) return null
  return (
    <span
      className={cn(
        "rounded-full font-semibold tabular-nums",
        small ? "absolute -right-2 -top-1 min-w-[1.1rem] px-1 text-center text-[10px] leading-[1.1rem]" : "px-1.5 text-[11px]",
        badge.tone === "bad" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  )
}

/** Fila de espacios para la computadora (dentro del encabezado). */
export function SpaceTabs({ current, badges, onGo }: { current: AdminSpaceId; badges: Badges; onGo: (id: AdminSpaceId) => void }) {
  const { t } = useLanguage()
  return (
    <nav aria-label={t("admin_page_title")} className="hidden md:block" data-tour="admin-spaces">
      <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
        {ADMIN_SPACES.map((s) => {
          const Icon = SPACE_ICONS[s.id]
          const active = s.id === current
          return (
            <button
              key={s.id}
              type="button"
              data-admin-space={s.id}
              aria-current={active ? "page" : undefined}
              onClick={() => onGo(s.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(s.label)}
              <Badge badge={badges[s.id]} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Barra de abajo para el celular, como una app. */
export function SpaceBottomBar({ current, badges, onGo }: { current: AdminSpaceId; badges: Badges; onGo: (id: AdminSpaceId) => void }) {
  const { t } = useLanguage()
  return (
    <nav
      aria-label={t("admin_page_title")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      data-admin-bottom-bar
    >
      <div className="grid grid-cols-5">
        {ADMIN_SPACES.map((s) => {
          const Icon = SPACE_ICONS[s.id]
          const active = s.id === current
          return (
            <button
              key={s.id}
              type="button"
              data-admin-space-mobile={s.id}
              aria-current={active ? "page" : undefined}
              onClick={() => onGo(s.id)}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                <Badge badge={badges[s.id]} small />
              </span>
              {t(s.label)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
