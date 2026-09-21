/**
 * Registra que una cuenta EXISTENTE (creada antes de la versión actual de los
 * Términos de Uso/Política de Privacidad/Aviso de Responsabilidad, ver docs/118) ya
 * vio y reconoció el aviso no bloqueante de components/legal-update-banner.tsx.
 *
 * A diferencia del registro nuevo (app/api/auth/signup/route.ts, que SÍ bloquea la
 * creación de la cuenta si no se acepta), esto nunca bloquea nada — los nuevos
 * Términos §9 ya permiten "uso continuado tras 14 días de aviso implica aceptación",
 * así que este endpoint solo silencia el banner y estampa la fecha/versión real por si
 * hiciera falta como evidencia.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { CURRENT_LEGAL_VERSION } from "@/lib/legal"

export async function POST() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const { error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString(), terms_version: CURRENT_LEGAL_VERSION })
    .eq("id", user.id)

  if (error) {
    console.error("[api/account/acknowledge-terms] Error guardando el reconocimiento:", error)
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, termsVersion: CURRENT_LEGAL_VERSION })
}
