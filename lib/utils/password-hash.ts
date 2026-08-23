// Verificación de contraseña 100% local (sin backend, ver CLAUDE.md) — pedida
// explícitamente para exigir la contraseña actual antes de cambiar el correo en
// Configuración. No es seguridad real: cualquiera con acceso a las DevTools del
// mismo dispositivo puede leer o borrar el hash guardado. Sirve para lo que SÍ puede
// servir un chequeo local: evitar que alguien cambie el correo con la sesión de otra
// persona abierta en el mismo navegador, no para proteger contra un atacante técnico.
// SHA-256 vía Web Crypto (nativo del navegador, sin dependencias nuevas). Un solo hash
// por dispositivo/navegador (igual que el resto del storage de la app, ver
// lib/storage/core.ts) — no hace falta salt por usuario porque solo hay una cuenta
// activa a la vez en este localStorage.

const STORAGE_KEY = "gm_password_hash"
const PEPPER = "gastrometrics-local-check"

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function storePasswordHash(password: string): Promise<void> {
  const hash = await sha256Hex(`${PEPPER}:${password}`)
  localStorage.setItem(STORAGE_KEY, hash)
}

// Guarda el hash solo si todavía no existe uno — usado al iniciar sesión con una
// cuenta que nunca pasó por /signup (login demo o legacy), para que la primera
// contraseña que la persona escriba se convierta en la que se le pedirá después para
// confirmar cambios sensibles, sin pisar silenciosamente una que ya se había fijado.
export async function bootstrapPasswordHashIfMissing(password: string): Promise<void> {
  if (localStorage.getItem(STORAGE_KEY)) return
  await storePasswordHash(password)
}

export function hasStoredPassword(): boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return false
  const hash = await sha256Hex(`${PEPPER}:${password}`)
  return hash === stored
}
