/**
 * Crea una sesión del Portal de Cliente de Stripe — página hospedada por
 * Stripe donde alguien con una suscripción activa puede cambiar de plan,
 * actualizar su método de pago, ver facturas o cancelar. Reemplaza tener que
 * construir esa UI a mano.
 *
 * BUG DE SEGURIDAD REAL CORREGIDO (ver docs/61): esta ruta aceptaba un
 * `customerId` mandado por el cliente y creaba el portal para ESE id, sin
 * verificar sesión ni que perteneciera a quien pedía el portal — cualquiera
 * (ni siquiera hacía falta estar logueado) que mandara un `cus_...` ajeno
 * abría el portal de facturación de OTRA persona: cambiar su método de pago,
 * cancelar su suscripción, ver sus facturas. El valor venía de
 * `localStorage.getItem("stripe_customer_id")` en el cliente (ver
 * app/mi-plan/page.tsx) — sin espacio por cuenta ni limpieza al cerrar
 * sesión, así que dos personas usando el mismo navegador (una computadora
 * compartida) ya alcanzaba para que la segunda persona, sin ninguna
 * intención maliciosa, terminara abriendo el portal de la primera.
 *
 * Arreglo: sesión real obligatoria, y el customerId se lee del lado del
 * servidor desde `account_plans.stripe_customer_id` de la cuenta autenticada
 * — nunca de algo que mande el cliente. El GET de abajo reemplaza la lectura
 * de localStorage para decidir si mostrar el botón.
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

async function getOwnStripeCustomerId(): Promise<string | null> {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdminClient()
  const { data } = await admin.from("account_plans").select("stripe_customer_id").eq("account_id", user.id).maybeSingle()
  return data?.stripe_customer_id ?? null
}

/** Le dice al cliente si la cuenta actual tiene un customer id real de Stripe — para decidir si mostrar el botón, sin exponer el id en sí. */
export async function GET() {
  const customerId = await getOwnStripeCustomerId()
  return NextResponse.json({ hasStripeCustomer: Boolean(customerId) })
}

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no está configurado todavía en este entorno." }, { status: 503 })
  }

  const customerId = await getOwnStripeCustomerId()
  if (!customerId) {
    return NextResponse.json({ error: "Esta cuenta no tiene una suscripción de Stripe activa." }, { status: 404 })
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
