"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { formatDate, toIsoDate } from "@/lib/date-format"
import { summarizeCashUps } from "@/lib/cash-up"
import type { SalesImport } from "@/types/sales-import"

type Range = "7" | "30" | "90"

/**
 * Resumen de cuadres de caja (docs/217): días cuadrados, faltantes y sobrantes del período,
 * días sin cuadre y los días con diferencia (con botón para abrir su cuadre).
 */
export function CashUpSummaryCard({ imports, onOpenDay }: { imports: SalesImport[]; onOpenDay: (importId: string) => void }) {
  const { t } = useLanguage()
  const [range, setRange] = useState<Range>("30")
  const summary = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - (Number(range) - 1))
    return summarizeCashUps(imports, { from: toIsoDate(from) })
  }, [imports, range])

  if (!imports.some((imp) => imp.source === "manual" && imp.lines.length > 0)) return null
  const dayLabel = (day: string) => formatDate(new Date(`${day}T00:00:00`))
  const byDay = new Map(imports.map((imp) => [imp.id, imp]))
  const pendingIds = imports
    .filter((imp) => imp.source === "manual" && !imp.cashUp && imp.lines.length > 0)
    .map((imp) => imp.id)

  return (
    <Card data-tour="ventas-cashup-card">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            {t("cashup_summary_title")}
          </CardTitle>
          <CardDescription>{t("cashup_summary_desc")}</CardDescription>
        </div>
        <div className="flex gap-1.5">
          {(["7", "30", "90"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {t("ventas_range_days").replace("{n}", r)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label={t("cashup_kpi_closed")} value={`${summary.closed} / ${summary.daysWithSales}`} />
          <Kpi label={t("cashup_kpi_balanced")} value={String(summary.balanced)} />
          <Kpi label={t("cashup_kpi_short")} value={summary.shortTotal ? `− ${formatCurrency(-summary.shortTotal)}` : formatCurrency(0)} tone={summary.shortTotal ? "bad" : undefined} />
          <Kpi label={t("cashup_kpi_over")} value={summary.overTotal ? `+${formatCurrency(summary.overTotal)}` : formatCurrency(0)} />
        </div>

        {summary.withDifference.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("cashup_days_with_difference")}</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {summary.withDifference.map((d) => (
                <li key={d.importId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {dayLabel(d.day)} · <span className="text-muted-foreground">{t(`cashup_status_${d.result.status}` as never)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={d.result.totalDifference < 0 ? "whitespace-nowrap font-semibold tabular-nums text-red-700 dark:text-red-300" : "whitespace-nowrap font-semibold tabular-nums"}>
                      {d.result.totalDifference > 0 ? "+" : d.result.totalDifference < 0 ? "− " : ""}
                      {formatCurrency(Math.abs(d.result.totalDifference))}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => onOpenDay(d.importId)}>
                      {t("cashup_open")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.pendingDays.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("cashup_pending_days").replace("{n}", String(summary.pendingDays.length))}</p>
            <div className="flex flex-wrap gap-1.5">
              {pendingIds
                .map((id) => byDay.get(id)!)
                .filter((imp) => summary.pendingDays.includes(toIsoDate(new Date(imp.periodStart || imp.importedAt))))
                .slice(0, 14)
                .map((imp) => (
                  <Button key={imp.id} size="sm" variant="outline" onClick={() => onOpenDay(imp.id)}>
                    {formatDate(new Date(imp.periodStart || imp.importedAt))}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
      <p className={tone === "bad" ? "truncate text-lg font-semibold tabular-nums text-red-700 dark:text-red-300" : "truncate text-lg font-semibold tabular-nums text-foreground"}>{value}</p>
    </div>
  )
}
