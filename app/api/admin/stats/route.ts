/**
 * Estadísticas globales reales de la app — reemplaza el conteo de "este navegador"
 * (getAllBusinesses().length) que mostraba /admin antes de esto. Gateado por la misma
 * cookie de sesión admin que el resto de /admin (ver lib/admin-auth.ts).
 *
 * Distribución por país y tiempo promedio en la app (ver docs/78): mismo criterio que
 * planDistribution — profiles.nationality y user_presence.total_active_seconds
 * (supabase/migrations/0016_presence_time_tracking.sql) se agregan del lado del
 * servidor sobre TODAS las cuentas, no solo una muestra.
 *
 * Agregados nuevos (pedido explícito del dueño del proyecto: "si ves otras cosas que
 * crees que debería poder ver desde /admin, agrégalas"):
 * - planOverview: cuántas cuentas pagan de verdad por Stripe vs. cuántas tienen un
 *   plan pago puesto a mano desde este mismo /admin (cortesías/testers) vs. gratis —
 *   el MRR estimado de arriba ya mezclaba ambas sin decir cuánto es "de verdad".
 * - expiringSoon: cuentas con vencimiento de plan (puesto a mano) dentro de los
 *   próximos 14 días — hoy existe el campo pero no hay ninguna vista que las agrupe,
 *   así que una por vencer solo se nota si alguien abre esa cuenta puntual.
 * - teamUsage: cuántas cuentas usan de verdad la función de equipo (multiusuario)
 *   vs. cuentas solas — diferenciador real de plan que hoy solo se ve una cuenta a
 *   la vez en la lista de Cuentas (columna "Equipo").
 * - manualSalesAdoption: adopción real de "Registro manual de ventas" (docs/90,
 *   función `manual_sales`, para negocios sin POS) — hoy sales_imports mezcla POS y
 *   manual bajo un solo conteo, así que no había forma de saber si la función nueva
 *   estaba aterrizando.
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
    // barato — no hay endpoint de "count" aparte en esta versión del SDK. Se guarda
    // el correo de cada cuenta (no solo el total) para poder nombrar cuentas en
    // "planes por vencer" más abajo sin una segunda pasada de paginación.
    let totalUsers = 0
    const emailByUserId = new Map<string, string>()
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      totalUsers += data.users.length
      for (const u of data.users) {
        if (u.email) emailByUserId.set(u.id, u.email)
      }
      if (data.users.length < 200) break
      page += 1
    }

    const [
      { count: totalBusinesses },
      planRowsResult,
      teamRowsResult,
      profileRowsResult,
      presenceRowsResult,
      salesImportRowsResult,
    ] = await Promise.all([
      admin.from("businesses").select("id", { count: "exact", head: true }),
      admin.from("account_plans").select("account_id, plan_slug, plan_expires_at, stripe_subscription_id"),
      admin.from("team_members").select("owner_id"),
      admin.from("profiles").select("nationality"),
      admin.from("user_presence").select("total_active_seconds"),
      admin.from("sales_imports").select("owner_id, data"),
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

    const totalTeamMembers = (teamRowsResult.data ?? []).length

    // Uso real de equipo: cuántas cuentas DISTINTAS tienen al menos un miembro
    // invitado (sin importar cuántos), no cuántas filas de team_members existen en
    // total (eso ya lo da totalTeamMembers arriba).
    const accountsWithTeamSet = new Set((teamRowsResult.data ?? []).map((row) => row.owner_id))
    const teamUsage = {
      accountsWithTeam: accountsWithTeamSet.size,
      soloAccounts: Math.max(0, totalUsers - accountsWithTeamSet.size),
    }

    // Plan real de Stripe vs. plan puesto a mano desde este mismo /admin (cortesía o
    // tester) vs. cuenta gratis de verdad — el MRR estimado de arriba mezcla las
    // primeras dos sin distinguir cuál es dinero real entrando.
    const paidPlanSlugs = new Set(plans.filter((p) => p.priceUsdCents > 0).map((p) => p.slug))
    let onStripe = 0
    let manualOverride = 0
    for (const row of planRowsResult.data ?? []) {
      if (!paidPlanSlugs.has(row.plan_slug)) continue
      if (row.stripe_subscription_id) onStripe += 1
      else manualOverride += 1
    }
    const planOverview = {
      onStripe,
      manualOverride,
      free: Math.max(0, totalUsers - onStripe - manualOverride),
    }

    // Vencimientos de plan puestos a mano (docs/89) dentro de los próximos 14 días —
    // hoy ese dato solo se ve abriendo cada cuenta una por una desde Cuentas.
    const EXPIRING_SOON_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const expiringSoon = (planRowsResult.data ?? [])
      .filter((row) => {
        if (!row.plan_expires_at) return false
        const expiresAtMs = new Date(row.plan_expires_at).getTime()
        return expiresAtMs > now && expiresAtMs - now <= EXPIRING_SOON_WINDOW_MS
      })
      .map((row) => ({
        email: emailByUserId.get(row.account_id) || row.account_id,
        planSlug: row.plan_slug,
        expiresAt: row.plan_expires_at as string,
      }))
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())

    // Adopción real de "Registro manual de ventas" (docs/90) — sales_imports mezcla
    // POS (source ausente/"pos_import") y manual ("manual") bajo la misma tabla; se
    // separan acá para poder responder "¿está aterrizando la función nueva?".
    const manualOwnerIds = new Set<string>()
    const posOwnerIds = new Set<string>()
    let totalManualEntries = 0
    for (const row of salesImportRowsResult.data ?? []) {
      const info = row.data as { source?: string } | null
      if (info?.source === "manual") {
        manualOwnerIds.add(row.owner_id)
        totalManualEntries += 1
      } else {
        posOwnerIds.add(row.owner_id)
      }
    }
    const manualSalesAdoption = {
      accountsUsingManual: manualOwnerIds.size,
      totalManualEntries,
      accountsUsingPos: posOwnerIds.size,
    }

    return NextResponse.json({
      totalUsers,
      totalBusinesses: totalBusinesses || 0,
      totalTeamMembers: totalTeamMembers || 0,
      planDistribution,
      estimatedMrrUsdCents,
      planOverview,
      expiringSoon,
      teamUsage,
      manualSalesAdoption,
      countryDistribution,
      avgActiveSecondsPerUser,
    })
  } catch (error) {
    console.error("[api/admin/stats] Error calculando estadísticas:", error)
    return NextResponse.json({ error: "No se pudieron calcular las estadísticas." }, { status: 500 })
  }
}
