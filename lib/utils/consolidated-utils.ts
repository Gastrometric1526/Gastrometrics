/**
 * Consolidated Utilities - Common utility functions used across the application
 *
 * This module provides reusable utility functions to standardize common operations
 * and reduce code duplication.
 */

import type { RecipeIngredient } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { formatCurrency, formatPercentage } from "@/lib/currency"

// Re-exportado para no romper los imports existentes (`@/lib/utils/consolidated-utils`).
// La lógica real vive en lib/currency.ts, que sí respeta la moneda elegida en
// Configuración en vez de tener "HNL" fijo en el código.
export { formatCurrency, formatPercentage }

/**
 * Formats a date to a localized string
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  return dateObj.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Formats a number with the specified number of decimal places
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value === 0) return ""
  return value.toFixed(decimals)
}

/**
 * Calculates the total cost of an ingredient
 */
export function calculateIngredientCost(ingredient: RecipeIngredient): number {
  return ingredient.quantity * ingredient.costPerMeasure
}

/**
 * Calculates the total cost of all ingredients
 */
export function calculateTotalIngredientsCost(ingredients: RecipeIngredient[]): number {
  return ingredients.reduce((total, ingredient) => total + calculateIngredientCost(ingredient), 0)
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Groups an array of objects by a key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<string, T[]>,
  )
}

/**
 * Finds an ingredient in a list by ID
 */
export function findIngredientById(ingredients: Ingredient[], id: string): Ingredient | undefined {
  return ingredients.find((ingredient) => ingredient.id === id)
}

/**
 * Finds an ingredient in a list by name (case-insensitive)
 */
export function findIngredientByName(ingredients: Ingredient[], name: string): Ingredient | undefined {
  const lowercaseName = name.toLowerCase()
  return ingredients.find((ingredient) => ingredient.name.toLowerCase() === lowercaseName)
}

/**
 * Safely parses a JSON string
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    console.error("Error parsing JSON:", error)
    return fallback
  }
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: number | null = null

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout !== null) {
      clearTimeout(timeout)
    }

    timeout = window.setTimeout(later, wait)
  }
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: any[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
  let lastCall = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= limit) {
      lastCall = now
      func(...args)
    }
  }
}
