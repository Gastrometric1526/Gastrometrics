/**
 * @deprecated This file is deprecated. Import directly from @/lib/storage instead.
 * This file is kept for backward compatibility only.
 */

import type { Recipe } from "@/types/recipe"

// Storage prefixes
const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

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

