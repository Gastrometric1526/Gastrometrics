/**
 * SUB-RECIPE CORE LOGIC
 * Handles the automatic creation of ingredients from sub-recipes
 * KEY RULE: When classification = "Sub Receta / produccion (Mise en place)" → create ingredient in BASE DE DATOS
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { units } from "@/types/ingredient"
import { getIngredients, saveIngredients, getIngredientByRecipeId } from "../storage/ingredients"
import { isSubRecipe } from "../storage/recipes"

// recipe.yieldUnit es texto libre (el chef puede escribir "porciones", "bandejas",
// etc.) mientras que Ingredient.unit está restringido a la lista real de unidades —
// si el rendimiento de la receta no coincide con ninguna, cae a "unidad" en vez de
// colar un valor que el resto de la app (selectores, conversiones) no reconoce.
function toIngredientUnit(yieldUnit: string): Ingredient["unit"] {
  const match = units.find((u) => u.toLowerCase() === yieldUnit.trim().toLowerCase())
  return match || "unidad"
}

/**
 * Create or update ingredient from sub-recipe
 * This is called automatically when saving a sub-recipe
 */
export function syncSubRecipeToIngredient(recipe: Recipe, businessId?: string | null): Ingredient | null {
  if (!isSubRecipe(recipe)) {
    console.log(`[SubRecipe] Recipe "${recipe.name}" is not a sub-recipe, skipping sync`)
    return null
  }

  console.log(`[SubRecipe] Syncing sub-recipe "${recipe.name}" to ingredient`)

  const ingredients = getIngredients(businessId)
  const existingIngredient = getIngredientByRecipeId(recipe.id, businessId)

  // Calculate unit cost from recipe
  const unitCost = recipe.yieldAmount > 0 ? recipe.totalCost / recipe.yieldAmount : recipe.totalCost

  const ingredientData: Ingredient = {
    id: existingIngredient?.id || `subrecipe_${recipe.id}_${Date.now()}`,
    name: recipe.name,
    category: "Sub Receta / produccion (Mise en place)",
    unit: toIngredientUnit(recipe.yieldUnit || ""),
    pricing: {
      purchasePrice: unitCost,
      netContent: recipe.yieldAmount || 1,
      pricePerUnit: unitCost,
      lastUpdated: new Date().toISOString(),
    },
    supplier: "Producción Local",
    metadata: {
      createdAt: existingIngredient?.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (existingIngredient?.metadata?.version || 0) + 1,
    },
    recipeId: recipe.id,
    recipeData: {
      originalRecipeId: recipe.id,
      recipeName: recipe.name,
      recipeClassification: recipe.classification,
      recipePlate: recipe.plate,
      recipeYield: recipe.yieldAmount,
      recipeTotalCost: recipe.totalCost,
      recipeUnitCost: unitCost,
      recipeUnitProfit: recipe.customUnitProfit || 0,
      recipeContributionMargin: recipe.contributionMargin || 0,
      recipeIngredients: recipe.ingredients,
      recipeProcedures: recipe.procedure || [],
      recipeImage: recipe.image,
      lastSyncedAt: new Date().toISOString(),
    },
    businessId: businessId || "main",
    notes: `Ingrediente auto-generado desde receta "${recipe.name}". Última sincronización: ${new Date().toLocaleString()}`,
  }

  if (existingIngredient) {
    // Update existing ingredient
    const index = ingredients.findIndex((i) => i.id === existingIngredient.id)
    if (index !== -1) {
      ingredients[index] = ingredientData
      console.log(`[SubRecipe] Updated ingredient for sub-recipe "${recipe.name}"`)
    }
  } else {
    // Create new ingredient
    ingredients.push(ingredientData)
    console.log(`[SubRecipe] Created new ingredient for sub-recipe "${recipe.name}"`)
  }

  saveIngredients(ingredients, businessId)

  // Dispatch event for UI updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ingredientsUpdated", {
        detail: { businessId: businessId || "main", action: "subrecipe-sync", recipeId: recipe.id },
      }),
    )
  }

  return ingredientData
}

/**
 * Delete ingredient when sub-recipe is deleted
 */
export function deleteSubRecipeIngredient(recipeId: string, businessId?: string | null): boolean {
  const ingredients = getIngredients(businessId)
  const filtered = ingredients.filter((i) => i.recipeId !== recipeId && i.recipeData?.originalRecipeId !== recipeId)

  if (filtered.length === ingredients.length) {
    return false // No ingredient was linked to this recipe
  }

  saveIngredients(filtered, businessId)
  console.log(`[SubRecipe] Deleted ingredient linked to recipe ${recipeId}`)
  return true
}
