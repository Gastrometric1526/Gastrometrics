import { describe, expect, it } from "vitest"
import {
  CHAPTERS,
  EMPTY_JOURNEY,
  journeyControlsTours,
  journeyPosition,
  markDone,
  onChapterRoute,
  parseJourney,
  restartJourney,
  skipJourney,
  startJourney,
  type JourneyFacts,
} from "./journey"

const allFeatures = {
  merma: true,
  stats_panorama: true,
  manual_sales: true,
  stats_finance: true,
  invoices: true,
  inventory: true,
  menus: true,
  purchase_orders_manual: true,
  purchase_orders_auto: true,
  team: true,
}
const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({ ingredients: 0, recipes: 0, features: allFeatures, ...over })
const doneUpTo = (id: string) => CHAPTERS.slice(0, CHAPTERS.findIndex((c) => c.id === id)).map((c) => c.id)

describe("tutorial guiado progresivo (docs/221)", () => {
  it("empieza por la bienvenida y luego el primer ingrediente", () => {
    const s = startJourney(false)
    const p = journeyPosition(s, facts())
    expect(p.status === "active" && p.chapter.id).toBe("welcome")
    const p2 = journeyPosition(markDone(s, ["welcome"]), facts())
    expect(p2.status === "active" && p2.chapter.id).toBe("ingredients-add")
  })

  it("con menos de 3 ingredientes espera la meta; con 3 se activa la merma", () => {
    const s = { ...startJourney(false), done: doneUpTo("ingredients-three") }
    const waiting = journeyPosition(s, facts({ ingredients: 1 }))
    expect(waiting.status === "active" && waiting.chapter.id).toBe("ingredients-three")
    expect(waiting.status === "active" && waiting.unlocked).toBe(false)
    const ready = journeyPosition(s, facts({ ingredients: 3 }))
    expect(ready.status === "active" && ready.chapter.id).toBe("merma")
    expect(ready.autoDone).toContain("ingredients-three")
  })

  it("sin merma en el plan pasa directo a la Ficha Técnica", () => {
    const s = { ...startJourney(false), done: doneUpTo("merma") }
    const p = journeyPosition(s, facts({ ingredients: 3, features: { ...allFeatures, merma: false } }))
    expect(p.status === "active" && p.chapter.id).toBe("ficha-basic")
    expect(p.autoDone).toContain("merma")
  })

  it("Mis Recetas se activa al guardar la primera receta", () => {
    const s = { ...startJourney(false), done: doneUpTo("recipes") }
    const locked = journeyPosition(s, facts({ ingredients: 3 }))
    expect(locked.status === "active" && locked.unlocked).toBe(false)
    const open = journeyPosition(s, facts({ ingredients: 3, recipes: 1 }))
    expect(open.status === "active" && open.unlocked).toBe(true)
  })

  it("se espera a saber el plan antes de decidir", () => {
    const s = { ...startJourney(false), done: doneUpTo("merma") }
    expect(journeyPosition(s, facts({ ingredients: 3, features: {} })).status).toBe("waiting")
  })

  it("termina, se salta y se reinicia", () => {
    const all = { ...startJourney(true), done: CHAPTERS.map((c) => c.id) }
    expect(journeyPosition(all, facts()).status).toBe("finished")
    expect(journeyControlsTours(all)).toBe(false)
    const skipped = skipJourney(startJourney(true))
    expect(journeyPosition(skipped, facts()).status).toBe("off")
    expect(journeyControlsTours(skipped)).toBe(false)
    const again = restartJourney(skipped)
    expect(again).toEqual({ started: true, existing: true, skipped: false, done: [] })
    expect(journeyControlsTours(again)).toBe(true)
    expect(journeyControlsTours(null)).toBe(true)
    expect(journeyPosition(EMPTY_JOURNEY, facts()).status).toBe("off")
  })

  it("reconoce la ruta de cada etapa", () => {
    const ordenes = CHAPTERS.find((c) => c.id === "ordenes")!
    expect(onChapterRoute(ordenes, "/business/abc/ordenes-compra")).toBe(true)
    expect(onChapterRoute(CHAPTERS.find((c) => c.id === "menus")!, "/menus")).toBe(true)
    expect(onChapterRoute(CHAPTERS.find((c) => c.id === "menus")!, "/mep")).toBe(false)
    expect(onChapterRoute(CHAPTERS.find((c) => c.id === "welcome")!, "/ventas")).toBe(true)
  })

  it("lee el estado guardado y descarta lo inválido", () => {
    expect(parseJourney(null)).toBeNull()
    expect(parseJourney("x")).toBeNull()
    expect(parseJourney('{"started":true,"done":["welcome",3]}')).toEqual({ started: true, existing: false, skipped: false, done: ["welcome"] })
  })

  it("los ids no se repiten", () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length)
  })
})
