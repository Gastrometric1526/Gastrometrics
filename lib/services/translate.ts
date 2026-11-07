/**
 * Traducción del chat de soporte (pedido del dueño, docs/252) con Google Cloud Translation
 * (API v2, `GOOGLE_TRANSLATE_API_KEY`). Sin la clave no traduce y el chat sigue igual. Nunca
 * lanza: si Google falla, el mensaje se guarda sin traducción.
 */

export interface MessageTranslation {
  text: string
  /** Idioma detectado del original. */
  from: string
  to: string
}

/** Idiomas de la app → códigos de Google. */
const GOOGLE_CODE: Record<string, string> = { es: "es", en: "en", da: "da", fr: "fr", pt: "pt", zh: "zh-CN" }

export function googleLanguage(lang: string | null | undefined): string {
  return GOOGLE_CODE[(lang || "").slice(0, 2).toLowerCase()] ?? "es"
}

/** Idioma en el que el dueño lee el chat. */
export function supportAdminLanguage(): string {
  return googleLanguage(process.env.SUPPORT_ADMIN_LANGUAGE || "es")
}

/** Misma lengua (pt-BR y pt, zh-CN y zh) = no hace falta traducir. Puro. */
export function sameLanguage(a: string, b: string): boolean {
  return a.slice(0, 2).toLowerCase() === b.slice(0, 2).toLowerCase()
}

export async function translateText(text: string, target: string): Promise<MessageTranslation | null> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key || !text.trim()) return null
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target, format: "text" }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      console.error("[translate] Google respondió", res.status)
      return null
    }
    const data = (await res.json()) as { data?: { translations?: { translatedText?: string; detectedSourceLanguage?: string }[] } }
    const first = data.data?.translations?.[0]
    const from = first?.detectedSourceLanguage || ""
    if (!first?.translatedText || (from && sameLanguage(from, target))) return null
    return { text: first.translatedText, from, to: target }
  } catch (error) {
    console.error("[translate] No se pudo traducir:", error)
    return null
  }
}
