import { ActivityTracker } from "@/lib/activity-tracker"

// Hardcoded configuration - no environment variables needed
const EMAIL_CONFIG = {
  appUrl: "http://localhost:3000",
  emailFrom: "GastroMetrics <noreply@gastrometrics.app>",
  appName: "GastroMetrics",
}

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

// Email templates
function getWelcomeEmailTemplate(userName: string, userEmail: string): EmailTemplate {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a ${EMAIL_CONFIG.appName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .content h2 { color: #333; font-size: 24px; margin-bottom: 20px; }
          .content p { margin-bottom: 15px; color: #666; }
          .button { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: 600; }
          .features { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .features ul { margin: 0; padding-left: 20px; }
          .features li { margin-bottom: 10px; color: #666; }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a ${EMAIL_CONFIG.appName}! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hola ${userName},</h2>
            <p>¡Gracias por unirte a ${EMAIL_CONFIG.appName}! Estamos emocionados de tenerte con nosotros.</p>
            <p>Tu cuenta ha sido creada exitosamente con el correo: <strong>${userEmail}</strong></p>
            
            <div class="features">
              <h3 style="margin-top: 0; color: #333;">¿Qué puedes hacer ahora?</h3>
              <ul>
                <li>Crear y gestionar tus recetas con fichas técnicas detalladas</li>
                <li>Administrar tu inventario de ingredientes</li>
                <li>Generar órdenes de compra inteligentes</li>
                <li>Analizar costos y márgenes de ganancia</li>
                <li>Crear menús y realizar análisis de escenarios</li>
              </ul>
            </div>

            <p style="text-align: center;">
              <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">Ir al Dashboard</a>
            </p>

            <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
            <p>¡Que tengas un excelente día!</p>
            <p style="margin-top: 30px;"><strong>El equipo de ${EMAIL_CONFIG.appName}</strong></p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} ${EMAIL_CONFIG.appName}. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    ¡Bienvenido a ${EMAIL_CONFIG.appName}!

    Hola ${userName},

    ¡Gracias por unirte a ${EMAIL_CONFIG.appName}! Estamos emocionados de tenerte con nosotros.

    Tu cuenta ha sido creada exitosamente con el correo: ${userEmail}

    ¿Qué puedes hacer ahora?
    - Crear y gestionar tus recetas con fichas técnicas detalladas
    - Administrar tu inventario de ingredientes
    - Generar órdenes de compra inteligentes
    - Analizar costos y márgenes de ganancia
    - Crear menús y realizar análisis de escenarios

    Visita tu dashboard: ${EMAIL_CONFIG.appUrl}/dashboard

    Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.

    ¡Que tengas un excelente día!

    El equipo de ${EMAIL_CONFIG.appName}
  `

  return {
    subject: `¡Bienvenido a ${EMAIL_CONFIG.appName}! 🎉`,
    html,
    text,
  }
}

function getVerificationEmailTemplate(userName: string, verificationCode: string): EmailTemplate {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu cuenta</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .content h2 { color: #333; font-size: 24px; margin-bottom: 20px; }
          .content p { margin-bottom: 15px; color: #666; }
          .code-box { background-color: #f9f9f9; border: 2px dashed #667eea; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; }
          .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace; }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verifica tu cuenta</h1>
          </div>
          <div class="content">
            <h2>Hola ${userName},</h2>
            <p>Gracias por registrarte en ${EMAIL_CONFIG.appName}. Para completar tu registro, por favor verifica tu correo electrónico.</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Tu código de verificación es:</p>
              <div class="code">${verificationCode}</div>
            </div>

            <p>Este código expirará en 24 horas.</p>
            <p>Si no solicitaste esta verificación, puedes ignorar este correo de forma segura.</p>
            <p style="margin-top: 30px;"><strong>El equipo de ${EMAIL_CONFIG.appName}</strong></p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>&copy; ${new Date().getFullYear()} ${EMAIL_CONFIG.appName}. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
    Verifica tu cuenta - ${EMAIL_CONFIG.appName}

    Hola ${userName},

    Gracias por registrarte en ${EMAIL_CONFIG.appName}. Para completar tu registro, por favor verifica tu correo electrónico.

    Tu código de verificación es: ${verificationCode}

    Este código expirará en 24 horas.

    Si no solicitaste esta verificación, puedes ignorar este correo de forma segura.

    El equipo de ${EMAIL_CONFIG.appName}
  `

  return {
    subject: `Verifica tu cuenta en ${EMAIL_CONFIG.appName}`,
    html,
    text,
  }
}

// Simulate email sending
async function simulateEmailSend(to: string, subject: string, text: string): Promise<boolean> {
  console.log("📧 [EMAIL SIMULATION] Email would be sent:")
  console.log("  To:", to)
  console.log("  Subject:", subject)
  console.log("  Content:", text.substring(0, 100) + "...")

  await new Promise((resolve) => setTimeout(resolve, 500))

  return true
}

// Send welcome email
export async function sendWelcomeEmail(user: { email: string; fullName: string }) {
  const template = getWelcomeEmailTemplate(user.fullName, user.email)

  const success = await simulateEmailSend(user.email, template.subject, template.text)

  if (success) {
    ActivityTracker.addActivity(`Email de bienvenida simulado para ${user.email}`, "business", undefined, {
      type: "email",
      action: "welcome_email",
      recipient: user.email,
    })
  }

  return { success, simulated: true }
}

// Send verification email
export async function sendVerificationEmail(user: { email: string; fullName: string }, verificationToken: string) {
  const template = getVerificationEmailTemplate(user.fullName, verificationToken)

  const success = await simulateEmailSend(user.email, template.subject, template.text)

  if (success) {
    ActivityTracker.addActivity(`Email de verificación simulado para ${user.email}`, "business", undefined, {
      type: "email",
      action: "verification_email",
      recipient: user.email,
    })
  }

  return { success, simulated: true }
}
