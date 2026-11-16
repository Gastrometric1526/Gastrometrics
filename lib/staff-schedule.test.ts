import { describe, expect, it } from "vitest"
import { addPersonToDay, copyWeek, mondayOf, moveShift, removeShift, updateShiftTimes, weekByPerson, type StaffSchedule } from "./staff-schedule"

const base: StaffSchedule = {
  staff: [
    { id: "ana", name: "Ana", role: "Cocina", hourlyRate: 50, defaultStart: "07:00", defaultEnd: "15:00" },
    { id: "luis", name: "Luis", role: "Salón", hourlyRate: 40 },
  ],
  shifts: [],
}

describe("horario del personal (docs/323)", () => {
  it("el lunes de la semana", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16") // jueves → lunes
    expect(mondayOf("2026-11-22")).toBe("2026-11-16") // domingo → lunes
  })
  it("poner a alguien en un día usa su horario de siempre y su tarifa", () => {
    const s = addPersonToDay(base, "ana", "2026-11-16", { id: "a1" })
    expect(s.shifts[0]).toMatchObject({ date: "2026-11-16", start: "07:00", end: "15:00", hours: 8, rate: 50 })
    expect(addPersonToDay(base, "luis", "2026-11-16").shifts[0]).toMatchObject({ start: "08:00", end: "16:00" })
  })
  it("mover, cambiar horas y quitar", () => {
    let s = addPersonToDay(base, "ana", "2026-11-16", { id: "a1" })
    s = moveShift(s, "a1", "2026-11-18")
    expect(s.shifts[0].date).toBe("2026-11-18")
    s = updateShiftTimes(s, "a1", "10:00", "14:30")
    expect(s.shifts[0].hours).toBe(4.5)
    expect(removeShift(s, "a1").shifts).toEqual([])
  })
  it("copiar la semana no duplica a quien ya está ese día", () => {
    let s = addPersonToDay(base, "ana", "2026-11-16", { id: "a1" })
    s = addPersonToDay(s, "luis", "2026-11-17", { id: "l1" })
    s = addPersonToDay(s, "ana", "2026-11-23", { id: "a2" }) // ya puesta el lunes siguiente
    const c = copyWeek(s, "2026-11-16", "2026-11-23")
    const next = c.shifts.filter((x) => x.date >= "2026-11-23")
    expect(next.map((x) => `${x.staffId}@${x.date}`).sort()).toEqual(["ana@2026-11-23", "luis@2026-11-24"])
  })
  it("semana por persona: Ana 8 h × 50 = 400; Luis 8 h × 40 = 320", () => {
    let s = addPersonToDay(base, "ana", "2026-11-16")
    s = addPersonToDay(s, "luis", "2026-11-20")
    const w = weekByPerson(s, "2026-11-16")
    expect(w.map((p) => [p.person.name, p.hours, p.cost])).toEqual([["Ana", 8, 400], ["Luis", 8, 320]])
    expect(w[1].days[4]).toHaveLength(1) // viernes
  })
})
