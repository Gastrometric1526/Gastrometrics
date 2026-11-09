import { describe, expect, it } from "vitest"
import {
  CHAPTERS,
  chaptersForRoute,
  endReplay,
  replayModule,
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
  pos: true,
}
const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({ ingredients: 0, recipes: 0, menus: 0, mermaActive: false, features: allFeatures, ...over })
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
    expect(p.autoDone).not.toContain("merma")
  })

  it("al subir de plan vuelve solo lo que faltaba, aunque ya lo hubiera terminado", () => {
    const lowPlan = { ...allFeatures, merma: false, inventory: false, menus: false }
    const done = CHAPTERS.map((c) => c.id).filter((id) => !["merma", "inventario", "menus", "mep"].includes(id))
    const s = { ...startJourney(false), done }
    expect(journeyPosition(s, facts({ ingredients: 5, recipes: 5, features: lowPlan })).status).toBe("finished")
    const upgraded = journeyPosition(s, facts({ ingredients: 5, recipes: 5, features: { ...lowPlan, merma: true } }))
    expect(upgraded.status === "active" && upgraded.chapter.id).toBe("merma")
    const afterMerma = journeyPosition(markDone(s, ["merma"]), facts({ ingredients: 5, recipes: 5, features: allFeatures }))
    expect(afterMerma.status === "active" && afterMerma.chapter.id).toBe("inventario")
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

  it("solo avanza con los datos de verdad: merma ya activa, menú antes del MEP", () => {
    const atMerma = { ...startJourney(false), done: doneUpTo("merma") }
    const active = journeyPosition(atMerma, facts({ ingredients: 3, mermaActive: true }))
    expect(active.status === "active" && active.chapter.id).toBe("ficha-basic")
    expect(active.autoDone).toContain("merma")
    const atMenusOne = { ...startJourney(false), done: doneUpTo("menus-one") }
    const noMenu = journeyPosition(atMenusOne, facts({ ingredients: 5, recipes: 3 }))
    expect(noMenu.status === "active" && noMenu.chapter.id).toBe("menus-one")
    const withMenu = journeyPosition(atMenusOne, facts({ ingredients: 5, recipes: 3, menus: 1 }))
    expect(withMenu.status === "active" && withMenu.chapter.id).toBe("mep")
    expect(withMenu.status === "active" && withMenu.unlocked).toBe(true)
  })

  it("reiniciar desde un módulo repasa solo ese módulo y luego sigue donde iba", () => {
    expect(chaptersForRoute("/ingredientes")).toEqual(["ingredients-add", "merma"])
    expect(chaptersForRoute("/ficha-tecnica")).toEqual(["ficha-basic", "ficha-advanced"])
    expect(chaptersForRoute("/dashboard")).toEqual([])
    const f = facts({ ingredients: 5, recipes: 5, menus: 1 })
    const finished = { ...startJourney(true), done: CHAPTERS.map((c) => c.id) }
    const replay = replayModule(finished, chaptersForRoute("/ingredientes"))
    const p1 = journeyPosition(replay, f)
    expect(p1.status === "active" && p1.chapter.id).toBe("ingredients-add")
    expect(p1.status === "active" && p1.fromReplay).toBe(true)
    const p2 = journeyPosition(markDone(replay, ["ingredients-add"]), f)
    expect(p2.status === "active" && p2.chapter.id).toBe("merma")
    expect(journeyPosition(markDone(markDone(replay, ["ingredients-add"]), ["merma"]), f).status).toBe("finished")
    // También cuando se había saltado el recorrido.
    const skipped = replayModule(skipJourney(startJourney(true)), ["menus"])
    const p3 = journeyPosition(skipped, f)
    expect(p3.status === "active" && p3.chapter.id).toBe("menus")
    expect(journeyPosition(endReplay(skipped), f).status).toBe("off")
  })

  it("los ids no se repiten", () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length)
  })
})

describe("invitado del equipo (docs/263)", () => {
  const memberFacts = (perms: Record<string, boolean>, over: Partial<JourneyFacts> = {}) =>
    facts({ member: true, features: { ...allFeatures, ingredients: false, recipes: false, merma: false, stats_panorama: false, manual_sales: false, inventory: false, menus: false, purchase_orders_manual: false, ...perms }, ...over })
  const visited = (f: JourneyFacts) => {
    let state = startJourney(false)
    const seen: string[] = []
    for (let i = 0; i < CHAPTERS.length; i++) {
      const pos = journeyPosition(state, f)
      state = markDone(state, pos.autoDone)
      if (pos.status !== "active") break
      seen.push(pos.chapter.id)
      state = markDone(state, [pos.chapter.id])
    }
    return seen
  }

  it("solo recorre lo que tiene permitido", () => {
    const seen = visited(memberFacts({ ingredients: true, recipes: true }, { ingredients: 5, recipes: 5, menus: 1 }))
    // docs/273: con ingredientes y recetas ya hechos, no se vuelve a pedir el primero de cada uno.
    expect(seen).not.toContain("ingredients-add")
    expect(seen).not.toContain("ficha-basic")
    expect(seen).toContain("ficha-advanced")
    expect(seen).toContain("recipes")
    expect(seen).not.toContain("inventario")
    expect(seen).not.toContain("menus")
    expect(seen).not.toContain("ventas")
  })

  it("sin datos todavía, empieza por el primer ingrediente (docs/273)", () => {
    const seen = visited(memberFacts({ ingredients: true, recipes: true }, { ingredients: 0, recipes: 0, menus: 0 }))
    expect(seen).toContain("ingredients-add")
  })

  it("nunca ve Equipo, Negocios ni Mi Plan, aunque tenga todo lo demás", () => {
    const seen = visited(memberFacts({ ingredients: true, recipes: true, merma: true, stats_panorama: true, manual_sales: true, inventory: true, menus: true, purchase_orders_manual: true }, { ingredients: 5, recipes: 5, menus: 1, mermaActive: true }))
    expect(seen).toContain("inventario")
    expect(seen).not.toContain("equipo")
    expect(seen).not.toContain("negocios")
    expect(seen).not.toContain("mi-plan")
  })

  it("al dueño le sigue mostrando todo", () => {
    const seen = visited(facts({ ingredients: 5, recipes: 5, menus: 1, mermaActive: true }))
    expect(seen).toContain("equipo")
    expect(seen).toContain("mi-plan")
  })
})
