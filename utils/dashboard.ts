/**
 * @deprecated This file is deprecated. Use @/lib/storage instead.
 * This file is kept for backward compatibility only.
 */

const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

export function getDashboardData<T>(key: string, businessId?: string): T | null {
  // "main" (o sin businessId) es el workspace legado de antes de multi-negocio —
  // solo ahí tiene sentido caer a las llaves globales (gastrometrics_${key} /
  // ${key}). Cualquier OTRO negocio que todavía no tenga sus propias llaves debe
  // leer null, no heredar por accidente los datos de "main" a través del
  // fallback global — este es el mismo bug ya corregido en lib/storage/core.ts,
  // pero este archivo (deprecated, ver arriba) es un sistema de storage paralelo
  // e independiente que hooks como useBusinessIngredients todavía usa.
  const isMainOrDefault = !businessId || businessId === "main"
  const possibleKeys = isMainOrDefault
    ? [`${STORAGE_PREFIX}${key}`, key]
    : [`${BUSINESS_PREFIX}${businessId}_${key}`, `${key}_${businessId}`]

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
  // Simétrico a getDashboardData: solo "main" escribe en las llaves globales.
  const isMainOrDefault = !businessId || businessId === "main"
  const keys = isMainOrDefault
    ? [`${STORAGE_PREFIX}${key}`, key]
    : [`${BUSINESS_PREFIX}${businessId}_${key}`, `${key}_${businessId}`]

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

export function clearBusinessData(businessId: string): void {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(`${BUSINESS_PREFIX}${businessId}_`) || key.includes(businessId)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error(`Error clearing data for business ${businessId}:`, error)
  }
}

export function ensureEmptyBusinessDashboard(businessId: string): void {
  const ingredients = getDashboardData("ingredients", businessId)
  const recipes = getDashboardData("recipes", businessId)

  if (!ingredients) setDashboardData("ingredients", [], businessId)
  if (!recipes) setDashboardData("recipes", [], businessId)
}
