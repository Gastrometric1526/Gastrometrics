/**
 * Correos de activación por comportamiento — pedido derivado de la crítica externa
 * (ver docs/98, Parte 4.1 punto 7): recordatorio de primera receta, chequeo de margen
 * a los 7 días, refuerzo tras la primera venta registrada. Disparados desde
 * app/api/cron/activation-emails/route.ts (cron diario de Vercel), nunca desde una
 * ruta con sesión de usuario.
 *
 * Cada función es idempotente por cuenta: antes de mandar el correo, intenta un
 * insert en activation_emails_sent con unique(account_id, email_type) — si el insert
 * no agrega fila nueva (ya se había mandado antes), no manda el correo de nuevo. El
 * insert y el envío no son atómicos entre sí, pero el insert sucede primero, así que
 * el peor caso ante una carrera es un correo perdido (silencioso, no crítico), nunca
 * uno duplicado.
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate } from "./email-templates"
import { getEmailLabels, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { buildUnsubscribeUrl } from "@/lib/email-unsubscribe"
import { TRUSTPILOT_URL } from "@/lib/site-links"

type ActivationEmailType =
  | "first_recipe_reminder"
  | "day7_margin_checkin"
  | "first_sale_reinforcement"
  | "four_hour_experience"

async function getAccountEmailAndLanguage(accountId: string): Promise<{ email: string; language: string } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profileRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  return { email: data.user.email, language: profileRow?.preferred_language || "es" }
}

/**
 * Decisión del dueño del proyecto (docs/133): estos correos de activación son
 * recordatorios, así que —igual que los de notify-reengagement.ts— solo se mandan a
 * quien tenga activa la casilla «Novedades y recordatorios» (profiles.
 * product_updates_opt_in). Se chequea ANTES de reservar el envío en
 * activation_emails_sent: si la persona activa la casilla más tarde y todavía está en
 * la ventana del correo, lo recibe.
 */
async function hasOptedIn(accountId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from("profiles").select("product_updates_opt_in").eq("id", accountId).maybeSingle()
  return data?.product_updates_opt_in === true
}

function unsubscribeHeaders(accountId: string): Record<string, string> {
  const url = buildUnsubscribeUrl(accountId)
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
}

/** Reserva el envío para esta cuenta+tipo. Devuelve true solo si esta llamada fue la primera. */
async function claimSend(accountId: string, emailType: ActivationEmailType): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("activation_emails_sent")
    .insert({ account_id: accountId, email_type: emailType })
    .select("id")
  if (error) {
    // Código 23505 = violación de unique constraint (ya se había mandado) — no es un
    // error real, es exactamente el caso que este insert existe para detectar.
    if ((error as { code?: string }).code !== "23505") {
      console.error(`[notify-activation] Error reservando envío (${emailType}):`, error)
    }
    return false
  }
  return (data?.length ?? 0) > 0
}

async function sendActivationEmail(input: {
  accountId: string
  emailType: ActivationEmailType
  subjectKey: "e07_reminder_subject" | "e07_day7_subject" | "e07_firstsale_subject"
  titleKey: "e07_reminder_title" | "e07_day7_title" | "e07_firstsale_title"
  preheaderKey: "e07_reminder_preheader" | "e07_day7_preheader" | "e07_firstsale_preheader"
  headingKey: "e07_reminder_heading" | "e07_day7_heading" | "e07_firstsale_heading"
  bodyKey: "e07_reminder_body" | "e07_day7_body" | "e07_firstsale_body"
  ctaKey: "e07_reminder_cta" | "e07_day7_cta" | "e07_firstsale_cta"
  actionPath: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  if (!(await hasOptedIn(input.accountId))) return

  const claimed = await claimSend(input.accountId, input.emailType)
  if (!claimed) return

  const account = await getAccountEmailAndLanguage(input.accountId)
  if (!account) return
  const { email, language } = account
  const normalizedLang = normalizeEmailLang(language)
  const labels = getEmailLabels(language)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const html = renderEmailTemplate("07-activacion.html", {
    htmlLang: normalizedLang,
    title: labels[input.titleKey],
    preheader: labels[input.preheaderKey],
    heading: labels[input.headingKey],
    body: labels[input.bodyKey],
    cta: labels[input.ctaKey],
    footnote: labels.e07_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e07_footer2,
    actionUrl: `${siteUrl}${input.actionPath}`,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(resend, {
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: labels[input.subjectKey],
    html,
    headers: unsubscribeHeaders(input.accountId),
  })
  if (error) console.error(`[notify-activation] Error mandando correo (${input.emailType}):`, error)
}

export async function sendFirstRecipeReminder(accountId: string): Promise<void> {
  await sendActivationEmail({
    accountId,
    emailType: "first_recipe_reminder",
    subjectKey: "e07_reminder_subject",
    titleKey: "e07_reminder_title",
    preheaderKey: "e07_reminder_preheader",
    headingKey: "e07_reminder_heading",
    bodyKey: "e07_reminder_body",
    ctaKey: "e07_reminder_cta",
    actionPath: "/dashboard",
  })
}

export async function sendDay7MarginCheckin(accountId: string): Promise<void> {
  await sendActivationEmail({
    accountId,
    emailType: "day7_margin_checkin",
    subjectKey: "e07_day7_subject",
    titleKey: "e07_day7_title",
    preheaderKey: "e07_day7_preheader",
    headingKey: "e07_day7_heading",
    bodyKey: "e07_day7_body",
    ctaKey: "e07_day7_cta",
    actionPath: "/estadisticas",
  })
}

export async function sendFirstSaleReinforcement(accountId: string): Promise<void> {
  await sendActivationEmail({
    accountId,
    emailType: "first_sale_reinforcement",
    subjectKey: "e07_firstsale_subject",
    titleKey: "e07_firstsale_title",
    preheaderKey: "e07_firstsale_preheader",
    headingKey: "e07_firstsale_heading",
    bodyKey: "e07_firstsale_body",
    ctaKey: "e07_firstsale_cta",
    actionPath: "/ventas",
  })
}

// Perfil real de Trustpilot (lib/site-links.ts, docs/135) — el mismo enlace que usa la
// sección Trustpilot de la landing. TRUSTPILOT_URL (servidor) lo puede sobreescribir.

/**
 * Encuesta de satisfacción a las 4 horas de uso REAL (user_presence.total_active_seconds
 * ≥ 14400, ver supabase/migrations/0016_presence_time_tracking.sql — tiempo activo de
 * verdad, no tiempo desde el registro), pedido explícito del dueño del proyecto. Dos
 * CTA en vez de uno (por eso no reutiliza sendActivationEmail/07-activacion.html):
 * dejar un comentario (queda en el mismo buzón de /admin que sugerencia/queja/bug, ver
 * supabase/migrations/0026_feedback_experiencia_type.sql) o dejar una reseña en
 * Trustpilot.
 */
export async function sendFourHourExperienceSurvey(accountId: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  if (!(await hasOptedIn(accountId))) return

  const claimed = await claimSend(accountId, "four_hour_experience")
  if (!claimed) return

  const account = await getAccountEmailAndLanguage(accountId)
  if (!account) return
  const { email, language } = account
  const normalizedLang = normalizeEmailLang(language)
  const labels = getEmailLabels(language)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const html = renderEmailTemplate("10-encuesta-experiencia.html", {
    htmlLang: normalizedLang,
    title: labels.e10_title,
    preheader: labels.e10_preheader,
    heading: labels.e10_heading,
    body: labels.e10_body,
    cta1: labels.e10_cta1,
    cta2: labels.e10_cta2,
    footnote: labels.e10_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e10_footer2,
    commentUrl: `${siteUrl}/contacto?type=experiencia`,
    trustpilotUrl: process.env.TRUSTPILOT_URL || TRUSTPILOT_URL,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(resend, {
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: labels.e10_subject,
    html,
    headers: unsubscribeHeaders(accountId),
  })
  if (error) console.error("[notify-activation] Error mandando la encuesta de experiencia:", error)
}
