/**
 * Registro con correo de confirmación propio de marca, sin depender del SMTP de
 * Supabase (bloqueado — necesita que alguien pegue la API key de Resend en el
 * dashboard de Supabase a mano, ver docs/53). supabase.auth.signUp() del lado del
 * cliente (el que usaba antes contexts/auth-context.tsx) dispara automáticamente el
 * correo GENÉRICO de confirmación de Supabase apenas se llama — no hay forma de
 * evitarlo desde ahí. admin.generateLink({type:"signup"}) en cambio CREA la cuenta
 * (sin confirmar) y devuelve el link de confirmación real, sin mandar ningún correo
 * por su cuenta — el envío lo hace esta ruta con Resend, con la plantilla de marca.
 *
 * El resto del flujo de app/signup/page.tsx no cambia: sigue intentando login()
 * justo después, que falla con el error real de Supabase "Email not confirmed"
 * mientras la cuenta no se confirme — esa parte no se simula, es el comportamiento
 * real de Supabase Auth.
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const profile = body?.profile || {}
  const preferredLanguage = normalizeEmailLang(profile.preferredLanguage)

  if (!email || !password) {
    return NextResponse.json({ error: "Falta el correo o la contraseña." }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const admin = getSupabaseAdminClient()

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: `${siteUrl}/dashboard`,
      data: {
        full_name: profile.fullName || "",
        nationality: profile.nationality || "",
        currency: profile.currency || "",
        business_type: profile.businessType || "",
        business_size: profile.businessSize || "",
        industry_experience: profile.industryExperience || "",
        preferred_language: preferredLanguage,
      },
    },
  })

  if (error || !data?.properties?.action_link) {
    console.error("[api/auth/signup] Error creando la cuenta:", error)
    return NextResponse.json({ error: error?.message || "No se pudo crear la cuenta." }, { status: 400 })
  }

  // Best-effort: la cuenta ya se creó arriba sin importar si este correo sale o no.
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const labels = getEmailLabels(preferredLanguage)
      const fullName = escapeHtml(profile.fullName || "chef")
      const html = renderEmailTemplate("01-confirmacion-correo.html", {
        htmlLang: preferredLanguage,
        title: labels.e01_title,
        preheader: labels.e01_preheader,
        heading: fillLabel(labels.e01_heading, { fullName }),
        body: fillLabel(labels.e01_body, { planName: escapeHtml(getPlanBySlug("foodie").name) }),
        cta: labels.e01_cta,
        footnote: labels.e01_footnote,
        footerAddress: labels.footer_address,
        footer2: labels.e01_footer2,
        confirmUrl: data.properties.action_link,
      })
      const { error: sendError } = await resend.emails.send({
        from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
        to: [email],
        subject: labels.e01_subject,
        html,
      })
      if (sendError) console.error("[api/auth/signup] Resend rechazó el envío:", sendError)
    } catch (emailError) {
      console.error("[api/auth/signup] Error inesperado mandando el correo:", emailError)
    }
  }

  return NextResponse.json({ ok: true })
}
