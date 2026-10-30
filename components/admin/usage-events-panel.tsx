"use client"

/**
 * /admin → Uso de la app → Importaciones (docs/208): importaciones masivas (con formato y filas)
 * y descargas del manual, por cuenta. Datos de /api/admin/usage-events.
 */

import { useEffect, useMemo, useState } from "react"
import { BookOpen, FileSpreadsheet, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { useAdminLiveReload } from "@/components/admin/live"
import { formatDateTime } from "@/lib/date-format"
import { cn } from "@/lib/utils"
import type { TranslationKey } from "@/lib/i18n/translations"

interface UsageEvent {
  createdAt: string
  email: string
  kind: string
  format: string | null
  count: number | null
  file: string | null
  language: string | null
}
interface UsageData {
  totals: { imports7: number; imports30: number; importRows30: number; manual7: number; manual30: number; manualAccounts30: number }
  byKind30: Record<string, number>
  byFormat30: Record<string, number>
  events: UsageEvent[]
}

const KIND_KEY: Record<string, TranslationKey> = {
  ingredientes: "nav_ingredientes",
  recetas: "nav_mis_recetas",
  inventario: "nav_inventario",
  estadisticas: "nav_ventas",
  manual: "admin_usage_manual",
}

type Filter = "all" | "imports" | "manual"

export function UsageEventsPanel() {
  const { t } = useLanguage()
  const [data, setData] = useState<UsageData | null>(null)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  const load = () =>
    fetch("/api/admin/usage-events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d)
        setError(false)
      })
      .catch(() => setError(true))
  useEffect(() => {
    load()
  }, [])
  useAdminLiveReload(load)

  const rows = useMemo(
    () => (data?.events ?? []).filter((e) => filter === "all" || (filter === "manual" ? e.kind === "manual" : e.kind !== "manual")),
    [data, filter],
  )
  const kindLabel = (k: string) => (KIND_KEY[k] ? t(KIND_KEY[k]) : k)
  const formatLabel = (f: string | null) => (f ? t(`admin_usage_format_${f}` as TranslationKey) : "—")

  if (error) return <p className="text-sm text-muted-foreground">{t("admin_usage_error")}</p>
  if (!data) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const stat = (label: string, value: number, sub?: string) => (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          {t("admin_usage_title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("admin_usage_desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stat(t("admin_usage_imports_7"), data.totals.imports7)}
          {stat(t("admin_usage_imports_30"), data.totals.imports30, t("admin_usage_rows").replace("{n}", String(data.totals.importRows30)))}
          {stat(t("admin_usage_manual_7"), data.totals.manual7)}
          {stat(t("admin_usage_manual_30"), data.totals.manual30, t("admin_usage_accounts").replace("{n}", String(data.totals.manualAccounts30)))}
        </div>

        {(Object.keys(data.byKind30).length > 0 || Object.keys(data.byFormat30).length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(data.byKind30).map(([k, n]) => (
              <span key={k} className="rounded-full border border-border px-2.5 py-1">
                {kindLabel(k)} · {n}
              </span>
            ))}
            {Object.entries(data.byFormat30).map(([f, n]) => (
              <span key={f} className="rounded-full bg-muted px-2.5 py-1">
                {formatLabel(f === "—" ? null : f)} · {n}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {(["all", "imports", "manual"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn("rounded-full border px-3 py-1 text-xs", filter === f ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}
            >
              {t(`admin_usage_filter_${f}` as TranslationKey)}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin_usage_empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("admin_usage_col_date")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin_usage_col_account")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin_usage_col_what")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin_usage_col_format")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("admin_usage_col_rows")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((e, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2">{e.email}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {e.kind === "manual" ? <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />}
                        {kindLabel(e.kind)}
                      </span>
                      {e.file && <span className="block max-w-[240px] truncate text-xs text-muted-foreground">{e.file}</span>}
                    </td>
                    <td className="px-3 py-2">{e.kind === "manual" ? (e.language || "—").toUpperCase() : formatLabel(e.format)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
