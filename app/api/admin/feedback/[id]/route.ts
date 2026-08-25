/**
 * Cambiar el estado, guardar una respuesta (y avisarle por correo a quien mandó el
 * mensaje, si dejó su correo), o borrar un mensaje puntual del buzón de /contacto.
 * Gateado por la misma cookie de sesión admin que el resto de /admin.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendFeedbackReplyEmail } from "@/lib/services/notify-feedback"
import type { Database } from "@/types/database"

type FeedbackUpdate = Database["public"]["Tables"]["feedback"]["Update"]

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const admin = getSupabaseAdminClient()

  const updates: FeedbackUpdate = {}
  if (body?.status) updates.status = body.status
  if (typeof body?.reply === "string" && body.reply.trim()) {
    updates.admin_reply = body.reply.trim()
    updates.replied_at = new Date().toISOString()
    updates.status = "resuelto"
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 })
  }

  const { data, error } = await admin.from("feedback").update(updates).eq("id", params.id).select("*").maybeSingle()

  if (error || !data) {
    console.error("[api/admin/feedback/:id] Error actualizando:", error)
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })
  }

  // Best-effort: si se guardó una respuesta y la persona dejó su correo, avisarle.
  // No bloquea la respuesta de esta ruta si el correo falla (ver docs — el sandbox
  // de Resend sin dominio verificado solo puede mandar a la casilla dueña de la
  // cuenta, así que esto puede fallar en silencio hasta que se verifique un dominio).
  let emailSent = false
  if (updates.admin_reply && data.user_email) {
    try {
      await sendFeedbackReplyEmail({
        toEmail: data.user_email,
        toName: data.user_name || undefined,
        type: data.type,
        ticketId: data.id,
        createdAt: data.created_at,
        originalMessage: data.message,
        reply: data.admin_reply as string,
        preferredLanguage: data.preferred_language,
      })
      emailSent = true
    } catch (emailError) {
      console.error("[api/admin/feedback/:id] Error mandando el correo de respuesta:", emailError)
    }
  }

  return NextResponse.json({ feedback: data, emailSent })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("feedback").delete().eq("id", params.id)

  if (error) {
    console.error("[api/admin/feedback/:id] Error borrando:", error)
    return NextResponse.json({ error: "No se pudo borrar." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
