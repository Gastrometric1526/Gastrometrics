/**
 * Sirve el manual de usuario en PDF — únicamente a una sesión autenticada real
 * (getSupabaseServerClient().auth.getUser()), nunca como archivo estático público.
 * El PDF vive en lib/assets/ (fuera de public/) precisamente para que no exista una
 * URL sin auth que lo sirva; Content-Disposition: inline permite verlo en el navegador
 * y también descargarlo desde el propio visor de PDF, según lo pedido.
 */

import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const MANUAL_PATH = path.join(process.cwd(), "lib", "assets", "manual-gastrometrics.pdf")

export async function GET() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para ver el manual." }, { status: 401 })
  }

  try {
    const pdfBuffer = await readFile(MANUAL_PATH)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="manual-gastrometrics.pdf"',
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
