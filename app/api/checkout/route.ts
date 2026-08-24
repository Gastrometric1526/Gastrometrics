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
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { getPlanBySlug } from "@/lib/plans"
import { getSupabaseServerClient } from "@/lib/supabase/server"

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

  const body = await request.json().catch(() => null)
  const planSlug = body?.planSlug as string | undefined

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
      metadata: { planSlug: plan.slug, accountId: user.id },
      // La sesión de checkout es efímera; la metadata NO se copia sola a la
      // suscripción que crea. subscription_data.metadata sí queda en el objeto
      // Subscription, así que eventos futuros (renovación, cambio de plan desde el
      // Portal de Cliente) también pueden leer qué plan es sin depender de la sesión
      // original — ver customer.subscription.updated en el webhook.
      subscription_data: { metadata: { planSlug: plan.slug, accountId: user.id } },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[api/checkout] Error creando sesión de Stripe:", error)
    return NextResponse.json({ error: "No se pudo iniciar el pago. Intenta de nuevo." }, { status: 500 })
  }
}
