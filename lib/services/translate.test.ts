import { afterEach, describe, expect, it, vi } from "vitest"
import { googleLanguage, sameLanguage, translateText } from "./translate"

describe("traducción del chat de soporte", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GOOGLE_TRANSLATE_API_KEY
  })

  it("usa los códigos de Google para los idiomas de la app", () => {
    expect(googleLanguage("zh")).toBe("zh-CN")
    expect(googleLanguage("pt-BR")).toBe("pt")
    expect(googleLanguage("xx")).toBe("es")
    expect(sameLanguage("zh-CN", "zh")).toBe(true)
  })

  it("sin clave no traduce ni llama a Google", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await translateText("Hello", "es")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("traduce y dice el idioma detectado", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "k"
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { translations: [{ translatedText: "Hola", detectedSourceLanguage: "en" }] } }))))
    expect(await translateText("Hello", "es")).toEqual({ text: "Hola", from: "en", to: "es" })
  })

  it("si ya está en ese idioma, no guarda traducción", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "k"
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { translations: [{ translatedText: "Hola", detectedSourceLanguage: "es" }] } }))))
    expect(await translateText("Hola", "es")).toBeNull()
  })

  it("si Google falla, sigue sin traducción", async () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "k"
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })))
    expect(await translateText("Hello", "es")).toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("red") }))
    expect(await translateText("Hello", "es")).toBeNull()
  })
})
