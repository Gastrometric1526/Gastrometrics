/**
 * Business-specific storage operations — migrado a Supabase real (ver docs/52).
 *
 * getAllBusinesses() sigue siendo síncrona (lee de una caché en memoria, ver
 * lib/storage/supabase-cache.ts) para no obligar a reescribir cada pantalla que la
 * llama dentro de un useMemo — devuelve [] hasta que la primera carga real desde
 * Supabase resuelve. contexts/auth-context.tsx dispara esa carga apenas hay sesión
 * (ver refreshBusinesses ahí), así que en la práctica ya está poblada para cuando el
 * usuario llega a cualquier pantalla del dashboard.
 *
 * localStorage["businesses"] se sigue escribiendo como espejo de lectura — hay
 * bastantes archivos (dashboard, sidebar, hooks/use-business.ts, etc.) que todavía
 * parsean esa clave directo sin pasar por este módulo; mantenerla sincronizada evita
 * tener que tocar los 13 archivos de una vez. La fuente de verdad real es Supabase:
 * toda escritura (addBusiness/updateBusiness/deleteBusiness) va a la base de datos
 * primero, y el espejo en localStorage se actualiza después, nunca al revés.
 */

import type { Business, PricingMethod } from "@/types/business"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"]

const cache = createBusinessScopedCache<Business>()
const CACHE_KEY = "__all_businesses__"

function rowToBusiness(row: BusinessRow): Business {
  return {
    ...(row.data as Partial<Business>),
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  } as Business
}

function mirrorToLocalStorage(businesses: Business[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem("businesses", JSON.stringify(businesses))
  } catch (error) {
    console.error("[Businesses] Error espejando a localStorage:", error)
  }
}

async function fetchAllBusinesses(): Promise<Business[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from("businesses").select("*").order("created_at", { ascending: true })
  if (error) {
    console.error("[Businesses] Error cargando negocios:", error)
    return []
  }
  const businesses = (data ?? []).map(rowToBusiness)
  mirrorToLocalStorage(businesses)
  return businesses
}

/** Dispara (o refresca) la carga real desde Supabase — llamado desde auth-context.tsx. */
export function refreshBusinesses(): Promise<void> {
  cache.invalidate(CACHE_KEY)
  return cache.ensureLoaded(CACHE_KEY, fetchAllBusinesses)
}

/** Hook reactivo — usar en vez de getAllBusinesses() dentro de useMemo en componentes. */
export function useAllBusinesses(): Business[] {
  return cache.useCached(CACHE_KEY, fetchAllBusinesses)
}

/**
 * Get all businesses (síncrono — lee la caché en memoria, ver el comentario de
 * cabecera de este archivo).
 */
export function getAllBusinesses(): Business[] {
  return cache.getSnapshot(CACHE_KEY)
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
export async function addBusiness(business: Business): Promise<Business> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión para crear un negocio.")

  const { id, name, createdAt, ...rest } = business
  const { error } = await supabase.from("businesses").insert({
    id,
    owner_id: user.id,
    name,
    created_at: createdAt || new Date().toISOString(),
    data: rest,
  })
  if (error) throw error

  cache.mutateSnapshot(CACHE_KEY, (list) => {
    const next = [...list, business]
    mirrorToLocalStorage(next)
    return next
  })
  return business
}

/**
 * Update an existing business
 */
export async function updateBusiness(businessId: string, updates: Partial<Business>): Promise<boolean> {
  const current = getBusinessById(businessId)
  if (!current) return false

  const merged: Business = { ...current, ...updates }
  const supabase = getSupabaseBrowserClient()
  const { id, name, createdAt, ...rest } = merged
  const { error } = await supabase.from("businesses").update({ name, data: rest }).eq("id", businessId)
  if (error) {
    console.error("[Businesses] Error actualizando negocio:", error)
    return false
  }

  cache.mutateSnapshot(CACHE_KEY, (list) => {
    const next = list.map((b) => (b.id === businessId ? merged : b))
    mirrorToLocalStorage(next)
    return next
  })
  return true
}

/**
 * Delete a business
 */
export async function deleteBusiness(businessId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("businesses").delete().eq("id", businessId)
  if (error) {
    console.error("[Businesses] Error eliminando negocio:", error)
    return false
  }

  cache.mutateSnapshot(CACHE_KEY, (list) => {
    const next = list.filter((b) => b.id !== businessId)
    mirrorToLocalStorage(next)
    return next
  })
  return true
}

export interface PricingDefaults {
  pricingMethod?: PricingMethod
  targetFoodCostPercent?: number
}

/**
 * "main" (el workspace por defecto) NUNCA existe como fila real en Supabase — guarda
 * el método de costeo por defecto en localStorage, scoped por businessId, igual que
 * antes de esta migración. Es la única pieza de este módulo que sigue en localStorage
 * a propósito: es una preferencia de UI de bajo riesgo, no dato de negocio real, y
 * "main" no tiene dónde más guardarla del lado de Supabase sin inventar una fila falsa.
 */
export function getPricingDefaults(businessId: string): PricingDefaults | null {
  return getFromStorage<PricingDefaults>(STORAGE_KEYS.PRICING_DEFAULTS, businessId)
}

function savePricingDefaults(businessId: string, defaults: PricingDefaults): void {
  const current = getPricingDefaults(businessId) || {}
  saveToStorage(STORAGE_KEYS.PRICING_DEFAULTS, { ...current, ...defaults }, businessId)
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
export async function setEffectivePricingDefaults(businessId: string, defaults: PricingDefaults): Promise<void> {
  const updated = await updateBusiness(businessId, defaults)
  if (!updated) {
    savePricingDefaults(businessId, defaults)
  }
}
