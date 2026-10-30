import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/components/admin/live", () => ({ useAdminLiveReload: () => {}, useAdminTick: () => 0 }))
vi.mock("@/components/admin/account-insights", () => ({ AccountInsightsPanel: ({ userId }: { userId: string }) => <div data-insights={userId} /> }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }) }))

import { AccountsPanel } from "./accounts-panel"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const row = (userId: string, email: string) => ({
  userId,
  email,
  createdAt: "2026-10-01T10:00:00Z",
  emailConfirmed: true,
  planSlug: "foodie",
  planExpiresAt: null,
  businessCount: 0,
  teamMemberCount: 0,
  referralSent: 0,
  referralCreated: 0,
  referralActive: 0,
  recipeCount: 0,
  ingredientCount: 0,
  posImportCount: 0,
  lastPosImportAt: null,
  manualSalesCount: 0,
  lastManualSalesAt: null,
  hasActiveSubscription: false,
  country: null,
  totalActiveSeconds: 0,
})

describe("/admin → Cuentas: en línea primero (docs/212)", () => {
  it("muestra cuántas están en línea y las pone arriba de la página", async () => {
    const list = { accounts: [row("a", "a@x.test"), row("b", "b@x.test")], total: 2, pageSize: 25, onlineTotal: 1, confirmedTotal: 2, unconfirmedTotal: 0 }
    const presence = { presence: { a: { online: false, lastSeenAt: null }, b: { online: true, lastSeenAt: new Date().toISOString() } } }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes("/presence") ? presence : list) })),
    )
    await act(async () => {
      root.render(<AccountsPanel />)
    })
    await act(async () => {})
    expect(container.textContent).toContain("1 en línea ahora · van primero")
    const emails = [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")?.textContent)
    expect(emails).toEqual(["b@x.test", "a@x.test"])
  })
})

describe("/admin: clic en una cuenta desde otro panel abre su ficha (docs/214)", () => {
  it("AccountLink pide la cuenta exacta y Cuentas abre su detalle", async () => {
    const { AccountLink } = await import("./account-link")
    const target = row("u9", "cliente@x.test")
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url))
        const u = String(url)
        const body = u.includes("/presence")
          ? { presence: {} }
          : u.includes("userId=u9")
            ? { accounts: [target], total: 1 }
            : u.includes("/account-plan")
              ? { found: true, userId: "u9", email: "cliente@x.test", planSlug: "foodie", planExpiresAt: null, extraBusinesses: 0, extraTeamSeats: 0 }
              : u.includes("/account-businesses")
                ? { businesses: [] }
                : u.includes("/account-team")
                  ? { members: [] }
                  : { accounts: [], total: 0 }
        return { ok: true, json: async () => body }
      }),
    )
    await act(async () => {
      root.render(
        <>
          <AccountLink userId="u9" email="cliente@x.test" />
          <AccountsPanel />
        </>,
      )
    })
    const link = [...container.querySelectorAll("button")].find((b) => b.textContent === "cliente@x.test")!
    await act(async () => {
      link.click()
    })
    await act(async () => {})
    expect(calls.some((c) => c.includes("/api/admin/accounts?confirmed=all&userId=u9"))).toBe(true)
    expect(calls.some((c) => c.includes("/api/admin/account-plan?email=cliente%40x.test"))).toBe(true)
    expect(container.querySelector("[data-insights='u9']")).not.toBeNull()
  })
})
