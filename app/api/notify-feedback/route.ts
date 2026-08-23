/**
 * Recibe el mismo mensaje que ya se guardó en localStorage (ver
 * lib/storage/feedback.ts, llamado desde app/contacto/page.tsx) y le avisa
 * al dueño del proyecto por correo — ver lib/services/notify-feedback.ts
 * para el porqué de Resend y el modelo de "por qué esto es opcional".
 *
 * No hay imagen adjunta en el correo a propósito: las capturas de pantalla
 * ya se pueden ver completas en /admin, y adjuntarlas aquí infla el payload
 * del correo sin necesidad real.
 */

import { NextResponse } from "next/server"
import { isFeedbackNotifyConfigured, sendFeedbackNotification } from "@/lib/services/notify-feedback"

export async function POST(request: Request) {
  if (!isFeedbackNotifyConfigured()) {
    return NextResponse.json({ skipped: true })
  }

  const body = await request.json().catch(() => null)
  if (!body?.type || !body?.message) {
    return NextResponse.json({ error: "Falta type o message." }, { status: 400 })
  }

  try {
    await sendFeedbackNotification({
      type: body.type,
      message: body.message,
      userName: body.userName,
      userEmail: body.userEmail,
      page: body.page,
    })
    return NextResponse.json({ sent: true })
  } catch (error) {
    // No es crítico: el mensaje ya está guardado en localStorage/panel admin
    // sin importar esto — solo se pierde la notificación en tiempo real.
    console.error("[api/notify-feedback] Error enviando el correo:", error)
    return NextResponse.json({ error: "No se pudo enviar la notificación." }, { status: 500 })
  }
}
