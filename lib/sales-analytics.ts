// Calculos financieros de la seccion Finanzas de Estadisticas (ver docs/32). Logica
// pura, sin UI ni storage, para poder probarla con Vitest igual que lib/purchase-orders.ts
// y lib/recalculate.ts. Formulas confirmadas por el dueño del proyecto en su pedido
// original: Food Cost Real/Teorico, Prime Cost, COGS, Margen de Contribucion,
// Rotacion de Inventario, Varianza de Precios de Proveedores, P&L simplificado,
// Menu Engineering.

import { DEFAULT_VALUATION_METHOD, snapshotValueBy, type ValuationMethod } from "./inventory-valuation"
import { orderPurchaseValue, returnsInPeriod } from "@/lib/purchase-receipt"
import type { SalesImport, SalesImportLine } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { BusinessExpenses } from "@/types/business"
import type { Ingredient } from "@/types/ingredient"
import type { Menu } from "@/lib/types/menus"
import { taxIncludedIn } from "@/lib/food-cost-pricing"
import { LEGACY_PRICING_METHOD } from "@/types/business"
import { inPeriodDays, localDayOf } from "@/lib/date-format"

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
  /**
   * Tiene receta o menú vinculado (docs/305). Un plato sin vincular trae su venta pero no su
   * costo: NO es un plato de costo cero. Queda fuera del costo teórico, del margen y del
   * Menu Engineering, y se avisa qué parte de la venta representa.
   */
  linked: boolean
}

/** Venta neta (sin ISV incluido) de una lista de platos. */
const netOf = (d: DishPerformance) => d.revenue - (d.tax || 0)

export interface SalesCoverage {
  /** Venta neta de los platos con receta o menú. */
  linkedNetRevenue: number
  /** Venta neta de los platos sin vincular (su costo no se conoce). */
  unlinkedNetRevenue: number
  /** % de la venta neta sin vincular (0 a 100). */
  unlinkedPercent: number
  unlinkedCount: number
}

/** Qué parte de la venta tiene costo conocido (docs/305). */
export function salesCoverage(dishes: DishPerformance[]): SalesCoverage {
  let linkedNetRevenue = 0
  let unlinkedNetRevenue = 0
  let unlinkedCount = 0
  for (const d of dishes) {
    if (d.linked) linkedNetRevenue += netOf(d)
    else {
      unlinkedNetRevenue += netOf(d)
      unlinkedCount += 1
    }
  }
  const total = linkedNetRevenue + unlinkedNetRevenue
  return {
    linkedNetRevenue,
    unlinkedNetRevenue,
    unlinkedPercent: total > 0 ? (unlinkedNetRevenue / total) * 100 : 0,
    unlinkedCount,
  }
}

/**
 * Margen de contribución de un conjunto de platos, medido solo sobre lo vinculado: venta neta
 * de los platos con receta − su costo teórico. Antes la venta sin vincular entraba con costo 0
 * y el margen parecía mejor de lo que es (docs/305).
 */
export function linkedContribution(dishes: DishPerformance[]): { netRevenue: number; theoreticalCost: number; contributionMargin: number; contributionMarginPercent: number } {
  const linked = dishes.filter((d) => d.linked)
  const netRevenue = linked.reduce((sum, d) => sum + netOf(d), 0)
  const theoreticalCost = linked.reduce((sum, d) => sum + d.theoreticalCost, 0)
  const contributionMargin = netRevenue - theoreticalCost
  return {
    netRevenue,
    theoreticalCost,
    contributionMargin,
    contributionMarginPercent: netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0,
  }
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
        linked: Boolean(line.recipeId || line.menuId),
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
  return localDayOf(raw)
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
      const quantitySold = dishes.reduce((sum, d) => sum + d.quantitySold, 0)
      // Margen solo de lo vinculado (docs/305): lo sin receta no es costo cero.
      const { theoreticalCost, contributionMargin, contributionMarginPercent } = linkedContribution(dishes)
      return {
        periodKey,
        startDate: start,
        endDate: end,
        revenue,
        theoreticalCost,
        quantitySold,
        contributionMargin,
        contributionMarginPercent,
        dishes,
      }
    })
    .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1)) // más reciente primero
}

/**
 * Totales de varios períodos con la misma regla que Finanzas (docs/307): margen = venta neta
 * (sin ISV incluido) de lo vinculado − costo teórico, sobre esa venta neta. Antes el historial
 * restaba el costo a la venta bruta con ISV y con lo sin receta: «Margen 71.5 %» no cuadraba con
 * el margen de contribución de las tarjetas de arriba.
 */
export function periodsTotals(periods: Pick<PeriodSalesSummary, "revenue" | "quantitySold" | "dishes">[]) {
  const dishes = periods.flatMap((p) => p.dishes)
  const linked = linkedContribution(dishes)
  const coverage = salesCoverage(dishes)
  const revenue = periods.reduce((sum, p) => sum + p.revenue, 0)
  const quantitySold = periods.reduce((sum, p) => sum + p.quantitySold, 0)
  return {
    revenue,
    quantitySold,
    theoreticalCost: linked.theoreticalCost,
    margin: linked.contributionMargin,
    marginPercent: linked.contributionMarginPercent,
    unlinkedPercent: coverage.unlinkedPercent,
    unlinkedNetRevenue: coverage.unlinkedNetRevenue,
    unlinkedCount: coverage.unlinkedCount,
    avgTicket: quantitySold > 0 ? revenue / quantitySold : 0,
  }
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
      const quantitySold = dishes.reduce((sum, d) => sum + d.quantitySold, 0)
      // Margen solo de lo vinculado (docs/305): lo sin receta no es costo cero.
      const { theoreticalCost, contributionMargin, contributionMarginPercent } = linkedContribution(dishes)
      return {
        date,
        revenue,
        theoreticalCost,
        quantitySold,
        contributionMargin,
        contributionMarginPercent,
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

/**
 * Compras que cuentan en el costo real (docs/305): solo las órdenes RECIBIDAS, por la fecha
 * en que se recibieron. Antes entraban todas las del período (pendientes, aprobadas e
 * incluso canceladas) por su fecha de orden, pero el inventario solo sube al recibir: una
 * orden pendiente de L 5 000 aparecía como L 5 000 de costo de lo vendido sin que hubiera
 * llegado nada. Las pendientes y aprobadas son compromisos de compra, no compras.
 */
export function receivedPurchaseOrdersIn(
  purchaseOrders: PurchaseOrder[],
  inRange: (dateStr: string) => boolean,
): PurchaseOrder[] {
  return purchaseOrders.filter((po) => po.status === "received" && inRange(po.receivedAt || po.date))
}

export interface COGSResult {
  initialInventoryValue: number
  finalInventoryValue: number
  /** Compras netas del período: lo recibido menos lo devuelto (docs/322). */
  purchasesValue: number
  /** Lo recibido del período, a precio de factura (docs/322). */
  grossPurchasesValue?: number
  /** Devoluciones al proveedor del período (docs/322). */
  returnsValue?: number
  cogs: number
  hasFullData: boolean // false si falta un snapshot inicial o final real del periodo (aproximado)
}

export function computeCOGS(params: {
  snapshots: InventorySnapshot[]
  purchaseOrders: PurchaseOrder[]
  periodStart: string | null
  periodEnd: string | null
  currentInventoryValue: number
  /** Método de valoración del inventario (docs/313). Por defecto, el último precio de compra. */
  valuationMethod?: ValuationMethod
}): COGSResult {
  const { snapshots, purchaseOrders, periodStart, periodEnd, currentInventoryValue, valuationMethod = DEFAULT_VALUATION_METHOD } = params

  // Por día local (docs/328): un conteo a las 8 p. m. del último día es de ese mes.
  const inRange = (dateStr: string) => inPeriodDays(dateStr, periodStart, periodEnd)

  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const inPeriod = periodStart && periodEnd ? sorted.filter((s) => inRange(s.date)) : sorted

  const initialSnapshot = inPeriod[0]
  const finalSnapshot = inPeriod.length > 1 ? inPeriod[inPeriod.length - 1] : undefined

  // Recalculado desde las líneas del conteo (lib/inventory-value.ts, docs/136): el
  // totalValue guardado en conteos viejos quedó multiplicado por el contenido del envase.
  // docs/313: inicial y final en el mismo método de valoración (el inventario actual también).
  const initialInventoryValue = initialSnapshot ? snapshotValueBy(initialSnapshot, valuationMethod) : currentInventoryValue
  const finalInventoryValue = finalSnapshot ? snapshotValueBy(finalSnapshot, valuationMethod) : currentInventoryValue

  // docs/322: cada orden cuenta lo que llegó de verdad (recepción revisada) y se restan las
  // devoluciones por su fecha. Sin revisión, el total de la orden, como antes.
  const grossPurchasesValue = receivedPurchaseOrdersIn(purchaseOrders, inRange).reduce((sum, po) => sum + orderPurchaseValue(po), 0)
  const returnsValue = returnsInPeriod(purchaseOrders, inRange).total
  const purchasesValue = Math.max(0, grossPurchasesValue - returnsValue)

  const cogs = Math.max(0, initialInventoryValue + purchasesValue - finalInventoryValue)

  return {
    initialInventoryValue,
    finalInventoryValue,
    purchasesValue,
    grossPurchasesValue,
    returnsValue,
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
  /** Costo de personal de los turnos anotados (docs/322); si no se pasa, el mensual prorrateado. */
  laborCostOverride?: number
}): SimplifiedPnL {
  const { revenue, cogs, expenses, periodStart, periodEnd, laborCostOverride } = params
  const prorate = (v: number) => prorateMonthlyExpense(v, periodStart, periodEnd)

  const laborCost = laborCostOverride ?? prorate(expenses?.laborCosts || 0)
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
