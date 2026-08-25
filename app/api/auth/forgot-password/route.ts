/**
 * Recuperación de contraseña con correo propio de marca, sin depender del SMTP de
 * Supabase (que sigue bloqueado — necesita que alguien pegue la API key de Resend
 * en el dashboard de Supabase a mano, ver docs/53). En vez de
 * supabase.auth.resetPasswordForEmail (que dispara el correo GENÉRICO de Supabase
 * automáticamente), esta ruta usa admin.generateLink({type:"recovery"}) — eso genera
 * el link de recuperación real SIN mandar ningún correo por su cuenta — y el envío
 * lo hace esta ruta con Resend, usando la plantilla de marca.
 *
 * A propósito nunca revela si el correo existe o no: generateLink falla con un
 * usuario inexistente, pero la respuesta es siempre {sent:true} de todas formas —
 * mismo criterio que ya tenía app/forgot-password/page.tsx.
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireSupabaseServiceRoleEnv } from "@/lib/supabase/env"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang, EMAIL_DATE_LOCALES, type EmailLabelKeys } from "@/lib/i18n/email-labels"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

function describeDevice(userAgent: string | null, labels: Record<EmailLabelKeys, string>): string {
  if (!userAgent) return labels.device_unknown
  const ua = userAgent.toLowerCase()
  let os = labels.device_fallback_os
  if (ua.includes("windows")) os = "Windows"
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "Mac"
  else if (ua.includes("android")) os = "Android"
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS"
  else if (ua.includes("linux")) os = "Linux"

  let browser = labels.device_fallback_browser
  if (ua.includes("edg/")) browser = "Edge"
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome"
  else if (ua.includes("firefox/")) browser = "Firefox"
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari"

  return `${browser} ${labels.device_connector} ${os}`
}

// La cuenta puede ya tener un idioma guardado (profiles.preferred_language, elegido en
// la UI o al registrarse) — esta ruta no tiene sesión (nadie logueado pide su propia
// recuperación), así que hay que buscarlo por correo contra la API admin de Supabase en
// vez de leerlo de una cookie/sesión. Si algo falla, sigue en español (mismo criterio
// anti-enumeración que el resto de la función: nunca revela si el correo existe).
async function lookupPreferredLanguage(email: string): Promise<string> {
  try {
    const { url, serviceRoleKey } = requireSupabaseServiceRoleEnv()
    const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    })
    if (!res.ok) return "es"
    const data = await res.json()
    const userId = data?.users?.[0]?.id
    if (!userId) return "es"

    const admin = getSupabaseAdminClient()
    const { data: profileRow } = await admin.from("profiles").select("preferred_language").eq("id", userId).maybeSingle()
    return profileRow?.preferred_language || "es"
  } catch {
    return "es"
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  if (!email) {
    return NextResponse.json({ sent: true }) // no revela nada, igual que si el correo no existiera
  }

  // Límite por IP contra bombardeo de correos de recuperación (ver docs/61) — responde
  // {sent:true} igual que siempre en vez de un error distinto, para no convertir el
  // propio límite en una forma de adivinar si un correo existe por la diferencia de
  // respuesta.
  const rateLimit = checkRateLimit(`forgot-password:${getClientIp(request)}`, {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ sent: true })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  try {
    const admin = getSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    })

    if (error || !data?.properties?.action_link) {
      // Correo no existe, o cualquier otro error — no se revela, se responde igual.
      return NextResponse.json({ sent: true })
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("[api/auth/forgot-password] RESEND_API_KEY no configurada — no se pudo mandar el correo.")
      return NextResponse.json({ sent: true })
    }

    const preferredLanguage = await lookupPreferredLanguage(email)
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
      device: escapeHtml(describeDevice(request.headers.get("user-agent"), labels)),
    })

    const { error: sendError } = await resend.emails.send({
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [email],
      subject: labels.e03_subject,
      html,
    })
    if (sendError) {
      console.error("[api/auth/forgot-password] Resend rechazó el envío:", sendError)
    }

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("[api/auth/forgot-password] Error inesperado:", error)
    return NextResponse.json({ sent: true })
  }
}
