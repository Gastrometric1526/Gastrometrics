/**
 * Le avisa al dueño del proyecto por correo cada vez que alguien crea una cuenta
 * nueva (app/api/auth/signup/route.ts) — mismo patrón y mismas variables de entorno
 * que lib/services/notify-feedback.ts (FEEDBACK_NOTIFY_TO/FEEDBACK_NOTIFY_FROM), solo
 * que para un evento distinto. Reutiliza el mismo par de variables a propósito: ya
 * apuntan a la casilla real del dueño (gastrometrics@outlook.com) y ya están
 * configuradas tanto en local como en Vercel, así que no hace falta agregar nada
 * nuevo para que esto funcione. Best-effort: si Resend no está configurado o falla,
 * no debe romper el registro de la cuenta (que ya se creó antes de llamar a esto).
 */

import { Resend } from "resend"
import { escapeHtml } from "./email-templates"

export async function sendAccountCreatedNotification(input: {
  email: string
  fullName?: string
  businessType?: string
  nationality?: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.FEEDBACK_NOTIFY_TO) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [process.env.FEEDBACK_NOTIFY_TO as string],
    subject: `[GastroMetrics] Nueva cuenta creada: ${input.email}`,
    html: `
      <p><strong>Correo:</strong> ${escapeHtml(input.email)}</p>
      ${input.fullName ? `<p><strong>Nombre:</strong> ${escapeHtml(input.fullName)}</p>` : ""}
      ${input.businessType ? `<p><strong>Tipo de negocio:</strong> ${escapeHtml(input.businessType)}</p>` : ""}
      ${input.nationality ? `<p><strong>País:</strong> ${escapeHtml(input.nationality)}</p>` : ""}
      <hr/>
      <p style="color:#888;font-size:12px">Cuenta creada el ${escapeHtml(new Date().toLocaleString("es-HN"))}. Revisa el detalle desde el panel /admin.</p>
    `,
  })
  // El SDK de Resend no lanza en errores de la API — los devuelve en `error` sin lanzar
  // (mismo hallazgo que en notify-feedback.ts, ver docs/53). Se loguea en vez de lanzar
  // porque esto no debe romper el registro de la cuenta, que ya ocurrió antes.
  if (error) {
    console.error("[notify-signup] Resend rechazó la notificación:", error)
  }
}
