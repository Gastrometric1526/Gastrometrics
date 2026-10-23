/**
 * Precio de una receta cuando cambia el costo de un ingrediente (docs/162).
 *
 * Regla del dueño:
 * - Si con el costo nuevo el precio sugerido queda POR ENCIMA del precio actual, el
 *   precio sube al sugerido (solo se cambia el precio cuando sube).
 * - Si el costo baja, el precio NO baja: se mantiene como si la persona lo hubiera
 *   escrito en la casilla «Precio de venta unitario» (customUnitPrice) y se avisa que el
 *   margen de ganancia aumentó.
 *
 * El precio sugerido usa exactamente la misma fórmula que la Ficha Técnica
 * (components/technical-sheet/index.tsx): Food Cost % (costo ÷ objetivo × (1 + ISV)) o
 * los seis rubros de GastroMetrics sobre el costo, más la comisión de venta y un solo
 * redondeo hacia arriba al escalón de la moneda (lib/price-rounding.ts).
 */

import type { Recipe } from "@/types/recipe"
import { DEFAULT_TARGET_FOOD_COST_PERCENT, LEGACY_PRICING_METHOD, type PricingMethod } from "@/types/business"
import { foodCostBasePrice, taxIncludedIn } from "@/lib/food-cost-pricing"
import { roundSalePrice } from "@/lib/price-rounding"

export interface PricingContext {
  currencyCode: string
  /** Costo fijo del negocio prorrateado por plato (gastos mensuales ÷ platos mensuales). */
  fixedCostPerPlate?: number
  /** Método y objetivo por defecto del negocio, para recetas que no guardaron el suyo. */
  defaultTargetFoodCostPercent?: number
}

const positive = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined)

function pricingMethodOf(recipe: Recipe): PricingMethod {
  return (recipe.pricingMethod as PricingMethod) || LEGACY_PRICING_METHOD
}

function commissionFraction(recipe: Recipe): number {
  return Math.min(Math.max(recipe.salesCommissionPercent || 0, 0), 90) / 100
}

/** Precio de venta unitario sugerido para un costo unitario dado (misma fórmula que la Ficha Técnica). */
export function suggestedUnitPrice(recipe: Recipe, unitCost: number, ctx: PricingContext): number {
  if (!(unitCost > 0)) return 0
  const fraction = commissionFraction(recipe)
  const cover = (price: number) => (fraction > 0 ? price / (1 - fraction) : price)
  const isv = recipe.isv || 0

  if (pricingMethodOf(recipe) === "food_cost") {
    const target = recipe.targetFoodCostPercent || ctx.defaultTargetFoodCostPercent || DEFAULT_TARGET_FOOD_COST_PERCENT
    const base = foodCostBasePrice(unitCost, target, isv)
    return base > 0 ? roundSalePrice(cover(base), ctx.currencyCode) : 0
  }

  // Seis rubros sobre el costo de producción (mismos valores por defecto que la Ficha Técnica).
  const customProfit = positive(recipe.customUnitProfit)
  let unitProfit: number
  if (customProfit !== undefined) {
    unitProfit = customProfit
  } else {
    // `??` y no `||`: un rubro en 0 % es válido (docs/187); antes volvía al defecto.
    const rubros =
      (recipe.publicServices ?? 10) +
      (recipe.marketing ?? 10) +
      (recipe.operationalCosts ?? 30) +
      (recipe.laborCosts ?? 25) +
      isv +
      (recipe.contributionMargin ?? 30)
    unitProfit = unitCost * (rubros / 100) + (ctx.fixedCostPerPlate || 0)
  }
  return roundSalePrice(cover(unitCost + unitProfit), ctx.currencyCode)
}

/** Margen de contribución (%) de un precio, medido como en la Ficha Técnica (sobre la venta sin ISV en Food Cost). */
export function unitMarginPercent(recipe: Recipe, price: number, unitCost: number): number {
  if (!(price > 0)) return 0
  const isvPerUnit = pricingMethodOf(recipe) === "food_cost" ? taxIncludedIn(price, recipe.isv || 0) : 0
  const netSales = price - isvPerUnit
  const commission = price * commissionFraction(recipe)
  return netSales > 0 ? ((netSales - unitCost - commission) / netSales) * 100 : 0
}

/** Ganancia por plato en dinero, como en la Ficha: venta sin ISV (Food Cost) − costo − comisión (docs/188). */
export function unitMarginAmount(recipe: Recipe, price: number, unitCost: number): number {
  if (!(price > 0)) return 0
  const isvPerUnit = pricingMethodOf(recipe) === "food_cost" ? taxIncludedIn(price, recipe.isv || 0) : 0
  return price - isvPerUnit - price * commissionFraction(recipe) - unitCost
}

/** «Costo %» de la Ficha: costo ÷ venta sin ISV (Food Cost) × 100 (docs/188). */
export function unitCostPercent(recipe: Recipe, price: number, unitCost: number): number {
  if (!(price > 0)) return 0
  const isvPerUnit = pricingMethodOf(recipe) === "food_cost" ? taxIncludedIn(price, recipe.isv || 0) : 0
  const netSales = price - isvPerUnit
  return netSales > 0 ? (unitCost / netSales) * 100 : 0
}

/** Precio que la receta tiene hoy: el escrito a mano, o si no, el guardado. */
export function currentUnitPrice(recipe: Recipe): number {
  return positive(recipe.customUnitPrice) ?? positive(recipe.unitPrice) ?? 0
}

export type PriceRuleOutcome =
  | { kind: "none" }
  | { kind: "raised"; oldPrice: number; newPrice: number; patch: Partial<Recipe> }
  | { kind: "kept"; price: number; oldMargin: number; newMargin: number; patch: Partial<Recipe> }

/**
 * Aplica la regla a una receta cuyo costo unitario pasa de `oldUnitCost` a `newUnitCost`.
 * Devuelve qué cambiar en la receta (patch) y qué avisar. Recetas sin precio todavía
 * (nunca se les calculó uno) no se tocan.
 */
export function applyPriceRule(recipe: Recipe, oldUnitCost: number, newUnitCost: number, ctx: PricingContext): PriceRuleOutcome {
  const price = currentUnitPrice(recipe)
  if (!(price > 0) || !(newUnitCost > 0)) return { kind: "none" }
  const yieldAmount = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1

  const suggested = suggestedUnitPrice(recipe, newUnitCost, ctx)
  if (suggested > price + 0.004) {
    // Sube: el precio vuelve a seguir al sugerido.
    return {
      kind: "raised",
      oldPrice: price,
      newPrice: suggested,
      patch: { unitPrice: suggested, customUnitPrice: undefined, totalPrice: suggested * yieldAmount },
    }
  }

  if (newUnitCost < oldUnitCost - 1e-9) {
    // Baja el costo: el precio se queda (como escrito a mano) y el margen sube.
    return {
      kind: "kept",
      price,
      oldMargin: unitMarginPercent(recipe, price, oldUnitCost),
      newMargin: unitMarginPercent(recipe, price, newUnitCost),
      patch: { unitPrice: price, customUnitPrice: price, totalPrice: price * yieldAmount },
    }
  }

  return { kind: "none" }
}
