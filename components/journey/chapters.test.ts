import { describe, expect, it } from "vitest"
import { CHAPTER_STEPS } from "./chapters"
import translations from "@/lib/i18n/translations"

describe("caminos del tutorial guiado (docs/255)", () => {
  it("cada choices, jumps, then y back apunta a un paso que existe", () => {
    for (const [chapter, steps] of Object.entries(CHAPTER_STEPS)) {
      const ids = new Set(steps.map((s) => s.id))
      for (const step of steps) {
        const targets = [
          ...(step.choices ?? []).map((c) => c.goTo),
          ...(step.jumps ?? []).map((j) => j.goTo),
          step.back,
          step.then === "end" ? undefined : step.then,
        ].filter((t): t is string => !!t)
        for (const target of targets) expect(ids.has(target), `${chapter}/${step.id} → ${target}`).toBe(true)
      }
    }
  })

  it("Ingredientes y la Ficha empiezan ofreciendo importar, y también uno por uno", () => {
    const ing = CHAPTER_STEPS["ingredients-add"][0]
    expect(ing.choices?.map((c) => c.label)).toEqual(["journey_ing_choose_import", "journey_ing_choose_manual"])
    expect(ing.choices?.[0].primary).toBe(true)
    const ficha = CHAPTER_STEPS["ficha-basic"][0]
    expect(ficha.choices?.[0].href).toBe("/mis-recetas?import=1")
    expect(ficha.choices?.[1].goTo).toBe("name")
  })

  it("los textos de los caminos existen en los 6 idiomas", () => {
    const keys = Object.values(CHAPTER_STEPS)
      .flat()
      .flatMap((s) => [s.title, s.description, s.tip, ...(s.choices ?? []).map((c) => c.label)])
      .filter((k): k is NonNullable<typeof k> => !!k)
    for (const lang of ["es", "en", "da", "fr", "pt", "zh"] as const) {
      const table = translations[lang] as Record<string, string>
      for (const key of keys) expect(table[key], `${lang}.${key}`).toBeTruthy()
    }
  })
})
