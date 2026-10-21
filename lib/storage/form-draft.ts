/**
 * Borradores automáticos de formularios (docs/171) — mismo espíritu que el de la Ficha
 * Técnica (lib/storage/recipe-draft.ts, docs/131): si la persona se sale o cierra sin
 * guardar, al volver encuentra lo que llevaba. Pedido del dueño: "algo similar para
 * inventario, menús y órdenes de compra, al igual que al agregar un ingrediente nuevo".
 *
 * Solo en este navegador (localStorage): no se usa recipe_drafts del servidor porque el
 * cron de recordatorios lo lee como "receta a medias" y mandaría correos equivocados.
 * Uno por persona + negocio + tipo, y solo para registros NUEVOS (editar no genera borrador).
 *
 * Duración (desde el último cambio), elegida por cuánto sigue siendo útil lo escrito:
 * - ingrediente nuevo: 24 h (formulario corto, igual que la Ficha Técnica);
 * - registro de inventario: 3 días (un conteo se hace en varios turnos; más viejo ya no sirve);
 * - orden de compra: 3 días (se arma en días; después los precios y el stock cambian);
 * - menú: 7 días (se planean con anticipación para eventos).
 */

const HOUR = 60 * 60 * 1000

export const FORM_DRAFT_TTL_MS = {
  ingredient: 24 * HOUR,
  inventory: 72 * HOUR,
  purchaseOrder: 72 * HOUR,
  menu: 7 * 24 * HOUR,
} as const

export type FormDraftKind = keyof typeof FORM_DRAFT_TTL_MS

export interface FormDraft<T> {
  data: T
  savedAt: string
}

function key(kind: FormDraftKind, userId: string, businessId?: string | null): string {
  return `gm_form_draft:${kind}:${userId}:${businessId || "main"}`
}

export function isDraftFresh(kind: FormDraftKind, savedAt: string, now = Date.now()): boolean {
  const age = now - new Date(savedAt).getTime()
  return age >= 0 && age < FORM_DRAFT_TTL_MS[kind]
}

export function loadFormDraft<T>(kind: FormDraftKind, userId: string, businessId?: string | null): FormDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key(kind, userId, businessId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FormDraft<T>
    if (parsed?.savedAt && parsed.data !== undefined && isDraftFresh(kind, parsed.savedAt)) return parsed
    window.localStorage.removeItem(key(kind, userId, businessId))
  } catch {
    // localStorage bloqueado o JSON corrupto: sin borrador.
  }
  return null
}

export function saveFormDraft<T>(kind: FormDraftKind, userId: string, businessId: string | null | undefined, data: T): string {
  const savedAt = new Date().toISOString()
  try {
    window.localStorage.setItem(key(kind, userId, businessId), JSON.stringify({ data, savedAt }))
  } catch {
    // Sin espacio: se pierde solo el borrador, nunca lo ya guardado.
  }
  return savedAt
}

export function clearFormDraft(kind: FormDraftKind, userId: string, businessId?: string | null): void {
  try {
    window.localStorage.removeItem(key(kind, userId, businessId))
  } catch {
    // ignorado
  }
}
