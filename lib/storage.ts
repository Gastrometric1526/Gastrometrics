/**
 * Centralized Storage Management System
 * Single source of truth for all localStorage operations
 */

import type { Recipe } from "@/types/recipe"
import type { Business } from "@/types/business"

// Storage prefixes
const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

// Type definitions
export type DataType = "recipes" | "ingredients" | "businesses" | "orders" | "inventory" | "purchaseOrders"

/**
 * Core Storage Functions
 */

export function getStorageData<T>(key: string, businessId?: string): T | null {
  try {
    const storageKey = businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : `${STORAGE_PREFIX}${key}`
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error("Error getting data from storage:", error)
    return null
  }
}

export function setStorageData<T>(key: string, data: T, businessId?: string): void {
  try {
    const storageKey = businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : `${STORAGE_PREFIX}${key}`
    localStorage.setItem(storageKey, JSON.stringify(data))
  } catch (error) {
    console.error("Error setting data in storage:", error)
  }
}

export function removeStorageData(key: string, businessId?: string): void {
  try {
    const storageKey = businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : `${STORAGE_PREFIX}${key}`
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.error("Error removing data from storage:", error)
  }
}

/**
 * Dashboard Data Functions (Backward Compatibility)
 */

export function getDashboardData<T>(key: string, businessId?: string): T | null {
  const possibleKeys = [
    businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : null,
    businessId ? `${key}_${businessId}` : null,
    `${STORAGE_PREFIX}${key}`,
    key, // Simple key without prefix
  ].filter(Boolean) as string[]

  for (const storageKey of possibleKeys) {
    try {
      const data = localStorage.getItem(storageKey)
      if (data) {
        return JSON.parse(data)
      }
    } catch (error) {
      console.error(`Error reading from key ${storageKey}:`, error)
    }
  }

  return null
}

export function setDashboardData<T>(key: string, data: T, businessId?: string): void {
  const keys = [
    businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : `${STORAGE_PREFIX}${key}`,
    businessId ? `${key}_${businessId}` : key,
  ]

  keys.forEach((storageKey) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (error) {
      console.error(`Error saving to key ${storageKey}:`, error)
    }
  })

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("dashboardDataUpdated", {
        detail: { key, businessId, dataType: typeof data, itemCount: Array.isArray(data) ? data.length : 1 },
      }),
    )
  }
}

/**
 * Business Management Functions
 */

export function clearBusinessData(businessId: string): void {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(`${BUSINESS_PREFIX}${businessId}_`) || key.includes(businessId)) {
        localStorage.removeItem(key)
      }
    })
    console.log(`✅ Cleared all data for business ${businessId}`)
  } catch (error) {
    console.error(`❌ Error clearing data for business ${businessId}:`, error)
  }
}

export function ensureEmptyBusinessDashboard(businessId: string): void {
  const ingredients = getStorageData("ingredients", businessId)
  const recipes = getStorageData("recipes", businessId)

  if (!ingredients) setStorageData("ingredients", [], businessId)
  if (!recipes) setStorageData("recipes", [], businessId)
}

/**
 * Recipe Management Functions
 */

export function getBusinessRecipes(businessId: string): Recipe[] {
  try {
    const possibleKeys = [
      `recipes_${businessId}`,
      `${BUSINESS_PREFIX}${businessId}_recipes`,
      `${STORAGE_PREFIX}recipes`,
      "recipes",
    ]

    for (const key of possibleKeys) {
      const data = localStorage.getItem(key)
      if (data) {
        const recipes = JSON.parse(data)
        if (Array.isArray(recipes) && recipes.length > 0) {
          return recipes
        }
      }
    }

    return []
  } catch (error) {
    console.error("Error loading business recipes:", error)
    return []
  }
}

export function saveBusinessRecipes(businessId: string, recipes: Recipe[]): void {
  try {
    const keys = [
      `recipes_${businessId}`,
      `${BUSINESS_PREFIX}${businessId}_recipes`,
      `${STORAGE_PREFIX}recipes`,
      "recipes",
    ]

    keys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify(recipes))
    })

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: { businessId, count: recipes.length },
        }),
      )
    }
  } catch (error) {
    console.error("Error saving business recipes:", error)
  }
}

/**
 * Ingredient Management Functions
 */

export function getBusinessIngredients(businessId: string): any[] {
  try {
    const possibleKeys = [
      `ingredients_${businessId}`,
      `${BUSINESS_PREFIX}${businessId}_ingredients`,
      `${STORAGE_PREFIX}ingredients`,
      "ingredients",
    ]

    for (const key of possibleKeys) {
      const data = localStorage.getItem(key)
      if (data) {
        const ingredients = JSON.parse(data)
        if (Array.isArray(ingredients) && ingredients.length > 0) {
          return ingredients
        }
      }
    }

    return []
  } catch (error) {
    console.error("Error loading business ingredients:", error)
    return []
  }
}

export function saveBusinessIngredients(businessId: string, ingredients: any[]): void {
  try {
    const keys = [
      `ingredients_${businessId}`,
      `${BUSINESS_PREFIX}${businessId}_ingredients`,
      `${STORAGE_PREFIX}ingredients`,
      "ingredients",
    ]

    keys.forEach((key) => {
      localStorage.setItem(key, JSON.stringify(ingredients))
    })

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: { businessId, count: ingredients.length },
        }),
      )
    }
  } catch (error) {
    console.error("Error saving business ingredients:", error)
  }
}

/**
 * Purchase Order Management Functions
 */

export function getBusinessPurchaseOrders(businessId: string): any[] {
  try {
    const { getFromStorage, STORAGE_KEYS } = require("./storage/core")
    return getFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, businessId) || []
  } catch (error) {
    console.error("Error loading business purchase orders:", error)
    return []
  }
}

export function saveBusinessPurchaseOrders(businessId: string, orders: any[]): void {
  try {
    const { saveToStorage, STORAGE_KEYS } = require("./storage/core")
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, orders, businessId)
  } catch (error) {
    console.error("Error saving business purchase orders:", error)
  }
}

/**
 * Migration Functions
 */

export function migrateRecipes(recipes: any[], sourceBusinessId: string | null, targetBusinessId: string | null): void {
  try {
    const sourceKey = sourceBusinessId ? `${BUSINESS_PREFIX}${sourceBusinessId}_recipes` : `${STORAGE_PREFIX}recipes`
    const targetKey = targetBusinessId ? `${BUSINESS_PREFIX}${targetBusinessId}_recipes` : `${STORAGE_PREFIX}recipes`

    const sourceRecipes = JSON.parse(localStorage.getItem(sourceKey) || "[]")
    const targetRecipes = JSON.parse(localStorage.getItem(targetKey) || "[]")

    const updatedSourceRecipes = sourceRecipes.filter((r: any) => !recipes.some((recipe) => recipe.id === r.id))
    const updatedTargetRecipes = [...targetRecipes, ...recipes]

    localStorage.setItem(sourceKey, JSON.stringify(updatedSourceRecipes))
    localStorage.setItem(targetKey, JSON.stringify(updatedTargetRecipes))
  } catch (error) {
    console.error("Error migrating recipes:", error)
  }
}

/**
 * Utility Functions
 */

export function getStorageStats(): {
  totalBusinesses: number
  totalRecipes: number
  totalIngredients: number
  totalPurchaseOrders: number
  storageUsed: string
} {
  try {
    const businesses: Business[] = JSON.parse(localStorage.getItem("businesses") || "[]")
    let totalRecipes = 0
    let totalIngredients = 0
    let totalPurchaseOrders = 0

    businesses.forEach((business) => {
      totalRecipes += getBusinessRecipes(business.id).length
      totalIngredients += getBusinessIngredients(business.id).length
      totalPurchaseOrders += getBusinessPurchaseOrders(business.id).length
    })

    let storageSize = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        storageSize += localStorage[key].length + key.length
      }
    }

    const storageMB = (storageSize / (1024 * 1024)).toFixed(2)

    return {
      totalBusinesses: businesses.length,
      totalRecipes,
      totalIngredients,
      totalPurchaseOrders,
      storageUsed: `${storageMB} MB`,
    }
  } catch (error) {
    console.error("Error calculating storage stats:", error)
    return {
      totalBusinesses: 0,
      totalRecipes: 0,
      totalIngredients: 0,
      totalPurchaseOrders: 0,
      storageUsed: "0 MB",
    }
  }
}

export function exportAllData(): string {
  try {
    const allData: { [key: string]: any } = {}

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        try {
          allData[key] = JSON.parse(localStorage[key])
        } catch {
          allData[key] = localStorage[key]
        }
      }
    }

    return JSON.stringify(allData, null, 2)
  } catch (error) {
    console.error("Error exporting data:", error)
    return "{}"
  }
}

export function importAllData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData)

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        localStorage.setItem(key, typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]))
      }
    }

    return true
  } catch (error) {
    console.error("Error importing data:", error)
    return false
  }
}
