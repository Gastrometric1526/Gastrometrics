import { describe, it, expect } from "vitest"
import { CHANGELOG } from "./changelog"
import { TOUR_PAGES, parseTourHref, requestedTourMatches, tourHref } from "./tour-links"
import { renderProductUpdateEmail } from "./services/product-update-email"

// Ley del proyecto (docs/167): toda novedad desde que existe la regla lleva el botón al
// tutorial de su sección. Si esta prueba falla, falta `tutorialHref: tourHref("…")` en
// la entrada nueva de lib/changelog.ts (y actualizar ese tutorial).
const LAW_SINCE = "2026-10-17"

describe("novedades con tutorial (docs/167)", () => {
  it("cada entrada desde la regla tiene un enlace a un tutorial que existe", () => {
    for (const entry of CHANGELOG.filter((e) => e.version >= LAW_SINCE)) {
      expect(entry.tutorialHref, `la novedad ${entry.version} no tiene tutorialHref`).toBeTruthy()
      const { path, slug } = parseTourHref(entry.tutorialHref!)
      expect(slug && TOUR_PAGES[slug], `tutorial desconocido en ${entry.version}`).toBe(path)
    }
  })

  it("?tour= abre solo el tutorial de esa página", () => {
    expect(tourHref("mi-plan")).toBe("/mi-plan?tour=mi-plan")
    expect(requestedTourMatches("?tour=mi-plan", "tour_completed_mi-plan")).toBe(true)
    expect(requestedTourMatches("?tour=mi-plan&utm_source=email", "tour_completed_mi-plan")).toBe(true)
    expect(requestedTourMatches("?tour=menus", "tour_completed_mi-plan")).toBe(false)
    expect(requestedTourMatches("", "tour_completed_mi-plan")).toBe(false)
  })

  it("el correo de novedades lleva el enlace al tutorial", () => {
    const { html } = renderProductUpdateEmail({ entries: [CHANGELOG[0]], language: "es", siteUrl: "https://x.org" })
    expect(html).toContain(`https://x.org${parseTourHref(CHANGELOG[0].tutorialHref!).path}?tour=`)
    expect(html).toContain("Ver el tutorial")
  })
})
