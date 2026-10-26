/**
 * Capturas reales de la app para la landing (docs/193): «así se ve por dentro», en los 6 idiomas,
 * en computadora (1440×900) y en celular (390 de ancho, captura alta para que el teléfono de la
 * landing la recorra sola).
 *
 * Uso (con `next dev` corriendo y la cuenta de tester en TESTER_ALLOWLIST_EMAILS):
 *   cd manual && node scripts/landing-media.mjs http://localhost:3000 es,en,da,fr,pt,zh
 *
 * Red de seguridad (igual que marketing/instagram/tools/phone-shots.mjs): ninguna escritura sale
 * del navegador — todo POST/PATCH/DELETE a Supabase o a /api se responde en el navegador, salvo
 * el login de desarrollo. Así cambiar el idioma no toca el perfil de la cuenta real.
 * El nombre de la cuenta de prueba se reemplaza por «Chef» y el correo por uno genérico.
 *
 * Salida: public/landing/{idioma}/desk-<id>.webp, phone-<id>.webp y phone-nav-<id>.webp.
 */
import puppeteer from "puppeteer-core"
import path from "path"
import { mkdirSync, statSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import os from "os"
import { fileURLToPath } from "url"
import { buildDemo } from "./landing-demo-data.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const BASE = process.argv[2] || "http://localhost:3000"
const LANGS = (process.argv[3] || "es,en,da,fr,pt,zh").split(",")
const TESTER = process.env.MANUAL_TESTER_EMAIL || "josedanielromero.cr@outlook.com"
const RECIPE = process.env.LANDING_RECIPE_PATH || "/ficha-tecnica/demo-recipe-burger?business=main&mode=view"
const OUT = path.join(__dirname, "..", "..", "public", "landing")
const ONLY = process.env.LANDING_ONLY ? process.env.LANDING_ONLY.split(",") : null
const PHONE_MAX_H = 1700 // alto máximo (px CSS) de cada captura de celular

// Los mismos pasos que cuenta la landing (components/landing-showcase.tsx).
const SCREENS = [
  { id: "dashboard", route: "/dashboard" },
  { id: "ingredientes", route: "/ingredientes" },
  { id: "ficha", route: RECIPE },
  { id: "precio", route: RECIPE, anchor: '[data-tour="ficha-pricing"]' },
  { id: "inventario", route: "/inventario" },
  { id: "reportes", route: "/estadisticas" },
  { id: "menus", route: "/menus" },
  { id: "ordenes", route: "/ordenes-compra" },
  { id: "mep", route: "/mep?menu=demo-menu-lunch" },
]

const TOURS = ["onboarding_completed", ...["ficha-tecnica", "ingredientes", "inventario", "mis-recetas", "menus", "estadisticas", "ordenes-compra", "settings-dialog", "equipo", "mi-plan", "procesar-ordenes", "business-detail", "negocios", "dashboard"].map((k) => `tour_completed_${k}`)]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--window-size=1440,900"] })
const page = await browser.newPage()

// Restaurante de demostración (scripts/landing-demo-data.mjs): las lecturas de estas tablas
// se responden con él; el resto de lecturas va a la base real (perfil, plan) sin cambios,
// salvo la moneda y el nombre del perfil.
let demo = buildDemo(LANGS[0], "demo-owner")
const DEMO_TABLES = new Set([...Object.keys(demo.tables), "inventory_snapshots", "purchase_orders", "recipes_trash", "recipe_drafts", "businesses", "invoices"])

const tableOf = (url) => (url.match(/\/rest\/v1\/([a-z_]+)/) || [])[1]
function demoRows(table, url) {
  let rows = demo.tables[table] || []
  const q = new URL(url).searchParams
  const bid = q.get("business_id")
  if (bid && bid !== "is.null") rows = []
  const id = q.get("id")
  if (id && id.startsWith("eq.")) rows = rows.filter((r) => r.id === decodeURIComponent(id.slice(3)))
  if (id && id.startsWith("in.(")) {
    const ids = id.slice(4, -1).split(",").map((s) => decodeURIComponent(s.replace(/"/g, "")))
    rows = rows.filter((r) => ids.includes(r.id))
  }
  return rows
}

await page.setRequestInterception(true)
page.on("request", async (req) => {
  const url = req.url()
  const method = req.method()
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method)
  if (isWrite && url.includes("/api/auth/dev-login")) return req.continue()
  // Lecturas de Supabase por POST (rpc) sí pasan; escrituras no.
  if (isWrite && url.includes(".supabase.co/rest/v1/rpc/")) return req.continue()
  if (isWrite && (url.includes(".supabase.co/rest/") || url.includes(".supabase.co/storage/") || url.includes("/api/")))
    return req.respond({ status: 200, contentType: "application/json", body: url.includes("/rest/") ? "[]" : "{}" })
  const table = url.includes(".supabase.co/rest/v1/") ? tableOf(url) : null
  if (table && DEMO_TABLES.has(table) && (method === "GET" || method === "HEAD")) {
    const rows = demoRows(table, url)
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object")
    const headers = { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" }
    if (single) {
      if (!rows.length) return req.respond({ status: 406, contentType: "application/json", headers, body: JSON.stringify({ code: "PGRST116", message: "no rows" }) })
      return req.respond({ status: 200, contentType: "application/json", headers, body: method === "HEAD" ? "" : JSON.stringify(rows[0]) })
    }
    return req.respond({ status: 200, contentType: "application/json", headers, body: method === "HEAD" ? "" : JSON.stringify(rows) })
  }
  // Perfil: misma fila real, con la moneda del idioma y sin el nombre de la cuenta de prueba.
  if (table === "profiles" && method === "GET") {
    try {
      const res = await fetch(url, { headers: req.headers() })
      const text = await res.text()
      let body = text
      try {
        const patch = (p) => (p && typeof p === "object" ? { ...p, currency: demo.currency, full_name: "Chef", name: "Chef" } : p)
        const json = JSON.parse(text)
        body = JSON.stringify(Array.isArray(json) ? json.map(patch) : patch(json))
      } catch {}
      return req.respond({ status: res.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body })
    } catch {
      return req.continue()
    }
  }
  req.continue()
})

let currentLang = LANGS[0]
await page.evaluateOnNewDocument((tours) => {
  try {
    const lang = sessionStorage.getItem("__landing_lang")
    if (lang) localStorage.setItem("app_language", lang)
    // La moneda de la pantalla vive en localStorage (lib/currency.ts), no solo en el perfil.
    const cur = sessionStorage.getItem("__landing_cur")
    if (cur) localStorage.setItem("currency_code", cur)
    for (const k of tours) localStorage.setItem(k, "true")
    for (const k of Object.keys(localStorage)) if (k.startsWith("changelog_seen_")) localStorage.setItem(k, "9999-12-31")
  } catch {}
  document.addEventListener("DOMContentLoaded", () => {
    const st = document.createElement("style")
    // Botón flotante de feedback / instalar, botón de ayuda (docs/204) y avisos que tapan la pantalla.
    st.textContent = 'div.fixed[class*="bottom-4"][class*="right-4"]{display:none!important}[data-sonner-toaster],[role=status],[data-feedback-card],[data-tour=support-chat]{display:none!important}'
    document.head.appendChild(st)
  })
}, TOURS)

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 120000 })
const st = await page.evaluate(
  async (email) => (await fetch("/api/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).status,
  TESTER,
)
if (st !== 200) throw new Error("dev-login falló " + st)

const scrub = () =>
  page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode()))
      if (/Daniel|Romero|josedaniel/i.test(n.nodeValue))
        n.nodeValue = n.nodeValue.replace(/Jos[eé] Daniel Romero|Daniel Romero|Daniel|Romero/g, "Chef").replace(/\S*josedaniel\S*/gi, "chef@turestaurante.com")
    for (const i of document.querySelectorAll("input")) if (/josedaniel/i.test(i.value)) i.value = "chef@turestaurante.com"
  })

const closeDialogs = async () => {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => !!document.querySelector('[role=dialog],[role=alertdialog]'))
    if (!open) break
    await page.keyboard.press("Escape").catch(() => {})
    await sleep(400)
  }
}

const load = async (route) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 120000 })
  await page.waitForFunction(() => (document.querySelector("main")?.innerText || document.body.innerText).trim().length > 300, { timeout: 45000 }).catch(() => {})
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("changelog_seen_")) localStorage.setItem(k, "9999-12-31")
  })
  await sleep(1800)
  await closeDialogs()
  await scrub()
}

const checkSize = (file) => {
  const kb = statSync(file).size / 1024
  if (kb < 15) console.log(`  ! ${path.basename(file)} pesa ${kb.toFixed(0)} KB — ¿salió en blanco?`)
  return kb >= 15
}
// Una captura en blanco (la ruta todavía compilando en next dev) se repite hasta 4 veces.
const withRetry = async (file, take) => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await take()
    if (checkSize(file)) return
    await sleep(2500)
  }
}


// ── PDF real de la Ficha Técnica (docs/196) ──
// Exporta el PDF administrativo de la hamburguesa como lo haría una persona (botón «Exportar
// PDF» → «Administrativo» → exportar) y convierte su primera página en imagen con pdf.js.
const PDF_TMP = path.join(os.tmpdir(), "gm-landing-pdf")
async function capturePdf(dir) {
  rmSync(PDF_TMP, { recursive: true, force: true })
  mkdirSync(PDF_TMP, { recursive: true })
  const cdp = await page.createCDPSession()
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: PDF_TMP })
  await load(RECIPE)
  const exportLabel = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-file-down, svg.lucide-download, svg.lucide-file-text") && b.closest("main"))
    return btn ? btn.textContent.trim() : null
  })
  // El botón de la cabecera de «Ver receta» lleva el texto ficha_tecnica_export_pdf.
  const clicked = await page.evaluate((label) => {
    const btns = [...document.querySelectorAll("main button")]
    const btn = btns.find((b) => b.textContent.trim() === label) || btns.find((b) => /PDF/i.test(b.textContent))
    if (btn) btn.click()
    return !!btn
  }, exportLabel)
  if (!clicked) return console.log("  ! no se encontró «Exportar PDF»")
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {})
  await sleep(600)
  // Primera opción = Administrativo; luego el botón principal del diálogo.
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const options = dialog ? [...dialog.querySelectorAll("[class*='cursor-pointer'], [role='radio']")] : []
    if (options[0]) options[0].click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const buttons = dialog ? [...dialog.querySelectorAll("button")] : []
    const last = buttons.filter((b) => !b.disabled && /PDF/i.test(b.textContent)).pop() || buttons.pop()
    if (last) last.click()
  })
  let file = null
  for (let i = 0; i < 30 && !file; i++) {
    await sleep(500)
    file = readdirSync(PDF_TMP).find((f) => f.endsWith(".pdf"))
  }
  if (!file) return console.log("  ! no se descargó el PDF")
  const b64 = readFileSync(path.join(PDF_TMP, file)).toString("base64")
  const viewer = await browser.newPage()
  await viewer.setViewport({ width: 1000, height: 1400 })
  await viewer.setContent(`<html><body style="margin:0;background:#fff"><canvas id="c"></canvas><script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script></body></html>`)
  await viewer.waitForFunction(() => window.pdfjsLib, { timeout: 30000 })
  const size = await viewer.evaluate(async (data) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise
    const pg = await doc.getPage(1)
    const vp = pg.getViewport({ scale: 1.6 })
    const c = document.getElementById("c")
    c.width = vp.width
    c.height = vp.height
    await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise
    return [vp.width, vp.height]
  }, b64)
  await viewer.setViewport({ width: Math.ceil(size[0]), height: Math.ceil(size[1]) })
  const canvas = await viewer.$("#c")
  await canvas.screenshot({ path: path.join(dir, "pdf-ficha.webp"), type: "webp", quality: 82 })
  await viewer.close()
  console.log("  ✓ pdf-ficha.webp")
}

for (const lang of LANGS) {
  currentLang = lang
  demo = buildDemo(lang, "demo-owner")
  console.log(`[${lang}]`)
  const dir = path.join(OUT, lang)
  mkdirSync(dir, { recursive: true })
  await page.evaluate(
    (l, c) => {
      sessionStorage.setItem("__landing_lang", l)
      sessionStorage.setItem("__landing_cur", c)
    },
    lang,
    demo.currency,
  )

  // ── Computadora ──
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.25 })
  for (const s of SCREENS) {
    const file = `desk-${s.id}.webp`
    if (ONLY && !ONLY.includes(file)) continue
    const out = path.join(dir, file)
    await withRetry(out, async () => {
      await load(s.route)
      if (s.anchor) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel)
          if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 28)
        }, s.anchor)
        await sleep(700)
      }
      await page.screenshot({ path: out, type: "webp", quality: 78 })
    })
    console.log("  ✓", file)
  }

  if (!ONLY || ONLY.includes("pdf-ficha.webp")) await capturePdf(dir).catch((e) => console.log("  ! PDF:", e.message))

  // ── Celular ── (se salta si LANDING_ONLY no pide capturas de celular)
  if (ONLY && !ONLY.some((f) => f.startsWith("phone-"))) continue
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  })
  for (const s of SCREENS) {
    const file = `phone-${s.id}.webp`
    if (ONLY && !ONLY.includes(file)) continue
    const out = path.join(dir, file)
    let h = 0
    await withRetry(out, async () => {
      await load(s.route)
      // Barra inferior de la app de esta pantalla (con su sección marcada): la landing la pone
      // fija abajo del teléfono mientras la captura alta se recorre.
      const nav = await page.$("nav.fixed, div.fixed.bottom-0, nav[class*='bottom-0']")
      if (nav) await nav.screenshot({ path: path.join(dir, `phone-nav-${s.id}.webp`), type: "webp", quality: 80 })
      else console.log("  ! no se encontró la barra inferior")
      // La captura alta no lleva elementos fijos (barra inferior, cabecera pegada).
      const startY = await page.evaluate((sel) => {
        const css = document.createElement("style")
        css.id = "__landing_hide_fixed"
        css.textContent = "nav.fixed,div.fixed.bottom-0,nav[class*='bottom-0'],header.sticky,[class*='sticky'][class*='top-0']{visibility:hidden!important}"
        document.head.appendChild(css)
        if (!sel) return 0
        const el = document.querySelector(sel)
        return el ? Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - 24)) : 0
      }, s.anchor || null)
      const docH = await page.evaluate(() => document.documentElement.scrollHeight)
      h = Math.max(844, Math.min(PHONE_MAX_H, docH - startY))
      await page.screenshot({ path: out, type: "webp", quality: 76, clip: { x: 0, y: startY, width: 390, height: h }, captureBeyondViewport: true })
      await page.evaluate(() => document.getElementById("__landing_hide_fixed")?.remove())
    })
    console.log("  ✓", file, `(${h}px)`)
  }
}

await browser.close()
console.log("listo")
