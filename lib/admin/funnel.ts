/**
 * Embudo de /admin (docs/275): dónde se pierde la gente, de la cuenta nueva a la renovación.
 * Puro (sin base de datos), probado en funnel.test.ts. La ruta /api/admin/funnel arma la
 * entrada con lo que ya se guarda: cuentas confirmadas, ingredientes, recetas con costo,
 * registro de actividad, planes y cobros de Stripe. Nada se instrumenta aparte.
 *
 * Es estricto: una cuenta cuenta en una etapa solo si pasó todas las anteriores.
 */

export const FUNNEL_STAGES = ["signed", "ingredient", "cost", "returned", "paid", "renewed"] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export interface FunnelAccount {
  id: string
  createdAt: string
  firstIngredientAt: string | null
  firstCostAt: string | null
  /** Días (AAAA-MM-DD) con actividad en la app. */
  activeDays: string[]
  paying: boolean
  /** Dos o más cobros pagados (renovó al menos una vez). */
  renewed: boolean
}

export interface FunnelRow {
  stage: FunnelStage
  count: number
  /** % sobre la etapa anterior (100 en la primera). */
  ofPrevious: number
  /** % sobre las cuentas del período. */
  ofTotal: number
}

export interface FunnelSummary {
  rows: FunnelRow[]
  /** Etapa con la mayor caída respecto de la anterior (null si no hay cuentas). */
  biggestDrop: FunnelStage | null
  /** Cuentas que todavía no pueden llegar a «volvió» (tienen menos de 7 días). */
  tooNewToReturn: number
}

const DAY = 86_400_000

/** ¿Volvió después de su primera semana? Actividad en un día ≥ 7 días después del alta. */
export function returnedAfterFirstWeek(account: Pick<FunnelAccount, "createdAt" | "activeDays">): boolean {
  const from = new Date(account.createdAt).getTime() + 7 * DAY
  return account.activeDays.some((d) => new Date(`${d}T23:59:59`).getTime() >= from)
}

export function summarizeFunnel(accounts: FunnelAccount[], opts: { sinceDays?: number | null; now?: Date } = {}): FunnelSummary {
  const now = (opts.now ?? new Date()).getTime()
  const cohort = opts.sinceDays ? accounts.filter((a) => now - new Date(a.createdAt).getTime() <= opts.sinceDays! * DAY) : accounts
  const passes: Record<FunnelStage, (a: FunnelAccount) => boolean> = {
    signed: () => true,
    ingredient: (a) => !!a.firstIngredientAt,
    cost: (a) => !!a.firstCostAt,
    returned: (a) => returnedAfterFirstWeek(a),
    paid: (a) => a.paying,
    renewed: (a) => a.renewed,
  }
  let remaining = cohort
  const rows: FunnelRow[] = []
  let prev = cohort.length
  for (const stage of FUNNEL_STAGES) {
    remaining = remaining.filter(passes[stage])
    const count = remaining.length
    rows.push({
      stage,
      count,
      ofPrevious: prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0,
      ofTotal: cohort.length > 0 ? Math.round((count / cohort.length) * 1000) / 10 : 0,
    })
    prev = count
  }
  let biggestDrop: FunnelStage | null = null
  let worst = -1
  for (let i = 1; i < rows.length; i++) {
    const lost = rows[i - 1].count - rows[i].count
    if (rows[i - 1].count > 0 && lost > worst) {
      worst = lost
      biggestDrop = rows[i].stage
    }
  }
  const tooNewToReturn = cohort.filter((a) => now - new Date(a.createdAt).getTime() < 7 * DAY).length
  return { rows, biggestDrop: cohort.length ? biggestDrop : null, tooNewToReturn }
}

export interface NudgeEvent {
  userId: string
  module: string
  action: "nudge_shown" | "nudge_opened"
  at: string
}

export interface NudgeOutcome {
  module: string
  shown: number
  opened: number
  /** Abrieron y, en los 7 días siguientes, hicieron algo en ese módulo (crear, editar, importar…). */
  useful: number
}

/**
 * Resultado de la invitación a volver a un módulo (docs/269, medida en docs/275): no basta con
 * el clic. «Útil» = después de abrirla, una acción real en ese módulo dentro de 7 días.
 */
export function summarizeNudges(
  events: NudgeEvent[],
  actions: { userId: string; module: string; at: string }[],
): NudgeOutcome[] {
  const byModule = new Map<string, NudgeOutcome>()
  const get = (m: string) => byModule.get(m) ?? byModule.set(m, { module: m, shown: 0, opened: 0, useful: 0 }).get(m)!
  for (const e of events) {
    const row = get(e.module)
    if (e.action === "nudge_shown") row.shown += 1
    else {
      row.opened += 1
      const from = new Date(e.at).getTime()
      const useful = actions.some((a) => a.userId === e.userId && a.module === e.module && new Date(a.at).getTime() >= from && new Date(a.at).getTime() - from <= 7 * DAY)
      if (useful) row.useful += 1
    }
  }
  return [...byModule.values()].sort((a, b) => b.shown - a.shown)
}
