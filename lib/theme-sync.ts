/**
 * Color y modo claro/oscuro que viajan con la cuenta (docs/309). Pedido del dueño: «que el
 * sistema recuerde en qué color estaba, ya sea en computadora o teléfono, y que el color del
 * negocio pueda ser uno diferente al del usuario».
 *
 * - Color de la persona y modo claro/oscuro: en los metadatos de su cuenta
 *   (`theme_color`, `display_mode`), como ya se hace con la marca del PDF (docs/229).
 * - Color de cada negocio: en el propio negocio (`Business.themeColor`): un slug, o "user"
 *   para seguir el color de la persona.
 * - El navegador guarda una copia (las mismas claves de antes), porque la pantalla y los PDF
 *   leen el color al instante, sin esperar a la red.
 *
 * Al entrar en un aparato: lo de la cuenta manda. Si la cuenta todavía no tiene un valor y el
 * navegador sí (alguien que eligió su color antes de este cambio), se sube ese valor, para
 * que la elección no se pierda.
 */
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { updateBusiness } from "@/lib/storage/businesses"
import type { Business } from "@/types/business"
import { CURATED_THEMES, FOLLOW_USER_THEME, USER_THEME_KEY, resolveThemeSlug, themeStorageKey } from "@/lib/theme-colors"

export const THEME_PREFS_EVENT = "gm:theme-prefs-changed"
export type DisplayMode = "light" | "dark" | "system"

// Una subida por clave y por sesión de la página: la cuenta tarda un momento en reflejarla.
const uploaded = new Set<string>()

const isSlug = (v: unknown): v is string => typeof v === "string" && CURATED_THEMES.some((t) => t.slug === v)
const isMode = (v: unknown): v is DisplayMode => v === "light" || v === "dark" || v === "system"

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: la cuenta sigue teniendo el valor */
  }
}

function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(THEME_PREFS_EVENT))
}

/** Color de la persona: se aplica al instante y se guarda en la cuenta. */
export async function saveUserTheme(slug: string): Promise<boolean> {
  writeLocal(USER_THEME_KEY, slug)
  announce()
  const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: { theme_color: slug } })
  return !error
}

/** Color de un negocio: un slug propio o FOLLOW_USER_THEME («igual que mi color»). */
export async function saveBusinessTheme(businessId: string, value: string): Promise<boolean> {
  writeLocal(themeStorageKey(businessId), value)
  announce()
  return updateBusiness(businessId, { themeColor: value })
}

/** Modo claro/oscuro/sistema de la persona, en la cuenta. */
export async function saveDisplayMode(mode: DisplayMode): Promise<boolean> {
  const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: { display_mode: mode } })
  return !error
}

/**
 * Trae a este aparato lo que tiene la cuenta, y sube lo que solo tenía el navegador.
 * Devuelve el modo claro/oscuro de la cuenta (si tiene) para que la pantalla lo aplique.
 */
export function syncThemeFromAccount(
  userMetadata: Record<string, unknown> | undefined,
  businesses: Business[],
): { displayMode: DisplayMode | null; changed: boolean } {
  let changed = false

  // Color de la persona.
  const accountColor = userMetadata?.theme_color
  if (isSlug(accountColor)) {
    if (readLocal(USER_THEME_KEY) !== accountColor) {
      writeLocal(USER_THEME_KEY, accountColor)
      changed = true
    }
  } else {
    const local = readLocal(USER_THEME_KEY)
    if (local && !uploaded.has(USER_THEME_KEY)) {
      uploaded.add(USER_THEME_KEY)
      void saveUserThemeQuietly(resolveThemeSlug(local))
    }
  }

  // Color de cada negocio.
  for (const business of businesses) {
    const key = themeStorageKey(business.id)
    const value = business.themeColor
    if (value === FOLLOW_USER_THEME || isSlug(value)) {
      if (readLocal(key) !== value) {
        writeLocal(key, value)
        changed = true
      }
    } else {
      const local = readLocal(key)
      // Solo el dueño puede guardar el negocio; si falla (miembro del equipo), queda local.
      if (local && !uploaded.has(key)) {
        uploaded.add(key)
        void updateBusiness(business.id, { themeColor: local === FOLLOW_USER_THEME ? local : resolveThemeSlug(local) })
      }
    }
  }

  if (changed) announce()
  const mode = userMetadata?.display_mode
  return { displayMode: isMode(mode) ? mode : null, changed }
}

async function saveUserThemeQuietly(slug: string): Promise<void> {
  await getSupabaseBrowserClient().auth.updateUser({ data: { theme_color: slug } })
}
