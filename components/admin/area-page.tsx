"use client"

/**
 * Pantalla de un área de /admin (docs/281): «← Inicio», ícono, título y para qué sirve,
 * «Cómo se usa» (plegable) y los bloques uno debajo del otro, cada uno con su título y una
 * línea. Si hay varios bloques, una fila «Ir a:» salta a cada uno. Sin submenús.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { ArrowLeft, ChevronDown, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SECTIONS, howToSteps, type AdminTab } from "@/lib/admin/nav"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { cn } from "@/lib/utils"

const HOWTO_KEY = "gm_admin_howto_open"

export function blockId(tab: AdminTab, sub: string) {
  return `admin-block-${tab}-${sub}`
}

export function AreaPage({
  tab,
  blocks,
  children,
  banner,
  onHome,
  counts,
}: {
  tab: AdminTab
  /** Contenido de cada bloque por id; sin bloques, se muestra `children`. */
  blocks?: Record<string, React.ReactNode>
  children?: React.ReactNode
  banner?: React.ReactNode
  onHome: () => void
  /** Número junto al nombre del bloque en «Ir a:» (p. ej. chats esperando). */
  counts?: Record<string, number>
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
  const jump = (id: string) => document.getElementById(blockId(tab, id))?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="space-y-8">
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

      {subs.length > 1 && (
        <nav aria-label={t("admin_area_jump")} className="sticky top-[4.25rem] z-30 -mx-4 border-y border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{t("admin_area_jump")}</span>
            {subs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="shrink-0 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {t(s.label)}
                {counts?.[s.id] ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">{counts[s.id]}</span> : null}
              </button>
            ))}
          </div>
        </nav>
      )}

      {banner}

      {subs.length > 0 ? (
        <div className="space-y-14">
          {subs.map((s) => (
            <section key={s.id} id={blockId(tab, s.id)} data-admin-block={s.id} className="scroll-mt-36 space-y-5">
              <div className="space-y-1 border-b border-border pb-3">
                <h3 className="text-xl font-semibold text-foreground">{t(s.label)}</h3>
                <p className="text-sm text-muted-foreground">{t(s.desc)}</p>
              </div>
              <div className="space-y-6">{blocks![s.id]}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  )
}
