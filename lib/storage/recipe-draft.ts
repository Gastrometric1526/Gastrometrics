/**
 * Borrador automático de la Ficha Técnica (receta NUEVA, sin guardar) — ver docs/131.
 * Si la persona se sale de /ficha-tecnica por cualquier motivo, al volver dentro de las
 * siguientes 24 horas (desde su último cambio) la receta se restaura sola.
 *
 * Dos copias, a propósito:
 *   - localStorage: instantánea, funciona sin red, y es la única que guarda la imagen
 *     (base64 — demasiado pesada para mandarla al servidor cada pocos segundos).
 *   - Supabase (recipe_drafts, migración 0032): permite seguir desde otro dispositivo, y
 *     le avisa al cron de recordatorios que hay una receta a medias
 *     (lib/services/notify-reengagement.ts → correo "tu receta X te espera").
 * Al cargar se usa la más reciente de las dos. Si 0032 no se corrió todavía, la copia
 * del servidor falla en silencio y todo sigue funcionando solo con localStorage.
 *
 * Una por persona + negocio: empezar una receta en el negocio A no pisa el borrador del
 * negocio B. Solo recetas nuevas — editar una receta ya guardada no genera borrador.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Recipe } from "@/types/recipe"
import type { PricingMethod } from "@/types/business"

export const RECIPE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

export interface RecipeDraftPricing {
  contributionMargin: number
  publicServices: number
  marketing: number
  operationalCosts: number
  laborCosts: number
  isv: number
  customUnitProfitInput: string
  customPriceInput: string
  paxModifier: number
  pricingMethod: PricingMethod
  targetFoodCostPercent: number
}

export interface RecipeDraft {
  recipe: Recipe
  pricing: RecipeDraftPricing
  savedAt: string
}

// Si la migración 0032 no se corrió, la tabla no existe: tras el primer error de ese
// tipo se deja de intentar durante la sesión (sin esto, un 404 cada 4 segundos).
let remoteUnavailable = false

function markIfMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (error && (error.code === "PGRST205" || error.code === "42P01")) {
    remoteUnavailable = true
    return true
  }
  return false
}

function businessKey(businessId?: string | null): string {
  return businessId || "main"
}

function storageKey(userId: string, businessId?: string | null): string {
  return `gm_recipe_draft:${userId}:${businessKey(businessId)}`
}

function isFresh(draft: RecipeDraft | null | undefined): draft is RecipeDraft {
  if (!draft?.savedAt || !draft.recipe) return false
  const age = Date.now() - new Date(draft.savedAt).getTime()
  return age >= 0 && age < RECIPE_DRAFT_TTL_MS
}

/** Hay algo que valga la pena recuperar (no guardamos formularios en blanco). */
export function isRecipeDraftMeaningful(recipe: Recipe): boolean {
  return (
    (recipe.name || "").trim() !== "" ||
    recipe.ingredients.some((ing) => !!ing.ingredientId) ||
    recipe.procedure.some((step) => step.trim() !== "") ||
    !!recipe.image
  )
}

function readLocal(userId: string, businessId?: string | null): RecipeDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, businessId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RecipeDraft
    if (isFresh(parsed)) return parsed
    window.localStorage.removeItem(storageKey(userId, businessId))
  } catch {
    // localStorage bloqueado o JSON corrupto — se trata como "sin borrador".
  }
  return null
}

export function saveRecipeDraftLocal(userId: string, businessId: string | null | undefined, draft: RecipeDraft): void {
  const key = storageKey(userId, businessId)
  try {
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Cuota llena (casi siempre por la imagen): reintenta sin imagen antes de rendirse.
    try {
      window.localStorage.setItem(key, JSON.stringify({ ...draft, recipe: { ...draft.recipe, image: undefined } }))
    } catch {
      // Sin espacio ni así — queda solo la copia del servidor.
    }
  }
}

export async function saveRecipeDraftRemote(userId: string, businessId: string | null | undefined, draft: RecipeDraft): Promise<void> {
  if (remoteUnavailable) return
  try {
    const supabase = getSupabaseBrowserClient()
    const { image: _image, ...recipeWithoutImage } = draft.recipe
    const { error } = await supabase.from("recipe_drafts").upsert({
      user_id: userId,
      business_key: businessKey(businessId),
      recipe_name: (draft.recipe.name || "").trim(),
      data: { recipe: recipeWithoutImage, pricing: draft.pricing } as unknown as Record<string, unknown>,
      updated_at: draft.savedAt,
    })
    if (error && !markIfMissingTable(error)) {
      console.warn("[recipe-draft] No se pudo guardar el borrador en el servidor:", error.message)
    }
  } catch {
    // Sin red — la copia local alcanza.
  }
}

async function readRemote(userId: string, businessId?: string | null): Promise<RecipeDraft | null> {
  if (remoteUnavailable) return null
  try {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("recipe_drafts")
      .select("data, updated_at")
      .eq("user_id", userId)
      .eq("business_key", businessKey(businessId))
      .maybeSingle()
    if (error) markIfMissingTable(error)
    if (error || !data) return null
    const payload = data.data as unknown as { recipe?: Recipe; pricing?: RecipeDraftPricing }
    if (!payload?.recipe || !payload.pricing) return null
    const draft: RecipeDraft = { recipe: payload.recipe, pricing: payload.pricing, savedAt: data.updated_at }
    return isFresh(draft) ? draft : null
  } catch {
    return null
  }
}

/** El borrador más reciente (local o servidor) de las últimas 24 h, o null. */
export async function loadRecipeDraft(userId: string, businessId?: string | null): Promise<RecipeDraft | null> {
  const local = readLocal(userId, businessId)
  const remote = await readRemote(userId, businessId)
  if (local && remote) {
    if (new Date(remote.savedAt).getTime() > new Date(local.savedAt).getTime()) {
      // El del servidor es más nuevo (se siguió en otro dispositivo) pero no trae la
      // imagen — se conserva la local si la hay.
      return { ...remote, recipe: { ...remote.recipe, image: remote.recipe.image ?? local.recipe.image } }
    }
    return local
  }
  return local ?? remote
}

/** Borra ambas copias (al guardar la receta de verdad, o con "Limpiar ficha"). */
export async function clearRecipeDraft(userId: string, businessId?: string | null): Promise<void> {
  try {
    window.localStorage.removeItem(storageKey(userId, businessId))
  } catch {
    // ignorado
  }
  if (remoteUnavailable) return
  try {
    const supabase = getSupabaseBrowserClient()
    await supabase.from("recipe_drafts").delete().eq("user_id", userId).eq("business_key", businessKey(businessId))
  } catch {
    // ignorado — el cron borra borradores viejos de todas formas
  }
}
