/**
 * Cliente de Supabase con la service role key — bypassa RLS por completo.
 *
 * SOLO se importa desde rutas de servidor (app/api/**\/route.ts). Nunca desde un
 * Client Component ni desde código que pueda terminar en el bundle del navegador —
 * la service role key equivale a acceso total de administrador a la base de datos.
 * Se usa exactamente donde hace falta escribir algo que un usuario normal, por
 * política RLS, no puede escribir él mismo (ver supabase/migrations/0004_account_plans.sql):
 * el plan de una cuenta solo lo cambia el servidor, nunca un PATCH directo del cliente.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { requireSupabaseServiceRoleEnv } from "./env"

let cachedAdminClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdminClient() {
  if (cachedAdminClient) return cachedAdminClient

  const { url, serviceRoleKey } = requireSupabaseServiceRoleEnv()
  cachedAdminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedAdminClient
}
