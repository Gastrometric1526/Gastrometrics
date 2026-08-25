/**
 * Manda la invitación de equipo real (plantilla 04-invitacion-equipo.html, ver
 * lib/email-templates/LEEME.md) cuando alguien invita desde /equipo. Antes,
 * inviteTeamMember() (lib/storage/team.ts) solo guardaba la configuración en
 * localStorage — nunca mandaba correo ni le daba a la persona invitada su propia
 * cuenta. Igual que signup/forgot-password (ver docs/53), se usa
 * admin.generateLink() para crear/enlazar la cuenta real de la persona invitada SIN
 * pasar por el correo genérico de Supabase, y esta ruta manda el correo de marca con
 * Resend.
 *
 * type:"invite" crea la cuenta si el correo es nuevo. Si el correo ya tiene cuenta en
 * Supabase (por ejemplo, alguien que ya se registró por su cuenta o ya es tester),
 * generateLink con "invite" falla — en ese caso se cae a type:"magiclink", que sí
 * funciona contra una cuenta existente y la lleva directo a /dashboard sin pedirle
 * que ponga contraseña de nuevo.
 *
 * Límite real de alcance, documentado también en el aviso de /equipo: este correo y
 * la cuenta que crea son reales, pero GastroMetrics todavía no tiene la tabla de
 * membresías (business_members, Fase 4) que conecte esa cuenta nueva con el negocio/
 * alcance específico al que se le invitó — la persona invitada puede iniciar sesión
 * de verdad, pero no aterriza automáticamente dentro del negocio del dueño.
 */
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const scopeLabel = typeof body?.scopeLabel === "string" ? body.scopeLabel : ""
  const toolsLabel = typeof body?.toolsLabel === "string" ? body.toolsLabel : ""
  const pdfAccessLabel = typeof body?.pdfAccessLabel === "string" ? body.pdfAccessLabel : ""

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 })
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, preferred_language")
    .eq("id", user.id)
    .maybeSingle()
  const ownerName = profileRow?.full_name || user.email || "Un usuario de GastroMetrics"
  const labels = getEmailLabels(profileRow?.preferred_language)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const admin = getSupabaseAdminClient()

  let actionLink: string | null = null

  const inviteAttempt = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${siteUrl}/reset-password`,
      data: { invited_by: user.id, invited_by_name: ownerName },
    },
  })

  if (inviteAttempt.data?.properties?.action_link) {
    actionLink = inviteAttempt.data.properties.action_link
  } else {
    const message = inviteAttempt.error?.message?.toLowerCase() || ""
    const alreadyHasAccount = message.includes("already") || message.includes("registrad")
    if (!alreadyHasAccount) {
      return NextResponse.json({ error: inviteAttempt.error?.message || "No se pudo generar la invitación." }, { status: 400 })
    }

    const magicLinkAttempt = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/dashboard` },
    })
    if (!magicLinkAttempt.data?.properties?.action_link) {
      return NextResponse.json(
        { error: magicLinkAttempt.error?.message || "No se pudo generar la invitación." },
        { status: 400 },
      )
    }
    actionLink = magicLinkAttempt.data.properties.action_link
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[api/team/invite] RESEND_API_KEY no configurada — no se pudo mandar el correo.")
    return NextResponse.json({ error: "El correo no está configurado en el servidor." }, { status: 500 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const safeOwnerName = escapeHtml(ownerName)
    const safeBusinessName = escapeHtml(scopeLabel || "GastroMetrics")
    const html = renderEmailTemplate("04-invitacion-equipo.html", {
      htmlLang: normalizeEmailLang(profileRow?.preferred_language),
      title: labels.e04_title,
      preheader: fillLabel(labels.e04_preheader, { ownerName: safeOwnerName, businessName: safeBusinessName }),
      heading: fillLabel(labels.e04_heading, { businessName: safeBusinessName }),
      body: fillLabel(labels.e04_body, { ownerName: safeOwnerName }),
      accessLabel: labels.e04_access_label,
      labelScope: labels.e04_label_scope,
      labelModules: labels.e04_label_modules,
      labelPdfs: labels.e04_label_pdfs,
      cta: labels.e04_cta,
      footnote: fillLabel(labels.e04_footnote, { ownerName: safeOwnerName }),
      footerAddress: labels.footer_address,
      footer2: labels.e04_footer2,
      scope: escapeHtml(scopeLabel),
      tools: escapeHtml(toolsLabel || "—"),
      pdfAccess: escapeHtml(pdfAccessLabel || "—"),
      inviteUrl: actionLink,
    })

    const { error: sendError } = await resend.emails.send({
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [email],
      subject: fillLabel(labels.e04_subject, { ownerName }),
      html,
    })
    if (sendError) {
      console.error("[api/team/invite] Resend rechazó el envío:", sendError)
      return NextResponse.json({ error: "No se pudo enviar el correo de invitación." }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/team/invite] Error inesperado:", error)
    return NextResponse.json({ error: "Error inesperado al mandar la invitación." }, { status: 500 })
  }
}
