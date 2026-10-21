import { describe, expect, it } from "vitest"
import { resolveCanonicalSiteUrl } from "./site-url"

describe("resolveCanonicalSiteUrl (docs/176)", () => {
  it("cambia gastrometrics.org (que redirige) por www", () => {
    expect(resolveCanonicalSiteUrl(undefined, "https://gastrometrics.org")).toBe("https://www.gastrometrics.org")
    expect(resolveCanonicalSiteUrl(undefined, "https://gastrometrics.org/")).toBe("https://www.gastrometrics.org")
  })

  it("respeta NEXT_PUBLIC_CANONICAL_URL si está puesta", () => {
    expect(resolveCanonicalSiteUrl("https://gastrometrics.org/", "https://gastrometrics.org")).toBe("https://gastrometrics.org")
  })

  it("deja otras direcciones (local, previews) como vienen", () => {
    expect(resolveCanonicalSiteUrl(undefined, "http://localhost:3000")).toBe("http://localhost:3000")
  })

  it("sin variables usa www", () => {
    expect(resolveCanonicalSiteUrl(undefined, undefined)).toBe("https://www.gastrometrics.org")
  })
})
