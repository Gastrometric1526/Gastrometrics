import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const es = translations.es as Record<string, string>
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => es[key] ?? key }),
}))
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
// Los paneles de cada sección tienen sus propias pruebas: aquí solo importa el armado
// del panel (docs/279), así que cada uno se cambia por una marca con su nombre.
// Declaración de función (se eleva sola): vi.mock la usa antes de que corran los import.
function stub(name: string) {
  return function Stub() {
    return <div data-panel={name} />
  }
}
vi.mock("@/components/admin/stats-panel", () => ({ StatsPanel: stub("stats") }))
vi.mock("@/components/admin/accounts-panel", () => ({ AccountsPanel: stub("accounts") }))
vi.mock("@/components/admin/feedback-panel", () => ({ FeedbackPanel: stub("feedback") }))
vi.mock("@/components/admin/survey-panel", () => ({ SurveyPanel: stub("survey") }))
vi.mock("@/components/admin/support-inbox", () => ({ SupportInbox: stub("support") }))
vi.mock("@/components/admin/online-now", () => ({ OnlineNow: stub("online") }))
vi.mock("@/components/admin/notifications-bell", () => ({ AdminNotificationsBell: stub("bell") }))
vi.mock("@/components/admin/full-export-button", () => ({ FullExportButton: stub("export") }))
vi.mock("@/components/admin/analytics-panel", () => ({ AnalyticsPanel: stub("analytics") }))
vi.mock("@/components/admin/top-users-panel", () => ({ TopUsersPanel: stub("top-users") }))
vi.mock("@/components/admin/reviews-panel", () => ({ ReviewsPanel: stub("reviews") }))
vi.mock("@/components/admin/email-clicks-panel", () => ({ EmailClicksPanel: stub("email-clicks") }))
vi.mock("@/components/admin/ocr-usage-panel", () => ({ OcrUsagePanel: stub("ocr") }))
vi.mock("@/components/admin/usage-events-panel", () => ({ UsageEventsPanel: stub("usage-events") }))
vi.mock("@/components/admin/business-health-panel", () => ({ BusinessHealthPanel: stub("inactive") }))
vi.mock("@/components/admin/activation-panel", () => ({ ActivationPanel: stub("activation") }))
vi.mock("@/components/admin/referrals-panel", () => ({ ReferralsPanel: stub("referrals") }))
vi.mock("@/components/admin/product-updates-panel", () => ({ ProductUpdatesPanel: stub("news") }))
vi.mock("@/components/admin/legal-update-panel", () => ({ LegalUpdatePanel: stub("legal") }))
vi.mock("@/components/admin/push-toggle", () => ({ AdminPushToggle: stub("push") }))
vi.mock("@/components/admin/overview-panel", () => ({ OverviewPanel: stub("overview") }))
vi.mock("@/components/admin/revenue-panel", () => ({ RevenuePanel: stub("revenue") }))
vi.mock("@/components/admin/health-panel", () => ({ HealthPanel: stub("health") }))
vi.mock("@/components/admin/retention-panel", () => ({ RetentionPanel: stub("retention") }))
vi.mock("@/components/admin/funnel-panel", () => ({ FunnelPanel: stub("funnel") }))
vi.mock("@/components/admin/account-history-panel", () => ({ AccountHistoryPanel: stub("history") }))

import AdminPage from "./page"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  window.history.replaceState(null, "", "/admin")
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {}
  // Sesión de /admin ya abierta y 2 chats esperando: la prueba no escribe ni pide el código.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("/verify")
        ? { unlocked: true }
        : url.includes("/support")
          ? { conversations: [{ status: "waiting" }, { status: "waiting" }, { status: "closed" }] }
          : url.includes("/legal-update-email")
            ? { pendingCount: 3 }
            : url.includes("/feedback")
              ? { feedback: [], archivedIds: [] }
              : {}
      return { ok: true, json: async () => body } as Response
    }),
  )
  window.scrollTo = () => {}
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {})
}
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy()
  await act(async () => (el as HTMLElement).click())
  await flush()
}
const navButton = (label: string) =>
  [...container.querySelectorAll("aside nav button")].find((b) => b.textContent?.trim().startsWith(label))

describe("/admin rediseñado (docs/279)", () => {
  it("abre en el Resumen con los accesos rápidos y los números de la barra lateral", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(container.querySelector('[data-panel="overview"]')).toBeTruthy()
    expect(container.textContent).toContain(es.admin_quick_title)
    expect(container.textContent).toContain(es.admin_nav_group_daily)
    // Buzón: 2 chats esperando; Comunicación: 3 avisos legales pendientes.
    expect(navButton(es.admin_tab_inbox_group)?.textContent).toContain("2")
    expect(navButton(es.admin_tab_comms)?.textContent).toContain("3")
  })

  it("cada sección de la barra lateral abre su panel y su encabezado", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    const expected: [string, string][] = [
      [es.admin_tab_inbox_group, "support"],
      [es.admin_tab_accounts, "accounts"],
      [es.admin_tab_revenue, "revenue"],
      [es.admin_tab_growth, "funnel"],
      [es.admin_tab_usage, "analytics"],
      [es.admin_tab_comms, "news"],
      [es.admin_tab_system, "health"],
    ]
    for (const [label, panel] of expected) {
      await click(navButton(label))
      expect(container.querySelector(`[data-panel="${panel}"]`), label).toBeTruthy()
      expect(container.querySelector("main h2")?.textContent).toBe(label)
    }
    // Sistema también tiene las herramientas: descargar todo y avisos.
    expect(container.querySelector('[data-panel="export"]')).toBeTruthy()
    expect(container.querySelector('[data-panel="push"]')).toBeTruthy()
    expect(window.location.search).toContain("tab=sistema")
  })

  it("una sub-sección de la barra lateral cambia el panel y la dirección", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    await click(navButton(es.admin_tab_growth))
    await click(navButton(es.admin_sub_referrals))
    expect(container.querySelector('[data-panel="referrals"]')).toBeTruthy()
    expect(window.location.search).toContain("sub=referidos")
  })

  it("la Guía lleva a la tarea y muestra sus pasos arriba de la sección", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    await click(navButton(es.admin_tab_guide))
    expect(container.textContent).toContain(es.admin_guide_map_title)
    const card = container.querySelector("#admin-task-restore")
    await click([...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes(es.admin_guide_go)))
    expect(container.querySelector('[data-panel="accounts"]')).toBeTruthy()
    const note = container.querySelector('[role="note"]')
    expect(note?.textContent).toContain(es.admin_task_restore)
    expect(note?.textContent).toContain(es.admin_backups_restore)
    expect(note?.textContent).not.toMatch(/\{[a-z]+\}/)
  })

  it("abre en la sección de la dirección (los avisos push enlazan así)", async () => {
    window.history.replaceState(null, "", "/admin?tab=buzon&sub=encuestas")
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(container.querySelector('[data-panel="survey"]')).toBeTruthy()
  })
})
