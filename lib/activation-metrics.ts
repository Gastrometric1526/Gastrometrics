/**
 * Métricas de activación de /admin (docs/153), puras para poder probarlas:
 *  - Tiempo hasta el primer costo (Time to First Cost): de la creación de la cuenta a su
 *    primera receta guardada con costo calculado (> 0), agrupado en tramos, con cuántas
 *    cuentas de cada tramo pagan hoy;
 *  - uso del OCR: lecturas por tipo, por cuenta, en los primeros 7 y 30 días de la cuenta,
 *    cuántas cuentas que lo usaron volvieron otro día, cuántas pagan y cuántas lecturas
 *    hicieron antes de su primer costo.
 * Sirve para decidir con datos si algún día hace falta un límite (decisión del dueño:
 * por ahora el OCR está abierto en todos los planes).
 */

export const TTFC_BUCKETS = ["lt10m", "10to30m", "30to60m", "1to24h", "gt24h", "never"] as const
export type TtfcBucket = (typeof TTFC_BUCKETS)[number]

export function ttfcBucket(minutes: number | null): TtfcBucket {
  if (minutes === null) return "never"
  if (minutes < 10) return "lt10m"
  if (minutes < 30) return "10to30m"
  if (minutes < 60) return "30to60m"
  if (minutes < 24 * 60) return "1to24h"
  return "gt24h"
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)
const DAY = 86_400_000

export interface MetricAccount {
  id: string
  createdAt: string
  paying: boolean
  firstCostAt: string | null
}

/** Minutos de la cuenta a su primer costo (null si no llegó; un costo "anterior" cuenta como 0). */
export function minutesToFirstCost(account: MetricAccount): number | null {
  if (!account.firstCostAt) return null
  return Math.max(0, (new Date(account.firstCostAt).getTime() - new Date(account.createdAt).getTime()) / 60_000)
}

export function summarizeTimeToFirstCost(accounts: MetricAccount[]) {
  const rows = TTFC_BUCKETS.map((bucket) => ({ bucket, accounts: 0, paying: 0, conversionPercent: 0 }))
  const minutes: number[] = []
  for (const account of accounts) {
    const m = minutesToFirstCost(account)
    if (m !== null) minutes.push(m)
    const row = rows[TTFC_BUCKETS.indexOf(ttfcBucket(m))]
    row.accounts += 1
    if (account.paying) row.paying += 1
  }
  for (const row of rows) row.conversionPercent = pct(row.paying, row.accounts)
  return {
    reached: minutes.length,
    reachedPercent: pct(minutes.length, accounts.length),
    medianMinutes: median(minutes),
    buckets: rows,
  }
}

export interface OcrRead {
  userId: string
  createdAt: string
  kind: string
}

/**
 * `reads` son todas las lecturas registradas; `lastActivityAt` es la última actividad
 * (cualquier módulo) de cada cuenta, para saber si volvió otro día después de su primera
 * lectura; `windowDays` limita los totales por tipo a los últimos N días.
 */
export function summarizeOcrUsage(params: {
  reads: OcrRead[]
  accounts: Map<string, MetricAccount>
  lastActivityAt: Map<string, string>
  now?: Date
  windowDays?: number
}) {
  const now = params.now ?? new Date()
  const windowDays = params.windowDays ?? 30
  const since = now.getTime() - windowDays * DAY
  const byKind: Record<string, number> = { recipe: 0, receipt: 0, inventory: 0 }
  let windowTotal = 0
  const perUser = new Map<string, OcrRead[]>()
  for (const read of params.reads) {
    if (new Date(read.createdAt).getTime() >= since) {
      byKind[read.kind] = (byKind[read.kind] ?? 0) + 1
      windowTotal += 1
    }
    const list = perUser.get(read.userId) ?? []
    list.push(read)
    perUser.set(read.userId, list)
  }

  const first7: number[] = []
  const first30: number[] = []
  const beforeFirstCost: number[] = []
  let returned = 0
  let paying = 0
  for (const [userId, list] of perUser) {
    const account = params.accounts.get(userId)
    const times = list.map((r) => new Date(r.createdAt).getTime()).sort((a, b) => a - b)
    const firstRead = times[0]
    const last = params.lastActivityAt.get(userId)
    if (last && new Date(last).getTime() - firstRead >= DAY) returned += 1
    if (!account) continue
    if (account.paying) paying += 1
    const created = new Date(account.createdAt).getTime()
    first7.push(times.filter((t) => t - created < 7 * DAY).length)
    first30.push(times.filter((t) => t - created < 30 * DAY).length)
    if (account.firstCostAt) {
      const cost = new Date(account.firstCostAt).getTime()
      beforeFirstCost.push(times.filter((t) => t <= cost).length)
    }
  }
  const users = perUser.size
  const counts = [...perUser.values()].map((l) => l.length)
  const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0)
  return {
    windowDays,
    total: windowTotal,
    byKind,
    allTimeReads: params.reads.length,
    accounts: users,
    readsPerAccount: { average: avg(counts), median: median(counts) },
    first7Days: { average: avg(first7), median: median(first7) },
    first30Days: { average: avg(first30), median: median(first30) },
    returnedPercent: pct(returned, users),
    payingPercent: pct(paying, users),
    readsBeforeFirstCost: { accounts: beforeFirstCost.length, median: median(beforeFirstCost) },
  }
}
