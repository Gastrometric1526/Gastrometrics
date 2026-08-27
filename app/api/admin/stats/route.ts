/**
 * Estadísticas globales reales de la app — reemplaza el conteo de "este navegador"
 * (getAllBusinesses().length) que mostraba /admin antes de esto. Gateado por la misma
 * cookie de sesión admin que el resto de /admin (ver lib/admin-auth.ts).
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { plans } from "@/lib/plans"

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdminClient()

    // A esta escala (decenas/cientos de cuentas) recorrer listUsers() completo es
    // barato — no hay endpoint de "count" aparte en esta versión del SDK.
    let totalUsers = 0
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      totalUsers += data.users.length
      if (data.users.length < 200) break
      page += 1
    }

    const [{ count: totalBusinesses }, planRowsResult, { count: totalTeamMembers }] = await Promise.all([
      admin.from("businesses").select("id", { count: "exact", head: true }),
      admin.from("account_plans").select("plan_slug"),
      admin.from("team_members").select("id", { count: "exact", head: true }),
    ])

    const planCounts: Record<string, number> = {}
    for (const row of planRowsResult.data ?? []) {
      planCounts[row.plan_slug] = (planCounts[row.plan_slug] || 0) + 1
    }

    // Cuentas sin fila en account_plans (nunca se les asignó nada explícito) están en
    // "foodie" por default en toda la app — se suman acá para que la distribución sume
    // el total real de usuarios, no solo los que ya tienen fila.
    const accountedFor = Object.values(planCounts).reduce((a, b) => a + b, 0)
    planCounts.foodie = (planCounts.foodie || 0) + Math.max(0, totalUsers - accountedFor)

    const planDistribution = plans.map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      count: planCounts[plan.slug] || 0,
    }))

    // Estimado, no facturación real de Stripe: algunas cuentas tienen un plan asignado
    // a mano desde este mismo /admin (testers, cortesías) sin pagar de verdad. Es la
    // suma de precio × cantidad de cuentas en cada plan pago.
    const estimatedMrrUsdCents = plans.reduce((sum, plan) => {
      if (plan.priceUsdCents <= 0) return sum
      return sum + plan.priceUsdCents * (planCounts[plan.slug] || 0)
    }, 0)

    return NextResponse.json({
      totalUsers,
      totalBusinesses: totalBusinesses || 0,
      totalTeamMembers: totalTeamMembers || 0,
      planDistribution,
      estimatedMrrUsdCents,
    })
  } catch (error) {
    console.error("[api/admin/stats] Error calculando estadísticas:", error)
    return NextResponse.json({ error: "No se pudieron calcular las estadísticas." }, { status: 500 })
  }
}
