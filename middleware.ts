import type { NextRequest } from "next/server"
import { updateSupabaseSession } from "@/lib/supabase/middleware"

// Mantiene viva la sesión de Supabase (refresca el token si expiró) entre Server
// Components, para que el usuario no tenga que volver a loguearse. Sin variables de
// entorno de Supabase configuradas, updateSupabaseSession no toca nada (ver
// lib/supabase/middleware.ts) — seguro de tener en el árbol incluso si algún entorno
// no las tiene.
export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
