"use client"

/**
 * Un espacio de /admin (rediseño desde cero, docs/292). Arriba el nombre del espacio y para
 * qué sirve; debajo, TODAS sus partes como botones a la vista, agrupados por tema (nada
 * escondido en menús ni filas que se corren de lado); y debajo, la parte elegida con su
 * nombre y qué muestra. Cambiar de parte no cambia de pantalla: el contenido aparece abajo.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { ChevronDown, Lightbulb } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { partInfo, spaceHowTo, spaceParts, type AdminPartRef, type AdminSpace } from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

const HOWTO_KEY = "gm_admin_howto_open"
export const partKey = (p: AdminPartRef) => `${p.tab}:${p.sub}`

export function SpaceView({
  space,
  active,
  content,
  counts,
  banner,
  onOpen,
}: {
  space: AdminSpace
  active: AdminPartRef
  /** Contenido de cada parte, por `tab:sub`. */
  content: Record<string, React.ReactNode>
  /** Número junto a una parte (p. ej. chats esperando), por `tab:sub`. */
  counts?: Record<string, number>
  banner?: React.ReactNode
  onOpen: (part: AdminPartRef) => void
}) {
  const { t } = useLanguage()
  const all = spaceParts(space)
  const info = partInfo(active.tab, active.sub)
  const steps = spaceHowTo(space, t)
  const [howOpen, setHowOpen] = useState(false)
  useEffect(() => {
    try {
      setHowOpen((JSON.parse(localStorage.getItem(HOWTO_KEY) || "{}") as Record<string, boolean>)[space.id] ?? false)
    } catch {
      setHowOpen(false)
    }
  }, [space.id])
  const toggleHow = () => {
    const next = !howOpen
    setHowOpen(next)
    try {
      const saved = JSON.parse(localStorage.getItem(HOWTO_KEY) || "{}") as Record<string, boolean>
      localStorage.setItem(HOWTO_KEY, JSON.stringify({ ...saved, [space.id]: next }))
    } catch {}
  }

  return (
    <div className="space-y-6" data-admin-space-view={space.id}>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t(space.label)}</h2>
        <p className="max-w-3xl text-muted-foreground">{t(space.desc)}</p>
        {steps.length > 0 && (
          <button type="button" onClick={toggleHow} aria-expanded={howOpen} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Lightbulb className="h-4 w-4" />
            {t("admin_howto_title")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", howOpen && "rotate-180")} />
          </button>
        )}
        {howOpen && steps.length > 0 && (
          <ol className="max-w-3xl space-y-2 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-primary">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {all.length > 1 && (
        <nav aria-label={t(space.label)} className="space-y-3 rounded-2xl border border-border bg-background p-3 sm:p-4" data-admin-parts>
          {space.groups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
              {group.label && <span className="shrink-0 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:w-36">{t(group.label)}</span>}
              <div className="flex flex-wrap gap-2">
                {group.parts.map((p) => {
                  const pi = partInfo(p.tab, p.sub)
                  if (!pi || content[partKey(p)] === undefined) return null
                  const isActive = partKey(p) === partKey(active)
                  const n = counts?.[partKey(p)]
                  return (
                    <button
                      key={partKey(p)}
                      type="button"
                      data-admin-part={p.sub}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => onOpen(p)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {t(pi.label)}
                      {n ? (
                        <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>{n}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      )}

      {banner}

      <section data-admin-block={active.sub} className="space-y-4">
        {all.length > 1 && info && (
          <div className="space-y-1 border-b border-border pb-3">
            <h3 className="text-lg font-semibold text-foreground">{t(info.label)}</h3>
            <p className="text-sm text-muted-foreground">{t(info.desc)}</p>
          </div>
        )}
        <div className="space-y-6">{content[partKey(active)]}</div>
      </section>
    </div>
  )
}
