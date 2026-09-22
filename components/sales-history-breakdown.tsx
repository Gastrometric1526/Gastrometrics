"use client"

import { useMemo, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDays, Info, Download } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { aggregateSalesByPeriod, type SalesGranularity } from "@/lib/sales-analytics"
import { getBusinessById } from "@/lib/storage/businesses"
import { downloadSalesHistoryPDF } from "@/lib/pdf/sales-history-pdf-generator"
import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

type RangeOption = "7" | "30" | "90" | "all" | "custom"

interface SalesHistoryBreakdownProps {
  salesImports: SalesImport[]
  recipes: Recipe[]
  menus: Menu[]
  /** Para el encabezado del PDF exportado (nombre/logo real del negocio) — se omite en la vista combinada de Reportes, donde no hay un solo negocio dueño de los datos. */
  businessId?: string
  /** Presente cuando este desglose combina más de un negocio (vista de Reportes a nivel Dashboard). */
  combinedBusinessCount?: number
}

// Desglose e historial de ventas — pedido explícito del dueño del proyecto: "en la
// ventana de ventas debería de haber todo un breakdown también e historial según días
// y demás", después ampliado a "ver en ciertas fechas... exportar en pdfs... por día,
// semana o mes o año" — así que agrupa por período seleccionable (no solo por día) y
// permite tanto un rango preestablecido como uno personalizado (dos fechas), además
// de descargar exactamente lo que se está viendo como PDF. Se usa tal cual en
// app/ventas/page.tsx (un solo negocio, donde se REGISTRA la venta) y en
// components/estadisticas-finanzas-tab.tsx (donde se LEE/analiza — ahí puede llegar
// ya combinado entre negocios, ver combinedBusinessCount).
export function SalesHistoryBreakdown({
  salesImports,
  recipes,
  menus,
  businessId,
  combinedBusinessCount,
}: SalesHistoryBreakdownProps) {
  const { t } = useLanguage()
  const [range, setRange] = useState<RangeOption>("30")
  const [granularity, setGranularity] = useState<SalesGranularity>("day")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const allPeriods = useMemo(
    () => aggregateSalesByPeriod(salesImports, recipes, menus, granularity),
    [salesImports, recipes, menus, granularity],
  )

  const periods = useMemo(() => {
    if (range === "all") return allPeriods
    if (range === "custom") {
      if (!customFrom && !customTo) return allPeriods
      return allPeriods.filter((p) => (!customFrom || p.endDate >= customFrom) && (!customTo || p.startDate <= customTo))
    }
    const limit = Number.parseInt(range, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - limit)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return allPeriods.filter((p) => p.endDate >= cutoffStr)
  }, [allPeriods, range, customFrom, customTo])

  const formatPeriodLabel = (startDate: string, endDate: string) => {
    const start = new Date(`${startDate}T00:00:00`)
    if (granularity === "day") {
      return start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    }
    if (granularity === "week") {
      const end = new Date(`${endDate}T00:00:00`)
      return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
    }
    if (granularity === "month") {
      return start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    }
    return start.getFullYear().toString()
  }

  const chartAxisLabel = (startDate: string) => {
    const start = new Date(`${startDate}T00:00:00`)
    if (granularity === "year") return start.getFullYear().toString()
    if (granularity === "month") return start.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    return start.toLocaleDateString(undefined, { day: "numeric", month: "short" })
  }

  const chartData = useMemo(
    () =>
      [...periods]
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
        .map((p) => ({ label: chartAxisLabel(p.startDate), revenue: p.revenue, startDate: p.startDate, endDate: p.endDate })),
    [periods, granularity],
  )

  const totals = useMemo(() => {
    const revenue = periods.reduce((sum, p) => sum + p.revenue, 0)
    const quantitySold = periods.reduce((sum, p) => sum + p.quantitySold, 0)
    const theoreticalCost = periods.reduce((sum, p) => sum + p.theoreticalCost, 0)
    const margin = revenue - theoreticalCost
    return {
      revenue,
      quantitySold,
      margin,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      avgTicket: quantitySold > 0 ? revenue / quantitySold : 0,
    }
  }, [periods])

  const rangeLabel = (): string => {
    if (range === "7") return t("sales_history_range_7")
    if (range === "30") return t("sales_history_range_30")
    if (range === "90") return t("sales_history_range_90")
    if (range === "all") return t("sales_history_range_all")
    return customFrom || customTo ? `${customFrom || "…"} → ${customTo || "…"}` : t("sales_history_range_all")
  }

  const handleExportPDF = () => {
    const business = businessId ? getBusinessById(businessId) : null
    downloadSalesHistoryPDF(periods, {
      businessName: business?.name,
      businessLogo: business?.logo,
      businessId,
      granularity,
      rangeLabel: rangeLabel(),
    })
  }

  if (allPeriods.length === 0) {
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
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-chart-3" />
              {t("sales_history_title")}
            </CardTitle>
            <CardDescription>{t("sales_history_desc")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 shrink-0" disabled={periods.length === 0}>
            <Download className="h-4 w-4" />
            {t("sales_history_export_pdf")}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("sales_history_granularity_label")}</Label>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as SalesGranularity)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t("sales_history_gran_day")}</SelectItem>
                <SelectItem value="week">{t("sales_history_gran_week")}</SelectItem>
                <SelectItem value="month">{t("sales_history_gran_month")}</SelectItem>
                <SelectItem value="year">{t("sales_history_gran_year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("sales_history_range_label")}</Label>
            <Select value={range} onValueChange={(v) => setRange(v as RangeOption)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("sales_history_range_7")}</SelectItem>
                <SelectItem value="30">{t("sales_history_range_30")}</SelectItem>
                <SelectItem value="90">{t("sales_history_range_90")}</SelectItem>
                <SelectItem value="all">{t("sales_history_range_all")}</SelectItem>
                <SelectItem value="custom">{t("sales_history_range_custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("sales_history_from_label")}</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full sm:w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("sales_history_to_label")}</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full sm:w-40" />
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {combinedBusinessCount && combinedBusinessCount > 1 && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("sales_history_combined_notice").replace("{count}", String(combinedBusinessCount))}</span>
          </div>
        )}

        {periods.length === 0 ? (
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
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={56}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v))}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload ? formatPeriodLabel(payload[0].payload.startDate, payload[0].payload.endDate) : ""
                  }
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
              {periods.map((period) => (
                <AccordionItem key={period.periodKey} value={period.periodKey}>
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-2">
                      <span className="font-medium text-left">{formatPeriodLabel(period.startDate, period.endDate)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="tabular-nums">
                          {formatCurrency(period.revenue)}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {period.quantitySold} {t("sales_history_units_suffix")}
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
                        {period.dishes.map((dish) => (
                          <TableRow key={`${period.periodKey}-${dish.recipeId || dish.name}`}>
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
