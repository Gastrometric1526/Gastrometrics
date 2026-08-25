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
 * Desde docs/60: además de crear la cuenta y mandar el correo, esta ruta otorga acceso
 * real de LECTURA (tabla business_members, activa políticas RLS `_member_select` que
 * ya existían desde 0001_init.sql) — se hace acá, con el service role, porque es el
 * único lugar donde se conoce el user_id real de la cuenta recién creada/enlazada en
 * el mismo momento de generar el link (admin.generateLink lo devuelve directo). Ver el
 * comentario de cabecera de lib/storage/team.ts para los límites reales de este
 * acceso (lectura, no filtrada por herramienta/PDF, sin escritura).
 */
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { checkRateLimit } from "@/lib/rate-limit"
import { MAX_TEAM_MEMBERS } from "@/types/team"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const scope = typeof body?.scope === "string" && body.scope ? body.scope : "dashboard"
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

  // Límite de intentos (ver docs/61) — más allá del tope de MAX_TEAM_MEMBERS de abajo,
  // protege contra alguien llamando esta ruta directo (sin pasar por /equipo) para
  // hacer que se creen cuentas y se manden correos reales en bucle.
  const rateLimit = checkRateLimit(`team-invite:${user.id}`, {
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas invitaciones seguidas. Espera unos minutos e intenta de nuevo." }, { status: 429 })
  }

  // MAX_TEAM_MEMBERS ya se revisaba en lib/storage/team.ts (inviteTeamMember), pero
  // eso corre DESPUÉS de esta ruta en app/equipo/page.tsx y solo del lado del cliente
  // — alguien llamando esta ruta directo podía saltárselo por completo y crear más
  // cuentas/otorgar más accesos reales de los que el plan permite. Se revisa también
  // aquí, contra el conteo real en Supabase, antes de crear nada.
  const admin = getSupabaseAdminClient()
  const { count: currentMemberCount } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
  if ((currentMemberCount || 0) >= MAX_TEAM_MEMBERS) {
    return NextResponse.json({ error: `Ya invitaste al máximo de ${MAX_TEAM_MEMBERS} personas.` }, { status: 400 })
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, preferred_language")
    .eq("id", user.id)
    .maybeSingle()
  const ownerName = profileRow?.full_name || user.email || "Un usuario de GastroMetrics"
  const labels = getEmailLabels(profileRow?.preferred_language)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  let actionLink: string | null = null
  let invitedUserId: string | null = null

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
    invitedUserId = inviteAttempt.data.user?.id ?? null
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
    invitedUserId = magicLinkAttempt.data.user?.id ?? null
  }

  // Otorga acceso real de lectura (business_members) — "dashboard" cubre todos los
  // negocios que el dueño tenga HOY; uno agregado después no se retro-otorga solo,
  // requeriría volver a invitar o un mecanismo de sincronización aparte (no
  // construido en este pase, ver docs/60).
  if (invitedUserId) {
    const targetBusinessIds =
      scope === "dashboard"
        ? ((await admin.from("businesses").select("id").eq("owner_id", user.id)).data || []).map((b) => b.id)
        : [scope]
    if (targetBusinessIds.length > 0) {
      const { error: memberError } = await admin
        .from("business_members")
        .upsert(targetBusinessIds.map((business_id) => ({ business_id, user_id: invitedUserId, role: "member" })))
      if (memberError) console.error("[api/team/invite] Error otorgando acceso real al negocio:", memberError)
    }
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

    return NextResponse.json({ ok: true, invitedUserId })
  } catch (error) {
    console.error("[api/team/invite] Error inesperado:", error)
    return NextResponse.json({ error: "Error inesperado al mandar la invitación." }, { status: 500 })
  }
}
