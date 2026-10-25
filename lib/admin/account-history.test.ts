import { describe, expect, it } from "vitest"
import { buildAccountHistory } from "./account-history"
import { decodePurgedRecord, encodePurgedRecord } from "./account-ledger"

const NOW = new Date("2026-10-25T12:00:00Z").getTime()

describe("historial de cuentas (docs/197)", () => {
  it("el registro de cuentas borradas no guarda correo y se lee de vuelta", () => {
    const raw = encodePurgedRecord({ createdAt: "2026-09-01T00:00:00Z", requestedAt: "2026-09-20T00:00:00Z", purgedAt: "x", plan: "home-cook", country: "HN" })
    expect(raw).not.toMatch(/@/)
    expect(decodePurgedRecord(raw, "2026-10-21T00:00:00Z")).toEqual({ createdAt: "2026-09-01T00:00:00Z", requestedAt: "2026-09-20T00:00:00Z", purgedAt: "2026-10-21T00:00:00Z", plan: "home-cook", country: "HN" })
    expect(decodePurgedRecord("roto", "2026-10-21T00:00:00Z").plan).toBeNull()
  })

  it("arma la línea de tiempo, de lo más nuevo a lo más viejo, y cuenta bien", () => {
    const { events, summary } = buildAccountHistory(
      {
        users: [
          { id: "a", email: "a@x.com", createdAt: "2026-10-20T00:00:00Z" },
          { id: "b", email: "b@x.com", createdAt: "2026-08-01T00:00:00Z" },
        ],
        plans: [{ accountId: "b", planSlug: "sous-chef" }],
        deletionRequests: [{ id: "b", requestedAt: "2026-10-10T00:00:00Z" }],
        planChanges: [{ userId: "b", at: "2026-10-01T00:00:00Z", from: "foodie", to: "sous-chef", source: "stripe" }],
        purged: [{ createdAt: "2026-06-01T00:00:00Z", requestedAt: "2026-09-01T00:00:00Z", purgedAt: "2026-10-02T00:00:00Z", plan: "foodie", country: "GT" }],
        subscriptions: [
          { email: "c@x.com", planSlug: "home-cook", status: "canceled", createdAt: "2026-07-01T00:00:00Z", canceledAt: "2026-10-05T00:00:00Z", cancelAt: null, cancelAtPeriodEnd: false },
          { email: "b@x.com", planSlug: "sous-chef", status: "active", createdAt: "2026-10-01T00:00:00Z", canceledAt: null, cancelAt: "2026-11-01T00:00:00Z", cancelAtPeriodEnd: true },
        ],
      },
      NOW,
    )
    expect(events[0].type).toBe("cancel_scheduled")
    expect(events.map((e) => e.type)).toContain("purged")
    const del = events.find((e) => e.type === "deletion_requested")!
    expect(del.dueAt).toBe("2026-11-09T00:00:00.000Z")
    expect(events.find((e) => e.type === "purged")!.email).toBeNull()
    expect(summary).toMatchObject({ activeAccounts: 1, created30d: 1, deletionPending: 1, purgedTotal: 1, purged30d: 1, canceledTotal: 1, canceled30d: 1, cancelScheduled: 1, planChanges30d: 1 })
  })
})
