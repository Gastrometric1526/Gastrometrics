import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/components/admin/live", () => ({ useAdminTick: () => 0 }))

import { EmailClicksPanel } from "./email-clicks-panel"

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

describe("/admin → Correos: quién volvió (docs/210)", () => {
  it("muestra cuántas personas volvieron y nombres legibles de cada correo", async () => {
    const data = {
      days: 90,
      summary: { recipients: 40, returned: 9, returnedPercent: 22.5, wereInactive: 5, keptUsing: 6, last7Days: 2, last30Days: 7 },
      rows: [
        { type: "we_miss_you", sent: 20, clickedAccounts: 4, ratePercent: 20 },
        { type: "payment_paid", sent: null, clickedAccounts: 1, ratePercent: null },
        { type: "plan_expiry_today_referral", sent: null, clickedAccounts: 1, ratePercent: null },
      ],
      recent: [],
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => data })))
    await act(async () => {
      root.render(<EmailClicksPanel />)
    })
    const text = container.textContent ?? ""
    expect(text).toContain("Volvieron por un correo")
    expect(text).toContain("de 40 que recibieron correos (22.5%)")
    expect(text).toContain("Estaban inactivas5")
    expect(text).toContain("Siguieron usando la app6")
    expect(text).toContain("últimos 30 días: 7")
    expect(text).toContain("Confirmación de cobro")
    expect(text).toContain("Vencimiento de plan")
    expect(text).not.toContain("payment_paid")
  })
})
