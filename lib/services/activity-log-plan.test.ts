import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => ({}) }))

import { formatActivityEntry, type ActivityLogEntry } from "./activity-log"

const t = (key: string) =>
  ({ activity_tpl_plan_changed: "Tu plan cambió de {from} a {to}" } as Record<string, string>)[key] ?? key

describe("notificación de cambio de plan (docs/157)", () => {
  it("muestra los nombres de plan a partir de los slugs guardados", () => {
    const entry: ActivityLogEntry = {
      id: 1,
      businessId: null,
      userId: "u",
      userName: "Gastrometrics",
      module: "plan",
      action: "plan_changed",
      entityLabel: "sous-chef",
      metadata: { from: "foodie", to: "sous-chef", source: "stripe" },
      isNotification: true,
      createdAt: "2026-10-09T10:00:00Z",
    }
    expect(formatActivityEntry(entry, t)).toBe("Tu plan cambió de Foodie a Sous Chef")
  })
})
