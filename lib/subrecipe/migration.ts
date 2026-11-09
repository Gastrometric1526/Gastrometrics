/**
 * SUB-RECIPE AND RECIPE MIGRATION LOGIC
 * Handles complete migration of recipes and their dependencies between businesses
 */

import { withBeverageSourceFromLine } from "@/lib/beverage"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { getRecipes, saveRecipes, isSubRecipe, ensureRecipesLoaded } from "../storage/recipes"
import { getIngredients, saveIngredients, ensureIngredientsLoaded } from "../storage/ingredients"
import { getAllBusinesses } from "../storage/businesses"
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
 * Costo de cada línea con el ingrediente del destino (docs/264): si la receta se unió a un
 * ingrediente que ya existía en el negocio, vale su precio, no el del espacio de origen.
 */
export function recostWithTarget(recipe: Recipe, targetIngredients: Ingredient[]): Recipe {
  const byId = new Map(targetIngredients.map((i) => [i.id, i] as const))
  const ingredients = recipe.ingredients.map((line) => {
    const ing = line.ingredientId ? byId.get(line.ingredientId) : undefined
    if (!ing) return line
    const unitCost = ing.pricing?.pricePerUnit || 0
    return { ...line, category: ing.category, unit: ing.unit, unitCost, costPerMeasure: unitCost, extension: (line.quantity || 0) * unitCost }
  })
  const totalCost = ingredients.reduce((sum, line) => sum + (line.extension || 0), 0)
  const yieldAmount = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1
  return { ...recipe, ingredients, totalCost, costPerServing: totalCost / yieldAmount }
}

/** Valor de `ingredientChoices` para copiar el ingrediente al destino (docs/264). */
export const COPY_INGREDIENT = "copy"

export interface MigrationIngredientRow {
  sourceId: string
  name: string
  supplier?: string
  /** Ingrediente igual que ya existe en el destino: se reutiliza sin preguntar. */
  exactId: string | null
  /** Ingredientes del destino con el mismo nombre (sugerencias para unir). */
  sameName: Ingredient[]
}

/**
 * Qué pasa con cada ingrediente de la receta al migrarla (docs/264): los que existen igual en
 * el destino se reutilizan; para los demás, la ventana pregunta si copiarlo o usar uno del
 * destino. Puro.
 */
export function planIngredientMigration(recipe: Recipe, sourceIngredients: Ingredient[], targetIngredients: Ingredient[]): MigrationIngredientRow[] {
  const seen = new Set<string>()
  const rows: MigrationIngredientRow[] = []
  for (const line of recipe.ingredients) {
    if (!line.ingredientId || seen.has(line.ingredientId)) continue
    seen.add(line.ingredientId)
    const source = sourceIngredients.find((i) => i.id === line.ingredientId)
    if (!source) continue
    const exact = findSimilarIngredient(source, targetIngredients)
    const key = source.name.toLowerCase().trim()
    rows.push({
      sourceId: source.id,
      name: source.name,
      supplier: source.supplier,
      exactId: exact?.id ?? null,
      sameName: exact ? [] : targetIngredients.filter((t) => t.name.toLowerCase().trim() === key),
    })
  }
  return rows
}

/**
 * Migra recursivamente la receta de una subreceta (y las subrecetas que ella misma use) al
 * negocio destino, y devuelve el id que la subreceta migrada tiene en el destino. `visited`
 * evita loops si dos subrecetas terminaran referenciándose entre sí por error de datos.
 */
async function migrateSubRecipeChain(
  sourceRecipeId: string,
  sourceBusinessId: string,
  targetBusinessId: string,
  migratedSubRecipes: Recipe[],
  visited: Set<string>,
  keepSynced = false,
): Promise<string | null> {
  if (visited.has(sourceRecipeId)) return null
  visited.add(sourceRecipeId)

  const sourceSubRecipe = getRecipes(sourceBusinessId).find((r) => r.id === sourceRecipeId)
  if (!sourceSubRecipe) return null

  // Si el negocio destino ya tiene una subreceta con el mismo nombre, se reutiliza en vez de duplicar.
  const existingInTarget = getRecipes(targetBusinessId).find(
    (r) => r.name.toLowerCase().trim() === sourceSubRecipe.name.toLowerCase().trim() && isSubRecipe(r),
  )
  if (existingInTarget) return existingInTarget.id

  const result = await migrateCompleteRecipe(sourceSubRecipe, sourceBusinessId, targetBusinessId, {
    migratedSubRecipes,
    visited,
    keepSynced,
  })

  if (result.success && result.migratedRecipe) {
    migratedSubRecipes.push(result.migratedRecipe)
    return result.migratedRecipe.id
  }
  return null
}

/**
 * Migración "solo la receta" (docs/137): no copia ingredientes ni subrecetas. Cada línea
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
  const migratedRecipe: Recipe = withBeverageSourceFromLine({
    ...recipe,
    id: `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    businessId: targetBusinessId,
    ingredients,
    totalCost,
    costPerServing: totalCost / yieldAmount,
    originalSnapshot: undefined,
    metadata: { ...recipe.metadata, migratedFrom: sourceBusinessId, migratedAt: now, updatedAt: now, version: 1 },
  })
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
 * subreceta (ingredient.recipeId), también se migra esa receta al destino (recursivo), para
 * que quede editable como Ficha Técnica ahí, no solo como un costo plano.
 */
async function migrateIngredients(
  recipe: Recipe,
  sourceBusinessId: string,
  targetBusinessId: string,
  migratedSubRecipes: Recipe[],
  visited: Set<string>,
  choices: Record<string, string> = {},
  keepSynced = false,
): Promise<{ migratedIngredients: Ingredient[]; skippedIngredients: string[]; idMap: Map<string, string> }> {
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
  // Origen → destino, por id (docs/263): dos ingredientes pueden llamarse igual con
  // proveedores distintos, así que nunca se une por nombre.
  const idMap = new Map<string, string>()

  for (const ingredient of ingredientsToCheck) {
    // La persona eligió unirlo a un ingrediente que ya existe en el destino (docs/264).
    const choice = choices[ingredient.id]
    if (choice && choice !== COPY_INGREDIENT && targetIngredients.some((t) => t.id === choice)) {
      skippedIngredients.push(ingredient.name)
      idMap.set(ingredient.id, choice)
      continue
    }
    const existingSimilar = findSimilarIngredient(ingredient, targetIngredients)

    if (!existingSimilar) {
      let migratedRecipeId: string | undefined
      let recipeData = ingredient.recipeData

      // Ingrediente generado desde una subreceta: migrar también la receta original.
      if (ingredient.recipeId) {
        const newSubRecipeId = await migrateSubRecipeChain(
          ingredient.recipeId,
          sourceBusinessId,
          targetBusinessId,
          migratedSubRecipes,
          visited,
          keepSynced,
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
      }

      migratedIngredients.push(migratedIngredient)
      targetIngredients.push(migratedIngredient)
      idMap.set(ingredient.id, migratedIngredient.id)
    } else {
      skippedIngredients.push(ingredient.name)
      idMap.set(ingredient.id, existingSimilar.id)
    }
  }

  if (migratedIngredients.length > 0) {
    // Releer por si migrateSubRecipeChain ya guardó ingredientes propios (p.ej. de una subreceta anidada).
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

  return { migratedIngredients, skippedIngredients, idMap }
}

/**
 * Migrate complete recipe with all dependencies: ingredientes y, si la receta usa subrecetas
 * (u otra subreceta usa subrecetas, en cadena), esas también se migran completas — no solo
 * como costo plano, sino como su propia Ficha Técnica editable en el negocio destino.
 */
export async function migrateCompleteRecipe(
  recipe: Recipe,
  sourceBusinessId: string,
  targetBusinessId: string,
  internal?: { migratedSubRecipes: Recipe[]; visited: Set<string>; keepSynced?: boolean },
  options: {
    includeIngredients?: boolean
    ingredientChoices?: Record<string, string>
    /** Mantener la copia igual a la original (docs/264). */
    keepSynced?: boolean
    /** Actualizar esta copia (sincronización) en vez de crear otra. */
    replaceRecipeId?: string
  } = {},
): Promise<MigrationResult> {
  const migratedSubRecipes = internal?.migratedSubRecipes ?? []
  const visited = internal?.visited ?? new Set<string>()
  const keepSynced = options.keepSynced ?? internal?.keepSynced ?? false
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

    const { migratedIngredients, skippedIngredients, idMap } = await migrateIngredients(
      recipe,
      sourceBusinessId,
      targetBusinessId,
      migratedSubRecipes,
      visited,
      options.ingredientChoices,
      keepSynced,
    )

    const ingredientIdMap = new Map<string, string>()
    const sourceIngredientsAll = getIngredients(sourceBusinessId) || []
    const targetIngredients = getIngredients(targetBusinessId) || []

    for (const recipeIng of recipe.ingredients) {
      if (!recipeIng.ingredientId) continue

      const sourceIng = sourceIngredientsAll.find((si) => si.id === recipeIng.ingredientId)
      if (!sourceIng) continue

      const mappedId = idMap.get(recipeIng.ingredientId)
      if (mappedId) {
        ingredientIdMap.set(recipeIng.ingredientId, mappedId)
      } else {
        const existingSimilar = findSimilarIngredient(sourceIng, targetIngredients)
        if (existingSimilar) {
          ingredientIdMap.set(recipeIng.ingredientId, existingSimilar.id)
        }
      }
    }

    const existingCopy = options.replaceRecipeId ? getRecipes(targetBusinessId).find((r) => r.id === options.replaceRecipeId) : undefined
    const migratedRecipe: Recipe = {
      ...recipe,
      id: existingCopy?.id ?? `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      businessId: targetBusinessId,
      ingredients: recipe.ingredients.map((ing) => ({
        ...ing,
        ingredientId: ing.ingredientId ? ingredientIdMap.get(ing.ingredientId) ?? null : null,
      })),
      metadata: {
        ...recipe.metadata,
        createdAt: existingCopy?.metadata?.createdAt ?? recipe.metadata?.createdAt,
        migratedFrom: sourceBusinessId,
        migratedAt: existingCopy?.metadata?.migratedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: existingCopy ? (existingCopy.metadata?.version || 1) + 1 : 1,
        syncedFrom: keepSynced
          ? { businessId: sourceBusinessId, recipeId: recipe.id, ingredientMap: Object.fromEntries(ingredientIdMap), syncedAt: new Date().toISOString() }
          : undefined,
      },
    }

    const costedRecipe = recostWithTarget(migratedRecipe, getIngredients(targetBusinessId) || [])
    // Bebida por medida/envase (docs/272): el producto es el de la línea ya unida al destino.
    Object.assign(migratedRecipe, withBeverageSourceFromLine(costedRecipe))
    const others = getRecipes(targetBusinessId).filter((r) => r.id !== migratedRecipe.id)
    await saveRecipes([...others, migratedRecipe], targetBusinessId)

    // Si la propia receta migrada es una subreceta, sincronizar su ingrediente espejo en el
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

/**
 * Al guardar una receta: actualiza sus copias sincronizadas en los demás espacios (docs/264).
 * Cada copia conserva su id y sus uniones de ingredientes; los ingredientes nuevos se copian o
 * se reutilizan si ya existen iguales, y el costo sale con los precios de ese negocio.
 * Devuelve cuántas copias se actualizaron. Nunca lanza.
 */
export async function syncMigratedCopies(source: Recipe, sourceBusinessId: string): Promise<number> {
  let updated = 0
  try {
    const spaces = ["main", ...getAllBusinesses().map((b) => b.id)].filter((id) => id !== sourceBusinessId)
    for (const space of spaces) {
      await ensureRecipesLoaded(space)
      const copies = getRecipes(space).filter(
        (r) => r.metadata?.syncedFrom?.recipeId === source.id && r.metadata.syncedFrom.businessId === sourceBusinessId,
      )
      for (const copy of copies) {
        const result = await migrateCompleteRecipe(source, sourceBusinessId, space, undefined, {
          ingredientChoices: copy.metadata.syncedFrom!.ingredientMap,
          keepSynced: true,
          replaceRecipeId: copy.id,
        })
        if (result.success) updated++
      }
    }
  } catch (error) {
    console.error("[Migration] No se pudieron actualizar las copias sincronizadas:", error)
  }
  return updated
}

/** Deja de sincronizar una copia: queda como receta independiente del negocio. */
export async function stopSyncingCopy(recipe: Recipe, businessId: string): Promise<Recipe> {
  const next: Recipe = { ...recipe, metadata: { ...recipe.metadata, syncedFrom: undefined, updatedAt: new Date().toISOString() } }
  await saveRecipes([...getRecipes(businessId).filter((r) => r.id !== recipe.id), next], businessId)
  return next
}
