/**
 * Webhook de Stripe — recibe eventos de pago (checkout completado, pago
 * fallido, suscripción cancelada, etc.) y actualiza el plan del negocio.
 * NO conectado todavía: no hay endpoint registrado en el dashboard de
 * Stripe porque no hay cuenta de Stripe creada (ver docs/12-guia-backend.md).
 *
 * Cuando se conecte: registrar este endpoint en Stripe Developers > Webhooks
 * apuntando a https://tu-dominio.com/api/webhooks/stripe, escuchando al
 * mínimo "checkout.session.completed" y "customer.subscription.deleted",
 * y copiar el "Signing secret" a STRIPE_WEBHOOK_SECRET (.env.local).
 *
 * La verificación de firma (stripe.webhooks.constructEvent) es la razón por
 * la que este endpoint necesita el body crudo, no JSON parseado — por eso
 * usa request.text() en vez de request.json().
 */

import { NextResponse } from "next/server"
import { getStripeClient } from "@/lib/stripe/client"

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
      const session = event.data.object as { metadata?: { planSlug?: string }; customer?: string }
      // TODO cuando Supabase esté conectado: actualizar la suscripción del
      // negocio/usuario dueño de este checkout a session.metadata.planSlug,
      // guardando session.customer (Stripe customer id) para futuros cobros.
      console.log("[api/webhooks/stripe] Checkout completado:", session.metadata?.planSlug)
      break
    }
    case "customer.subscription.deleted": {
      // TODO: bajar el negocio correspondiente de vuelta al plan "foodie" (gratis).
      console.log("[api/webhooks/stripe] Suscripción cancelada")
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
