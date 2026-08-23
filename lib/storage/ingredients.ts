/**
 * INGREDIENT STORAGE MODULE
 * Centralized ingredient management - BASE DE DATOS core
 */

import type { Ingredient } from "@/types/ingredient"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"

/**
 * Get all ingredients for a business (BASE DE DATOS)
 */
export function getIngredients(businessId?: string | null): Ingredient[] {
  const ingredients = getFromStorage<Ingredient[]>(STORAGE_KEYS.INGREDIENTS, businessId) || []
  console.log(`[Ingredients] Loaded ${ingredients.length} ingredients for business ${businessId || "main"}`)
  return ingredients
}

/**
 * Save ingredients for a business
 */
export function saveIngredients(ingredients: Ingredient[], businessId?: string | null): void {
  console.log(`[Ingredients] Saving ${ingredients.length} ingredients for business ${businessId || "main"}`)
  saveToStorage(STORAGE_KEYS.INGREDIENTS, ingredients, businessId)
}

/**
 * Get a single ingredient by ID
 */
export function getIngredientById(ingredientId: string, businessId?: string | null): Ingredient | null {
  const ingredients = getIngredients(businessId)
  return ingredients.find((i) => i.id === ingredientId) || null
}

/**
 * Add a new ingredient to BASE DE DATOS
 */
export function addIngredient(ingredient: Ingredient, businessId?: string | null): Ingredient {
  const ingredients = getIngredients(businessId)

  const newIngredient: Ingredient = {
    ...ingredient,
    businessId: businessId || "main",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  }

  ingredients.push(newIngredient)
  saveIngredients(ingredients, businessId)

  console.log(`[Ingredients] Added ingredient: ${newIngredient.name} (${newIngredient.id})`)
  return newIngredient
}

/**
 * Update an existing ingredient in BASE DE DATOS
 */
export function updateIngredient(
  ingredientId: string,
  updates: Partial<Ingredient>,
  businessId?: string | null,
): Ingredient | null {
  const ingredients = getIngredients(businessId)
  const index = ingredients.findIndex((i) => i.id === ingredientId)

  if (index === -1) {
    console.error(`[Ingredients] Cannot update - ingredient not found: ${ingredientId}`)
    return null
  }

  const updatedIngredient: Ingredient = {
    ...ingredients[index],
    ...updates,
    metadata: {
      ...ingredients[index].metadata,
      updatedAt: new Date().toISOString(),
      version: (ingredients[index].metadata?.version || 1) + 1,
    },
  }

  ingredients[index] = updatedIngredient
  saveIngredients(ingredients, businessId)

  console.log(`[Ingredients] Updated ingredient: ${updatedIngredient.name} (${updatedIngredient.id})`)
  return updatedIngredient
}

/**
 * Delete an ingredient from BASE DE DATOS
 */
export function deleteIngredient(ingredientId: string, businessId?: string | null): boolean {
  const ingredients = getIngredients(businessId)
  const filtered = ingredients.filter((i) => i.id !== ingredientId)

  if (filtered.length === ingredients.length) {
    console.warn(`[Ingredients] Cannot delete - ingredient not found: ${ingredientId}`)
    return false
  }

  saveIngredients(filtered, businessId)
  console.log(`[Ingredients] Deleted ingredient: ${ingredientId}`)
  return true
}

/**
 * Find ingredient by recipe ID (for sub-recipes)
 */
export function getIngredientByRecipeId(recipeId: string, businessId?: string | null): Ingredient | null {
  const ingredients = getIngredients(businessId)
  return ingredients.find((i) => i.recipeId === recipeId || i.recipeData?.originalRecipeId === recipeId) || null
}

/**
 * Get all sub-recipe ingredients
 */
export function getSubRecipeIngredients(businessId?: string | null): Ingredient[] {
  const ingredients = getIngredients(businessId)
  // BUG CORREGIDO: comparaba contra "SUB RECETA", una categoría que nunca existió —
  // la categoría real que usa lib/subrecipe/core.ts al sincronizar una sub-receta es
  // "Sub Receta / produccion (Mise en place)" (ver types/ingredient.ts, categories).
  // Sin efecto práctico hasta ahora porque el `|| i.recipeId` ya cubría todos los
  // casos reales, pero la comparación en sí nunca podía ser cierta.
  return ingredients.filter((i) => i.category === "Sub Receta / produccion (Mise en place)" || i.recipeId)
}

/**
 * Upsert ingredient (add or update)
 */
export function upsertIngredient(ingredient: Ingredient, businessId?: string | null): Ingredient {
  const ingredients = getIngredients(businessId)
  const existingIndex = ingredients.findIndex((i) => i.id === ingredient.id)

  const savedIngredient: Ingredient = {
    ...ingredient,
    businessId: businessId || "main",
    metadata: {
      createdAt: ingredient.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (ingredient.metadata?.version || 0) + 1,
    },
  }

  if (existingIndex >= 0) {
    ingredients[existingIndex] = savedIngredient
    console.log(`[Ingredients] Updated ingredient: ${savedIngredient.name}`)
  } else {
    ingredients.push(savedIngredient)
    console.log(`[Ingredients] Added ingredient: ${savedIngredient.name}`)
  }

  saveIngredients(ingredients, businessId)
  return savedIngredient
}
