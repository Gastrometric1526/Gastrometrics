// Calculos financieros de la seccion Finanzas de Estadisticas (ver docs/32). Logica
// pura, sin UI ni storage, para poder probarla con Vitest igual que lib/purchase-orders.ts
// y lib/recalculate.ts. Formulas confirmadas por el dueño del proyecto en su pedido
// original: Food Cost Real/Teorico, Prime Cost, COGS, Margen de Contribucion,
// Rotacion de Inventario, Varianza de Precios de Proveedores, P&L simplificado,
// Menu Engineering.

import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { BusinessExpenses } from "@/types/business"
import type { Ingredient } from "@/types/ingredient"

// ============== DESEMPEÑO POR PLATO ==============

export interface DishPerformance {
  recipeId: string | null
  name: string
  quantitySold: number
  revenue: number
  theoreticalCost: number
  contributionMargin: number
  contributionMarginPercent: number
  unitPrice: number
  unitCost: number
}

export function aggregateSalesByDish(salesImports: SalesImport[], recipes: Recipe[]): DishPerformance[] {
  const map = new Map<string, DishPerformance>()

  salesImports.forEach((imp) => {
    imp.lines.forEach((line) => {
      const key = line.recipeId || `unmatched:${line.rawDishName.trim().toLowerCase()}`
      const recipe = line.recipeId ? recipes.find((r) => r.id === line.recipeId) : undefined
      const name = recipe?.name || line.rawDishName

      const existing = map.get(key)
      if (existing) {
        existing.quantitySold += line.quantity
        existing.revenue += line.revenue
        existing.theoreticalCost += line.theoreticalCost
      } else {
        map.set(key, {
          recipeId: line.recipeId,
          name,
          quantitySold: line.quantity,
          revenue: line.revenue,
          theoreticalCost: line.theoreticalCost,
          contributionMargin: 0,
          contributionMarginPercent: 0,
          unitPrice: 0,
          unitCost: 0,
        })
      }
    })
  })

  return Array.from(map.values())
    .map((d) => {
      const contributionMargin = d.revenue - d.theoreticalCost
      return {
        ...d,
        contributionMargin,
        contributionMarginPercent: d.revenue > 0 ? (contributionMargin / d.revenue) * 100 : 0,
        unitPrice: d.quantitySold > 0 ? d.revenue / d.quantitySold : 0,
        unitCost: d.quantitySold > 0 ? d.theoreticalCost / d.quantitySold : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

// ============== MENU ENGINEERING (estrella / vaca / puzzle / perro) ==============
// Clasificacion clasica de 4 cuadrantes: popularidad (cantidad vendida) x
// rentabilidad (margen de contribucion), cada uno contra el promedio del propio
// menu — no contra un umbral fijo, porque lo que es "alta popularidad" depende
// enteramente del volumen de cada negocio.

export type MenuEngineeringClass = "estrella" | "vaca" | "puzzle" | "perro"

export interface MenuEngineeringEntry extends DishPerformance {
  classification: MenuEngineeringClass
}

export function classifyMenuEngineering(dishes: DishPerformance[]): MenuEngineeringEntry[] {
  if (dishes.length === 0) return []

  const avgPopularity = dishes.reduce((s, d) => s + d.quantitySold, 0) / dishes.length
  const avgMargin = dishes.reduce((s, d) => s + d.contributionMargin, 0) / dishes.length

  return dishes.map((d) => {
    const highPopularity = d.quantitySold >= avgPopularity
    const highMargin = d.contributionMargin >= avgMargin
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

  const initialInventoryValue = initialSnapshot?.totalValue ?? currentInventoryValue
  const finalInventoryValue = finalSnapshot?.totalValue ?? currentInventoryValue

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
