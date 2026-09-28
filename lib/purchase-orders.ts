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
import { accumulateRecipeConsumption, indexById, type ConsumptionMap } from "./recipe-consumption"

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

// Orden alterna para la orden generada directo desde un menú (ver
// components/purchase-order-page.tsx, handler de ?fromMenu=): ahí el pedido explícito
// del dueño del proyecto fue agrupar por categoría, no por proveedor — la pantalla ya
// llega con todos los ingredientes de los platos y sus sub-recetas, y agrupar por
// categoría es como se recorre físicamente una bodega. No reemplaza
// sortPurchaseOrderItemsBySupplier (decisión de negocio ya documentada arriba, usada
// en el flujo manual y en el auto-sugerido) — es una función aparte, para un flujo aparte.
export function sortPurchaseOrderItemsByCategory<T extends { category?: string; ingredientName: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const categoryA = a.category?.trim() || ""
    const categoryB = b.category?.trim() || ""
    if (!categoryA && categoryB) return 1
    if (categoryA && !categoryB) return -1
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB)
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

  // Expansión a ingredientes base con la regla única de lib/recipe-consumption.ts
  // (docs/134): sub-recetas escaladas por su rendimiento y merma convertida a cantidad
  // bruta — antes las sub-recetas se multiplicaban por la cantidad usada sin dividir por
  // su rendimiento (150 g de una salsa pedía 150 veces la receta completa).
  const recipesById = indexById(recipes)
  const ingredientsById = indexById(ingredients)
  const accumulator: ConsumptionMap = new Map()

  const recipesSummary: {
    recipeId: string
    recipeName: string
    compax: number
  }[] = []

  selectedRecipeIds.forEach((recipeId) => {
    const recipe = recipesById.get(recipeId)
    if (!recipe) {
      warnings.push(`Recipe not found: ${recipeId}`)
      return
    }
    const compax = compaxByRecipeId[recipeId] || 1
    recipesSummary.push({ recipeId: recipe.id, recipeName: recipe.name, compax })
    accumulateRecipeConsumption(recipe, compax, recipesById, ingredientsById, accumulator, {
      grossUpMerma: true,
      warnings,
    })
  })
  const ingredientAccumulator = Object.fromEntries(accumulator)

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

export function getPurchaseOrders(businessId: string): any[] {
  return getPurchaseOrdersFromStorage(businessId)
}

/**
 * Save purchase orders for a business
 */
export function savePurchaseOrders(businessId: string, orders: any[]): void {
  savePurchaseOrdersToStorage(businessId, orders)
}
