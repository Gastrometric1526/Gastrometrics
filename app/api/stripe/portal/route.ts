/**
 * Crea una sesión del Portal de Cliente de Stripe — página hospedada por
 * Stripe donde alguien con una suscripción activa puede cambiar de plan,
 * actualizar su método de pago, ver facturas o cancelar. Reemplaza tener que
 * construir esa UI a mano.
 *
 * Requiere un customer id de Stripe, que hoy solo existe en el navegador de
 * quien ya completó un checkout (ver app/api/checkout/session/route.ts y
 * app/dashboard/page.tsx) — sin Supabase conectado todavía no hay dónde
 * más guardarlo. Alguien que nunca pagó (plan Foodie gratis) no tiene
 * customer id y por lo tanto no ve el botón que llama a esta ruta.
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no está configurado todavía en este entorno." }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const customerId = body?.customerId as string | undefined

  if (!customerId) {
    return NextResponse.json({ error: "Falta customerId en el cuerpo de la petición." }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  try {
    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/mi-plan`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[api/stripe/portal] Error creando sesión del portal:", error)
    return NextResponse.json({ error: "No se pudo abrir el portal de suscripción." }, { status: 500 })
  }
}
