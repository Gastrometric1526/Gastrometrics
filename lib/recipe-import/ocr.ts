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
