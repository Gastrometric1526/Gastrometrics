import { describe, expect, it } from "vitest"
import { isInternalProductEvent, latestCronRuns } from "./cron-runs"

describe("registro de tareas programadas (docs/195)", () => {
  it("lee la última ejecución de cada tarea", () => {
    const rows = [
      { event_name: "cron:activation-emails:fail:engagement,reengagement", created_at: "2026-10-24T14:00:00Z" },
      { event_name: "cron:activation-emails:ok", created_at: "2026-10-23T14:00:00Z" },
      { event_name: "cron:keep-alive:ok", created_at: "2026-10-24T08:00:00Z" },
    ]
    const [a, k, x] = latestCronRuns(rows, ["activation-emails", "keep-alive", "otra"])
    expect(a).toMatchObject({ ok: false, failedSteps: ["engagement", "reengagement"], lastRunAt: "2026-10-24T14:00:00Z" })
    expect(k).toMatchObject({ ok: true, failedSteps: [] })
    expect(x).toMatchObject({ lastRunAt: null, ok: null })
  })
  it("separa los eventos internos del embudo", () => {
    expect(isInternalProductEvent("cron:keep-alive:ok")).toBe(true)
    expect(isInternalProductEvent("feedback_archived")).toBe(true)
    expect(isInternalProductEvent("signup_completed")).toBe(false)
  })
})
