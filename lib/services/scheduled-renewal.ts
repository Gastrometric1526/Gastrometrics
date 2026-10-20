/**
 * Pago programado al vencer un plan asignado (fundadoras, /admin) — pedido del dueño
 * (docs/165): cuando se le acaba el plan, la persona puede dejar programado el pago de un
 * plan, y la cuenta solo cambia a ese plan si Stripe confirma que cobró. Si no, pasa a
 * Foodie como siempre (runExpiredPlanDowngrades).
 *
 * Cómo funciona:
 * - /api/checkout con `renewal: true` crea una suscripción de Stripe con prueba hasta la
 *   fecha de vencimiento (`trial_end`): se guarda la tarjeta ahora y el primer cobro es ese
 *   día. Stripe exige al menos 48 h; con menos, se paga de inmediato (Checkout normal).
 * - Mientras no se cobra, la suscripción NO se guarda en account_plans (el plan asignado
 *   sigue igual y vence igual). Se guarda en app_metadata.scheduled_plan del usuario
 *   (Supabase Auth), sin migración nueva, igual que founder_grant.
 * - verifyScheduledRenewal() consulta a Stripe la última factura de esa suscripción y
 *   aplica el plan SOLO si está pagada. Se llama desde el webhook, el cron diario y
 *   /api/plan/renewal (cada vez que la persona abre la app), porque Stripe tarda ~1 h
 *   en cobrar la factura después de terminar la prueba y no siempre avisa otra vez.
 */

import type Stripe from "stripe"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { getPlanBySlug } from "@/lib/plans"
import { sendPlanChangedEmail, sendOwnerBillingNotification } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"

export interface ScheduledRenewal {
  planSlug: string
  subscriptionId: string
  customerId: string | null
  /** Fecha del primer cobro (= vencimiento del plan actual). */
  startsAt: string
  createdAt: string
}

export type RenewalStatus =
  | { status: "none" }
  | { status: "scheduled"; renewal: ScheduledRenewal }
  | { status: "payment_failed"; renewal: ScheduledRenewal }
  | { status: "applied"; planSlug: string }

const KEY = "scheduled_plan"
const DEAD_STATUSES = ["canceled", "incomplete_expired", "unpaid"]

export async function getScheduledRenewal(accountId: string): Promise<ScheduledRenewal | null> {
  const { data } = await getSupabaseAdminClient().auth.admin.getUserById(accountId)
  const value = (data?.user?.app_metadata as Record<string, unknown> | undefined)?.[KEY]
  return value && typeof value === "object" ? (value as ScheduledRenewal) : null
}

async function writeScheduledRenewal(accountId: string, value: ScheduledRenewal | null): Promise<void> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin.auth.admin.getUserById(accountId)
  const current = (data?.user?.app_metadata as Record<string, unknown> | undefined) || {}
  const { error } = await admin.auth.admin.updateUserById(accountId, { app_metadata: { ...current, [KEY]: value } })
  if (error) console.error("[scheduled-renewal] No se pudo guardar el pago programado:", error)
}

/** Guarda el pago programado al volver de Checkout. Idempotente (webhook + /api/checkout/session). */
export async function saveScheduledRenewal(input: {
  accountId: string
  planSlug: string
  subscriptionId: string
  customerId: string | null
  startsAt: string
}): Promise<void> {
  const previous = await getScheduledRenewal(input.accountId)
  if (previous?.subscriptionId === input.subscriptionId) return
  // Reemplaza uno anterior: se cancela para que nunca haya dos cobros programados.
  if (previous) await cancelStripeSubscription(previous.subscriptionId)
  await writeScheduledRenewal(input.accountId, {
    planSlug: input.planSlug,
    subscriptionId: input.subscriptionId,
    customerId: input.customerId,
    startsAt: input.startsAt,
    createdAt: new Date().toISOString(),
  })
}

async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  if (!isStripeConfigured()) return
  try {
    await getStripeClient().subscriptions.cancel(subscriptionId)
  } catch (error: any) {
    if (error?.code !== "resource_missing") console.error("[scheduled-renewal] No se pudo cancelar la suscripción programada:", error)
  }
}

/** La persona cancela su pago programado (o pagó otro plan de inmediato). */
export async function cancelScheduledRenewal(accountId: string): Promise<void> {
  const renewal = await getScheduledRenewal(accountId)
  if (!renewal) return
  await cancelStripeSubscription(renewal.subscriptionId)
  await writeScheduledRenewal(accountId, null)
}

function invoiceIsPaid(invoice: Stripe.Invoice | string | null | undefined): boolean {
  if (!invoice || typeof invoice === "string") return false
  return invoice.status === "paid" && (invoice.amount_paid ?? 0) > 0
}

/**
 * Revisa en Stripe si el primer cobro del pago programado ya pasó y, solo entonces,
 * aplica el plan. Nunca cambia el plan por una suscripción en prueba o sin pagar.
 */
export async function verifyScheduledRenewal(accountId: string): Promise<RenewalStatus> {
  const renewal = await getScheduledRenewal(accountId)
  if (!renewal) return { status: "none" }
  if (!isStripeConfigured()) return { status: "scheduled", renewal }

  let subscription: Stripe.Subscription
  try {
    subscription = await getStripeClient().subscriptions.retrieve(renewal.subscriptionId, { expand: ["latest_invoice"] })
  } catch (error: any) {
    if (error?.code === "resource_missing") {
      await writeScheduledRenewal(accountId, null)
      return { status: "none" }
    }
    console.error("[scheduled-renewal] No se pudo consultar la suscripción:", error)
    return { status: "scheduled", renewal }
  }

  if (DEAD_STATUSES.includes(subscription.status)) {
    await writeScheduledRenewal(accountId, null)
    return { status: "none" }
  }
  if (subscription.status === "trialing") return { status: "scheduled", renewal }
  if (subscription.status === "active" && invoiceIsPaid(subscription.latest_invoice)) {
    await applyPaidRenewal(accountId, renewal, subscription)
    return { status: "applied", planSlug: renewal.planSlug }
  }
  // past_due / incomplete: Stripe no pudo cobrar (y reintenta). Mientras tanto, nada cambia.
  if (subscription.status === "past_due" || subscription.status === "incomplete") return { status: "payment_failed", renewal }
  return { status: "scheduled", renewal }
}

async function applyPaidRenewal(accountId: string, renewal: ScheduledRenewal, subscription: Stripe.Subscription) {
  const admin = getSupabaseAdminClient()
  const planSlug = getPlanBySlug(renewal.planSlug).slug
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
  const item = subscription.items.data[0]
  const periodEnd = item?.current_period_end ?? null
  const amountCents = typeof item?.price.unit_amount === "number" ? item.price.unit_amount : null

  const { data: before } = await admin
    .from("account_plans")
    .select("plan_slug, stripe_subscription_id")
    .eq("account_id", accountId)
    .maybeSingle()
  // Ya aplicado por otra llamada (webhook y app a la vez): solo se limpia la marca.
  if (before?.stripe_subscription_id === subscription.id) {
    await writeScheduledRenewal(accountId, null)
    return
  }
  const previousPlanSlug = before?.plan_slug || "foodie"
  const { error } = await admin.from("account_plans").upsert({
    account_id: accountId,
    plan_slug: planSlug,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan_expires_at: null,
    cancel_at_period_end: false,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error("[scheduled-renewal] No se pudo aplicar el plan pagado:", error)
    return
  }
  await writeScheduledRenewal(accountId, null)

  try {
    await sendPlanChangedEmail({
      accountId,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: planSlug,
      nextChargeUnixSeconds: periodEnd,
      nextChargeAmountCents: amountCents,
      source: "stripe",
    })
    await recordPlanChangeNotice({
      accountId,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: planSlug,
      amountCents,
      nextChargeUnixSeconds: periodEnd,
      expiresAtUnixSeconds: null,
      source: "stripe",
    })
    await sendOwnerBillingNotification({
      event: "new_subscription",
      accountId,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: planSlug,
      amountCents,
    })
  } catch (notifyError) {
    console.error("[scheduled-renewal] Error en los avisos (el plan ya quedó aplicado):", notifyError)
  }
}

/** Cron diario: revisa todos los pagos programados (respaldo del webhook y de la app). */
export async function runScheduledRenewalChecks(): Promise<{ checked: number; applied: number }> {
  const admin = getSupabaseAdminClient()
  let checked = 0
  let applied = 0
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const user of data.users) {
      if (!(user.app_metadata as Record<string, unknown> | undefined)?.[KEY]) continue
      checked++
      const result = await verifyScheduledRenewal(user.id)
      if (result.status === "applied") applied++
    }
    if (data.users.length < 200) break
  }
  return { checked, applied }
}
