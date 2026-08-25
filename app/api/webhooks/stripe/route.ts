/**
 * Webhook de Stripe — recibe eventos de pago (checkout completado, suscripción
 * actualizada/cancelada) y actualiza account_plans de verdad (ver
 * supabase/migrations/0004_account_plans.sql). Registrado en Stripe Developers >
 * Webhooks apuntando a https://<dominio>/api/webhooks/stripe, escuchando
 * "checkout.session.completed", "customer.subscription.updated" y
 * "customer.subscription.deleted" — "Signing secret" en STRIPE_WEBHOOK_SECRET.
 *
 * La verificación de firma (stripe.webhooks.constructEvent) es la razón por la que
 * este endpoint necesita el body crudo, no JSON parseado — por eso usa
 * request.text() en vez de request.json().
 *
 * Por qué esta ruta usa la service role key (lib/supabase/admin.ts) y no la sesión
 * del usuario: Stripe llama a este endpoint servidor-a-servidor, sin cookies ni
 * sesión de nadie — no hay "usuario actual" que autenticar. La cuenta a la que
 * aplicar el cambio se identifica por datos que sí vienen firmados por Stripe
 * (session.client_reference_id / subscription.metadata.accountId, puestos por este
 * mismo backend al crear el checkout, ver app/api/checkout/route.ts) o, para eventos
 * que no traen esa metadata (ej. baja de suscripción iniciada desde el Portal de
 * Cliente), por el stripe_customer_id ya guardado en account_plans.
 */

import { NextResponse } from "next/server"
import { getStripeClient } from "@/lib/stripe/client"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"
import { sendPlanChangedEmail, sendSubscriptionCancelledEmail } from "@/lib/services/notify-billing"

const FREE_PLAN_SLUG = "foodie"

async function getCurrentPlanSlug(accountId: string): Promise<string> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from("account_plans").select("plan_slug").eq("account_id", accountId).maybeSingle()
  return data?.plan_slug || FREE_PLAN_SLUG
}

async function setPlanForAccount(accountId: string, planSlug: string, extra: Record<string, unknown> = {}) {
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("account_plans").upsert({
    account_id: accountId,
    plan_slug: planSlug,
    updated_at: new Date().toISOString(),
    ...extra,
  })
  if (error) console.error("[api/webhooks/stripe] Error guardando el plan:", error)
}

async function findAccountIdByStripeCustomer(customerId: string): Promise<string | null> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("account_plans")
    .select("account_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (error) {
    console.error("[api/webhooks/stripe] Error buscando cuenta por stripe_customer_id:", error)
    return null
  }
  return data?.account_id ?? null
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET no está configurado." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Falta el header stripe-signature." }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripeClient()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error("[api/webhooks/stripe] Firma inválida:", error)
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        client_reference_id?: string | null
        metadata?: { planSlug?: string; accountId?: string }
        customer?: string | { id: string }
        subscription?: string | { id: string }
      }
      const accountId = session.metadata?.accountId || session.client_reference_id
      const planSlug = session.metadata?.planSlug
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id

      if (accountId && planSlug && getPlanBySlug(planSlug).slug === planSlug) {
        await setPlanForAccount(accountId, planSlug, {
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
        })
      } else {
        console.error("[api/webhooks/stripe] checkout.session.completed sin accountId/planSlug válidos")
      }
      break
    }
    // Cubre upgrades/downgrades hechos desde el Portal de Cliente de Stripe
    // (app/api/stripe/portal/route.ts) — esos cambios no pasan por /api/checkout, así
    // que este es el único punto donde la app se entera de que el plan cambió.
    case "customer.subscription.updated": {
      const subscription = event.data.object as {
        id: string
        customer: string | { id: string }
        metadata?: { planSlug?: string; accountId?: string }
        status: string
        current_period_end?: number
        items?: { data?: Array<{ price?: { unit_amount?: number | null } }> }
      }
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      const planSlug = subscription.metadata?.planSlug
      const accountId = subscription.metadata?.accountId || (await findAccountIdByStripeCustomer(customerId))

      if (accountId && planSlug && getPlanBySlug(planSlug).slug === planSlug) {
        const activeStatuses = ["active", "trialing", "past_due"]
        const resolvedPlanSlug = activeStatuses.includes(subscription.status) ? planSlug : FREE_PLAN_SLUG
        const previousPlanSlug = await getCurrentPlanSlug(accountId)
        await setPlanForAccount(accountId, resolvedPlanSlug, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
        })
        // Correo best-effort — el plan ya quedó aplicado arriba sin importar si esto
        // falla, así que un error de Resend no debe hacer que Stripe reintente el
        // evento completo.
        try {
          await sendPlanChangedEmail({
            accountId,
            fromPlanSlug: previousPlanSlug,
            toPlanSlug: resolvedPlanSlug,
            nextChargeUnixSeconds: subscription.current_period_end ?? null,
            nextChargeAmountCents: subscription.items?.data?.[0]?.price?.unit_amount ?? null,
          })
        } catch (emailError) {
          console.error("[api/webhooks/stripe] Error mandando el correo de cambio de plan:", emailError)
        }
      }
      break
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as {
        customer: string | { id: string }
        current_period_end?: number
      }
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      const accountId = await findAccountIdByStripeCustomer(customerId)
      if (accountId) {
        const previousPlanSlug = await getCurrentPlanSlug(accountId)
        await setPlanForAccount(accountId, FREE_PLAN_SLUG, { stripe_subscription_id: null })
        try {
          await sendSubscriptionCancelledEmail({
            accountId,
            planSlug: previousPlanSlug,
            accessUntilUnixSeconds: subscription.current_period_end ?? null,
          })
        } catch (emailError) {
          console.error("[api/webhooks/stripe] Error mandando el correo de cancelación:", emailError)
        }
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
