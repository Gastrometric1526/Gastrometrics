/**
 * Cuentas para las métricas de /admin (docs/153), solo del lado del servidor: fecha de
 * alta (auth.users), si pagan hoy (plan de pago con suscripción real de Stripe, mismo
 * criterio que /api/admin/stats; los testers con plan regalado no cuentan) y su primer
 * costo (primera receta guardada con costo > 0, sin contar la receta de ejemplo que la
 * app siembra sola, lib/services/seed-example-recipe.ts).
 */

import type { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchAllPages } from "@/lib/services/notify-reengagement"
import { plans as PLAN_CATALOG } from "@/lib/plans"
import type { MetricAccount } from "@/lib/activation-metrics"

export interface AdminMetricAccount extends MetricAccount {
  email: string
  emailConfirmed: boolean
}

// Nombres de la receta de ejemplo en los 6 idiomas ("Ejemplo: …", "示例：…")
const EXAMPLE_RECIPE = /^(Ejemplo|Example|Eksempel|Exemple|Exemplo|示例)\s*[:：]/

export async function loadAdminMetricAccounts(admin: ReturnType<typeof getSupabaseAdminClient>): Promise<AdminMetricAccount[]> {
  const users: { id: string; email: string; createdAt: string; emailConfirmed: boolean }[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email || "", createdAt: u.created_at, emailConfirmed: Boolean(u.email_confirmed_at) })))
    if (data.users.length < 200) break
  }

  const paidSlugs = new Set(PLAN_CATALOG.filter((p) => p.priceUsdCents > 0).map((p) => p.slug))
  const { data: plans, error: plansError } = await admin.from("account_plans").select("account_id, plan_slug, stripe_subscription_id")
  if (plansError) throw plansError
  const paying = new Set((plans ?? []).filter((p) => paidSlugs.has(p.plan_slug) && p.stripe_subscription_id).map((p) => p.account_id))

  const recipes = await fetchAllPages<{ owner_id: string; created_at: string; name: string; totalCost: unknown }>((from, to) =>
    admin.from("recipes").select("owner_id, created_at, name, totalCost:data->totalCost").order("created_at").range(from, to),
  )
  const firstCostAt = new Map<string, string>()
  for (const r of recipes) {
    if (firstCostAt.has(r.owner_id) || EXAMPLE_RECIPE.test(r.name ?? "")) continue
    if (Number(r.totalCost) > 0) firstCostAt.set(r.owner_id, r.created_at)
  }

  return users.map((u) => ({ ...u, paying: paying.has(u.id), firstCostAt: firstCostAt.get(u.id) ?? null }))
}
