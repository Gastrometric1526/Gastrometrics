import { describe, it, expect } from "vitest"
import { gainedCapabilities } from "./plan-capabilities"
import { planTourModules, planTourId } from "./plan-tour"

describe("planTourModules", () => {
  it("Foodie → Chef de Partie lleva a cada módulo nuevo, en el orden del menú", () => {
    const gained = gainedCapabilities("foodie", "chef-de-partie", "es")
    const mods = planTourModules(gained, 5, false)
    expect(mods.map((m) => m.href)).toEqual([
      "/mis-recetas",
      "/ingredientes",
      "/inventario",
      "/menus",
      "/menu-y-compras",
      "/ventas",
      "/estadisticas",
    ])
    expect(mods.every((m) => !m.waiting)).toBe(true)
  })

  it("respeta la revelación por recetas: con 1 receta, Inventario y Menús siguen esperando", () => {
    const mods = planTourModules(gainedCapabilities("foodie", "chef-de-partie", "es"), 1, false)
    const byHref = Object.fromEntries(mods.map((m) => [m.href, m]))
    expect(byHref["/inventario"].waiting).toBe(true)
    expect(byHref["/inventario"].stage).toBe(3)
    expect(byHref["/menus"].waiting).toBe(true)
    expect(byHref["/estadisticas"].waiting).toBe(false)
    expect(byHref["/ingredientes"].waiting).toBe(false)
  })

  it("con 'Ver todos los módulos' nada espera", () => {
    const mods = planTourModules(gainedCapabilities("foodie", "chef-de-partie", "es"), 0, true)
    expect(mods.some((m) => m.waiting)).toBe(false)
  })

  it("Chef de Partie → Sous Chef: finanzas, equipo y un segundo negocio", () => {
    const mods = planTourModules(gainedCapabilities("chef-de-partie", "sous-chef", "es"), 5, false)
    expect(mods.map((m) => m.href)).toEqual(["/equipo", "/estadisticas", "/negocios"])
  })

  it("al bajar de plan no hay módulos nuevos", () => {
    expect(planTourModules(gainedCapabilities("sous-chef", "foodie", "es"), 5, false)).toEqual([])
  })

  it("la llave cambia con cada cambio de plan", () => {
    expect(planTourId("foodie", "home-cook", "2026-10-09T10:00:00Z")).not.toBe(planTourId("foodie", "home-cook", "2026-11-01T10:00:00Z"))
  })
})
