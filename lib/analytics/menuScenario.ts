import type { Menu, MenuItem, MenuSection, ScenarioMixMethod, ScenarioParams, ScenarioResult } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"
import { getMenus } from "@/lib/menus"
import { getRecipes } from "@/lib/storage/recipes"
import { getBusinessById } from "@/lib/storage/businesses"
import { calculateTotalMonthlyExpenses } from "@/types/business"

// Recipe data interface for analytics
interface RecipeAnalyticsData {
  priceBase: number
  cost: number
  section: MenuSection
  estrella?: boolean
}

// Map recipe classification to menu section
function mapClassificationToSection(classification: string): MenuSection {
  const lowerClass = classification.toLowerCase()

  if (lowerClass.includes("entrada") || lowerClass.includes("fría")) return "entrada"
  if (lowerClass.includes("postre") || lowerClass.includes("repostería") || lowerClass.includes("pastelería"))
    return "postre"
  if (lowerClass.includes("bebida") || lowerClass.includes("barismo") || lowerClass.includes("coctelería"))
    return "bebida"

  // Default to 'fuerte' for main dishes
  return "fuerte"
}

// Get effective price for menu item (override or base price)
function getEffectivePrice(item: MenuItem, recipesMap: Record<string, RecipeAnalyticsData>): number {
  return item.priceOverride ?? recipesMap[item.recipeId]?.priceBase ?? 0
}

// Check if item has low margin
function hasLowMargin(price: number, cost: number, threshold = 0.15): boolean {
  if (price <= 0) return true
  const margin = (price - cost) / price
  return margin < threshold || price - cost < 5 // 15% margin or 5 L minimum
}

// Infer mix weights for menu items
export function inferMix(args: {
  menu: Menu
  recipes: Record<string, RecipeAnalyticsData>
  method: ScenarioMixMethod
  categoryWeights?: Partial<Record<MenuSection, number>>
  upsellBebidas?: boolean
  salesHistoryByRecipe?: Record<string, number>
  inventoryDerivedPortions?: Record<string, number>
}): Record<string, number> {
  const { menu, recipes, method, categoryWeights, upsellBebidas, salesHistoryByRecipe, inventoryDerivedPortions } = args

  const enabledItems = menu.items.filter((item) => item.enabled)
  const mix: Record<string, number> = {}

  // Initialize all items with 0 weight
  enabledItems.forEach((item) => {
    mix[item.recipeId] = 0
  })

  if (enabledItems.length === 0) return mix

  switch (method) {
    case "ventas":
      if (salesHistoryByRecipe) {
        let totalSales = 0
        enabledItems.forEach((item) => {
          const sales = salesHistoryByRecipe[item.recipeId] || 0
          mix[item.recipeId] = sales
          totalSales += sales
        })

        // Normalize
        if (totalSales > 0) {
          enabledItems.forEach((item) => {
            mix[item.recipeId] = mix[item.recipeId] / totalSales
          })
        } else {
          // Fallback to uniform distribution
          enabledItems.forEach((item) => {
            mix[item.recipeId] = 1 / enabledItems.length
          })
        }
      }
      break

    case "inventario":
      if (inventoryDerivedPortions) {
        let totalPortions = 0
        enabledItems.forEach((item) => {
          const portions = inventoryDerivedPortions[item.recipeId] || 0
          mix[item.recipeId] = portions
          totalPortions += portions
        })

        // Normalize
        if (totalPortions > 0) {
          enabledItems.forEach((item) => {
            mix[item.recipeId] = mix[item.recipeId] / totalPortions
          })
        } else {
          // Fallback to uniform distribution
          enabledItems.forEach((item) => {
            mix[item.recipeId] = 1 / enabledItems.length
          })
        }
      }
      break

    case "heuristica":
    case "capacidad":
    default:
      // Use category weights with defaults
      const defaultWeights: Record<MenuSection, number> = {
        entrada: 20,
        fuerte: 55,
        postre: 10,
        bebida: 15,
      }

      const weights = { ...defaultWeights, ...categoryWeights }

      // Group items by section
      const itemsBySection: Record<MenuSection, MenuItem[]> = {
        entrada: [],
        fuerte: [],
        postre: [],
        bebida: [],
      }

      enabledItems.forEach((item) => {
        const recipe = recipes[item.recipeId]
        if (recipe) {
          itemsBySection[recipe.section].push(item)
        }
      })

      // Distribute weights within each section
      Object.entries(itemsBySection).forEach(([section, items]) => {
        const sectionWeight = weights[section as MenuSection] / 100
        const itemWeight = items.length > 0 ? sectionWeight / items.length : 0

        items.forEach((item) => {
          // Slight bias towards lower-priced items or starred items
          const recipe = recipes[item.recipeId]
          let bias = 1

          if (recipe?.estrella) {
            bias *= 1.1 // 10% boost for starred items
          }

          mix[item.recipeId] = itemWeight * bias
        })
      })

      // Normalize to ensure sum = 1
      const totalWeight = Object.values(mix).reduce((sum, weight) => sum + weight, 0)
      if (totalWeight > 0) {
        Object.keys(mix).forEach((recipeId) => {
          mix[recipeId] = mix[recipeId] / totalWeight
        })
      }
      break
  }

  // Apply upsell bebidas if enabled
  if (upsellBebidas) {
    const bebidaItems = enabledItems.filter((item) => {
      const recipe = recipes[item.recipeId]
      return recipe?.section === "bebida"
    })

    if (bebidaItems.length > 0) {
      // Increase bebida weights by 10% relatively
      bebidaItems.forEach((item) => {
        mix[item.recipeId] *= 1.1
      })

      // Renormalize
      const totalWeight = Object.values(mix).reduce((sum, weight) => sum + weight, 0)
      if (totalWeight > 0) {
        Object.keys(mix).forEach((recipeId) => {
          mix[recipeId] = mix[recipeId] / totalWeight
        })
      }
    }
  }

  return mix
}

// Calculate average ticket (TP)
export function computeTP(items: Array<{ price: number }>, mix: number[]): number {
  if (items.length !== mix.length) return 0

  return items.reduce((sum, item, index) => {
    return sum + mix[index] * item.price
  }, 0)
}

// Calculate average variable cost per portion (CVp)
export function computeCVp(items: Array<{ cost: number }>, mix: number[]): number {
  if (items.length !== mix.length) return 0

  return items.reduce((sum, item, index) => {
    return sum + mix[index] * item.cost
  }, 0)
}

// Calculate break-even point
export function computePE(CF: number, TP: number, CVp: number): { PE_plates: number; PE_revenue: number } {
  const MC = TP - CVp // Margen de contribución

  if (MC <= 0) {
    return { PE_plates: Number.POSITIVE_INFINITY, PE_revenue: Number.POSITIVE_INFINITY }
  }

  const PE_plates = CF / MC
  const PE_revenue = PE_plates * TP

  return { PE_plates, PE_revenue }
}

// Estimate capacity in plates per month
export function estimateCapacityPlates(cap: {
  seats: number
  servicesPerDay: number
  daysOpen: number
  occupancy: number
}): number {
  return cap.seats * cap.servicesPerDay * cap.daysOpen * cap.occupancy
}

// Calculate minimum ticket for target volume
export function computeTPmin(CF: number, PVm: number, CVp: number): number {
  if (PVm <= 0) return Number.POSITIVE_INFINITY
  return CF / PVm + CVp
}

// Get confidence level based on mix method
function getConfidenceLevel(method: ScenarioMixMethod): "alta" | "media" | "baja" {
  switch (method) {
    case "ventas":
      return "alta"
    case "inventario":
      return "media"
    case "heuristica":
    case "capacidad":
    default:
      return "baja"
  }
}

// Generate explanatory notes
function generateNotes(params: ScenarioParams, hasOverrides: boolean): string[] {
  const notes: string[] = []

  switch (params.mixMethod) {
    case "ventas":
      notes.push("Mezcla basada en historial de ventas")
      break
    case "inventario":
      notes.push("Mezcla basada en consumo de inventario")
      break
    case "heuristica":
      notes.push("Mezcla basada en pesos por categoría (heurística)")
      break
    case "capacidad":
      notes.push("Mezcla basada en capacidad estimada")
      break
  }

  if (params.upsellBebidas) {
    notes.push("Bebidas con upsell +10%")
  }

  if (hasOverrides) {
    notes.push("Menú incluye precios personalizados")
  }

  notes.push(
    `Capacidad: ${params.capacity.seats} asientos, ${params.capacity.servicesPerDay} servicios/día, ${params.capacity.daysOpen} días, ${Math.round(params.capacity.occupancy * 100)}% ocupación`,
  )

  return notes
}

// Main scenario calculation function
export function calculateScenario(businessId: string, menuId: string, params: ScenarioParams): ScenarioResult | null {
  try {
    // Get business expenses for CF calculation
    // BUG CORREGIDO: llamaba a getBusinesses(businessId), una función que nunca existió en
    // lib/storage/businesses.ts (el export real es getAllBusinesses, sin parámetros) —
    // rompía el build con un warning de import y hubiera lanzado en tiempo real la primera
    // vez que alguien calculara un escenario de menú. getBusinessById ya hace exactamente
    // lo que este código necesitaba (buscar un negocio por id).
    const business = getBusinessById(businessId)

    if (!business?.expenses) {
      throw new Error("Business expenses not configured")
    }

    const CF = calculateTotalMonthlyExpenses(business.expenses)

    // Get menu data
    const menus = getMenus(businessId)
    const menu = menus.find((m: Menu) => m.id === menuId)

    if (!menu) {
      throw new Error("Menu not found")
    }

    // Get recipes data
    const recipes = getRecipes(businessId)
    const recipesMap: Record<string, RecipeAnalyticsData> = {}

    recipes.forEach((recipe: Recipe) => {
      recipesMap[recipe.id] = {
        // BUG CORREGIDO: recipe.unitCost no existe en Recipe (types/recipe.ts) — siempre
        // era undefined, así que el costo de cada receta en el simulador de escenarios
        // quedaba en NaN/undefined en silencio. costPerServing es el campo real guardado.
        priceBase: recipe.unitPrice || 0,
        cost: recipe.costPerServing || 0,
        section: mapClassificationToSection(recipe.classification),
        estrella: false, // Could be extended with recipe metadata
      }
    })

    // Filter enabled items and prepare data for calculations
    const enabledItems = menu.items.filter((item) => item.enabled && recipesMap[item.recipeId])

    if (enabledItems.length === 0) {
      throw new Error("No enabled menu items found")
    }

    // Get mix weights
    const mix = inferMix({
      menu,
      recipes: recipesMap,
      method: params.mixMethod,
      categoryWeights: params.categoryWeights,
      upsellBebidas: params.upsellBebidas,
      salesHistoryByRecipe: params.salesHistoryByRecipe,
      inventoryDerivedPortions: params.inventoryDerivedPortions,
    })

    // Prepare arrays for calculations
    const itemsData = enabledItems.map((item) => ({
      price: getEffectivePrice(item, recipesMap),
      cost: recipesMap[item.recipeId].cost,
    }))

    const mixArray = enabledItems.map((item) => mix[item.recipeId] || 0)

    // Calculate KPIs
    const TP = computeTP(itemsData, mixArray)
    const CVp = computeCVp(itemsData, mixArray)
    const MC = TP - CVp
    const { PE_plates, PE_revenue } = computePE(CF, TP, CVp)
    const PVm_est = estimateCapacityPlates(params.capacity)

    // Check for overrides
    const hasOverrides = menu.items.some((item) => item.priceOverride !== null && item.priceOverride !== undefined)

    // Generate notes
    const notes = generateNotes(params, hasOverrides)

    const result: ScenarioResult = {
      businessId,
      menuId,
      timestamp: new Date().toISOString(),
      TP: Math.round(TP * 100) / 100,
      CVp: Math.round(CVp * 100) / 100,
      MC: Math.round(MC * 100) / 100,
      PE_plates: Math.round(PE_plates),
      PE_revenue: Math.round(PE_revenue),
      PVm_est: Math.round(PVm_est),
      confidence: getConfidenceLevel(params.mixMethod),
      notes,
      hasOverrides,
      params,
    }

    return result
  } catch (error) {
    console.error("Error calculating scenario:", error)
    return null
  }
}

// Utility function to check margin flags for UI
export function checkMarginFlags(menu: Menu, recipesMap: Record<string, RecipeAnalyticsData>): Record<string, boolean> {
  const flags: Record<string, boolean> = {}

  menu.items.forEach((item) => {
    if (item.enabled && recipesMap[item.recipeId]) {
      const price = getEffectivePrice(item, recipesMap)
      const cost = recipesMap[item.recipeId].cost
      flags[item.recipeId] = hasLowMargin(price, cost)
    }
  })

  return flags
}

// Generate recommendation text
export function generateRecommendation(result: ScenarioResult): string {
  const { TP, PE_plates, PE_revenue, PVm_est, MC } = result

  if (MC <= 0) {
    return "Margen negativo detectado. Revisa los precios y costos de tu menú."
  }

  if (!PVm_est || PVm_est <= 0) {
    return "Configura tu capacidad para obtener recomendaciones específicas."
  }

  const safetyMargin = Math.ceil(PE_plates * 1.2)
  const suggestedTP = computeTPmin(result.params.capacity.seats * 30, PVm_est, result.CVp) * 1.1

  if (PVm_est >= PE_plates) {
    if (PVm_est >= safetyMargin) {
      return `Excelente. Tu capacidad (${Math.round(PVm_est)} platos/mes) supera el punto de equilibrio (${PE_plates}). Tienes un margen de seguridad del ${Math.round(((PVm_est - PE_plates) / PE_plates) * 100)}%.`
    } else {
      return `Tu capacidad (${Math.round(PVm_est)} platos/mes) cubre el punto de equilibrio (${PE_plates}), pero considera aumentar el ticket a L${Math.round(suggestedTP)} para mayor seguridad.`
    }
  } else {
    return `Para cubrir costos necesitas ${PE_plates} platos/mes (L${Math.round(PE_revenue)}). Con tu capacidad actual (${Math.round(PVm_est)}) estás por debajo. Sube el ticket a L${Math.round(suggestedTP)} o aumenta el volumen.`
  }
}
