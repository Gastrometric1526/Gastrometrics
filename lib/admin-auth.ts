/**
 * Sesión de /admin (docs/154). La cookie `gm_admin_session` ya no vale el texto fijo
 * "granted" (cualquiera podía escribirlo a mano en su navegador y entrar como admin):
 * es `vencimiento.firma`, con la firma HMAC-SHA256 hecha con una llave que solo existe en
 * el servidor (derivada de ADMIN_PASSCODE y SUPABASE_SERVICE_ROLE_KEY). No se puede
 * falsificar, vence sola y cambiar el código invalida todas las sesiones abiertas.
 *
 * Desde docs/282 la sesión también dice QUIÉN entró: `vencimiento.quien.firma`, donde
 * `quien` es el correo de la cuenta (en base64url) o `code` si se entró con el código de
 * emergencia. La firma cubre las dos partes, así que tampoco se puede cambiar el correo.
 * Las cookies viejas de dos partes siguen valiendo hasta que vencen (cuentan como `code`).
 * Cualquier ruta de servidor que solo el panel debe poder llamar usa hasAdminSession();
 * la que necesita saber quién es, getAdminIdentity().
 */

import { cookies } from "next/headers"
import { createHash, createHmac, timingSafeEqual } from "crypto"

export const ADMIN_SESSION_COOKIE_NAME = "gm_admin_session"
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4 // 4 horas

/** Quién abrió la sesión: el correo de su cuenta o el código de emergencia. */
export type AdminIdentity = { kind: "account"; email: string } | { kind: "code" }

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

const encodeWho = (identity: AdminIdentity) => (identity.kind === "code" ? "code" : `a-${Buffer.from(identity.email.toLowerCase()).toString("base64url")}`)

function decodeWho(who: string): AdminIdentity | null {
  if (who === "code") return { kind: "code" }
  if (!who.startsWith("a-")) return null
  const email = Buffer.from(who.slice(2), "base64url").toString("utf8")
  return email.includes("@") ? { kind: "account", email } : null
}

/** Valor nuevo de la cookie de sesión, o null si /admin no está configurado. */
export function createAdminSessionValue(now = Date.now(), identity: AdminIdentity = { kind: "code" }): string | null {
  const key = sessionKey()
  if (!key) return null
  const expires = String(Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS)
  const payload = `${expires}.${encodeWho(identity)}`
  return `${payload}.${sign(key, payload)}`
}

/** Quién abrió la sesión de esta cookie, o null si no es válida o venció. */
export function readAdminSessionValue(value: string | undefined, now = Date.now()): AdminIdentity | null {
  const key = sessionKey()
  if (!key || !value) return null
  const parts = value.split(".")
  if (parts.length === 2) {
    // Cookie de antes de docs/282: `vencimiento.firma`, entrada con el código.
    const [expires, signature] = parts
    if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return null
    return safeEqual(signature, sign(key, expires)) ? { kind: "code" } : null
  }
  if (parts.length !== 3) return null
  const [expires, who, signature] = parts
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return null
  if (!safeEqual(signature, sign(key, `${expires}.${who}`))) return null
  return decodeWho(who)
}

export function isValidAdminSessionValue(value: string | undefined, now = Date.now()): boolean {
  return readAdminSessionValue(value, now) !== null
}

/**
 * Quién tiene la sesión del panel. Una sesión de cuenta solo vale mientras esa cuenta
 * siga teniendo acceso (docs/282): si el dueño se lo quita, deja de entrar al momento,
 * sin esperar a que venza la cookie.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies()
  const identity = readAdminSessionValue(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value)
  if (!identity || identity.kind === "code") return identity
  const [{ getAdminMember }, { canSignIn }] = await Promise.all([import("@/lib/admin/members-server"), import("@/lib/admin/members")])
  const { ready, member } = await getAdminMember(identity.email)
  return ready && canSignIn(member) ? identity : null
}

export async function hasAdminSession(): Promise<boolean> {
  return (await getAdminIdentity()) !== null
}

/** Opciones de la cookie de sesión (iguales para el código y para la cuenta). */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  path: "/",
}

/**
 * Enlace de entrada por correo (pedido del dueño, docs/298: entrar a /admin sin abrir la
 * sesión de la app). `vencimiento.correo.firma`, firmado con la misma llave del panel, vence
 * en 15 minutos y sirve UNA vez: la firma incluye la última entrada de esa persona
 * (`last_login_at`), y al entrar esa fecha cambia, así que el mismo enlace ya no vale.
 */
export const ADMIN_LINK_MAX_AGE_SECONDS = 15 * 60

const linkPayload = (expires: string, who: string, lastLogin: string | null) => `link.${expires}.${who}.${lastLogin ?? "never"}`

export function createAdminLinkToken(email: string, lastLogin: string | null, now = Date.now()): string | null {
  const key = sessionKey()
  if (!key) return null
  const expires = String(Math.floor(now / 1000) + ADMIN_LINK_MAX_AGE_SECONDS)
  const who = Buffer.from(email.toLowerCase()).toString("base64url")
  return `${expires}.${who}.${sign(key, linkPayload(expires, who, lastLogin))}`
}

/** Correo del enlace si no venció ni se usó; `lastLoginOf` da la última entrada actual de ese correo. */
export async function readAdminLinkToken(
  token: string,
  lastLoginOf: (email: string) => Promise<string | null | undefined>,
  now = Date.now(),
): Promise<string | null> {
  const key = sessionKey()
  if (!key || !token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [expires, who, signature] = parts
  if (!/^\d+$/.test(expires) || Number(expires) * 1000 < now) return null
  const email = Buffer.from(who, "base64url").toString("utf8")
  if (!email.includes("@")) return null
  const lastLogin = await lastLoginOf(email)
  if (lastLogin === undefined) return null
  return safeEqual(signature, sign(key, linkPayload(expires, who, lastLogin))) ? email : null
}
