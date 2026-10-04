/**
 * Recetas en PDF (docs/149). Con pdf.js (Mozilla), servido desde /ocr/pdf (la CSP no
 * permite CDNs, ver scripts/copy-ocr-assets.mjs):
 *   - páginas con texto (PDF exportado de Word, de una web…): se extrae el texto tal cual,
 *     sin OCR — exacto e instantáneo;
 *   - páginas sin texto (PDF escaneado o foto guardada como PDF): se dibuja la página a
 *     buena resolución y pasa por el mismo OCR de las fotos, con detección de idioma.
 * Se leen hasta MAX_PAGES páginas (una receta rara vez ocupa más).
 */

import { recognizeWithLanguageCheck, type OcrLine } from "./ocr"

const MAX_PAGES = 6
const BASE = "/ocr/pdf"

export interface PdfReadResult {
  text: string
  /** Solo si alguna página pasó por OCR: para la revisión editable del diálogo. */
  ocr: { lines: OcrLine[]; confidence: number; lang: string; preview: Blob } | null
}

type PdfJs = typeof import("pdfjs-dist")

let pdfjsPromise: Promise<PdfJs> | null = null
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    // Versión "legacy": funciona también en Safari/Chrome de celulares no tan nuevos.
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.min.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.mjs`
      return mod
    })
  }
  return pdfjsPromise
}

/** Texto de una página, respetando los saltos de línea de pdf.js. */
function pageText(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let out = ""
  for (const item of items) {
    if (typeof item.str !== "string") continue
    out += item.str
    if (item.hasEOL) out += "\n"
  }
  return out.replace(/[ \t]+\n/g, "\n").trim()
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"))
}

export async function readRecipePdf(
  file: File,
  ocrLang: string,
  fallbackLatin: string,
  onProgress?: (p: number) => void,
): Promise<PdfReadResult> {
  const pdfjs = await loadPdfJs()
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${BASE}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${BASE}/wasm/`,
    enableXfa: false,
  })
  try {
    const doc = await task.promise
    const pages = Math.min(doc.numPages, MAX_PAGES)
    const texts: string[] = []
    let ocr = null as PdfReadResult["ocr"]
    let lang = ocrLang
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n)
      const text = pageText((await page.getTextContent()).items as Array<{ str?: string; hasEOL?: boolean }>)
      if (text.replace(/\s/g, "").length >= 20) {
        texts.push(text)
      } else {
        // Página escaneada: se dibuja con el lado mayor cerca de 2400 px y se lee con OCR.
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(4, 2400 / Math.max(base.width, base.height))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Canvas no disponible")
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        const blob = await canvasToBlob(canvas)
        const image = new File([blob], `page-${n}.png`, { type: "image/png" })
        const result = await recognizeWithLanguageCheck(image, lang, fallbackLatin, (p) =>
          onProgress?.((n - 1 + p) / pages),
        )
        lang = result.lang // las páginas siguientes ya usan el idioma detectado
        texts.push(result.text)
        ocr = ocr
          ? { ...ocr, lines: [...ocr.lines, ...result.lines], confidence: Math.min(ocr.confidence, result.confidence) }
          : { lines: result.lines, confidence: result.confidence, lang: result.lang, preview: blob }
      }
      page.cleanup()
      onProgress?.(n / pages)
    }
    return { text: texts.join("\n\n").trim(), ocr }
  } finally {
    await task.destroy()
  }
}
