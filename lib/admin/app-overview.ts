/**
 * «Toda la app» en /admin (pedido del dueño, docs/286): un parámetro completo de toda la
 * app, de las cuentas y de sus negocios, en una sola vista. Parte pura (probada en
 * app-overview.test.ts); los datos los junta app/api/admin/app-overview.
 *
 * Todo se mide sobre cuentas con el correo confirmado (docs/201): las sin confirmar no
 * cuentan ni en totales ni en porcentajes.
 */

export const APP_MODULES = [
  "businesses",
  "ingredients",
  "recipes",
  "menus",
  "inventory_items",
  "purchase_orders",
  "invoices",
  "sales_imports",
  "pos_data",
  "team_members",
] as const
export type AppModule = (typeof APP_MODULES)[number]

export type OverviewInput = {
  accounts: { id: string; confirmed: boolean }[]
  profiles: { id: string; preferred_language?: string | null; nationality?: string | null; business_type?: string | null; deletion_requested_at?: string | null }[]
  plans: { account_id: string; plan_slug: string | null }[]
  /** owner_id de cada fila de cada tabla. */
  owners: Partial<Record<AppModule, string[]>>
  /** Actividad de los últimos 30 días. */
  activity: { user_id: string; module: string; created_at: string }[]
  now?: number
}

export type ModuleRow = { module: AppModule; rows: number; accounts: number; adoption: number; perAccount: number }
export type CountRow = { key: string; count: number }

export type AppOverview = {
  confirmedAccounts: number
  pendingDeletion: number
  modules: ModuleRow[]
  activity: { module: string; users: number; actions: number }[]
  active7: number
  active30: number
  languages: CountRow[]
  countries: CountRow[]
  businessTypes: CountRow[]
  plans: CountRow[]
}

const tally = (values: (string | null | undefined)[], limit = 8): CountRow[] => {
  const map = new Map<string, number>()
  for (const v of values) {
    const key = (v ?? "").trim() || "—"
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
}

export function computeAppOverview(input: OverviewInput): AppOverview {
  const now = input.now ?? Date.now()
  const confirmed = new Set(input.accounts.filter((a) => a.confirmed).map((a) => a.id))
  const total = confirmed.size
  const profiles = input.profiles.filter((p) => confirmed.has(p.id))

  const modules: ModuleRow[] = APP_MODULES.map((module) => {
    const owners = (input.owners[module] ?? []).filter((id) => confirmed.has(id))
    const accounts = new Set(owners).size
    return {
      module,
      rows: owners.length,
      accounts,
      adoption: total ? accounts / total : 0,
      // Promedio entre quienes lo usan (no entre todas las cuentas).
      perAccount: accounts ? owners.length / accounts : 0,
    }
  })

  const day = 86_400_000
  const recent = input.activity.filter((a) => confirmed.has(a.user_id))
  const byModule = new Map<string, { users: Set<string>; actions: number }>()
  for (const a of recent) {
    const entry = byModule.get(a.module) ?? { users: new Set<string>(), actions: 0 }
    entry.users.add(a.user_id)
    entry.actions++
    byModule.set(a.module, entry)
  }
  const activeSince = (days: number) => new Set(recent.filter((a) => now - Date.parse(a.created_at) <= days * day).map((a) => a.user_id)).size

  return {
    confirmedAccounts: total,
    pendingDeletion: profiles.filter((p) => !!p.deletion_requested_at).length,
    modules,
    activity: [...byModule.entries()]
      .map(([module, v]) => ({ module, users: v.users.size, actions: v.actions }))
      .sort((a, b) => b.users - a.users || b.actions - a.actions),
    active7: activeSince(7),
    active30: activeSince(30),
    languages: tally(profiles.map((p) => p.preferred_language)),
    countries: tally(profiles.map((p) => p.nationality)),
    businessTypes: tally(profiles.map((p) => p.business_type)),
    plans: tally(input.plans.filter((p) => confirmed.has(p.account_id)).map((p) => p.plan_slug || "foodie")),
  }
}
