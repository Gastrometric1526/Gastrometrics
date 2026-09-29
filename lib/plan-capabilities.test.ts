import { describe, it, expect } from "vitest"
import { diffPlanCapabilities } from "./plan-capabilities"

describe("diffPlanCapabilities (docs/139)", () => {
  it("Foodie → Chef de Partie: lista TODO lo ganado, también lo de Home Cook", () => {
    const d = diffPlanCapabilities("foodie", "chef-de-partie", "es")
    expect(d.lost).toEqual([])
    for (const label of ["Sistema de merma", "Facturación a clientes", "Órdenes de compra manuales", "Registro manual de ventas"]) {
      expect(d.gained).toContain(label)
    }
    expect(d.gained.some((g) => g.startsWith("Inventario"))).toBe(true)
    expect(d.gained.join(" ")).not.toMatch(/Todo lo del plan/)
  })

  it("Sous Chef → Home Cook: lista lo que se pierde, incluidos negocios y usuarios", () => {
    const d = diffPlanCapabilities("sous-chef", "home-cook", "es")
    expect(d.gained).toEqual([]) // bajar nunca lista "1 negocio" como ganado
    expect(d.lost).toContain("Hasta 2 negocios")
    expect(d.lost).toContain("2 usuarios (tú y 1 más)")
    expect(d.lost.some((l) => l.startsWith("Finanzas"))).toBe(true)
    expect(d.lost.some((l) => l.startsWith("Equipo"))).toBe(true)
    expect(d.lost.some((l) => l.startsWith("Inventario"))).toBe(true)
    expect(d.lost).not.toContain("Sistema de merma") // Home Cook la conserva
    expect(d.now).toContain("Sistema de merma")
  })

  it("sin cambio no hay ganados ni perdidos; los textos siguen el idioma", () => {
    const d = diffPlanCapabilities("home-cook", "home-cook", "en")
    expect(d.gained).toEqual([])
    expect(d.lost).toEqual([])
    expect(d.now).toContain("Shrinkage system")
    expect(diffPlanCapabilities("foodie", "home-cook", "zh").gained).toContain("损耗系统")
    expect(diffPlanCapabilities("home-cook", "sous-chef", "es").gained).toContain("Hasta 2 negocios")
    expect(diffPlanCapabilities("home-cook", "sous-chef", "es").lost).toEqual([])
  })
})
