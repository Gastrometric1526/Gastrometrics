import { describe, expect, it } from "vitest"
import { authProviders, needsProfileCompletion, safeNextPath } from "./google-signin"

describe("entrar con Google", () => {
  const google = { app_metadata: { provider: "google", providers: ["google"] } }
  const email = { app_metadata: { provider: "email", providers: ["email"] } }

  it("lee los proveedores de la cuenta", () => {
    expect(authProviders(google)).toEqual(["google"])
    expect(authProviders({ app_metadata: { provider: "email", providers: ["email", "google"] } })).toEqual(["email", "google"])
    expect(authProviders(null)).toEqual([])
  })

  it("pide completar el perfil solo a quien entró con Google sin aceptar los Términos", () => {
    expect(needsProfileCompletion(google, { termsVersion: null }, "/dashboard")).toBe(true)
    expect(needsProfileCompletion(google, { termsVersion: "1.7" }, "/dashboard")).toBe(false)
    // Cuentas viejas de correo sin versión: siguen con el aviso de documentos, no se bloquean.
    expect(needsProfileCompletion(email, { termsVersion: null }, "/dashboard")).toBe(false)
    expect(needsProfileCompletion(google, null, "/dashboard")).toBe(false)
  })

  it("deja ver el formulario y los documentos legales", () => {
    expect(needsProfileCompletion(google, { termsVersion: null }, "/completar-perfil")).toBe(false)
    expect(needsProfileCompletion(google, { termsVersion: null }, "/terminos-de-uso")).toBe(false)
    expect(needsProfileCompletion(google, { termsVersion: null }, "/politica-privacidad")).toBe(false)
    expect(needsProfileCompletion(google, { termsVersion: null }, "/auth/callback")).toBe(false)
    expect(needsProfileCompletion(google, { termsVersion: null }, "/completar-perfilx")).toBe(true)
  })

  it("solo vuelve a rutas internas", () => {
    expect(safeNextPath("/mi-plan")).toBe("/mi-plan")
    expect(safeNextPath("//evil.com")).toBe("/dashboard")
    expect(safeNextPath("https://evil.com")).toBe("/dashboard")
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard")
    expect(safeNextPath(null)).toBe("/dashboard")
  })
})
