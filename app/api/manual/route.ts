/**
 * Sirve el manual de usuario en PDF — únicamente a una sesión autenticada real
 * (getSupabaseServerClient().auth.getUser()), nunca como archivo estático público.
 * El PDF vive en lib/assets/ (fuera de public/) precisamente para que no exista una
 * URL sin auth que lo sirva; Content-Disposition: inline permite verlo en el navegador
 * y también descargarlo desde el propio visor de PDF, según lo pedido.
 *
 * Un PDF por idioma (lib/assets/manual-{es,en,da,fr,pt,zh}.pdf) — se sirve el que
 * corresponda al idioma real de la cuenta (profiles.preferred_language), no un query
 * param que cualquiera podría manipular ni el idioma del navegador. Si la cuenta no
 * tiene idioma guardado o su PDF específico faltara en el bundle por algún motivo, cae
 * a español (mismo criterio de fallback que ya usa forgot-password/route.ts).
 */

import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const SUPPORTED_MANUAL_LANGUAGES = ["es", "en", "da", "fr", "pt", "zh"] as const

function manualPathFor(language: string) {
  return path.join(process.cwd(), "lib", "assets", `manual-${language}.pdf`)
}

export async function GET() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para ver el manual." }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const { data: profileRow } = await admin.from("profiles").select("preferred_language").eq("id", user.id).maybeSingle()
  const requestedLanguage = profileRow?.preferred_language || "es"
  const language = (SUPPORTED_MANUAL_LANGUAGES as readonly string[]).includes(requestedLanguage) ? requestedLanguage : "es"

  try {
    const pdfBuffer = await readFile(manualPathFor(language)).catch(() =>
      // Fallback si el PDF de ese idioma específico faltara (no debería pasar en
      // producción, pero nunca debe dejar al usuario sin manual del todo).
      readFile(manualPathFor("es")),
    )
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="manual-gastrometrics-${language}.pdf"`,
        // "no-store" (no solo "private") a propósito: el manual no tiene datos
        // sensibles, pero el pedido explícito es que solo se pueda ver estando
        // realmente autenticado — un "private, max-age" permitiría que el propio
        // caché del navegador sirviera una copia ya vista sin volver a pasar por el
        // chequeo de auth (ej. después de cerrar sesión en ese mismo navegador).
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("[api/manual] Error leyendo el manual:", error)
    return NextResponse.json({ error: "No se pudo cargar el manual." }, { status: 500 })
  }
}
