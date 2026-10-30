/**
 * «En línea» primero en /admin → Cuentas (pedido del dueño, docs/212): dentro de cualquier
 * filtro (plan, confirmadas, búsqueda) y de cualquier orden, las cuentas en línea suben
 * arriba de la página 1; el resto conserva el orden elegido. Puro, probado en
 * online-first.test.ts.
 */

// "En línea" = actividad en los últimos 3 minutos (el heartbeat del navegador manda cada
// ~60s, ver components/presence-tracker.tsx). Mismo criterio que /api/admin/presence.
export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000

export function isOnline(lastSeenAt: string | null | undefined, now: number): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  return Number.isFinite(t) && now - t < ONLINE_THRESHOLD_MS
}

/** Las cuentas en línea primero, sin cambiar el orden relativo dentro de cada grupo. */
export function onlineFirst<T extends { id: string }>(rows: T[], online: Set<string>): T[] {
  if (online.size === 0) return rows
  return [...rows.filter((r) => online.has(r.id)), ...rows.filter((r) => !online.has(r.id))]
}
