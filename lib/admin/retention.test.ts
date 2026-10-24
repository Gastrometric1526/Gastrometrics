import { describe, expect, it } from "vitest"
import { summarizeRetention } from "./retention"

const DAY = 86400000
const NOW = new Date(2026, 9, 24, 12).getTime() // sábado

describe("retención por semana de registro (docs/195)", () => {
  it("cuenta quién volvió en la semana 1 y marca «aún no» lo que no terminó", () => {
    const old = new Date(NOW - 20 * DAY).toISOString()
    const recent = new Date(NOW - 2 * DAY).toISOString()
    const r = summarizeRetention(
      [
        { id: "a", createdAt: old, paying: true, firstCostAt: old },
        { id: "b", createdAt: old, paying: false, firstCostAt: null },
        { id: "c", createdAt: recent, paying: false, firstCostAt: null },
      ],
      [
        { userId: "a", at: NOW - 20 * DAY + 1000 },
        { userId: "a", at: NOW - 11 * DAY },
        { userId: "c", at: NOW - 1 * DAY },
      ],
      10,
      NOW,
    )
    const cohortOld = r.cohorts.find((c) => c.size === 2)!
    expect(cohortOld.week0).toBe(50)
    expect(cohortOld.week1).toBe(50)
    expect(cohortOld.week4).toBeNull()
    expect(cohortOld.activated).toBe(1)
    expect(cohortOld.paying).toBe(1)
    const cohortNew = r.cohorts[r.cohorts.length - 1]
    expect(cohortNew.size).toBe(1)
    expect(cohortNew.week1).toBeNull()
    expect(r.active7d).toBe(1)
    expect(r.active30d).toBe(2)
    expect(r.newAccounts7d).toBe(1)
    expect(r.cohorts).toHaveLength(10)
  })
})
