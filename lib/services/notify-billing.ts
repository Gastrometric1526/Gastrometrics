/**
 * Correos de facturación (cambio de plan, cancelación) — disparados desde
 * app/api/webhooks/stripe/route.ts, servidor-a-servidor, sin sesión de nadie. Ambos
 * son best-effort: si Resend falla, el webhook ya aplicó el cambio de plan real
 * contra Supabase, así que un correo perdido no debe hacer que Stripe reintente el
 * evento entero (ver el catch en cada llamada del propio webhook).
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug, plans } from "@/lib/plans"
import { renderEmailTemplate, renderEmailTemplateWithFeatureRows, escapeHtml } from "./email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang, EMAIL_DATE_LOCALES } from "@/lib/i18n/email-labels"

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

function planRank(slug: string): number {
  return plans.findIndex((p) => p.slug === slug)
}

export async function sendPlanChangedEmail(input: {
  accountId: string
  fromPlanSlug: string
  toPlanSlug: string
  nextChargeUnixSeconds: number | null
  nextChargeAmountCents: number | null
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  if (input.fromPlanSlug === input.toPlanSlug) return // no hubo cambio real de plan, no molestar

  const account = await getAccountEmailAndLanguage(input.accountId)
  if (!account) return
  const { email, language } = account
  const labels = getEmailLabels(language)

  const fromPlan = getPlanBySlug(input.fromPlanSlug)
  const toPlan = getPlanBySlug(input.toPlanSlug)
  const isUpgrade = planRank(input.toPlanSlug) > planRank(input.fromPlanSlug)

  // Qué features cambiaron: en upgrade, lo que trae el plan nuevo y no tenía el viejo;
  // en downgrade, lo que tenía el plan viejo y el nuevo ya no incluye.
  const fromFeatures = new Set(fromPlan.features)
  const toFeatures = new Set(toPlan.features)
  const changedFeatures = isUpgrade
    ? toPlan.features.filter((f) => !fromFeatures.has(f))
    : fromPlan.features.filter((f) => !toFeatures.has(f))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // La plantilla dice "Se desbloqueó" — para una bajada de plan, el LEEME que vino con
  // el diseño pide invertir a "Ya no incluye". Antes esto se hacía con un
  // string.replace() sobre el HTML ya renderizado (frágil, y solo tenía el texto en
  // español) — ahora {{featuresHeading}} es una variable real de la plantilla, así que
  // solo hay que elegir la etiqueta correcta antes de renderizar.
  const html = renderEmailTemplateWithFeatureRows(
    "06-cambio-plan.html",
    changedFeatures.length ? changedFeatures : ["—"],
    {
      htmlLang: normalizeEmailLang(language),
      title: labels.e06_title,
      preheader: fillLabel(labels.e06_preheader, { fromPlan: fromPlan.name, toPlan: toPlan.name }),
      body: labels.e06_body,
      labelBefore: labels.e06_label_before,
      labelNow: labels.e06_label_now,
      featuresHeading: isUpgrade ? labels.e06_unlocked_heading : labels.e06_removed_heading,
      nextChargePrefix: labels.e06_next_charge_prefix,
      cta: labels.e06_cta,
      footnote: labels.e06_footnote,
      footerAddress: labels.footer_address,
      footer2: labels.billing_footer2,
      fromPlan: escapeHtml(fromPlan.name),
      toPlan: escapeHtml(toPlan.name),
      fromPrice: escapeHtml(fromPlan.price),
      toPrice: escapeHtml(toPlan.price),
      nextChargeDate: input.nextChargeUnixSeconds ? formatDate(input.nextChargeUnixSeconds, language) : "—",
      nextChargeAmount:
        input.nextChargeAmountCents !== null && input.nextChargeAmountCents !== undefined
          ? formatUsd(input.nextChargeAmountCents)
          : "—",
      planUrl: `${siteUrl}/mi-plan`,
    },
  )

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: fillLabel(labels.e06_subject, { fromPlan: fromPlan.name, toPlan: toPlan.name }),
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
    preheader: fillLabel(labels.e05_preheader, { accessUntil }),
    heading: labels.e05_heading,
    body: fillLabel(labels.e05_body, { planName: escapeHtml(plan.name) }),
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
