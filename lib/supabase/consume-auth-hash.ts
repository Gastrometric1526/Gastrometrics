/**
 * @supabase/ssr fuerza flowType "pkce" en createBrowserClient (no se puede cambiar por
 * opciones, ver createBrowserClient.js: "flowType: 'pkce'" se aplica DESPUÉS de spreadear
 * las opciones del caller). Pero los links que genera admin.generateLink() — usados por
 * /api/auth/signup y /api/auth/forgot-password para no depender del correo nativo de
 * Supabase, ver docs/53 — llegan con el token en el hash de la URL al estilo del flujo
 * "implicit" (#access_token=...&refresh_token=...), no como "?code=..." al estilo PKCE.
 *
 * Con flowType pkce, la detección automática de sesión en la URL de supabase-js revisa
 * ese hash, ve que no es un link PKCE válido, y descarta la sesión en silencio
 * (AuthPKCEGrantCodeExchangeError, atrapado internamente) — getSession() nunca la
 * encuentra. Esto rompía en producción tanto la confirmación de registro (redirige a
 * /dashboard) como la recuperación de contraseña (redirige a /reset-password): el link
 * del correo llegaba bien, pero la sesión nunca se establecía.
 *
 * Esta función lee el hash a mano y llama a setSession() directo, que no depende del
 * flowType configurado. Debe llamarse UNA vez, lo antes posible al cargar cualquier
 * página que pueda recibir uno de estos redirects, antes de preguntar por la sesión.
 */
import { getSupabaseBrowserClient } from "./client"

let consumed = false

export async function consumeAuthHashFromUrl(): Promise<boolean> {
  if (consumed) return false
  if (typeof window === "undefined") return false
  if (!window.location.hash.includes("access_token")) return false

  const params = new URLSearchParams(window.location.hash.slice(1))
  const access_token = params.get("access_token")
  const refresh_token = params.get("refresh_token")
  if (!access_token || !refresh_token) return false

  // Se marca ANTES del await (sin operaciones async previas) para que si AuthProvider y
  // una página como /reset-password llaman a esto casi al mismo tiempo, solo uno de los
  // dos de verdad ejecute setSession() — JS es de un solo hilo, así que esto es seguro.
  consumed = true

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    consumed = false
    return false
  }

  window.history.replaceState(null, "", window.location.pathname + window.location.search)
  return true
}
