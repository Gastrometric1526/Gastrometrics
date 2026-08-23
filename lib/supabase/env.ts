/**
 * Lectura centralizada de las variables de entorno de Supabase.
 *
 * Ninguna de estas variables existe todavía en este entorno — este módulo
 * existe para que el resto del código de backend (cliente, servidor, auth)
 * pueda importarse y compilar sin lanzar en el momento del import, y solo
 * falle con un mensaje claro si de verdad se intenta usar sin haber
 * configurado el proyecto de Supabase. Ver docs/12-guia-backend.md.
 */

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv()
  return Boolean(url && anonKey)
}

/** Lanza un error legible si se intenta usar Supabase sin las variables configuradas. */
export function requireSupabaseEnv() {
  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado. Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(ver .env.example y docs/12-guia-backend.md). La app sigue funcionando con localStorage mientras tanto.",
    )
  }
  return { url, anonKey }
}
