/**
 * Traducción del chat de soporte (pedido del dueño, docs/252 y docs/254).
 *
 * Gratis por defecto: MyMemory (api.mymemory.translated.net), sin clave ni tarjeta, con un
 * cupo diario gratis. Si se acaba el cupo, MyMemory no cobra: solo deja de traducir ese día.
 * Si el dueño pone `GOOGLE_TRANSLATE_API_KEY`, usa Google Cloud Translation, que pide la
 * facturación activa. Nunca lanza: si el servicio falla, el mensaje se guarda sin traducción.
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

/** MyMemory acepta hasta 500 bytes por pedido. */
const MYMEMORY_MAX_BYTES = 450

/**
 * Parte el texto en trozos de hasta `maxBytes` (UTF-8), cortando en saltos de línea, frases o
 * espacios, en ese orden. Unidos con "" devuelven el texto original. Puro.
 */
export function splitForTranslation(text: string, maxBytes = MYMEMORY_MAX_BYTES): string[] {
  const bytes = (s: string) => new TextEncoder().encode(s).length
  const chunks: string[] = []
  let rest = text
  while (bytes(rest) > maxBytes) {
    // El prefijo más largo que cabe.
    let end = 0
    let size = 0
    for (const ch of rest) {
      const b = bytes(ch)
      if (size + b > maxBytes) break
      size += b
      end += ch.length
    }
    const head = rest.slice(0, end)
    const sentence = Math.max(...[".", "!", "?", "。", "！", "？"].map((p) => head.lastIndexOf(p)))
    const cut = [head.lastIndexOf("\n"), sentence, head.lastIndexOf(" ")].find((i) => i > end / 3)
    const at = cut !== undefined ? cut + 1 : end
    chunks.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  if (rest) chunks.push(rest)
  return chunks
}

async function translateWithGoogle(key: string, text: string, target: string): Promise<MessageTranslation | null> {
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
}

async function translateWithMyMemory(text: string, target: string): Promise<MessageTranslation | null> {
  const out: string[] = []
  let from = ""
  for (const chunk of splitForTranslation(text)) {
    // Los espacios y saltos de línea de los bordes se conservan tal cual.
    const lead = chunk.match(/^\s*/)?.[0] ?? ""
    const trail = chunk.match(/\s*$/)?.[0] ?? ""
    const core = chunk.trim()
    if (!core) {
      out.push(chunk)
      continue
    }
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(core)}&langpair=${encodeURIComponent(`Autodetect|${target}`)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) {
      console.error("[translate] MyMemory respondió", res.status)
      return null
    }
    const data = (await res.json()) as {
      responseStatus?: number | string
      quotaFinished?: boolean
      responseData?: { translatedText?: string; detectedLanguage?: string }
    }
    const translated = data.responseData?.translatedText
    // Cupo diario agotado o error: MyMemory lo avisa con un texto en mayúsculas, que no se guarda.
    if (Number(data.responseStatus) !== 200 || data.quotaFinished || !translated || /^MYMEMORY WARNING/i.test(translated)) {
      console.error("[translate] MyMemory sin traducción:", data.responseStatus)
      return null
    }
    if (!from) from = data.responseData?.detectedLanguage || ""
    out.push(lead + translated + trail)
  }
  if (from && sameLanguage(from, target)) return null
  const translatedText = out.join("")
  if (translatedText.trim() === text.trim()) return null
  return { text: translatedText, from, to: target }
}

export async function translateText(text: string, target: string): Promise<MessageTranslation | null> {
  if (!text.trim()) return null
  try {
    const key = process.env.GOOGLE_TRANSLATE_API_KEY
    if (key) return await translateWithGoogle(key, text, target)
    if (process.env.SUPPORT_TRANSLATION === "off") return null
    return await translateWithMyMemory(text, target)
  } catch (error) {
    console.error("[translate] No se pudo traducir:", error)
    return null
  }
}
