/**
 * Correo «Te dieron acceso al panel de administración» (docs/282). Mismo patrón que la
 * invitación de Equipo (app/api/team/invite/route.ts): `admin.generateLink()` crea el
 * enlace sin que Supabase mande su propio correo, y lo manda esta app con Resend.
 *
 * - Correo sin cuenta: enlace de invitación (`type: "invite"`) que lleva a /reset-password
 *   para crear su contraseña; la marca `admin_invite` en sus datos hace que, al guardarla,
 *   la página la lleve directo a /admin.
 * - Correo con cuenta: no hace falta contraseña nueva; el botón lleva a /admin, donde
 *   entra con su cuenta. Nunca se manda un enlace que inicie sesión solo.
 * El panel es interno y del dueño, así que el correo va en español.
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendWithRetry } from "@/lib/services/send-email"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels } from "@/lib/i18n/email-labels"
import { canonicalSiteUrl } from "@/lib/site-url"

export type AdminInviteResult = { ok: true; newAccount: boolean } | { ok: false; error: "email_not_configured" | "link_failed" | "send_failed" }

export async function sendAdminInvite(input: { email: string; invitedBy: string | null }): Promise<AdminInviteResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "email_not_configured" }
  const admin = getSupabaseAdminClient()
  const siteUrl = canonicalSiteUrl()

  let actionUrl = `${siteUrl}/admin`
  let newAccount = false
  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: { redirectTo: `${siteUrl}/reset-password`, data: { admin_invite: true } },
  })
  if (invite.data?.properties?.action_link) {
    actionUrl = invite.data.properties.action_link
    newAccount = true
  } else {
    const message = invite.error?.message?.toLowerCase() || ""
    const alreadyHasAccount = message.includes("already") || message.includes("registrad")
    if (!alreadyHasAccount) {
      console.error("[admin-invite] no se pudo crear el enlace:", invite.error?.message)
      return { ok: false, error: "link_failed" }
    }
  }

  const labels = getEmailLabels("es")
  const who = input.invitedBy ? escapeHtml(input.invitedBy) : "El dueño de GastroMetrics"
  const body = newAccount
    ? `${who} te dio acceso al panel de administración de GastroMetrics. Ahí ves las cuentas, los mensajes del chat y de /contacto, los cobros y cómo va la app.<br><br>Toca el botón para crear tu contraseña. Después entras al panel con este correo y esa contraseña. La primera vez te mostramos un recorrido por todo el panel.`
    : `${who} te dio acceso al panel de administración de GastroMetrics. Ahí ves las cuentas, los mensajes del chat y de /contacto, los cobros y cómo va la app.<br><br>Como ya tienes cuenta, entra con tu correo y tu contraseña de siempre. La primera vez te mostramos un recorrido por todo el panel.`

  const html = renderEmailTemplate("07-activacion.html", {
    htmlLang: "es",
    title: "Tienes acceso al panel de administración",
    preheader: "Te dieron acceso al panel de administración de GastroMetrics.",
    heading: "Tienes acceso al panel de administración",
    body,
    cta: newAccount ? "Crear mi contraseña" : "Entrar al panel",
    footnote: newAccount
      ? "El enlace es personal y vence en 24 horas. Si vence, pide que te reenvíen la invitación. Si no esperabas este correo, ignóralo."
      : "Si no esperabas este correo, ignóralo: nadie puede entrar a tu cuenta con él.",
    footerAddress: labels.footer_address,
    footer2: "Recibes este correo porque te dieron acceso al panel de administración.",
    actionUrl,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(
    resend,
    {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [input.email],
      subject: "Tienes acceso al panel de administración de GastroMetrics",
      html,
    },
    "invitación al panel",
  )
  if (error) {
    console.error("[admin-invite] Resend rechazó el envío:", error)
    return { ok: false, error: "send_failed" }
  }
  return { ok: true, newAccount }
}
