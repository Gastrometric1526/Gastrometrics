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
import { sendPlanChangedEmail, sendSubscriptionCancelledEmail, sendOwnerBillingNotification } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"

const FREE_PLAN_SLUG = "foodie"

async function getCurrentPlanSlug(accountId: string): Promise<string> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin.from("account_plans").select("plan_slug").eq("account_id", accountId).maybeSingle()
  return data?.plan_slug || FREE_PLAN_SLUG
}

async function setPlanForAccount(accountId: string, planSlug: string, extra: Record<string, unknown> = {}) {
  const admin = getSupabaseAdminClient()
  // Un plan real, pagado por Stripe, nunca vence por sí solo (el propio webhook lo
  // maneja vía customer.subscription.deleted) — se limpia por si esta cuenta tuvo
  // antes un plan_expires_at de un vencimiento asignado a mano desde /admin (docs/59).
  let { error } = await admin.from("account_plans").upsert({
    account_id: accountId,
    plan_slug: planSlug,
    plan_expires_at: null,
    updated_at: new Date().toISOString(),
    ...extra,
  })

  // Tolera que supabase/migrations/0008_plan_expiry.sql y/o
  // 0023_plan_cancellation_status.sql todavía no se hayan corrido (columnas nuevas)
  // — sin esto, aplicar un plan real pagado se rompería por completo (pagos ya
  // cobrados sin que el plan real se active) hasta que alguien las corra. Se
  // reintenta primero sin cancel_at_period_end/current_period_end (solo
  // informativos, no bloquean el plan real) antes de darse por vencido.
  if (error) {
    const { cancel_at_period_end, current_period_end, ...extraWithoutCancelInfo } = extra as Record<string, unknown>
    const fallback = await admin.from("account_plans").upsert({
      account_id: accountId,
      plan_slug: planSlug,
      updated_at: new Date().toISOString(),
      ...extraWithoutCancelInfo,
    })
    error = fallback.error
  }

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
          // Suscripción recién creada — nunca "cancelando" (limpia cualquier estado
          // viejo de una suscripción anterior de esta cuenta que sí lo hubiera sido).
          cancel_at_period_end: false,
          current_period_end: null,
        })

        // Correo de confirmación del primer pago (ver docs/77) — no existía ninguno:
        // el webhook solo aplicaba el plan, nadie recibía nada con la marca de
        // GastroMetrics más allá del recibo genérico de Stripe (si esa opción está
        // prendida en el dashboard de Stripe). Reusa la misma plantilla de "cambio de
        // plan" (06-cambio-plan.html) — desde docs/76, este evento SOLO se dispara
        // para una suscripción nueva de verdad (cambiar entre planes pagos ya no pasa
        // por Checkout, actualiza la existente en el lugar), así que "vino de Foodie"
        // es una base real, no una suposición. Best-effort: un correo perdido no debe
        // hacer que Stripe reintente el evento completo, el plan ya quedó aplicado.
        if (subscriptionId) {
          try {
            const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
            const subscriptionItem = subscription.items.data[0]
            const amountCents =
              typeof subscriptionItem?.price.unit_amount === "number" ? subscriptionItem.price.unit_amount : null
            await sendPlanChangedEmail({
              accountId,
              fromPlanSlug: FREE_PLAN_SLUG,
              toPlanSlug: planSlug,
              nextChargeUnixSeconds: subscriptionItem?.current_period_end ?? null,
              nextChargeAmountCents: amountCents,
              source: "stripe",
            })
            // Popup de "tu plan cambió" en el próximo ingreso al dashboard (docs/89).
            await recordPlanChangeNotice({
              accountId,
              fromPlanSlug: FREE_PLAN_SLUG,
              toPlanSlug: planSlug,
              amountCents,
              nextChargeUnixSeconds: subscriptionItem?.current_period_end ?? null,
              expiresAtUnixSeconds: null,
              source: "stripe",
            })
            // Aviso al dueño del proyecto — pedido explícito, ver notify-billing.ts.
            await sendOwnerBillingNotification({
              event: "new_subscription",
              accountId,
              fromPlanSlug: FREE_PLAN_SLUG,
              toPlanSlug: planSlug,
              amountCents,
            })
          } catch (emailError) {
            console.error("[api/webhooks/stripe] Error mandando el correo de confirmación de pago:", emailError)
          }
        }
      } else {
        console.error("[api/webhooks/stripe] checkout.session.completed sin accountId/planSlug válidos")
      }
      break
    }
    // Cubre upgrades/downgrades hechos desde el Portal de Cliente de Stripe
    // (app/api/stripe/portal/route.ts) — esos cambios no pasan por /api/checkout, así
    // que este es el único punto donde la app se entera de que el plan cambió.
    case "customer.subscription.updated": {
      // BUG CORREGIDO (ver docs/77): current_period_end vivía en la raíz de la
      // suscripción en versiones viejas de la API de Stripe — esta cuenta ya usa una
      // versión donde ese campo se movió a cada ítem de la suscripción
      // (subscription.items.data[].current_period_end). El tipo suelto de acá abajo
      // seguía declarando el campo viejo, así que TypeScript nunca marcó el error —
      // en la práctica, "próximo cobro" en el correo de cambio de plan venía saliendo
      // "—" siempre, nunca la fecha real.
      const subscription = event.data.object as {
        id: string
        customer: string | { id: string }
        metadata?: { planSlug?: string; accountId?: string }
        status: string
        cancel_at_period_end?: boolean
        items?: { data?: Array<{ current_period_end?: number; price?: { unit_amount?: number | null } }> }
      }
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      const planSlug = subscription.metadata?.planSlug
      const accountId = subscription.metadata?.accountId || (await findAccountIdByStripeCustomer(customerId))

      if (accountId && planSlug && getPlanBySlug(planSlug).slug === planSlug) {
        const activeStatuses = ["active", "trialing", "past_due"]
        const resolvedPlanSlug = activeStatuses.includes(subscription.status) ? planSlug : FREE_PLAN_SLUG
        const previousPlanSlug = await getCurrentPlanSlug(accountId)
        const nextChargeUnixSeconds = subscription.items?.data?.[0]?.current_period_end ?? null
        const amountCents = subscription.items?.data?.[0]?.price?.unit_amount ?? null
        // "Cancelando, termina el [fecha]" — pedido explícito del dueño del proyecto:
        // el Portal de Cliente de Stripe por default no borra la suscripción al
        // cancelarla, la deja activa (cancel_at_period_end=true) hasta el final del
        // período ya pagado, y recién ahí dispara customer.subscription.deleted. Sin
        // esto la app se veía exactamente igual que una suscripción normal durante
        // todo ese tiempo, sin confirmarle al usuario que su cancelación sí se
        // registró. Solo tiene sentido mientras el plan pagado sigue activo — si ya
        // se resolvió a gratis (status inactivo) no hay nada "en curso" que avisar.
        const isCancelling = resolvedPlanSlug === planSlug && Boolean(subscription.cancel_at_period_end)
        await setPlanForAccount(accountId, resolvedPlanSlug, {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          cancel_at_period_end: isCancelling,
          current_period_end: nextChargeUnixSeconds ? new Date(nextChargeUnixSeconds * 1000).toISOString() : null,
        })
        // Correo best-effort — el plan ya quedó aplicado arriba sin importar si esto
        // falla, así que un error de Resend no debe hacer que Stripe reintente el
        // evento completo.
        try {
          await sendPlanChangedEmail({
            accountId,
            fromPlanSlug: previousPlanSlug,
            toPlanSlug: resolvedPlanSlug,
            nextChargeUnixSeconds,
            nextChargeAmountCents: amountCents,
            source: "stripe",
          })
          // Popup de "tu plan cambió" en el próximo ingreso al dashboard (docs/89).
          await recordPlanChangeNotice({
            accountId,
            fromPlanSlug: previousPlanSlug,
            toPlanSlug: resolvedPlanSlug,
            amountCents,
            nextChargeUnixSeconds,
            expiresAtUnixSeconds: null,
            source: "stripe",
          })
          // Aviso al dueño del proyecto — solo si de verdad cambió el plan (este evento
          // también se dispara en cada renovación sin cambio real, ver docs/89).
          if (previousPlanSlug !== resolvedPlanSlug) {
            await sendOwnerBillingNotification({
              event: "plan_changed",
              accountId,
              fromPlanSlug: previousPlanSlug,
              toPlanSlug: resolvedPlanSlug,
              amountCents,
            })
          }
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
        await setPlanForAccount(accountId, FREE_PLAN_SLUG, {
          stripe_subscription_id: null,
          cancel_at_period_end: false,
          current_period_end: null,
        })
        try {
          await sendSubscriptionCancelledEmail({
            accountId,
            planSlug: previousPlanSlug,
            accessUntilUnixSeconds: subscription.current_period_end ?? null,
          })
          // Aviso al dueño del proyecto — pedido explícito, ver notify-billing.ts.
          await sendOwnerBillingNotification({
            event: "cancelled",
            accountId,
            fromPlanSlug: previousPlanSlug,
            toPlanSlug: FREE_PLAN_SLUG,
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
