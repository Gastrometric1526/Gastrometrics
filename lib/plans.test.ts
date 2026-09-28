import { describe, expect, it } from "vitest"
import { getPlanBySlug, getTeamInviteLimit } from "./plans"

// Regla del dueño del proyecto (docs/133): los "usuarios" de cada plan incluyen al dueño.
describe("getTeamInviteLimit", () => {
  it("Sous Chef: 2 usuarios = el dueño + 1 invitado", () => {
    expect(getTeamInviteLimit(getPlanBySlug("sous-chef"))).toBe(1)
  })

  it("Chef Ejecutivo: 5 usuarios = el dueño + 4 invitados", () => {
    expect(getTeamInviteLimit(getPlanBySlug("chef-ejecutivo"))).toBe(4)
  })

  it("los planes sin Equipo no pueden invitar", () => {
    for (const slug of ["foodie", "home-cook", "chef-de-partie"]) {
      expect(getTeamInviteLimit(getPlanBySlug(slug))).toBe(0)
    }
  })

  it("suma los asientos extra que da /admin", () => {
    expect(getTeamInviteLimit(getPlanBySlug("chef-ejecutivo"), 2)).toBe(6)
    expect(getTeamInviteLimit(getPlanBySlug("sous-chef"), 1)).toBe(2)
  })

  it("todo plan que desbloquea Equipo permite al menos 1 invitado", () => {
    for (const slug of ["sous-chef", "chef-ejecutivo"]) {
      const plan = getPlanBySlug(slug)
      expect(plan.unlockedFeatures).toContain("team")
      expect(plan.maxUsers).toBeGreaterThan(1)
    }
  })
})
