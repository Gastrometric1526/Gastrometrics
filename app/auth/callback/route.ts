/**
 * Retorno de Google (docs/254): cambia el código por la sesión (PKCE de @supabase/ssr) y
 * manda al Dashboard. Si la cuenta es nueva, CompleteProfileGate la lleva a
 * /completar-perfil antes de usar la app.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/google-signin"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = safeNextPath(url.searchParams.get("next"))
  if (!code) return NextResponse.redirect(new URL("/login?google=error", url.origin))

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error("[auth/callback] No se pudo abrir la sesión con Google:", error.message)
    return NextResponse.redirect(new URL("/login?google=error", url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
