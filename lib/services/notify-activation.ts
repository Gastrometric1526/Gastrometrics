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
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate } from "./email-templates"
import { getEmailLabels, normalizeEmailLang } from "@/lib/i18n/email-labels"

type ActivationEmailType = "first_recipe_reminder" | "day7_margin_checkin" | "first_sale_reinforcement"

async function getAccountEmailAndLanguage(accountId: string): Promise<{ email: string; language: string } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profileRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  return { email: data.user.email, language: profileRow?.preferred_language || "es" }
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
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: labels[input.subjectKey],
    html,
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
    actionPath: "/estadisticas?tab=ventas",
  })
}
