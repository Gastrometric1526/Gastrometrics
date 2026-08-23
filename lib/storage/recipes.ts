/**
 * RECIPE STORAGE MODULE
 * Centralized recipe management with type safety
 */

import type { Recipe } from "@/types/recipe"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"

/**
 * Validate recipe data before saving
 */
export function validateRecipeData(recipe: Recipe): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields validation
  if (!recipe.id || recipe.id.trim() === "") {
    errors.push("ID de receta es requerido")
  }

  if (!recipe.name || recipe.name.trim() === "") {
    errors.push("Nombre de receta es requerido")
  }

  if (!recipe.classification || recipe.classification.trim() === "") {
    errors.push("Clasificación es requerida")
  }

  if (!recipe.businessId || recipe.businessId.trim() === "") {
    errors.push("ID de negocio es requerido")
  }

  // Numeric validations
  if (recipe.servings <= 0) {
    errors.push("Las porciones deben ser mayor a 0")
  }

  if (recipe.yieldAmount <= 0) {
    errors.push("El rendimiento debe ser mayor a 0")
  }

  // Array validations
  if (!Array.isArray(recipe.ingredients)) {
    errors.push("Los ingredientes deben ser un array")
  } else if (recipe.ingredients.length === 0) {
    errors.push("Debe haber al menos un ingrediente")
  }

  if (!Array.isArray(recipe.procedure)) {
    errors.push("El procedimiento debe ser un array")
  }

  // Metadata validation
  if (!recipe.metadata) {
    errors.push("Metadata es requerida")
  } else {
    if (!recipe.metadata.createdAt) {
      errors.push("Fecha de creación es requerida")
    }
    if (!recipe.metadata.updatedAt) {
      errors.push("Fecha de actualización es requerida")
    }
    if (!recipe.metadata.version || recipe.metadata.version < 1) {
      errors.push("Versión debe ser mayor o igual a 1")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize recipe data before saving
 */
export function sanitizeRecipeData(recipe: Recipe): Recipe {
  return {
    ...recipe,
    id: recipe.id.trim(),
    name: recipe.name.trim(),
    classification: recipe.classification.trim(),
    plate: recipe.plate.trim(),
    businessId: recipe.businessId.trim(),
    servings: Math.max(1, Math.round(recipe.servings)),
    yieldAmount: Math.max(1, recipe.yieldAmount),
    yieldUnit: recipe.yieldUnit.trim(),
    totalCost: Math.max(0, recipe.totalCost || 0),
    costPerServing: Math.max(0, recipe.costPerServing || 0),
    ingredients: recipe.ingredients.map((ing, index) => ({
      ...ing,
      name: ing.name.trim(),
      quantity: Math.max(0, ing.quantity),
      cost: Math.max(0, ing.cost || 0),
      originalIndex: ing.originalIndex !== undefined ? ing.originalIndex : index,
    })),
    procedure: recipe.procedure.filter((step) => step && step.trim() !== ""),
    metadata: {
      ...recipe.metadata,
      createdAt: recipe.metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: Math.max(1, recipe.metadata.version || 1),
    },
  }
}

/**
 * Get all recipes for a business
 */
export function getRecipes(businessId?: string | null): Recipe[] {
  try {
    const recipes = getFromStorage<Recipe[]>(STORAGE_KEYS.RECIPES, businessId) || []
    console.log(`[Recipes] Loaded ${recipes.length} recipes for business ${businessId || "main"}`)
    return recipes
  } catch (error) {
    console.error("[Recipes] Error loading recipes:", error)
    return []
  }
}

/**
 * Save recipes for a business
 */
export function saveRecipes(recipes: Recipe[], businessId?: string | null): void {
  try {
    console.log(`[Recipes] Saving ${recipes.length} recipes for business ${businessId || "main"}`)
    saveToStorage(STORAGE_KEYS.RECIPES, recipes, businessId)
  } catch (error) {
    console.error("[Recipes] Error saving recipes:", error)
    throw new Error("No se pudieron guardar las recetas")
  }
}

/**
 * Get a single recipe by ID
 */
export function getRecipeById(recipeId: string, businessId?: string | null): Recipe | null {
  try {
    const recipes = getRecipes(businessId)
    const recipe = recipes.find((r) => r.id === recipeId)

    if (!recipe) {
      console.warn(`[Recipes] Recipe not found: ${recipeId}`)
    }

    return recipe || null
  } catch (error) {
    console.error("[Recipes] Error getting recipe by ID:", error)
    return null
  }
}

/**
 * Save a single recipe (add or update) with validation
 */
export function saveRecipe(recipe: Recipe, businessId?: string | null): Recipe {
  try {
    const validation = validateRecipeData(recipe)
    if (!validation.valid) {
      const errorMessage = `Validación falló: ${validation.errors.join(", ")}`
      console.error("[Recipes]", errorMessage)
      throw new Error(errorMessage)
    }

    const sanitizedRecipe = sanitizeRecipeData(recipe)

    const recipes = getRecipes(businessId)
    const existingIndex = recipes.findIndex((r) => r.id === sanitizedRecipe.id)

    const savedRecipe: Recipe = {
      ...sanitizedRecipe,
      businessId: businessId || "main",
      metadata: {
        createdAt: sanitizedRecipe.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: existingIndex >= 0 ? (sanitizedRecipe.metadata?.version || 0) + 1 : 1,
      },
    }

    if (existingIndex >= 0) {
      recipes[existingIndex] = savedRecipe
      console.log(`[Recipes] ✅ Updated recipe: ${savedRecipe.name} (ID: ${savedRecipe.id})`)
    } else {
      recipes.push(savedRecipe)
      console.log(`[Recipes] ✅ Added new recipe: ${savedRecipe.name} (ID: ${savedRecipe.id})`)
    }

    saveRecipes(recipes, businessId)

    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: {
          businessId: businessId || "main",
          action: existingIndex >= 0 ? "update" : "create",
          recipeId: savedRecipe.id,
          recipeName: savedRecipe.name,
        },
      }),
    )

    return savedRecipe
  } catch (error) {
    console.error("[Recipes] ❌ Error saving recipe:", error)
    throw error
  }
}

/**
 * Update an existing recipe
 */
export function updateRecipe(recipeId: string, updates: Partial<Recipe>, businessId?: string | null): Recipe | null {
  try {
    const recipes = getRecipes(businessId)
    const index = recipes.findIndex((r) => r.id === recipeId)

    if (index === -1) {
      console.error(`[Recipes] Cannot update - recipe not found: ${recipeId}`)
      throw new Error("Receta no encontrada")
    }

    const updatedRecipe: Recipe = {
      ...recipes[index],
      ...updates,
      id: recipeId, // Ensure ID doesn't change
      businessId: businessId || "main", // Ensure businessId doesn't change
      metadata: {
        ...recipes[index].metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        version: (recipes[index].metadata?.version || 1) + 1,
      },
    }

    const validation = validateRecipeData(updatedRecipe)
    if (!validation.valid) {
      throw new Error(`Validación falló: ${validation.errors.join(", ")}`)
    }

    const sanitizedRecipe = sanitizeRecipeData(updatedRecipe)
    recipes[index] = sanitizedRecipe
    saveRecipes(recipes, businessId)

    console.log(`[Recipes] ✅ Updated recipe: ${sanitizedRecipe.name} (${sanitizedRecipe.id})`)

    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: {
          businessId: businessId || "main",
          action: "update",
          recipeId: sanitizedRecipe.id,
          recipeName: sanitizedRecipe.name,
        },
      }),
    )

    return sanitizedRecipe
  } catch (error) {
    console.error("[Recipes] ❌ Error updating recipe:", error)
    throw error
  }
}

/**
 * Papelera de recetas — ver documento de continuidad. En vez de borrar
 * permanentemente, la receta se mueve a una papelera con ventana de 30 días
 * (decisión ya confirmada por el dueño del proyecto), desde donde se puede
 * restaurar o esperar a que se purgue automáticamente.
 */
export interface TrashedRecipe {
  recipe: Recipe
  deletedAt: string // ISO date
}

const TRASH_RETENTION_DAYS = 30

function getTrash(businessId?: string | null): TrashedRecipe[] {
  return getFromStorage<TrashedRecipe[]>(STORAGE_KEYS.RECIPES_TRASH, businessId) || []
}

function saveTrash(trash: TrashedRecipe[], businessId?: string | null): void {
  saveToStorage(STORAGE_KEYS.RECIPES_TRASH, trash, businessId)
}

/**
 * Mueve una receta a la papelera en vez de borrarla permanentemente.
 * Reemplaza el comportamiento anterior de deleteRecipe (borrado inmediato).
 */
export function moveRecipeToTrash(recipeId: string, businessId?: string | null): boolean {
  try {
    const recipes = getRecipes(businessId)
    const recipeToDelete = recipes.find((r) => r.id === recipeId)

    if (!recipeToDelete) {
      console.warn(`[Recipes] Cannot delete - recipe not found: ${recipeId}`)
      return false
    }

    const filtered = recipes.filter((r) => r.id !== recipeId)
    saveRecipes(filtered, businessId)

    const trash = getTrash(businessId)
    trash.push({ recipe: recipeToDelete, deletedAt: new Date().toISOString() })
    saveTrash(trash, businessId)

    console.log(`[Recipes] Moved to trash: ${recipeId}`)

    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: {
          businessId: businessId || "main",
          action: "delete",
          recipeId,
          recipeName: recipeToDelete?.name || "Unknown",
        },
      }),
    )
    window.dispatchEvent(new CustomEvent("recipesTrashUpdated", { detail: { businessId: businessId || "main" } }))

    return true
  } catch (error) {
    console.error("[Recipes] ❌ Error moving recipe to trash:", error)
    throw new Error("No se pudo eliminar la receta")
  }
}

/** Lista las recetas en papelera, purgando primero las que ya pasaron los 30 días. */
export function getTrashedRecipes(businessId?: string | null): TrashedRecipe[] {
  const trash = purgeExpiredTrash(businessId)
  return trash.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}

/** Elimina de la papelera (sin posibilidad de recuperar) todo lo que ya pasó los 30 días. */
export function purgeExpiredTrash(businessId?: string | null): TrashedRecipe[] {
  const trash = getTrash(businessId)
  const now = Date.now()
  const stillValid = trash.filter((t) => {
    const ageMs = now - new Date(t.deletedAt).getTime()
    return ageMs < TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  })

  if (stillValid.length !== trash.length) {
    saveTrash(stillValid, businessId)
  }

  return stillValid
}

/** Cuántos días le quedan a una receta en papelera antes de purgarse automáticamente. */
export function getTrashDaysRemaining(deletedAt: string): number {
  const ageMs = Date.now() - new Date(deletedAt).getTime()
  const remainingMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 - ageMs
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

/** Restaura una receta de la papelera de vuelta a Mis Recetas. */
export function restoreRecipeFromTrash(recipeId: string, businessId?: string | null): boolean {
  try {
    const trash = getTrash(businessId)
    const entry = trash.find((t) => t.recipe.id === recipeId)
    if (!entry) {
      console.warn(`[Recipes] Cannot restore - not found in trash: ${recipeId}`)
      return false
    }

    const remainingTrash = trash.filter((t) => t.recipe.id !== recipeId)
    saveTrash(remainingTrash, businessId)

    const recipes = getRecipes(businessId)
    recipes.push(entry.recipe)
    saveRecipes(recipes, businessId)

    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: { businessId: businessId || "main", action: "restore", recipeId, recipeName: entry.recipe.name },
      }),
    )
    window.dispatchEvent(new CustomEvent("recipesTrashUpdated", { detail: { businessId: businessId || "main" } }))

    return true
  } catch (error) {
    console.error("[Recipes] ❌ Error restoring recipe from trash:", error)
    throw new Error("No se pudo restaurar la receta")
  }
}

/** Borra una receta de la papelera permanentemente, sin esperar los 30 días. */
export function permanentlyDeleteRecipe(recipeId: string, businessId?: string | null): boolean {
  const trash = getTrash(businessId)
  const remaining = trash.filter((t) => t.recipe.id !== recipeId)
  if (remaining.length === trash.length) return false
  saveTrash(remaining, businessId)
  window.dispatchEvent(new CustomEvent("recipesTrashUpdated", { detail: { businessId: businessId || "main" } }))
  return true
}

/**
 * @deprecated Usar moveRecipeToTrash — se mantiene como alias para no romper
 * a quien ya importaba deleteRecipe, pero ahora mueve a papelera en vez de
 * borrar permanentemente (ver documento de continuidad).
 */
export function deleteRecipe(recipeId: string, businessId?: string | null): boolean {
  return moveRecipeToTrash(recipeId, businessId)
}

/**
 * Get all sub-recipes
 */
export function getSubRecipes(businessId?: string | null): Recipe[] {
  const recipes = getRecipes(businessId)
  return recipes.filter((r) => r.classification === SUBRECIPE_CLASSIFICATION || r.isSubRecipe)
}

/**
 * Check if a recipe is a sub-recipe
 */
export function isSubRecipe(recipe: Recipe): boolean {
  return recipe.classification === "Sub Receta / produccion (Mise en place)" || recipe.isSubRecipe === true
}
