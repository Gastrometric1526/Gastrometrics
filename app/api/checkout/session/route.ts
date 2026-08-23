/**
 * Recupera el customer id de Stripe a partir de un checkout session_id — se
 * llama justo después de volver de Stripe Checkout (ver success_url en
 * app/api/checkout/route.ts), para que app/dashboard/page.tsx pueda guardar
 * el customer id en localStorage y habilitar el botón "Gestionar mi
 * suscripción" (Portal de Cliente, ver app/api/stripe/portal/route.ts).
 *
 * Por qué esto es seguro sin un backend propio: session_id ya viene firmado
 * y generado por Stripe (no lo elige el usuario), así que devolver el
 * customer id asociado a ESE session_id específico no expone nada que el
 * usuario no acabe de crear él mismo pagando. Es el mismo modelo de
 * confianza que ya usa el resto de la app (ver lib/plan-access.ts): sin
 * Supabase conectado todavía, el cliente es la única fuente de verdad.
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export async function GET(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no está configurado todavía en este entorno." }, { status: 503 })
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "Falta session_id." }, { status: 400 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id

    if (!customerId) {
      return NextResponse.json({ error: "La sesión no tiene un cliente asociado." }, { status: 404 })
    }

    return NextResponse.json({ customerId })
  } catch (error) {
    console.error("[api/checkout/session] Error recuperando la sesión:", error)
    return NextResponse.json({ error: "No se pudo recuperar la sesión de pago." }, { status: 500 })
  }
}
