/**
 * Aplica un plan GRATIS (priceUsdCents === 0) a la cuenta que hace la petición.
 * Existe para que el cliente pueda "elegir el plan gratuito" (registro sin pagar,
 * botón "Omitir por ahora", bajar de plan desde /planes) sin poder escribir
 * directamente en account_plans (ver RLS en supabase/migrations/0004_account_plans.sql)
 * — un downgrade a gratis nunca es un problema de seguridad, así que no hace falta
 * verificarlo contra Stripe como sí se hace con los planes pagos
 * (app/api/checkout/session/route.ts), pero igual pasa por el servidor para que
 * account_plans en Supabase (la fuente de verdad real) quede consistente, no solo el
 * caché local del navegador.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const planSlug = body?.planSlug as string | undefined
  const plan = getPlanBySlug(planSlug)

  if (!planSlug || plan.slug !== planSlug || plan.priceUsdCents > 0) {
    return NextResponse.json({ error: `"${planSlug}" no es un plan gratuito válido.` }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("account_plans").upsert({
    account_id: user.id,
    plan_slug: plan.slug,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[api/plan/set-free] Error guardando el plan:", error)
    return NextResponse.json({ error: "No se pudo guardar el plan." }, { status: 500 })
  }

  return NextResponse.json({ planSlug: plan.slug })
}
