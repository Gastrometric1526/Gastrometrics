/**
 * «Cuántas personas volvieron vía los correos» (docs/210), puro y probado en
 * lib/email-returns.test.ts. Recibe quién recibió correos, el primer clic de cada cuenta
 * (ver lib/email-tracking.ts) y su actividad en la app (activity_log).
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface EmailReturnsSummary {
  recipients: number // personas distintas que recibieron al menos un correo con registro de envío
  returned: number // personas distintas que entraron a la app desde el botón de un correo
  returnedPercent: number | null // returned / recipients
  wereInactive: number // de las que volvieron: sin actividad los 7 días antes del clic
  keptUsing: number // de las que volvieron: usaron la app otra vez entre 1 hora y 7 días después del clic
  last7Days: number // personas cuyo primer clic fue en los últimos 7 días
  last30Days: number
}

export function summarizeEmailReturns(input: {
  recipients: Set<string>
  firstClick: Map<string, string> // account_id → fecha ISO del primer clic
  activity: { user_id: string; created_at: string }[]
  now: number
}): EmailReturnsSummary {
  const byUser = new Map<string, number[]>()
  for (const a of input.activity) {
    const list = byUser.get(a.user_id) ?? []
    list.push(Date.parse(a.created_at))
    byUser.set(a.user_id, list)
  }
  let wereInactive = 0
  let keptUsing = 0
  let last7Days = 0
  let last30Days = 0
  for (const [id, iso] of input.firstClick) {
    const click = Date.parse(iso)
    const times = byUser.get(id) ?? []
    // Entrar a la app ya deja actividad (docs/100), y puede quedar segundos antes o después
    // del clic: «antes» excluye los 10 minutos previos y «después» empieza 1 hora más tarde.
    if (!times.some((t) => t >= click - 7 * DAY && t < click - 10 * MINUTE)) wereInactive++
    if (times.some((t) => t >= click + HOUR && t <= click + 7 * DAY)) keptUsing++
    if (click >= input.now - 7 * DAY) last7Days++
    if (click >= input.now - 30 * DAY) last30Days++
  }
  const returned = input.firstClick.size
  const recipients = input.recipients.size
  return {
    recipients,
    returned,
    returnedPercent: recipients ? Math.round((returned / recipients) * 1000) / 10 : null,
    wereInactive,
    keptUsing,
    last7Days,
    last30Days,
  }
}
