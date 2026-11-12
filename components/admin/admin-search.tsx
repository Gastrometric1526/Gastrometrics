"use client"

/**
 * Buscador «¿Qué quieres hacer?» de /admin (docs/279): escribe lo que necesitas («cambiar
 * plan», «respaldo», «chat») y te lleva a la sección o te dice cómo hacerlo. Ctrl/⌘ + K lo abre.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, BookOpen, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/contexts/language-context"
import { searchAdmin, type AdminSearchResult, type AdminTask, type AdminTab } from "@/lib/admin/nav"
import { SECTION_ICONS } from "@/components/admin/admin-nav"
import { cn } from "@/lib/utils"

export function AdminSearch({
  onGo,
  onTask,
  className,
}: {
  onGo: (tab: AdminTab, sub?: string) => void
  onTask: (task: AdminTask) => void
  className?: string
}) {
  const { t } = useLanguage()
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const results = useMemo(() => searchAdmin(q, t), [q, t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [])

  const choose = (r: AdminSearchResult) => {
    if (r.kind === "task") onTask(r.task)
    else onGo(r.tab, r.sub)
    setQ("")
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        maxLength={80}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault()
            choose(results[active])
          } else if (e.key === "Escape") {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
        placeholder={t("admin_search_placeholder")}
        aria-label={t("admin_search_placeholder")}
        className="h-10 pl-9 pr-14"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground sm:block">Ctrl K</kbd>
      {open && q.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("admin_search_empty")}</p>
          ) : (
            <ul role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((r, i) => {
                const Icon = r.kind === "task" ? BookOpen : SECTION_ICONS[r.tab]
                return (
                  <li key={`${r.kind}-${r.kind === "task" ? r.task.id : `${r.tab}-${r.sub ?? ""}`}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(r)}
                      className={cn("flex w-full items-start gap-3 px-4 py-2.5 text-left", i === active ? "bg-muted" : "")}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{r.title}</span>
                          <span className="shrink-0 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                            {r.kind === "task" ? t("admin_search_kind_task") : t("admin_search_kind_section")}
                          </span>
                        </span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{r.detail}</span>
                      </span>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
