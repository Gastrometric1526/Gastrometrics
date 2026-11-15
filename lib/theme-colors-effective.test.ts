// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import {
  CURATED_THEMES,
  FOLLOW_USER_THEME,
  businessOwnThemeSlug,
  effectiveThemeSlug,
  getBusinessThemeRgb,
  userThemeSlug,
} from "./theme-colors"

describe("color de la persona y del negocio (docs/309)", () => {
  beforeEach(() => localStorage.clear())

  it("sin nada elegido: Naranja Brasa", () => {
    expect(effectiveThemeSlug("b1")).toBe("naranja-brasa")
  })
  it("un negocio sin color propio usa el de la persona, también en sus PDF", () => {
    localStorage.setItem("main_color_theme", "oliva")
    expect(userThemeSlug()).toBe("oliva")
    expect(effectiveThemeSlug("b1")).toBe("oliva")
    expect(getBusinessThemeRgb("b1")).toEqual(getBusinessThemeRgb("main"))
  })
  it("«Igual que mi color» sigue a la persona", () => {
    localStorage.setItem("main_color_theme", "azul-marino")
    localStorage.setItem("business_b1_color_theme", FOLLOW_USER_THEME)
    expect(businessOwnThemeSlug("b1")).toBeNull()
    expect(effectiveThemeSlug("b1")).toBe("azul-marino")
  })
  it("el negocio puede tener un color distinto al de la persona", () => {
    localStorage.setItem("main_color_theme", "azul-marino")
    localStorage.setItem("business_b1_color_theme", "terracota")
    expect(effectiveThemeSlug("b1")).toBe("terracota")
    expect(effectiveThemeSlug("main")).toBe("azul-marino")
    expect(effectiveThemeSlug(null)).toBe("azul-marino")
  })
  it("los tres colores nuevos existen con su logo", () => {
    for (const slug of ["terracota", "oliva", "azul-marino"]) {
      expect(CURATED_THEMES.find((t) => t.slug === slug)?.logo).toBe(`gm-${slug}.png`)
    }
  })
})
