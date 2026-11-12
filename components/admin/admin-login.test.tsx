import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import type { AdminSessionInfo } from "@/lib/admin/session-info"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const es = translations.es as Record<string, string>
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => es[key] ?? key }),
}))
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

import { AdminLogin } from "./admin-login"

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

const info = (over: Partial<AdminSessionInfo>): AdminSessionInfo => ({
  unlocked: false,
  identity: null,
  canManage: false,
  account: null,
  accountAllowed: false,
  membersReady: true,
  needsOwner: false,
  ...over,
})

describe("entrada a /admin con la propia cuenta (docs/282)", () => {
  it("con la cuenta abierta y con acceso, un toque en «Entrar como …» abre el panel", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, role: "admin" }) }) as Response)
    vi.stubGlobal("fetch", fetchMock)
    const onUnlocked = vi.fn()
    await act(async () => root.render(<AdminLogin info={info({ account: { email: "socia@correo.com" }, accountAllowed: true })} onUnlocked={onUnlocked} />))
    const button = container.querySelector('[data-admin-login="account"]') as HTMLButtonElement
    expect(button.textContent).toContain("socia@correo.com")
    await act(async () => button.click())
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/account-login", { method: "POST" })
    expect(onUnlocked).toHaveBeenCalled()
    // El código de emergencia queda plegado: no hay campo de contraseña a la vista.
    expect(container.querySelector("#admin-passcode")).toBeNull()
  })

  it("con una cuenta sin acceso lo dice y ofrece usar otra; sin cuenta, «Iniciar sesión» vuelve al panel", async () => {
    await act(async () => root.render(<AdminLogin info={info({ account: { email: "otra@correo.com" } })} onUnlocked={() => {}} />))
    expect(container.textContent).toContain(es.admin_login_not_allowed.replace("{email}", "otra@correo.com"))
    expect(container.querySelector('[data-admin-login="account"]')).toBeNull()
    await act(async () => root.render(<AdminLogin info={info({})} onUnlocked={() => {}} />))
    expect(container.querySelector('a[href="/login?next=/admin"] [data-admin-login="signin"]')).toBeTruthy()
  })

  it("la primera vez (sin dueño) muestra el código abierto y explica que la cuenta queda como dueña", async () => {
    await act(async () => root.render(<AdminLogin info={info({ account: { email: "dueno@correo.com" }, needsOwner: true })} onUnlocked={() => {}} />))
    expect(container.textContent).toContain(es.admin_login_claim_hint.replace("{email}", "dueno@correo.com"))
    expect(container.querySelector("#admin-passcode")).toBeTruthy()
  })
})
