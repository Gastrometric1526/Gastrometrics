/**
 * Lógica de refresco de sesión de Supabase para middleware.ts — separada en
 * su propio archivo (patrón oficial de @supabase/ssr) para que sea fácil de
 * importar desde el middleware.ts real del proyecto cuando se conecte.
 *
 * NO está enganchada a ningún middleware.ts todavía — este proyecto no tiene
 * uno (ver docs/12-guia-backend.md). Cuando se conecte Supabase de verdad:
 *
 *   // middleware.ts (raíz del proyecto)
 *   import { updateSupabaseSession } from "@/lib/supabase/middleware"
 *   export async function middleware(request: NextRequest) {
 *     return updateSupabaseSession(request)
 *   }
 *   export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
 *
 * Sin variables de entorno configuradas, esta función devuelve la petición
 * sin tocarla — es seguro tenerla en el árbol sin romper nada hoy.
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"
import { isSupabaseConfigured, getSupabaseEnv } from "./env"

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!isSupabaseConfigured()) return response

  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient<Database>(url!, anonKey!, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value: "", ...options })
        response = NextResponse.next({ request })
        response.cookies.set({ name, value: "", ...options })
      },
    },
  })

  // Refresca el token si expiró — necesario para que la sesión sobreviva
  // entre Server Components sin que el usuario tenga que volver a loguearse.
  await supabase.auth.getUser()

  return response
}
