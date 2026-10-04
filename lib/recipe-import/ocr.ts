/**
 * Leer una receta desde una foto (OCR) — docs/146. Corre 100 % en el navegador con
 * tesseract.js (motor LSTM de Tesseract 5 en WebAssembly); la foto nunca sale del
 * dispositivo. Archivos servidos desde la propia app (public/ocr, ver
 * scripts/copy-ocr-assets.mjs): worker, núcleo solo-LSTM y modelos "best_int".
 *
 * Para la precisión, antes de reconocer se prepara la imagen:
 *   1. se respeta la orientación EXIF de la cámara (fotos de celular giradas);
 *   2. se escala a un tamaño en que Tesseract rinde mejor (lado mayor 2000–3200 px:
 *      amplía las fotos chicas y reduce las enormes);
 *   3. se pasa a escala de grises y se estira el contraste (percentiles 1–99 %), para
 *      que el papel quede blanco y la tinta negra aunque la luz sea mala.
 * Devuelve también la confianza de cada línea: el diálogo marca las dudosas para que la
 * persona las revise y corrija antes de convertir el texto en receta.
 */

import { createWorker, OEM, PSM } from "tesseract.js"

export const OCR_AVAILABLE = true

/** Idioma del OCR (código de Tesseract) para cada idioma de la app. */
export const OCR_LANG: Record<string, string> = { es: "spa", en: "eng", pt: "por", fr: "fra", da: "dan", zh: "chi_sim" }

export interface OcrLine {
  text: string
  confidence: number // 0–100
}

export interface OcrResult {
  text: string
  lines: OcrLine[]
  confidence: number // promedio de la página, 0–100
}

/** Líneas que conviene revisar (confianza baja). */
export const LOW_CONFIDENCE = 70

// Palabras típicas de receta por idioma, para notar que la foto está en otro idioma
// del elegido (docs/148). Sin tildes y en minúsculas.
const LANG_WORDS: Record<string, string[]> = {
  spa: ["ingredientes", "preparacion", "procedimiento", "porciones", "cucharada", "cucharadas", "taza", "tazas", "cebolla", "ajo", "sal", "pimienta", "agregar", "cocinar", "minutos", "y", "con", "del"],
  por: ["ingredientes", "preparo", "porcoes", "colher", "colheres", "xicara", "xicaras", "cebola", "alho", "sal", "acrescente", "cozinhe", "minutos", "e", "com", "do", "da"],
  eng: ["ingredients", "method", "directions", "serves", "cup", "cups", "tbsp", "tsp", "onion", "garlic", "salt", "add", "cook", "minutes", "and", "the", "with"],
  fra: ["ingredients", "preparation", "personnes", "cuillere", "soupe", "tasse", "oignon", "ail", "sel", "ajouter", "cuire", "minutes", "et", "le", "la", "les", "avec"],
  dan: ["ingredienser", "fremgangsmade", "portioner", "spsk", "tsk", "dl", "log", "hvidlog", "salt", "tilsaet", "kog", "minutter", "og", "med", "i"],
}

/**
 * Idioma más probable del texto leído (código de Tesseract), o null si no hay señales
 * claras. El chino se reconoce por la proporción de caracteres chinos.
 */
export function detectRecipeLanguage(text: string): string | null {
  const cjk = (text.match(/[一-鿿]/g) ?? []).length
  const letters = (text.match(/\p{L}/gu) ?? []).length
  if (letters > 10 && cjk / letters > 0.3) return "chi_sim"
  const words = new Set(
    text
      .toLowerCase()
      .replace(/ø/g, "o")
      .replace(/æ/g, "ae")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z]+/)
      .filter(Boolean),
  )
  let best: string | null = null
  let bestScore = 0
  let second = 0
  for (const [lang, list] of Object.entries(LANG_WORDS)) {
    const score = list.filter((w) => words.has(w)).length
    if (score > bestScore) {
      second = bestScore
      bestScore = score
      best = lang
    } else if (score > second) second = score
  }
  return bestScore >= 3 && bestScore >= second + 2 ? best : null
}

/**
 * Lee la foto y, si hace falta, vuelve a leerla con otro idioma: con confianza baja se
 * prueba el otro alfabeto (latino ↔ chino), y si el texto delata otro idioma se relee con
 * ese modelo. Se queda con la lectura de mayor confianza. Así una receta en inglés o en
 * chino se lee bien aunque la persona no haya cambiado el idioma (docs/148).
 */
export async function recognizeWithLanguageCheck(
  file: File,
  ocrLang: string,
  fallbackLatin: string,
  onProgress?: (p: number) => void,
): Promise<OcrResult & { lang: string }> {
  // La primera lectura ocupa el 80 % de la barra; las relecturas (si hacen falta), el resto.
  const step = (i: number) => (p: number) => onProgress?.(i === 0 ? p * 0.8 : 0.8 + (i - 1) * 0.1 + p * 0.1)
  let best = { ...(await recognizeRecipeImage(file, ocrLang, step(0))), lang: ocrLang }
  const tried = new Set([ocrLang])
  const tryLang = async (lang: string, i: number) => {
    if (tried.has(lang)) return
    tried.add(lang)
    const r = await recognizeRecipeImage(file, lang, step(i))
    if (r.confidence > best.confidence) best = { ...r, lang }
  }
  if (best.confidence < 65) await tryLang(ocrLang === "chi_sim" ? fallbackLatin : "chi_sim", 1)
  const detected = detectRecipeLanguage(best.text)
  if (detected && best.confidence < 90) await tryLang(detected, 2)
  onProgress?.(1)
  return best
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

/**
 * Decodifica la foto respetando la orientación EXIF. Safari antiguo (iOS < 15) no acepta
 * opciones en createImageBitmap: ahí se usa un <img>, que los navegadores actuales ya
 * dibujan con la orientación EXIF aplicada.
 */
async function decodeImage(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  }
}

async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await decodeImage(file)
  const longSide = Math.max(bitmap.width, bitmap.height)
  const scale = longSide < 2000 ? 2000 / longSide : longSide > 3200 ? 3200 / longSide : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas no disponible")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap.source, 0, 0, width, height)
  bitmap.release()

  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data
  const gray = new Uint8ClampedArray(width * height)
  const histogram = new Uint32Array(256)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    gray[j] = g
    histogram[g]++
  }
  // Estirar contraste entre los percentiles 1 y 99
  const total = width * height
  let low = 0
  let high = 255
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += histogram[v]
    if (acc >= total * 0.01) {
      low = v
      break
    }
  }
  for (let acc = 0, v = 255; v >= 0; v--) {
    acc += histogram[v]
    if (acc >= total * 0.01) {
      high = v
      break
    }
  }
  const range = Math.max(1, high - low)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, ((gray[j] - low) * 255) / range))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export async function recognizeRecipeImage(file: File, ocrLang: string, onProgress?: (p: number) => void): Promise<OcrResult> {
  const lang = Object.values(OCR_LANG).includes(ocrLang) ? ocrLang : "spa"
  onProgress?.(0.02)
  const canvas = await prepareImage(file)
  onProgress?.(0.08)
  const worker = await createWorker(lang, OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    gzip: true,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(0.1 + m.progress * 0.9)
    },
  })
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    })
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
    const lines: OcrLine[] = []
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          const text = line.text.replace(/\s+$/, "")
          if (text.trim()) lines.push({ text, confidence: Math.round(line.confidence) })
        }
        lines.push({ text: "", confidence: 100 }) // separa párrafos (secciones de la receta)
      }
    }
    const text = lines.length ? lines.map((l) => l.text).join("\n").replace(/\n{3,}/g, "\n\n").trim() : data.text.trim()
    onProgress?.(1)
    return { text, lines: lines.filter((l) => l.text.trim()), confidence: Math.round(data.confidence) }
  } finally {
    await worker.terminate()
  }
}
