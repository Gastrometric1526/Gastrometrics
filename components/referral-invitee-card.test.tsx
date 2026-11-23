import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let recipes: { totalCost: number }[] = []
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u1" } }) }))
vi.mock("@/lib/storage/recipes", () => ({ ensureRecipesLoaded: async () => {}, getRecipes: () => recipes }))

import { ReferralInviteeCard } from "./referral-invitee-card"

const es = translations.es as Record<string, string>
let container: HTMLElement
let root: Root
const answer = (invitedBy: unknown) => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ invitedBy }) })) as unknown as typeof fetch
}
const render = async () => {
  await act(async () => root.render(<ReferralInviteeCard />))
  await act(async () => {})
}
beforeEach(() => {
  localStorage.clear()
  recipes = []
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("tarjeta del invitado (docs/346)", () => {
  it("sin receta con costo: le dice qué hacer para que su colega gane, y cuántos días le quedan", async () => {
    answer({ name: "Ana", status: "registered", daysLeft: 21 })
    await render()
    expect(container.textContent).toContain(es.referral_invitee_title.replace("{name}", "Ana").replace("{days}", "21"))
    expect(container.textContent).toContain(es.referral_invitee_desc.replace("{name}", "Ana"))
    expect(container.textContent).toContain(es.referral_invitee_cta)
  })

  it("con receta con costo: avisa que su colega recibe su mes", async () => {
    recipes = [{ totalCost: 12 }]
    answer({ name: "Ana", status: "registered", daysLeft: 10 })
    await render()
    expect(container.textContent).toContain(es.referral_invitee_pending_desc.replace("{name}", "Ana"))
    expect(container.textContent).not.toContain(es.referral_invitee_cta)
  })

  it("cuando su colega ya ganó: gracias e invitar, una sola vez", async () => {
    answer({ name: "Ana", status: "rewarded", daysLeft: 0 })
    await render()
    expect(container.textContent).toContain(es.referral_invitee_done_title.replace("{name}", "Ana"))
    act(() => (container.querySelector(`[aria-label="${es.common_close}"]`) as HTMLButtonElement).click())
    expect(container.textContent).toBe("")
    await render()
    expect(container.textContent).toBe("")
  })

  it("no sale a quien no llegó por invitación ni con la invitación vencida", async () => {
    answer(null)
    await render()
    expect(container.textContent).toBe("")
    answer({ name: "Ana", status: "expired", daysLeft: 0 })
    await render()
    expect(container.textContent).toBe("")
  })
})
