/**
 * Lista todo el buzón de /contacto para el panel /admin — reemplaza la lectura
 * directa de localStorage (lib/storage/feedback.ts), que solo mostraba lo enviado
 * desde el MISMO navegador que estuviera viendo /admin. Gateado por la misma cookie
 * de sesión admin que ya protege el resto de /admin (ver lib/admin-auth.ts).
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.from("feedback").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[api/admin/feedback] Error cargando feedback:", error)
    return NextResponse.json({ error: "No se pudo cargar el feedback." }, { status: 500 })
  }

  return NextResponse.json({ feedback: data })
}
