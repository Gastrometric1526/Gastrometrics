/**
 * «Traer de mi espacio principal» (pedido del dueño, docs/284): al crear un negocio, la
 * persona puede llevar de una vez sus recetas (todas o las que elija) con sus ingredientes y
 * subrecetas, y también los ingredientes que ninguna receta usa.
 *
 * Reutiliza la misma migración de una receta (`migrateCompleteRecipe`, docs/263–264): no hay
 * otra lógica de copia. Para no duplicar:
 * - primero las subrecetas, después el resto (así una receta que usa una subreceta ya
 *   elegida la encuentra en el destino, y la cadena de subrecetas la reutiliza por nombre);
 * - una receta que el negocio ya tiene con el mismo nombre se salta;
 * - los ingredientes sueltos se copian solo si el destino no tiene uno igual
 *   (mismo nombre, categoría, contenido, precio y proveedor).
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { getRecipes, isSubRecipe, ensureRecipesLoaded } from "../storage/recipes"
import { getIngredients, saveIngredients, ensureIngredientsLoaded } from "../storage/ingredients"
import { migrateCompleteRecipe, findSimilarIngredient } from "./migration"

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export type BulkMigrationPlan = {
  /** En el orden en que se migran: subrecetas primero. */
  toMigrate: Recipe[]
  /** Ya existen en el negocio destino (mismo nombre). */
  alreadyThere: Recipe[]
}

export function planBulkMigration(source: Recipe[], selectedIds: string[], target: Recipe[]): BulkMigrationPlan {
  const selected = source.filter((r) => selectedIds.includes(r.id))
  const alreadyThere = selected.filter((r) => target.some((t) => sameName(t.name, r.name)))
  const pending = selected.filter((r) => !alreadyThere.includes(r))
  const toMigrate = [...pending.filter((r) => isSubRecipe(r)), ...pending.filter((r) => !isSubRecipe(r))]
  return { toMigrate, alreadyThere }
}

/** Ingredientes del origen que no son de una subreceta y que el destino no tiene. */
export function looseIngredientsToCopy(source: Ingredient[], target: Ingredient[]): Ingredient[] {
  return source.filter((ing) => !ing.recipeId && !findSimilarIngredient(ing, target))
}

export type BulkMigrationResult = {
  migrated: number
  skipped: number
  failed: string[]
  ingredientsCopied: number
}

export async function runBulkMigration(input: {
  sourceBusinessId: string
  targetBusinessId: string
  recipeIds: string[]
  includeLooseIngredients: boolean
  onProgress?: (done: number, total: number, current: string) => void
}): Promise<BulkMigrationResult> {
  const { sourceBusinessId, targetBusinessId } = input
  await Promise.all([
    ensureRecipesLoaded(sourceBusinessId),
    ensureRecipesLoaded(targetBusinessId),
    ensureIngredientsLoaded(sourceBusinessId),
    ensureIngredientsLoaded(targetBusinessId),
  ])
  const plan = planBulkMigration(getRecipes(sourceBusinessId), input.recipeIds, getRecipes(targetBusinessId))
  const total = plan.toMigrate.length + (input.includeLooseIngredients ? 1 : 0)
  const failed: string[] = []
  let migrated = 0
  let skipped = plan.alreadyThere.length
  let step = 0

  for (const recipe of plan.toMigrate) {
    input.onProgress?.(step, total, recipe.name)
    // Pudo llegar antes como subreceta de otra receta de la lista: no se duplica.
    if (getRecipes(targetBusinessId).some((t) => sameName(t.name, recipe.name))) {
      skipped++
      step++
      continue
    }
    const result = await migrateCompleteRecipe(recipe, sourceBusinessId, targetBusinessId, undefined, { includeIngredients: true })
    if (result.success && result.migratedRecipe) {
      migrated++
    } else {
      failed.push(recipe.name)
    }
    step++
  }

  let ingredientsCopied = 0
  if (input.includeLooseIngredients) {
    input.onProgress?.(step, total, "")
    const target = getIngredients(targetBusinessId) || []
    const copies = looseIngredientsToCopy(getIngredients(sourceBusinessId) || [], target).map(
      (ing): Ingredient => ({
        ...ing,
        id: `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        businessId: targetBusinessId,
        metadata: { ...ing.metadata, migratedFrom: sourceBusinessId, migratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      }),
    )
    if (copies.length) {
      await saveIngredients([...target, ...copies], targetBusinessId)
      ingredientsCopied = copies.length
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ingredientsUpdated", { detail: { businessId: targetBusinessId, action: "migrated", count: copies.length } }))
      }
    }
    step++
  }
  input.onProgress?.(total, total, "")
  return { migrated, skipped, failed, ingredientsCopied }
}
