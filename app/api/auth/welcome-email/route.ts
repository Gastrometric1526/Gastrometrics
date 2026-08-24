/**
 * Correo de bienvenida real al completar /signup. Antes vivía en
 * lib/services/email.service.tsx y solo simulaba el envío (console.log) — además
 * corría del lado del cliente, donde RESEND_API_KEY nunca está disponible (no tiene
 * prefijo NEXT_PUBLIC_), así que un envío real ahí habría sido imposible sin exponer
 * la clave. Esta ruta hace el envío real del lado del servidor, igual que
 * lib/services/notify-feedback.ts. Best-effort: si falla o no hay RESEND_API_KEY
 * configurada, no bloquea el registro (ver app/signup/page.tsx).
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"

function getWelcomeEmailHtml(fullName: string, email: string, dashboardUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a GastroMetrics</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #e5601a 0%, #c94a10 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">¡Bienvenido a GastroMetrics! 🎉</h1>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hola ${fullName},</h2>
            <p style="margin-bottom: 15px; color: #666;">¡Gracias por unirte a GastroMetrics! Estamos emocionados de tenerte con nosotros.</p>
            <p style="margin-bottom: 15px; color: #666;">Tu cuenta ha sido creada exitosamente con el correo: <strong>${email}</strong></p>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">¿Qué puedes hacer ahora?</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px; color: #666;">Crear y gestionar tus recetas con fichas técnicas detalladas</li>
                <li style="margin-bottom: 10px; color: #666;">Administrar tu inventario de ingredientes</li>
                <li style="margin-bottom: 10px; color: #666;">Generar órdenes de compra inteligentes</li>
                <li style="margin-bottom: 10px; color: #666;">Analizar costos y márgenes de ganancia</li>
                <li style="margin-bottom: 10px; color: #666;">Crear menús y realizar análisis de escenarios</li>
              </ul>
            </div>
            <p style="text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #e5601a 0%, #c94a10 100%); color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: 600;">Ir al Dashboard</a>
            </p>
            <p style="margin-bottom: 15px; color: #666;">Si tienes alguna pregunta o necesitas ayuda, escríbenos desde /contacto.</p>
            <p style="margin-top: 30px; color: #666;"><strong>El equipo de GastroMetrics</strong></p>
          </div>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} GastroMetrics. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const fullName = typeof body?.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : "chef"

  if (!email) {
    return NextResponse.json({ sent: false, error: "Falta el correo." }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: false, error: "Resend no configurado." })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [email],
      subject: "¡Bienvenido a GastroMetrics! 🎉",
      html: getWelcomeEmailHtml(fullName, email, `${siteUrl}/dashboard`),
    })
    // El SDK de Resend no lanza en errores de la API (dominio no verificado, destinatario
    // rechazado, etc.) — los devuelve en `error` sin lanzar. Sin este chequeo, un envío
    // fallido se reportaba como `sent: true` igual (bug real encontrado probando esta
    // misma ruta, ver docs/53).
    if (error) {
      console.error("[api/auth/welcome-email] Resend rechazó el envío:", error)
      return NextResponse.json({ sent: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error("[api/auth/welcome-email] Error mandando el correo:", error)
    return NextResponse.json({ sent: false, error: "Error al enviar." }, { status: 500 })
  }
}
