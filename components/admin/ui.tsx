"use client"

/**
 * Kit visual de /admin (docs/195): las mismas piezas en todas las secciones para que el panel
 * se lea igual en todas partes — tarjeta con título + «¿qué es esto?», números grandes con su
 * comparación, barras con el valor escrito, estados con ícono y texto (nunca solo color),
 * y estados de carga/vacío/error. Cada número trae su explicación en `help`.
 */

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertTriangle, CheckCircle2, CircleHelp, HelpCircle, Inbox, RefreshCw, XCircle, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { useAdminTick } from "@/components/admin/live"
import { useLanguage } from "@/contexts/language-context"

// ─── datos ──────────────────────────────────────────────────────────────────

/** Pide un JSON de /api/admin y lo vuelve a pedir con cada actualización en vivo (docs/192). */
export function useAdminData<T>(url: string | null): { data: T | null; error: boolean; loading: boolean; reload: (fresh?: boolean) => void } {
  const tick = useAdminTick()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const load = useCallback(
    (fresh = false) => {
      if (!url) return
      const full = fresh ? `${url}${url.includes("?") ? "&" : "?"}fresh=1` : url
      fetch(full)
        .then(async (res) => {
          const json = await res.json()
          if (!alive.current) return
          if (!res.ok || json?.error) setError(true)
          else {
            setError(false)
            setData(json as T)
          }
        })
        .catch(() => alive.current && setError(true))
        .finally(() => alive.current && setLoading(false))
    },
    [url],
  )
  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [load, tick])
  return { data, error, loading, reload: load }
}

// ─── formato ────────────────────────────────────────────────────────────────

export function formatMoney(cents: number, currency = "usd"): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 })
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : `${value.toFixed(digits)}%`
}

/** Cambio porcentual entre dos valores (null si no hay base). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0
  return ((current - previous) / previous) * 100
}

// ─── piezas ─────────────────────────────────────────────────────────────────

export function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground hover:text-foreground align-middle" aria-label={text}>
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Tarjeta de sección: título con ícono, «?» con la explicación, acciones a la derecha. */
export function AdminCard({
  title,
  icon: Icon,
  description,
  help,
  actions,
  children,
  className = "",
}: {
  title: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  description?: React.ReactNode
  help?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span>{title}</span>
              {help && <HelpTip text={help} />}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

type Tone = "default" | "good" | "warn" | "bad"
const TONE_TEXT: Record<Tone, string> = { default: "text-foreground", good: "text-success", warn: "text-warning", bad: "text-destructive" }
const TONE_CHIP: Record<Tone, string> = { default: "bg-muted text-muted-foreground", good: "bg-success/10 text-success", warn: "bg-warning/10 text-warning", bad: "bg-destructive/10 text-destructive" }

/** Número grande con etiqueta, explicación, comparación y estado. */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  change,
  changeLabel,
  invertChange = false,
  help,
  loading = false,
  onClick,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tone?: Tone
  /** Cambio en % frente al período anterior. */
  change?: number | null
  changeLabel?: string
  /** true si bajar es bueno (p. ej. cancelaciones). */
  invertChange?: boolean
  help?: string
  loading?: boolean
  onClick?: () => void
}) {
  const body = (
    <CardContent className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {label}
          {help && <HelpTip text={help} />}
        </p>
        {Icon && (
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${TONE_CHIP[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className={`text-2xl font-semibold tabular-nums tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>}
      {!loading && (change !== undefined || sub) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {change !== undefined && <ChangeBadge change={change} invert={invertChange} />}
          {changeLabel && change !== undefined && <span>{changeLabel}</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </CardContent>
  )
  if (onClick) {
    return (
      <Card className="cursor-pointer transition-colors hover:border-primary/50" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}>
        {body}
      </Card>
    )
  }
  return <Card>{body}</Card>
}

export function ChangeBadge({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null) return <span className="text-muted-foreground">—</span>
  const rounded = Math.round(change)
  const good = invert ? rounded < 0 : rounded > 0
  const neutral = rounded === 0
  const Icon = neutral ? Minus : rounded > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${neutral ? "text-muted-foreground" : good ? "text-success" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  )
}

export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }
  return <div className={`grid grid-cols-2 md:grid-cols-3 ${map[cols]} gap-3`}>{children}</div>
}

export type Status = "ok" | "warn" | "bad" | "unknown"
const STATUS: Record<Status, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  ok: { icon: CheckCircle2, cls: "bg-success/10 text-success" },
  warn: { icon: AlertTriangle, cls: "bg-warning/10 text-warning" },
  bad: { icon: XCircle, cls: "bg-destructive/10 text-destructive" },
  unknown: { icon: HelpCircle, cls: "bg-muted text-muted-foreground" },
}

/** Estado con ícono y texto (nunca solo color). */
export function StatusPill({ status, label }: { status: Status; label: string }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <s.icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

/** Barras horizontales de un solo color con el valor escrito (ranking/composición). */
export function BarList({
  rows,
  format = (n: number) => String(n),
  empty,
  max: maxOverride,
}: {
  rows: { label: React.ReactNode; value: number; sub?: React.ReactNode; key?: string }[]
  format?: (n: number) => string
  empty?: string
  max?: number
}) {
  const { t } = useLanguage()
  if (rows.length === 0) return <EmptyState text={empty || t("admin_ui_empty")} />
  const max = maxOverride ?? Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.key ?? i} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-foreground font-medium">
              {format(r.value)}
              {total > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{Math.round((r.value / total) * 100)}%</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
          {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
        </li>
      ))}
    </ul>
  )
}

/** Barras por día (o semana) con el valor al pasar el mouse, máximo y fechas de los extremos. */
export function DailyBars({
  data,
  format = (n: number) => String(n),
  height = 120,
  labelFormat = (s: string) => s.slice(5).split("-").reverse().join("/"),
}: {
  data: { label: string; value: number }[]
  format?: (n: number) => string
  height?: number
  labelFormat?: (s: string) => string
}) {
  const { t } = useLanguage()
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return <EmptyState text={t("admin_ui_empty")} />
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)
  const shown = hover !== null ? data[hover] : null
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          {shown ? (
            <>
              <span className="text-foreground font-medium tabular-nums">{format(shown.value)}</span> · {labelFormat(shown.label)}
            </>
          ) : (
            <>
              {t("admin_ui_total")}: <span className="text-foreground font-medium tabular-nums">{format(total)}</span>
            </>
          )}
        </span>
        <span>
          {t("admin_ui_max")}: <span className="tabular-nums">{format(max)}</span>
        </span>
      </div>
      <div className="flex items-end gap-[2px] border-b border-border" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex-1 h-full flex items-end" onMouseEnter={() => setHover(i)} title={`${labelFormat(d.label)}: ${format(d.value)}`}>
            <div
              className={`w-full rounded-t-[3px] transition-colors ${hover === i ? "bg-primary" : d.value > 0 ? "bg-primary/60" : "bg-muted"}`}
              style={{ height: d.value > 0 ? `${Math.max(3, (d.value / max) * 100)}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{labelFormat(data[0].label)}</span>
        <span>{labelFormat(data[data.length - 1].label)}</span>
      </div>
    </div>
  )
}

export function EmptyState({ text, icon: Icon = Inbox }: { text: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
      <Icon className="h-5 w-5 opacity-60" />
      <p>{text}</p>
    </div>
  )
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
      <XCircle className="h-5 w-5 text-destructive" />
      <p>{t("admin_ui_error")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          {t("admin_ui_retry")}
        </Button>
      )}
    </div>
  )
}

/** Tabla simple y legible (encabezados en mayúscula chica, números a la derecha). */
export function SimpleTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; label: React.ReactNode; align?: "left" | "right" }[]
  rows: { key: string; cells: Record<string, React.ReactNode> }[]
  empty?: string
}) {
  const { t } = useLanguage()
  if (rows.length === 0) return <EmptyState text={empty || t("admin_ui_empty")} />
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className={`px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${c.align === "right" ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              {columns.map((c) => (
                <td key={c.key} className={`px-1 py-2 align-top ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {r.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
