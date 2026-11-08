"use client"

/**
 * Contador «● N en línea» del encabezado de /admin (pedido del dueño, docs/266): siempre a
 * la vista, sin entrar a Cuentas. Se actualiza cada 30 segundos mientras la pestaña está
 * visible. Al tocarlo muestra quiénes son y lleva a Cuentas.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/contexts/language-context"

interface Person {
  id: string
  name: string | null
  lastSeenAt: string
}

export function OnlineNow({ onOpenAccounts }: { onOpenAccounts: () => void }) {
  const { t } = useLanguage()
  const [count, setCount] = useState<number | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (document.visibilityState !== "visible") return
      try {
        const res = await fetch("/api/admin/presence", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { count: number; people: Person[] }
        if (cancelled) return
        setCount(data.count)
        setPeople(data.people)
      } catch {
        // Sin red: se queda el último número.
      }
    }
    load()
    const timer = setInterval(load, 30_000)
    const onVisible = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const online = (count ?? 0) > 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-accent ${
            online ? "border-success/40 bg-success-soft text-success" : "border-border text-muted-foreground"
          }`}
          aria-label={t("admin_online_now_label").replace("{count}", String(count ?? 0))}
        >
          <span className="relative flex h-2.5 w-2.5">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-success" : "bg-muted-foreground/40"}`} />
          </span>
          <span className="tabular-nums">{count === null ? "…" : count}</span>
          {t("admin_online_now")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <p className="text-sm font-medium text-foreground">{t("admin_online_now_title")}</p>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin_online_now_empty")}</p>
        ) : (
          <ul className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
                <span className="truncate">{p.name || t("admin_online_now_unnamed")}</span>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="outline" className="w-full" onClick={() => { setOpen(false); onOpenAccounts() }}>
          {t("admin_online_now_open")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
