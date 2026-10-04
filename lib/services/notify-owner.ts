/**
 * Avisos al dueño del proyecto (docs/143): negocio nuevo e invitación a un equipo,
 * además de la cuenta nueva (notify-signup.ts). Mismas variables que el resto de los
 * avisos al dueño (FEEDBACK_NOTIFY_TO / FEEDBACK_NOTIFY_FROM), con reintentos
 * (sendWithRetry). Nunca lanza: devuelve true si salió. Si falla, el resumen diario del
 * cron (sendDailySignupDigest) igual lista el negocio o la invitación al día siguiente.
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { escapeHtml } from "./email-templates"

export function ownerAdminLink(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gastrometrics.org"
  return `${siteUrl}/admin`
}

export function hondurasTime(date: Date | string = new Date()): string {
  return new Date(date).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })
}

/** HTML simple de un aviso: filas etiqueta → valor. Puro (cubierto por pruebas). */
export function renderOwnerNotification(rows: [string, string | undefined | null][], footnote: string): string {
  return `
    ${rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`)
      .join("")}
    <hr/>
    <p style="color:#888;font-size:12px">${escapeHtml(footnote)} Detalle en <a href="${ownerAdminLink()}">/admin</a>.</p>
  `
}

export async function sendOwnerNotification(input: {
  subject: string
  rows: [string, string | undefined | null][]
  footnote: string
  label: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.FEEDBACK_NOTIFY_TO) {
    console.error(`[notify-owner] Falta RESEND_API_KEY o FEEDBACK_NOTIFY_TO: no se mandó "${input.label}"`)
    return false
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(
    resend,
    {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [process.env.FEEDBACK_NOTIFY_TO as string],
      subject: `[GastroMetrics] ${input.subject}`,
      html: renderOwnerNotification(input.rows, input.footnote),
    },
    input.label,
  )
  if (error) {
    console.error(`[notify-owner] Resend rechazó "${input.label}":`, error)
    return false
  }
  return true
}
