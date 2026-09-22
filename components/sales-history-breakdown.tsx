"use client"

import { useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDays, Info } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { aggregateSalesByDay } from "@/lib/sales-analytics"
import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

type RangeOption = "7" | "30" | "90" | "all"

interface SalesHistoryBreakdownProps {
  salesImports: SalesImport[]
  recipes: Recipe[]
  menus: Menu[]
  /** Presente cuando este desglose combina más de un negocio (vista de Reportes a nivel Dashboard). */
  combinedBusinessCount?: number
}

// Desglose e historial de ventas por día — pedido explícito del dueño del proyecto:
// "en la ventana de ventas debería de haber todo un breakdown también e historial
// según días y demás y obvio todos esos datos el usuario lo debería poder ver en
// reportes y demás". Se usa tal cual en app/ventas/page.tsx (una sola tienda/negocio,
// donde se REGISTRA la venta) y en components/estadisticas-finanzas-tab.tsx (donde se
// LEE/analiza — ahí puede llegar ya combinado entre negocios, ver combinedBusinessCount).
export function SalesHistoryBreakdown({
  salesImports,
  recipes,
  menus,
  combinedBusinessCount,
}: SalesHistoryBreakdownProps) {
  const { t } = useLanguage()
  const [range, setRange] = useState<RangeOption>("30")

  const allDays = useMemo(() => aggregateSalesByDay(salesImports, recipes, menus), [salesImports, recipes, menus])

  const days = useMemo(() => {
    if (range === "all") return allDays
    const limit = Number.parseInt(range, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - limit)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return allDays.filter((d) => d.date >= cutoffStr)
  }, [allDays, range])

  const chartData = useMemo(
    () =>
      [...days]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((d) => ({ date: d.date.slice(5), revenue: d.revenue, fullDate: d.date })),
    [days],
  )

  const totals = useMemo(() => {
    const revenue = days.reduce((sum, d) => sum + d.revenue, 0)
    const quantitySold = days.reduce((sum, d) => sum + d.quantitySold, 0)
    const theoreticalCost = days.reduce((sum, d) => sum + d.theoreticalCost, 0)
    const margin = revenue - theoreticalCost
    return {
      revenue,
      quantitySold,
      margin,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      avgTicket: quantitySold > 0 ? revenue / quantitySold : 0,
      activeDays: days.length,
    }
  }, [days])

  const formatDayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  }

  if (allDays.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-chart-3" />
            {t("sales_history_title")}
          </CardTitle>
          <CardDescription>{t("sales_history_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">{t("sales_history_empty")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-chart-3" />
            {t("sales_history_title")}
          </CardTitle>
          <CardDescription>{t("sales_history_desc")}</CardDescription>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeOption)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("sales_history_range_7")}</SelectItem>
            <SelectItem value="30">{t("sales_history_range_30")}</SelectItem>
            <SelectItem value="90">{t("sales_history_range_90")}</SelectItem>
            <SelectItem value="all">{t("sales_history_range_all")}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-5">
        {combinedBusinessCount && combinedBusinessCount > 1 && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("sales_history_combined_notice").replace("{count}", String(combinedBusinessCount))}</span>
          </div>
        )}

        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("sales_history_empty_range")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t("sales_history_kpi_revenue")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totals.revenue)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t("sales_history_kpi_units")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{totals.quantitySold.toLocaleString("en-US")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t("sales_history_kpi_avg_ticket")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totals.avgTicket)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{t("sales_history_kpi_margin")}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{totals.marginPercent.toFixed(1)}%</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={56}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v))}
                  labelFormatter={(_label, payload) => (payload?.[0]?.payload?.fullDate ? formatDayLabel(payload[0].payload.fullDate) : "")}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <Accordion type="single" collapsible className="w-full">
              {days.map((day) => (
                <AccordionItem key={day.date} value={day.date}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                      <span className="font-medium text-left">{formatDayLabel(day.date)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="tabular-nums">
                          {formatCurrency(day.revenue)}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {day.quantitySold} {t("sales_history_units_suffix")}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("sales_history_col_dish")}</TableHead>
                          <TableHead className="text-right">{t("sales_history_col_units")}</TableHead>
                          <TableHead className="text-right">{t("sales_history_col_revenue")}</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">{t("sales_history_col_margin")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {day.dishes.map((dish) => (
                          <TableRow key={`${day.date}-${dish.recipeId || dish.name}`}>
                            <TableCell className="max-w-[160px] truncate">{dish.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{dish.quantitySold}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(dish.revenue)}</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">
                              {dish.contributionMarginPercent.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  )
}
