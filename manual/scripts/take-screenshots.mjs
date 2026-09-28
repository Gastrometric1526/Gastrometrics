/**
 * Capturas de pantalla reales de la app para el manual, en los 6 idiomas.
 *
 * Uso (con un `next dev` local corriendo y la cuenta de tester en TESTER_ALLOWLIST_EMAILS):
 *   node manual/scripts/take-screenshots.mjs http://localhost:3001 es,da,fr,pt,zh,en
 *
 * Entra con el botón de login de desarrollo (solo existe con NODE_ENV=development), marca
 * todos los tutoriales como vistos para que no tapen la pantalla, y guarda JPG en
 * manual/shots/{idioma}/. El orden de idiomas importa: el idioma de la pantalla se
 * sincroniza al perfil de la cuenta (contexts/language-context.tsx), así que conviene
 * terminar con el idioma que la cuenta tenía antes.
 */
import puppeteer from "puppeteer-core"
import path from "path"
import { mkdirSync } from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const BASE = process.argv[2] || "http://localhost:3001"
const LANGS = (process.argv[3] || "es,da,fr,pt,zh,en").split(",")
const RECIPE_PATH = process.env.MANUAL_RECIPE_PATH || "/ficha-tecnica/recipe-1789404631502?business=main&mode=view"
const TOURS = [
  "onboarding_completed",
  "tour_completed_ficha-tecnica",
  "tour_completed_ingredientes",
  "tour_completed_inventario",
  "tour_completed_mis-recetas",
  "tour_completed_menus",
  "tour_completed_estadisticas",
  "tour_completed_ordenes-compra",
  "tour_completed_settings-dialog",
  "tour_completed_equipo",
  "tour_completed_mi-plan",
  "tour_completed_procesar-ordenes",
  "tour_completed_business-detail",
  "tour_completed_negocios",
]
const DRAFT_NAME = {
  es: "Salsa de tomate de la casa",
  en: "House tomato sauce",
  da: "Husets tomatsauce",
  fr: "Sauce tomate maison",
  pt: "Molho de tomate da casa",
  zh: "招牌番茄酱",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function settle(page) {
  await sleep(900)
  // Cierra cualquier diálogo que haya quedado abierto (novedades, avisos de plan…).
  await page.keyboard.press("Escape").catch(() => {})
  await sleep(250)
  await page.keyboard.press("Escape").catch(() => {})
  await sleep(500)
}

async function shot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, name), type: "jpeg", quality: 84 })
  console.log("  ✓", name)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=1400,900"],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 860, deviceScaleFactor: 1.5 })

// Login de desarrollo una sola vez; la sesión queda en cookies para todos los idiomas.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" })
// El botón de desarrollo usa el correo escrito en el campo (debe estar en TESTER_ALLOWLIST_EMAILS).
await page.type("#email", process.env.MANUAL_TESTER_EMAIL || "josedanielromero.cr@outlook.com")
await sleep(400)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /Entrar como|Sign in as|Log in as/i.test(b.textContent))
  if (btn) btn.click()
  return !!btn
})
if (!clicked) throw new Error("No se encontró el botón de login de desarrollo")
await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {})
await sleep(1500)

for (const lang of LANGS) {
  console.log(`[${lang}]`)
  const dir = path.join(__dirname, "..", "shots", lang)
  mkdirSync(dir, { recursive: true })

  await page.evaluate(
    (lang, tours) => {
      localStorage.setItem("app_language", lang)
      for (const k of tours) localStorage.setItem(k, "true")
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("changelog_seen_")) localStorage.setItem(k, "9999-12-31")
      }
    },
    lang,
    TOURS,
  )

  const visit = async (route, file, prep) => {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" })
    // Novedades: la clave lleva el id del usuario, que recién se conoce al cargar.
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("changelog_seen_")) localStorage.setItem(k, "9999-12-31")
    })
    await settle(page)
    if (prep) await prep()
    await shot(page, dir, file)
  }

  await visit("/dashboard", "01-dashboard.jpg")
  await visit("/ingredientes", "02-ingredientes.jpg")
  await visit(RECIPE_PATH, "03-ficha-tecnica.jpg")
  await visit(RECIPE_PATH, "04-ficha-tecnica-precio.jpg", async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55))
    await sleep(600)
  })

  // Borrador restaurado: se inyecta uno en localStorage con la clave real del usuario.
  const uid = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("changelog_seen_"))
    return key ? key.slice("changelog_seen_".length) : null
  })
  if (uid) {
    await page.evaluate(
      (uid, name) => {
        const now = new Date(Date.now() - 25 * 60 * 1000).toISOString()
        const recipe = {
          id: `recipe-${Date.now()}`,
          name,
          classification: "",
          plate: "",
          servings: 1,
          yieldAmount: 0,
          yieldUnit: "g",
          ingredients: [{ id: "ing-1", ingredientId: null, name: "", category: "", quantity: 0, unit: "", measure: "", cost: 0, unitCost: 0, costPerMeasure: 0, extension: 0 }],
          procedure: [""],
          totalCost: 0,
          costPerServing: 0,
          businessId: "main",
          metadata: { createdAt: now, updatedAt: now, version: 1 },
        }
        const pricing = { contributionMargin: 30, publicServices: 10, marketing: 10, operationalCosts: 30, laborCosts: 25, isv: 0, customUnitProfitInput: "", customPriceInput: "", paxModifier: 0, pricingMethod: "gastrometrics", targetFoodCostPercent: 30 }
        localStorage.setItem(`gm_recipe_draft:${uid}:main`, JSON.stringify({ recipe, pricing, savedAt: now }))
      },
      uid,
      DRAFT_NAME[lang] || DRAFT_NAME.en,
    )
    await visit("/ficha-tecnica", "05-borrador.jpg")
    await page.evaluate((uid) => localStorage.removeItem(`gm_recipe_draft:${uid}:main`), uid)
  } else {
    console.log("  ! sin id de usuario, se omite 05-borrador")
  }

  await visit("/mis-recetas", "06-mis-recetas.jpg")
  await visit("/inventario", "07-inventario.jpg")
  await visit("/menus", "08-menus.jpg")
  await visit("/menu-y-compras", "09-ordenes-compra.jpg")
  await visit("/ventas", "10-ventas.jpg")
  await visit("/estadisticas", "11-reportes.jpg")
  await visit("/mi-plan", "12-mi-plan.jpg")
  await visit("/dashboard", "13-configuracion.jpg", async () => {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("aside button, nav button, button")].find((b) =>
        b.querySelector("svg.lucide-settings"),
      )
      btn?.click()
    })
    await sleep(900)
    // Las pestañas de Radix reaccionan a pointerdown: hace falta un clic real de mouse.
    // Notificaciones además evita mostrar el correo de la cuenta (pestaña Perfil).
    await page.click("#settings-tab-notifications").catch(() => {})
    await sleep(800)
  })
  await page.keyboard.press("Escape").catch(() => {})
}

await browser.close()
console.log("listo")
