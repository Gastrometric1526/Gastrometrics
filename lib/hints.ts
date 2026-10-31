/**
 * Pistas por acción (pedido del dueño, docs/219): en vez de un recorrido completo al entrar,
 * la app enseña cada cosa en el momento en que la persona la usa por primera vez (agregar el
 * primer ingrediente a una ficha, guardar la receta, tener 3 ingredientes, abrir un panel…).
 *
 * - Cada pista sale UNA vez (marca `gm_hint_<id>` en localStorage).
 * - «No mostrar más pistas» las apaga todas (`gm_hints_off`).
 * - «Reiniciar tutorial» del menú lateral las vuelve a encender y las borra.
 * Lo visual vive en components/action-hint.tsx (sobre components/page-tour.tsx).
 */

export const HINT_PREFIX = "gm_hint_"
export const HINTS_OFF_KEY = "gm_hints_off"

/** Ids de todas las pistas (para probarlas y para el manual). */
export const HINT_IDS = [
  "ficha-first-ingredient",
  "ficha-price",
  "ficha-pax",
  "recipes-saved",
  "recipes-panel",
  "ingredients-merma",
  "ingredients-panel",
  "inventory-theoretical",
  "inventory-panel",
  "menus-first",
  "menus-panel",
  "orders-receive",
  "orders-panel",
  "sales-cashup",
  "sales-panel",
  "invoices-panel",
  "businesses-panel",
] as const
export type HintId = (typeof HINT_IDS)[number]

export const hintStorageKey = (id: string) => `${HINT_PREFIX}${id}`

/** ¿Se puede mostrar? Pura (probada en hints.test.ts). */
export function shouldShowHint(state: { seen: boolean; off: boolean; condition: boolean }): boolean {
  return state.condition && !state.seen && !state.off
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function hintsOff(): boolean {
  return storage()?.getItem(HINTS_OFF_KEY) === "1"
}

export function hintSeen(id: string): boolean {
  return storage()?.getItem(hintStorageKey(id)) === "true"
}

export function turnOffHints(): void {
  storage()?.setItem(HINTS_OFF_KEY, "1")
}

/** Vuelve a encender las pistas y olvida cuáles se vieron («Reiniciar tutorial»). */
export function resetHints(): void {
  const s = storage()
  if (!s) return
  const keys: string[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k && k.startsWith(HINT_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => s.removeItem(k))
  s.removeItem(HINTS_OFF_KEY)
}
