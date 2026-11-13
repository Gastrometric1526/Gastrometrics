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

  // docs/298: el panel tiene su propia entrada, sin abrir la sesión de la app.
  it("sin cuenta abierta, entra con correo y contraseña escritos en el panel", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, role: "owner" }) }) as Response)
    vi.stubGlobal("fetch", fetchMock)
    const onUnlocked = vi.fn()
    await act(async () => root.render(<AdminLogin info={info({})} onUnlocked={onUnlocked} />))
    expect(container.querySelector('a[href="/login?next=/admin"]')).toBeNull()
    const setValue = (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
    await act(async () => {
      setValue(container.querySelector("#admin-email") as HTMLInputElement, "Dueno@Correo.com")
      setValue(container.querySelector("#admin-password") as HTMLInputElement, "secreta")
    })
    const form = container.querySelector('[data-admin-login="form"]') as HTMLFormElement
    await act(async () => form.requestSubmit())
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/password-login", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "Dueno@Correo.com", password: "secreta" }) }))
    expect(onUnlocked).toHaveBeenCalled()
  })

  it("con contraseña incorrecta lo dice y borra la contraseña", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, error: "invalid" }) }) as Response))
    const onUnlocked = vi.fn()
    await act(async () => root.render(<AdminLogin info={info({})} onUnlocked={onUnlocked} />))
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      for (const [id, v] of [["#admin-email", "a@b.com"], ["#admin-password", "mala"]]) {
        const el = container.querySelector(id) as HTMLInputElement
        setter.call(el, v)
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }
    })
    await act(async () => (container.querySelector('[data-admin-login="form"]') as HTMLFormElement).requestSubmit())
    expect(container.textContent).toContain(es.admin_login_bad_credentials)
    expect((container.querySelector("#admin-password") as HTMLInputElement).value).toBe("")
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it("el enlace del correo pide un toque y abre el panel", async () => {
    window.history.replaceState(null, "", "/admin?entrar=abc.def.ghi")
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as Response)
    vi.stubGlobal("fetch", fetchMock)
    const onUnlocked = vi.fn()
    await act(async () => root.render(<AdminLogin info={info({})} onUnlocked={onUnlocked} />))
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => (container.querySelector('[data-admin-login="token"]') as HTMLButtonElement).click())
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/email-link", expect.objectContaining({ body: JSON.stringify({ token: "abc.def.ghi" }) }))
    expect(onUnlocked).toHaveBeenCalled()
    expect(window.location.search).toBe("")
  })

  it("la primera vez (sin dueño) muestra el código abierto y explica que la cuenta queda como dueña", async () => {
    await act(async () => root.render(<AdminLogin info={info({ account: { email: "dueno@correo.com" }, needsOwner: true })} onUnlocked={() => {}} />))
    expect(container.textContent).toContain(es.admin_login_claim_hint.replace("{email}", "dueno@correo.com"))
    expect(container.querySelector("#admin-passcode")).toBeTruthy()
  })
})
