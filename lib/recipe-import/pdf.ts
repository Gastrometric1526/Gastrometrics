/**
 * Recetas en PDF (docs/149, docs/151). Con pdf.js (Mozilla), servido desde /ocr/pdf (la
 * CSP no permite CDNs, ver scripts/copy-ocr-assets.mjs).
 *
 * En las pruebas con PDFs reales de fichas técnicas (docs/151) los PDF resultaron ser
 * recetarios de 20 a 70 páginas, con portada, introducción e índice primero. Por eso:
 *   - se extrae el texto de todas las páginas (hasta MAX_TEXT_PAGES; es instantáneo);
 *   - se elige sola la primera página que de verdad tiene una receta (2+ ingredientes),
 *     y el diálogo deja cambiar de página con el título de cada una;
 *   - una página sin texto (escaneada) se dibuja a buena resolución y pasa por el mismo
 *     OCR de las fotos, con detección de idioma, solo cuando se elige.
 */

import { recognizeWithLanguageCheck, type OcrLine, type OcrOptions } from "./ocr"
import { parseRecipeText } from "./parse-recipe"

const MAX_TEXT_PAGES = 120
const BASE = "/ocr/pdf"

export interface PdfPageInfo {
  number: number // 1..n
  text: string | null // null: página escaneada (necesita OCR)
  title: string // para el selector de páginas
  ingredientCount: number // ingredientes con cantidad y unidad
}

export interface PdfDocumentInfo {
  pages: PdfPageInfo[]
  totalPages: number
  suggested: number // página sugerida (1..n)
  /** "sheet": hojas de un libro de Excel con una receta cada una (docs/152) */
  kind?: "pdf" | "sheet"
}

export interface PdfOcrPage {
  text: string
  lines: OcrLine[]
  confidence: number
  lang: string
  preview: Blob
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

async function openTask(file: File) {
  const pdfjs = await loadPdfJs()
  return pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${BASE}/cmaps/`,
    cMapPacked: true,
    wasmUrl: `${BASE}/wasm/`,
    enableXfa: false,
  })
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

/** Lee el texto de todas las páginas y sugiere la primera con una receta. */
export async function openRecipePdf(file: File, onProgress?: (p: number) => void): Promise<PdfDocumentInfo> {
  const task = await openTask(file)
  try {
    const doc = await task.promise
    const count = Math.min(doc.numPages, MAX_TEXT_PAGES)
    const pages: PdfPageInfo[] = []
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n)
      const text = pageText((await page.getTextContent()).items as Array<{ str?: string; hasEOL?: boolean }>)
      page.cleanup()
      if (text.replace(/\s/g, "").length < 20) {
        pages.push({ number: n, text: null, title: "", ingredientCount: 0 })
      } else {
        const parsed = parseRecipeText(text)
        const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? ""
        // Ingredientes "reales": con cantidad y unidad. Las páginas de explicación o índice
        // también dan líneas sueltas que parecen ingredientes, pero sin unidad.
        const real = parsed.ingredients.filter((i) => i.quantity > 0 && i.dimension && i.unitLabel).length
        pages.push({ number: n, text, title: (parsed.name || firstLine).slice(0, 60), ingredientCount: real })
      }
      onProgress?.(n / count)
    }
    const withRecipe = pages.find((p) => p.ingredientCount >= 3) ?? [...pages].sort((a, b) => b.ingredientCount - a.ingredientCount).find((p) => p.ingredientCount > 0)
    const withText = pages.find((p) => p.text)
    return { pages, totalPages: doc.numPages, suggested: (withRecipe ?? withText ?? pages[0])?.number ?? 1 }
  } finally {
    await task.destroy()
  }
}

/** OCR de una página escaneada (se dibuja con el lado mayor cerca de 2400 px). */
export async function ocrPdfPage(
  file: File,
  number: number,
  ocrLang: string,
  fallbackLatin: string,
  onProgress?: (p: number) => void,
  options: OcrOptions = {},
): Promise<PdfOcrPage> {
  const task = await openTask(file)
  try {
    const doc = await task.promise
    const page = await doc.getPage(number)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(4, 2400 / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas no disponible")
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    page.cleanup()
    const preview = await canvasToBlob(canvas)
    const image = new File([preview], `page-${number}.png`, { type: "image/png" })
    const result = await recognizeWithLanguageCheck(image, ocrLang, fallbackLatin, onProgress, options)
    return { text: result.text, lines: result.lines, confidence: result.confidence, lang: result.lang, preview }
  } finally {
    await task.destroy()
  }
}
