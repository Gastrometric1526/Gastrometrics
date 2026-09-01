"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { EstadisticasTour } from "@/components/page-tours"
import { AuthGuard } from "@/components/auth-guard"
import { EstadisticasFinanzasTab } from "@/components/estadisticas-finanzas-tab"
import { useFeatureAccess } from "@/lib/plan-access"
import { FeatureLockedPage, FeatureLockedInline } from "@/components/feature-locked"
import { AdminRestrictedPage, AdminRestrictedInline } from "@/components/admin-restricted"
import { getAccessBlockReason } from "@/lib/plan-access"
import { useLanguage } from "@/contexts/language-context"
import {
  ArrowLeft,
  BarChart3,
  ChefHat,
  Database,
  UtensilsCrossed,
  ShoppingCart,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
  DollarSign,
  Boxes,
  Wallet,
  History,
  Info,
} from "lucide-react"
import { EstadisticasPanoramaInfoDialog } from "@/components/estadisticas-panorama-info-dialog"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getInventory, getInventoryStats, ensureInventoryLoaded } from "@/lib/storage/inventory"
import { getPurchaseOrders, ensurePurchaseOrdersLoaded } from "@/lib/storage/purchase-orders"
import { getSalesImports, ensureSalesImportsLoaded } from "@/lib/storage/sales-imports"
import { getMenus, ensureMenusLoaded } from "@/lib/menus"
import { getPriceChangeHistory, type PriceChangeNotification } from "@/lib/recalculate"
import { formatCurrency } from "@/lib/currency"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem } from "@/types/inventory"

const chartTokens = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6", "chart-7"] as const

// Tailwind necesita ver cada clase completa como string literal en el código fuente para
// generarla — por eso este mapa existe en vez de armar las clases con template strings.
const chartColorClasses: Record<(typeof chartTokens)[number], { softBg: string; text: string; solidBg: string }> = {
  "chart-1": { softBg: "bg-chart-1/10", text: "text-chart-1", solidBg: "bg-chart-1" },
  "chart-2": { softBg: "bg-chart-2/10", text: "text-chart-2", solidBg: "bg-chart-2" },
  "chart-3": { softBg: "bg-chart-3/10", text: "text-chart-3", solidBg: "bg-chart-3" },
  "chart-4": { softBg: "bg-chart-4/10", text: "text-chart-4", solidBg: "bg-chart-4" },
  "chart-5": { softBg: "bg-chart-5/10", text: "text-chart-5", solidBg: "bg-chart-5" },
  "chart-6": { softBg: "bg-chart-6/10", text: "text-chart-6", solidBg: "bg-chart-6" },
  "chart-7": { softBg: "bg-chart-7/10", text: "text-chart-7", solidBg: "bg-chart-7" },
}

// Mismos tokens de color que chartColorClasses, pero como valores hsl() usables
// directamente en el fill de recharts (que no puede leer clases de Tailwind).
const chartHslColors = chartTokens.map((t) => `hsl(var(--${t}))`)

function CategoryPieChart({
  data,
  valueFormatter,
}: {
  data: [string, number][]
  valueFormatter?: (value: number) => string
}) {
  const chartData = data.map(([name, value]) => ({ name, value }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          paddingAngle={chartData.length > 1 ? 1 : 0}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={chartHslColors[i % chartHslColors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={valueFormatter ? (value) => valueFormatter(typeof value === "number" ? value : Number(value)) : undefined}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            borderColor: "hsl(var(--border))",
            borderRadius: 8,
          }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  token,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  token: (typeof chartTokens)[number]
}) {
  const colors = chartColorClasses[token]
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${colors.softBg} shrink-0`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function BreakdownBar({
  label,
  count,
  total,
  token,
}: {
  label: string
  count: number
  total: number
  token: (typeof chartTokens)[number]
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const colors = chartColorClasses[token]
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground truncate pr-2">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colors.solidBg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EstadisticasContent() {
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const canAccessPanorama = useFeatureAccess("stats_panorama")
  const canAccessFinance = useFeatureAccess("stats_finance")
  const { t } = useLanguage()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [menuCount, setMenuCount] = useState(0)
  const [inventoryStats, setInventoryStats] = useState({ totalItems: 0, criticalItems: 0, lowItems: 0, totalValue: 0 })
  const [purchaseOrdersTotal, setPurchaseOrdersTotal] = useState(0)
  const [purchaseOrdersCount, setPurchaseOrdersCount] = useState(0)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [salesImportsCount, setSalesImportsCount] = useState(0)
  const [priceHistory, setPriceHistory] = useState<PriceChangeNotification[]>([])
  const [selectedPriceIngredientId, setSelectedPriceIngredientId] = useState<string>("")
  const [isPanoramaInfoOpen, setIsPanoramaInfoOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
    try {
      await Promise.all([
        ensureRecipesLoaded(businessId),
        ensureIngredientsLoaded(businessId),
        ensureMenusLoaded(businessId),
        ensureInventoryLoaded(businessId),
        ensurePurchaseOrdersLoaded(businessId),
        ensureSalesImportsLoaded(businessId),
      ])
      setRecipes(getRecipes(businessId))
      setIngredients(getIngredients(businessId))
      setMenuCount(getMenus(businessId).length)
      setInventoryStats(getInventoryStats(businessId))
      setInventoryItems(getInventory(businessId))
      const orders = getPurchaseOrders(businessId)
      setPurchaseOrdersCount(orders.length)
      setPurchaseOrdersTotal(orders.reduce((sum, order) => sum + (order.total || 0), 0))
      // BUG CORREGIDO: hasAnyData no consideraba las ventas importadas del POS — un
      // negocio que solo hubiera importado ventas (sin recetas/ingredientes/inventario
      // propios) se quedaba atascado en el estado vacio de arriba, sin poder llegar
      // nunca a la pestaña Finanzas.
      setSalesImportsCount(getSalesImports(businessId).length)
      // Historial de precios: reusa las notificaciones de cambio de precio ya generadas
      // en cada compra/edición (ver lib/recalculate.ts) — no requiere una tabla nueva.
      setPriceHistory(getPriceChangeHistory(businessId))
    } catch (error) {
      console.error("Error loading estadísticas:", error)
    } finally {
      setIsLoading(false)
    }
    }
    load()
  }, [businessId])

  const recipesWithPricing = useMemo(
    () => recipes.filter((r) => (r.unitPrice || 0) > 0 && (r.costPerServing || 0) >= 0),
    [recipes],
  )

  const avgCostPercent = useMemo(() => {
    if (recipesWithPricing.length === 0) return 0
    const total = recipesWithPricing.reduce((sum, r) => sum + ((r.costPerServing || 0) / (r.unitPrice || 1)) * 100, 0)
    return total / recipesWithPricing.length
  }, [recipesWithPricing])

  const avgMargin = useMemo(() => {
    if (recipesWithPricing.length === 0) return 0
    const total = recipesWithPricing.reduce((sum, r) => sum + ((r.unitPrice || 0) - (r.costPerServing || 0)), 0)
    return total / recipesWithPricing.length
  }, [recipesWithPricing])

  const recipesByClassification = useMemo(() => {
    const map = new Map<string, number>()
    recipes.forEach((r) => {
      const key = r.classification || "Sin clasificar"
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [recipes])

  const ingredientsByCategory = useMemo(() => {
    const map = new Map<string, number>()
    ingredients.forEach((i) => {
      const key = i.category || "Sin categoría"
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [ingredients])

  const topMarginRecipes = useMemo(
    () =>
      [...recipesWithPricing]
        .sort((a, b) => (b.unitPrice! - b.costPerServing!) - (a.unitPrice! - a.costPerServing!))
        .slice(0, 5),
    [recipesWithPricing],
  )

  const lowMarginRecipes = useMemo(
    () =>
      [...recipesWithPricing]
        .sort((a, b) => (a.unitPrice! - a.costPerServing!) - (b.unitPrice! - b.costPerServing!))
        .slice(0, 5),
    [recipesWithPricing],
  )

  // Ingredientes más usados: en cuántas recetas distintas aparece cada uno.
  const mostUsedIngredients = useMemo(() => {
    const map = new Map<string, number>()
    recipes.forEach((r) => {
      const namesInRecipe = new Set((r.ingredients || []).map((ing) => ing.name).filter(Boolean))
      namesInRecipe.forEach((name) => map.set(name, (map.get(name) || 0) + 1))
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [recipes])

  // Ingredientes más gastados según inventario: mayor valor total (stock actual × precio) inmovilizado.
  const mostSpentInventoryIngredients = useMemo(
    () =>
      [...inventoryItems]
        .map((item) => ({ ...item, totalValue: (item.currentStock || 0) * (item.price || 0) }))
        .filter((item) => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 5),
    [inventoryItems],
  )

  // Valor de inventario por categoría — en qué categorías está el dinero inmovilizado.
  const inventoryValueByCategory = useMemo(() => {
    const map = new Map<string, number>()
    inventoryItems.forEach((item) => {
      const value = (item.currentStock || 0) * (item.price || 0)
      if (value <= 0) return
      const key = item.category || "Sin categoría"
      map.set(key, (map.get(key) || 0) + value)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [inventoryItems])

  // Ingredientes más caros: mayor precio por unidad de compra.
  const mostExpensiveIngredients = useMemo(
    () =>
      [...ingredients]
        .filter((ing) => (ing.pricing?.pricePerUnit || 0) > 0)
        .sort((a, b) => (b.pricing?.pricePerUnit || 0) - (a.pricing?.pricePerUnit || 0))
        .slice(0, 5),
    [ingredients],
  )

  // Ingredientes con historial de precio, agrupados y ordenados por cantidad de cambios
  // (proxy de "más rotación": un ingrediente que se compra seguido acumula más cambios
  // de precio registrados que uno que casi no se compra).
  const priceHistoryByIngredient = useMemo(() => {
    const map = new Map<string, PriceChangeNotification[]>()
    priceHistory.forEach((entry) => {
      const list = map.get(entry.ingredientId) || []
      list.push(entry)
      map.set(entry.ingredientId, list)
    })
    return Array.from(map.entries())
      .map(([ingredientId, entries]) => ({
        ingredientId,
        ingredientName: entries[entries.length - 1].ingredientName,
        entries,
      }))
      .sort((a, b) => b.entries.length - a.entries.length)
  }, [priceHistory])

  const selectedPriceHistory =
    priceHistoryByIngredient.find((i) => i.ingredientId === selectedPriceIngredientId) || priceHistoryByIngredient[0]

  const selectedPriceChartData = useMemo(() => {
    if (!selectedPriceHistory) return []
    const first = selectedPriceHistory.entries[0]
    return [
      { date: new Date(first.timestamp).toLocaleDateString(), price: first.oldPrice },
      ...selectedPriceHistory.entries.map((e) => ({ date: new Date(e.timestamp).toLocaleDateString(), price: e.newPrice })),
    ]
  }, [selectedPriceHistory])

  const selectedPriceChangePercent = useMemo(() => {
    if (!selectedPriceHistory) return 0
    const first = selectedPriceHistory.entries[0].oldPrice
    const last = selectedPriceHistory.entries[selectedPriceHistory.entries.length - 1].newPrice
    return first > 0 ? ((last - first) / first) * 100 : 0
  }, [selectedPriceHistory])

  const hasAnyData =
    recipes.length > 0 ||
    ingredients.length > 0 ||
    menuCount > 0 ||
    inventoryStats.totalItems > 0 ||
    purchaseOrdersCount > 0 ||
    salesImportsCount > 0

  if (canAccessPanorama === null) {
    return null
  }

  if (!canAccessPanorama) {
    return getAccessBlockReason("stats_panorama") === "admin" ? (
      <AdminRestrictedPage sectionName={t("estadisticas_title")} />
    ) : (
      <FeatureLockedPage feature="stats_panorama" title={t("estadisticas_locked_title")} description={t("estadisticas_locked_desc")} />
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
              <EstadisticasTour />
              {/* Header */}
              <div className="flex items-center gap-2 md:gap-4">
                <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-accent bg-transparent">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                    <span className="sm:hidden">{t("common_back")}</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-3" data-tour="stats-header">
                  <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-chart-3" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("estadisticas_title")}</h1>
                    <p className="text-sm md:text-base text-muted-foreground">{t("estadisticas_subtitle")}</p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : !hasAnyData ? (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <GastrometricsLogo className="h-24 w-24 opacity-[0.08] mb-6" />
                    <h3 className="text-xl font-bold mb-3">{t("estadisticas_empty_title")}</h3>
                    <p className="text-muted-foreground text-center max-w-md">{t("estadisticas_empty_desc")}</p>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="panorama" className="w-full">
                  <TabsList className="bg-card border border-border">
                    <TabsTrigger id="stats-tab-panorama" value="panorama" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <BarChart3 className="h-4 w-4" />
                      {t("estadisticas_tab_panorama")}
                    </TabsTrigger>
                    <TabsTrigger id="stats-tab-finanzas" value="finanzas" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Wallet className="h-4 w-4" />
                      {t("estadisticas_tab_finanzas")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="panorama" className="space-y-6 mt-4">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsPanoramaInfoOpen(true)} className="gap-2">
                      <Info className="h-4 w-4" />
                      {t("estadisticas_panorama_info_button")}
                    </Button>
                  </div>
                  {/* Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="stats-overview-cards">
                    <StatCard icon={ChefHat} label={t("estadisticas_stat_recipes")} value={String(recipes.length)} token="chart-1" />
                    <StatCard icon={Database} label={t("estadisticas_stat_ingredients")} value={String(ingredients.length)} token="chart-2" />
                    <StatCard icon={UtensilsCrossed} label={t("estadisticas_stat_menus")} value={String(menuCount)} token="chart-6" />
                    <StatCard
                      icon={ShoppingCart}
                      label={t("estadisticas_stat_purchase_orders")}
                      value={String(purchaseOrdersCount)}
                      sub={purchaseOrdersTotal > 0 ? `${formatCurrency(purchaseOrdersTotal)} ${t("estadisticas_stat_purchase_orders_total_suffix")}` : undefined}
                      token="chart-4"
                    />
                    <StatCard
                      icon={Package}
                      label={t("estadisticas_stat_inventory_value")}
                      value={formatCurrency(inventoryStats.totalValue)}
                      sub={`${inventoryStats.totalItems} ${t("estadisticas_stat_inventory_items_suffix")}`}
                      token="chart-5"
                    />
                    <StatCard
                      icon={AlertTriangle}
                      label={t("estadisticas_stat_low_critical_inventory")}
                      value={String(inventoryStats.lowItems + inventoryStats.criticalItems)}
                      sub={`${inventoryStats.criticalItems} ${t(inventoryStats.criticalItems !== 1 ? "estadisticas_critical_plural" : "estadisticas_critical_singular")}`}
                      token="chart-3"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label={t("estadisticas_stat_avg_cost_percent")}
                      value={recipesWithPricing.length > 0 ? `${avgCostPercent.toFixed(1)}%` : ""}
                      sub={t("estadisticas_avg_cost_percent_sub")}
                      token="chart-2"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label={t("estadisticas_stat_avg_margin")}
                      value={recipesWithPricing.length > 0 ? formatCurrency(avgMargin) : ""}
                      sub={t("estadisticas_avg_margin_sub")}
                      token="chart-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recetas por clasificación */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base">{t("estadisticas_recipes_by_classification_title")}</CardTitle>
                        <CardDescription>{t("estadisticas_recipes_by_classification_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {recipesByClassification.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_no_recipes_yet")}</p>
                        ) : (
                          <>
                            <CategoryPieChart data={recipesByClassification} />
                            {recipesByClassification.map(([label, count], i) => (
                              <BreakdownBar
                                key={label}
                                label={label}
                                count={count}
                                total={recipes.length}
                                token={chartTokens[i % chartTokens.length]}
                              />
                            ))}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Ingredientes por categoría */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base">{t("estadisticas_ingredients_by_category_title")}</CardTitle>
                        <CardDescription>{t("estadisticas_ingredients_by_category_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ingredientsByCategory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_no_ingredients_yet")}</p>
                        ) : (
                          <>
                            <CategoryPieChart data={ingredientsByCategory} />
                            {ingredientsByCategory.map(([label, count], i) => (
                              <BreakdownBar
                                key={label}
                                label={label}
                                count={count}
                                total={ingredients.length}
                                token={chartTokens[i % chartTokens.length]}
                              />
                            ))}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Mejor margen */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-chart-2" />
                          {t("estadisticas_best_margin_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_best_margin_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {topMarginRecipes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_need_priced_recipes")}</p>
                        ) : (
                          topMarginRecipes.map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                              <span className="truncate pr-2">{r.name}</span>
                              <span className="font-semibold text-foreground tabular-nums shrink-0">
                                {formatCurrency((r.unitPrice || 0) - (r.costPerServing || 0))}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Peor margen */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-chart-3" />
                          {t("estadisticas_lowest_margin_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_lowest_margin_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {lowMarginRecipes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_need_priced_recipes")}</p>
                        ) : (
                          lowMarginRecipes.map((r) => {
                            const margin = (r.unitPrice || 0) - (r.costPerServing || 0)
                            return (
                              <div key={r.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                                <span className="truncate pr-2">{r.name}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(margin)}</span>
                                  {margin <= 0 && (
                                    <Badge variant="destructive" className="text-[10px]">
                                      {t("estadisticas_no_margin_badge")}
                                    </Badge>
                                  )}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </CardContent>
                    </Card>

                    {/* Ingredientes más usados */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Flame className="h-4 w-4 text-chart-4" />
                          {t("estadisticas_most_used_ingredients_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_most_used_ingredients_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {mostUsedIngredients.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_add_ingredients_to_recipes")}</p>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height={Math.max(180, mostUsedIngredients.length * 28)}>
                              <BarChart
                                data={mostUsedIngredients.map(([name, count]) => ({ name, count }))}
                                layout="vertical"
                                margin={{ left: 8, right: 16 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                                <YAxis
                                  type="category"
                                  dataKey="name"
                                  width={128}
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name)}
                                />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                />
                                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                            {mostUsedIngredients.map(([name, count]) => (
                              <div key={name} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                                <span className="truncate pr-2">{name}</span>
                                <span className="font-semibold text-foreground tabular-nums shrink-0">
                                  {count} {t(count !== 1 ? "estadisticas_recipe_plural" : "estadisticas_recipe_singular")}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Ingredientes más gastados según inventario */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-chart-5" />
                          {t("estadisticas_most_spent_ingredients_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_most_spent_ingredients_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {mostSpentInventoryIngredients.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_register_stock_hint")}</p>
                        ) : (
                          mostSpentInventoryIngredients.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                              <span className="truncate pr-2">{item.name}</span>
                              <span className="font-semibold text-foreground tabular-nums shrink-0">
                                {formatCurrency(item.totalValue)}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Ingredientes más caros */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-chart-1" />
                          {t("estadisticas_most_expensive_ingredients_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_most_expensive_ingredients_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {mostExpensiveIngredients.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_add_ingredient_prices")}</p>
                        ) : (
                          mostExpensiveIngredients.map((ing) => (
                            <div key={ing.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                              <span className="truncate pr-2">{ing.name}</span>
                              <span className="font-semibold text-foreground tabular-nums shrink-0">
                                {formatCurrency(ing.pricing?.pricePerUnit || 0)}/{ing.unit}
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Valor de inventario por categoría */}
                    <Card className="border-border bg-card">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-chart-6" />
                          {t("estadisticas_inventory_value_by_category_title")}
                        </CardTitle>
                        <CardDescription>{t("estadisticas_inventory_value_by_category_desc")}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {inventoryValueByCategory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("estadisticas_register_stock_hint")}</p>
                        ) : (
                          <CategoryPieChart data={inventoryValueByCategory} valueFormatter={formatCurrency} />
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Historial de Precios de Ingredientes */}
                  <Card className="border-border bg-card" data-tour="stats-price-history">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4 text-chart-1" />
                        {t("estadisticas_price_history_title")}
                      </CardTitle>
                      <CardDescription>{t("estadisticas_price_history_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {priceHistoryByIngredient.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("estadisticas_price_history_empty")}</p>
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Select
                              value={selectedPriceHistory?.ingredientId}
                              onValueChange={setSelectedPriceIngredientId}
                            >
                              <SelectTrigger className="w-full sm:w-72">
                                <SelectValue placeholder={t("estadisticas_price_history_select_placeholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                {priceHistoryByIngredient.map((i) => (
                                  <SelectItem key={i.ingredientId} value={i.ingredientId}>
                                    {i.ingredientName} · {i.entries.length} {t(i.entries.length !== 1 ? "estadisticas_price_change_plural" : "estadisticas_price_change_singular")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedPriceHistory && (
                              <Badge
                                variant={selectedPriceChangePercent > 0 ? "destructive" : "outline"}
                                className={`w-fit gap-1 ${selectedPriceChangePercent < 0 ? "text-chart-2 border-chart-2/40" : ""}`}
                              >
                                {selectedPriceChangePercent > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {selectedPriceChangePercent > 0 ? "+" : ""}
                                {selectedPriceChangePercent.toFixed(1)}% {t("estadisticas_since_first_record_suffix")}
                              </Badge>
                            )}
                          </div>

                          {selectedPriceChartData.length > 0 && (
                            <ResponsiveContainer width="100%" height={240}>
                              <LineChart data={selectedPriceChartData} margin={{ left: 8, right: 16, top: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={(v: number) => formatCurrency(v)}
                                  width={80}
                                />
                                <Tooltip
                                  formatter={(v: any) => formatCurrency(Number(v))}
                                  contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke="hsl(var(--chart-1))"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          )}

                          <div className="pt-2 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              {t("estadisticas_most_rotation_title")}
                            </p>
                            <div className="space-y-2">
                              {priceHistoryByIngredient.slice(0, 5).map((i) => {
                                const first = i.entries[0].oldPrice
                                const last = i.entries[i.entries.length - 1].newPrice
                                const pct = first > 0 ? ((last - first) / first) * 100 : 0
                                return (
                                  <button
                                    key={i.ingredientId}
                                    onClick={() => setSelectedPriceIngredientId(i.ingredientId)}
                                    className={`w-full flex items-center justify-between text-sm rounded-lg px-3 py-2 transition-colors ${
                                      i.ingredientId === selectedPriceHistory?.ingredientId
                                        ? "bg-primary/10 ring-1 ring-primary/30"
                                        : "bg-muted/20 hover:bg-muted/40"
                                    }`}
                                  >
                                    <span className="truncate pr-2">{i.ingredientName}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-muted-foreground">
                                        {i.entries.length} {t(i.entries.length !== 1 ? "estadisticas_price_change_plural" : "estadisticas_price_change_singular")}
                                      </span>
                                      <span
                                        className={`font-semibold tabular-nums ${pct > 0 ? "text-destructive" : pct < 0 ? "text-chart-2" : "text-foreground"}`}
                                      >
                                        {pct > 0 ? "+" : ""}
                                        {pct.toFixed(1)}%
                                      </span>
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  </TabsContent>

                  <TabsContent value="finanzas" className="mt-4">
                    {canAccessFinance ? (
                      <EstadisticasFinanzasTab businessId={businessId} />
                    ) : getAccessBlockReason("stats_finance") === "admin" ? (
                      <AdminRestrictedInline sectionName={t("estadisticas_finance_section_name")} />
                    ) : (
                      <FeatureLockedInline
                        feature="stats_finance"
                        title={t("estadisticas_finance_locked_title")}
                        description={t("estadisticas_finance_locked_desc")}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </div>
      <EstadisticasPanoramaInfoDialog open={isPanoramaInfoOpen} onOpenChange={setIsPanoramaInfoOpen} />
    </AuthGuard>
  )
}

// useSearchParams() exige un límite de Suspense para poder prerenderizarse — sin este
// wrapper, `next build` fallaba con "missing-suspense-with-csr-bailout" al generar esta
// página estática (ver docs/19 y docs/20, pendiente de prerenderizado).
export default function EstadisticasPage() {
  return (
    <Suspense fallback={null}>
      <EstadisticasContent />
    </Suspense>
  )
}
