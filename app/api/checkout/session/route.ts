/**
 * Recupera el customer id de Stripe a partir de un checkout session_id — se llama
 * justo después de volver de Stripe Checkout (ver success_url en
 * app/api/checkout/route.ts). Además de devolver el customer id (para habilitar el
 * botón "Gestionar mi suscripción", ver app/api/stripe/portal/route.ts), esta ruta es
 * la que de verdad aplica el plan comprado a la cuenta.
 *
 * Por qué se aplica el plan aquí y no confiando en un ?plan= de la URL (como se hacía
 * antes de conectar Supabase, ver docs/50): la URL la puede editar cualquiera —
 * bastaba con cambiar el query param para "comprar" el plan más caro gratis. Acá en
 * cambio se lee el planSlug real desde session.metadata (lo puso el propio servidor al
 * crear la sesión, Stripe no deja que el cliente lo toque) y la cuenta viene de la
 * sesión real de Supabase (cookie httpOnly, tampoco falsificable) — ninguno de los dos
 * datos pasa por el navegador de forma editable.
 */

import { NextResponse } from "next/server"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"

export async function GET(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe no está configurado todavía en este entorno." }, { status: 503 })
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")
  if (!sessionId) {
    return NextResponse.json({ error: "Falta session_id." }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id

    if (!customerId) {
      return NextResponse.json({ error: "La sesión no tiene un cliente asociado." }, { status: 404 })
    }

    // Defensa extra: aunque el session_id lo genera Stripe (no lo elige el usuario), no
    // aplica el plan a la cuenta si esta sesión de checkout se creó para otra cuenta —
    // evita que alguien reutilice un session_id ajeno (por ejemplo, viejo en su
    // historial de red) para heredar el plan de otra persona.
    const accountIdFromSession = session.metadata?.accountId
    const planSlug = session.metadata?.planSlug
    if (accountIdFromSession && accountIdFromSession !== user.id) {
      return NextResponse.json({ error: "Esta sesión de pago pertenece a otra cuenta." }, { status: 403 })
    }

    if (planSlug && getPlanBySlug(planSlug).slug === planSlug) {
      const admin = getSupabaseAdminClient()
      await admin.from("account_plans").upsert({
        account_id: user.id,
        plan_slug: planSlug,
        stripe_customer_id: customerId,
        stripe_subscription_id:
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ customerId, planSlug: planSlug ?? null })
  } catch (error) {
    console.error("[api/checkout/session] Error recuperando la sesión:", error)
    return NextResponse.json({ error: "No se pudo recuperar la sesión de pago." }, { status: 500 })
  }
}
