/**
 * Crea una sesión de Stripe Checkout para un plan de /planes. Conectada desde
 * app/signup/payment/page.tsx (botón "Continuar al pago seguro"). Si
 * STRIPE_SECRET_KEY todavía no está configurada en este entorno, devuelve 503
 * y esa página lo explica sin romper el flujo — sigue disponible "empezar con
 * el plan gratuito".
 *
 * success_url incluye session_id={CHECKOUT_SESSION_ID} (variable que Stripe
 * reemplaza automáticamente) para que app/dashboard/page.tsx pueda pedir el
 * customer id vía /api/checkout/session y habilitar el Portal de Cliente
 * (/api/stripe/portal) más adelante, sin depender de un backend propio
 * todavía (ver ese archivo para el detalle de por qué esto es seguro con
 * solo localStorage).
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured, getOrCreateSubscriptionProductId } from "@/lib/stripe/client"
import { getPlanBySlug } from "@/lib/plans"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { MIN_SCHEDULE_MS } from "@/lib/plan-expiry"

// Cuántas veces puede una cuenta intentar iniciar un pago en poco tiempo — pedido
// explícito del dueño del proyecto (ver docs/61). No hay forma legítima de necesitar
// más de un puñado de intentos en 10 minutos (elegir plan, cancelar en Stripe,
// reintentar) — un número mucho más alto que eso es un doble clic nervioso o un
// script, no una persona comprando de verdad.
const CHECKOUT_MAX_ATTEMPTS = 8
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000
const CHECKOUT_LOCKOUT_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe no está configurado todavía en este entorno." },
      { status: 503 },
    )
  }

  // Requiere sesión real: client_reference_id (abajo) es lo que le permite al webhook
  // (app/api/webhooks/stripe/route.ts) saber a qué cuenta aplicarle el plan cuando
  // Stripe confirme el pago — sin esto, cualquiera podría iniciar un checkout sin
  // que quedara ligado a ninguna cuenta real.
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const rateLimit = checkRateLimit(`checkout:${user.id}`, {
    maxAttempts: CHECKOUT_MAX_ATTEMPTS,
    windowMs: CHECKOUT_WINDOW_MS,
    lockoutMs: CHECKOUT_LOCKOUT_MS,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Demasiados intentos de pago seguidos. Espera unos minutos e intenta de nuevo.",
        lockedForSeconds: rateLimit.lockedForSeconds,
      },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null)
  const planSlug = body?.planSlug as string | undefined
  // Pago al vencer un plan asignado (docs/165): con tiempo suficiente, se programa el
  // primer cobro para la fecha de vencimiento; si no, es un pago normal de inmediato.
  const isRenewal = body?.renewal === true

  if (!planSlug) {
    return NextResponse.json({ error: "Falta planSlug en el cuerpo de la petición." }, { status: 400 })
  }

  const plan = getPlanBySlug(planSlug)
  if (!plan || plan.priceUsdCents <= 0) {
    return NextResponse.json({ error: `Plan "${planSlug}" no encontrado o es gratuito.` }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  try {
    const stripe = getStripeClient()

    // BUG CORREGIDO (ver docs/76): si la cuenta ya tiene una suscripción real activa
    // (está cambiando de un plan pago a otro), esto antes creaba una sesión de
    // Checkout nueva sin importar la existente — el resultado era una SEGUNDA
    // suscripción cobrando en paralelo a la primera, invisible en la app (que solo
    // recuerda el id de la más reciente), hasta que la persona notara el cargo
    // duplicado en su banco o en el propio Stripe. Ahora, si hay una suscripción
    // activa real, se actualiza esa MISMA suscripción en el lugar (mismo patrón
    // price_data que el checkout de siempre, ya que no hay Price fijo por plan) en
    // vez de crear una nueva — Stripe factura la diferencia prorrateada en la
    // siguiente factura, sin pedir la tarjeta de nuevo. El webhook
    // customer.subscription.updated ya sabe leer el planSlug de la metadata que se
    // manda acá, así que account_plans queda al día solo, igual que un cambio hecho
    // desde el Portal de Cliente.
    const { data: accountPlan } = await getSupabaseAdminClient()
      .from("account_plans")
      .select("stripe_subscription_id, plan_expires_at")
      .eq("account_id", user.id)
      .maybeSingle()

    if (accountPlan?.stripe_subscription_id) {
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(accountPlan.stripe_subscription_id)
        const activeStatuses = ["active", "trialing", "past_due"]
        const existingItemId = existingSubscription.items.data[0]?.id
        if (activeStatuses.includes(existingSubscription.status) && existingItemId) {
          const productId = await getOrCreateSubscriptionProductId()
          const updated = await stripe.subscriptions.update(accountPlan.stripe_subscription_id, {
            items: [
              {
                id: existingItemId,
                price_data: {
                  currency: "usd",
                  product: productId,
                  unit_amount: plan.priceUsdCents,
                  recurring: { interval: "month" },
                },
              },
            ],
            metadata: { planSlug: plan.slug, accountId: user.id },
            // docs/165: el cambio solo se aplica si Stripe cobra la diferencia. Con
            // pending_if_incomplete, si el cobro falla la suscripción queda como estaba
            // (pending_update) y la app no cambia de plan.
            proration_behavior: "always_invoice",
            payment_behavior: "pending_if_incomplete",
          })
          if (updated.pending_update) {
            return NextResponse.json(
              { error: "Stripe no pudo cobrar el cambio de plan. Tu plan sigue igual. Revisa tu tarjeta en Mi Plan." },
              { status: 402 },
            )
          }
          return NextResponse.json({ updatedInPlace: true })
        }
      } catch (updateError: any) {
        // Tarjeta rechazada al cobrar la diferencia: el plan sigue igual (docs/165). No se
        // sigue a un checkout nuevo, que crearía una segunda suscripción.
        if (updateError?.type === "StripeCardError") {
          return NextResponse.json(
            { error: "Stripe no pudo cobrar el cambio de plan. Tu plan sigue igual. Revisa tu tarjeta en Mi Plan." },
            { status: 402 },
          )
        }
        // No aborta el flujo — si la suscripción "activa" en account_plans en
        // realidad ya no existe en Stripe (canceló, o algo quedó desincronizado),
        // sigue abajo con un checkout nuevo en vez de dejar a la persona sin poder
        // pagar nada.
        console.error(
          "[api/checkout] No se pudo actualizar la suscripción existente, se intentará un checkout nuevo:",
          updateError,
        )
      }
    }

    // trial_end = vencimiento del plan asignado: Stripe guarda la tarjeta ahora y cobra
    // ese día. La cuenta NO cambia de plan hasta que ese cobro se confirme (ver
    // lib/services/scheduled-renewal.ts). Stripe exige al menos 48 h (MIN_SCHEDULE_MS).
    const expiresAtMs = accountPlan?.plan_expires_at ? new Date(accountPlan.plan_expires_at).getTime() : 0
    const scheduleAt =
      isRenewal && !accountPlan?.stripe_subscription_id && expiresAtMs - Date.now() > MIN_SCHEDULE_MS
        ? new Date(expiresAtMs).toISOString()
        : null
    const metadata: Record<string, string> = { planSlug: plan.slug, accountId: user.id }
    if (scheduleAt) {
      metadata.scheduledRenewal = "1"
      metadata.startsAt = scheduleAt
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `GastroMetrics — Plan ${plan.name}` },
            unit_amount: plan.priceUsdCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/signup/payment?plan=${plan.slug}&checkout=cancelled`,
      metadata,
      // La sesión de checkout es efímera; la metadata NO se copia sola a la
      // suscripción que crea. subscription_data.metadata sí queda en el objeto
      // Subscription, así que eventos futuros (renovación, cambio de plan desde el
      // Portal de Cliente) también pueden leer qué plan es sin depender de la sesión
      // original — ver customer.subscription.updated en el webhook.
      subscription_data: {
        metadata,
        ...(scheduleAt ? { trial_end: Math.floor(new Date(scheduleAt).getTime() / 1000) } : {}),
      },
    })

    // Evento de embudo (ver supabase/migrations/0029_product_events.sql) — server-side
    // acá porque esta ruta ya confirmó que Stripe de verdad creó la sesión de pago
    // (no un intento de "vi el botón y no pasó nada").
    getSupabaseAdminClient()
      .from("product_events")
      .insert({ event_name: "checkout_started" })
      .then(({ error: eventError }) => {
        if (eventError) console.error("[api/checkout] Error registrando evento checkout_started:", eventError)
      })

    return NextResponse.json({ url: session.url, scheduled: Boolean(scheduleAt) })
  } catch (error) {
    console.error("[api/checkout] Error creando sesión de Stripe:", error)
    return NextResponse.json({ error: "No se pudo iniciar el pago. Intenta de nuevo." }, { status: 500 })
  }
}
