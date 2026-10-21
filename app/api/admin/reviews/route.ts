/**
 * Publicar o quitar una opinión del sitio (docs/173). Solo con sesión de admin.
 * Sin migración: la marca vive en product_events (event_name «review_published»,
 * business_id = id de la opinión). GET devuelve los ids publicados.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { parseReviewMessage } from "@/lib/reviews"

export const dynamic = "force-dynamic"
const PUBLISHED_EVENT = "review_published"

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const { data, error } = await getSupabaseAdminClient().from("product_events").select("business_id").eq("event_name", PUBLISHED_EVENT)
  if (error) return NextResponse.json({ error: "No se pudo leer." }, { status: 500 })
  const rows = (data ?? []) as unknown as { business_id: string | null }[] // product_events no está en types/database.ts
  return NextResponse.json({ publishedIds: rows.map((r) => r.business_id).filter(Boolean) })
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : ""
  const publish = body?.publish === true
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 })

  const admin = getSupabaseAdminClient()
  const { data: row } = await admin.from("feedback").select("id, type, message").eq("id", id).maybeSingle()
  if (!row || row.type !== "experiencia") return NextResponse.json({ error: "Opinión no encontrada." }, { status: 404 })
  // Nunca se publica sin el permiso de quien la escribió.
  if (publish && !parseReviewMessage(row.message).publishable) {
    return NextResponse.json({ error: "Esta opinión no tiene permiso para mostrarse." }, { status: 400 })
  }

  await admin.from("product_events").delete().eq("event_name", PUBLISHED_EVENT).eq("business_id", id)
  if (publish) {
    const { error } = await admin.from("product_events").insert({ event_name: PUBLISHED_EVENT, business_id: id } as never)
    if (error) return NextResponse.json({ error: "No se pudo publicar." }, { status: 500 })
  }
  return NextResponse.json({ ok: true, published: publish })
}
