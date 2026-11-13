import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import { LATEST_CHANGELOG_VERSION } from "@/lib/changelog"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const es = translations.es as Record<string, string>
const counts = { all: 3, subs: 0 }
vi.mock("@/contexts/language-context", () => ({ useLanguage: () => ({ language: "es", t: (key: string) => es[key] ?? key }) }))
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u1", email: "chef@example.com" } }) }))
vi.mock("@/lib/plan-access", () => ({ useActiveMembership: () => ({ active: false }) }))
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/journey", () => ({ JOURNEY_ROUTES: ["/dashboard"], journeyControlsTours: () => false, readJourney: () => null }))
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    from: () => {
      let sub = false
      const q = {
        select: () => q,
        eq: (col: string) => ((sub = sub || col === "classification"), q),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ count: sub ? counts.subs : counts.all, error: null }).then(res),
      }
      return q
    },
  }),
}))

import { SubrecipeIntro, SUBRECIPE_INTRO_KEY } from "./subrecipe-intro"

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  counts.all = 3
  counts.subs = 0
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const mount = async () => {
  await act(async () => root.render(<SubrecipeIntro />))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000)
  })
}

// docs/300: recordatorio de subrecetas para quien ya tiene recetas y ninguna subreceta.
describe("recordatorio de subrecetas", () => {
  it("sale una vez, con el ejemplo de la salsa de tomate", async () => {
    window.localStorage.setItem("changelog_seen_u1", LATEST_CHANGELOG_VERSION)
    await mount()
    expect(document.body.textContent).toContain(es.subrecipe_intro_body)
    expect(window.localStorage.getItem(`${SUBRECIPE_INTRO_KEY}u1`)).toBeTruthy()
  })

  it("no sale en la misma carga que Novedades, ni a quien ya tiene subrecetas o no tiene recetas", async () => {
    await mount()
    expect(document.body.textContent).not.toContain(es.subrecipe_intro_body)
    act(() => root.unmount())
    window.localStorage.setItem("changelog_seen_u1", LATEST_CHANGELOG_VERSION)
    counts.subs = 1
    root = createRoot(container)
    await mount()
    expect(document.body.textContent).not.toContain(es.subrecipe_intro_body)
    expect(window.localStorage.getItem(`${SUBRECIPE_INTRO_KEY}u1`)).toBe("has_subrecipes")
    act(() => root.unmount())
    window.localStorage.removeItem(`${SUBRECIPE_INTRO_KEY}u1`)
    counts.subs = 0
    counts.all = 0
    root = createRoot(container)
    await mount()
    expect(document.body.textContent).not.toContain(es.subrecipe_intro_body)
  })
})
