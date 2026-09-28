/**
 * Expande recetas (y sus sub-recetas, en cualquier nivel) a ingredientes BASE con la
 * cantidad que realmente se consume. Única fuente de esta regla — la usan las órdenes
 * de compra generadas (lib/purchase-orders.ts) y el stock teórico
 * (lib/theoretical-stock.ts). Ver docs/134.
 *
 * Dos correcciones respecto de la expansión que tenía lib/purchase-orders.ts:
 * 1. Sub-recetas: la cantidad usada se divide por el RENDIMIENTO de la sub-receta. Usar
 *    150 g de una salsa que rinde 1000 g consume el 15 % de sus ingredientes — antes se
 *    multiplicaban por 150 (la receta completa 150 veces). Es el mismo criterio que el
 *    «costo de uso» (costo total ÷ rendimiento, lib/subrecipe).
 * 2. Merma (opcional, `grossUpMerma`): las cantidades de una receta son APROVECHABLES
 *    (la merma sube el precio por unidad, no la cantidad). Para compras y bodega hace falta
 *    la cantidad BRUTA: aprovechable × (contenido original ÷ contenido aprovechable).
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"

export interface ConsumptionEntry {
  quantity: number
  unit: string
  sourceRecipes: Set<string>
}

export type ConsumptionMap = Map<string, ConsumptionEntry>

const MAX_DEPTH = 10

/** Rendimiento contra el que se escala una receta (mismo criterio que lib/menus.ts). */
export function recipeBaseYield(recipe: Pick<Recipe, "yieldAmount">): number {
  return recipe.yieldAmount && recipe.yieldAmount > 0 ? recipe.yieldAmount : 1
}

/** Factor aprovechable → bruto de un ingrediente con merma activa (1 si no tiene). */
export function mermaGrossFactor(ingredient: Ingredient): number {
  const original = ingredient.originalNetContent
  const usable = ingredient.pricing?.netContent
  if (original && usable && original > usable && usable > 0) return original / usable
  return 1
}

function subRecipeIdOf(ingredient: Ingredient): string | null {
  return ingredient.recipeId || ingredient.recipeData?.originalRecipeId || null
}

/**
 * Suma en `acc` lo que consume `multiplier` veces la receta tal como está escrita
 * (multiplier = 1 → la receta completa; = porciones ÷ rendimiento → esas porciones).
 */
export function accumulateRecipeConsumption(
  recipe: Recipe,
  multiplier: number,
  recipesById: Map<string, Recipe>,
  ingredientsById: Map<string, Ingredient>,
  acc: ConsumptionMap,
  options: { grossUpMerma?: boolean; warnings?: string[]; depth?: number; sourceName?: string } = {},
): void {
  const depth = options.depth ?? 0
  if (depth > MAX_DEPTH) {
    options.warnings?.push(`Maximum recursion depth reached for sub-recipe: ${recipe.name}`)
    return
  }
  if (!(multiplier > 0)) return
  const sourceName = options.sourceName ?? recipe.name

  for (const line of recipe.ingredients ?? []) {
    if (!line.ingredientId || !(line.quantity > 0)) continue
    const ingredient = ingredientsById.get(line.ingredientId)
    if (!ingredient) {
      options.warnings?.push(`Ingredient not found: ${line.ingredientId} in recipe ${recipe.name}`)
      continue
    }
    const used = line.quantity * multiplier

    const subId = subRecipeIdOf(ingredient)
    if (subId) {
      const sub = recipesById.get(subId)
      if (sub) {
        accumulateRecipeConsumption(sub, used / recipeBaseYield(sub), recipesById, ingredientsById, acc, {
          ...options,
          depth: depth + 1,
          sourceName: sub.name,
        })
      } else {
        options.warnings?.push(`Sub-recipe not found: ${subId}`)
      }
      continue
    }

    const quantity = options.grossUpMerma ? used * mermaGrossFactor(ingredient) : used
    const entry = acc.get(ingredient.id)
    if (entry) {
      entry.quantity += quantity
      entry.sourceRecipes.add(sourceName)
    } else {
      acc.set(ingredient.id, { quantity, unit: ingredient.unit, sourceRecipes: new Set([sourceName]) })
    }
  }
}

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}
