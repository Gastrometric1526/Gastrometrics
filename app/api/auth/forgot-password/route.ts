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
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido"
  const ua = userAgent.toLowerCase()
  let os = "un dispositivo"
  if (ua.includes("windows")) os = "Windows"
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "Mac"
  else if (ua.includes("android")) os = "Android"
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS"
  else if (ua.includes("linux")) os = "Linux"

  let browser = "un navegador"
  if (ua.includes("edg/")) browser = "Edge"
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome"
  else if (ua.includes("firefox/")) browser = "Firefox"
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari"

  return `${browser} en ${os}`
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  if (!email) {
    return NextResponse.json({ sent: true }) // no revela nada, igual que si el correo no existiera
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

    const resend = new Resend(process.env.RESEND_API_KEY)
    const html = renderEmailTemplate("03-cambio-contrasena.html", {
      email: escapeHtml(email),
      resetUrl: data.properties.action_link,
      requestedAt: new Date().toLocaleString("es-HN", { dateStyle: "long", timeStyle: "short" }),
      device: escapeHtml(describeDevice(request.headers.get("user-agent"))),
    })

    const { error: sendError } = await resend.emails.send({
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [email],
      subject: "Restablece tu contraseña de GastroMetrics",
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
