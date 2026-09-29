/**
 * Correos de facturación (cambio de plan, cancelación) — disparados desde
 * app/api/webhooks/stripe/route.ts, servidor-a-servidor, sin sesión de nadie. Ambos
 * son best-effort: si Resend falla, el webhook ya aplicó el cambio de plan real
 * contra Supabase, así que un correo perdido no debe hacer que Stripe reintente el
 * evento entero (ver el catch en cada llamada del propio webhook).
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug, getLocalizedPlan, plans } from "@/lib/plans"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { diffPlanCapabilities } from "@/lib/plan-capabilities"
import { getEmailLabels, fillLabel, normalizeEmailLang, EMAIL_DATE_LOCALES } from "@/lib/i18n/email-labels"

// Aviso al dueño del proyecto por cada evento REAL de dinero de Stripe (suscripción
// nueva pagada, cambio de plan pagado, cancelación) — pedido explícito: "que me caigan
// notificaciones... cuando un usuario paga y cambia de plan". Antes de esto, un pago
// real solo generaba el correo al CLIENTE (sendPlanChangedEmail/sendSubscriptionCancelledEmail
// arriba) — el dueño no se enteraba de nada salvo que entrara a mirar /admin o el
// dashboard de Stripe. Mismo patrón que lib/services/notify-signup.ts (mismas
// variables de entorno FEEDBACK_NOTIFY_TO/FEEDBACK_NOTIFY_FROM, ya configuradas tanto
// en local como en Vercel — nada nuevo que configurar). Deliberadamente NO se dispara
// para cambios de plan hechos a mano desde /admin (app/api/admin/account-plan/route.ts)
// — ese cambio lo hizo el propio dueño, avisarle de su propia acción sería ruido.
export async function sendOwnerBillingNotification(input: {
  event: "new_subscription" | "plan_changed" | "cancelled"
  accountId: string
  fromPlanSlug?: string
  toPlanSlug?: string
  amountCents?: number | null
}): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.FEEDBACK_NOTIFY_TO) return

  const account = await getAccountEmailAndLanguage(input.accountId)
  const accountLabel = account?.email || input.accountId

  const eventLabel = {
    new_subscription: "Nueva suscripción pagada",
    plan_changed: "Cambio de plan pagado",
    cancelled: "Suscripción cancelada",
  }[input.event]

  const fromPlanName = input.fromPlanSlug ? getPlanBySlug(input.fromPlanSlug).name : null
  const toPlanName = input.toPlanSlug ? getPlanBySlug(input.toPlanSlug).name : null
  const amountLabel =
    input.amountCents !== null && input.amountCents !== undefined ? formatUsd(input.amountCents) : null

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [process.env.FEEDBACK_NOTIFY_TO as string],
    subject: `[GastroMetrics] ${eventLabel}: ${accountLabel}`,
    html: `
      <p><strong>Cuenta:</strong> ${escapeHtml(accountLabel)}</p>
      ${fromPlanName ? `<p><strong>Plan anterior:</strong> ${escapeHtml(fromPlanName)}</p>` : ""}
      ${toPlanName ? `<p><strong>Plan nuevo:</strong> ${escapeHtml(toPlanName)}</p>` : ""}
      ${amountLabel ? `<p><strong>Monto del cobro:</strong> ${escapeHtml(amountLabel)}</p>` : ""}
      <hr/>
      <p style="color:#888;font-size:12px">Evento real de Stripe, ${escapeHtml(new Date().toLocaleString("es-HN"))}. Revisa el detalle desde el panel /admin.</p>
    `,
  })
  // El SDK de Resend no lanza en errores de la API (mismo hallazgo que
  // notify-signup.ts/notify-feedback.ts, ver docs/53) — se loguea en vez de lanzar
  // porque esto es un aviso adicional, nunca debe hacer que Stripe reintente el
  // webhook ni afectar el correo real al cliente.
  if (error) {
    console.error("[notify-billing] Resend rechazó la notificación al dueño:", error)
  }
}

// Correo de servidor-a-servidor (webhook de Stripe) — no hay sesión ni idioma de UI de
// donde leerlo, así que se busca el correo Y el idioma guardado en profiles en la misma
// consulta.
async function getAccountEmailAndLanguage(accountId: string): Promise<{ email: string; language: string } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profileRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  return { email: data.user.email, language: profileRow?.preferred_language || "es" }
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" }).format(cents / 100)
}

function formatDate(unixSeconds: number, language: string): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(EMAIL_DATE_LOCALES[normalizeEmailLang(language)], {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Sección de lista para el correo de cambio de plan (docs/139): título + una fila por ítem,
// con un signo de color (+ ganado, − perdido, · incluido). HTML de correo: tablas y estilos en
// línea, sin CSS externo.
function featureSectionHtml(heading: string, items: string[], color: string, sign: string): string {
  const font = "font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
  const rows = items
    .map(
      (item) =>
        `<tr><td width="18" valign="top" style="${font};font-size:14.5px;line-height:1.55;font-weight:800;color:${color};padding:0 0 9px">${sign}</td><td style="${font};font-size:14.5px;line-height:1.55;color:#3A332E;padding:0 0 9px">${escapeHtml(item)}</td></tr>`,
    )
    .join("")
  return `<p style="margin:0 0 10px;${font};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${color};font-weight:700">${escapeHtml(heading)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">${rows}</table>`
}

function noteHtml(text: string): string {
  return `<p style="margin:-8px 0 20px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#6E635C;background:#F7F4F1;border-radius:8px;padding:10px 14px">${escapeHtml(text)}</p>`
}

function planRank(slug: string): number {
  return plans.findIndex((p) => p.slug === slug)
}

interface PlanChangedEmailInput {
  fromPlanSlug: string
  toPlanSlug: string
  nextChargeUnixSeconds: number | null
  nextChargeAmountCents: number | null
  // Cambios asignados a mano desde /admin (app/api/admin/account-plan/route.ts) no
  // pasan por Stripe — no hay cobro real ni "próximo cobro", pero sí puede haber una
  // fecha de vencimiento del plan (docs/59). Cuando viene esto, el correo muestra esa
  // fecha en vez de un cobro, y usa un cuerpo que no menciona prorrateo (docs/89).
  expiresAtUnixSeconds?: number | null
  // "expired": un plan asignado a mano venció y la cuenta pasó a Foodie (cron diario,
  // lib/services/notify-plan-expiry.ts — docs/139).
  source?: "stripe" | "admin" | "expired"
}

/** Asunto y HTML del correo de cambio de plan — puro, cubierto por notify-billing.test.ts. */
export function renderPlanChangedEmail(input: PlanChangedEmailInput & { language: string }): { subject: string; html: string } {
  const { language } = input
  const labels = getEmailLabels(language)
  // Un vencimiento tampoco pasa por Stripe: se muestra igual que un cambio de /admin, sin cobro.
  const isAdminChange = input.source === "admin" || input.source === "expired"

  const fromPlan = getLocalizedPlan(getPlanBySlug(input.fromPlanSlug), normalizeEmailLang(language))
  const toPlan = getLocalizedPlan(getPlanBySlug(input.toPlanSlug), normalizeEmailLang(language))
  const isExpired = input.source === "expired"

  // Qué gana, qué pierde y qué incluye ahora (docs/139): desde los permisos reales de cada
  // plan, no desde los textos de marketing (acumulativos, daban listas incompletas).
  const diff = diffPlanCapabilities(input.fromPlanSlug, input.toPlanSlug, language)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const featureSections = [
    diff.gained.length ? featureSectionHtml(labels.e06_gained_heading, diff.gained, "#1F6B45", "+") : "",
    diff.lost.length ? featureSectionHtml(labels.e06_lost_heading, diff.lost, "#B3341A", "−") : "",
    diff.lost.length ? noteHtml(labels.e06_data_kept) : "",
    featureSectionHtml(labels.e06_now_heading, diff.now, "#6E635C", "·"),
  ].join("")

  const html = renderEmailTemplate("06-cambio-plan.html", {
      featureSections,
      htmlLang: normalizeEmailLang(language),
      title: labels.e06_title,
      preheader: fillLabel(labels.e06_preheader, { fromPlan: fromPlan.name, toPlan: toPlan.name }),
      body: isExpired ? labels.e06_body_expired : isAdminChange ? labels.e06_body_admin : labels.e06_body,
      labelBefore: labels.e06_label_before,
      labelNow: labels.e06_label_now,
      // Cambios sin Stripe (admin / vencimiento) no tienen cobro: la fila habla del vencimiento.
      nextChargePrefix: isAdminChange ? labels.e06_expires_prefix : labels.e06_next_charge_prefix,
      cta: labels.e06_cta,
      footnote: labels.e06_footnote,
      footerAddress: labels.footer_address,
      footer2: labels.billing_footer2,
      fromPlan: escapeHtml(fromPlan.name),
      toPlan: escapeHtml(toPlan.name),
      fromPrice: escapeHtml(fromPlan.price),
      toPrice: escapeHtml(toPlan.price),
      nextChargeDate: input.expiresAtUnixSeconds
        ? formatDate(input.expiresAtUnixSeconds, language)
        : input.nextChargeUnixSeconds
          ? formatDate(input.nextChargeUnixSeconds, language)
          : isAdminChange
            ? labels.e06_no_expiry_value
            : "—",
      nextChargeAmount:
        input.nextChargeAmountCents !== null && input.nextChargeAmountCents !== undefined
          ? formatUsd(input.nextChargeAmountCents)
          : "—",
      planUrl: `${siteUrl}/mi-plan`,
  })
  return { subject: fillLabel(labels.e06_subject, { fromPlan: fromPlan.name, toPlan: toPlan.name }), html }
}

export async function sendPlanChangedEmail(input: PlanChangedEmailInput & { accountId: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  if (input.fromPlanSlug === input.toPlanSlug) return // no hubo cambio real de plan, no molestar

  const account = await getAccountEmailAndLanguage(input.accountId)
  if (!account) return
  const { email, language } = account
  const { subject, html } = renderPlanChangedEmail({ ...input, language })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject,
    html,
  })
  if (error) console.error("[notify-billing] Error mandando el correo de cambio de plan:", error)
}

export async function sendSubscriptionCancelledEmail(input: {
  accountId: string
  planSlug: string
  accessUntilUnixSeconds: number | null
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const account = await getAccountEmailAndLanguage(input.accountId)
  if (!account) return
  const { email, language } = account
  const labels = getEmailLabels(language)

  const plan = getPlanBySlug(input.planSlug)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const accessUntil = input.accessUntilUnixSeconds
    ? formatDate(input.accessUntilUnixSeconds, language)
    : labels.e05_fallback_access_until

  const html = renderEmailTemplate("05-cancelacion-suscripcion.html", {
    htmlLang: normalizeEmailLang(language),
    title: labels.e05_title,
    preheader: fillLabel(labels.e05_preheader, { accessUntil, planName: escapeHtml(plan.name) }),
    heading: labels.e05_heading,
    body: fillLabel(labels.e05_body, { planName: escapeHtml(plan.name), accessUntil }),
    labelAccessUntil: labels.e05_label_access_until,
    labelThen: labels.e05_label_then,
    valueThen: labels.e05_value_then,
    labelNextCharge: labels.e05_label_next_charge,
    valueNone: labels.e05_value_none,
    body2: labels.e05_body2,
    cta: labels.e05_cta,
    footnote: labels.e05_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.billing_footer2,
    planName: escapeHtml(plan.name),
    accessUntil,
    billingPortalUrl: `${siteUrl}/mi-plan`,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: labels.e05_subject,
    html,
  })
  if (error) console.error("[notify-billing] Error mandando el correo de cancelación:", error)
}
