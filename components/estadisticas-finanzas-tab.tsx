"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  UploadCloud,
  TrendingUp,
  TrendingDown,
  Scale,
  Percent,
  Trash2,
  Sparkles,
  Beef,
  Puzzle,
  Dog,
  AlertTriangle,
  Calculator,
} from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getInventoryHistory, getInventoryStats, ensureInventoryLoaded, ensureInventoryHistoryLoaded } from "@/lib/storage/inventory"
import { getPurchaseOrders, ensurePurchaseOrdersLoaded } from "@/lib/storage/purchase-orders"
import { getBusinessById, refreshBusinesses } from "@/lib/storage/businesses"
import { getSalesImports, deleteSalesImport, ensureSalesImportsLoaded } from "@/lib/storage/sales-imports"
import {
  aggregateSalesByDish,
  classifyMenuEngineering,
  computeCOGS,
  computePrimeCost,
  prorateMonthlyExpense,
  computeInventoryTurnover,
  computeVariance,
  buildSimplifiedPnL,
  computeSupplierPriceVariance,
  type MenuEngineeringClass,
} from "@/lib/sales-analytics"
import { POSSalesImportDialog } from "@/components/pos-sales-import-dialog"
import { FinanzasCalculationDialog } from "@/components/finanzas-calculation-dialog"
import { useLanguage } from "@/contexts/language-context"
import type { SalesImport } from "@/types/sales-import"

export function EstadisticasFinanzasTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage()

  const classificationMeta: Record<MenuEngineeringClass, { label: string; icon: any; color: string; desc: string }> = {
    estrella: { label: t("finanzas_class_estrella_label"), icon: Sparkles, color: "text-chart-1", desc: t("finanzas_class_estrella_desc") },
    vaca: { label: t("finanzas_class_vaca_label"), icon: Beef, color: "text-chart-4", desc: t("finanzas_class_vaca_desc") },
    puzzle: { label: t("finanzas_class_puzzle_label"), icon: Puzzle, color: "text-chart-2", desc: t("finanzas_class_puzzle_desc") },
    perro: { label: t("finanzas_class_perro_label"), icon: Dog, color: "text-chart-3", desc: t("finanzas_class_perro_desc") },
  }

  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isCalcInfoOpen, setIsCalcInfoOpen] = useState(false)
  const [salesImports, setSalesImports] = useState<SalesImport[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // BUG CORREGIDO: el estado inicial se cargaba una sola vez con un inicializador
  // perezoso de useState (solo corre al montar) — al cambiar de negocio sin
  // desmontar este componente (el sidebar solo cambia el query string, misma ruta),
  // salesImports se quedaba con los datos del negocio anterior mientras el resto
  // de los datos (recipes, ingredients, etc., todos useMemo con [businessId]) sí
  // se actualizaban correctamente.
  useEffect(() => {
    let cancelled = false
    ensureSalesImportsLoaded(businessId).then(() => {
      if (!cancelled) setSalesImports(getSalesImports(businessId))
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  // Carga real desde Supabase (ver docs/52) — los useMemo de abajo siguen leyendo la
  // caché en memoria de forma síncrona, así que necesitan que la carga real ya haya
  // resuelto al menos una vez; refreshKey ya existía para forzar recálculo, se
  // reutiliza aquí para que los useMemo se vuelvan a evaluar una vez la carga termina.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      ensureRecipesLoaded(businessId),
      ensureIngredientsLoaded(businessId),
      ensurePurchaseOrdersLoaded(businessId),
      ensureInventoryLoaded(businessId),
      ensureInventoryHistoryLoaded(businessId),
      refreshBusinesses(),
    ]).then(() => {
      if (!cancelled) setRefreshKey((k) => k + 1)
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const recipes = useMemo(() => getRecipes(businessId), [businessId, refreshKey])
  const ingredients = useMemo(() => getIngredients(businessId), [businessId, refreshKey])
  const purchaseOrders = useMemo(() => getPurchaseOrders(businessId), [businessId, refreshKey])
  const inventoryHistory = useMemo(() => getInventoryHistory(businessId), [businessId, refreshKey])
  const inventoryStats = useMemo(() => getInventoryStats(businessId), [businessId, refreshKey])
  const business = useMemo(() => getBusinessById(businessId || "main"), [businessId, refreshKey])

  const handleImported = (imp: SalesImport) => {
    setSalesImports((prev) => [imp, ...prev])
    setRefreshKey((k) => k + 1)
  }

  const handleDeleteImport = async (id: string) => {
    setSalesImports((prev) => prev.filter((i) => i.id !== id))
    await deleteSalesImport(id, businessId)
  }

  // Periodo cubierto: la union de todas las importaciones cargadas (mas simple y
  // predecible que un selector de fechas para una primera version de este panel).
  const period = useMemo(() => {
    const starts = salesImports.map((i) => i.periodStart).filter(Boolean) as string[]
    const ends = salesImports.map((i) => i.periodEnd).filter(Boolean) as string[]
    return {
      start: starts.length > 0 ? new Date(Math.min(...starts.map((d) => new Date(d).getTime()))).toISOString() : null,
      end: ends.length > 0 ? new Date(Math.max(...ends.map((d) => new Date(d).getTime()))).toISOString() : null,
    }
  }, [salesImports])

  const dishPerformance = useMemo(() => aggregateSalesByDish(salesImports, recipes), [salesImports, recipes])
  const menuEngineering = useMemo(() => classifyMenuEngineering(dishPerformance), [dishPerformance])
  const avgPopularity = dishPerformance.length > 0 ? dishPerformance.reduce((s, d) => s + d.quantitySold, 0) / dishPerformance.length : 0
  const avgMargin = dishPerformance.length > 0 ? dishPerformance.reduce((s, d) => s + d.contributionMargin, 0) / dishPerformance.length : 0

  const totalRevenue = useMemo(() => dishPerformance.reduce((sum, d) => sum + d.revenue, 0), [dishPerformance])
  const totalTheoreticalCost = useMemo(() => dishPerformance.reduce((sum, d) => sum + d.theoreticalCost, 0), [dishPerformance])
  const theoreticalCostPercent = totalRevenue > 0 ? (totalTheoreticalCost / totalRevenue) * 100 : 0
  const totalContributionMargin = totalRevenue - totalTheoreticalCost

  const cogsResult = useMemo(
    () =>
      computeCOGS({
        snapshots: inventoryHistory,
        purchaseOrders,
        periodStart: period.start,
        periodEnd: period.end,
        currentInventoryValue: inventoryStats.totalValue,
      }),
    [inventoryHistory, purchaseOrders, period, inventoryStats.totalValue],
  )

  const realCostPercent = totalRevenue > 0 ? (cogsResult.cogs / totalRevenue) * 100 : 0
  const variance = computeVariance(realCostPercent, theoreticalCostPercent)

  const laborCostForPeriod = prorateMonthlyExpense(business?.expenses?.laborCosts || 0, period.start, period.end)
  const primeCostResult = computePrimeCost(cogsResult.cogs, laborCostForPeriod, totalRevenue)

  const inventoryTurnover = computeInventoryTurnover(cogsResult.cogs, cogsResult.initialInventoryValue, cogsResult.finalInventoryValue)

  const pnl = useMemo(
    () =>
      buildSimplifiedPnL({
        revenue: totalRevenue,
        cogs: cogsResult.cogs,
        expenses: business?.expenses,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    [totalRevenue, cogsResult.cogs, business, period],
  )

  const supplierVariance = useMemo(() => computeSupplierPriceVariance(ingredients), [ingredients])

  const topMargin = [...dishPerformance].sort((a, b) => b.contributionMargin - a.contributionMargin).slice(0, 8)
  const bottomMargin = [...dishPerformance].sort((a, b) => a.contributionMargin - b.contributionMargin).slice(0, 8)

  const varianceLabel =
    Math.abs(variance) < 3
      ? t("finanzas_variance_excellent")
      : Math.abs(variance) < 5
        ? t("finanzas_variance_acceptable")
        : t("finanzas_variance_serious")
  const varianceColor = Math.abs(variance) < 3 ? "text-chart-2" : Math.abs(variance) < 5 ? "text-chart-4" : "text-destructive"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("finanzas_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("finanzas_subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {salesImports.length > 0 && (
            <Button variant="outline" onClick={() => setIsCalcInfoOpen(true)} className="gap-2">
              <Calculator className="h-4 w-4" />
              {t("finanzas_calc_info_button")}
            </Button>
          )}
          <Button data-tour="finanzas-import-pos" onClick={() => setIsImportOpen(true)} className="gap-2">
            <UploadCloud className="h-4 w-4" />
            {t("finanzas_import_button")}
          </Button>
        </div>
      </div>

      {salesImports.length === 0 ? (
        <Card className="border-2 border-dashed border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GastrometricsLogo className="h-24 w-24 opacity-[0.08] mb-4" />
            <h3 className="text-lg font-bold mb-2">{t("finanzas_empty_title")}</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-4">{t("finanzas_empty_desc")}</p>
            <Button onClick={() => setIsImportOpen(true)} className="gap-2">
              <UploadCloud className="h-4 w-4" />
              {t("finanzas_import_button")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tarjetas principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="finanzas-key-cards">
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_total_sales")}</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_real_food_cost")}</p>
                <p className="text-2xl font-bold tabular-nums">{realCostPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(cogsResult.cogs)} {t("finanzas_card_cogs_suffix")}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_theoretical_food_cost")}</p>
                <p className="text-2xl font-bold tabular-nums">{theoreticalCostPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("finanzas_card_theoretical_sub")}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_variance")}</p>
                <p className={`text-2xl font-bold tabular-nums ${varianceColor}`}>
                  {variance >= 0 ? "+" : ""}
                  {variance.toFixed(1)}%
                </p>
                <p className={`text-xs mt-0.5 ${varianceColor}`}>{varianceLabel}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_prime_cost")}</p>
                <p className="text-2xl font-bold tabular-nums">{primeCostResult.primeCostPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("finanzas_prime_cost_sub")}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_contribution_margin")}</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalContributionMargin)}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_inventory_turnover")}</p>
                <p className="text-2xl font-bold tabular-nums">{inventoryTurnover.toFixed(2)}x</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("finanzas_turnover_sub")}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("finanzas_card_net_profit")}</p>
                <p className={`text-2xl font-bold tabular-nums ${pnl.netProfit >= 0 ? "" : "text-destructive"}`}>
                  {formatCurrency(pnl.netProfit)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{pnl.netProfitPercent.toFixed(1)}% {t("finanzas_net_profit_percent_suffix")}</p>
              </CardContent>
            </Card>
          </div>

          {!cogsResult.hasFullData && (
            <div className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                {t("finanzas_no_full_data_before")}{" "}
                <span className="font-medium">{t("nav_inventario")}</span> {t("finanzas_no_full_data_after")}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Margen de contribución por plato */}
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-1" />
                  {t("finanzas_best_contribution_margin_title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, topMargin.length * 26)}>
                  <BarChart data={topMargin.map((d) => ({ name: d.name, margin: d.contributionMargin }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={128}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name)}
                    />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="margin" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-chart-3" />
                  {t("finanzas_lowest_contribution_margin_title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, bottomMargin.length * 26)}>
                  <BarChart data={bottomMargin.map((d) => ({ name: d.name, margin: d.contributionMargin }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={128}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name)}
                    />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(Number(v))}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="margin" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Menu Engineering */}
          <Card className="border-2 border-border shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t("finanzas_menu_engineering_title")}</CardTitle>
              <CardDescription>{t("finanzas_menu_engineering_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {(Object.keys(classificationMeta) as MenuEngineeringClass[]).map((cls) => {
                  const meta = classificationMeta[cls]
                  const Icon = meta.icon
                  const items = menuEngineering.filter((d) => d.classification === cls)
                  return (
                    <div key={cls} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="font-semibold text-sm">{meta.label}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {items.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.desc}</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {items.slice(0, 8).map((d) => (
                          <div key={d.recipeId || d.name} className="text-xs truncate" title={d.name}>
                            {d.name}
                          </div>
                        ))}
                        {items.length === 0 && <p className="text-xs text-muted-foreground italic">{t("finanzas_no_dishes")}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Tabla detallada por plato */}
          <Card className="border-2 border-border shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t("finanzas_dish_detail_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md max-h-96 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="min-w-[160px]">{t("finanzas_table_dish")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_qty")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_price")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_unit_cost")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_total_cost")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_margin")}</TableHead>
                      <TableHead className="text-right">{t("finanzas_table_margin_percent")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dishPerformance.map((d) => (
                      <TableRow key={d.recipeId || d.name}>
                        <TableCell className="text-sm max-w-[240px]">
                          <span className="truncate block" title={d.name}>
                            {d.name}
                          </span>
                          {!d.recipeId && (
                            <Badge variant="outline" className="mt-1 text-[10px] text-amber-700 dark:text-amber-300 border-amber-300">
                              {t("finanzas_unlinked_badge")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{d.quantitySold}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(d.unitPrice)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(d.unitCost)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(d.theoreticalCost)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(d.contributionMargin)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{d.contributionMarginPercent.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* P&L simplificado */}
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-chart-5" />
                  {t("finanzas_pnl_title")}
                </CardTitle>
                <CardDescription>{t("finanzas_pnl_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_sales")}</span><span className="tabular-nums font-medium">{formatCurrency(pnl.revenue)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_cogs")}</span><span className="tabular-nums">-{formatCurrency(pnl.cogs)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_labor_cost")}</span><span className="tabular-nums">-{formatCurrency(pnl.laborCost)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_rent")}</span><span className="tabular-nums">-{formatCurrency(pnl.rent)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_utilities")}</span><span className="tabular-nums">-{formatCurrency(pnl.utilities)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_operational_costs")}</span><span className="tabular-nums">-{formatCurrency(pnl.operationalCosts)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_marketing")}</span><span className="tabular-nums">-{formatCurrency(pnl.marketing)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("finanzas_pnl_other_expenses")}</span><span className="tabular-nums">-{formatCurrency(pnl.otherExpenses)}</span></div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between font-bold">
                  <span>{t("finanzas_card_net_profit")}</span>
                  <span className={`tabular-nums ${pnl.netProfit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {formatCurrency(pnl.netProfit)} ({pnl.netProfitPercent.toFixed(1)}%)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Varianza de precios de proveedores */}
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4 text-chart-3" />
                  {t("finanzas_supplier_variance_title")}
                </CardTitle>
                <CardDescription>{t("finanzas_supplier_variance_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {supplierVariance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("finanzas_no_variance")}</p>
                ) : (
                  supplierVariance.map((v) => (
                    <div key={v.ingredientId} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate">{v.ingredientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.supplier || t("finanzas_no_supplier")}</p>
                      </div>
                      <span className={`font-semibold tabular-nums shrink-0 ${v.variancePercent > 0 ? "text-destructive" : "text-chart-2"}`}>
                        {v.variancePercent >= 0 ? "+" : ""}
                        {v.variancePercent.toFixed(1)}%
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Historial de importaciones */}
          <Card className="border-2 border-border shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t("finanzas_recent_imports_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {salesImports.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{imp.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(imp.importedAt).toLocaleString()} · {imp.lineCount} {t("finanzas_import_rows_suffix")} · {formatCurrency(imp.totalRevenue)}
                      {imp.unmatchedDishNames.length > 0 && ` · ${imp.unmatchedDishNames.length} ${t("finanzas_unlinked_badge")}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteImport(imp.id)} className="shrink-0">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <POSSalesImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        businessId={businessId}
        recipes={recipes}
        onImported={handleImported}
      />

      <FinanzasCalculationDialog
        open={isCalcInfoOpen}
        onOpenChange={setIsCalcInfoOpen}
        totalRevenue={totalRevenue}
        totalTheoreticalCost={totalTheoreticalCost}
        theoreticalCostPercent={theoreticalCostPercent}
        cogsResult={cogsResult}
        realCostPercent={realCostPercent}
        variance={variance}
        periodStart={period.start}
        periodEnd={period.end}
        laborCostMonthly={business?.expenses?.laborCosts || 0}
        laborCostForPeriod={laborCostForPeriod}
        primeCostResult={primeCostResult}
        totalContributionMargin={totalContributionMargin}
        inventoryTurnover={inventoryTurnover}
        pnl={pnl}
        supplierVarianceExample={supplierVariance[0] || null}
        dishCount={dishPerformance.length}
        avgPopularity={avgPopularity}
        avgMargin={avgMargin}
      />
    </div>
  )
}
