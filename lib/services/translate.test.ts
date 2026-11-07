import { afterEach, describe, expect, it, vi } from "vitest"
import { googleLanguage, sameLanguage, splitForTranslation, translateText } from "./translate"

describe("traducción del chat de soporte", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GOOGLE_TRANSLATE_API_KEY
    delete process.env.SUPPORT_TRANSLATION
  })

  it("usa los códigos de Google para los idiomas de la app", () => {
    expect(googleLanguage("zh")).toBe("zh-CN")
    expect(googleLanguage("pt-BR")).toBe("pt")
    expect(googleLanguage("xx")).toBe("es")
    expect(sameLanguage("zh-CN", "zh")).toBe(true)
  })

  it("sin clave de Google usa MyMemory, gratis y sin clave", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: "Hola", detectedLanguage: "en" } })))
    vi.stubGlobal("fetch", fetchMock)
    expect(await translateText("Hello", "es")).toEqual({ text: "Hola", from: "en", to: "es" })
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.mymemory.translated.net")
  })

  it("si MyMemory agotó el cupo del día, no guarda su aviso como traducción", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ responseStatus: 429, quotaFinished: true, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" } }))))
    expect(await translateText("Hello", "es")).toBeNull()
  })

  it("SUPPORT_TRANSLATION=off apaga la traducción", async () => {
    process.env.SUPPORT_TRANSLATION = "off"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await translateText("Hello", "es")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("parte los textos largos sin perder nada", () => {
    const text = "Primera frase con tildes áéí. ".repeat(40) + "\n" + "palabra ".repeat(100)
    const parts = splitForTranslation(text)
    expect(parts.join("")).toBe(text)
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(450)
    expect(splitForTranslation("corto")).toEqual(["corto"])
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
