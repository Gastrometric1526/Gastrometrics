"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { LayoutGrid } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { toIsoDate } from "@/lib/date-format"
import { summarizeTickets, ticketsCount, type GroupRow } from "@/lib/manual-sales"
import type { SalesImport } from "@/types/sales-import"

type Range = "7" | "30" | "90" | "all"

/**
 * Detalle por mesas de las ventas manuales (docs/215): ranking de mesas, ticket promedio,
 * gasto por persona, propinas, y el reparto por canal, mesero, forma de pago y hora.
 * Solo cuenta los registros con cuentas (desde docs/215); los anteriores no tienen mesa.
 */
export function TableSalesInsights({ imports }: { imports: SalesImport[] }) {
  const { t } = useLanguage()
  const [range, setRange] = useState<Range>("30")

  const insights = useMemo(() => {
    if (range === "all") return summarizeTickets(imports)
    const from = new Date()
    from.setDate(from.getDate() - (Number(range) - 1))
    return summarizeTickets(imports, { from: toIsoDate(from) })
  }, [imports, range])

  const hasAnyTickets = useMemo(() => imports.some((imp) => imp.source === "manual" && imp.tickets?.length), [imports])
  if (!hasAnyTickets) return null

  const channel = (k: string) => t(`ventas_channel_${k}` as never)
  const payment = (k: string) => t(`ventas_payment_${k}` as never)
  const hour = (k: string) => `${k.padStart(2, "0")}:00`

  return (
    <Card data-tour="ventas-tables-card">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-primary" />
            {t("ventas_tables_title")}
          </CardTitle>
          <CardDescription>{t("ventas_tables_desc")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["7", "30", "90", "all"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "all" ? t("ventas_range_all") : t("ventas_range_days").replace("{n}", r)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {insights.tickets === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ventas_tables_empty_range")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label={t("ventas_kpi_tickets")} value={String(insights.tickets)} />
              <Kpi label={t("ventas_avg_ticket")} value={formatCurrency(insights.avgTicket)} />
              <Kpi label={t("ventas_kpi_per_guest")} value={insights.perGuest !== null ? formatCurrency(insights.perGuest) : "—"} hint={insights.guests ? t("ventas_kpi_guests").replace("{n}", String(insights.guests)) : t("ventas_kpi_no_guests")} />
              <Kpi label={t("ventas_tips_total")} value={formatCurrency(insights.tips)} hint={insights.discounts ? `${t("ventas_kpi_discounts")}: ${formatCurrency(insights.discounts)}` : undefined} />
            </div>

            {insights.byTable.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ventas_table_label")}</TableHead>
                      <TableHead className="text-right">{t("ventas_kpi_tickets")}</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">{t("ventas_guests_label")}</TableHead>
                      <TableHead className="text-right">{t("ventas_col_sales")}</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">{t("ventas_avg_ticket")}</TableHead>
                      <TableHead className="hidden min-w-[120px] md:table-cell">{t("ventas_col_share")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insights.byTable.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium text-foreground">{t("ventas_ticket_table_label").replace("{table}", r.key)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.tickets}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.guests || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(r.avgTicket)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <ShareBar share={r.share} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Breakdown title={t("ventas_by_channel")} rows={insights.byChannel} label={channel} />
              <Breakdown title={t("ventas_by_payment")} rows={insights.byPayment} label={payment} empty={t("ventas_by_empty_payment")} />
              <Breakdown title={t("ventas_by_waiter")} rows={insights.byWaiter} label={(k) => k} empty={t("ventas_by_empty_waiter")} />
              <Breakdown title={t("ventas_by_hour")} rows={insights.byHour} label={hour} empty={t("ventas_by_empty_hour")} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 min-w-0">
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-xs leading-tight text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ShareBar({ share }: { share: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 flex-1 rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.min(share, 100)}%` }} />
      </span>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{share.toFixed(0)}%</span>
    </div>
  )
}

function Breakdown({ title, rows, label, empty }: { title: string; rows: GroupRow[]; label: (key: string) => string; empty?: string }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1 text-sm" title={`${t("ventas_avg_ticket")}: ${formatCurrency(r.avgTicket)}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{label(r.key)}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(r.revenue)} · {ticketsCount(r.tickets, t as (k: string) => string)}
                </span>
              </div>
              <span className="block h-1.5 rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.min(r.share, 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
