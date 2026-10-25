/**
 * Recordatorio de vencimiento de un plan asignado a mano desde /admin (ver
 * supabase/migrations/0008_plan_expiry.sql, docs/89) — pedido explícito del dueño del
 * proyecto: avisar 3 días antes con la opción de agregar un método de pago real o
 * cancelar y volver al plan gratis. Aplica a todo plan con fecha de vencimiento y sin
 * suscripción de Stripe: los asignados en /admin, las 100 cocinas fundadoras y los
 * regalos de referidos.
 *
 * Desde docs/200 (pedido del dueño: «cuando alguien tenga un plan por vencer debe caerle
 * correos también ofreciéndole el programa de referidos»): son DOS correos —3 días antes y
 * el día que vence— y los dos llevan el bloque «Regala un mes, gana un mes» con el enlace
 * personal de la persona, si todavía no llegó al tope de premios del año. El del día va
 * enfocado en invitar: es la forma de seguir con Chef Ejecutivo sin pagar.
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
import { sendWithRetry } from "./send-email"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug, getLocalizedPlan } from "@/lib/plans"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { sendPlanChangedEmail } from "./notify-billing"
import { recordPlanChangeNotice } from "./plan-change-notice"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { withEmailTracking } from "@/lib/email-tracking"
import { formatDate as formatDMY } from "@/lib/date-format"
import { applyDueReferralBank, myReferralLink } from "./referrals"
import { REFERRAL, rewardsInLastYear, type RewardRecord } from "@/lib/referrals"

const DAY_MS = 24 * 60 * 60 * 1000

/** «soon» = vence en más de 24 h y hasta 3 días; «today» = vence en las próximas 24 h. */
export type ExpiryReminderKind = "soon" | "today"

export function expiryReminderKind(expiresAtIso: string, now: number): ExpiryReminderKind | null {
  const left = new Date(expiresAtIso).getTime() - now
  if (!(left >= 0) || left > 3 * DAY_MS) return null
  return left <= DAY_MS ? "today" : "soon"
}

/** Evento de product_events (sin migración) que marca el correo del día ya mandado para ese vencimiento. */
export const PLAN_EXPIRY_TODAY_EVENT = "plan_expiry_today_sent"

/**
 * Bloque «Regala un mes, gana un mes» para la plantilla 09: HTML de confianza armado aquí, con
 * los textos y el enlace escapados. Sin `cta`, sin botón.
 */
export function referralBlockHtml(input: { title: string; body: string; linkLabel: string; cta?: string; link: string; inviteUrl: string }): string {
  const font = "font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
  const link = escapeHtml(input.link)
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;background:#FFF4EF;border:1px solid #F8D3C4;border-radius:12px">`,
    `<tr><td style="padding:22px 24px;${font}">`,
    `<p style="margin:0 0 8px;${font};font-size:17px;line-height:1.3;font-weight:800;color:#1A1512">${escapeHtml(input.title)}</p>`,
    `<p style="margin:0 0 14px;${font};font-size:14px;line-height:1.6;color:#4A423C">${escapeHtml(input.body)}</p>`,
    `<p style="margin:0 0 16px;${font};font-size:13px;line-height:1.5;color:#4A423C">${escapeHtml(input.linkLabel)} <a href="${link}" style="color:#F05324;font-weight:700;text-decoration:none">${link}</a></p>`,
    // Botón con borde (no relleno): el manual de marca pide un solo elemento naranja.
    input.cta
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="border:1px solid #F05324;border-radius:8px;background:#ffffff">` +
        `<a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;padding:11px 22px;${font};font-size:14px;font-weight:700;color:#F05324;text-decoration:none;border-radius:8px">${escapeHtml(input.cta)}</a>` +
        `</td></tr></table>`
      : "",
    `</td></tr></table>`,
  ].join("")
}

async function getAccountEmailAndLanguage(
  accountId: string,
): Promise<{ email: string; language: string; rewardsThisYear: number; continuesAfterExpiry: boolean } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profileRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  const meta = (data.user.app_metadata || {}) as Record<string, unknown>
  const rewards = (meta.referral_rewards as RewardRecord[] | undefined) || []
  return {
    email: data.user.email,
    language: profileRow?.preferred_language || "es",
    rewardsThisYear: rewardsInLastYear(rewards, Date.now()),
    // Pago programado (docs/165) o meses guardados de referidos (docs/179): al vencer NO pasa a
    // Foodie, así que el aviso «vuelves al plan gratis» sería falso.
    continuesAfterExpiry: Boolean(meta.scheduled_plan) || Number(meta.referral_bank_days) > 0,
  }
}

// Día/mes/año en hora de Honduras (docs/170); el idioma ya no cambia el orden.
function formatDate(iso: string, _language: string): string {
  return formatDMY(iso, { timeZone: "America/Tegucigalpa" })
}

export async function sendPlanExpiryReminder(accountId: string, planSlug: string, expiresAtIso: string, kind: ExpiryReminderKind = "soon"): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const account = await getAccountEmailAndLanguage(accountId)
  if (!account) return
  const { email, language, rewardsThisYear, continuesAfterExpiry } = account
  if (continuesAfterExpiry) return
  const normalizedLang = normalizeEmailLang(language)
  const labels = getEmailLabels(language)
  const plan = getLocalizedPlan(getPlanBySlug(planSlug), normalizedLang)
  const planName = escapeHtml(plan.name)
  const date = formatDate(expiresAtIso, language)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Con el tope de premios del año ya alcanzado no se ofrece el programa.
  const canEarn = rewardsThisYear < REFERRAL.maxRewardsPerYear
  const invite = kind === "today" && canEarn
  const inviteUrl = withEmailTracking(`${siteUrl}/mi-plan#invita`, kind === "today" ? "plan_expiry_today_referral" : "plan_expiry_referral")
  const referralBlock = canEarn
    ? referralBlockHtml({
        title: labels.ref_title,
        body: fillLabel(labels.ref_body, { max: String(REFERRAL.maxRewardsPerYear) }),
        linkLabel: labels.ref_link_label,
        // En el correo del día el botón principal ya invita: aquí solo el enlace.
        cta: invite ? undefined : labels.ref_cta,
        link: myReferralLink(accountId).link,
        inviteUrl,
      })
    : ""

  // La plantilla usa {{actionUrl}} en sus dos botones: el correo del día lleva a invitar y a
  // los planes (Mi Plan tiene ambas cosas); el de 3 días, a Mi Plan.
  const html = renderEmailTemplate("09-vencimiento-plan.html", {
    htmlLang: normalizedLang,
    title: labels.e09_title,
    preheader: invite ? labels.e09t_preheader : fillLabel(labels.e09_preheader, { plan: planName, date }),
    heading: fillLabel(kind === "today" ? labels.e09t_heading : labels.e09_heading, { plan: planName, date }),
    body: invite ? fillLabel(labels.e09t_body, { plan: planName }) : fillLabel(labels.e09_body, { plan: planName, date }),
    cta1: invite ? labels.e09t_cta1 : labels.e09_cta1,
    cta2: invite ? labels.e09t_cta2 : labels.e09_cta2,
    referralBlock,
    footnote: labels.e09_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e09_footer2,
    actionUrl: invite ? inviteUrl : withEmailTracking(`${siteUrl}/mi-plan`, kind === "today" ? "plan_expiry_today" : "plan_expiry"),
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(resend, {
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: fillLabel(kind === "today" ? labels.e09t_subject : labels.e09_subject, { plan: planName }),
    html,
  })
  if (error) console.error("[notify-plan-expiry] Error mandando el recordatorio de vencimiento:", error)
}

/**
 * Dos recordatorios por vencimiento (docs/200), los dos con el bloque de referidos:
 * - «soon» (vence en 1–3 días): se marca en expiry_reminder_sent_for (migración 0025) ANTES
 *   de mandar — si Resend falla se pierde uno, nunca se duplica en la siguiente corrida.
 * - «today» (vence en las próximas 24 h): se marca con una fila PLAN_EXPIRY_TODAY_EVENT en
 *   product_events (business_id = «cuenta|vencimiento»), sin migración, también antes de mandar.
 * El cron corre una vez al día, así que cada vencimiento cae una sola vez en «today». Un plan
 * asignado con menos de 24 h de margen recibe solo el del día.
 */
export async function runPlanExpiryReminders(): Promise<{ candidates: number; sent: number; sentToday: number }> {
  const admin = getSupabaseAdminClient()
  const now = Date.now()

  const { data: candidates, error } = await admin
    .from("account_plans")
    .select("account_id, plan_slug, plan_expires_at, expiry_reminder_sent_for")
    .is("stripe_subscription_id", null)
    .not("plan_expires_at", "is", null)
    .neq("plan_slug", "foodie")
    .gte("plan_expires_at", new Date(now).toISOString())
    .lte("plan_expires_at", new Date(now + 3 * DAY_MS).toISOString())
  if (error) throw error

  const { data: todayRows, error: todayError } = await admin
    .from("product_events")
    .select("business_id")
    .eq("event_name", PLAN_EXPIRY_TODAY_EVENT)
    .gte("created_at", new Date(now - 7 * DAY_MS).toISOString())
  if (todayError) throw todayError // sin saber qué ya se mandó, mejor no mandar el del día dos veces
  const todaySent = new Set(((todayRows as { business_id: string | null }[] | null) ?? []).map((r) => r.business_id))

  let sent = 0
  let sentToday = 0
  for (const row of candidates ?? []) {
    if (!row.plan_expires_at) continue
    const kind = expiryReminderKind(row.plan_expires_at, now)
    if (!kind) continue

    if (kind === "soon") {
      if (row.expiry_reminder_sent_for === row.plan_expires_at) continue
      const { error: updateError } = await admin
        .from("account_plans")
        .update({ expiry_reminder_sent_for: row.plan_expires_at })
        .eq("account_id", row.account_id)
      if (updateError) {
        console.error("[notify-plan-expiry] Error marcando recordatorio enviado:", updateError)
        continue
      }
      await sendPlanExpiryReminder(row.account_id, row.plan_slug, row.plan_expires_at, "soon")
      sent++
      continue
    }

    const key = `${row.account_id}|${row.plan_expires_at}`
    if (todaySent.has(key)) continue
    const { error: markError } = await admin.from("product_events").insert({ event_name: PLAN_EXPIRY_TODAY_EVENT, business_id: key } as never) // product_events no está en types/database.ts
    if (markError) {
      console.error("[notify-plan-expiry] Error marcando el correo del día:", markError)
      continue
    }
    await sendPlanExpiryReminder(row.account_id, row.plan_slug, row.plan_expires_at, "today")
    sentToday++
  }

  return { candidates: candidates?.length ?? 0, sent, sentToday }
}

/**
 * Plan asignado a mano que YA venció (docs/139). Antes solo el navegador lo trataba como
 * Foodie al cargar la sesión: la persona perdía funciones sin ningún aviso de qué perdía.
 * Ahora el cron diario pasa la cuenta a Foodie en la base y le manda el correo y el aviso
 * del Dashboard con lo que pierde y lo que conserva. Idempotente: la actualización solo
 * aplica si la fila sigue con ese mismo vencimiento, y después ya no queda vencida.
 */
export async function runExpiredPlanDowngrades(): Promise<{ candidates: number; downgraded: number }> {
  const admin = getSupabaseAdminClient()
  const nowIso = new Date().toISOString()

  const { data: expired, error } = await admin
    .from("account_plans")
    .select("account_id, plan_slug, plan_expires_at")
    .is("stripe_subscription_id", null)
    .not("plan_expires_at", "is", null)
    .lt("plan_expires_at", nowIso)
    .neq("plan_slug", "foodie")
  if (error) throw error

  let downgraded = 0
  for (const row of expired ?? []) {
    if (!row.plan_expires_at) continue
    // Meses ganados con referidos (docs/179): en vez de Foodie, empieza Chef de Partie.
    try {
      if (await applyDueReferralBank(row.account_id)) continue
    } catch (bankError) {
      console.error("[notify-plan-expiry] Error aplicando meses guardados de referidos:", bankError)
    }
    const { data: updated, error: updateError } = await admin
      .from("account_plans")
      .update({ plan_slug: "foodie", plan_expires_at: null })
      .eq("account_id", row.account_id)
      .eq("plan_expires_at", row.plan_expires_at)
      .select("account_id")
    if (updateError || !updated?.length) {
      if (updateError) console.error("[notify-plan-expiry] Error pasando a Foodie un plan vencido:", updateError)
      continue
    }
    downgraded++
    try {
      await sendPlanChangedEmail({
        accountId: row.account_id,
        fromPlanSlug: row.plan_slug,
        toPlanSlug: "foodie",
        nextChargeUnixSeconds: null,
        nextChargeAmountCents: null,
        source: "expired",
      })
    } catch (emailError) {
      console.error("[notify-plan-expiry] Error mandando el correo de plan vencido:", emailError)
    }
    await recordPlanChangeNotice({
      accountId: row.account_id,
      fromPlanSlug: row.plan_slug,
      toPlanSlug: "foodie",
      amountCents: null,
      nextChargeUnixSeconds: null,
      expiresAtUnixSeconds: null,
      source: "expired",
    })
  }
  return { candidates: expired?.length ?? 0, downgraded }
}
