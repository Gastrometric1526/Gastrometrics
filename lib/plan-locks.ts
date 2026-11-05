/**
 * Lo que supera el plan queda bloqueado (pedido del dueño, docs/243). Puro; la misma regla
 * vive en supabase/migrations/0037_plan_excess_locks.sql.
 *
 * Siguen activos los negocios y los invitados más antiguos, hasta el tope del plan. Los demás
 * no se borran: vuelven solos si la cuenta sube de plan o libera un lugar.
 */

interface Dated {
  id: string
}

function beyondLimit<T extends Dated>(items: T[], date: (item: T) => string, limit: number): string[] {
  return [...items]
    .sort((a, b) => new Date(date(a)).getTime() - new Date(date(b)).getTime() || a.id.localeCompare(b.id))
    .slice(Math.max(limit, 0))
    .map((item) => item.id)
}

export function lockedBusinessIds(businesses: Array<Dated & { created_at: string }>, limit: number): string[] {
  return beyondLimit(businesses, (b) => b.created_at, limit)
}

export function membersWithoutSeat(members: Array<Dated & { invited_at: string }>, limit: number): string[] {
  return beyondLimit(members, (m) => m.invited_at, limit)
}
