import { beforeEach, describe, expect, it } from "vitest"
import { HINT_IDS, hintSeen, hintStorageKey, hintsOff, resetHints, shouldShowHint, turnOffHints } from "./hints"

describe("pistas por acción (docs/219)", () => {
  beforeEach(() => localStorage.clear())

  it("sale solo si se cumple la acción, no se vio y no están apagadas", () => {
    expect(shouldShowHint({ condition: true, seen: false, off: false })).toBe(true)
    expect(shouldShowHint({ condition: false, seen: false, off: false })).toBe(false)
    expect(shouldShowHint({ condition: true, seen: true, off: false })).toBe(false)
    expect(shouldShowHint({ condition: true, seen: false, off: true })).toBe(false)
  })

  it("«No mostrar más pistas» las apaga y «Reiniciar tutorial» las devuelve", () => {
    localStorage.setItem(hintStorageKey("recipes-saved"), "true")
    turnOffHints()
    expect(hintsOff()).toBe(true)
    expect(hintSeen("recipes-saved")).toBe(true)
    localStorage.setItem("tour_completed_mep", "true")
    resetHints()
    expect(hintsOff()).toBe(false)
    expect(hintSeen("recipes-saved")).toBe(false)
    expect(localStorage.getItem("tour_completed_mep")).toBe("true")
  })

  it("los ids no se repiten", () => {
    expect(new Set(HINT_IDS).size).toBe(HINT_IDS.length)
  })
})
