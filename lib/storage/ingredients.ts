/**
 * INGREDIENT STORAGE MODULE — migrado a Supabase real (ver docs/52 y el comentario de
 * cabecera de lib/storage/businesses.ts para el patrón general: getIngredients()
 * sigue síncrona vía caché en memoria, useIngredients() es el hook reactivo nuevo para
 * usar en vez de useMemo(() => getIngredients(...)) dentro de componentes, y
 * saveIngredients()/addIngredient()/etc. ahora son async y escriben contra Supabase de
 * verdad — RLS ya filtra por dueño/negocio, ver supabase/migrations/0005_ids_as_text.sql.
 */

import type { Ingredient } from "@/types/ingredient"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"

type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"]

const cache = createBusinessScopedCache<Ingredient>()

function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    ...(row.data as Partial<Ingredient>),
    id: row.id,
    name: row.name,
    category: row.category as Ingredient["category"],
    businessId: row.business_id ?? undefined,
  } as Ingredient
}

function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

/**
 * Varias pantallas (dashboard, ingredientes, ficha-técnica) siguen escuchando este
 * evento en vez del hook reactivo nuevo (useIngredients) — se preserva para no
 * romperlas. Antes lo disparaba automáticamente saveToStorage() en lib/storage/core.ts;
 * ahora este módulo ya no pasa por ahí, así que lo dispara él mismo.
 */
function dispatchIngredientsUpdated(businessId?: string | null): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("ingredientsUpdated", { detail: { businessId: businessId || "main" } }))
}

async function fetchIngredients(businessId?: string | null): Promise<Ingredient[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("ingredients").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Ingredients] Error cargando ingredientes:", error)
    return []
  }
  return (data ?? []).map(rowToIngredient)
}

/** Hook reactivo — usar en vez de getIngredients(businessId) dentro de useMemo. */
export function useIngredients(businessId?: string | null): Ingredient[] {
  return cache.useCached(businessId, () => fetchIngredients(businessId))
}

/**
 * Get all ingredients for a business (síncrono — lee la caché en memoria; [] hasta que
 * la primera carga real resuelva, ver useIngredients()/ensureIngredientsLoaded()).
 */
export function getIngredients(businessId?: string | null): Ingredient[] {
  return cache.getSnapshot(businessId)
}

/** Dispara (o espera) la carga real desde Supabase para este negocio. */
export function ensureIngredientsLoaded(businessId?: string | null): Promise<void> {
  return cache.ensureLoaded(businessId, () => fetchIngredients(businessId))
}

async function persistIngredient(ingredient: Ingredient, businessId?: string | null): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión.")

  const { id, name, category, businessId: _bid, ...rest } = ingredient
  const { error } = await supabase.from("ingredients").upsert({
    id,
    business_id: toDbBusinessId(businessId),
    owner_id: user.id,
    name,
    category,
    data: rest,
  })
  if (error) throw error
}

/**
 * Save ingredients for a business — recibe el array completo (patrón ya usado en toda
 * la app: leer, mutar en JS, guardar de vuelta) y lo sincroniza contra Supabase:
 * upsert de lo que sigue existiendo, delete de lo que ya no está en el array nuevo.
 * Actualiza la caché local al instante (optimista) antes de esperar la red.
 */
export async function saveIngredients(ingredients: Ingredient[], businessId?: string | null): Promise<void> {
  const previous = cache.getSnapshot(businessId)
  const nextIds = new Set(ingredients.map((i) => i.id))
  const removedIds = previous.filter((i) => !nextIds.has(i.id)).map((i) => i.id)

  cache.setSnapshot(businessId, ingredients)
  dispatchIngredientsUpdated(businessId)

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[Ingredients] No hay sesión — no se pudo guardar en Supabase.")
    return
  }

  const dbBusinessId = toDbBusinessId(businessId)
  const rows = ingredients.map((ingredient) => {
    const { id, name, category, businessId: _bid, ...rest } = ingredient
    return { id, business_id: dbBusinessId, owner_id: user.id, name, category, data: rest }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from("ingredients").upsert(rows)
    if (error) console.error("[Ingredients] Error guardando ingredientes:", error)
  }
  if (removedIds.length > 0) {
    const { error } = await supabase.from("ingredients").delete().in("id", removedIds)
    if (error) console.error("[Ingredients] Error eliminando ingredientes:", error)
  }
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
export async function addIngredient(ingredient: Ingredient, businessId?: string | null): Promise<Ingredient> {
  const newIngredient: Ingredient = {
    ...ingredient,
    businessId: businessId || "main",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  }

  cache.mutateSnapshot(businessId, (list) => [...list, newIngredient])
  dispatchIngredientsUpdated(businessId)
  await persistIngredient(newIngredient, businessId)
  return newIngredient
}

/**
 * Update an existing ingredient in BASE DE DATOS
 */
export async function updateIngredient(
  ingredientId: string,
  updates: Partial<Ingredient>,
  businessId?: string | null,
): Promise<Ingredient | null> {
  const current = getIngredientById(ingredientId, businessId)
  if (!current) {
    console.error(`[Ingredients] Cannot update - ingredient not found: ${ingredientId}`)
    return null
  }

  const updatedIngredient: Ingredient = {
    ...current,
    ...updates,
    metadata: {
      ...current.metadata,
      updatedAt: new Date().toISOString(),
      version: (current.metadata?.version || 1) + 1,
    },
  }

  cache.mutateSnapshot(businessId, (list) => list.map((i) => (i.id === ingredientId ? updatedIngredient : i)))
  dispatchIngredientsUpdated(businessId)
  await persistIngredient(updatedIngredient, businessId)
  return updatedIngredient
}

/**
 * Delete an ingredient from BASE DE DATOS
 */
export async function deleteIngredient(ingredientId: string, businessId?: string | null): Promise<boolean> {
  const current = getIngredientById(ingredientId, businessId)
  if (!current) {
    console.warn(`[Ingredients] Cannot delete - ingredient not found: ${ingredientId}`)
    return false
  }

  cache.mutateSnapshot(businessId, (list) => list.filter((i) => i.id !== ingredientId))
  dispatchIngredientsUpdated(businessId)

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("ingredients").delete().eq("id", ingredientId)
  if (error) {
    console.error("[Ingredients] Error eliminando ingrediente:", error)
    return false
  }
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
  return ingredients.filter((i) => i.category === "Sub Receta / produccion (Mise en place)" || i.recipeId)
}

/**
 * Upsert ingredient (add or update)
 */
export async function upsertIngredient(ingredient: Ingredient, businessId?: string | null): Promise<Ingredient> {
  const existing = getIngredientById(ingredient.id, businessId)

  const savedIngredient: Ingredient = {
    ...ingredient,
    businessId: businessId || "main",
    metadata: {
      createdAt: ingredient.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (ingredient.metadata?.version || 0) + 1,
    },
  }

  cache.mutateSnapshot(businessId, (list) =>
    existing ? list.map((i) => (i.id === ingredient.id ? savedIngredient : i)) : [...list, savedIngredient],
  )
  dispatchIngredientsUpdated(businessId)
  await persistIngredient(savedIngredient, businessId)
  return savedIngredient
}
