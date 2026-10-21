/**
 * Lista todo el buzón de /contacto para el panel /admin — reemplaza la lectura
 * directa de localStorage (lib/storage/feedback.ts), que solo mostraba lo enviado
 * desde el MISMO navegador que estuviera viendo /admin. Gateado por la misma cookie
 * de sesión admin que ya protege el resto de /admin (ver lib/admin-auth.ts).
 * Desde docs/176 también devuelve qué mensajes están archivados (fuera de la bandeja),
 * y POST archiva o devuelve varios a la vez («Archivar todo»).
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getArchivedFeedbackIds, setFeedbackArchived } from "@/lib/admin/feedback-archive"

export const dynamic = "force-dynamic"

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

  let archivedIds: string[] = []
  try {
    archivedIds = await getArchivedFeedbackIds()
  } catch (archiveError) {
    console.error("[api/admin/feedback] Error leyendo el archivo:", archiveError)
  }

  return NextResponse.json({ feedback: data, archivedIds })
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0).slice(0, 1000) : []
  if (ids.length === 0 || typeof body?.archived !== "boolean") {
    return NextResponse.json({ error: "Faltan los mensajes." }, { status: 400 })
  }

  try {
    await setFeedbackArchived(ids, body.archived)
  } catch (error) {
    console.error("[api/admin/feedback] Error archivando:", error)
    return NextResponse.json({ error: "No se pudo archivar." }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: ids.length, archived: body.archived })
}
