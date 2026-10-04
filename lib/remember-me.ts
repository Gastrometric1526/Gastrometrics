/**
 * "Recuérdame" del inicio de sesión (docs/145). La sesión de Supabase ya dura 400 días
 * por defecto (cookie de @supabase/ssr), así que "recordar" es el comportamiento de
 * siempre. Si la persona desmarca la casilla (computadora compartida), la sesión se
 * cierra al cerrar el navegador:
 *   - al iniciar sesión se guarda gm_remember = "0" (localStorage) y la cookie de sesión
 *     gm_session_alive (sin fecha de vencimiento: el navegador la borra al cerrarse y,
 *     a diferencia de sessionStorage, la comparten todas las pestañas — abrir un enlace
 *     en otra pestaña no cierra la sesión);
 *   - al abrir la app, si gm_remember es "0" y ya no existe gm_session_alive, se cierra
 *     la sesión (AuthProvider llama a shouldEndSessionOnLaunch).
 */

const REMEMBER_KEY = "gm_remember"
const ALIVE_COOKIE = "gm_session_alive"

function setAliveCookie(): void {
  document.cookie = `${ALIVE_COOKIE}=1; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
}

function hasAliveCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim() === `${ALIVE_COOKIE}=1`)
}

export function setRememberChoice(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0")
    setAliveCookie()
  } catch {
    // Modo privado o almacenamiento bloqueado: queda el comportamiento de siempre.
  }
}

/** true si la persona pidió no ser recordada y el navegador se cerró desde entonces. */
export function shouldEndSessionOnLaunch(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "0" && !hasAliveCookie()
  } catch {
    return false
  }
}

export function clearRememberChoice(): void {
  try {
    localStorage.removeItem(REMEMBER_KEY)
    document.cookie = `${ALIVE_COOKIE}=; path=/; max-age=0`
  } catch {
    /* nada */
  }
}
