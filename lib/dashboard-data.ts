/**
 * @deprecated This file is deprecated. Use @/lib/storage instead.
 * This file is kept for backward compatibility only.
 */

const STORAGE_PREFIX = "gastrometrics_"
const BUSINESS_PREFIX = "business_"

export function getDashboardData<T>(key: string, businessId?: string): T | null {
  const possibleKeys = [
    businessId ? `${BUSINESS_PREFIX}${businessId}_${key}` : null,
    businessId ? `${key}_${businessId}` : null,
    `${STORAGE_PREFIX}${key}`,
    key,
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
