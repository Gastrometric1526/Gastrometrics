/**
 * SUB-RECIPE AND RECIPE MIGRATION LOGIC
 * Handles complete migration of recipes and their dependencies between businesses
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { getRecipes, saveRecipes, isSubRecipe, ensureRecipesLoaded } from "../storage/recipes"
import { getIngredients, saveIngredients, ensureIngredientsLoaded } from "../storage/ingredients"
import { syncSubRecipeToIngredient } from "./core"

interface MigrationResult {
  success: boolean
  error?: string
  migratedRecipe?: Recipe
  migratedIngredients: Ingredient[]
  migratedSubRecipes: Recipe[]
  skippedIngredients: string[]
}

/**
 * Find similar ingredient in target database
 * Compares name, category, content, price, and supplier
 */
function findSimilarIngredient(ingredient: Ingredient, targetIngredients: Ingredient[]): Ingredient | undefined {
  return targetIngredients.find((target) => {
    const nameMatch = target.name.toLowerCase().trim() === ingredient.name.toLowerCase().trim()
    const categoryMatch = target.category === ingredient.category
    const contentMatch = Math.abs((target.pricing?.netContent || 0) - (ingredient.pricing?.netContent || 0)) < 0.01
    const priceMatch = Math.abs((target.pricing?.purchasePrice || 0) - (ingredient.pricing?.purchasePrice || 0)) < 0.01
    const supplierMatch = !ingredient.supplier || !target.supplier || target.supplier === ingredient.supplier

    return nameMatch && categoryMatch && contentMatch && priceMatch && supplierMatch
  })
}

/**
 * Migra recursivamente la receta de una sub-receta (y las sub-recetas que ella misma use) al
 * negocio destino, y devuelve el id que la sub-receta migrada tiene en el destino. `visited`
 * evita loops si dos sub-recetas terminaran referenciándose entre sí por error de datos.
 */
async function migrateSubRecipeChain(
  sourceRecipeId: string,
  sourceBusinessId: string,
  targetBusinessId: string,
  migratedSubRecipes: Recipe[],
  visited: Set<string>,
): Promise<string | null> {
  if (visited.has(sourceRecipeId)) return null
  visited.add(sourceRecipeId)

  const sourceSubRecipe = getRecipes(sourceBusinessId).find((r) => r.id === sourceRecipeId)
  if (!sourceSubRecipe) return null

  // Si el negocio destino ya tiene una sub-receta con el mismo nombre, se reutiliza en vez de duplicar.
  const existingInTarget = getRecipes(targetBusinessId).find(
    (r) => r.name.toLowerCase().trim() === sourceSubRecipe.name.toLowerCase().trim() && isSubRecipe(r),
  )
  if (existingInTarget) return existingInTarget.id

  const result = await migrateCompleteRecipe(sourceSubRecipe, sourceBusinessId, targetBusinessId, {
    migratedSubRecipes,
    visited,
  })

  if (result.success && result.migratedRecipe) {
    migratedSubRecipes.push(result.migratedRecipe)
    return result.migratedRecipe.id
  }
  return null
}

/**
 * Migración "solo la receta" (docs/137): no copia ingredientes ni sub-recetas. Cada línea
 * se vincula al ingrediente del negocio destino que tenga el MISMO nombre (con el precio de
 * ese negocio); las que no tengan equivalente quedan sin vincular (conservan nombre, cantidad
 * y unidad) para que el usuario elija el ingrediente desde la base de ese negocio en la Ficha
 * Técnica, que se abre justo después.
 */
function migrateRecipeOnly(recipe: Recipe, sourceBusinessId: string, targetBusinessId: string): MigrationResult {
  const byName = new Map(
    (getIngredients(targetBusinessId) || []).map((ing) => [ing.name.toLowerCase().trim(), ing] as const),
  )
  const skippedIngredients: string[] = []
  const ingredients = recipe.ingredients.map((line) => {
    if (!line.ingredientId && !line.name) return line
    const match = line.name ? byName.get(line.name.toLowerCase().trim()) : undefined
    if (match) {
      const unitCost = match.pricing?.pricePerUnit || 0
      return {
        ...line,
        ingredientId: match.id,
        category: match.category,
        unit: match.unit,
        unitCost,
        costPerMeasure: unitCost,
        extension: (line.quantity || 0) * unitCost,
      }
    }
    skippedIngredients.push(line.name)
    return { ...line, ingredientId: null, unitCost: 0, costPerMeasure: 0, extension: 0 }
  })
  const totalCost = ingredients.reduce((sum, line) => sum + (line.extension || 0), 0)
  const yieldAmount = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1
  const now = new Date().toISOString()
  const migratedRecipe: Recipe = {
    ...recipe,
    id: `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    businessId: targetBusinessId,
    ingredients,
    totalCost,
    costPerServing: totalCost / yieldAmount,
    originalSnapshot: undefined,
    metadata: { ...recipe.metadata, migratedFrom: sourceBusinessId, migratedAt: now, updatedAt: now, version: 1 },
  }
  void saveRecipes([...getRecipes(targetBusinessId), migratedRecipe], targetBusinessId)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("recipesUpdated", {
        detail: { businessId: targetBusinessId, action: "migrated", recipeId: migratedRecipe.id },
      }),
    )
  }
  return { success: true, migratedRecipe, migratedIngredients: [], migratedSubRecipes: [], skippedIngredients }
}

/**
 * Migrate ingredients that don't exist in target database. Si un ingrediente viene de una
 * sub-receta (ingredient.recipeId), también se migra esa receta al destino (recursivo), para
 * que quede editable como Ficha Técnica ahí, no solo como un costo plano.
 */
async function migrateIngredients(
  recipe: Recipe,
  sourceBusinessId: string,
  targetBusinessId: string,
  migratedSubRecipes: Recipe[],
  visited: Set<string>,
): Promise<{ migratedIngredients: Ingredient[]; skippedIngredients: string[] }> {
  const sourceIngredients = getIngredients(sourceBusinessId) || []
  // Copia local: getIngredients() devuelve el MISMO arreglo de la caché. Antes se le hacía
  // push directo y después se volvía a sumar al guardar → filas duplicadas en un solo upsert,
  // que Supabase rechazaba entero (21000) — los ingredientes migrados nunca se guardaban
  // (docs/137).
  const targetIngredients = [...(getIngredients(targetBusinessId) || [])]

  const recipeIngredientIds = recipe.ingredients.map((ing) => ing.ingredientId).filter((id): id is string => !!id)
  const ingredientsToCheck = sourceIngredients.filter((ing) => recipeIngredientIds.includes(ing.id))

  const migratedIngredients: Ingredient[] = []
  const skippedIngredients: string[] = []

  for (const ingredient of ingredientsToCheck) {
    const existingSimilar = findSimilarIngredient(ingredient, targetIngredients)

    if (!existingSimilar) {
      let migratedRecipeId: string | undefined
      let recipeData = ingredient.recipeData

      // Ingrediente generado desde una sub-receta: migrar también la receta original.
      if (ingredient.recipeId) {
        const newSubRecipeId = await migrateSubRecipeChain(
          ingredient.recipeId,
          sourceBusinessId,
          targetBusinessId,
          migratedSubRecipes,
          visited,
        )
        if (newSubRecipeId) {
          migratedRecipeId = newSubRecipeId
          recipeData = recipeData ? { ...recipeData, originalRecipeId: newSubRecipeId } : recipeData
        }
      }

      const migratedIngredient: Ingredient = {
        ...ingredient,
        id: `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        businessId: targetBusinessId,
        recipeId: migratedRecipeId ?? ingredient.recipeId,
        recipeData,
        metadata: {
          ...ingredient.metadata,
          migratedFrom: sourceBusinessId,
          migratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        notes: ingredient.notes
          ? `${ingredient.notes}\n\n🔄 Migrado desde ${sourceBusinessId} el ${new Date().toLocaleDateString()}`
          : `🔄 Migrado desde ${sourceBusinessId} el ${new Date().toLocaleDateString()}`,
      }

      migratedIngredients.push(migratedIngredient)
      targetIngredients.push(migratedIngredient)
    } else {
      skippedIngredients.push(ingredient.name)
    }
  }

  if (migratedIngredients.length > 0) {
    // Releer por si migrateSubRecipeChain ya guardó ingredientes propios (p.ej. de una sub-receta anidada).
    const byId = new Map(getIngredients(targetBusinessId).map((ing) => [ing.id, ing] as const))
    for (const ing of migratedIngredients) byId.set(ing.id, ing)
    await saveIngredients([...byId.values()], targetBusinessId)

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: {
            businessId: targetBusinessId,
            action: "migrated",
            count: migratedIngredients.length,
          },
        }),
      )
    }
  }

  return { migratedIngredients, skippedIngredients }
}

/**
 * Migrate complete recipe with all dependencies: ingredientes y, si la receta usa sub-recetas
 * (u otra sub-receta usa sub-recetas, en cadena), esas también se migran completas — no solo
 * como costo plano, sino como su propia Ficha Técnica editable en el negocio destino.
 */
export async function migrateCompleteRecipe(
  recipe: Recipe,
  sourceBusinessId: string,
  targetBusinessId: string,
  internal?: { migratedSubRecipes: Recipe[]; visited: Set<string> },
  options: { includeIngredients?: boolean } = {},
): Promise<MigrationResult> {
  const migratedSubRecipes = internal?.migratedSubRecipes ?? []
  const visited = internal?.visited ?? new Set<string>()
  const includeIngredients = options.includeIngredients !== false

  try {
    // BUG CORREGIDO (docs/137): si los datos del negocio destino no estaban cargados en la
    // caché (nunca se había abierto en esta sesión), getIngredients() devolvía [] y cada
    // ingrediente que YA existía allá se volvía a crear duplicado. Se cargan antes los dos.
    if (!internal) {
      await Promise.all([
        ensureIngredientsLoaded(sourceBusinessId),
        ensureRecipesLoaded(sourceBusinessId),
        ensureIngredientsLoaded(targetBusinessId),
        ensureRecipesLoaded(targetBusinessId),
      ])
    }

    if (!includeIngredients) return migrateRecipeOnly(recipe, sourceBusinessId, targetBusinessId)

    const { migratedIngredients, skippedIngredients } = await migrateIngredients(
      recipe,
      sourceBusinessId,
      targetBusinessId,
      migratedSubRecipes,
      visited,
    )

    const ingredientIdMap = new Map<string, string>()
    const sourceIngredientsAll = getIngredients(sourceBusinessId) || []
    const targetIngredients = getIngredients(targetBusinessId) || []

    for (const recipeIng of recipe.ingredients) {
      if (!recipeIng.ingredientId) continue

      const sourceIng = sourceIngredientsAll.find((si) => si.id === recipeIng.ingredientId)
      if (!sourceIng) continue

      const migratedIng = migratedIngredients.find(
        (mi) => mi.name.toLowerCase().trim() === sourceIng.name.toLowerCase().trim(),
      )

      if (migratedIng) {
        ingredientIdMap.set(recipeIng.ingredientId, migratedIng.id)
      } else {
        const existingSimilar = findSimilarIngredient(sourceIng, targetIngredients)
        if (existingSimilar) {
          ingredientIdMap.set(recipeIng.ingredientId, existingSimilar.id)
        }
      }
    }

    const migratedRecipe: Recipe = {
      ...recipe,
      id: `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      businessId: targetBusinessId,
      ingredients: recipe.ingredients.map((ing) => ({
        ...ing,
        ingredientId: ing.ingredientId ? ingredientIdMap.get(ing.ingredientId) || ing.ingredientId : null,
      })),
      metadata: {
        ...recipe.metadata,
        migratedFrom: sourceBusinessId,
        migratedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      notes: recipe.notes
        ? `${recipe.notes}\n\n🔄 Migrado desde ${sourceBusinessId} el ${new Date().toLocaleDateString()}`
        : `🔄 Migrado desde ${sourceBusinessId} el ${new Date().toLocaleDateString()}`,
    }

    await saveRecipes([...getRecipes(targetBusinessId), migratedRecipe], targetBusinessId)

    // Si la propia receta migrada es una sub-receta, sincronizar su ingrediente espejo en el
    // destino apuntando al nuevo id — para que quien la migró como parte de otra receta la
    // encuentre correctamente enlazada (ver migrateSubRecipeChain).
    if (isSubRecipe(migratedRecipe)) {
      syncSubRecipeToIngredient(migratedRecipe, targetBusinessId)
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: {
            businessId: targetBusinessId,
            action: "migrated",
            recipeId: migratedRecipe.id,
          },
        }),
      )
    }

    return {
      success: true,
      migratedRecipe,
      migratedIngredients,
      migratedSubRecipes,
      skippedIngredients,
    }
  } catch (error) {
    console.error("[Migration] Error during recipe migration:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido durante la migración",
      migratedIngredients: [],
      migratedSubRecipes,
      skippedIngredients: [],
    }
  }
}
