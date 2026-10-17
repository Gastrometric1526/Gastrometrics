import { getRecipes, saveRecipes, getRecipeById } from "./storage/recipes"
import { getIngredients, updateIngredient, getIngredientByRecipeId } from "./storage/ingredients"
import { syncSubRecipeToIngredient } from "./subrecipe/core"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./storage/core"
import { SUBRECIPE_CLASSIFICATION, type Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { applyPriceRule, type PricingContext } from "./recipe-pricing"
import { getBusinessById, getEffectivePricingDefaults } from "./storage/businesses"
import { calculateTotalMonthlyExpenses } from "@/types/business"
import { getCurrentCurrencyCode } from "./currency"

/** Cambio de precio de venta de una receta por la regla de docs/162. */
export type RecipePriceChange =
  | { kind: "raised"; recipeId: string; recipeName: string; oldPrice: number; newPrice: number }
  | { kind: "kept"; recipeId: string; recipeName: string; price: number; oldMargin: number; newMargin: number }

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
  /** Precios de venta que subieron, o que se mantuvieron con más margen (docs/162). */
  priceChanges: RecipePriceChange[]
  /**
   * Sub-recetas con precio de venta escrito a mano cuyo precio sugerido quedó por encima
   * del actual y que están en «Preguntarme» (docs/164): la pantalla pregunta si se sube.
   */
  pendingSubRecipePrices: PendingSubRecipePrice[]
  timestamp: string
}

/** Sub-receta a la que se le puede subir el precio de venta, si la persona lo acepta (docs/164). */
export interface PendingSubRecipePrice {
  recipeId: string
  recipeName: string
  currentPrice: number
  suggestedPrice: number
}

/** Qué hacer con el precio de venta escrito a mano de una sub-receta cuando cambia su costo. */
export type SubRecipePriceMode = "ask" | "always" | "never"

export function subRecipePriceModeOf(recipe: Pick<Recipe, "subRecipePriceUpdate">): SubRecipePriceMode {
  return recipe.subRecipePriceUpdate === "always" || recipe.subRecipePriceUpdate === "never"
    ? recipe.subRecipePriceUpdate
    : "ask"
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


function isSubRecipeRecipe(recipe: Recipe): boolean {
  return recipe.classification === SUBRECIPE_CLASSIFICATION || recipe.isSubRecipe === true
}

function pricingContextFor(businessId: string): PricingContext {
  // Contexto del precio sugerido, igual que en la Ficha Técnica (moneda, costo fijo por
  // plato del negocio y objetivo de food cost por defecto).
  const business = getBusinessById(businessId)
  return {
    currencyCode: getCurrentCurrencyCode(),
    fixedCostPerPlate:
      business?.expenses && business.estimatedMonthlyPlates && business.estimatedMonthlyPlates > 0
        ? calculateTotalMonthlyExpenses(business.expenses) / business.estimatedMonthlyPlates
        : 0,
    defaultTargetFoodCostPercent: getEffectivePricingDefaults(businessId).targetFoodCostPercent,
  }
}

const MAX_CASCADE_STEPS = 500

/**
 * Cascada completa de costos (docs/164). Parte de ingredientes cuyo precio por unidad ya
 * cambió (en `ingredientsById`) y recalcula todas las recetas que los usan; cuando una de
 * ellas es una sub-receta, actualiza su ingrediente vinculado y sigue con las recetas que
 * usan ESA sub-receta, en cualquier nivel. Antes (docs/162) se paraba en el primer nivel:
 * los platos que llevaban la salsa, y no el tomate suelto, quedaban con el costo viejo.
 *
 * Al final aplica la regla de precio una sola vez por receta, con su costo unitario de
 * ANTES de la cascada y el de después:
 * - Platos (no sub-recetas): «el precio solo sube» (docs/162), sin preguntar.
 * - Sub-recetas con precio de venta escrito a mano (customUnitPrice) cuyo sugerido nuevo
 *   supera ese precio: según `subRecipePriceUpdate` — "always" lo sube, "never" lo deja,
 *   "ask" (por defecto) lo devuelve en pendingSubRecipePrices para que la pantalla
 *   pregunte. Una baja de costo en una sub-receta no cambia nada (el precio ya es fijo).
 */
function runCostCascade(
  businessId: string,
  recipes: Recipe[],
  ingredientsById: Map<string, Ingredient>,
  startIngredientIds: string[],
  result: RecalculationResult,
): void {
  const pricingCtx = pricingContextFor(businessId)
  const before = new Map<string, { cost: number; unitCost: number }>()
  const worklist = [...startIngredientIds]
  let steps = 0

  while (worklist.length > 0 && steps < MAX_CASCADE_STEPS) {
    steps++
    const changedId = worklist.shift() as string
    for (const recipe of recipes) {
      if (!recipe.ingredients?.some((item) => item.ingredientId === changedId)) continue

      if (!before.has(recipe.id)) {
        const cost = recipe.totalCost || 0
        before.set(recipe.id, {
          cost,
          unitCost: recipe.costPerServing ?? (recipe.yieldAmount > 0 ? cost / recipe.yieldAmount : cost),
        })
      }

      // BUG CORREGIDO (sesiones anteriores): el costo es Σ cantidad × precio por unidad
      // (purchasePrice ÷ contenido neto), nunca × el precio del paquete completo.
      let newCost = 0
      for (const item of recipe.ingredients ?? []) {
        const ing = item.ingredientId ? ingredientsById.get(item.ingredientId) : undefined
        if (ing) newCost += item.quantity * (ing.pricing?.pricePerUnit || 0)
      }
      recipe.totalCost = newCost
      recipe.costPerServing = recipe.yieldAmount > 0 ? newCost / recipe.yieldAmount : newCost

      if (isSubRecipeRecipe(recipe)) {
        const linked = syncSubRecipeToIngredient(recipe, businessId)
        if (linked) {
          const previous = ingredientsById.get(linked.id)
          ingredientsById.set(linked.id, linked)
          const changed =
            !previous || Math.abs((previous.pricing?.pricePerUnit || 0) - (linked.pricing?.pricePerUnit || 0)) > 1e-9
          if (changed && !worklist.includes(linked.id)) worklist.push(linked.id)
        }
      }
    }
  }

  for (const recipe of recipes) {
    const old = before.get(recipe.id)
    if (!old) continue
    const newCost = recipe.totalCost || 0
    result.affectedRecipes.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      oldCost: old.cost,
      newCost,
      costDifference: newCost - old.cost,
      percentChange: old.cost > 0 ? ((newCost - old.cost) / old.cost) * 100 : 0,
    })

    if (!isSubRecipeRecipe(recipe)) {
      const outcome = applyPriceRule(recipe, old.unitCost, recipe.costPerServing, pricingCtx)
      if (outcome.kind === "raised") {
        Object.assign(recipe, outcome.patch)
        result.priceChanges.push({ kind: "raised", recipeId: recipe.id, recipeName: recipe.name, oldPrice: outcome.oldPrice, newPrice: outcome.newPrice })
      } else if (outcome.kind === "kept") {
        Object.assign(recipe, outcome.patch)
        result.priceChanges.push({ kind: "kept", recipeId: recipe.id, recipeName: recipe.name, price: outcome.price, oldMargin: outcome.oldMargin, newMargin: outcome.newMargin })
      }
      continue
    }

    const linked = getIngredientByRecipeId(recipe.id, businessId)
    if (linked) {
      result.affectedSubRecipes.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        linkedIngredientId: linked.id,
        oldUnitCost: old.unitCost,
        newUnitCost: recipe.costPerServing,
      })
    }

    // Sub-receta: solo cuenta si tiene un precio de venta escrito a mano.
    if (!((recipe.customUnitPrice ?? 0) > 0)) continue
    const outcome = applyPriceRule(recipe, old.unitCost, recipe.costPerServing, pricingCtx)
    if (outcome.kind !== "raised") continue
    const mode = subRecipePriceModeOf(recipe)
    if (mode === "never") continue
    if (mode === "always") {
      Object.assign(recipe, subRecipePricePatch(recipe, outcome.newPrice))
      result.priceChanges.push({ kind: "raised", recipeId: recipe.id, recipeName: recipe.name, oldPrice: outcome.oldPrice, newPrice: outcome.newPrice })
    } else {
      result.pendingSubRecipePrices.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        currentPrice: outcome.oldPrice,
        suggestedPrice: outcome.newPrice,
      })
    }
  }
}

/**
 * Al subirle el precio a una sub-receta se mantiene como precio escrito a mano, para que
 * siga contando como «sub-receta con precio de venta» la próxima vez.
 */
function subRecipePricePatch(recipe: Recipe, price: number): Partial<Recipe> {
  const yieldAmount = recipe.yieldAmount > 0 ? recipe.yieldAmount : 1
  return { unitPrice: price, customUnitPrice: price, totalPrice: price * yieldAmount }
}

function emptyResult(id: string, name: string, oldPrice: number, newPrice: number): RecalculationResult {
  return {
    ingredientId: id,
    ingredientName: name,
    oldPrice,
    newPrice,
    affectedRecipes: [],
    affectedSubRecipes: [],
    priceChanges: [],
    pendingSubRecipePrices: [],
    timestamp: new Date().toISOString(),
  }
}

function dispatchRecalculated(result: RecalculationResult): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("priceRecalculated", { detail: result }))
  }
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
  const ingredients = getIngredients(businessId)
  const recipes = getRecipes(businessId)

  const ingredient = ingredients.find((i) => i.id === ingredientId)
  if (!ingredient) {
    throw new Error(`Ingredient not found: ${ingredientId}`)
  }

  const oldPrice = ingredient.pricing?.purchasePrice || 0
  const netContent = ingredient.pricing?.netContent || 1

  // BUG CORREGIDO: pricePerUnit se guardaba igual a newPrice (el precio del paquete
  // completo), en vez de newPrice ÷ contenido neto.
  const newPricing = {
    ...ingredient.pricing,
    purchasePrice: newPrice,
    pricePerUnit: newPrice / netContent,
    lastUpdated: new Date().toISOString(),
  }
  updateIngredient(ingredientId, { pricing: newPricing }, businessId)

  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]))
  ingredientsById.set(ingredientId, { ...ingredient, pricing: newPricing })

  const result = emptyResult(ingredient.id, ingredient.name, oldPrice, newPrice)
  runCostCascade(businessId, recipes, ingredientsById, [ingredientId], result)
  saveRecipes(recipes, businessId)

  // Bitácora de precios del ingrediente (historial y tendencia de 90 días).
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
  const notifications = getFromStorage<PriceChangeNotification[]>(STORAGE_KEYS.NOTIFICATIONS, businessId) || []
  notifications.push(notification)
  saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications, businessId)

  dispatchRecalculated(result)
  return result
}

/**
 * Después de guardar una sub-receta en la Ficha Técnica (docs/164): recalcula los platos
 * y sub-recetas que la usan, en cualquier nivel, con la misma regla de precio. Antes se
 * quedaban con el costo viejo hasta abrirlos y guardarlos a mano. La sub-receta ya debe
 * estar guardada y sincronizada como ingrediente (syncSubRecipeToIngredient).
 */
export async function recalculateDependentsOfSubRecipe(
  businessId: string,
  subRecipeId: string,
): Promise<RecalculationResult | null> {
  const linked = getIngredientByRecipeId(subRecipeId, businessId)
  const subRecipe = getRecipeById(subRecipeId, businessId)
  if (!linked || !subRecipe) return null
  const recipes = getRecipes(businessId)
  const usedSomewhere = recipes.some(
    (r) => r.id !== subRecipeId && r.ingredients?.some((item) => item.ingredientId === linked.id),
  )
  if (!usedSomewhere) return null

  const ingredientsById = new Map(getIngredients(businessId).map((i) => [i.id, i]))
  ingredientsById.set(linked.id, linked)
  const unit = linked.pricing?.pricePerUnit || 0
  const result = emptyResult(linked.id, subRecipe.name, unit, unit)
  runCostCascade(businessId, recipes, ingredientsById, [linked.id], result)
  saveRecipes(recipes, businessId)
  dispatchRecalculated(result)
  return result
}

/**
 * Respuesta de la persona a la pregunta de docs/164: a las sub-recetas aceptadas se les
 * sube el precio de venta al sugerido (como precio escrito a mano). Con `remember`, cada
 * sub-receta guarda su elección ("always" para las aceptadas, "never" para las demás),
 * que se cambia después en su Ficha Técnica. Devuelve los cambios para Notificaciones.
 */
export async function applySubRecipePriceDecisions(
  businessId: string,
  items: PendingSubRecipePrice[],
  acceptedIds: string[],
  remember: boolean,
): Promise<RecipePriceChange[]> {
  const recipes = getRecipes(businessId)
  const changes: RecipePriceChange[] = []
  let touched = false
  for (const item of items) {
    const recipe = recipes.find((r) => r.id === item.recipeId)
    if (!recipe) continue
    const accepted = acceptedIds.includes(item.recipeId)
    if (accepted) {
      Object.assign(recipe, subRecipePricePatch(recipe, item.suggestedPrice))
      changes.push({ kind: "raised", recipeId: recipe.id, recipeName: recipe.name, oldPrice: item.currentPrice, newPrice: item.suggestedPrice })
      touched = true
    }
    if (remember) {
      recipe.subRecipePriceUpdate = accepted ? "always" : "never"
      touched = true
    }
  }
  if (touched) await saveRecipes(recipes, businessId)
  return changes
}

/**
 * Avisa a la ventana global (components/subrecipe-price-prompt.tsx) que hay sub-recetas
 * por preguntar. `raisedDishes` = platos que ya subieron solos, para el texto.
 */
export const SUBRECIPE_PRICE_PROMPT_EVENT = "subRecipePricePrompt"

export interface SubRecipePricePromptDetail {
  businessId: string
  items: PendingSubRecipePrice[]
  raisedDishes: number
  sourceName?: string
}

export function requestSubRecipePricePrompt(
  businessId: string,
  results: (RecalculationResult | null | undefined)[],
  sourceName?: string,
): void {
  if (typeof window === "undefined") return
  const items: PendingSubRecipePrice[] = []
  let raisedDishes = 0
  for (const r of results) {
    if (!r) continue
    raisedDishes += r.priceChanges.filter((c) => c.kind === "raised").length
    for (const p of r.pendingSubRecipePrices) if (!items.some((i) => i.recipeId === p.recipeId)) items.push(p)
  }
  if (items.length === 0) return
  const detail: SubRecipePricePromptDetail = { businessId, items, raisedDishes, sourceName }
  window.dispatchEvent(new CustomEvent(SUBRECIPE_PRICE_PROMPT_EVENT, { detail }))
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
