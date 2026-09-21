/**
 * Recordatorio de vencimiento de un plan asignado a mano desde /admin (ver
 * supabase/migrations/0008_plan_expiry.sql, docs/89) — pedido explícito del dueño del
 * proyecto: avisar 3 días antes con la opción de agregar un método de pago real o
 * cancelar y volver al plan gratis.
 *
 * runPlanExpiryReminders() se llama desde app/api/cron/activation-emails/route.ts, NO
 * desde su propio cron — Vercel Hobby (el plan real de este proyecto, confirmado en el
 * dashboard) tiene un tope duro de 2 cron jobs, y vercel.json ya usa las dos entradas
 * disponibles (keep-alive, activation-emails). En vez de agregar una tercera entrada
 * (que habría roto el siguiente deploy), este chequeo se suma a un cron diario que ya
 * existe y corre a diario de todas formas.
 *
 * Nunca aplica a una suscripción real de Stripe (esas se manejan solas vía webhook,
 * ver notify-billing.ts) — se filtra explícitamente por stripe_subscription_id is null.
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug, getLocalizedPlan } from "@/lib/plans"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang, EMAIL_DATE_LOCALES } from "@/lib/i18n/email-labels"

async function getAccountEmailAndLanguage(accountId: string): Promise<{ email: string; language: string } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profileRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  return { email: data.user.email, language: profileRow?.preferred_language || "es" }
}

function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(EMAIL_DATE_LOCALES[normalizeEmailLang(language)], {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export async function sendPlanExpiryReminder(accountId: string, planSlug: string, expiresAtIso: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const account = await getAccountEmailAndLanguage(accountId)
  if (!account) return
  const { email, language } = account
  const normalizedLang = normalizeEmailLang(language)
  const labels = getEmailLabels(language)
  const plan = getLocalizedPlan(getPlanBySlug(planSlug), normalizedLang)
  const planName = escapeHtml(plan.name)
  const date = formatDate(expiresAtIso, language)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const html = renderEmailTemplate("09-vencimiento-plan.html", {
    htmlLang: normalizedLang,
    title: labels.e09_title,
    preheader: fillLabel(labels.e09_preheader, { plan: planName, date }),
    heading: fillLabel(labels.e09_heading, { plan: planName, date }),
    body: fillLabel(labels.e09_body, { plan: planName, date }),
    cta1: labels.e09_cta1,
    cta2: labels.e09_cta2,
    footnote: labels.e09_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e09_footer2,
    actionUrl: `${siteUrl}/mi-plan`,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: fillLabel(labels.e09_subject, { plan: planName }),
    html,
  })
  if (error) console.error("[notify-plan-expiry] Error mandando el recordatorio de vencimiento:", error)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Busca cuentas con un plan asignado a mano que vence dentro de 3 días y todavía no
 * recibieron el recordatorio para ESA fecha exacta de vencimiento, manda el correo, y
 * marca expiry_reminder_sent_for (ver supabase/migrations/0025_plan_expiry_reminder.sql)
 * — se marca ANTES de mandar el correo (mismo criterio que claimSend() más abajo en
 * este mismo patrón usado por notify-activation.ts): si Resend falla, el peor caso es
 * un recordatorio perdido, nunca uno duplicado en la siguiente corrida del cron.
 */
export async function runPlanExpiryReminders(): Promise<{ candidates: number; sent: number }> {
  const admin = getSupabaseAdminClient()
  const now = new Date()
  const in3Days = new Date(now.getTime() + 3 * DAY_MS)

  const { data: candidates, error } = await admin
    .from("account_plans")
    .select("account_id, plan_slug, plan_expires_at, expiry_reminder_sent_for")
    .is("stripe_subscription_id", null)
    .not("plan_expires_at", "is", null)
    .gte("plan_expires_at", now.toISOString())
    .lte("plan_expires_at", in3Days.toISOString())
  if (error) throw error

  let sent = 0
  for (const row of candidates ?? []) {
    if (!row.plan_expires_at) continue
    if (row.expiry_reminder_sent_for === row.plan_expires_at) continue

    const { error: updateError } = await admin
      .from("account_plans")
      .update({ expiry_reminder_sent_for: row.plan_expires_at })
      .eq("account_id", row.account_id)
    if (updateError) {
      console.error("[notify-plan-expiry] Error marcando recordatorio enviado:", updateError)
      continue
    }

    await sendPlanExpiryReminder(row.account_id, row.plan_slug, row.plan_expires_at)
    sent++
  }

  return { candidates: candidates?.length ?? 0, sent }
}
