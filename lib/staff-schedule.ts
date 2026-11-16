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
