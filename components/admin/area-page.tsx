"use client"

/**
 * Pantalla de un área de /admin. Navegación por pasos (pedido del dueño, docs/287: «no es tan
 * fácil navegar ni entender»):
 *   Inicio (tarjetas) → área (índice: sus partes en tarjetas, con para qué sirve y si hay
 *   algo pendiente) → una parte sola en pantalla, con «Inicio › Área» arriba y
 *   anterior/siguiente abajo.
 * Nunca hay varias partes abiertas una debajo de la otra. Un área con una sola parte (o sin
 * partes) se muestra directa. Sin barra lateral ni submenús (docs/281).
 */

import type React from "react"
import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SECTIONS, howToSteps, type AdminSub, type AdminTab } from "@/lib/admin/nav"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { cn } from "@/lib/utils"

const HOWTO_KEY = "gm_admin_howto_open"

export function blockId(tab: AdminTab, sub: string) {
  return `admin-block-${tab}-${sub}`
}

function Badge({ n }: { n?: number }) {
  if (!n) return null
  return <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">{n}</span>
}

export function AreaPage({
  tab,
  blocks,
  children,
  banner,
  onHome,
  onOpen,
  counts,
  focus,
}: {
  tab: AdminTab
  /** Contenido de cada parte por id; sin partes, se muestra `children`. */
  blocks?: Record<string, React.ReactNode>
  children?: React.ReactNode
  banner?: React.ReactNode
  onHome: () => void
  /** Abre una parte (id) o vuelve al índice del área (null). Cambia `?sub=` en la dirección. */
  onOpen?: (sub: string | null) => void
  /** Número junto al nombre de la parte (p. ej. chats esperando). */
  counts?: Record<string, number>
  /** Parte abierta (de ?sub=, una tarea, un aviso o un toque en el índice). */
  focus?: string
}) {
  const { t } = useLanguage()
  const section = ADMIN_SECTIONS[tab]
  const Icon = SECTION_ICONS[tab]
  const steps = howToSteps(section, t)
  const subs = (section.subs ?? []).filter((s) => blocks?.[s.id] !== undefined)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HOWTO_KEY) || "{}") as Record<string, boolean>
      setOpen(saved[tab] ?? false)
    } catch {
      setOpen(false)
    }
  }, [tab])
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      const saved = JSON.parse(localStorage.getItem(HOWTO_KEY) || "{}") as Record<string, boolean>
      localStorage.setItem(HOWTO_KEY, JSON.stringify({ ...saved, [tab]: next }))
    } catch {}
  }

  const activeIndex = subs.length > 1 ? subs.findIndex((s) => s.id === focus) : -1
  const active = activeIndex >= 0 ? subs[activeIndex] : null

  // ── Una parte sola en pantalla ──────────────────────────────────────────────
  if (active) {
    const prev = subs[activeIndex - 1]
    const next = subs[activeIndex + 1]
    return (
      <div className="space-y-6" data-admin-view="block">
        <nav aria-label={t("admin_area_path")} className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button type="button" onClick={onHome} className="rounded-md px-1.5 py-1 hover:text-primary">
            {t("admin_home_back")}
          </button>
          <ChevronRight className="h-4 w-4" />
          <button type="button" data-area-index onClick={() => onOpen?.(null)} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:text-primary">
            <Icon className="h-4 w-4" />
            {t(section.label)}
          </button>
        </nav>
        <div className="space-y-1.5">
          <h2 className="flex flex-wrap items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
            {t(active.label)}
            <Badge n={counts?.[active.id]} />
          </h2>
          <p className="max-w-3xl text-muted-foreground">{t(active.desc)}</p>
        </div>
        {banner}
        <section id={blockId(tab, active.id)} data-admin-block={active.id} className="space-y-6">
          {blocks![active.id]}
        </section>
        <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
          {prev ? (
            <button type="button" onClick={() => onOpen?.(prev.id)} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left hover:border-primary">
              <ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t("admin_area_prev")}</span>
                <span className="block truncate font-medium text-foreground">{t(prev.label)}</span>
              </span>
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <button type="button" onClick={() => onOpen?.(next.id)} className="flex items-center justify-end gap-3 rounded-2xl border border-border p-4 text-right hover:border-primary">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t("admin_area_next")}</span>
                <span className="block truncate font-medium text-foreground">{t(next.label)}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button type="button" onClick={() => onOpen?.(null)} className="flex items-center justify-end gap-3 rounded-2xl border border-border p-4 text-right hover:border-primary">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{t("admin_area_all_parts")}</span>
                <span className="block truncate font-medium text-foreground">{t(section.label)}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Índice del área ────────────────────────────────────────────────────────
  // Partes agrupadas por `group` (en el orden en que aparecen); sin grupo, una sola lista.
  const groups: { label?: AdminSub["group"]; items: AdminSub[] }[] = []
  for (const s of subs) {
    const last = groups[groups.length - 1]
    if (last && last.label === s.group) last.items.push(s)
    else groups.push({ label: s.group, items: [s] })
  }

  return (
    <div className="space-y-8" data-admin-view={subs.length > 1 ? "index" : "single"}>
      <div className="space-y-5">
        <Button variant="ghost" size="sm" className="-ml-3 gap-1.5 text-muted-foreground" onClick={onHome}>
          <ArrowLeft className="h-4 w-4" />
          {t("admin_home_back")}
        </Button>
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">{t(section.label)}</h2>
            <p className="max-w-3xl text-muted-foreground">{t(section.desc)}</p>
            {steps.length > 0 && (
              <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary">
                <Lightbulb className="h-4 w-4" />
                {t("admin_howto_title")}
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
        </div>
        {open && steps.length > 0 && (
          <ol className="max-w-3xl space-y-2.5 rounded-2xl bg-muted/50 p-5 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-primary">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {banner}

      {subs.length > 1 ? (
        <div className="space-y-8">
          <p className="text-sm font-medium text-muted-foreground">{t("admin_area_pick")}</p>
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-3">
              {g.label && <h3 className="text-sm font-semibold text-foreground">{t(g.label)}</h3>}
              <div className="grid gap-3 md:grid-cols-2">
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    data-admin-block-link={s.id}
                    onClick={() => onOpen?.(s.id)}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-5 text-left transition-colors hover:border-primary"
                  >
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2 text-lg font-semibold text-foreground group-hover:text-primary">
                        {t(s.label)}
                        <Badge n={counts?.[s.id]} />
                      </span>
                      <span className="block text-sm text-muted-foreground">{t(s.desc)}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : subs.length === 1 ? (
        <section id={blockId(tab, subs[0].id)} data-admin-block={subs[0].id} className="space-y-6">
          {blocks![subs[0].id]}
        </section>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  )
}
