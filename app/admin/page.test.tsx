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
vi.mock("@/components/admin/overview-panel", () => ({ TodoCard: stub("todo"), OverviewNumbers: stub("numbers") }))
vi.mock("@/components/admin/revenue-panel", () => ({ RevenuePanel: stub("revenue") }))
vi.mock("@/components/admin/health-panel", () => ({ HealthPanel: stub("health") }))
vi.mock("@/components/admin/retention-panel", () => ({ RetentionPanel: stub("retention") }))
vi.mock("@/components/admin/funnel-panel", () => ({ FunnelPanel: stub("funnel") }))
vi.mock("@/components/admin/account-history-panel", () => ({ AccountHistoryPanel: stub("history") }))
vi.mock("@/components/admin/recovery-panel", () => ({ RecoveryPanel: stub("recovery") }))

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
const space = (id: string) => container.querySelector(`[data-admin-space="${id}"]`)
const blocks = () => [...container.querySelectorAll("[data-admin-block]")].map((b) => b.getAttribute("data-admin-block"))
const parts = () => [...container.querySelectorAll("[data-admin-part]")].map((b) => b.getAttribute("data-admin-part"))
const current = () => container.querySelector('[data-admin-space][aria-current="page"]')?.getAttribute("data-admin-space")

// Rediseño desde cero (docs/292): 5 espacios siempre a la vista y, dentro, todas las partes.
describe("/admin con 5 espacios (docs/292)", () => {
  it("abre en Hoy con «Para atender hoy», los 5 espacios y el número de Mensajes", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(current()).toBe("hoy")
    expect(container.querySelector("[data-admin-today]")).toBeTruthy()
    expect(container.querySelector('[data-panel="todo"]')).toBeTruthy()
    expect([...container.querySelectorAll("[data-admin-space]")].map((b) => b.getAttribute("data-admin-space"))).toEqual(["hoy", "mensajes", "personas", "numeros", "sistema"])
    // También abajo, para el celular.
    expect(container.querySelectorAll("[data-admin-space-mobile]").length).toBe(5)
    // Mensajes: 2 chats esperando.
    expect(space("mensajes")?.textContent).toContain("2")
    // El mapa de Hoy lleva a cada parte.
    expect(container.querySelector("[data-admin-map]")?.textContent).toContain(es.admin_sub_imports)
    // Sin barra lateral.
    expect(container.querySelector("aside")).toBeNull()
  })

  it("cada espacio muestra todas sus partes a la vista y abre la primera; tocar otra la muestra", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    const expected: [string, string[], string, string, string][] = [
      ["mensajes", ["chat", "mensajes", "recuperar", "encuestas", "resenas", "novedades", "legal"], "support", "legal", "legal"],
      ["personas", ["lista", "cifras", "historial"], "accounts", "historial", "history"],
      ["numeros", ["dinero", "numeros", "app", "etapas", "retencion", "activacion", "usuarios", "pdf", "inactivos", "referidos", "embudo", "correos", "importaciones"], "revenue", "correos", "email-clicks"],
      ["sistema", ["salud", "acceso", "herramientas", "guia"], "health", "herramientas", "export"],
    ]
    for (const [id, all, firstPanel, other, otherPanel] of expected) {
      await click(space(id))
      expect(current()).toBe(id)
      expect(parts()).toEqual(all)
      expect(container.querySelector(`[data-panel="${firstPanel}"]`), `${id}: ${firstPanel}`).toBeTruthy()
      await click(container.querySelector(`[data-admin-part="${other}"]`))
      expect(blocks()).toEqual([other])
      expect(container.querySelector(`[data-panel="${otherPanel}"]`), `${id}: ${otherPanel}`).toBeTruthy()
      expect(window.location.search).toContain(`sub=${other}`)
    }
    await click(space("hoy"))
    expect(container.querySelector("[data-admin-today]")).toBeTruthy()
  })

  it("la Guía (botón de ayuda) lleva a la tarea y muestra sus pasos con los nombres nuevos", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    await click(container.querySelector(`header button[aria-label="${es.admin_tab_guide}"]`))
    expect(container.textContent).toContain(es.admin_guide_map_title)
    const card = container.querySelector("#admin-task-restore")
    await click([...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes(es.admin_guide_go)))
    expect(container.querySelector('[data-panel="accounts"]')).toBeTruthy()
    expect(current()).toBe("personas")
    const note = container.querySelector('[role="note"]')
    expect(note?.textContent).toContain(es.admin_task_restore)
    expect(note?.textContent).toContain(es.admin_space_personas)
    expect(note?.textContent).not.toMatch(/\{[a-z]+\}/)
  })

  it("las direcciones de los avisos y las viejas siguen funcionando", async () => {
    const open = async (url: string) => {
      act(() => root.unmount())
      root = createRoot(container)
      window.history.replaceState(null, "", url)
      await act(async () => root.render(<AdminPage />))
      await flush()
    }
    await open("/admin?tab=buzon&sub=encuestas")
    expect(container.querySelector('[data-panel="survey"]')).toBeTruthy()
    expect(current()).toBe("mensajes")
    await open("/admin?tab=uso&sub=correos")
    expect(container.querySelector('[data-panel="email-clicks"]')).toBeTruthy()
    expect(current()).toBe("numeros")
    await open("/admin?tab=ingresos")
    expect(container.querySelector('[data-panel="revenue"]')).toBeTruthy()
    await open("/admin?tab=comunicacion&sub=novedades")
    expect(container.querySelector('[data-panel="news"]')).toBeTruthy()
    expect(current()).toBe("mensajes")
  })
})
