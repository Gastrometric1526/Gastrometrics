/**
 * Correo de "novedades del producto" — el único disparador es un clic humano en
 * /admin (components/admin/product-updates-panel.tsx), nunca algo automático al
 * hacer deploy o al agregar una entrada a lib/changelog.ts. Solo se manda a cuentas
 * con `profiles.product_updates_opt_in = true` (casilla del paso 4 del registro, o
 * cambiada después en Configuración → Notificaciones — ver supabase/migrations/
 * 0022_product_updates_optin.sql).
 *
 * GET: cuenta cuántas cuentas lo recibirían, sin mandar nada — para que el panel
 * muestre "esto le va a llegar a N personas" antes del botón real de enviar.
 * POST: manda de verdad, una sola vez por llamada (no hay programación ni reintento
 * automático — si Resend falla para alguien, queda en la lista de `failed` de la
 * respuesta y no se reintenta solo).
 */

import { NextResponse } from "next/server"
import { Resend } from "resend"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { getChangelogContent, LATEST_CHANGELOG_VERSION } from "@/lib/changelog"

async function getOptedInAccounts() {
  const admin = getSupabaseAdminClient()

  let allUsers: { id: string; email: string }[] = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    allUsers = allUsers.concat(data.users.map((u) => ({ id: u.id, email: u.email || "" })))
    if (data.users.length < 200) break
    page += 1
  }

  const { data: profileRows, error: profilesError } = await admin
    .from("profiles")
    .select("id, preferred_language, product_updates_opt_in")
    .eq("product_updates_opt_in", true)
  if (profilesError) throw profilesError

  const optedInIds = new Set((profileRows ?? []).map((r) => r.id))
  const langById = new Map((profileRows ?? []).map((r) => [r.id, r.preferred_language]))

  return allUsers
    .filter((u) => optedInIds.has(u.id) && u.email)
    .map((u) => ({ email: u.email, language: normalizeEmailLang(langById.get(u.id) || "es") }))
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const recipients = await getOptedInAccounts()
    return NextResponse.json({ count: recipients.length, version: LATEST_CHANGELOG_VERSION })
  } catch (error) {
    console.error("[api/admin/product-update-email] Error contando destinatarios:", error)
    return NextResponse.json({ error: "No se pudo contar los destinatarios." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Falta confirmar el envío." }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY no está configurada." }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const resend = new Resend(process.env.RESEND_API_KEY)

  let recipients: { email: string; language: ReturnType<typeof normalizeEmailLang> }[] = []
  try {
    recipients = await getOptedInAccounts()
  } catch (error) {
    console.error("[api/admin/product-update-email] Error obteniendo destinatarios:", error)
    return NextResponse.json({ error: "No se pudo obtener la lista de destinatarios." }, { status: 500 })
  }

  const sent: string[] = []
  const failed: string[] = []

  for (const recipient of recipients) {
    try {
      const labels = getEmailLabels(recipient.language)
      const changelog = getChangelogContent(recipient.language)
      const itemsHtml = changelog.items
        .map(
          (item) =>
            `<tr><td style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.55;color:#3A332E;padding:0 0 12px 22px;position:relative">&bull;&nbsp; ${escapeHtml(item)}</td></tr>`,
        )
        .join("")

      const html = renderEmailTemplate("08-novedades.html", {
        htmlLang: recipient.language,
        title: labels.e08_title,
        preheader: labels.e08_preheader,
        heading: labels.e08_heading,
        itemsHtml,
        cta: labels.e08_cta,
        ctaUrl: `${siteUrl}/dashboard`,
        footnote: labels.e08_footnote,
        footerAddress: labels.footer_address,
        footer2: labels.e08_footer2,
      })

      const { error: sendError } = await resend.emails.send({
        from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
        to: [recipient.email],
        subject: labels.e08_subject,
        html,
      })
      if (sendError) {
        console.error("[api/admin/product-update-email] Resend rechazó el envío:", recipient.email, sendError)
        failed.push(recipient.email)
      } else {
        sent.push(recipient.email)
      }
    } catch (error) {
      console.error("[api/admin/product-update-email] Error inesperado mandando a", recipient.email, error)
      failed.push(recipient.email)
    }
  }

  return NextResponse.json({ ok: true, sentCount: sent.length, failedCount: failed.length, failed })
}
