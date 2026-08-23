import { getRecipes } from "./storage/recipes"
import { getIngredients } from "./storage/ingredients"
import { buildPurchaseOrderData, type PurchaseOrderComputationResult } from "./purchase-orders"
import type { Menu, MenuItem, MenuSection, MenuStep } from "@/lib/types/menus"

export type { Menu, MenuItem, MenuSection, MenuStep }

// Mapeo de "paso de menú" (recipe.plate, valores de recipeSteps) hacia el bucket fijo
// que usan los cálculos de analytics/mezcla (lib/analytics/menuScenario.ts).
const stepToSection: Record<string, MenuSection> = {
  Bienvenida: "entrada",
  "Amuse-bouche": "entrada",
  "Pan y mantequilla": "entrada",
  "Entrada fría": "entrada",
  "Entrada caliente": "entrada",
  Sopa: "entrada",
  Consomé: "entrada",
  "Intermedio vegetal": "entrada",
  "Limpieza de paladar": "entrada",
  "Pan dulce": "entrada",
  Pasta: "fuerte",
  Arroz: "fuerte",
  "Plato intermedio": "fuerte",
  Pescado: "fuerte",
  Mariscos: "fuerte",
  "Carne blanca": "fuerte",
  "Carne roja": "fuerte",
  Vegetariano: "fuerte",
  Vegano: "fuerte",
  "Plato fuerte": "fuerte",
  "Plato compartido": "fuerte",
  "Menú infantil": "fuerte",
  "Degustación especial": "fuerte",
  Quesos: "postre",
  Prepostre: "postre",
  Postre: "postre",
  "Postre de chocolate": "postre",
  "Petit fours": "postre",
  "Cierre de experiencia": "postre",
  Café: "bebida",
  Té: "bebida",
  Infusión: "bebida",
  Digestivo: "bebida",
  "Maridaje de cierre": "bebida",
}

function mapClassificationToSection(classification: string): MenuSection {
  const lowerClass = (classification || "").toLowerCase()
  if (lowerClass.includes("entrada") || lowerClass.includes("fría")) return "entrada"
  if (lowerClass.includes("postre") || lowerClass.includes("repostería") || lowerClass.includes("pastelería"))
    return "postre"
  if (lowerClass.includes("bebida") || lowerClass.includes("barismo") || lowerClass.includes("coctelería"))
    return "bebida"
  return "fuerte"
}

/**
 * Bucket fijo (para analytics de mezcla) que le corresponde "naturalmente" a una receta,
 * priorizando su paso de menú (recipe.plate) y cayendo a la clasificación de cocina si no tiene.
 */
export function getRecipeSection(recipe: { plate?: string; classification?: string }): MenuSection {
  if (recipe.plate && stepToSection[recipe.plate]) return stepToSection[recipe.plate]
  return mapClassificationToSection(recipe.classification || "")
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Normaliza un menú tal como pudo haber quedado guardado por versiones anteriores del
 * sistema (sin `steps`, con `updatedAt` anidado en `metadata`, ítems sin `id`/`stepId`).
 * Nunca debe asumirse que un menú leído de localStorage ya tiene la forma actual.
 */
function normalizeMenu(raw: any): Menu {
  const createdAt = raw.createdAt || raw.metadata?.createdAt || new Date().toISOString()
  const updatedAt = raw.updatedAt || raw.metadata?.updatedAt || createdAt

  const legacySectionLabels: Record<MenuSection, string> = {
    entrada: "Entradas",
    fuerte: "Platos Fuertes",
    postre: "Postres",
    bebida: "Bebidas",
  }

  let steps: MenuStep[] = Array.isArray(raw.steps) ? raw.steps : []
  const stepIdBySection = new Map<string, string>()

  if (steps.length === 0) {
    // Menú de antes de que existieran los pasos dinámicos: se sintetiza un paso por
    // cada sección que realmente tenga ítems, en el orden entrada→fuerte→postre→bebida.
    ;(["entrada", "fuerte", "postre", "bebida"] as MenuSection[]).forEach((section, index) => {
      const hasItems = (raw.items || []).some((item: any) => item.section === section)
      if (hasItems) {
        const stepId = generateId("step")
        stepIdBySection.set(section, stepId)
        steps.push({ id: stepId, name: legacySectionLabels[section], order: index })
      }
    })
  }

  const stepByName = new Map(steps.map((s) => [s.name, s.id]))

  const items: MenuItem[] = (raw.items || []).map((item: any) => {
    const section: MenuSection = item.section || "fuerte"
    let stepId: string = item.stepId
    if (!stepId) {
      stepId =
        stepIdBySection.get(section) ||
        stepByName.get(legacySectionLabels[section]) ||
        steps[0]?.id ||
        generateId("step")
    }
    return {
      id: item.id || generateId("item"),
      recipeId: item.recipeId,
      stepId,
      section,
      label: item.label,
      priceOverride: item.priceOverride ?? null,
      enabled: item.enabled !== false,
      plannedQuantity: item.plannedQuantity ?? null,
    }
  })

  return {
    id: raw.id,
    businessId: raw.businessId,
    name: raw.name,
    menuType: raw.menuType,
    serviceDate: raw.serviceDate ?? null,
    plannedServings: raw.plannedServings ?? null,
    steps,
    items,
    createdAt,
    updatedAt,
  }
}

/**
 * Get all menus for a business
 */
export function getMenus(businessId: string): Menu[] {
  const { getFromStorage, STORAGE_KEYS } = require("./storage/core")
  const raw = getFromStorage<any[]>(STORAGE_KEYS.MENUS, businessId) || []
  return raw.map(normalizeMenu)
}

/**
 * Save menus for a business
 */
export function saveMenus(businessId: string, menus: Menu[]): void {
  const { saveToStorage, STORAGE_KEYS } = require("./storage/core")
  saveToStorage(STORAGE_KEYS.MENUS, menus, businessId)
}

/**
 * Get a single menu by ID
 */
export function getMenuById(businessId: string, menuId: string): Menu | null {
  const menus = getMenus(businessId)
  return menus.find((m) => m.id === menuId) || null
}

/**
 * Create a new menu
 */
export function createMenu(businessId: string, menuData: Omit<Menu, "id" | "createdAt" | "updatedAt">): Menu {
  const menus = getMenus(businessId)

  const now = new Date().toISOString()
  const newMenu: Menu = {
    ...menuData,
    id: generateId("menu"),
    businessId,
    createdAt: now,
    updatedAt: now,
  }

  menus.push(newMenu)
  saveMenus(businessId, menus)

  return newMenu
}

/**
 * Update an existing menu
 */
export function updateMenu(businessId: string, menuId: string, updates: Partial<Menu>): Menu | null {
  const menus = getMenus(businessId)
  const index = menus.findIndex((m) => m.id === menuId)

  if (index === -1) {
    console.error(`[Menus] Menu not found: ${menuId}`)
    return null
  }

  const updatedMenu: Menu = {
    ...menus[index],
    ...updates,
    id: menus[index].id,
    businessId,
    createdAt: menus[index].createdAt,
    updatedAt: new Date().toISOString(),
  }

  menus[index] = updatedMenu
  saveMenus(businessId, menus)

  return updatedMenu
}

/**
 * Delete a menu
 */
export function deleteMenu(businessId: string, menuId: string): boolean {
  const menus = getMenus(businessId)
  const filtered = menus.filter((m) => m.id !== menuId)

  if (filtered.length === menus.length) {
    return false
  }

  saveMenus(businessId, filtered)
  return true
}

/**
 * Duplicate an existing menu
 */
export function duplicateMenu(businessId: string, menuId: string, newName?: string): Menu {
  const original = getMenuById(businessId, menuId)
  if (!original) {
    throw new Error(`Menu with id ${menuId} not found`)
  }

  return createMenu(businessId, {
    businessId,
    name: newName || `${original.name} (Copia)`,
    menuType: original.menuType,
    serviceDate: original.serviceDate,
    plannedServings: original.plannedServings,
    steps: original.steps,
    items: original.items,
  })
}

/**
 * Genera la lista de ingredientes necesarios para armar este menú (usada por
 * "Generar Orden de Compra" desde /menus). Antes esta función ignoraba por completo
 * cuánto se planeaba servir de cada plato (compaxByRecipeId siempre vacío) y el
 * inventario actual (inventorySnapshot siempre vacío) — la orden generada pedía
 * el ingrediente completo de la receta base, sin escalar ni descontar lo que ya
 * hay en bodega. Ahora:
 * - El multiplicador por receta (compax) sale de MenuItem.plannedQuantity (o, si no
 *   se ajustó ese plato en particular, de Menu.plannedServings) dividido entre el
 *   rendimiento base de la receta — la misma proporción que usa el modificador de
 *   PAX en Ficha Técnica, pero calculada aquí sin tocar la receta original en ningún
 *   momento (ver MenuItem.plannedQuantity en lib/types/menus.ts).
 * - El inventario actual de cada ingrediente se resta de lo necesario, para que la
 *   orden solo incluya lo que realmente falta comprar.
 */
export function generateMenuIngredientList(businessId: string, menu: Menu): PurchaseOrderComputationResult {
  const recipes = getRecipes(businessId)
  const ingredients = getIngredients(businessId)

  const plannedQuantityByRecipeId: Record<string, number> = {}
  menu.items
    .filter((item) => item.enabled)
    .forEach((item) => {
      const quantity = item.plannedQuantity ?? menu.plannedServings ?? null
      if (quantity === null) return
      plannedQuantityByRecipeId[item.recipeId] = (plannedQuantityByRecipeId[item.recipeId] || 0) + quantity
    })

  const recipeIds = Array.from(new Set(menu.items.filter((item) => item.enabled).map((item) => item.recipeId)))

  const compaxByRecipeId: Record<string, number> = {}
  recipeIds.forEach((recipeId) => {
    const recipe = recipes.find((r) => r.id === recipeId)
    const baseYield = recipe?.yieldAmount && recipe.yieldAmount > 0 ? recipe.yieldAmount : 1
    const planned = plannedQuantityByRecipeId[recipeId]
    compaxByRecipeId[recipeId] = planned !== undefined ? planned / baseYield : 1
  })

  const inventorySnapshot: Record<string, number> = {}
  ingredients.forEach((ingredient) => {
    const currentStock = (ingredient as any).currentStock
    if (typeof currentStock === "number" && currentStock > 0) {
      inventorySnapshot[ingredient.id] = currentStock
    }
  })

  return buildPurchaseOrderData({
    businessId,
    selectedRecipeIds: recipeIds,
    compaxByRecipeId,
    inventorySnapshot,
  })
}
