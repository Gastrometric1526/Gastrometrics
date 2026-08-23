/**
 * @deprecated This file is deprecated. Import directly from @/lib/storage instead.
 * This file is kept for backward compatibility only.
 */

import type { Recipe } from "@/types/recipe"

// Storage prefixes
const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

export function getDashboardData<T>(key: string, businessId?: string): T | null {
  const possibleKeys = [
    businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : null,
    businessId ? `${key}_${businessId}` : null,
    `${STORAGE_PREFIX}${key}`,
    key, // Simple key without prefix
  ].filter(Boolean) as string[]

  for (const storageKey of possibleKeys) {
    try {
      const data = localStorage.getItem(storageKey)
      if (data) {
        return JSON.parse(data)
      }
    } catch (error) {
      console.error(`Error reading from key ${storageKey}:`, error)
    }
  }

  return null
}

export function setDashboardData<T>(key: string, data: T, businessId?: string): void {
  const keys = [
    businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : `${STORAGE_PREFIX}${key}`,
    businessId ? `${key}_${businessId}` : key,
  ]

  keys.forEach((storageKey) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (error) {
      console.error(`Error saving to key ${storageKey}:`, error)
    }
  })

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dashboardDataUpdated", {
        detail: { key, businessId, dataType: typeof data, itemCount: Array.isArray(data) ? data.length : 1 },
      }),
    )
  }
}

export function saveBusinessRecipes(businessId: string, recipes: Recipe[]): void {
  try {
    const keys = [
      `recipes_${businessId}`,
      `${BUSINESS_PREFIX}${businessId}_recipes`,
      `${STORAGE_PREFIX}recipes`,
      "recipes",
    ]

    keys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify(recipes))
    })

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: { businessId, count: recipes.length },
        }),
      )
    }
  } catch (error) {
    console.error("Error saving business recipes:", error)
  }
}

export async function migrateCompleteRecipe(
  recipe: Recipe,
  sourceBusinessId: string | null,
  targetBusinessId: string,
): Promise<{
  success: boolean
  error?: string
  migratedRecipe?: Recipe
  migratedIngredients: any[]
  skippedIngredients: string[]
}> {
  try {
    // Get source and target ingredients
    const sourceIngredients = getDashboardData("ingredients", sourceBusinessId) || []
    const targetIngredients = getDashboardData("ingredients", targetBusinessId) || []

    // Get recipe ingredient IDs
    const recipeIngredientIds = recipe.ingredients.map((ing) => ing.ingredientId)
    const ingredientsToMigrate = sourceIngredients.filter((ing: any) => recipeIngredientIds.includes(ing.id))

    const migratedIngredients: any[] = []
    const skippedIngredients: string[] = []

    // Migrate ingredients
    for (const ingredient of ingredientsToMigrate) {
      // Check if similar ingredient exists
      const existingSimilar = targetIngredients.find((target: any) => {
        const nameMatch = target.name.toLowerCase().trim() === ingredient.name.toLowerCase().trim()
        const categoryMatch = target.category === ingredient.category
        const contentMatch = Math.abs((target.pricing?.netContent || 0) - (ingredient.pricing?.netContent || 0)) < 0.01
        const priceMatch =
          Math.abs((target.pricing?.purchasePrice || 0) - (ingredient.pricing?.purchasePrice || 0)) < 0.01
        const supplierMatch = !ingredient.supplier || !target.supplier || target.supplier === ingredient.supplier

        return nameMatch && categoryMatch && contentMatch && priceMatch && supplierMatch
      })

      if (!existingSimilar) {
        // Create new ingredient with new ID
        const migratedIngredient = {
          ...ingredient,
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
          businessId: targetBusinessId,
          metadata: {
            ...ingredient.metadata,
            migratedFrom: sourceBusinessId || "main",
            migratedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          notes: ingredient.notes
            ? `${ingredient.notes}\n\n🔄 Migrado desde ${sourceBusinessId ? "negocio" : "dashboard principal"}`
            : `🔄 Migrado desde ${sourceBusinessId ? "negocio" : "dashboard principal"}`,
        }

        migratedIngredients.push(migratedIngredient)
        targetIngredients.push(migratedIngredient)
      } else {
        skippedIngredients.push(ingredient.name)
      }
    }

    // Save migrated ingredients if any
    if (migratedIngredients.length > 0) {
      setDashboardData("ingredients", targetIngredients, targetBusinessId)
    }

    // Migrate the recipe
    const migratedRecipe: Recipe = {
      ...recipe,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      metadata: {
        ...recipe.metadata,
        migratedFrom: sourceBusinessId || "main",
        migratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }

    // Get target recipes and add the migrated one
    const targetRecipes = getDashboardData("recipes", targetBusinessId) || []
    targetRecipes.push(migratedRecipe)
    setDashboardData("recipes", targetRecipes, targetBusinessId)

    return {
      success: true,
      migratedRecipe,
      migratedIngredients,
      skippedIngredients,
    }
  } catch (error) {
    console.error("Error in migrateCompleteRecipe:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido en la migración",
      migratedIngredients: [],
      skippedIngredients: [],
    }
  }
}
