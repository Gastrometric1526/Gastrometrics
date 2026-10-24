/**
 * Retención por semana de registro para /admin (docs/195). Pregunta del dueño: de la gente
 * que se registra cada semana, ¿cuántos vuelven?
 *
 * «Volvió en la semana N» = registró al menos una acción en la app (activity_log: entrar a un
 * módulo, crear, editar…) entre el día 7·N y el día 7·N+6 después de registrarse. La semana
 * 0 es la primera semana (el mismo día del registro cuenta). Una semana que todavía no
 * terminó para esa cohorte sale como null («aún no»), no como 0 %.
 */

const DAY = 24 * 60 * 60 * 1000

export interface RetentionAccount {
  id: string
  createdAt: string
  paying: boolean
  firstCostAt: string | null
}

export interface RetentionActivity {
  userId: string
  at: number // ms
}

export interface RetentionCohort {
  weekStart: string // YYYY-MM-DD (lunes)
  size: number
  activated: number // llegaron a su primer costo de receta
  paying: number
  week0: number | null // %
  week1: number | null
  week2: number | null
  week4: number | null
}

export interface RetentionSummary {
  cohorts: RetentionCohort[]
  activeToday: number
  active7d: number
  active30d: number
  totalAccounts: number
  newAccounts7d: number
  newAccounts30d: number
  signupsByWeek: { weekStart: string; count: number }[]
}

function mondayOf(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  const offset = (d.getDay() + 6) % 7 // lunes = 0
  return d.getTime() - offset * DAY
}

const ymd = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function summarizeRetention(accounts: RetentionAccount[], activity: RetentionActivity[], weeks = 10, now = Date.now()): RetentionSummary {
  const byUser = new Map<string, number[]>()
  for (const a of activity) {
    const list = byUser.get(a.userId)
    if (list) list.push(a.at)
    else byUser.set(a.userId, [a.at])
  }

  const returnedIn = (account: RetentionAccount, week: number): boolean | null => {
    const start = new Date(account.createdAt).getTime() + week * 7 * DAY
    const end = start + 7 * DAY
    if (end > now) return null
    // La semana 0 empieza en el registro mismo: la actividad de ese momento cuenta.
    return (byUser.get(account.id) || []).some((t) => t >= start && t < end)
  }

  const thisMonday = mondayOf(now)
  const cohorts: RetentionCohort[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = thisMonday - w * 7 * DAY
    const members = accounts.filter((a) => {
      const t = new Date(a.createdAt).getTime()
      return t >= weekStart && t < weekStart + 7 * DAY
    })
    const pct = (week: number) => {
      const results = members.map((m) => returnedIn(m, week))
      // Si para alguien de la cohorte la semana todavía no terminó, se calcula solo con los
      // que sí la cumplieron; si nadie la cumplió, «aún no».
      const done = results.filter((r): r is boolean => r !== null)
      if (done.length === 0) return null
      return (done.filter(Boolean).length / done.length) * 100
    }
    cohorts.push({
      weekStart: ymd(weekStart),
      size: members.length,
      activated: members.filter((m) => m.firstCostAt).length,
      paying: members.filter((m) => m.paying).length,
      week0: members.length ? pct(0) : null,
      week1: members.length ? pct(1) : null,
      week2: members.length ? pct(2) : null,
      week4: members.length ? pct(4) : null,
    })
  }

  const activeSince = (ms: number) => [...byUser.entries()].filter(([, times]) => times.some((t) => t >= ms)).length
  const startOfToday = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()

  return {
    cohorts,
    activeToday: activeSince(startOfToday),
    active7d: activeSince(now - 7 * DAY),
    active30d: activeSince(now - 30 * DAY),
    totalAccounts: accounts.length,
    newAccounts7d: accounts.filter((a) => new Date(a.createdAt).getTime() >= now - 7 * DAY).length,
    newAccounts30d: accounts.filter((a) => new Date(a.createdAt).getTime() >= now - 30 * DAY).length,
    signupsByWeek: cohorts.map((c) => ({ weekStart: c.weekStart, count: c.size })),
  }
}
