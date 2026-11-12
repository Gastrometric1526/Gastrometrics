"use client"

/**
 * Guía de /admin (docs/279): «¿Qué quieres hacer?» con cada tarea paso a paso y un botón
 * «Ir ahí», más el mapa de dónde está todo. También el encabezado de cada sección con su
 * «Cómo se usa esta sección» y los accesos rápidos del Resumen.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { ArrowRight, ChevronDown, Lightbulb, Map, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_GROUPS, ADMIN_SECTIONS, ADMIN_TASKS, QUICK_TASKS, howToSteps, taskSteps, type AdminTab, type AdminTask } from "@/lib/admin/nav"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { AdminCard } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

const HOWTO_KEY = "gm_admin_howto_open"

/** Título, para qué sirve y «Cómo se usa esta sección» (se recuerda abierto o cerrado). */
export function SectionHeader({ tab, actions }: { tab: AdminTab; actions?: React.ReactNode }) {
  const { t } = useLanguage()
  const section = ADMIN_SECTIONS[tab]
  const Icon = SECTION_ICONS[tab]
  const steps = howToSteps(section, t)
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
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-2xl font-semibold leading-tight text-foreground">{t(section.label)}</h2>
            <p className="text-sm text-muted-foreground">{t(section.desc)}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {steps.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40">
          <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground">
            <Lightbulb className="h-4 w-4 text-primary" />
            {t("admin_howto_title")}
            <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <ol className="space-y-2 px-4 pb-4 text-sm text-muted-foreground">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, onTask }: { task: AdminTask; onTask: (task: AdminTask) => void }) {
  const { t } = useLanguage()
  const Icon = SECTION_ICONS[task.tab]
  return (
    <Card id={`admin-task-${task.id}`} className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t(task.title)}</h3>
        </div>
        <ol className="flex-1 space-y-1.5 text-sm text-muted-foreground">
          {taskSteps(task, t).map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-right font-semibold text-primary tabular-nums">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="outline" className="self-start gap-1.5" onClick={() => onTask(task)}>
          {t("admin_guide_go")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

export function GuidePanel({ onGo, onTask }: { onGo: (tab: AdminTab, sub?: string) => void; onTask: (task: AdminTask) => void }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t("admin_guide_tasks_title")}</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_TASKS.map((task) => (
            <TaskCard key={task.id} task={task} onTask={onTask} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Map className="h-5 w-5 text-primary" />
            {t("admin_guide_map_title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("admin_guide_map_desc")}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {ADMIN_GROUPS.map((group) => (
            <Card key={group.id}>
              <CardContent className="space-y-4 p-5">
                <p className="text-xs font-medium text-muted-foreground">{t(group.label)}</p>
                {group.sections.map((id) => {
                  const section = ADMIN_SECTIONS[id]
                  const Icon = SECTION_ICONS[id]
                  return (
                    <div key={id} className="space-y-1.5">
                      <button type="button" onClick={() => onGo(id)} className="group flex items-center gap-2 text-left text-sm font-semibold text-foreground hover:text-primary">
                        <Icon className="h-4 w-4 text-primary" />
                        {t(section.label)}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                      <p className="text-xs text-muted-foreground">{t(section.desc)}</p>
                      {section.subs && (
                        <ul className="space-y-1 border-l border-border pl-3">
                          {section.subs.map((s) => (
                            <li key={s.id}>
                              <button type="button" onClick={() => onGo(id, s.id)} className="text-left text-xs">
                                <span className="font-medium text-foreground hover:text-primary">{t(s.label)}</span>
                                <span className="text-muted-foreground"> · {t(s.desc)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Accesos rápidos del Resumen: lo que más se hace, con un toque. */
export function QuickTasks({ onTask, onOpenGuide }: { onTask: (task: AdminTask) => void; onOpenGuide: () => void }) {
  const { t } = useLanguage()
  const tasks = QUICK_TASKS.map((id) => ADMIN_TASKS.find((x) => x.id === id)).filter((x): x is AdminTask => !!x)
  return (
    <AdminCard
      title={t("admin_quick_title")}
      icon={Zap}
      description={t("admin_quick_desc")}
      actions={
        <Button variant="ghost" size="sm" className="gap-1" onClick={onOpenGuide}>
          {t("admin_guide_open_all")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => {
          const Icon = SECTION_ICONS[task.tab]
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onTask(task)}
              className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-foreground">{t(task.title)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </button>
          )
        })}
      </div>
    </AdminCard>
  )
}
