import { NextResponse } from "next/server"
import { Resend } from "resend"
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE_NAME, createAdminLinkToken, createAdminSessionValue, readAdminLinkToken } from "@/lib/admin-auth"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getAdminMember, recordAdminLogin } from "@/lib/admin/members-server"
import { canSignIn } from "@/lib/admin/members"
import { sendWithRetry } from "@/lib/services/send-email"
import { renderEmailTemplate } from "@/lib/services/email-templates"
import { getEmailLabels } from "@/lib/i18n/email-labels"
import { canonicalSiteUrl } from "@/lib/site-url"

/**
 * Entrar a /admin con un enlace al correo, sin contraseña y sin abrir la sesión de la app
 * (pedido del dueño, docs/298). Sirve también para quien entra a la app con Google y no
 * tiene contraseña.
 *
 * - POST { email }: si ese correo tiene acceso al panel, le manda el enlace (vence en 15
 *   minutos y sirve una vez). La respuesta es siempre la misma: no dice si el correo tiene
 *   acceso.
 * - POST { token }: lo usa /admin?entrar=… al tocar «Entrar». El enlace no entra solo al
 *   abrirse, para que los revisores de enlaces de los correos (Outlook y otros) no lo gasten.
 */

const SEND_LIMIT = { maxAttempts: 3, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 }
const REDEEM_LIMIT = { maxAttempts: 10, windowMs: 10 * 60_000, lockoutMs: 15 * 60_000 }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const ip = getClientIp(request)

  if (typeof body?.token === "string") {
    const limit = checkRateLimit(`admin-link-redeem:${ip}`, REDEEM_LIMIT)
    if (!limit.allowed) return NextResponse.json({ ok: false, error: "locked" }, { status: 429 })
    const email = await readAdminLinkToken(body.token.slice(0, 500), async (who) => {
      const { ready, member } = await getAdminMember(who)
      return ready && member && canSignIn(member) ? member.last_login_at : undefined
    })
    if (!email) return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 401 })
    const { member } = await getAdminMember(email)
    if (!member || !canSignIn(member)) return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 401 })
    await recordAdminLogin(member)
    const value = createAdminSessionValue(Date.now(), { kind: "account", email })
    if (!value) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
    const response = NextResponse.json({ ok: true, role: member.role, firstTime: member.status !== "active" })
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, value, ADMIN_COOKIE_OPTIONS)
    return response
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  if (!email.includes("@")) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 })
  const byIp = checkRateLimit(`admin-link-send:${ip}`, SEND_LIMIT)
  const byEmail = checkRateLimit(`admin-link-send:${email}`, SEND_LIMIT)
  if (!byIp.allowed || !byEmail.allowed) return NextResponse.json({ ok: false, error: "locked" }, { status: 429 })

  // Igual respuesta tenga o no acceso: nunca se revela quién entra al panel.
  const same = NextResponse.json({ ok: true })
  const { ready, member } = await getAdminMember(email)
  if (!ready || !member || !canSignIn(member) || !process.env.RESEND_API_KEY) return same
  const token = createAdminLinkToken(email, member.last_login_at)
  if (!token) return same

  const labels = getEmailLabels("es")
  const html = renderEmailTemplate("07-activacion.html", {
    htmlLang: "es",
    title: "Tu enlace para entrar al panel",
    preheader: "Entra al panel de administración de GastroMetrics sin contraseña.",
    heading: "Tu enlace para entrar al panel",
    body: "Pediste entrar al panel de administración de GastroMetrics. Toca el botón y luego «Entrar». No abre tu sesión en la app.",
    cta: "Entrar al panel",
    footnote: "El enlace vence en 15 minutos y sirve una sola vez. Si no lo pediste, ignora este correo: nadie puede entrar sin él.",
    footerAddress: labels.footer_address,
    footer2: "Recibes este correo porque tienes acceso al panel de administración.",
    actionUrl: `${canonicalSiteUrl()}/admin?entrar=${encodeURIComponent(token)}`,
  })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(
    resend,
    {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [email],
      subject: "Tu enlace para entrar al panel de GastroMetrics",
      html,
    },
    "enlace al panel",
  )
  if (error) console.error("[admin-email-link] Resend rechazó el envío:", error)
  return same
}
