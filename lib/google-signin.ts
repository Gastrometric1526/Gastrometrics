/**
 * Entrar con Google (docs/253, docs/254). El botón solo aparece con
 * `NEXT_PUBLIC_GOOGLE_SIGNIN=on`, después de que el dueño cree el cliente OAuth en Google
 * Cloud y active el proveedor Google en Supabase (todo gratis).
 */

export function googleSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on"
}

/** Rutas que se pueden ver sin completar el perfil. */
const OPEN_PATHS = ["/completar-perfil", "/terminos-de-uso", "/politica-privacidad", "/aviso-de-responsabilidad", "/auth/"]

interface SessionUserLike {
  app_metadata?: Record<string, unknown> | null
}

/** Proveedores con los que entra la cuenta («email», «google»…). */
export function authProviders(user: SessionUserLike | null | undefined): string[] {
  const meta = user?.app_metadata || {}
  const list = Array.isArray(meta.providers) ? (meta.providers as unknown[]).map(String) : []
  if (typeof meta.provider === "string" && !list.includes(meta.provider)) list.push(meta.provider)
  return list
}

/**
 * Una cuenta que entró con Google y nunca aceptó los Términos tiene que completar su perfil
 * (país, moneda y aceptación) antes de usar la app. Las cuentas de correo y contraseña ya lo
 * hicieron al registrarse. Puro.
 */
export function needsProfileCompletion(
  user: SessionUserLike | null | undefined,
  profile: { termsVersion?: string | null } | null | undefined,
  pathname: string,
): boolean {
  if (!user || !profile) return false
  if (profile.termsVersion) return false
  if (!authProviders(user).includes("google")) return false
  return !OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))
}

/** Adónde volver después del retorno de Google: solo rutas internas. Puro. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard"
  return raw
}
