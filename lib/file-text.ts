/**
 * Cualquier formato de documento (pedido del dueño, docs/345): «deja que el sistema acepte
 * cualquier formato de documentación». Cada importador sigue con su lector (fotos y PDF con
 * OCR, hojas de cálculo con SheetJS); aquí se agrega lo que faltaba:
 * - Word (.docx, .docm, .dotx) y OpenDocument texto (.odt): se lee el XML del archivo
 *   (jszip), con párrafos como líneas y las celdas de una tabla separadas por tabulador;
 * - RTF, HTML, JSON, Markdown, XML y cualquier texto plano;
 * - lo que no se puede leer (un binario desconocido o un .doc viejo) da un error claro.
 */

export type DocumentKind = "image" | "pdf" | "spreadsheet" | "word" | "text"

/** Extensiones que entiende SheetJS (Excel, OpenDocument, Numbers, CSV…). */
const SPREADSHEET_EXT = /\.(xlsx|xlsm|xlsb|xls|xltx|xltm|ods|fods|numbers|csv|tsv|dbf|slk|sylk|prn|dif)$/i
const WORD_EXT = /\.(docx|docm|dotx|dotm|odt|ott|rtf)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?|avif|heic|heif)$/i

export function documentKind(file: { name?: string; type?: string }): DocumentKind {
  const name = (file.name || "").toLowerCase()
  const type = (file.type || "").toLowerCase()
  if (type.startsWith("image/") || IMAGE_EXT.test(name)) return "image"
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf"
  if (SPREADSHEET_EXT.test(name) || type.includes("spreadsheet") || type.includes("ms-excel") || type === "text/csv") return "spreadsheet"
  if (WORD_EXT.test(name) || type.includes("wordprocessingml") || type.includes("opendocument.text") || type.includes("rtf")) return "word"
  return "text"
}

export class UnreadableDocumentError extends Error {
  constructor(public readonly fileName: string) {
    super(`unreadable: ${fileName}`)
    this.name = "UnreadableDocumentError"
  }
}

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")

const tidy = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/[ \u00a0]+/g, " ").replace(/ *\t */g, "\t").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

/** XML de Word (word/document.xml): párrafos → líneas; celdas de tabla → tabulador. */
export function wordXmlToText(xml: string): string {
  const out = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
  // Una celda termina en «párrafo + tabulador»: se deja solo el tabulador.
  return tidy(decodeEntities(out.replace(/\n\t/g, "\t").replace(/\t\n/g, "\n")))
}

/** XML de OpenDocument texto (content.xml). */
export function odtXmlToText(xml: string): string {
  const out = xml
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:s(?: text:c="(\d+)")?\/>/g, (_, n) => " ".repeat(Number(n) || 1))
    .replace(/<\/table:table-cell>/g, "\t")
    .replace(/<\/table:table-row>/g, "\n")
    .replace(/<\/text:(p|h)>/g, "\n")
    .replace(/<[^>]+>/g, "")
  return tidy(decodeEntities(out.replace(/\n\t/g, "\t").replace(/\t\n/g, "\n")))
}

/** HTML → texto (tablas con tabulador entre celdas). */
export function htmlToText(html: string): string {
  const out = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<\/(p|div|li|tr|h[1-6]|table|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
  return tidy(decodeEntities(out.replace(/\t\n/g, "\n")))
}

/** RTF → texto (lo básico: párrafos, tabuladores, celdas y caracteres acentuados). */
export function rtfToText(rtf: string): string {
  let s = rtf
    .replace(/\{\\\*[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "") // grupos ocultos (\*)
    .replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*(?=\\|\{|$)/g, "")
  s = s
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\(par|line)\b ?/g, "\n")
    .replace(/\\row\b ?/g, "\n")
    .replace(/\\(tab|cell)\b ?/g, "\t")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/\\([{}\\])/g, "$1")
    .replace(/[{}]/g, "")
  return tidy(s.replace(/\t\n/g, "\n"))
}

/** ¿Parece texto legible? (no un binario: pocos caracteres de control). */
export function looksLikeText(s: string): boolean {
  if (!s.trim()) return false
  const sample = s.slice(0, 4000)
  let bad = 0
  for (const ch of sample) {
    const c = ch.charCodeAt(0)
    if (c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13)) bad++
  }
  return bad / sample.length < 0.02
}

/**
 * Texto de un documento que no es foto, PDF ni hoja de cálculo. Lanza
 * `UnreadableDocumentError` si no se puede leer.
 */
export async function documentText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (/\.(docx|docm|dotx|dotm|odt|ott)$/.test(name) || file.type.includes("wordprocessingml") || file.type.includes("opendocument.text")) {
    try {
      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const word = zip.file("word/document.xml")
      if (word) return wordXmlToText(await word.async("string"))
      const odt = zip.file("content.xml")
      if (odt) return odtXmlToText(await odt.async("string"))
    } catch {
      // cae al error de abajo
    }
    throw new UnreadableDocumentError(file.name)
  }
  const raw = await file.text()
  if (name.endsWith(".rtf") || raw.startsWith("{\\rtf")) return rtfToText(raw)
  if (/\.(html?|xhtml)$/.test(name) || /^\s*<(!doctype html|html)/i.test(raw)) return htmlToText(raw)
  if (!looksLikeText(raw)) throw new UnreadableDocumentError(file.name)
  if (/\.(xml)$/.test(name)) return tidy(decodeEntities(raw.replace(/<[^>]+>/g, "\n")))
  return raw
}
