/**
 * Tipografía china para los PDF (docs/141). jsPDF solo trae Helvetica/Times/Courier,
 * que no tienen caracteres chinos: con la app en 中文 todos los PDF salían con símbolos
 * ilegibles. Acá se registra Noto Sans SC (OFL, de github.com/google/fonts) en cada
 * documento nuevo y se redirige a ella todo `setFont("helvetica" | "times" | "courier")`,
 * incluido el de jspdf-autotable — así ningún generador de PDF tuvo que cambiar.
 *
 * public/fonts/NotoSansSC-Regular-subset.ttf: instancia estática de peso 400, recortada a
 * GB2312 completo (6 763 caracteres, >99.9 % del chino simplificado real) + todo carácter
 * no ASCII de los textos de la app + latín, puntuación y símbolos. 2.3 MB (la original
 * pesa 17.8 MB). jsPDF incrusta en cada PDF solo los caracteres usados.
 *
 * Se descarga solo cuando el idioma es chino (LanguageProvider llama a
 * setPdfCjkMode). Una sola variante de peso: el "bold" se ve como regular en chino.
 */

import { jsPDF } from "jspdf"

export const CJK_FONT_NAME = "NotoSansSC"
const CJK_FONT_FILE = "NotoSansSC-Regular-subset.ttf"
const CJK_FONT_URL = `/fonts/${CJK_FONT_FILE}`
const STANDARD_FONTS = new Set(["helvetica", "times", "courier"])

let fontBinary: string | null = null
let loading: Promise<void> | null = null
let enabled = false

function toBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return out
}

/** Descarga la fuente una sola vez (se reusa entre PDF). */
export function ensureCjkPdfFont(): Promise<void> {
  if (fontBinary) return Promise.resolve()
  if (!loading) {
    loading = fetch(CJK_FONT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        fontBinary = toBinaryString(buffer)
      })
      .catch((error) => {
        loading = null // se reintenta la próxima vez
        console.error("[pdf-cjk-font] No se pudo cargar la tipografía china:", error)
      })
  }
  return loading
}

/** La activa (y la descarga) con la app en chino; la apaga en cualquier otro idioma. */
export function setPdfCjkMode(on: boolean): void {
  enabled = on
  if (on) void ensureCjkPdfFont()
}

/** Solo para pruebas: inyecta la fuente sin pasar por fetch. */
export function __setCjkFontBinaryForTests(binary: string | null): void {
  fontBinary = binary
}

export function isCjkPdfFontActive(): boolean {
  return enabled && fontBinary !== null
}

type DocWithFonts = jsPDF & { __cjkPatched?: boolean }

jsPDF.API.events.push([
  "initialized",
  function (this: DocWithFonts) {
    if (!isCjkPdfFontActive() || this.__cjkPatched) return
    this.__cjkPatched = true
    this.addFileToVFS(CJK_FONT_FILE, fontBinary as string)
    for (const style of ["normal", "bold", "italic", "bolditalic"]) {
      this.addFont(CJK_FONT_FILE, CJK_FONT_NAME, style)
    }
    const originalSetFont = this.setFont.bind(this)
    this.setFont = ((fontName: string, fontStyle?: string, fontWeight?: string | number) =>
      originalSetFont(
        STANDARD_FONTS.has(String(fontName).toLowerCase()) ? CJK_FONT_NAME : fontName,
        fontStyle,
        fontWeight,
      )) as jsPDF["setFont"]
    this.setFont(CJK_FONT_NAME, "normal")
  },
])
