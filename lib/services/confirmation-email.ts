/**
 * Correo de confirmación de cuenta (plantilla 01) y su reenvío (docs/204).
 *
 * - `sendConfirmationEmail`: lo usa el registro (app/api/auth/signup) con el enlace de
 *   `generateLink({ type: "signup" })`.
 * - `resendConfirmation`: pedido del dueño — si el correo no llegó (o rebotó por un problema
 *   pasajero) se puede volver a mandar desde la pantalla «Revisa tu correo», desde el inicio de
 *   sesión y desde /admin. Genera un enlace de acceso de un solo uso (`magiclink`): abrirlo
 *   confirma el correo igual que el original (Supabase marca `email_confirmed_at` al verificar)
 *   y deja la sesión iniciada en /dashboard. Como mucho uno por minuto por cuenta
 *   (`app_metadata.confirmation_resent_at`).
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { getPlanBySlug } from "@/lib/plans"

export const RESEND_COOLDOWN_MS = 60_000

/** Devuelve true si el correo salió. Nunca lanza. */
export async function sendConfirmationEmail(input: { email: string; actionLink: string; fullName?: string | null; language?: string | null }): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try {
    const language = normalizeEmailLang(input.language)
    const labels = getEmailLabels(language)
    const fullName = escapeHtml(input.fullName || "chef")
    const html = renderEmailTemplate("01-confirmacion-correo.html", {
      htmlLang: language,
      title: labels.e01_title,
      preheader: labels.e01_preheader,
      heading: fillLabel(labels.e01_heading, { fullName }),
      body: fillLabel(labels.e01_body, { planName: escapeHtml(getPlanBySlug("foodie").name) }),
      cta: labels.e01_cta,
      footnote: labels.e01_footnote,
      footerAddress: labels.footer_address,
      footer2: labels.e01_footer2,
      confirmUrl: input.actionLink,
    })
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await sendWithRetry(resend, {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [input.email],
      subject: labels.e01_subject,
      html,
    })
    if (error) {
      console.error("[confirmation-email] Resend rechazó el envío:", error)
      return false
    }
    return true
  } catch (error) {
    console.error("[confirmation-email] Error inesperado:", error)
    return false
  }
}

export type ResendResult = "sent" | "already_confirmed" | "not_found" | "too_soon" | "error"

async function findUserByEmail(email: string) {
  const admin = getSupabaseAdminClient()
  const target = email.trim().toLowerCase()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => (u.email || "").toLowerCase() === target)
    if (user) return user
    if (data.users.length < 200) return null
  }
}

/** Reenvía el correo de confirmación a una cuenta sin confirmar (por correo o por id). */
export async function resendConfirmation(by: { email?: string; userId?: string }, now = Date.now()): Promise<ResendResult> {
  try {
    const admin = getSupabaseAdminClient()
    const user = by.userId ? (await admin.auth.admin.getUserById(by.userId)).data?.user ?? null : by.email ? await findUserByEmail(by.email) : null
    if (!user?.email) return "not_found"
    if (user.email_confirmed_at || (user as { confirmed_at?: string | null }).confirmed_at) return "already_confirmed"
    const meta = (user.app_metadata || {}) as Record<string, unknown>
    const last = typeof meta.confirmation_resent_at === "string" ? new Date(meta.confirmation_resent_at).getTime() : 0
    if (now - last < RESEND_COOLDOWN_MS) return "too_soon"

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email, options: { redirectTo: `${siteUrl}/dashboard` } })
    if (error || !data?.properties?.action_link) {
      console.error("[confirmation-email] No se pudo generar el enlace:", error)
      return "error"
    }
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...meta, confirmation_resent_at: new Date(now).toISOString() } })

    const { data: profile } = await admin.from("profiles").select("full_name, preferred_language").eq("id", user.id).maybeSingle()
    const um = (user.user_metadata || {}) as { full_name?: string; preferred_language?: string }
    const sent = await sendConfirmationEmail({
      email: user.email,
      actionLink: data.properties.action_link,
      fullName: profile?.full_name || um.full_name,
      language: profile?.preferred_language || um.preferred_language,
    })
    return sent ? "sent" : "error"
  } catch (error) {
    console.error("[confirmation-email] Error reenviando:", error)
    return "error"
  }
}
