/**
 * Precio de las recetas que llegan a un negocio (pedido del dueño, docs/341): «toda receta que
 * sea migrada se ajuste a los datos financieros del negocio y le pregunte al usuario si quiere
 * el precio que tenía en su Dashboard o el que sugieren los rubros».
 *
 * Puro (probado en migration-price.test.ts). La ventana vive en
 * components/migration-price-dialog.tsx.
 *
 * - «Usar el del negocio»: la receta toma los rubros de gasto del negocio (con gastos reales,
 *   en 0: el gasto ya va como costo fijo por plato) y el precio sugerido con el costo y el
 *   contexto del negocio (`suggestedUnitPrice`, la misma fórmula de la Ficha).
 * - «Mantener el mío»: el precio de antes queda como escrito a mano (`customUnitPrice`), para que
 *   la Ficha ni la cascada lo cambien solos.
 * Las subrecetas no entran: su precio rara vez es de venta y tienen su propia regla (docs/164).
 */

import type { Recipe } from "@/types/recipe"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
import { LEGACY_PRICING_METHOD } from "@/types/business"
import { currentUnitPrice, suggestedUnitPrice, type PricingContext } from "@/lib/recipe-pricing"
import { EXPENSE_RUBROS, type PricingPercentages } from "@/lib/pricing-percentages"

export const MIGRATION_PRICE_EVENT = "gm:migration-price-review"

export interface MigrationPriceRow {
  recipeId: string
  name: string
  /** Precio que trae de su espacio de origen. */
  currentPrice: number
  /** Precio sugerido en este negocio (costo de aquí, rubros y costo fijo del negocio). */
  suggestedPrice: number
}

const positive = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined)

export function isSubRecipeLike(recipe: Recipe): boolean {
  return recipe.classification === SUBRECIPE_CLASSIFICATION || recipe.isSubRecipe === true
}

function unitCostOf(recipe: Recipe): number {
  const yieldAmount = positive(recipe.yieldAmount) ?? 1
  return positive(recipe.costPerServing) ?? (positive(recipe.totalCost) ?? 0) / yieldAmount
}

/** La receta con los rubros de gasto del negocio (solo método de 6 rubros sin ganancia escrita a mano). */
export function withBusinessRubros(recipe: Recipe, defaults: PricingPercentages): Recipe {
  const method = recipe.pricingMethod || LEGACY_PRICING_METHOD
  if (method !== "gastrometrics" || positive(recipe.customUnitProfit) !== undefined) return recipe
  const next = { ...recipe }
  for (const key of EXPENSE_RUBROS) next[key] = defaults[key]
  return next
}

/** Recetas cuyo precio cambia en este negocio: las que hay que preguntar. */
export function migrationPriceRows(recipes: Recipe[], defaults: PricingPercentages, ctx: PricingContext): MigrationPriceRow[] {
  const rows: MigrationPriceRow[] = []
  for (const recipe of recipes) {
    if (isSubRecipeLike(recipe)) continue
    const unitCost = unitCostOf(recipe)
    if (!(unitCost > 0)) continue
    const suggestedPrice = suggestedUnitPrice(withBusinessRubros(recipe, defaults), unitCost, ctx)
    const currentPrice = currentUnitPrice(recipe)
    if (!(suggestedPrice > 0) || Math.abs(suggestedPrice - currentPrice) < 0.005) continue
    rows.push({ recipeId: recipe.id, name: recipe.name, currentPrice, suggestedPrice })
  }
  return rows
}

/** Lo que se guarda en la receta según la elección. */
export function migrationPricePatch(recipe: Recipe, choice: "business" | "mine", defaults: PricingPercentages, ctx: PricingContext): Recipe {
  const yieldAmount = positive(recipe.yieldAmount) ?? 1
  if (choice === "mine") {
    const price = currentUnitPrice(recipe)
    return price > 0 ? { ...recipe, unitPrice: price, customUnitPrice: price, totalPrice: price * yieldAmount } : recipe
  }
  const adjusted = withBusinessRubros(recipe, defaults)
  const price = suggestedUnitPrice(adjusted, unitCostOf(recipe), ctx)
  return price > 0 ? { ...adjusted, unitPrice: price, customUnitPrice: undefined, totalPrice: price * yieldAmount } : adjusted
}
