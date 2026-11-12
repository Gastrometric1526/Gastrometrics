"use client"

/**
 * Guía de /admin (docs/279): «¿Qué quieres hacer?» con cada tarea paso a paso y un botón
 * «Ir ahí», más el mapa de dónde está todo. También el encabezado de cada sección con su
 * «Cómo se usa esta sección» y los accesos rápidos del Resumen.
 */

import { ArrowRight, Map, PlayCircle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { ADMIN_SECTIONS, ADMIN_TASKS, HOME_AREAS, QUICK_TASKS, taskSteps, type AdminTab, type AdminTask } from "@/lib/admin/nav"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { AdminCard } from "@/components/admin/ui"

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

export function GuidePanel({ onGo, onTask, onStartTour }: { onGo: (tab: AdminTab, sub?: string) => void; onTask: (task: AdminTask) => void; onStartTour?: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-8">
      {/* Recorrido completo del panel (docs/282): vuelve al Inicio y lo abre. */}
      {onStartTour && (
        <button
          type="button"
          onClick={() => {
            onGo("resumen")
            onStartTour()
          }}
          className="group flex w-full items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-left transition-colors hover:border-primary"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PlayCircle className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">{t("admin_tour_restart")}</span>
            <span className="block text-sm text-muted-foreground">{t("admin_tour_restart_desc")}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </button>
      )}
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {HOME_AREAS.map((id) => {
            const section = ADMIN_SECTIONS[id]
            const Icon = SECTION_ICONS[id]
            return (
              <Card key={id}>
                <CardContent className="space-y-3 p-6">
                  <button type="button" onClick={() => onGo(id)} className="group flex items-center gap-2 text-left text-base font-semibold text-foreground hover:text-primary">
                    <Icon className="h-5 w-5 text-primary" />
                    {t(section.label)}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  <p className="text-sm text-muted-foreground">{t(section.desc)}</p>
                  {section.subs && (
                    <ul className="space-y-1.5 border-l border-border pl-3">
                      {section.subs.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => onGo(id, s.id)} className="text-left text-sm">
                            <span className="font-medium text-foreground hover:text-primary">{t(s.label)}</span>
                            <span className="text-muted-foreground"> · {t(s.desc)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
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
