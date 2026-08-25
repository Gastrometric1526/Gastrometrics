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

async function getAccountEmail(accountId: string): Promise<string | null> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(accountId)
  if (error || !data.user?.email) return null
  return data.user.email
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("es-HN", { style: "currency", currency: "USD" }).format(cents / 100)
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })
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

  const email = await getAccountEmail(input.accountId)
  if (!email) return

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

  // La plantilla dice "Se desbloqueó" — para una bajada de plan, el LEEME que vino
  // con el diseño pide invertir a "Ya no incluye" en vez de reusar el mismo texto
  // fijo. Como el encabezado está soldado dentro del HTML de la plantilla (no es una
  // variable), se hace un reemplazo puntual después de renderizar, solo para el caso
  // de bajada.
  let html = renderEmailTemplateWithFeatureRows("06-cambio-plan.html", changedFeatures.length ? changedFeatures : ["—"], {
    fromPlan: escapeHtml(fromPlan.name),
    toPlan: escapeHtml(toPlan.name),
    fromPrice: escapeHtml(fromPlan.price),
    toPrice: escapeHtml(toPlan.price),
    nextChargeDate: input.nextChargeUnixSeconds ? formatDate(input.nextChargeUnixSeconds) : "—",
    nextChargeAmount:
      input.nextChargeAmountCents !== null && input.nextChargeAmountCents !== undefined
        ? formatUsd(input.nextChargeAmountCents)
        : "—",
    planUrl: `${siteUrl}/mi-plan`,
  })

  if (!isUpgrade) {
    html = html.replace("Se desbloqueó", "Ya no incluye")
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: `Tu plan cambió: ${fromPlan.name} → ${toPlan.name}`,
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

  const email = await getAccountEmail(input.accountId)
  if (!email) return

  const plan = getPlanBySlug(input.planSlug)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const html = renderEmailTemplate("05-cancelacion-suscripcion.html", {
    planName: escapeHtml(plan.name),
    accessUntil: input.accessUntilUnixSeconds ? formatDate(input.accessUntilUnixSeconds) : "el final de tu período ya pagado",
    billingPortalUrl: `${siteUrl}/mi-plan`,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: "Cancelamos tu suscripción",
    html,
  })
  if (error) console.error("[notify-billing] Error mandando el correo de cancelación:", error)
}
