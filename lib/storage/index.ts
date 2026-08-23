/**
 * Centralized Storage Management System for GastroMetrics
 * Single source of truth for all localStorage operations
 * Provides type-safe, validated, and event-driven data management
 */

import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { getFromStorage, saveToStorage } from "./core"

// Storage prefixes for different data scopes
const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

// Supported data types
export type DataKey =
  | "recipes"
  | "ingredients"
  | "businesses"
  | "purchaseOrders"
  | "inventory"
  | "inventoryHistory"
  | "pricingDefaults"

// Event types for real-time updates
export type StorageEventType = "created" | "updated" | "deleted" | "migrated"

/**
 * Get data from localStorage with multiple fallback keys
 * Searches in order: business-specific, prefixed, simple key
 */
export function getStorageData<T>(key: DataKey, businessId?: string | null): T | null {
  try {
    const keys = businessId
      ? [
          `${BUSINESS_PREFIX}${businessId}_${key}`, // business_main_recipes
          `${key}_${businessId}`, // recipes_main
          `${STORAGE_PREFIX}${key}`, // gastrometrics_recipes
          key, // recipes
        ]
      : [
          `${STORAGE_PREFIX}${key}`, // gastrometrics_recipes
          key, // recipes
        ]

    for (const storageKey of keys) {
      const data = localStorage.getItem(storageKey)
      if (data) {
        try {
          return JSON.parse(data) as T
        } catch {
          console.warn(`Failed to parse data from key: ${storageKey}`)
        }
      }
    }

    return null
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error)
    return null
  }
}

/**
 * Set data in localStorage with multiple keys for compatibility
 * Saves to both business-specific and simple keys
 */
export function setStorageData<T>(key: DataKey, data: T, businessId?: string | null): void {
  try {
    const jsonData = JSON.stringify(data)

    if (businessId) {
      // Save to multiple keys for compatibility
      localStorage.setItem(`${BUSINESS_PREFIX}${businessId}_${key}`, jsonData)
      localStorage.setItem(`${key}_${businessId}`, jsonData)
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, jsonData)
      localStorage.setItem(key, jsonData)
    }

    // Dispatch update event for real-time synchronization
    dispatchStorageEvent(key, "updated", businessId, data)
  } catch (error) {
    console.error(`Error setting ${key} in storage:`, error)
  }
}

/**
 * Remove data from localStorage
 */
export function removeStorageData(key: DataKey, businessId?: string | null): void {
  try {
    if (businessId) {
      localStorage.removeItem(`${BUSINESS_PREFIX}${businessId}_${key}`)
      localStorage.removeItem(`${key}_${businessId}`)
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
      localStorage.removeItem(key)
    }

    dispatchStorageEvent(key, "deleted", businessId)
  } catch (error) {
    console.error(`Error removing ${key} from storage:`, error)
  }
}

/**
 * Clear all data for a specific business
 */
export function clearBusinessData(businessId: string): void {
  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes(`_${businessId}_`) || key.includes(`_${businessId}`))) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))

    console.log(`✅ Cleared all data for business ${businessId}`)
  } catch (error) {
    console.error(`Error clearing business data for ${businessId}:`, error)
  }
}

/**
 * Dispatch custom storage event for real-time updates
 */
function dispatchStorageEvent<T>(
  key: DataKey,
  eventType: StorageEventType,
  businessId?: string | null,
  data?: T,
): void {
  if (typeof window === "undefined") return

  const eventName = `${key}Updated`
  const detail = {
    key,
    eventType,
    businessId: businessId || null,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    timestamp: Date.now(),
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }))
  window.dispatchEvent(new CustomEvent("storageUpdated", { detail }))
}

/**
 * Ensure empty dashboard for a business
 */
export function ensureEmptyBusinessDashboard(businessId: string): void {
  const ingredients = getStorageData<Ingredient[]>("ingredients", businessId)
  const recipes = getStorageData<Recipe[]>("recipes", businessId)
  const purchaseOrders = getStorageData<any[]>("purchaseOrders", businessId)

  if (!ingredients) setStorageData("ingredients", [], businessId)
  if (!recipes) setStorageData("recipes", [], businessId)
  if (!purchaseOrders) setStorageData("purchaseOrders", [], businessId)
}

// Alias functions for backward compatibility
export const getDashboardData = getFromStorage
export const setDashboardData = saveToStorage
export const getBusinessRecipes = (businessId: string) => {
  const { getRecipes } = require("./recipes")
  return getRecipes(businessId)
}
export const saveBusinessRecipes = (businessId: string, recipes: any[]) => {
  const { saveRecipes } = require("./recipes")
  return saveRecipes(recipes, businessId)
}
export const getBusinessIngredients = (businessId: string) => {
  const { getIngredients } = require("./ingredients")
  return getIngredients(businessId)
}
export const saveBusinessIngredients = (businessId: string, ingredients: any[]) => {
  const { saveIngredients } = require("./ingredients")
  return saveIngredients(ingredients, businessId)
}

// Re-export everything from core and specialized modules
export * from "./core"
export * from "./recipes"
export * from "./ingredients"
export * from "./businesses"
