/**
 * Sesión de /admin (docs/154). La cookie `gm_admin_session` que otorga
 * app/api/admin/verify/route.ts tras validar ADMIN_PASSCODE ya no vale el texto fijo
 * "granted" (cualquiera podía escribirlo a mano en su navegador y entrar como admin):
 * ahora es `vencimiento.firma`, con la firma HMAC-SHA256 hecha con una llave que solo
 * existe en el servidor (derivada de ADMIN_PASSCODE y SUPABASE_SERVICE_ROLE_KEY). No se
 * puede falsificar, vence sola y cambiar el código invalida todas las sesiones abiertas.
 * Cualquier ruta de servidor que solo el dueño del proyecto debe poder llamar usa
 * hasAdminSession().
 */

import { cookies } from "next/headers"
import { createHash, createHmac, timingSafeEqual } from "crypto"

export const ADMIN_SESSION_COOKIE_NAME = "gm_admin_session"
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4 // 4 horas

/**
 * Código de acceso. En producción no hay código por defecto: sin ADMIN_PASSCODE /admin
 * queda cerrado (antes caía en un código escrito en el código fuente).
 */
export function getAdminPasscode(): string | null {
  const configured = process.env.ADMIN_PASSCODE
  if (configured) return configured
  return process.env.NODE_ENV === "production" ? null : "gastro-admin-2026"
}

function sessionKey(): Buffer | null {
  const passcode = getAdminPasscode()
  if (!passcode) return null
  return createHash("sha256")
    .update(`gm-admin-session-v1:${passcode}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`)
    .digest()
}

const sign = (key: Buffer, payload: string) => createHmac("sha256", key).update(payload).digest("base64url")

/** Compara dos textos en tiempo constante (no revela por tiempo cuántos caracteres coinciden). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

/** Valor nuevo de la cookie de sesión, o null si /admin no está configurado. */
export function createAdminSessionValue(now = Date.now()): string | null {
  const key = sessionKey()
  if (!key) return null
  const expires = String(Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS)
  return `${expires}.${sign(key, expires)}`
}

export function isValidAdminSessionValue(value: string | undefined, now = Date.now()): boolean {
  const key = sessionKey()
  if (!key || !value) return false
  const [expires, signature] = value.split(".")
  if (!expires || !signature || !/^\d+$/.test(expires)) return false
  if (Number(expires) * 1000 < now) return false
  return safeEqual(signature, sign(key, expires))
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  return isValidAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value)
}
