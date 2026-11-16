/**
 * Personal y turnos de un negocio (docs/322). Solo en los negocios (pedido del dueño).
 *
 * Cada turno guarda las horas y la tarifa por hora de ese día (si mañana sube el sueldo, los
 * turnos de antes no cambian):
 *   costo de un turno = horas × tarifa por hora
 *   costo de personal de un período = Σ costo de sus turnos
 *   % de personal = costo de personal ÷ venta neta × 100   (venta neta = sin el ISV incluido,
 *                                                         igual que el food cost de Finanzas)
 *   horas de un turno = salida − entrada (si sale después de medianoche, + 24 h)
 * Cuando un período tiene turnos anotados, Finanzas usa ese costo en el Prime Cost y el P&L en
 * vez del monto mensual del negocio prorrateado.
 */

export interface StaffMember {
  id: string
  name: string
  role: string
  /** Pago por hora. */
  hourlyRate: number
  active?: boolean
}

export interface StaffShift {
  id: string
  staffId: string
  /** Día local «AAAA-MM-DD». */
  date: string
  /** «HH:MM». */
  start: string
  end: string
  hours: number
  /** Tarifa por hora de ese día. */
  rate: number
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Horas entre dos «HH:MM»; si la salida es antes que la entrada, el turno pasó la medianoche. */
export function shiftHours(start: string, end: string): number {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return 0
  let diff = toMin(end) - toMin(start)
  if (diff < 0) diff += 24 * 60
  return r2(diff / 60)
}

export function shiftCost(s: Pick<StaffShift, "hours" | "rate">): number {
  return r2((s.hours || 0) * (s.rate || 0))
}

export interface LaborSummary {
  hours: number
  cost: number
  shifts: number
  byStaff: { staffId: string; hours: number; cost: number }[]
}

/** Turnos y costo de personal entre `from` y `to` (incluidos, «AAAA-MM-DD»). */
export function laborInRange(shifts: StaffShift[], from: string, to: string): LaborSummary {
  const inRange = shifts.filter((s) => s.date >= from && s.date <= to)
  const by = new Map<string, { hours: number; cost: number }>()
  for (const s of inRange) {
    const e = by.get(s.staffId) || { hours: 0, cost: 0 }
    e.hours += s.hours || 0
    e.cost += shiftCost(s)
    by.set(s.staffId, e)
  }
  return {
    hours: r2(inRange.reduce((t, s) => t + (s.hours || 0), 0)),
    cost: r2(inRange.reduce((t, s) => t + shiftCost(s), 0)),
    shifts: inRange.length,
    byStaff: [...by.entries()].map(([staffId, v]) => ({ staffId, hours: r2(v.hours), cost: r2(v.cost) })).sort((a, b) => b.cost - a.cost),
  }
}

export function laborPercent(laborCost: number, netSales: number): number {
  return netSales > 0 ? r2((laborCost / netSales) * 100) : 0
}

/**
 * Costo de personal de un período para Finanzas: los turnos anotados si hay alguno en el
 * período; si no, el monto mensual prorrateado (lo de siempre).
 */
export function laborCostForFinance(shifts: StaffShift[] | undefined, from: string | null, to: string | null, proratedMonthly: number): { cost: number; fromShifts: boolean } {
  if (!shifts?.length || !from || !to) return { cost: proratedMonthly, fromShifts: false }
  const s = laborInRange(shifts, from.slice(0, 10), to.slice(0, 10))
  return s.shifts > 0 ? { cost: s.cost, fromShifts: true } : { cost: proratedMonthly, fromShifts: false }
}
