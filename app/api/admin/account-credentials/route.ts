/**
 * Asistencia real de soporte a una cuenta — pedido explícito del dueño del proyecto:
 * "debo poder dar full asistencia a cualquier usuario, cambiar correo, cambiar
 * contraseña". Todo detrás de hasAdminSession() (misma cookie que el resto de /admin).
 *
 * PATCH cambia el correo directo, sin pasar por el flujo de confirmación normal — el
 * administrador ya validó la identidad de la persona fuera de la app (por eso está
 * asistiéndola), no tiene sentido pedirle a esa cuenta que confirme un correo que el
 * propio administrador ya aplicó a mano.
 *
 * POST tiene dos acciones para contraseña, cada una para un caso real distinto:
 * - "send-reset-email": la persona SÍ tiene acceso a su correo, solo perdió la
 *   contraseña — se le manda el mismo correo de marca que ya usa /forgot-password
 *   (misma plantilla, mismo remitente), no un correo genérico de Supabase.
 * - "set-temp-password": la persona NO tiene acceso a su correo tampoco (o el soporte
 *   es por teléfono/chat y hace falta una contraseña ya mismo) — genera una
 *   contraseña temporal aleatoria del lado del servidor (nunca la escribe el
 *   administrador a mano, para no terminar con contraseñas débiles tipo "123456") y la
 *   devuelve una sola vez en la respuesta para que el administrador se la pase a la
 *   persona por un canal seguro. La cuenta debería cambiarla apenas entre.
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang, EMAIL_DATE_LOCALES } from "@/lib/i18n/email-labels"

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === "string" ? body.userId : undefined
  const email = typeof body?.email === "string" ? body.email.trim() : undefined
  if (!userId || !email) {
    return NextResponse.json({ error: "Falta el userId o el correo nuevo." }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
    if (error) throw error
    return NextResponse.json({ ok: true, email: data.user.email })
  } catch (error: any) {
    console.error("[api/admin/account-credentials PATCH] Error cambiando el correo:", error)
    return NextResponse.json({ error: error?.message || "No se pudo cambiar el correo." }, { status: 500 })
  }
}

// Sin caracteres ambiguos (0/O, 1/l/I) — es una contraseña que alguien va a tener que
// leer en voz alta o copiar a mano desde un chat de soporte.
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

function generateTempPassword(length = 12): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_CHARS[Math.floor(Math.random() * TEMP_PASSWORD_CHARS.length)]
  }
  return out
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === "string" ? body.userId : undefined
  const action = typeof body?.action === "string" ? body.action : undefined
  const email = typeof body?.email === "string" ? body.email : undefined

  if (!userId || !action) {
    return NextResponse.json({ error: "Falta el userId o la acción." }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()

  if (action === "set-temp-password") {
    try {
      const tempPassword = generateTempPassword()
      const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword })
      if (error) throw error
      return NextResponse.json({ ok: true, tempPassword })
    } catch (error: any) {
      console.error("[api/admin/account-credentials POST] Error generando contraseña temporal:", error)
      return NextResponse.json({ error: error?.message || "No se pudo generar la contraseña temporal." }, { status: 500 })
    }
  }

  if (action === "send-reset-email") {
    if (!email) {
      return NextResponse.json({ error: "Falta el correo de la cuenta." }, { status: 400 })
    }
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/reset-password` },
      })
      if (error || !data?.properties?.action_link) {
        console.error("[api/admin/account-credentials POST] Error generando el enlace de recuperación:", error)
        return NextResponse.json({ error: "No se pudo generar el enlace de recuperación." }, { status: 500 })
      }
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: "RESEND_API_KEY no está configurada en este entorno." }, { status: 500 })
      }

      const { data: profileRow } = await admin
        .from("profiles")
        .select("preferred_language")
        .eq("id", userId)
        .maybeSingle()
      const preferredLanguage = profileRow?.preferred_language || "es"
      const labels = getEmailLabels(preferredLanguage)
      const resend = new Resend(process.env.RESEND_API_KEY)
      const html = renderEmailTemplate("03-cambio-contrasena.html", {
        htmlLang: preferredLanguage,
        title: labels.e03_title,
        preheader: labels.e03_preheader,
        heading: labels.e03_heading,
        body: fillLabel(labels.e03_body, { email: escapeHtml(email) }),
        cta: labels.e03_cta,
        labelRequest: labels.e03_label_request,
        labelDevice: labels.e03_label_device,
        labelExpires: labels.e03_label_expires,
        valueExpires: labels.e03_value_expires,
        footnote: labels.e03_footnote,
        footerAddress: labels.footer_address,
        footer2: labels.e03_footer2,
        resetUrl: data.properties.action_link,
        requestedAt: new Date().toLocaleString(EMAIL_DATE_LOCALES[normalizeEmailLang(preferredLanguage)], {
          dateStyle: "long",
          timeStyle: "short",
        }),
        device: labels.e03_device_admin_requested,
      })

      const { error: sendError } = await resend.emails.send({
        from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
        to: [email],
        subject: labels.e03_subject,
        html,
      })
      if (sendError) throw sendError

      return NextResponse.json({ ok: true })
    } catch (error: any) {
      console.error("[api/admin/account-credentials POST] Error mandando el correo de recuperación:", error)
      return NextResponse.json({ error: error?.message || "No se pudo mandar el correo." }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 })
}
