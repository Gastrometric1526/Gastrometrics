// Calculos financieros de la seccion Finanzas de Estadisticas (ver docs/32). Logica
// pura, sin UI ni storage, para poder probarla con Vitest igual que lib/purchase-orders.ts
// y lib/recalculate.ts. Formulas confirmadas por el dueño del proyecto en su pedido
// original: Food Cost Real/Teorico, Prime Cost, COGS, Margen de Contribucion,
// Rotacion de Inventario, Varianza de Precios de Proveedores, P&L simplificado,
// Menu Engineering.

import type { SalesImport, SalesImportLine } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { BusinessExpenses } from "@/types/business"
import type { Ingredient } from "@/types/ingredient"
import type { Menu } from "@/lib/types/menus"
import { snapshotValue } from "@/lib/inventory-value"
import { taxIncludedIn } from "@/lib/food-cost-pricing"
import { LEGACY_PRICING_METHOD } from "@/types/business"

// ============== DESEMPEÑO POR PLATO ==============

export interface DishPerformance {
  recipeId: string | null
  name: string
  quantitySold: number
  revenue: number
  /**
   * ISV incluido en `revenue` (docs/187), con la misma regla que la Ficha Técnica: en el
   * método Food Cost % el precio lleva el ISV encima y ese dinero es del Estado. Los % de
   * costo y el margen se miden sobre la venta neta (revenue − tax), igual que en la Ficha.
   */
  tax?: number
  theoreticalCost: number
  contributionMargin: number
  contributionMarginPercent: number
  unitPrice: number
  unitCost: number
}

/** ISV incluido en el importe de una venta de esa receta (0 si no aplica). */
export function saleTaxIncluded(revenue: number, recipe: Pick<Recipe, "pricingMethod" | "isv"> | undefined): number {
  if (!recipe || !(recipe.isv && recipe.isv > 0)) return 0
  const method = recipe.pricingMethod || LEGACY_PRICING_METHOD
  return method === "food_cost" ? taxIncludedIn(revenue, recipe.isv) : 0
}

// menus es opcional (parámetro nuevo, docs/90) — el registro manual de ventas es el
// único que puede producir una línea con menuId (la importación de POS solo conoce
// recetas). Sin menus, una línea de menú simplemente cae al mismo bucket "unmatched"
// que tenía antes, en vez de romper la llamada — mantiene compatible cualquier
// llamador viejo que todavía no le pase el arreglo de menús.
// Extraida de aggregateSalesByDish para poder reusarla por-día en aggregateSalesByDay
// de abajo sin duplicar la logica de agrupacion/calculo de margen.
function aggregateLines(lines: SalesImportLine[], recipes: Recipe[], menus: Menu[]): DishPerformance[] {
  const map = new Map<string, DishPerformance>()

  lines.forEach((line) => {
    const key =
      line.recipeId || (line.menuId ? `menu:${line.menuId}` : `unmatched:${line.rawDishName.trim().toLowerCase()}`)
    const recipe = line.recipeId ? recipes.find((r) => r.id === line.recipeId) : undefined
    const menu = !line.recipeId && line.menuId ? menus.find((m) => m.id === line.menuId) : undefined
    const name = recipe?.name || menu?.name || line.rawDishName

    const tax = line.netOfTax ? 0 : saleTaxIncluded(line.revenue, recipe)
    const existing = map.get(key)
    if (existing) {
      existing.quantitySold += line.quantity
      existing.revenue += line.revenue
      existing.tax = (existing.tax || 0) + tax
      existing.theoreticalCost += line.theoreticalCost
    } else {
      map.set(key, {
        recipeId: line.recipeId,
        name,
        quantitySold: line.quantity,
        revenue: line.revenue,
        tax,
        theoreticalCost: line.theoreticalCost,
        contributionMargin: 0,
        contributionMarginPercent: 0,
        unitPrice: 0,
        unitCost: 0,
      })
    }
  })

  return Array.from(map.values())
    .map((d) => {
      const netRevenue = d.revenue - (d.tax || 0)
      const contributionMargin = netRevenue - d.theoreticalCost
      return {
        ...d,
        contributionMargin,
        contributionMarginPercent: netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0,
        unitPrice: d.quantitySold > 0 ? d.revenue / d.quantitySold : 0,
        unitCost: d.quantitySold > 0 ? d.theoreticalCost / d.quantitySold : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

/** Líneas de una importación; las de factura ya vienen sin impuesto (subtotal). */
function linesOf(imp: SalesImport): SalesImportLine[] {
  return imp.source === "invoice" ? imp.lines.map((line) => ({ ...line, netOfTax: true })) : imp.lines
}

export function aggregateSalesByDish(salesImports: SalesImport[], recipes: Recipe[], menus: Menu[] = []): DishPerformance[] {
  return aggregateLines(
    salesImports.flatMap(linesOf),
    recipes,
    menus,
  )
}

// ============== DESGLOSE E HISTORIAL POR DÍA ==============
// Pedido explícito del dueño del proyecto: "en la ventana de ventas debería de haber
// todo un breakdown también e historial según días". Agrupa cada línea de venta por
// su fecha real (line.date) — campo agregado junto con esta función; antes se
// descartaba la fecha por fila de una importación de POS multi-día, y un registro
// manual siempre cubre un solo día, así que no había forma de bajar de "todo el
// periodo" a "un día en particular".

export interface DailySalesSummary {
  date: string // YYYY-MM-DD
  revenue: number
  theoreticalCost: number
  quantitySold: number
  contributionMargin: number
  contributionMarginPercent: number
  dishes: DishPerformance[]
}

// Resuelve la fecha de una línea: su propia fecha si la tiene (dato nuevo), si no la
// del lote completo (periodStart, o importedAt como último recurso) — así datos
// guardados antes de este campo siguen apareciendo en el historial, solo que
// agrupados por la fecha del lote entero en vez de por línea individual.
function resolveLineDate(imp: SalesImport, line: SalesImportLine): string {
  const raw = line.date || imp.periodStart || imp.importedAt
  return raw.slice(0, 10)
}

// ============== DESGLOSE POR PERÍODO (día / semana / mes / año) ==============
// Generalización de aggregateSalesByDay de abajo — pedido explícito del dueño del
// proyecto: poder ver (y exportar a PDF) el desglose agrupado por semana, mes o año,
// no solo por día, para un negocio con meses/años de historial de ventas ("siempre
// crea y desarrolla asumiendo que el usuario hará mucho de algo"). aggregateSalesByDay
// se deja intacta (ya la consume SalesHistoryBreakdown) — esto es una función nueva,
// no un reemplazo, para no arriesgar el desglose por día ya verificado en vivo.

export type SalesGranularity = "day" | "week" | "month" | "year"

export interface PeriodSalesSummary {
  periodKey: string // clave de orden/agrupación (YYYY-MM-DD / YYYY-Wxx vía lunes de esa semana / YYYY-MM / YYYY)
  startDate: string // YYYY-MM-DD, inicio real del período (lunes de la semana, día 1 del mes, etc.)
  endDate: string // YYYY-MM-DD, fin real del período
  revenue: number
  theoreticalCost: number
  quantitySold: number
  contributionMargin: number
  contributionMarginPercent: number
  dishes: DishPerformance[]
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=domingo..6=sábado
  const diff = (day === 0 ? -6 : 1) - day // días a restar para llegar al lunes de esa semana
  d.setDate(d.getDate() + diff)
  return d
}

// BUG CORREGIDO (docs/187): las fechas de inicio/fin se sacaban con toISOString(), que
// pasa a UTC. En zonas horarias al este de UTC (Dinamarca, China) la medianoche local es
// el día anterior en UTC: el mes «empezaba» el 31 y la semana el domingo. Se arma la
// fecha con los componentes locales.
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function periodBounds(dateStr: string, granularity: SalesGranularity): { key: string; start: string; end: string } {
  if (granularity === "day") return { key: dateStr, start: dateStr, end: dateStr }

  const d = new Date(`${dateStr}T00:00:00`)

  if (granularity === "week") {
    const monday = mondayOf(d)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    const start = ymdLocal(monday)
    const end = ymdLocal(sunday)
    return { key: start, start, end }
  }

  if (granularity === "month") {
    const y = d.getFullYear()
    const m = d.getMonth()
    const start = ymdLocal(new Date(y, m, 1))
    const end = ymdLocal(new Date(y, m + 1, 0))
    return { key: `${y}-${String(m + 1).padStart(2, "0")}`, start, end }
  }

  // year
  const y = d.getFullYear()
  return { key: String(y), start: `${y}-01-01`, end: `${y}-12-31` }
}

export function aggregateSalesByPeriod(
  salesImports: SalesImport[],
  recipes: Recipe[],
  menus: Menu[] = [],
  granularity: SalesGranularity = "day",
): PeriodSalesSummary[] {
  const byPeriod = new Map<string, { start: string; end: string; lines: SalesImportLine[] }>()

  salesImports.forEach((imp) => {
    linesOf(imp).forEach((line) => {
      const date = resolveLineDate(imp, line)
      const { key, start, end } = periodBounds(date, granularity)
      const existing = byPeriod.get(key)
      if (existing) existing.lines.push(line)
      else byPeriod.set(key, { start, end, lines: [line] })
    })
  })

  return Array.from(byPeriod.entries())
    .map(([periodKey, { start, end, lines }]) => {
      const dishes = aggregateLines(lines, recipes, menus)
      const revenue = dishes.reduce((sum, d) => sum + d.revenue, 0)
      const theoreticalCost = dishes.reduce((sum, d) => sum + d.theoreticalCost, 0)
      const quantitySold = dishes.reduce((sum, d) => sum + d.quantitySold, 0)
      const netRevenue = revenue - dishes.reduce((sum, d) => sum + (d.tax || 0), 0)
      const contributionMargin = netRevenue - theoreticalCost
      return {
        periodKey,
        startDate: start,
        endDate: end,
        revenue,
        theoreticalCost,
        quantitySold,
        contributionMargin,
        contributionMarginPercent: netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0,
        dishes,
      }
    })
    .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1)) // más reciente primero
}

export function aggregateSalesByDay(salesImports: SalesImport[], recipes: Recipe[], menus: Menu[] = []): DailySalesSummary[] {
  const byDate = new Map<string, SalesImportLine[]>()

  salesImports.forEach((imp) => {
    linesOf(imp).forEach((line) => {
      const date = resolveLineDate(imp, line)
      const existing = byDate.get(date)
      if (existing) existing.push(line)
      else byDate.set(date, [line])
    })
  })

  return Array.from(byDate.entries())
    .map(([date, lines]) => {
      const dishes = aggregateLines(lines, recipes, menus)
      const revenue = dishes.reduce((sum, d) => sum + d.revenue, 0)
      const theoreticalCost = dishes.reduce((sum, d) => sum + d.theoreticalCost, 0)
      const quantitySold = dishes.reduce((sum, d) => sum + d.quantitySold, 0)
      const netRevenue = revenue - dishes.reduce((sum, d) => sum + (d.tax || 0), 0)
      const contributionMargin = netRevenue - theoreticalCost
      return {
        date,
        revenue,
        theoreticalCost,
        quantitySold,
        contributionMargin,
        contributionMarginPercent: netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0,
        dishes,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // más reciente primero
}

// ============== MENU ENGINEERING (estrella / vaca / puzzle / perro) ==============
// Método de Kasavana y Smith (1982), el estándar de la industria (docs/187):
// - Popularidad: un plato es popular si su participación en las ventas (unidades del
//   plato ÷ unidades totales) es al menos el 70 % de una participación pareja (1 ÷ n).
//   Equivale a: unidades ≥ 0.7 × (unidades totales ÷ n).
// - Rentabilidad: margen de contribución POR PLATO (precio − costo) contra el margen
//   promedio ponderado del menú (margen total ÷ unidades totales).
// BUG CORREGIDO: antes se comparaba el margen TOTAL de cada plato contra el promedio de
// los totales y la popularidad contra el 100 % del promedio. El margen total ya mezcla la
// popularidad: un plato que se vende mucho pero deja poco por unidad salía «estrella»
// en vez de «vaca».

export type MenuEngineeringClass = "estrella" | "vaca" | "puzzle" | "perro"

export interface MenuEngineeringEntry extends DishPerformance {
  classification: MenuEngineeringClass
}

export const MENU_ENGINEERING_POPULARITY_FACTOR = 0.7

export interface MenuEngineeringThresholds {
  dishCount: number
  /** Unidades mínimas para ser popular: 70 % de la venta pareja. */
  popularityThreshold: number
  /** Margen de contribución promedio ponderado por plato vendido. */
  averageUnitMargin: number
}

export function menuEngineeringThresholds(dishes: DishPerformance[]): MenuEngineeringThresholds {
  const totalQty = dishes.reduce((s, d) => s + d.quantitySold, 0)
  const totalMargin = dishes.reduce((s, d) => s + d.contributionMargin, 0)
  return {
    dishCount: dishes.length,
    popularityThreshold: dishes.length > 0 ? (totalQty / dishes.length) * MENU_ENGINEERING_POPULARITY_FACTOR : 0,
    averageUnitMargin: totalQty > 0 ? totalMargin / totalQty : 0,
  }
}

export function classifyMenuEngineering(dishes: DishPerformance[]): MenuEngineeringEntry[] {
  if (dishes.length === 0) return []
  const { popularityThreshold, averageUnitMargin } = menuEngineeringThresholds(dishes)

  return dishes.map((d) => {
    const unitMargin = d.quantitySold > 0 ? d.contributionMargin / d.quantitySold : 0
    const highPopularity = d.quantitySold >= popularityThreshold
    const highMargin = unitMargin >= averageUnitMargin
    let classification: MenuEngineeringClass
    if (highPopularity && highMargin) classification = "estrella"
    else if (highPopularity && !highMargin) classification = "vaca"
    else if (!highPopularity && highMargin) classification = "puzzle"
    else classification = "perro"
    return { ...d, classification }
  })
}

// ============== COGS (Costo de Mercaderia Vendida) ==============
// Formula del dueño del proyecto: Inventario Inicial + Compras - Inventario Final.

export interface COGSResult {
  initialInventoryValue: number
  finalInventoryValue: number
  purchasesValue: number
  cogs: number
  hasFullData: boolean // false si falta un snapshot inicial o final real del periodo (aproximado)
}

export function computeCOGS(params: {
  snapshots: InventorySnapshot[]
  purchaseOrders: PurchaseOrder[]
  periodStart: string | null
  periodEnd: string | null
  currentInventoryValue: number
}): COGSResult {
  const { snapshots, purchaseOrders, periodStart, periodEnd, currentInventoryValue } = params

  const inRange = (dateStr: string) => {
    if (!periodStart || !periodEnd) return true
    const d = new Date(dateStr).getTime()
    return d >= new Date(periodStart).getTime() && d <= new Date(periodEnd).getTime() + 86400000 - 1
  }

  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const inPeriod = periodStart && periodEnd ? sorted.filter((s) => inRange(s.date)) : sorted

  const initialSnapshot = inPeriod[0]
  const finalSnapshot = inPeriod.length > 1 ? inPeriod[inPeriod.length - 1] : undefined

  // Recalculado desde las líneas del conteo (lib/inventory-value.ts, docs/136): el
  // totalValue guardado en conteos viejos quedó multiplicado por el contenido del envase.
  const initialInventoryValue = initialSnapshot ? snapshotValue(initialSnapshot) : currentInventoryValue
  const finalInventoryValue = finalSnapshot ? snapshotValue(finalSnapshot) : currentInventoryValue

  const purchasesValue = purchaseOrders.filter((po) => inRange(po.date)).reduce((sum, po) => sum + (po.total || 0), 0)

  const cogs = Math.max(0, initialInventoryValue + purchasesValue - finalInventoryValue)

  return {
    initialInventoryValue,
    finalInventoryValue,
    purchasesValue,
    cogs,
    hasFullData: inPeriod.length >= 2,
  }
}

// ============== PRIME COST ==============

export function computePrimeCost(cogs: number, laborCostForPeriod: number, revenue: number) {
  const primeCost = cogs + laborCostForPeriod
  return { primeCost, primeCostPercent: revenue > 0 ? (primeCost / revenue) * 100 : 0 }
}

// ============== PRORRATEO DE GASTOS MENSUALES A UN PERIODO ==============
// Los gastos del negocio (types/business.ts, BusinessExpenses) se configuran como
// montos MENSUALES. Un periodo de ventas importado puede cubrir menos (o mas) de
// un mes — se prorratea sobre 30 dias para que el Prime Cost y el P&L sean
// comparables con las ventas reales de ese periodo especifico.

export function prorateMonthlyExpense(monthlyAmount: number, periodStart: string | null, periodEnd: string | null): number {
  if (!periodStart || !periodEnd) return monthlyAmount
  const days = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1)
  return (monthlyAmount / 30) * days
}

// ============== ROTACION DE INVENTARIO ==============

export function computeInventoryTurnover(cogs: number, initialValue: number, finalValue: number): number {
  const avg = (initialValue + finalValue) / 2
  return avg > 0 ? cogs / avg : 0
}

// ============== VARIANZA (Food Cost Real vs Teorico) ==============

export function computeVariance(realCostPercent: number, theoreticalCostPercent: number): number {
  return realCostPercent - theoreticalCostPercent
}

// ============== P&L SIMPLIFICADO ==============

export interface SimplifiedPnL {
  revenue: number
  cogs: number
  laborCost: number
  rent: number
  utilities: number
  operationalCosts: number
  marketing: number
  otherExpenses: number
  totalExpenses: number
  netProfit: number
  netProfitPercent: number
}

export function buildSimplifiedPnL(params: {
  revenue: number
  cogs: number
  expenses: BusinessExpenses | undefined
  periodStart: string | null
  periodEnd: string | null
}): SimplifiedPnL {
  const { revenue, cogs, expenses, periodStart, periodEnd } = params
  const prorate = (v: number) => prorateMonthlyExpense(v, periodStart, periodEnd)

  const laborCost = prorate(expenses?.laborCosts || 0)
  const rent = prorate(expenses?.rent || 0)
  const utilities = prorate(expenses?.utilities || 0)
  const operationalCosts = prorate(expenses?.operationalCosts || 0)
  const marketing = prorate(expenses?.marketing || 0)
  const otherExpenses = prorate(expenses?.otherExpenses || 0)

  const totalExpenses = cogs + laborCost + rent + utilities + operationalCosts + marketing + otherExpenses
  const netProfit = revenue - totalExpenses

  return {
    revenue,
    cogs,
    laborCost,
    rent,
    utilities,
    operationalCosts,
    marketing,
    otherExpenses,
    totalExpenses,
    netProfit,
    netProfitPercent: revenue > 0 ? (netProfit / revenue) * 100 : 0,
  }
}

// ============== VARIANZA DE PRECIOS DE PROVEEDORES ==============
// Compara el precio de compra actual contra el costo promedio ponderado historico
// del propio ingrediente (pricing.weightedAverageCost, ya calculado en
// lib/recalculate.ts) — es la unica referencia historica de precio que ya existe
// en el proyecto sin necesitar una tabla nueva de historial de precios.

export interface SupplierPriceVarianceEntry {
  ingredientId: string
  ingredientName: string
  supplier: string
  currentPrice: number
  weightedAverageCost: number
  variancePercent: number
}

const SIGNIFICANT_VARIANCE_THRESHOLD = 5 // %

export function computeSupplierPriceVariance(ingredients: Ingredient[]): SupplierPriceVarianceEntry[] {
  return ingredients
    .filter((ing) => (ing.pricing?.weightedAverageCost || 0) > 0 && (ing.pricing?.pricePerUnit || 0) > 0)
    .map((ing) => {
      const current = ing.pricing!.pricePerUnit
      const avg = ing.pricing!.weightedAverageCost as number
      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        supplier: ing.supplier || "",
        currentPrice: current,
        weightedAverageCost: avg,
        variancePercent: avg > 0 ? ((current - avg) / avg) * 100 : 0,
      }
    })
    .filter((e) => Math.abs(e.variancePercent) >= SIGNIFICANT_VARIANCE_THRESHOLD)
    .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))
}
