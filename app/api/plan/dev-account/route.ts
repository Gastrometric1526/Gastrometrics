/**
 * Atajo del dueño del proyecto: si la cuenta que inició sesión es la suya
 * (josedanielromero.cr@outlook.com), le aplica el plan Chef Ejecutivo sin pasar por
 * Stripe (ver app/login/page.tsx y docs/50 §5 para el contexto original).
 *
 * Por qué esto es una ruta de servidor y no un setCurrentPlanSlug() directo en el
 * cliente (como era antes de conectar Supabase): con account_plans ya no siendo
 * escribible por el cliente (ver RLS en 0004_account_plans.sql), el único lugar
 * donde puede vivir esta comparación de correo es el servidor — usa la sesión real
 * (cookie httpOnly) para saber quién es, no algo que el navegador pueda falsificar.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const DEV_ACCOUNT_EMAIL = "josedanielromero.cr@outlook.com"
const DEV_ACCOUNT_PLAN_SLUG = "chef-ejecutivo"

export async function POST() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== DEV_ACCOUNT_EMAIL) {
    return NextResponse.json({ applied: false })
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("account_plans").upsert({
    account_id: user.id,
    plan_slug: DEV_ACCOUNT_PLAN_SLUG,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[api/plan/dev-account] Error guardando el plan:", error)
    return NextResponse.json({ applied: false })
  }

  return NextResponse.json({ applied: true, planSlug: DEV_ACCOUNT_PLAN_SLUG })
}
