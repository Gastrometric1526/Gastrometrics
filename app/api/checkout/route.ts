/**
 * Crea una sesión de Stripe Checkout para un plan de /planes — reemplazo
 * real del cobro simulado de app/signup/payment/page.tsx. NO está conectado
 * a esa página todavía a propósito (ver docs/12-guia-backend.md): esta ruta
 * ya funciona de punta a punta el día que exista STRIPE_SECRET_KEY, pero
 * mientras tanto app/signup/payment/page.tsx sigue con su flujo simulado
 * (nunca llama a este endpoint).
 *
 * Para conectarla: en app/signup/payment/page.tsx, el botón "Confirmar y
 * Comenzar" debe hacer un fetch("/api/checkout", { method: "POST", body:
 * JSON.stringify({ planSlug }) }) y redirigir a la `url` que devuelve, en
 * vez de simular el procesamiento con un setTimeout.
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { getPlanBySlug } from "@/lib/plans"

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe no está configurado todavía en este entorno." },
      { status: 503 },
    )
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
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/signup/payment?plan=${plan.slug}&checkout=cancelled`,
      metadata: { planSlug: plan.slug },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[api/checkout] Error creando sesión de Stripe:", error)
    return NextResponse.json({ error: "No se pudo iniciar el pago. Intenta de nuevo." }, { status: 500 })
  }
}
