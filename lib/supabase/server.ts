/**
 * Cliente de Supabase para el servidor (Server Components, Route Handlers,
 * Server Actions) — usa las cookies de la petición para mantener la sesión,
 * patrón oficial de @supabase/ssr para Next.js App Router.
 *
 * Igual que lib/supabase/client.ts: no lanza al importarse, solo al llamar
 * getSupabaseServerClient() sin las variables de entorno configuradas.
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"
import { requireSupabaseEnv } from "./env"

export function getSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, value, options)
        } catch {
          // Se puede llamar desde un Server Component (no puede escribir cookies) — el
          // middleware de sesión es el que de verdad las refresca, esto es best-effort.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 })
        } catch {
          // Ver nota arriba.
        }
      },
    },
  })
}
