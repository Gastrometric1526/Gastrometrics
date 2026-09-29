/**
 * Genera el manual de usuario en PDF, en los 6 idiomas, a partir de manual/content/{lang}.mjs.
 *
 *   cd manual && npm install && node scripts/build.mjs [es,en,...]
 *
 * Salida: ../lib/assets/manual-{lang}.pdf (lo sirve app/api/manual/route.ts) y una copia
 * de revisión en manual/out/. Requiere Chrome instalado (CHROME_PATH para otra ruta) y
 * conexión a internet para las fuentes (Google Fonts: DM Sans / Noto Sans SC).
 *
 * Pasos por idioma:
 *   1. Verifica que el contenido tenga EXACTAMENTE la misma estructura que el español
 *      (mismos capítulos, bloques y cantidad de filas/pasos) — así una traducción
 *      incompleta rompe el build en vez de publicarse a medias.
 *   2. Renderiza el cuerpo una vez, busca en qué página cae cada capítulo (texto marcador
 *      invisible, leído con pdf.js) y vuelve a renderizar con los números en el índice.
 *   3. Renderiza la portada aparte (sin pie de página) y une ambas con pdf-lib.
 */
import puppeteer from "puppeteer-core"
import { PDFDocument } from "pdf-lib"
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const OUT_DIR = path.join(ROOT, "out")
const ASSETS_DIR = path.join(ROOT, "..", "lib", "assets")
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const LANGS = (process.argv[2] || "es,en,da,fr,pt,zh").split(",")
const CSS = readFileSync(path.join(ROOT, "theme", "manual.css"), "utf-8")
const LOGO = `data:image/png;base64,${readFileSync(path.join(ROOT, "theme", "logo.png")).toString("base64")}`
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800&family=Noto+Sans+SC:wght@400;600;700;800&display=block" rel="stylesheet">'

// ───────────────────────── validación de estructura ─────────────────────────

function shape(content) {
  return content.chapters.map((ch) => ({
    id: ch.id,
    plan: !!ch.plan,
    blocks: ch.blocks.map((b) => {
      const [type, ...args] = b
      const size = args.find((a) => Array.isArray(a))?.length ?? 0
      return `${type}:${size}`
    }),
  }))
}

function assertSameShape(lang, content, reference) {
  const a = JSON.stringify(shape(content))
  const b = JSON.stringify(shape(reference))
  if (a === b) return
  const sa = shape(content)
  const sb = shape(reference)
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (JSON.stringify(sa[i]) !== JSON.stringify(sb[i])) {
      const ca = sa[i]?.blocks ?? []
      const cb = sb[i]?.blocks ?? []
      const j = ca.findIndex((x, k) => x !== cb[k])
      throw new Error(
        `[${lang}] El capítulo ${sb[i]?.id ?? sa[i]?.id} no coincide con el español (bloque ${j}: "${ca[j]}" vs "${cb[j]}").`,
      )
    }
  }
  const missingUi = Object.keys(reference.ui).filter((k) => !(k in content.ui))
  if (missingUi.length) throw new Error(`[${lang}] Faltan textos de interfaz: ${missingUi.join(", ")}`)
}

// ───────────────────────── render de bloques ─────────────────────────

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function formulaExpr(line) {
  // Resalta operadores de una expresión escrita en lenguaje natural. El ÷ lleva además la
  // clase "div": en DM Sans sus puntos son diminutos y, impreso en naranja y negrita, se leía
  // como "+" (un lector externo del PDF reportó las divisiones como sumas — docs/140).
  return esc(line)
    .replace(/(\s)([=×+−])(\s)/g, '$1<span class="op">$2</span>$3')
    .replace(/(\s)÷(\s)/g, '$1<span class="op div">÷</span>$2')
}

// Mismo ÷ legible dentro de tablas y ejemplos (texto normal, sin resaltar en naranja).
const divSign = (html) => String(html).replace(/(\s)÷(\s)/g, '$1<span class="div">÷</span>$2')

let figureCounter = 0

// Espacio no separable antes de % y entre número y unidad corta, para que "24 %" o
// "300 g" nunca queden partidos entre dos líneas.
function nbsp(value) {
  if (typeof value === "string") return value.replace(/(\d) (%|g|kg|ml|L)(?=[\s.,;:)<]|$)/g, "$1 $2")
  if (Array.isArray(value)) return value.map(nbsp)
  return value
}

function renderBlock(rawBlock, ctx) {
  const block = rawBlock.map(nbsp)
  const [type, ...a] = block
  switch (type) {
    case "p":
      return `<p>${a[0]}</p>`
    case "h3":
      return `<h3>${a[0]}</h3>`
    case "list":
      return `<ul class="list">${a[0].map((li) => `<li>${li}</li>`).join("")}</ul>`
    case "steps":
      return `<ol class="steps">${a[0].map((li) => `<li>${li}</li>`).join("")}</ol>`
    case "tip":
    case "warn":
    case "info": {
      const icon = { tip: "✓", warn: "!", info: "i" }[type]
      return `<div class="callout ${type}"><span class="icon">${icon}</span><div><span class="title">${a[0]}</span><p>${a[1]}</p></div></div>`
    }
    case "formula": {
      const [label, lines, explain] = a
      return `<div class="formula"><div class="label">${label}</div><div class="expr">${lines
        .map(formulaExpr)
        .join("<br>")}</div>${explain ? `<div class="explain">${explain}</div>` : ""}</div>`
    }
    case "example": {
      const [label, rows] = a
      return `<div class="example"><div class="label">${label}</div>${rows
        .map(([k, v, total]) => `<div class="row${total ? " total" : ""}"><span>${divSign(k)}</span><span>${divSign(v)}</span></div>`)
        .join("")}</div>`
    }
    case "table": {
      const [headers, rows] = a
      // Tablas cortas (≤ 8 filas) nunca se parten entre páginas; las largas sí, repitiendo el encabezado.
      return `<table class="tbl${rows.length <= 8 ? " keep" : ""}"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${divSign(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    }
    case "chips":
      return `<div class="chips">${a[0].map((c) => `<span>${c}</span>`).join("")}</div>`
    case "cards": {
      const cards = a[0]
      return `<div class="cards${cards.length === 3 ? " three" : ""}">${cards
        .map(([tag, title, body]) => `<div class="card">${tag ? `<div class="card-tag">${tag}</div>` : ""}<div class="card-title">${title}</div><p>${body}</p></div>`)
        .join("")}</div>`
    }
    case "figure": {
      const [file, caption] = a
      figureCounter++
      const shotPath = path.join(ROOT, "shots", ctx.lang, file)
      const fallback = path.join(ROOT, "shots", "es", file)
      const src = existsSync(shotPath) ? shotPath : fallback
      // Una captura en blanco (página aún compilando) pesa ~17 KB: nunca publicarla.
      if (statSync(src).size < 40000) throw new Error(`Captura en blanco: ${src} — vuelve a tomarla (ver LEEME.md).`)
      const data = `data:image/jpeg;base64,${readFileSync(src).toString("base64")}`
      return `<figure class="shot"><div class="frame"><div class="bar"><i></i><i></i><i></i></div><img src="${data}" alt=""></div><figcaption><b>${ctx.ui.figure} ${figureCounter}</b>${caption}</figcaption></figure>`
    }
    case "flow":
      return renderFlow(a[0])
    default:
      throw new Error(`Bloque desconocido: ${type}`)
  }
}

function renderFlow(labels) {
  // labels: [ingredientes, recetas, menus, compras, subrecetas, inventario, ventas, reportes, nota]
  const box = (x, y, w, title, sub, tone) => {
    const tones = {
      brand: ["#fff1ea", "#f05324", "#c8390e"],
      plain: ["#faf7f5", "#d9d0c9", "#17120f"],
      good: ["#eaf5ef", "#1f7a52", "#1f7a52"],
    }[tone]
    return `<rect x="${x}" y="${y}" width="${w}" height="58" rx="10" fill="${tones[0]}" stroke="${tones[1]}" stroke-width="1.4"/>
      <text x="${x + w / 2}" y="${y + 25}" text-anchor="middle" font-size="14" font-weight="700" fill="${tones[2]}">${esc(title)}</text>
      <text x="${x + w / 2}" y="${y + 43}" text-anchor="middle" font-size="10.5" fill="#7a706a">${esc(sub)}</text>`
  }
  const [ing, rec, men, com, sub, inv, ven, rep, note] = labels
  return `<div class="flow"><svg viewBox="0 0 900 250" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, Noto Sans SC, sans-serif">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7a706a"/></marker></defs>
    ${box(10, 20, 160, ing[0], ing[1], "plain")}
    ${box(250, 20, 170, rec[0], rec[1], "brand")}
    ${box(500, 20, 160, men[0], men[1], "plain")}
    ${box(730, 20, 160, com[0], com[1], "plain")}
    ${box(250, 170, 170, sub[0], sub[1], "good")}
    ${box(10, 170, 160, inv[0], inv[1], "plain")}
    ${box(500, 170, 160, ven[0], ven[1], "plain")}
    ${box(730, 170, 160, rep[0], rep[1], "brand")}
    <path d="M170,49 H250" stroke="#7a706a" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M420,49 H500" stroke="#7a706a" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M660,49 H730" stroke="#7a706a" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M335,78 V170" stroke="#1f7a52" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M250,199 C 210,199 210,90 172,70" stroke="#1f7a52" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M90,170 V80" stroke="#7a706a" stroke-width="1.6" stroke-dasharray="5 4" fill="none" marker-end="url(#ah)"/>
    <path d="M660,199 H730" stroke="#7a706a" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <path d="M400,78 C 430,130 520,150 560,170" stroke="#7a706a" stroke-width="1.6" fill="none" marker-end="url(#ah)"/>
    <text x="450" y="244" text-anchor="middle" font-size="10.5" fill="#7a706a">${esc(note)}</text>
  </svg></div>`
}

// ───────────────────────── documento ─────────────────────────

function renderToc(content, pages) {
  const { ui, chapters } = content
  const items = chapters
    .map((ch, i) => {
      const subs = ch.blocks.filter((b) => b[0] === "h3").map((b) => b[1].replace(/<[^>]+>/g, ""))
      const num = ch.appendix ? ch.appendix : String(i + 1).padStart(2, "0")
      return `<li class="${ch.appendix ? "toc-appendix" : ""}"><span class="toc-num">${num}</span><span class="toc-title">${ch.title}<span class="toc-subs">${subs.join(" · ")}</span></span><span class="toc-page">${pages?.[ch.id] ?? "00"}</span></li>`
    })
    .join("")
  return `<section class="toc"><div class="toc-kicker">${ui.manualName}</div><h1>${ui.contents}</h1><p class="toc-lede">${ui.contentsLede}</p><ol class="toc-list">${items}</ol></section>`
}

// Cada h3 se agrupa con el bloque que le sigue en un contenedor que no se parte, para
// que un subtítulo nunca quede solo al pie de una página. Capturas y tablas no se agrupan
// (empujarían bloques enormes a la página siguiente).
function renderBlocksKeepingHeadings(blocks, ctx) {
  const out = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const next = blocks[i + 1]
    const groupable = next && ["p", "list", "steps", "formula", "tip", "warn", "info", "chips", "example"].includes(next[0])
    if (block[0] === "h3" && groupable) {
      out.push(`<div class="keep-with-next">${renderBlock(block, ctx)}${renderBlock(next, ctx)}</div>`)
      i++
    } else {
      out.push(renderBlock(block, ctx))
    }
  }
  return out.join("\n")
}

function renderChapter(ch, index, ctx) {
  const num = ch.appendix ? ch.appendix : String(index + 1).padStart(2, "0")
  const subs = ch.blocks.filter((b) => b[0] === "h3").map((b) => b[1])
  const aside = subs.length
    ? `<div class="chapter-aside"><div class="kicker">${ctx.ui.inThisChapter}</div><ol>${subs.map((s) => `<li>${s}</li>`).join("")}</ol></div>`
    : "<div></div>"
  return `<section class="chapter" id="${ch.id}"><span class="marker">@@CH-${ch.id}@@</span>
    <header class="chapter-head"><div>
      <div class="chapter-num">${num}</div>
      ${ch.plan ? `<span class="plan-badge">${ch.plan}</span>` : ""}
      <h2>${ch.title}</h2>
      <p class="chapter-intro">${ch.intro}</p>
    </div>${aside}</header>
    ${renderBlocksKeepingHeadings(ch.blocks, ctx)}
  </section>`
}

function bodyHtml(lang, content, pages) {
  figureCounter = 0
  const ctx = { lang, ui: content.ui }
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${content.ui.manualName}</title>${FONTS}<style>${CSS}</style></head><body>
    ${renderToc(content, pages)}
    ${content.chapters.map((ch, i) => renderChapter(ch, i, ctx)).join("\n")}
  </body></html>`
}

function coverHtml(lang, content) {
  const { ui } = content
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8">${FONTS}<style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "DM Sans", "Noto Sans SC", sans-serif; }
    .cover { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #f05324; color: #fff; }
    .ring { position: absolute; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.18); }
    .r1 { width: 250mm; height: 250mm; right: -120mm; top: -70mm; }
    .r2 { width: 180mm; height: 180mm; right: -85mm; top: -35mm; }
    .r3 { width: 110mm; height: 110mm; right: -50mm; top: 0mm; background: rgba(255,255,255,.07); border: 0; }
    .brand { position: absolute; left: 22mm; top: 24mm; display: flex; align-items: center; gap: 12px; font-size: 17pt; font-weight: 800; letter-spacing: -.02em; }
    .brand img { width: 44px; height: 44px; border-radius: 50%; background: #fff; }
    .main { position: absolute; left: 22mm; right: 22mm; top: 112mm; }
    .kicker { font-size: 9pt; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; opacity: .85; margin-bottom: 14px; }
    h1 { font-size: 52pt; line-height: .98; letter-spacing: -.035em; margin: 0 0 18px; font-weight: 800; }
    .lede { font-size: 13.5pt; line-height: 1.45; max-width: 128mm; opacity: .95; margin: 0; }
    .modules { position: absolute; left: 22mm; right: 22mm; bottom: 44mm; display: flex; flex-wrap: wrap; gap: 7px; }
    .modules span { font-size: 9pt; font-weight: 600; padding: 4px 11px; border-radius: 999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); }
    .foot { position: absolute; left: 22mm; right: 22mm; bottom: 20mm; display: flex; justify-content: space-between; font-size: 9pt; font-weight: 600; opacity: .9; border-top: 1px solid rgba(255,255,255,.35); padding-top: 10px; }
  </style></head><body><div class="cover">
    <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
    <div class="brand"><img src="${LOGO}" alt="">Gastrometrics</div>
    <div class="main"><div class="kicker">${ui.coverKicker}</div><h1>${ui.coverTitle}</h1><p class="lede">${ui.coverLede}</p></div>
    <div class="modules">${ui.coverModules.map((m) => `<span>${m}</span>`).join("")}</div>
    <div class="foot"><span>${ui.edition}</span><span>gastrometrics.org</span></div>
  </div></body></html>`
}

function footerTemplate(content) {
  return `<div style="width:100%;font-family:'DM Sans','Noto Sans SC',Arial,sans-serif;font-size:7.5pt;color:#9a908a;padding:0 18mm;display:flex;justify-content:space-between;align-items:center;">
    <span><span style="color:#f05324;font-weight:700;">Gastrometrics</span> · ${esc(content.ui.manualName)}</span>
    <span style="font-weight:700;color:#3d3531;"><span class="pageNumber"></span></span></div>`
}

async function findChapterPages(pdfBuffer, chapters) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), disableFontFace: true }).promise
  const pages = {}
  for (let p = 1; p <= doc.numPages; p++) {
    const text = (await (await doc.getPage(p)).getTextContent()).items.map((i) => i.str).join("")
    for (const ch of chapters) {
      if (!pages[ch.id] && text.includes(`@@CH-${ch.id}@@`)) pages[ch.id] = p
    }
  }
  const missing = chapters.filter((c) => !pages[c.id]).map((c) => c.id)
  if (missing.length) throw new Error(`No se encontró la página de: ${missing.join(", ")}`)
  return { pages, total: doc.numPages }
}

async function renderPdf(browser, html, options) {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 })
  await page.evaluate(() => document.fonts.ready)
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, ...options })
  await page.close()
  return Buffer.from(pdf)
}

// ───────────────────────── main ─────────────────────────

const reference = (await import(pathToFileURL(path.join(ROOT, "content", "es.mjs")).href)).default
mkdirSync(OUT_DIR, { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" })

for (const lang of LANGS) {
  const content = (await import(pathToFileURL(path.join(ROOT, "content", `${lang}.mjs`)).href)).default
  assertSameShape(lang, content, reference)

  const footer = { displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: footerTemplate(content) }
  const firstPass = await renderPdf(browser, bodyHtml(lang, content, null), footer)
  const { pages } = await findChapterPages(firstPass, content.chapters)
  const body = await renderPdf(browser, bodyHtml(lang, content, pages), footer)
  const check = await findChapterPages(body, content.chapters)
  if (JSON.stringify(check.pages) !== JSON.stringify(pages)) throw new Error(`[${lang}] La paginación cambió entre pasadas.`)

  const cover = await renderPdf(browser, coverHtml(lang, content), { displayHeaderFooter: false })
  const merged = await PDFDocument.create()
  merged.setTitle(`Gastrometrics — ${content.ui.manualName}`)
  merged.setAuthor("Gastrometrics")
  merged.setLanguage(lang)
  for (const src of [cover, body]) {
    const doc = await PDFDocument.load(src)
    const copied = await merged.copyPages(doc, doc.getPageIndices())
    copied.forEach((p) => merged.addPage(p))
  }
  const bytes = Buffer.from(await merged.save())
  writeFileSync(path.join(OUT_DIR, `manual-${lang}.pdf`), bytes)
  writeFileSync(path.join(OUT_DIR, `manual-${lang}.html`), bodyHtml(lang, content, pages))
  writeFileSync(path.join(ASSETS_DIR, `manual-${lang}.pdf`), bytes)
  console.log(`[${lang}] ${check.total + 1} páginas · ${(bytes.length / 1024 / 1024).toFixed(1)} MB`)
}

await browser.close()
