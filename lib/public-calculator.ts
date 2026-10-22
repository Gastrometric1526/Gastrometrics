/**
 * Calculadora pública y gratuita de /calculadora-food-cost (docs/178), sin registro. Atrae
 * gente desde Google y le muestra lo que la app hace con todas sus recetas. Reutiliza las
 * mismas fórmulas que la Ficha Técnica (lib/food-cost-pricing.ts y lib/price-rounding.ts),
 * así que el precio que da aquí es el mismo que daría la app con el método Food Cost %.
 */

import { foodCostBasePrice, taxIncludedIn } from "@/lib/food-cost-pricing"
import { getPriceRoundingStep, roundUpToStep } from "@/lib/price-rounding"

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, min), max)

export interface PublicPriceInput {
  unitCost: number
  targetFoodCostPercent: number
  isvPercent: number
  commissionPercent: number
  currencyCode: string
}

export interface PublicPriceResult {
  /** Precio antes del redondeo de la moneda. */
  beforeRounding: number
  /** Precio sugerido: redondeado hacia arriba al escalón de la moneda. */
  price: number
  step: number
  tax: number
  commission: number
  /** Lo que queda por plato después del costo, el impuesto y la comisión. */
  profit: number
  /** Costo ÷ venta neta (sin impuesto), con el precio ya redondeado. */
  realFoodCostPercent: number
}

/** Misma fórmula que suggestedUnitPrice (método Food Cost %) en lib/recipe-pricing.ts. */
export function publicSalePrice(input: PublicPriceInput): PublicPriceResult | null {
  const unitCost = Number(input.unitCost)
  const target = clamp(input.targetFoodCostPercent, 0, 100)
  if (!(unitCost > 0) || !(target > 0)) return null
  const isv = clamp(input.isvPercent, 0, 100)
  const fraction = clamp(input.commissionPercent, 0, 90) / 100

  const base = foodCostBasePrice(unitCost, target, isv)
  const beforeRounding = fraction > 0 ? base / (1 - fraction) : base
  const step = getPriceRoundingStep(input.currencyCode)
  const price = roundUpToStep(beforeRounding, step)
  const tax = taxIncludedIn(price, isv)
  const commission = price * fraction
  const net = price - tax
  return {
    beforeRounding,
    price,
    step,
    tax,
    commission,
    profit: price - tax - commission - unitCost,
    realFoodCostPercent: net > 0 ? (unitCost / net) * 100 : 0,
  }
}

/** Costo real con merma: precio de compra ÷ (1 − merma). La merma se limita a 0–95 %. */
export function realCostWithWaste(purchasePrice: number, wastePercent: number): number | null {
  const price = Number(purchasePrice)
  if (!(price > 0)) return null
  const waste = clamp(wastePercent, 0, 95) / 100
  return price / (1 - waste)
}
