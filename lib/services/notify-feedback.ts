/**
 * Envía un correo de notificación al dueño del proyecto cuando alguien manda
 * un mensaje desde /contacto (sugerencia, queja o reporte de bug). El mensaje
 * en sí ya queda guardado de forma durable en localStorage/panel admin (ver
 * lib/storage/feedback.ts) sin importar si este correo llega o no — esto es
 * solo una notificación en tiempo real para no tener que revisar /admin
 * manualmente.
 *
 * Usa Resend (resend.com) porque tiene un plan gratuito suficiente para una
 * beta (100 correos/día) y una API de una sola llamada, sin servidor SMTP
 * propio que mantener. Si RESEND_API_KEY no está configurada todavía, esto
 * no lanza — simplemente no envía nada (mismo patrón que lib/stripe/client.ts
 * con isStripeConfigured()).
 */

import { Resend } from "resend"

export function isFeedbackNotifyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FEEDBACK_NOTIFY_TO)
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  sugerencia: "Sugerencia",
  queja: "Queja",
  bug: "Reporte de error",
}

export async function sendFeedbackNotification(input: {
  type: string
  message: string
  userName?: string
  userEmail?: string
  page?: string
}): Promise<void> {
  if (!isFeedbackNotifyConfigured()) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const typeLabel = FEEDBACK_TYPE_LABELS[input.type] || input.type
  const fromWho = input.userName || input.userEmail ? `${input.userName || "Anónimo"} (${input.userEmail || "sin correo"})` : "Anónimo"

  await resend.emails.send({
    // "from" debe ser un remitente en un dominio verificado en Resend — con la cuenta
    // gratis sin dominio propio verificado, Resend solo permite "onboarding@resend.dev"
    // como remitente (funciona igual para recibir, solo se ve distinto en el "De:").
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [process.env.FEEDBACK_NOTIFY_TO as string],
    subject: `[GastroMetrics] Nuevo mensaje: ${typeLabel}`,
    html: `
      <p><strong>Tipo:</strong> ${typeLabel}</p>
      <p><strong>De:</strong> ${fromWho}</p>
      ${input.page ? `<p><strong>Página:</strong> ${input.page}</p>` : ""}
      <p><strong>Mensaje:</strong></p>
      <p>${input.message.replace(/\n/g, "<br/>")}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Revisa y responde desde el panel /admin.</p>
    `,
  })
}
