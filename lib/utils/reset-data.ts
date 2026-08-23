/**
 * Utility to reset all application data to initial state
 * Used for testing and development purposes
 */

export interface ResetOptions {
  keepTheme?: boolean
  keepSettings?: boolean
  keepAuth?: boolean
}

/**
 * Get all localStorage keys that contain user data
 */
export function getAllDataKeys(): string[] {
  const keys: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      keys.push(key)
    }
  }

  return keys
}

/**
 * Reset all application data to initial state
 */
export function resetAllData(options: ResetOptions = {}): void {
  const { keepTheme = false, keepSettings = false, keepAuth = false } = options

  // Save data that should be preserved
  const preservedData: Record<string, string | null> = {}

  if (keepTheme) {
    preservedData["tema"] = localStorage.getItem("tema")
    preservedData["theme"] = localStorage.getItem("theme")
  }

  if (keepSettings) {
    preservedData["user_settings"] = localStorage.getItem("user_settings")
    preservedData["currency_symbol"] = localStorage.getItem("currency_symbol")
    preservedData["sidebar-collapsed"] = localStorage.getItem("sidebar-collapsed")
  }

  if (keepAuth) {
    preservedData["isLoggedIn"] = localStorage.getItem("isLoggedIn")
    preservedData["userData"] = localStorage.getItem("userData")
    preservedData["userProfile"] = localStorage.getItem("userProfile")
    preservedData["username"] = localStorage.getItem("username")
    preservedData["email"] = localStorage.getItem("email")
  }

  const allKeys = getAllDataKeys()
  allKeys.forEach((key) => {
    if (key.includes("user_activity") || key.includes("system_alerts")) {
      preservedData[key] = localStorage.getItem(key)
    }
  })

  // Clear all localStorage
  localStorage.clear()

  // Restore preserved data
  Object.entries(preservedData).forEach(([key, value]) => {
    if (value !== null) {
      localStorage.setItem(key, value)
    }
  })

  window.dispatchEvent(new Event("dataReset"))
  window.dispatchEvent(new Event("businessesUpdated"))
  window.dispatchEvent(new Event("recipesUpdated"))
  window.dispatchEvent(new Event("ingredientsUpdated"))

  logDevToolAction("Datos de aplicación restablecidos", {
    keepTheme,
    keepSettings,
    keepAuth,
  })
}

/**
 * Get summary of current data in localStorage
 */
export function getDataSummary(): {
  totalKeys: number
  businesses: number
  recipes: number
  ingredients: number
  purchaseOrders: number
  menus: number
  scenarios: number
  inventory: number
  activities: number
  alerts: number
} {
  if (typeof window === "undefined") {
    return {
      totalKeys: 0,
      businesses: 0,
      recipes: 0,
      ingredients: 0,
      purchaseOrders: 0,
      menus: 0,
      scenarios: 0,
      inventory: 0,
      activities: 0,
      alerts: 0,
    }
  }

  const businesses = JSON.parse(localStorage.getItem("businesses") || "[]")
  const recipes = JSON.parse(localStorage.getItem("recipes") || "[]")
  const ingredients = JSON.parse(localStorage.getItem("ingredients") || "[]")
  const inventory = JSON.parse(localStorage.getItem("inventory") || "[]")
  const activities = JSON.parse(localStorage.getItem("activities") || "[]")
  const alerts = JSON.parse(localStorage.getItem("alerts") || "[]")

  // Count business-specific data
  let totalRecipes = recipes.length
  let totalIngredients = ingredients.length
  let totalPurchaseOrders = 0
  let totalMenus = 0
  let totalScenarios = 0

  businesses.forEach((business: any) => {
    const businessRecipes = JSON.parse(localStorage.getItem(`recipes_${business.id}`) || "[]")
    const businessIngredients = JSON.parse(localStorage.getItem(`ingredients_${business.id}`) || "[]")
    const businessOrders = JSON.parse(localStorage.getItem(`purchaseOrders_${business.id}`) || "[]")
    const businessMenus = JSON.parse(localStorage.getItem(`menus_${business.id}`) || "[]")
    const businessScenarios = JSON.parse(localStorage.getItem(`scenarios_${business.id}`) || "[]")

    totalRecipes += businessRecipes.length
    totalIngredients += businessIngredients.length
    totalPurchaseOrders += businessOrders.length
    totalMenus += businessMenus.length
    totalScenarios += businessScenarios.length
  })

  return {
    totalKeys: localStorage.length,
    businesses: businesses.length,
    recipes: totalRecipes,
    ingredients: totalIngredients,
    purchaseOrders: totalPurchaseOrders,
    menus: totalMenus,
    scenarios: totalScenarios,
    inventory: inventory.length,
    activities: activities.length,
    alerts: alerts.length,
  }
}

/**
 * Export all data as JSON for backup
 */
export function exportAllData(): string {
  const data: Record<string, any> = {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) || "")
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Import data from JSON backup
 */
export function importAllData(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData)

    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
    })
  } catch (error) {
    console.error("Error importing data:", error)
    throw new Error("Invalid JSON data")
  }
}

/**
 * Log dev tools actions to activity tracker
 */
export function logDevToolAction(action: string, details?: any): void {
  // Import ActivityTracker dynamically to avoid circular dependencies
  if (typeof window !== "undefined" && (window as any).ActivityTracker) {
    const ActivityTracker = (window as any).ActivityTracker

    // Log as a special "business" type activity for dev tools
    ActivityTracker.addActivity(action, "business", undefined, {
      ...details,
      source: "dev-tools",
      timestamp: new Date().toISOString(),
    })

    // Also create an alert for important actions
    if (action.includes("Reset") || action.includes("Import")) {
      ActivityTracker.addAlert(
        action.includes("Reset") ? "warning" : "info",
        "Herramientas de Desarrollo",
        action,
        undefined,
      )
    }
  }
}
