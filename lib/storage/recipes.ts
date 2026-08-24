/**
 * RECIPE STORAGE MODULE — migrado a Supabase real (ver docs/52 y el comentario de
 * cabecera de lib/storage/businesses.ts para el patrón general). Toda la lógica de
 * validación/sanitización/papelera se mantiene idéntica a como estaba en localStorage
 * — lo único que cambia es a dónde se persiste al final de cada función.
 */

import type { Recipe } from "@/types/recipe"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"

type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"]
type RecipeTrashRow = Database["public"]["Tables"]["recipes_trash"]["Row"]

const cache = createBusinessScopedCache<Recipe>()
const trashCache = createBusinessScopedCache<TrashedRecipe>()

function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    ...(row.data as Partial<Recipe>),
    id: row.id,
    name: row.name,
    classification: row.classification,
    isSubRecipe: row.is_sub_recipe,
    businessId: row.business_id ?? "main",
  } as Recipe
}

async function fetchRecipes(businessId?: string | null): Promise<Recipe[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("recipes").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Recipes] Error cargando recetas:", error)
    return []
  }
  return (data ?? []).map(rowToRecipe)
}

async function persistRecipe(recipe: Recipe, businessId?: string | null): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión.")

  const { id, name, classification, isSubRecipe, businessId: _bid, ...rest } = recipe
  const { error } = await supabase.from("recipes").upsert({
    id,
    business_id: toDbBusinessId(businessId),
    owner_id: user.id,
    name,
    classification,
    is_sub_recipe: !!isSubRecipe,
    data: rest,
  })
  if (error) throw error
}

/** Hook reactivo — usar en vez de getRecipes(businessId) dentro de useMemo. */
export function useRecipes(businessId?: string | null): Recipe[] {
  return cache.useCached(businessId, () => fetchRecipes(businessId))
}

/** Dispara (o espera) la carga real desde Supabase para este negocio. */
export function ensureRecipesLoaded(businessId?: string | null): Promise<void> {
  return cache.ensureLoaded(businessId, () => fetchRecipes(businessId))
}

/**
 * Validate recipe data before saving
 */
export function validateRecipeData(recipe: Recipe): { valid: boolean; errors: string[] } {
  const errors: string[] = []

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

  if (recipe.servings <= 0) {
    errors.push("Las porciones deben ser mayor a 0")
  }

  if (recipe.yieldAmount <= 0) {
    errors.push("El rendimiento debe ser mayor a 0")
  }

  if (!Array.isArray(recipe.ingredients)) {
    errors.push("Los ingredientes deben ser un array")
  } else if (recipe.ingredients.length === 0) {
    errors.push("Debe haber al menos un ingrediente")
  }

  if (!Array.isArray(recipe.procedure)) {
    errors.push("El procedimiento debe ser un array")
  }

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
 * Get all recipes for a business (síncrono — lee la caché en memoria).
 */
export function getRecipes(businessId?: string | null): Recipe[] {
  return cache.getSnapshot(businessId)
}

/**
 * Save recipes for a business — recibe el array completo y lo sincroniza contra
 * Supabase: upsert de lo que sigue existiendo, delete de lo que ya no está.
 */
export async function saveRecipes(recipes: Recipe[], businessId?: string | null): Promise<void> {
  try {
    const previous = cache.getSnapshot(businessId)
    const nextIds = new Set(recipes.map((r) => r.id))
    const removedIds = previous.filter((r) => !nextIds.has(r.id)).map((r) => r.id)

    cache.setSnapshot(businessId, recipes)

    const supabase = getSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      console.error("[Recipes] No hay sesión — no se pudo guardar en Supabase.")
      return
    }

    const dbBusinessId = toDbBusinessId(businessId)
    const rows = recipes.map((recipe) => {
      const { id, name, classification, isSubRecipe, businessId: _bid, ...rest } = recipe
      return { id, business_id: dbBusinessId, owner_id: user.id, name, classification, is_sub_recipe: !!isSubRecipe, data: rest }
    })

    if (rows.length > 0) {
      const { error } = await supabase.from("recipes").upsert(rows)
      if (error) throw error
    }
    if (removedIds.length > 0) {
      const { error } = await supabase.from("recipes").delete().in("id", removedIds)
      if (error) throw error
    }
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
export async function saveRecipe(recipe: Recipe, businessId?: string | null): Promise<Recipe> {
  try {
    const validation = validateRecipeData(recipe)
    if (!validation.valid) {
      const errorMessage = `Validación falló: ${validation.errors.join(", ")}`
      console.error("[Recipes]", errorMessage)
      throw new Error(errorMessage)
    }

    const sanitizedRecipe = sanitizeRecipeData(recipe)
    const existing = getRecipeById(sanitizedRecipe.id, businessId)

    const savedRecipe: Recipe = {
      ...sanitizedRecipe,
      businessId: businessId || "main",
      metadata: {
        createdAt: sanitizedRecipe.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: existing ? (sanitizedRecipe.metadata?.version || 0) + 1 : 1,
      },
    }

    cache.mutateSnapshot(businessId, (list) =>
      existing ? list.map((r) => (r.id === savedRecipe.id ? savedRecipe : r)) : [...list, savedRecipe],
    )
    await persistRecipe(savedRecipe, businessId)

    console.log(`[Recipes] ✅ ${existing ? "Updated" : "Added"} recipe: ${savedRecipe.name} (ID: ${savedRecipe.id})`)

    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: {
          businessId: businessId || "main",
          action: existing ? "update" : "create",
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
export async function updateRecipe(
  recipeId: string,
  updates: Partial<Recipe>,
  businessId?: string | null,
): Promise<Recipe | null> {
  try {
    const current = getRecipeById(recipeId, businessId)

    if (!current) {
      console.error(`[Recipes] Cannot update - recipe not found: ${recipeId}`)
      throw new Error("Receta no encontrada")
    }

    const updatedRecipe: Recipe = {
      ...current,
      ...updates,
      id: recipeId,
      businessId: businessId || "main",
      metadata: {
        ...current.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        version: (current.metadata?.version || 1) + 1,
      },
    }

    const validation = validateRecipeData(updatedRecipe)
    if (!validation.valid) {
      throw new Error(`Validación falló: ${validation.errors.join(", ")}`)
    }

    const sanitizedRecipe = sanitizeRecipeData(updatedRecipe)
    cache.mutateSnapshot(businessId, (list) => list.map((r) => (r.id === recipeId ? sanitizedRecipe : r)))
    await persistRecipe(sanitizedRecipe, businessId)

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

function rowToTrashedRecipe(row: RecipeTrashRow): TrashedRecipe {
  return { recipe: row.data as unknown as Recipe, deletedAt: row.deleted_at }
}

async function fetchTrash(businessId?: string | null): Promise<TrashedRecipe[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("recipes_trash").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Recipes] Error cargando papelera:", error)
    return []
  }
  return (data ?? []).map(rowToTrashedRecipe)
}

function getTrash(businessId?: string | null): TrashedRecipe[] {
  return trashCache.getSnapshot(businessId)
}

async function persistTrashEntry(entry: TrashedRecipe, businessId?: string | null): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión.")

  const { error } = await supabase.from("recipes_trash").upsert({
    id: entry.recipe.id,
    recipe_id: entry.recipe.id,
    business_id: toDbBusinessId(businessId),
    owner_id: user.id,
    deleted_at: entry.deletedAt,
    data: entry.recipe as unknown as Record<string, unknown>,
  })
  if (error) throw error
}

/**
 * Mueve una receta a la papelera en vez de borrarla permanentemente.
 * Reemplaza el comportamiento anterior de deleteRecipe (borrado inmediato).
 */
export async function moveRecipeToTrash(recipeId: string, businessId?: string | null): Promise<boolean> {
  try {
    const recipes = getRecipes(businessId)
    const recipeToDelete = recipes.find((r) => r.id === recipeId)

    if (!recipeToDelete) {
      console.warn(`[Recipes] Cannot delete - recipe not found: ${recipeId}`)
      return false
    }

    cache.mutateSnapshot(businessId, (list) => list.filter((r) => r.id !== recipeId))
    const supabase = getSupabaseBrowserClient()
    await supabase.from("recipes").delete().eq("id", recipeId)

    const entry: TrashedRecipe = { recipe: recipeToDelete, deletedAt: new Date().toISOString() }
    trashCache.mutateSnapshot(businessId, (list) => [...list, entry])
    await persistTrashEntry(entry, businessId)

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

/** Dispara (o espera) la carga real de la papelera desde Supabase. */
export function ensureTrashLoaded(businessId?: string | null): Promise<void> {
  return trashCache.ensureLoaded(businessId, () => fetchTrash(businessId))
}

/** Hook reactivo para la papelera. */
export function useTrashedRecipes(businessId?: string | null): TrashedRecipe[] {
  const trash = trashCache.useCached(businessId, () => fetchTrash(businessId))
  const now = Date.now()
  return [...trash]
    .filter((t) => now - new Date(t.deletedAt).getTime() < TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}

/** Lista las recetas en papelera (síncrono, desde la caché ya cargada). */
export function getTrashedRecipes(businessId?: string | null): TrashedRecipe[] {
  const trash = getTrash(businessId)
  const now = Date.now()
  return trash
    .filter((t) => now - new Date(t.deletedAt).getTime() < TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}

/** Cuántos días le quedan a una receta en papelera antes de purgarse automáticamente. */
export function getTrashDaysRemaining(deletedAt: string): number {
  const ageMs = Date.now() - new Date(deletedAt).getTime()
  const remainingMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 - ageMs
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

/** Restaura una receta de la papelera de vuelta a Mis Recetas. */
export async function restoreRecipeFromTrash(recipeId: string, businessId?: string | null): Promise<boolean> {
  try {
    const trash = getTrash(businessId)
    const entry = trash.find((t) => t.recipe.id === recipeId)
    if (!entry) {
      console.warn(`[Recipes] Cannot restore - not found in trash: ${recipeId}`)
      return false
    }

    trashCache.mutateSnapshot(businessId, (list) => list.filter((t) => t.recipe.id !== recipeId))
    const supabase = getSupabaseBrowserClient()
    await supabase.from("recipes_trash").delete().eq("id", recipeId)

    cache.mutateSnapshot(businessId, (list) => [...list, entry.recipe])
    await persistRecipe(entry.recipe, businessId)

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
export async function permanentlyDeleteRecipe(recipeId: string, businessId?: string | null): Promise<boolean> {
  const trash = getTrash(businessId)
  const exists = trash.some((t) => t.recipe.id === recipeId)
  if (!exists) return false

  trashCache.mutateSnapshot(businessId, (list) => list.filter((t) => t.recipe.id !== recipeId))
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("recipes_trash").delete().eq("id", recipeId)
  if (error) {
    console.error("[Recipes] Error borrando de la papelera:", error)
    return false
  }
  window.dispatchEvent(new CustomEvent("recipesTrashUpdated", { detail: { businessId: businessId || "main" } }))
  return true
}

/**
 * @deprecated Usar moveRecipeToTrash — se mantiene como alias para no romper
 * a quien ya importaba deleteRecipe, pero ahora mueve a papelera en vez de
 * borrar permanentemente (ver documento de continuidad).
 */
export async function deleteRecipe(recipeId: string, businessId?: string | null): Promise<boolean> {
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
