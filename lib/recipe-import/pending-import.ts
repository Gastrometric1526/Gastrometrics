/**
 * Receta importada esperando abrirse en la Ficha Técnica (docs/145). El diálogo de
 * importación la deja en sessionStorage y navega a /ficha-tecnica; la Ficha Técnica (modo
 * nuevo) la toma una sola vez, arma la receta con los ingredientes de la base y la borra.
 */

import type { Ingredient } from "@/types/ingredient"
import { unitAbbreviations } from "@/types/ingredient"
import type { Recipe, RecipeIngredient } from "@/types/recipe"

export interface PendingImportIngredient {
  ingredientId: string // ya existe en la base (o se acaba de crear)
  quantity: number // en la unidad del ingrediente
  note: string
}

export interface PendingRecipeImport {
  name: string
  servings: number
  yieldAmount: number
  yieldUnit: Recipe["yieldUnit"]
  procedure: string[]
  observations: string[]
  ingredients: PendingImportIngredient[]
}

const keyFor = (businessId?: string | null) => `gm_recipe_import:${businessId || "main"}`

export function setPendingImport(businessId: string | null | undefined, payload: PendingRecipeImport): void {
  try {
    sessionStorage.setItem(keyFor(businessId), JSON.stringify(payload))
  } catch {
    /* sin sessionStorage: no se puede pasar la receta */
  }
}

export function takePendingImport(businessId: string | null | undefined): PendingRecipeImport | null {
  try {
    const raw = sessionStorage.getItem(keyFor(businessId))
    if (!raw) return null
    sessionStorage.removeItem(keyFor(businessId))
    return JSON.parse(raw) as PendingRecipeImport
  } catch {
    return null
  }
}

/** Filas de ingredientes de la ficha, igual que si se eligieran a mano (updateIngredient). */
export function buildImportedRows(items: PendingImportIngredient[], available: Ingredient[]): RecipeIngredient[] {
  const now = Date.now()
  const rows: RecipeIngredient[] = []
  items.forEach((item, i) => {
    const ing = available.find((a) => a.id === item.ingredientId)
    if (!ing) return
    const unitCost = ing.pricing?.pricePerUnit || 0
    rows.push({
      id: `ing-${now}-${i}`,
      ingredientId: ing.id,
      name: ing.name,
      category: ing.category,
      quantity: item.quantity,
      unit: ing.unit,
      measure: unitAbbreviations[ing.unit] || ing.unit,
      cost: 0,
      unitCost,
      costPerMeasure: unitCost,
      extension: item.quantity * unitCost,
      notes: item.note || undefined,
    })
  })
  return rows
}
