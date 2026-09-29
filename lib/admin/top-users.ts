/**
 * Ranking de usuarios por uso (docs/141) — puro, lo usa /api/admin/top-users y lo cubre
 * top-users.test.ts.
 */

export type TopUsersSort = "days" | "actions" | "time"

export interface ActivityRow {
  user_id: string
  user_name: string
  module: string
  action: string
  created_at: string
}

export interface UserUsage {
  userId: string
  email: string
  name: string
  plan: string
  activeDays: number
  actions: number
  visits: number
  topModules: string[]
  totalActiveSeconds: number
  lastSeenAt: string | null
}

export function rankUsersByUsage(input: {
  activity: ActivityRow[]
  presence: Map<string, { total_active_seconds: number | null; last_seen_at: string | null }>
  planBy: Map<string, string>
  emailBy: Map<string, string>
  sort: TopUsersSort
}): UserUsage[] {
  const byUser = new Map<string, { name: string; days: Set<string>; actions: number; visits: number; modules: Map<string, number> }>()
  for (const row of input.activity) {
    let u = byUser.get(row.user_id)
    if (!u) {
      // Las filas vienen de la más reciente a la más vieja: el primer nombre es el actual.
      u = { name: row.user_name, days: new Set(), actions: 0, visits: 0, modules: new Map() }
      byUser.set(row.user_id, u)
    }
    u.days.add(row.created_at.slice(0, 10))
    if (row.action === "entered") u.visits++
    else u.actions++
    u.modules.set(row.module, (u.modules.get(row.module) ?? 0) + 1)
  }

  // Quien tiene tiempo en la app pero ninguna fila en el período no entra: el listado es
  // de uso en el período elegido.
  const users: UserUsage[] = [...byUser.entries()].map(([userId, u]) => {
    const presence = input.presence.get(userId)
    return {
      userId,
      email: input.emailBy.get(userId) ?? "—",
      name: u.name,
      plan: input.planBy.get(userId) ?? "foodie",
      activeDays: u.days.size,
      actions: u.actions,
      visits: u.visits,
      topModules: [...u.modules.entries()]
        .filter(([m]) => m !== "dashboard")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => m),
      totalActiveSeconds: presence?.total_active_seconds ?? 0,
      lastSeenAt: presence?.last_seen_at ?? null,
    }
  })

  const primary = (u: UserUsage) =>
    input.sort === "actions" ? u.actions : input.sort === "time" ? u.totalActiveSeconds : u.activeDays
  return users.sort((a, b) => primary(b) - primary(a) || b.actions - a.actions || b.activeDays - a.activeDays)
}
