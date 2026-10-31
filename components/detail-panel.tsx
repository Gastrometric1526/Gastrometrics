"use client"

import type { ComponentType, ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface DetailStat {
  label: string
  value: ReactNode
}

export interface DetailAction {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  /** La acción principal va primero y llena (las demás, con borde). */
  primary?: boolean
  disabled?: boolean
  /** Si es false, el panel no se cierra al tocarla (p. ej. abre algo encima). Por defecto se cierra. */
  closeOnClick?: boolean
}

/**
 * Panel de acciones de un elemento (docs/219), con el mismo diseño que el de una receta en
 * Mis Recetas: título y etiquetas, tarjetas de datos en 2 columnas, separador, acciones
 * apiladas (la principal primero) y abajo la acción de borrar. Se abre con un clic (o un
 * toque en el celular) sobre el elemento, en todas las secciones: reemplaza los menús de
 * tres puntos. Lleva `data-tour="detail-panel-actions"` para la pista de la primera vez.
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  badges = [],
  stats = [],
  actions = [],
  danger,
  actionsExtra,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  badges?: { label: string; tone?: "default" | "muted" | "accent" }[]
  stats?: DetailStat[]
  actions?: DetailAction[]
  danger?: Omit<DetailAction, "primary">
  /** Controles propios que van al final de la lista de acciones (p. ej. el menú «Enviar»). */
  actionsExtra?: ReactNode
  children?: ReactNode
}) {
  const run = (a: DetailAction | Omit<DetailAction, "primary">) => {
    a.onClick()
    if (a.closeOnClick !== false) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col overflow-y-auto"
        data-detail-panel=""
        // La pista de la primera vez vive en su propio portal (components/page-tour.tsx):
        // tocarla no es «tocar afuera», así que no cierra el panel (mismo arreglo que
        // components/settings-dialog.tsx).
        onInteractOutside={(event) => {
          if ((event.target as HTMLElement | null)?.closest("[data-gm-page-tour]")) event.preventDefault()
        }}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="pr-6">{title}</SheetTitle>
          {badges.length > 0 ? (
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {badges.map((b) => (
                  <Badge
                    key={b.label}
                    variant={b.tone === "accent" ? "secondary" : "outline"}
                    className={cn("text-xs", b.tone !== "accent" && "bg-muted text-muted-foreground")}
                  >
                    {b.label}
                  </Badge>
                ))}
              </div>
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 py-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3 min-w-0">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <div className="truncate text-lg font-semibold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {children}

        {(actions.length > 0 || actionsExtra) && (
          <>
            <Separator />
            <div className="flex flex-col gap-2 py-4" data-tour="detail-panel-actions">
              {actions.map((a) => (
                <Button
                  key={a.key}
                  variant={a.primary ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  disabled={a.disabled}
                  onClick={() => run(a)}
                >
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </Button>
              ))}
              {actionsExtra}
            </div>
          </>
        )}

        {danger && (
          <SheetFooter className="mt-auto">
            <Button variant="destructive" className="w-full justify-start gap-2" disabled={danger.disabled} onClick={() => run(danger)}>
              <danger.icon className="h-4 w-4" />
              {danger.label}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Props para que una fila o tarjeta abra su panel con un clic o con Enter/Espacio, sin
 * dispararse al tocar un botón, enlace o campo que esté adentro.
 */
export function openOnActivate(open: () => void) {
  const fromControl = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("button, a, input, select, textarea, label, [role=combobox], [role=menuitem], [data-no-panel]")
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      if (fromControl(e.target) && e.target !== e.currentTarget) return
      // Los clics dentro de un portal (popover, diálogo) suben por el árbol de React hasta
      // la fila aunque no estén dentro de ella en la página: esos no abren el panel.
      if (e.currentTarget instanceof Node && e.target instanceof Node && !e.currentTarget.contains(e.target)) return
      open()
    },
    onKeyDown: (e: { key: string; target: EventTarget | null; currentTarget: EventTarget | null; preventDefault: () => void }) => {
      if (e.target !== e.currentTarget) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        open()
      }
    },
  }
}
