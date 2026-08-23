/**
 * PURCHASE ORDERS CORE MODULE
 * Centralized logic for building purchase orders with sub-recipe expansion
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { getRecipes } from "./storage/recipes"
import { getIngredients } from "./storage/ingredients"
import {
  getPurchaseOrders as getPurchaseOrdersFromStorage,
  savePurchaseOrders as savePurchaseOrdersToStorage,
} from "./storage/purchase-orders"
import { computePresentationQuantity } from "./utils/presentation-quantity"

export interface PurchaseOrderItem {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  supplier?: string
  category?: string
  isFromSubRecipe?: boolean
  sourceRecipes?: string[] // Which recipes need this ingredient
  // Presentación de compra (Saco, Caja, Botella...) tal como está guardada en la base de
  // datos de ingredientes — la orden de compra debe pedirse en estas unidades, no en la
  // unidad base de la receta (nadie compra "2500 gramos de harina", compra "1 saco").
  // presentationQuantity es null cuando el ingrediente todavía no tiene presentación
  // configurada; la UI debe permitir fijarla ahí mismo (ver components/purchase-order-form.tsx).
  presentation?: string | null
  presentationQuantity?: number | null
}

// Orden que pide el negocio para la lista final: alfabético por proveedor (para poder
// llamar a cada proveedor de una vez), y los ingredientes sin proveedor registrado van
// al final, también en orden alfabético entre ellos.
export function sortPurchaseOrderItemsBySupplier<T extends { supplier?: string; ingredientName: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const supplierA = a.supplier?.trim() || ""
    const supplierB = b.supplier?.trim() || ""
    if (!supplierA && supplierB) return 1
    if (supplierA && !supplierB) return -1
    if (supplierA !== supplierB) return supplierA.localeCompare(supplierB)
    return a.ingredientName.localeCompare(b.ingredientName)
  })
}

export interface InventorySnapshot {
  [ingredientId: string]: number // Available quantity
}

export interface PurchaseOrderComputationResult {
  items: PurchaseOrderItem[]
  totalCost: number
  recipesSummary: {
    recipeId: string
    recipeName: string
    compax: number
  }[]
  warnings: string[]
}

/**
 * Build purchase order data with sub-recipe expansion
 * This is the SINGLE SOURCE OF TRUTH for purchase order calculations
 */
export function buildPurchaseOrderData({
  businessId,
  selectedRecipeIds,
  compaxByRecipeId = {},
  inventorySnapshot = {},
}: {
  businessId: string
  selectedRecipeIds: string[]
  compaxByRecipeId?: Record<string, number>
  inventorySnapshot?: InventorySnapshot
}): PurchaseOrderComputationResult {
  console.log(`[PurchaseOrders] Building order for ${selectedRecipeIds.length} recipes`)

  const recipes = getRecipes(businessId)
  const ingredients = getIngredients(businessId)
  const warnings: string[] = []

  // Accumulator for ingredient quantities
  const ingredientAccumulator: Record<
    string,
    {
      quantity: number
      unit: string
      sourceRecipes: Set<string>
    }
  > = {}

  const recipesSummary: {
    recipeId: string
    recipeName: string
    compax: number
  }[] = []

  // Process each selected recipe
  selectedRecipeIds.forEach((recipeId) => {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe) {
      warnings.push(`Recipe not found: ${recipeId}`)
      return
    }

    const compax = compaxByRecipeId[recipeId] || 1
    recipesSummary.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      compax,
    })

    console.log(`[PurchaseOrders] Processing recipe: ${recipe.name} (COMPAX: ${compax})`)

    // Process each ingredient in the recipe
    recipe.ingredients?.forEach((item) => {
      const ingredient = ingredients.find((i) => i.id === item.ingredientId)
      if (!ingredient) {
        warnings.push(`Ingredient not found: ${item.ingredientId} in recipe ${recipe.name}`)
        return
      }

      // Check if this ingredient is linked to a sub-recipe
      if (ingredient.recipeId || ingredient.recipeData?.originalRecipeId) {
        // This is a sub-recipe ingredient - expand it
        const subRecipeId = ingredient.recipeId || ingredient.recipeData?.originalRecipeId
        const subRecipe = recipes.find((r) => r.id === subRecipeId)

        if (subRecipe) {
          console.log(`[PurchaseOrders] Expanding sub-recipe: ${subRecipe.name}`)
          expandSubRecipe(subRecipe, item.quantity * compax, ingredientAccumulator, recipes, ingredients, warnings)
        } else {
          warnings.push(`Sub-recipe not found: ${subRecipeId}`)
        }
      } else {
        // Normal ingredient - add to accumulator
        const key = item.ingredientId
        if (!ingredientAccumulator[key]) {
          ingredientAccumulator[key] = {
            quantity: 0,
            unit: ingredient.unit,
            sourceRecipes: new Set(),
          }
        }
        ingredientAccumulator[key].quantity += item.quantity * compax
        ingredientAccumulator[key].sourceRecipes.add(recipe.name)
      }
    })
  })

  // Convert accumulator to items array
  const items: PurchaseOrderItem[] = []
  let totalCost = 0

  Object.entries(ingredientAccumulator).forEach(([ingredientId, data]) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId)
    if (!ingredient) {
      warnings.push(`Ingredient not found in database: ${ingredientId}`)
      return
    }

    let quantity = data.quantity

    // Apply inventory snapshot (subtract available quantity)
    if (inventorySnapshot[ingredientId]) {
      const available = inventorySnapshot[ingredientId]
      quantity = Math.max(0, quantity - available)
      if (quantity === 0) {
        console.log(`[PurchaseOrders] Skipping ${ingredient.name} - sufficient inventory`)
        return
      }
    }

    // BUG CORREGIDO: usaba purchasePrice (precio del paquete completo, ej. L350 por un
    // saco de 25000g) directo contra `quantity`, que está en la unidad base de la receta
    // (gramos) — inflaba el costo total miles de veces (ver mismo bug ya corregido en
    // lib/recalculate.ts). El precio correcto por unidad base es pricePerUnit
    // (purchasePrice ÷ contenido neto), igual que en el resto de la app.
    const unitPrice = ingredient.pricing?.pricePerUnit || 0
    const totalPrice = quantity * unitPrice
    const { presentation, presentationQuantity } = computePresentationQuantity(ingredient, quantity)

    items.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity,
      unit: data.unit,
      unitPrice,
      totalPrice,
      supplier: ingredient.supplier,
      category: ingredient.category,
      sourceRecipes: Array.from(data.sourceRecipes),
      presentation,
      presentationQuantity,
    })

    totalCost += totalPrice
  })

  console.log(`[PurchaseOrders] Generated ${items.length} items, total cost: $${totalCost.toFixed(2)}`)

  return {
    items: sortPurchaseOrderItemsBySupplier(items),
    totalCost,
    recipesSummary,
    warnings,
  }
}

/**
 * Recursively expand a sub-recipe into base ingredients
 */
function expandSubRecipe(
  subRecipe: Recipe,
  multiplier: number,
  accumulator: Record<string, { quantity: number; unit: string; sourceRecipes: Set<string> }>,
  allRecipes: Recipe[],
  allIngredients: Ingredient[],
  warnings: string[],
  depth = 0,
): void {
  if (depth > 10) {
    warnings.push(`Maximum recursion depth reached for sub-recipe: ${subRecipe.name}`)
    return
  }

  console.log(`${"  ".repeat(depth)}[PurchaseOrders] Expanding sub-recipe: ${subRecipe.name} (x${multiplier})`)

  subRecipe.ingredients?.forEach((item) => {
    const ingredient = allIngredients.find((i) => i.id === item.ingredientId)
    if (!ingredient) {
      warnings.push(`Ingredient not found: ${item.ingredientId} in sub-recipe ${subRecipe.name}`)
      return
    }

    // Check if this ingredient is also a sub-recipe (nested)
    if (ingredient.recipeId || ingredient.recipeData?.originalRecipeId) {
      const nestedSubRecipeId = ingredient.recipeId || ingredient.recipeData?.originalRecipeId
      const nestedSubRecipe = allRecipes.find((r) => r.id === nestedSubRecipeId)

      if (nestedSubRecipe) {
        // Recursively expand nested sub-recipe
        expandSubRecipe(
          nestedSubRecipe,
          item.quantity * multiplier,
          accumulator,
          allRecipes,
          allIngredients,
          warnings,
          depth + 1,
        )
      } else {
        warnings.push(`Nested sub-recipe not found: ${nestedSubRecipeId}`)
      }
    } else {
      // Base ingredient - add to accumulator
      const key = item.ingredientId
      if (!accumulator[key]) {
        accumulator[key] = {
          quantity: 0,
          unit: ingredient.unit,
          sourceRecipes: new Set(),
        }
      }
      accumulator[key].quantity += item.quantity * multiplier
      accumulator[key].sourceRecipes.add(subRecipe.name)
    }
  })
}

/**
 * Get purchase orders for a business
 */
export function getPurchaseOrders(businessId: string): any[] {
  return getPurchaseOrdersFromStorage(businessId)
}

/**
 * Save purchase orders for a business
 */
export function savePurchaseOrders(businessId: string, orders: any[]): void {
  savePurchaseOrdersToStorage(businessId, orders)
}
