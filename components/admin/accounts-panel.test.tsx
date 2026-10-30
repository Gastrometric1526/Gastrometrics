import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/components/admin/live", () => ({ useAdminLiveReload: () => {} }))
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
