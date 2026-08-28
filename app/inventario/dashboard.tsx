"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgeDelta, Metric, ProgressBar } from "@/components/ui/dashboard"
import { BarChart, LineChart, DonutChart } from "@/components/ui/charts"
import { Grid } from "@/components/ui/grid"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, AlertTriangle, Info, DollarSign, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import { formatCurrency } from "@/lib/currency"

interface DashboardProps {
  inventoryItems: InventoryItem[]
  inventoryHistory: InventorySnapshot[]
  isLoading: boolean
}

export function InventoryDashboard({ inventoryItems, inventoryHistory, isLoading }: DashboardProps) {
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const [timePeriod, setTimePeriod] = useState<"day" | "week" | "month">("week")
  const [categoryView, setCategoryView] = useState<"all" | "critical" | "low">("all")

  // Datos para gráficos
  const [chartData, setChartData] = useState<{
    valueHistory: { date: string; value: number }[]
    categoryDistribution: { name: string; value: number }[]
    stockLevels: { name: string; value: number }[]
    locationDistribution: { name: string; value: number }[]
  }>({
    valueHistory: [],
    categoryDistribution: [],
    stockLevels: [],
    locationDistribution: [],
  })

  useEffect(() => {
    if (inventoryItems.length > 0 && inventoryHistory.length > 0) {
      // Cálculos para gráficos basados en los datos de inventario

      // Valor del inventario a lo largo del tiempo
      const valueHistory = inventoryHistory
        .slice(0, 10)
        .map((snapshot) => ({
          date: new Date(snapshot.date).toLocaleDateString(getDateLocale(language), { month: "short", day: "numeric" }),
          value: (snapshot.items ?? []).reduce((sum, item) => sum + item.quantity * (item.priceAtDate ?? 0), 0),
        }))
        .reverse()

      // Distribución por categoría
      const categories: Record<string, number> = {}
      inventoryItems.forEach((item) => {
        categories[item.category] = (categories[item.category] || 0) + (item.currentStock || 0) * item.price
      })

      const categoryDistribution = Object.entries(categories).map(([name, value]) => ({
        name,
        value,
      }))

      // Niveles de stock por estado
      const stockLevels = [
        { name: "Normal", value: inventoryItems.filter((item) => item.status === "normal").length },
        { name: "Bajo", value: inventoryItems.filter((item) => item.status === "low").length },
        { name: "Crítico", value: inventoryItems.filter((item) => item.status === "critical").length },
      ]

      // Distribución por ubicación simulada (puedes adaptarlo a tus datos reales)
      const locationDistribution = [
        { name: "Bodega Principal", value: Math.floor(inventoryItems.length * 0.6) },
        { name: "Almacén Secundario", value: Math.floor(inventoryItems.length * 0.25) },
        { name: "Cocina", value: Math.floor(inventoryItems.length * 0.15) },
      ]

      setChartData({
        valueHistory,
        categoryDistribution,
        stockLevels,
        locationDistribution,
      })
    }
  }, [inventoryItems, inventoryHistory, timePeriod])

  // Calcular métricas clave
  const totalItems = inventoryItems.length
  const criticalItems = inventoryItems.filter((item) => item.status === "critical").length
  const lowItems = inventoryItems.filter((item) => item.status === "low").length
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock || 0) * item.price, 0)

  // Calcular cambio porcentual comparado con el snapshot anterior
  const previousTotal =
    inventoryHistory.length > 1
      ? (inventoryHistory[1]?.items ?? []).reduce((sum, item) => sum + item.quantity * (item.priceAtDate ?? 0), 0)
      : totalValue

  const valueChange = previousTotal ? ((totalValue - previousTotal) / previousTotal) * 100 : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("inventario_dashboard_title")}</h2>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {timePeriod === "day" ? t("inventario_dashboard_period_today") : timePeriod === "week" ? t("inventario_dashboard_period_week") : t("inventario_dashboard_period_month")}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTimePeriod("day")}>{t("inventario_dashboard_period_today")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimePeriod("week")}>{t("inventario_dashboard_period_week")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimePeriod("month")}>{t("inventario_dashboard_period_month")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tarjetas de métricas clave */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t("inventario_stat_total_products")}</div>
                <Metric>{totalItems}</Metric>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="mt-4">
              <ProgressBar value={100} showAnimation color="blue" tooltip={t("inventario_tooltip_registered_products")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t("inventario_stat_critical_products")}</div>
                <Metric>{criticalItems}</Metric>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
            <div className="mt-4">
              <ProgressBar
                value={totalItems > 0 ? (criticalItems / totalItems) * 100 : 0}
                showAnimation
                color="red"
                tooltip={t("inventario_tooltip_critical_products")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t("inventario_stat_low_products")}</div>
                <Metric>{lowItems}</Metric>
              </div>
              <Info className="h-8 w-8 text-amber-500/50" />
            </div>
            <div className="mt-4">
              <ProgressBar
                value={totalItems > 0 ? (lowItems / totalItems) * 100 : 0}
                showAnimation
                color="amber"
                tooltip={t("inventario_tooltip_low_stock_products")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-medium text-muted-foreground">{t("inventario_stat_total_value")}</div>
                <Metric>{formatCurrency(totalValue)}</Metric>
              </div>
              <DollarSign className="h-8 w-8 text-green-500/50" />
            </div>
            <div className="mt-4 flex items-center">
              <BadgeDelta deltaType={valueChange >= 0 ? "increase" : "decrease"}>
                {valueChange >= 0 ? "+" : ""}
                {valueChange.toFixed(1)}%
              </BadgeDelta>
              <span className="text-sm ml-2 text-muted-foreground">{t("inventario_vs_previous_period")}</span>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Gráficos */}
      <Grid numItems={1} numItemsMd={2} className="gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>{t("inventario_chart_value_over_time_title")}</CardTitle>
            <CardDescription>{t("inventario_chart_value_over_time_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={chartData.valueHistory}
              index="date"
              categories={["value"]}
              colors={["blue"]}
              valueFormatter={(value) => formatCurrency(value)}
              showLegend={false}
              showXAxis={true}
              showYAxis={true}
              yAxisWidth={70}
              height="h-72"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("inventario_chart_category_distribution_title")}</CardTitle>
            <CardDescription>{t("inventario_chart_category_distribution_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={chartData.categoryDistribution}
              category="name"
              index="name"
              valueFormatter={(value) => formatCurrency(value)}
              colors={["blue", "cyan", "indigo", "violet", "fuchsia", "pink"]}
              height="h-72"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("inventario_chart_status_title")}</CardTitle>
            <CardDescription>{t("inventario_chart_status_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={chartData.stockLevels}
              index="name"
              categories={["value"]}
              colors={["blue"]}
              valueFormatter={(value) => t("inventario_chart_products_count_format").replace("{count}", String(value))}
              showLegend={false}
              height="h-72"
            />
          </CardContent>
        </Card>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>{t("inventario_chart_location_distribution_title")}</CardTitle>
          <CardDescription>{t("inventario_chart_location_distribution_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart
            data={chartData.locationDistribution}
            category="name"
            index="name"
            valueFormatter={(value) => t("inventario_chart_products_count_format").replace("{count}", String(value))}
            colors={["blue", "cyan", "indigo"]}
            variant="pie"
            height="h-80"
          />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          {t("inventario_chart_last_updated").replace("{date}", new Date().toLocaleString(getDateLocale(language)))}
        </CardFooter>
      </Card>
    </div>
  )
}
