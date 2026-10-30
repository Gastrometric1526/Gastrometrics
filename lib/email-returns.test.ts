import { describe, it, expect } from "vitest"
import { summarizeEmailReturns } from "./email-returns"

const now = Date.parse("2026-10-30T12:00:00Z")
const d = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString()

describe("personas que volvieron por los correos (docs/210)", () => {
  it("cuenta personas distintas, si estaban inactivas antes y si siguieron usando la app", () => {
    const s = summarizeEmailReturns({
      recipients: new Set(["a", "b", "c", "d"]),
      firstClick: new Map([
        ["a", d(3)], // inactiva antes, usó la app después
        ["b", d(40)], // activa el día antes, nada después
      ]),
      activity: [
        { user_id: "a", created_at: d(2.5) },
        { user_id: "b", created_at: d(41) },
        { user_id: "b", created_at: d(39.999) }, // la propia llegada: no cuenta como «siguió usando»
        { user_id: "a", created_at: d(20) }, // fuera de la ventana de 7 días antes
      ],
      now,
    })
    expect(s).toEqual({ recipients: 4, returned: 2, returnedPercent: 50, wereInactive: 1, keptUsing: 1, last7Days: 1, last30Days: 1 })
  })

  it("sin correos enviados no hay porcentaje", () => {
    const s = summarizeEmailReturns({ recipients: new Set(), firstClick: new Map(), activity: [], now })
    expect(s.returnedPercent).toBeNull()
    expect(s.returned).toBe(0)
  })
})
