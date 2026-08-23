/**
 * Cliente de Supabase para el navegador (Client Components).
 *
 * No se instancia a nivel de módulo a propósito: si NEXT_PUBLIC_SUPABASE_URL
 * y NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas (el caso de hoy,
 * ver docs/12-guia-backend.md), importar este archivo no debe lanzar — solo
 * lanza si de verdad se llama a getSupabaseBrowserClient() antes de tener
 * el proyecto de Supabase creado y las variables configuradas en .env.local.
 */

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"
import { requireSupabaseEnv } from "./env"

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (cachedClient) return cachedClient

  const { url, anonKey } = requireSupabaseEnv()
  cachedClient = createBrowserClient<Database>(url, anonKey)
  return cachedClient
}
