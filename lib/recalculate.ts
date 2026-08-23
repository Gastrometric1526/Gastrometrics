import { getRecipes, saveRecipes } from "./storage/recipes"
import { getIngredients, updateIngredient } from "./storage/ingredients"
import { syncSubRecipeToIngredient } from "./subrecipe/core"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./storage/core"

export interface RecalculationResult {
  ingredientId: string
  ingredientName: string
  oldPrice: number
  newPrice: number
  affectedRecipes: {
    recipeId: string
    recipeName: string
    oldCost: number
    newCost: number
    costDifference: number
    percentChange: number
  }[]
  affectedSubRecipes: {
    recipeId: string
    recipeName: string
    linkedIngredientId: string
    oldUnitCost: number
    newUnitCost: number
  }[]
  timestamp: string
}

export interface PriceChangeNotification {
  id: string
  businessId: string
  ingredientId: string
  ingredientName: string
  oldPrice: number
  newPrice: number
  affectedRecipesCount: number
  affectedRecipes: string[] // Recipe names
  timestamp: string
  read: boolean
}

/**
 * Update ingredient price and recalculate all affected recipes
 * This is the CORE FUNCTION for price changes
 */
export async function updateIngredientPriceAndRecalculate(
  businessId: string,
  ingredientId: string,
  newPrice: number,
): Promise<RecalculationResult> {
  console.log(`[Recalculate] Updating price for ingredient ${ingredientId} to ${newPrice}`)

  const ingredients = getIngredients(businessId)
  const recipes = getRecipes(businessId)

  const ingredient = ingredients.find((i) => i.id === ingredientId)
  if (!ingredient) {
    throw new Error(`Ingredient not found: ${ingredientId}`)
  }

  const oldPrice = ingredient.pricing?.purchasePrice || 0
  const netContent = ingredient.pricing?.netContent || 1

  // Update ingredient price
  // BUG CORREGIDO: pricePerUnit se guardaba igual a newPrice (el precio del paquete
  // completo), en vez de newPrice ÷ contenido neto — daba un costo por gramo/unidad
  // inflado en cualquier ingrediente cuyo contenido neto no fuera 1. Este cálculo es
  // el mismo que usa el resto de la app (ver app/ingredientes/page.tsx, netContent).
  updateIngredient(
    ingredientId,
    {
      pricing: {
        ...ingredient.pricing,
        purchasePrice: newPrice,
        pricePerUnit: newPrice / netContent,
        lastUpdated: new Date().toISOString(),
      },
    },
    businessId,
  )

  const result: RecalculationResult = {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    oldPrice,
    newPrice,
    affectedRecipes: [],
    affectedSubRecipes: [],
    timestamp: new Date().toISOString(),
  }

  // Find all recipes that use this ingredient
  const affectedRecipes = recipes.filter((recipe) =>
    recipe.ingredients?.some((item) => item.ingredientId === ingredientId),
  )

  console.log(`[Recalculate] Found ${affectedRecipes.length} recipes using this ingredient`)

  // Recalculate each affected recipe
  affectedRecipes.forEach((recipe) => {
    const oldCost = recipe.totalCost || 0

    // Recalculate recipe cost
    // BUG CORREGIDO: usaba purchasePrice (precio del paquete completo, ej. L150 por una
    // bolsa de 950g) multiplicado directo por la cantidad de la receta (en gramos) — el
    // costo real por unidad es pricePerUnit (purchasePrice ÷ contenido neto), que es lo
    // que usa el resto de la app (ver components/technical-sheet/index.tsx).
    let newCost = 0
    recipe.ingredients?.forEach((item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId)
      if (ing) {
        const pricePerUnit =
          ing.id === ingredientId ? newPrice / (ing.pricing?.netContent || 1) : ing.pricing?.pricePerUnit || 0
        newCost += item.quantity * pricePerUnit
      }
    })

    // Update recipe
    // BUG CORREGIDO: se guardaba en recipe.unitCost, un campo que no existe en Recipe
    // (types/recipe.ts) — el campo real que usa el resto de la app (Ficha Técnica,
    // PDFs, Estadísticas) es costPerServing. Mismo bug ya corregido antes en
    // lib/analytics/menuScenario.ts. Sin este fix, el food cost % de cada receta
    // afectada quedaba desactualizado en silencio tras cambiar el precio de un
    // ingrediente, hasta que el usuario reabriera y regrabara cada receta a mano.
    recipe.totalCost = newCost
    recipe.costPerServing = recipe.yieldAmount > 0 ? newCost / recipe.yieldAmount : newCost

    result.affectedRecipes.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      oldCost,
      newCost,
      costDifference: newCost - oldCost,
      percentChange: oldCost > 0 ? ((newCost - oldCost) / oldCost) * 100 : 0,
    })

    // If this recipe is a sub-recipe, update its linked ingredient
    if (recipe.classification === "SUB RECETA" || recipe.isSubRecipe) {
      console.log(`[Recalculate] Updating linked ingredient for sub-recipe: ${recipe.name}`)
      const linkedIngredient = syncSubRecipeToIngredient(recipe, businessId)

      if (linkedIngredient) {
        result.affectedSubRecipes.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          linkedIngredientId: linkedIngredient.id,
          oldUnitCost: oldCost / (recipe.yieldAmount || 1),
          newUnitCost: newCost / (recipe.yieldAmount || 1),
        })
      }
    }
  })

  // Save updated recipes
  saveRecipes(recipes, businessId)

  // Create notification
  const notification: PriceChangeNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    businessId,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    oldPrice,
    newPrice,
    affectedRecipesCount: result.affectedRecipes.length,
    affectedRecipes: result.affectedRecipes.map((r) => r.recipeName),
    timestamp: new Date().toISOString(),
    read: false,
  }

  // Save notification
  const notifications = getFromStorage<PriceChangeNotification[]>(STORAGE_KEYS.NOTIFICATIONS, businessId) || []
  notifications.push(notification)
  saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications, businessId)

  console.log(
    `[Recalculate] Updated ${result.affectedRecipes.length} recipes and ${result.affectedSubRecipes.length} sub-recipes`,
  )

  // Dispatch event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("priceRecalculated", {
        detail: result,
      }),
    )
  }

  return result
}

/**
 * Get unread notifications
 */
export function getUnreadNotifications(businessId: string): PriceChangeNotification[] {
  const notifications = getFromStorage<PriceChangeNotification[]>(STORAGE_KEYS.NOTIFICATIONS, businessId) || []
  return notifications.filter((n) => !n.read)
}

/**
 * Historial completo de cambios de precio (leídos o no) — a diferencia de
 * getUnreadNotifications, no filtra por `read`, porque aquí se usa como bitácora de
 * precios en el tiempo, no como bandeja de notificaciones pendientes. Cada entrada ya
 * viene con ingredientId estable, precio anterior/nuevo, y timestamp — no hace falta
 * una tabla nueva de historial (ver docs/35).
 */
export function getPriceChangeHistory(businessId: string, ingredientId?: string): PriceChangeNotification[] {
  const notifications = getFromStorage<PriceChangeNotification[]>(STORAGE_KEYS.NOTIFICATIONS, businessId) || []
  const filtered = ingredientId ? notifications.filter((n) => n.ingredientId === ingredientId) : notifications
  return [...filtered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(businessId: string, notificationId: string): void {
  const notifications = getFromStorage<PriceChangeNotification[]>(STORAGE_KEYS.NOTIFICATIONS, businessId) || []

  const notification = notifications.find((n) => n.id === notificationId)
  if (notification) {
    notification.read = true
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications, businessId)
  }
}
