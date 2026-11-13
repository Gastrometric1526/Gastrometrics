import { describe, expect, it } from "vitest"
import { EMPTY_NUDGE_STATE, isWeeklyUser, markNudgeShown, modulesToLookUp, parseNudgeState, pickNudge } from "@/lib/module-nudge"

const NOW = new Date("2026-11-20T12:00:00")
const daysAgo = (n: number, module = "dashboard") => ({ module, at: new Date(NOW.getTime() - n * 86_400_000).toISOString() })
// Usa la app cada semana: lunes, miércoles y la semana anterior.
const weekly = [daysAgo(1), daysAgo(3), daysAgo(9), daysAgo(16)]
const ALL = ["/ingredientes", "/ficha-tecnica", "/mis-recetas", "/inventario", "/menus", "/ventas", "/estadisticas"]

describe("invitación a volver a un módulo", () => {
  it("solo a quien usa la app cada semana", () => {
    expect(isWeeklyUser(weekly.map((v) => v.at), NOW)).toBe(true)
    // Solo esta semana: no es semanal todavía.
    expect(isWeeklyUser([daysAgo(1), daysAgo(2), daysAgo(3)].map((v) => v.at), NOW)).toBe(false)
    // Dos semanas, pero un solo día cada una.
    expect(isWeeklyUser([daysAgo(1), daysAgo(9)].map((v) => v.at), NOW)).toBe(false)
  })

  it("sigue la línea de uso: el primer módulo sin usar hace más de 90 días", () => {
    const visits = [...weekly, daysAgo(2, "ingredientes"), daysAgo(2, "ficha_tecnica"), daysAgo(1, "inventario")]
    const lastUse = { recetas: daysAgo(120).at }
    expect(pickNudge({ visits, available: ALL, state: EMPTY_NUDGE_STATE, lastUse, now: NOW })).toEqual({ href: "/mis-recetas", slug: "recetas", idleDays: 120 })
  })

  // docs/297: si alguna vez lo usó, no se invita hasta que pasen meses.
  it("un módulo que ya usó hace 30 o 70 días no recibe invitación; uno nunca usado sí", () => {
    const visits = [...weekly, daysAgo(2, "ingredientes"), daysAgo(2, "ficha_tecnica"), daysAgo(30, "recetas")]
    const available = ["/ingredientes", "/ficha-tecnica", "/mis-recetas", "/inventario", "/menus"]
    const lastUse = { inventario: daysAgo(70).at }
    expect(pickNudge({ visits, available, state: EMPTY_NUDGE_STATE, lastUse, now: NOW })).toEqual({ href: "/menus", slug: "menus", idleDays: null })
    // Sin visitas recientes, hay que mirar el historial de inventario y menús.
    expect(modulesToLookUp(visits, available)).toEqual(["inventario", "menus"])
  })

  it("un módulo que nunca abrió también cuenta, y lo bloqueado o sin revelar no", () => {
    const visits = [...weekly, daysAgo(2, "ingredientes"), daysAgo(2, "ficha_tecnica"), daysAgo(2, "recetas")]
    expect(pickNudge({ visits, available: ["/ingredientes", "/ficha-tecnica", "/mis-recetas", "/menus"], state: EMPTY_NUDGE_STATE, now: NOW })).toEqual({ href: "/menus", slug: "menus", idleDays: null })
  })

  it("una invitación cada 7 días y el mismo módulo no antes de 30", () => {
    const visits = [...weekly, daysAgo(2, "ingredientes")]
    const first = pickNudge({ visits, available: ALL, state: EMPTY_NUDGE_STATE, now: NOW })!
    const state = markNudgeShown(EMPTY_NUDGE_STATE, first.href, new Date(NOW.getTime() - 3 * 86_400_000))
    expect(pickNudge({ visits, available: ALL, state, now: NOW })).toBeNull()
    const later = new Date(NOW.getTime() + 5 * 86_400_000)
    const next = pickNudge({ visits: [...visits, { module: "dashboard", at: later.toISOString() }], available: ALL, state, now: later })
    expect(next?.href).not.toBe(first.href)
  })

  it("lee el estado guardado sin romperse", () => {
    expect(parseNudgeState("{malo")).toEqual(EMPTY_NUDGE_STATE)
    expect(parseNudgeState(JSON.stringify({ lastShownAt: "2026-11-01", shown: { "/menus": "2026-11-01" } })).shown["/menus"]).toBe("2026-11-01")
  })
})
