/**
 * Business-specific storage operations
 */

import type { Business, PricingMethod } from "@/types/business"
import { getStorageData, setStorageData } from "./index"

/**
 * Get all businesses
 */
export function getAllBusinesses(): Business[] {
  return getStorageData<Business[]>("businesses") || []
}

/**
 * Save all businesses
 */
export function saveAllBusinesses(businesses: Business[]): void {
  setStorageData("businesses", businesses)
}

/**
 * Get a single business by ID
 */
export function getBusinessById(businessId: string): Business | null {
  const businesses = getAllBusinesses()
  return businesses.find((b) => b.id === businessId) || null
}

/**
 * Add a new business
 */
export function addBusiness(business: Business): void {
  const businesses = getAllBusinesses()
  businesses.push(business)
  saveAllBusinesses(businesses)
}

/**
 * Update an existing business
 */
export function updateBusiness(businessId: string, updates: Partial<Business>): boolean {
  const businesses = getAllBusinesses()
  const index = businesses.findIndex((b) => b.id === businessId)

  if (index === -1) return false

  businesses[index] = { ...businesses[index], ...updates }
  saveAllBusinesses(businesses)
  return true
}

/**
 * Delete a business
 */
export function deleteBusiness(businessId: string): boolean {
  const businesses = getAllBusinesses()
  const filtered = businesses.filter((b) => b.id !== businessId)

  if (filtered.length === businesses.length) return false

  saveAllBusinesses(filtered)
  return true
}

export interface PricingDefaults {
  pricingMethod?: PricingMethod
  targetFoodCostPercent?: number
}

/**
 * "main" (el workspace por defecto) NUNCA existe como fila en getAllBusinesses() —
 * solo los negocios creados desde /negocios (AddBusinessDialog) tienen una fila real
 * ahí. updateBusiness("main", ...) por lo tanto no hacía nada (index === -1, return
 * false) y cualquier default guardado ahí se perdía en silencio para el caso más común
 * (un usuario que nunca creó un negocio adicional). Estas dos funciones guardan el
 * método de costeo por defecto en su propia clave de storage, scoped por businessId
 * igual que ingredientes/recetas, para que funcione también con "main".
 */
export function getPricingDefaults(businessId: string): PricingDefaults | null {
  return getStorageData<PricingDefaults>("pricingDefaults", businessId)
}

function savePricingDefaults(businessId: string, defaults: PricingDefaults): void {
  const current = getPricingDefaults(businessId) || {}
  setStorageData("pricingDefaults", { ...current, ...defaults }, businessId)
}

/**
 * Lee el método de costeo por defecto de un negocio con el fallback correcto: si existe
 * una fila real de Business (creada vía /negocios) con pricingMethod definido, esa manda
 * — así se respeta lo elegido en el asistente de creación de negocio. Si no, cae a la
 * clave dedicada de arriba (cubre "main" y cualquier negocio sin ese campo aún).
 */
export function getEffectivePricingDefaults(businessId: string): PricingDefaults {
  const business = getBusinessById(businessId)
  if (business?.pricingMethod) {
    return { pricingMethod: business.pricingMethod, targetFoodCostPercent: business.targetFoodCostPercent }
  }
  return getPricingDefaults(businessId) || {}
}

/**
 * Guarda el método de costeo por defecto de un negocio, sea "main" o uno real. Intenta
 * primero actualizar la fila real del negocio (mantiene todo consistente con lo que ve
 * /negocios); si no existe esa fila, usa la clave dedicada en su lugar.
 */
export function setEffectivePricingDefaults(businessId: string, defaults: PricingDefaults): void {
  const updated = updateBusiness(businessId, defaults)
  if (!updated) {
    savePricingDefaults(businessId, defaults)
  }
}
