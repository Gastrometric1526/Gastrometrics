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
import { renderEmailTemplate, escapeHtml, escapeHtmlWithLineBreaks } from "./email-templates"

export function isFeedbackNotifyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.FEEDBACK_NOTIFY_TO)
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  sugerencia: "Sugerencia",
  queja: "Queja",
  bug: "Reporte de error",
}

const FEEDBACK_REPLY_TITLES: Record<string, string> = {
  sugerencia: "Revisamos tu sugerencia",
  queja: "Ya resolvimos tu reporte",
  bug: "Ya corregimos el problema",
}

/**
 * Le avisa a la PERSONA que mandó el mensaje por /contacto que el dueño del
 * proyecto ya respondió — llamado desde app/api/admin/feedback/[id]/route.ts al
 * guardar una respuesta desde /admin. Solo se llama si esa persona dejó su correo
 * (userEmail es opcional en /contacto); si no lo dejó, no hay a quién avisarle y la
 * respuesta queda solo visible en /admin.
 */
export async function sendFeedbackReplyEmail(input: {
  toEmail: string
  toName?: string
  type: string
  ticketId: string
  createdAt: string
  originalMessage: string
  reply: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const typeLabel = FEEDBACK_TYPE_LABELS[input.type] || input.type

  const html = renderEmailTemplate("02-respuesta-feedback.html", {
    typeLabel: escapeHtml(typeLabel),
    ticketId: escapeHtml(input.ticketId),
    receivedAt: escapeHtml(
      new Date(input.createdAt).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" }),
    ),
    replyTitle: escapeHtml(FEEDBACK_REPLY_TITLES[input.type] || "Respuesta a tu mensaje"),
    reply: escapeHtmlWithLineBreaks(input.reply),
    originalMessage: escapeHtmlWithLineBreaks(input.originalMessage),
    appUrl: siteUrl,
  })

  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [input.toEmail],
    subject: "Respuesta a tu mensaje en GastroMetrics",
    html,
  })
  // El SDK de Resend no lanza en errores de la API — los devuelve en `error` sin lanzar.
  // Lanzar acá a propósito para que el caller (app/api/admin/feedback/[id]/route.ts) lo
  // capture y reporte emailSent: false, en vez de asumir éxito silenciosamente.
  if (error) throw error
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

  const { error } = await resend.emails.send({
    // "from" debe ser un remitente en un dominio verificado en Resend — con la cuenta
    // gratis sin dominio propio verificado, Resend solo permite "onboarding@resend.dev"
    // como remitente (funciona igual para recibir, solo se ve distinto en el "De:").
    // Con gastrometrics.org ya verificado (ver docs/53), FEEDBACK_NOTIFY_FROM usa un
    // remitente propio.
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
  // El SDK de Resend no lanza en errores de la API — los devuelve en `error` sin lanzar
  // (bug real encontrado probando esta misma función, ver docs/53). Se loguea en vez de
  // lanzar porque esta notificación es best-effort — no debe romper /api/feedback/submit.
  if (error) {
    console.error("[notify-feedback] Resend rechazó la notificación:", error)
  }
}
