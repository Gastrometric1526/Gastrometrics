/**
 * Horario del personal (pedido del dueño, docs/323): las personas se ponen y se quitan de un
 * día, se mueven de fecha en fecha y la semana sale en un PDF. Puro (probado en
 * staff-schedule.test.ts); el costo de cada turno sigue las reglas de lib/labor.ts.
 */

import { addDays, weekdayOf } from "@/lib/forecast"
import { shiftCost, shiftHours, type StaffMember, type StaffShift } from "@/lib/labor"

export interface StaffSchedule {
  staff: StaffMember[]
  shifts: StaffShift[]
  /**
   * Historial (docs/324): copia fija de cada semana cuyo PDF se descargó, tal como quedó ese
   * día, aunque después se cambie. La más reciente de cada semana; hasta 60.
   */
  history?: ScheduleSnapshot[]
}

export interface ScheduleSnapshot {
  monday: string
  savedAt: string
  /** Nombre y puesto de cada persona en ese momento. */
  staff: Pick<StaffMember, "id" | "name" | "role" | "hourlyRate">[]
  shifts: StaffShift[]
}

/** Guarda (o reemplaza) la copia de una semana. */
export function snapshotWeek(schedule: StaffSchedule, monday: string, savedAt = new Date().toISOString()): StaffSchedule {
  const days = weekDays(monday)
  const shifts = schedule.shifts.filter((s) => s.date >= days[0] && s.date <= days[6])
  const ids = new Set(shifts.map((s) => s.staffId))
  const snap: ScheduleSnapshot = {
    monday,
    savedAt,
    staff: schedule.staff.filter((p) => ids.has(p.id)).map(({ id, name, role, hourlyRate }) => ({ id, name, role, hourlyRate })),
    shifts,
  }
  const history = [snap, ...(schedule.history ?? []).filter((h) => h.monday !== monday)].sort((a, b) => b.monday.localeCompare(a.monday)).slice(0, 60)
  return { ...schedule, history }
}

export interface WeekSummary {
  monday: string
  people: number
  hours: number
  cost: number
  /** Copia guardada al descargar el PDF, si la hay. */
  snapshot: ScheduleSnapshot | null
}

/** Semanas anteriores con turnos o con copia guardada, la más reciente primero. */
export function scheduleHistory(schedule: StaffSchedule, currentMonday: string): WeekSummary[] {
  const mondays = new Set<string>()
  for (const s of schedule.shifts) if (s.date < currentMonday) mondays.add(mondayOf(s.date))
  for (const h of schedule.history ?? []) mondays.add(h.monday)
  return [...mondays]
    .sort((a, b) => b.localeCompare(a))
    .map((monday) => {
      const snapshot = (schedule.history ?? []).find((h) => h.monday === monday) ?? null
      const source: StaffSchedule = snapshot ? { staff: snapshot.staff.map((p) => ({ ...p })), shifts: snapshot.shifts } : schedule
      const rows = weekByPerson(source, monday).filter((r) => r.hours > 0)
      return {
        monday,
        people: rows.length,
        hours: Math.round(rows.reduce((t, r) => t + r.hours, 0) * 100) / 100,
        cost: Math.round(rows.reduce((t, r) => t + r.cost, 0) * 100) / 100,
        snapshot,
      }
    })
}

export const EMPTY_SCHEDULE: StaffSchedule = { staff: [], shifts: [] }

/** Lunes de la semana de `day` («AAAA-MM-DD»). */
export function mondayOf(day: string): string {
  return addDays(day, -((weekdayOf(day) + 6) % 7))
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

const newId = () => `sh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/** Pone a una persona en un día con su horario de siempre (o 08:00–16:00). */
export function addPersonToDay(schedule: StaffSchedule, staffId: string, day: string, opts: { start?: string; end?: string; id?: string } = {}): StaffSchedule {
  const person = schedule.staff.find((p) => p.id === staffId)
  if (!person) return schedule
  const start = opts.start || person.defaultStart || "08:00"
  const end = opts.end || person.defaultEnd || "16:00"
  const shift: StaffShift = { id: opts.id || newId(), staffId, date: day, start, end, hours: shiftHours(start, end), rate: person.hourlyRate }
  return { ...schedule, shifts: [...schedule.shifts, shift] }
}

/** Mueve un turno a otro día (mismas horas y tarifa). */
export function moveShift(schedule: StaffSchedule, shiftId: string, toDay: string): StaffSchedule {
  return { ...schedule, shifts: schedule.shifts.map((s) => (s.id === shiftId ? { ...s, date: toDay } : s)) }
}

/** Cambia la entrada y salida de un turno; las horas se recalculan. */
export function updateShiftTimes(schedule: StaffSchedule, shiftId: string, start: string, end: string): StaffSchedule {
  return { ...schedule, shifts: schedule.shifts.map((s) => (s.id === shiftId ? { ...s, start, end, hours: shiftHours(start, end) } : s)) }
}

export function removeShift(schedule: StaffSchedule, shiftId: string): StaffSchedule {
  return { ...schedule, shifts: schedule.shifts.filter((s) => s.id !== shiftId) }
}

/**
 * Copia los turnos de una semana a otra (mismo día de la semana). No duplica: una persona que
 * ya tiene turno ese día en la semana destino no se vuelve a poner. La tarifa es la de hoy.
 */
export function copyWeek(schedule: StaffSchedule, fromMonday: string, toMonday: string): StaffSchedule {
  const from = new Set(weekDays(fromMonday))
  const offset = Math.round((Date.UTC(...ymd(toMonday)) - Date.UTC(...ymd(fromMonday))) / 86400000)
  const rate = new Map(schedule.staff.map((p) => [p.id, p.hourlyRate]))
  const taken = new Set(schedule.shifts.map((s) => `${s.staffId}|${s.date}`))
  const added: StaffShift[] = []
  for (const s of schedule.shifts) {
    if (!from.has(s.date) || !rate.has(s.staffId)) continue
    const date = addDays(s.date, offset)
    if (taken.has(`${s.staffId}|${date}`)) continue
    taken.add(`${s.staffId}|${date}`)
    added.push({ ...s, id: newId(), date, rate: rate.get(s.staffId) ?? s.rate })
  }
  return { ...schedule, shifts: [...schedule.shifts, ...added] }
}

function ymd(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number)
  return [y, m - 1, d]
}

export interface PersonWeek {
  person: StaffMember
  /** Turnos de cada día de la semana (lunes a domingo). */
  days: StaffShift[][]
  hours: number
  cost: number
}

/** La semana por persona: quién trabaja qué día, sus horas y su costo. */
export function weekByPerson(schedule: StaffSchedule, monday: string): PersonWeek[] {
  const days = weekDays(monday)
  const inWeek = schedule.shifts.filter((s) => s.date >= days[0] && s.date <= days[6])
  const people = schedule.staff.filter((p) => p.active !== false || inWeek.some((s) => s.staffId === p.id))
  return people.map((person) => {
    const mine = inWeek.filter((s) => s.staffId === person.id)
    return {
      person,
      days: days.map((d) => mine.filter((s) => s.date === d).sort((a, b) => a.start.localeCompare(b.start))),
      hours: Math.round(mine.reduce((t, s) => t + (s.hours || 0), 0) * 100) / 100,
      cost: Math.round(mine.reduce((t, s) => t + shiftCost(s), 0) * 100) / 100,
    }
  })
}
