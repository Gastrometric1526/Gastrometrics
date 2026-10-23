/**
 * Guarda lo que acompaña a un cambio de unidad de ingredientes (docs/187): las líneas de
 * receta, el inventario y su historial, con la misma conversión que el ingrediente (ver
 * lib/unit-change.ts). Cada pantalla guarda el ingrediente como ya lo hacía.
 */

import { getRecipes, saveRecipes } from "./recipes"
import { getInventory, saveInventory, getInventoryHistory, saveInventoryHistory } from "./inventory"
import { convertInventoryItemUnit, convertRecipeLines, convertSnapshotsUnit } from "@/lib/unit-change"

export interface UnitChange {
  ingredientId: string
  newUnit: string
  /** Unidades nuevas en una unidad vieja (1 kg → 1000 g = 1000). */
  factor: number
}

export async function persistUnitChangeSideEffects(changes: UnitChange[], businessId?: string | null): Promise<void> {
  const real = changes.filter((c) => c.factor > 0 && c.factor !== 1)
  if (!real.length) return

  let recipes = getRecipes(businessId)
  const changedRecipeIds = new Set<string>()
  for (const c of real) {
    for (const updated of convertRecipeLines(recipes, c.ingredientId, c.newUnit, c.factor)) {
      changedRecipeIds.add(updated.id)
      recipes = recipes.map((r) => (r.id === updated.id ? updated : r))
    }
  }
  if (changedRecipeIds.size) await saveRecipes(recipes, businessId)

  const inventory = getInventory(businessId)
  let inventoryChanged = false
  const nextInventory = inventory.map((item) => {
    const c = real.find((x) => x.ingredientId === item.id)
    if (!c) return item
    inventoryChanged = true
    return convertInventoryItemUnit(item, c.newUnit, c.factor)
  })
  if (inventoryChanged) await saveInventory(nextInventory, businessId)

  let history = getInventoryHistory(businessId)
  let historyChanged = false
  for (const c of real) {
    const next = convertSnapshotsUnit(history, c.ingredientId, c.newUnit, c.factor)
    if (next) {
      history = next
      historyChanged = true
    }
  }
  if (historyChanged) await saveInventoryHistory(history, businessId)
}
