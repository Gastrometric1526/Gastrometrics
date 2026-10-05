import { describe, expect, it } from "vitest"
import { summarizeOcrUsage, summarizeTimeToFirstCost, ttfcBucket, type MetricAccount } from "./activation-metrics"

const T0 = new Date("2026-09-01T12:00:00Z").getTime()
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString()

describe("Tiempo hasta el primer costo (docs/153)", () => {
  it("asigna cada cuenta a su tramo", () => {
    expect(ttfcBucket(null)).toBe("never")
    expect(ttfcBucket(3)).toBe("lt10m")
    expect(ttfcBucket(10)).toBe("10to30m")
    expect(ttfcBucket(45)).toBe("30to60m")
    expect(ttfcBucket(600)).toBe("1to24h")
    expect(ttfcBucket(2000)).toBe("gt24h")
  })

  it("cuenta conversión a pago por tramo y la mediana", () => {
    const accounts: MetricAccount[] = [
      { id: "a", createdAt: at(0), firstCostAt: at(5), paying: true },
      { id: "b", createdAt: at(0), firstCostAt: at(8), paying: false },
      { id: "c", createdAt: at(0), firstCostAt: at(90), paying: false },
      { id: "d", createdAt: at(0), firstCostAt: null, paying: false },
    ]
    const summary = summarizeTimeToFirstCost(accounts)
    expect(summary.reached).toBe(3)
    expect(summary.reachedPercent).toBe(75)
    expect(summary.medianMinutes).toBe(8)
    const fast = summary.buckets.find((b) => b.bucket === "lt10m")!
    expect(fast).toMatchObject({ accounts: 2, paying: 1, conversionPercent: 50 })
    expect(summary.buckets.find((b) => b.bucket === "never")!.accounts).toBe(1)
  })
})

describe("Uso del OCR (docs/153)", () => {
  it("resume lecturas por tipo, primeros días, retorno, pago y lecturas antes del primer costo", () => {
    const day = 24 * 60
    const accounts = new Map<string, MetricAccount>([
      ["a", { id: "a", createdAt: at(0), firstCostAt: at(20), paying: true }],
      ["b", { id: "b", createdAt: at(0), firstCostAt: null, paying: false }],
    ])
    const reads = [
      { userId: "a", createdAt: at(5), kind: "recipe" },
      { userId: "a", createdAt: at(10), kind: "recipe" },
      { userId: "a", createdAt: at(10 * day), kind: "receipt" },
      { userId: "b", createdAt: at(60), kind: "inventory" },
    ]
    const lastActivityAt = new Map([
      ["a", at(10 * day)],
      ["b", at(70)],
    ])
    const s = summarizeOcrUsage({ reads, accounts, lastActivityAt, now: new Date(T0 + 12 * day * 60_000) })
    expect(s.total).toBe(4)
    expect(s.byKind).toEqual({ recipe: 2, receipt: 1, inventory: 1 })
    expect(s.accounts).toBe(2)
    expect(s.first7Days.average).toBe(1.5) // a: 2, b: 1
    expect(s.first30Days.average).toBe(2) // a: 3, b: 1
    expect(s.returnedPercent).toBe(50)
    expect(s.payingPercent).toBe(50)
    expect(s.readsBeforeFirstCost).toEqual({ accounts: 1, median: 2 })
  })
})
