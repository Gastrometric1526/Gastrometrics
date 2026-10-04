// Copia a public/ocr lo que necesita el OCR del importador de recetas (docs/146), para
// servirlo desde la propia app (la CSP no permite CDNs y así funciona sin depender de
// terceros). Corre en `postinstall` y antes de `build`, también en Vercel, así que estos
// binarios no se versionan (public/ocr está en .gitignore).
//
//  - worker de tesseract.js
//  - núcleos WebAssembly solo-LSTM (sin SIMD, con SIMD y con SIMD relajado: tesseract.js
//    elige el más rápido que soporte el navegador)
//  - modelos "best_int" de cada idioma de la app (mismo modelo LSTM que "best", con pesos
//    enteros: precisión prácticamente igual y mucho más livianos para el celular)
//  - pdf.js (docs/149): worker, mapas de caracteres (texto de PDFs con fuentes CJK) y
//    decodificadores WebAssembly de imágenes JBIG2/JPEG 2000 (típicos de PDFs escaneados)

import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const nm = join(root, "node_modules")
const out = join(root, "public", "ocr")

const files = [
  [join(nm, "tesseract.js", "dist", "worker.min.js"), join(out, "worker.min.js")],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [
    join(nm, "tesseract.js-core", `tesseract-core-${v}.wasm.js`),
    join(out, "core", `tesseract-core-${v}.wasm.js`),
  ]),
  ...["spa", "eng", "por", "fra", "dan", "chi_sim"].map((lang) => [
    join(nm, "@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`),
    join(out, "lang", `${lang}.traineddata.gz`),
  ]),
  [join(nm, "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs"), join(out, "pdf", "pdf.worker.min.mjs")],
  ...["jbig2.wasm", "jbig2_nowasm_fallback.js", "openjpeg.wasm", "openjpeg_nowasm_fallback.js", "qcms_bg.wasm"].map((f) => [
    join(nm, "pdfjs-dist", "wasm", f),
    join(out, "pdf", "wasm", f),
  ]),
  ...(existsSync(join(nm, "pdfjs-dist", "cmaps"))
    ? readdirSync(join(nm, "pdfjs-dist", "cmaps"))
        .filter((f) => f.endsWith(".bcmap"))
        .map((f) => [join(nm, "pdfjs-dist", "cmaps", f), join(out, "pdf", "cmaps", f)])
    : []),
]

let copied = 0
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.warn(`[copy-ocr-assets] Falta ${from} (¿npm install incompleto?). El OCR no funcionará.`)
    continue
  }
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  copied++
}
console.log(`[copy-ocr-assets] ${copied}/${files.length} archivos del OCR en public/ocr`)
