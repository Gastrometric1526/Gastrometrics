/**
 * Recibe un mensaje nuevo de /contacto (sugerencia, queja, o reporte de bug),
 * accesible con o sin sesión iniciada. Reemplaza el guardado directo en
 * localStorage (lib/storage/feedback.ts, ahora sin uso) — se persiste en Supabase
 * con la service role key (ver 0006_feedback.sql para el porqué de no usar RLS por
 * fila aquí: no hay owner_id confiable de quien manda el mensaje) y de paso manda
 * la notificación por correo al dueño del proyecto (ver lib/services/notify-feedback.ts).
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { isFeedbackNotifyConfigured, sendFeedbackNotification } from "@/lib/services/notify-feedback"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const type = body?.type as string | undefined
  const message = (body?.message as string | undefined)?.trim()

  if (!type || !["sugerencia", "queja", "bug"].includes(type) || !message) {
    return NextResponse.json({ error: "Falta type o message válidos." }, { status: 400 })
  }

  const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("feedback").insert({
    id,
    type,
    message,
    user_name: body?.userName?.trim() || null,
    user_email: body?.userEmail?.trim() || null,
    page: body?.page || null,
    image_data_url: body?.imageDataUrl || null,
  })

  if (error) {
    console.error("[api/feedback/submit] Error guardando el mensaje:", error)
    return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 })
  }

  if (isFeedbackNotifyConfigured()) {
    try {
      await sendFeedbackNotification({
        type,
        message,
        userName: body?.userName,
        userEmail: body?.userEmail,
        page: body?.page,
      })
    } catch (notifyError) {
      // No es crítico: el mensaje ya quedó guardado sin importar esto.
      console.error("[api/feedback/submit] Error enviando la notificación:", notifyError)
    }
  }

  return NextResponse.json({ id })
}
