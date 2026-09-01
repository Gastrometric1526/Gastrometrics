/**
 * Estadísticas globales reales de la app — reemplaza el conteo de "este navegador"
 * (getAllBusinesses().length) que mostraba /admin antes de esto. Gateado por la misma
 * cookie de sesión admin que el resto de /admin (ver lib/admin-auth.ts).
 *
 * Distribución por país y tiempo promedio en la app (ver docs/78): mismo criterio que
 * planDistribution — profiles.nationality y user_presence.total_active_seconds
 * (supabase/migrations/0016_presence_time_tracking.sql) se agregan del lado del
 * servidor sobre TODAS las cuentas, no solo una muestra.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { plans } from "@/lib/plans"
import { COUNTRIES } from "@/lib/types/user"

// Cuántos países se muestran con nombre propio en la distribución antes de agrupar el
// resto en "Otros" — a esta escala de usuarios, más de 8 barras ya no se lee como
// resumen, se vuelve una segunda tabla.
const TOP_COUNTRIES = 8

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

    const [{ count: totalBusinesses }, planRowsResult, { count: totalTeamMembers }, profileRowsResult, presenceRowsResult] =
      await Promise.all([
        admin.from("businesses").select("id", { count: "exact", head: true }),
        admin.from("account_plans").select("plan_slug"),
        admin.from("team_members").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("nationality"),
        admin.from("user_presence").select("total_active_seconds"),
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

    // País: profiles.nationality es lo que cada quien eligió al registrarse (mismo
    // selector de app/signup/page.tsx) — cuentas sin perfil completo, o que nunca
    // eligieron país, no cuentan aquí (no hay forma de saber su país sin eso).
    const countryCounts = new Map<string, number>()
    for (const row of profileRowsResult.data ?? []) {
      if (!row.nationality) continue
      countryCounts.set(row.nationality, (countryCounts.get(row.nationality) || 0) + 1)
    }
    const sortedCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])
    const topCountries = sortedCountries.slice(0, TOP_COUNTRIES).map(([code, count]) => ({
      code,
      name: COUNTRIES.find((c) => c.code === code)?.name || code,
      count,
    }))
    const otherCountriesCount = sortedCountries.slice(TOP_COUNTRIES).reduce((sum, [, count]) => sum + count, 0)
    const countryDistribution = otherCountriesCount > 0 ? [...topCountries, { code: "otros", name: null, count: otherCountriesCount }] : topCountries

    // Tiempo promedio en la app: se divide entre TODAS las cuentas (totalUsers), no
    // solo las que ya tienen fila en user_presence — así el promedio refleja el uso
    // real de toda la base, incluyendo cuentas que se registraron y nunca volvieron.
    const totalActiveSeconds = (presenceRowsResult.data ?? []).reduce((sum, row) => sum + (row.total_active_seconds || 0), 0)
    const avgActiveSecondsPerUser = totalUsers > 0 ? Math.round(totalActiveSeconds / totalUsers) : 0

    return NextResponse.json({
      totalUsers,
      totalBusinesses: totalBusinesses || 0,
      totalTeamMembers: totalTeamMembers || 0,
      planDistribution,
      estimatedMrrUsdCents,
      countryDistribution,
      avgActiveSecondsPerUser,
    })
  } catch (error) {
    console.error("[api/admin/stats] Error calculando estadísticas:", error)
    return NextResponse.json({ error: "No se pudieron calcular las estadísticas." }, { status: 500 })
  }
}
