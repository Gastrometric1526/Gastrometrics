/**
 * CORE STORAGE SYSTEM - SINGLE SOURCE OF TRUTH
 * Centralized localStorage management for GastroMetrics
 * All data operations must go through this module
 */

export const STORAGE_KEYS = {
  RECIPES: "recipes",
  RECIPES_TRASH: "recipesTrash",
  INGREDIENTS: "ingredients",
  BUSINESSES: "businesses",
  INVENTORY: "inventory",
  INVENTORY_HISTORY: "inventoryHistory",
  PURCHASE_ORDERS: "purchaseOrders",
  MENUS: "menus",
  NOTIFICATIONS: "priceChangeNotifications",
  FEEDBACK: "feedback",
  SALES_IMPORTS: "salesImports",
  POS_COLUMN_MAPPING: "posColumnMapping",
  DISH_NAME_MAPPINGS: "dishNameMappings",
  TEAM_MEMBERS: "teamMembers",
  PRICING_DEFAULTS: "pricingDefaults",
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

const recentReads = new Map<string, { data: any; timestamp: number }>()
const READ_CACHE_TTL = 1000 // 1 segundo de cache para lecturas frecuentes

/**
 * Get data from localStorage with multi-key fallback strategy
 * Searches in order: business-prefixed, simple key, gastrometrics-prefixed
 */
export function getFromStorage<T>(key: StorageKey, businessId?: string | null): T | null {
  if (typeof window === "undefined") return null

  const cacheKey = businessId ? `${key}_${businessId}` : key
  const cached = recentReads.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < READ_CACHE_TTL) {
    return cached.data
  }

  // "main" (o sin businessId) es el workspace legado de antes de que existiera
  // multi-negocio — para ese caso sí tiene sentido caer a las llaves globales
  // (gastrometrics_${key} / ${key}), es la misma data de siempre. Para CUALQUIER
  // OTRO negocio, esas llaves globales NO le pertenecen — si un negocio nuevo
  // todavía no guardó nada propio, debe leer una lista vacía, no heredar por
  // accidente los datos de "main" (o de otro negocio) a través del fallback
  // global. Este era el bug real detrás de "inventario no aislado por negocio":
  // cualquier tipo de dato (no solo inventario) de un negocio recién creado caía
  // en cascada hasta esas llaves compartidas.
  const isMainOrDefault = !businessId || businessId === "main"
  const possibleKeys = isMainOrDefault
    ? [`${key}_main`, `business_main_${key}`, `gastrometrics_${key}`, key]
    : [`${key}_${businessId}`, `business_${businessId}_${key}`]

  for (const storageKey of possibleKeys) {
    try {
      const data = localStorage.getItem(storageKey)
      if (data) {
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed) ? parsed.length > 0 : parsed) {
          recentReads.set(cacheKey, { data: parsed, timestamp: Date.now() })
          return parsed
        }
      }
    } catch (error) {
      console.error(`[Storage] Error reading from key ${storageKey}:`, error)
    }
  }

  return null
}

/**
 * Save data to localStorage in ALL relevant keys for backwards compatibility
 * This ensures data is accessible from any entry point
 */
export function saveToStorage<T>(key: StorageKey, data: T, businessId?: string | null): void {
  if (typeof window === "undefined") return

  // Simétrico al fix de getFromStorage: solo "main" escribe también en las
  // llaves globales (gastrometrics_${key} / ${key}). Si cualquier OTRO negocio
  // escribiera ahí también, pisaría silenciosamente los datos de "main" (o de
  // cualquier negocio nuevo que todavía no tenga llaves propias y cayera en el
  // fallback global) la próxima vez que ese negocio guardara algo.
  const targetBusinessId = businessId || "main"
  const isMainOrDefault = targetBusinessId === "main"
  const keys = isMainOrDefault
    ? [`${key}_main`, `business_main_${key}`, `gastrometrics_${key}`, key]
    : [`${key}_${targetBusinessId}`, `business_${targetBusinessId}_${key}`]

  const cacheKey = businessId ? `${key}_${businessId}` : key
  recentReads.delete(cacheKey)

  const serializedData = JSON.stringify(data)

  let successCount = 0
  keys.forEach((storageKey) => {
    try {
      localStorage.setItem(storageKey, serializedData)
      successCount++
    } catch (error) {
      console.error(`[Storage] Error saving to key ${storageKey}:`, error)
    }
  })

  // Dispatch custom event for real-time updates
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(`${key}Updated`, {
        detail: { businessId: targetBusinessId, count: Array.isArray(data) ? data.length : 1, timestamp: Date.now() },
      }),
    )
  }
}

/**
 * Remove data from all possible storage keys
 */
export function removeFromStorage(key: StorageKey, businessId?: string | null): void {
  if (typeof window === "undefined") return

  // Mismo motivo que en saveToStorage: borrar datos de un negocio que NO es
  // "main" nunca debe tocar las llaves globales, o borraría también los datos
  // de "main" (o de cualquier otro negocio que dependa del fallback global).
  const targetBusinessId = businessId || "main"
  const isMainOrDefault = targetBusinessId === "main"
  const keys = isMainOrDefault
    ? [`${key}_main`, `business_main_${key}`, `gastrometrics_${key}`, key]
    : [`${key}_${targetBusinessId}`, `business_${targetBusinessId}_${key}`]

  const cacheKey = businessId ? `${key}_${businessId}` : key
  recentReads.delete(cacheKey)

  keys.forEach((storageKey) => {
    try {
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.error(`[Storage] Error removing key ${storageKey}:`, error)
    }
  })
}

/**
 * Clear all data for a specific business
 */
export function clearBusinessData(businessId: string): void {
  if (typeof window === "undefined") return

  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes(`_${businessId}`) || key.includes(`${businessId}_`))) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))

    for (const key of recentReads.keys()) {
      if (key.includes(businessId)) {
        recentReads.delete(key)
      }
    }

    console.log(`[Storage] Cleared all data for business ${businessId}`)
  } catch (error) {
    console.error(`[Storage] Error clearing business ${businessId}:`, error)
  }
}

export function clearReadCache(): void {
  recentReads.clear()
}
