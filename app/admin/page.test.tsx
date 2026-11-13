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
const tile = (id: string) => container.querySelector(`[data-area-tile="${id}"]`)
const homeButton = () => [...container.querySelectorAll("main button")].find((b) => b.textContent?.trim() === es.admin_home_back)
const blocks = () => [...container.querySelectorAll("[data-admin-block]")].map((b) => b.getAttribute("data-admin-block"))
const links = () => [...container.querySelectorAll("[data-admin-block-link]")].map((b) => b.getAttribute("data-admin-block-link"))

describe("/admin con Inicio de tarjetas (docs/281)", () => {
  it("abre en el Inicio con «Para atender hoy», 6 tarjetas y sus números", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(container.querySelector('[data-panel="todo"]')).toBeTruthy()
    expect(container.querySelectorAll("[data-area-tile]").length).toBe(6)
    expect(container.textContent).toContain(es.admin_home_greeting)
    // Mensajes: 2 chats esperando; Avisar a todos: 3 sin aceptar lo legal.
    expect(tile("buzon")?.textContent).toContain(es.admin_tile_unanswered.replace("{count}", "2"))
    expect(tile("comunicacion")?.textContent).toContain(es.admin_tile_legal_pending.replace("{count}", "3"))
    // Sin barra lateral ni submenús.
    expect(container.querySelector("aside")).toBeNull()
    expect(container.querySelector('[role="tablist"]')).toBeNull()
  })

  // docs/287: cada área abre un índice de sus partes; cada parte se ve sola.
  it("cada tarjeta abre el índice de su área, una parte se ve sola y «Inicio» vuelve", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    const expected: [string, string, string[], string, string][] = [
      ["buzon", es.admin_area_buzon, ["chat", "mensajes", "recuperar", "encuestas", "resenas"], "chat", "support"],
      ["cuentas", es.admin_area_cuentas, ["lista", "cifras", "historial"], "lista", "accounts"],
      ["crecimiento", es.admin_area_crecimiento, ["numeros", "app", "etapas", "retencion", "activacion", "usuarios", "pdf", "inactivos", "referidos", "embudo", "correos", "importaciones"], "etapas", "funnel"],
      ["comunicacion", es.admin_area_comunicacion, ["novedades", "legal"], "legal", "legal"],
      ["sistema", es.admin_tab_system, ["salud", "acceso", "herramientas"], "herramientas", "export"],
    ]
    for (const [id, title, parts, open, panel] of expected) {
      await click(tile(id))
      expect(container.querySelector("main h2")?.textContent).toBe(title)
      expect(links()).toEqual(parts)
      // En el índice no se carga ningún panel.
      expect(container.querySelector("[data-admin-block]")).toBeNull()
      await click(container.querySelector(`[data-admin-block-link="${open}"]`))
      expect(blocks()).toEqual([open])
      expect(container.querySelector(`[data-panel="${panel}"]`), `${id}: ${panel}`).toBeTruthy()
      expect(window.location.search).toContain(`sub=${open}`)
      // «Inicio › Área» vuelve al índice.
      await click(container.querySelector("[data-area-index]"))
      expect(links()).toEqual(parts)
      expect(window.location.search).not.toContain("sub=")
      await click(homeButton())
      expect(container.querySelectorAll("[data-area-tile]").length).toBe(6)
    }
    // Un área sin partes (Dinero) se muestra directa.
    await click(tile("ingresos"))
    expect(container.querySelector('[data-panel="revenue"]')).toBeTruthy()
  })

  it("anterior y siguiente recorren las partes del área en orden", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    await click(tile("buzon"))
    await click(container.querySelector('[data-admin-block-link="chat"]'))
    const nextButton = () => [...container.querySelectorAll("main button")].find((b) => b.textContent?.startsWith(es.admin_area_next))
    await click(nextButton())
    expect(blocks()).toEqual(["mensajes"])
    await click(nextButton())
    expect(blocks()).toEqual(["recuperar"])
    await click([...container.querySelectorAll("main button")].find((b) => b.textContent?.startsWith(es.admin_area_prev)))
    expect(blocks()).toEqual(["mensajes"])
  })

  it("la Guía lleva a la tarea y muestra sus pasos con los nombres nuevos", async () => {
    await act(async () => root.render(<AdminPage />))
    await flush()
    await click([...container.querySelectorAll("main button")].find((b) => b.textContent?.includes(es.admin_guide_open_all)))
    expect(container.textContent).toContain(es.admin_guide_map_title)
    const card = container.querySelector("#admin-task-restore")
    await click([...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes(es.admin_guide_go)))
    expect(container.querySelector('[data-panel="accounts"]')).toBeTruthy()
    const note = container.querySelector('[role="note"]')
    expect(note?.textContent).toContain(es.admin_task_restore)
    expect(note?.textContent).toContain(es.admin_area_cuentas)
    expect(note?.textContent).not.toMatch(/\{[a-z]+\}/)
  })

  it("las direcciones de los avisos siguen funcionando, también la vieja ?tab=uso", async () => {
    window.history.replaceState(null, "", "/admin?tab=buzon&sub=encuestas")
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(container.querySelector('[data-panel="survey"]')).toBeTruthy()
    act(() => root.unmount())
    root = createRoot(container)
    window.history.replaceState(null, "", "/admin?tab=uso&sub=correos")
    await act(async () => root.render(<AdminPage />))
    await flush()
    expect(container.querySelector('[data-panel="email-clicks"]')).toBeTruthy()
    expect(container.querySelector("main h2")?.textContent).toBe(es.admin_sub_email_clicks)
    expect(container.querySelector("[data-area-index]")?.textContent).toBe(es.admin_area_crecimiento)
  })
})
