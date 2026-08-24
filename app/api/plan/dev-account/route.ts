/**
 * Lista blanca de cuentas con acceso Chef Ejecutivo gratis, sin pasar por Stripe —
 * el dueño del proyecto (ver docs/50 §5) más hasta 10 testers invitados. Se llama
 * después de cada login real (ver app/login/page.tsx); si el correo de la sesión
 * está en TESTER_ALLOWLIST_EMAILS, aplica el plan.
 *
 * Por qué esto es una ruta de servidor y no algo que el cliente decida: con
 * account_plans ya no escribible por el cliente (ver RLS en 0004_account_plans.sql),
 * el único lugar donde puede vivir esta comparación de correo es el servidor — usa
 * la sesión real (cookie httpOnly) para saber quién es, no algo que el navegador
 * pueda falsificar.
 *
 * Por qué una variable de entorno y no una lista fija en el código: los correos de
 * los testers son datos de personas reales — no deben quedar committeados al
 * repositorio (que es público en GitHub). TESTER_ALLOWLIST_EMAILS vive solo en
 * .env.local y en las variables de entorno de Vercel, nunca en el código fuente.
 * Formato: correos separados por coma, sin espacios extra ("a@x.com,b@y.com").
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { isTesterEmail } from "@/lib/tester-allowlist"

const TESTER_PLAN_SLUG = "chef-ejecutivo"

export async function POST() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isTesterEmail(user.email)) {
    return NextResponse.json({ applied: false })
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("account_plans").upsert({
    account_id: user.id,
    plan_slug: TESTER_PLAN_SLUG,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[api/plan/dev-account] Error guardando el plan:", error)
    return NextResponse.json({ applied: false })
  }

  return NextResponse.json({ applied: true, planSlug: TESTER_PLAN_SLUG })
}
