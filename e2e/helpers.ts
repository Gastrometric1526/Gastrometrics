import { expect, type Page } from "@playwright/test"

/** Errores de consola que no son de la app (scripts de terceros que no cargan en local). */
const IGNORED_CONSOLE = [/_vercel\/(insights|speed-insights)/i, /Failed to load resource/i, /favicon/i]

/** Junta los errores de la página y de la consola mientras corre la prueba. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return
    // Con las llaves de relleno no hay backend: que sus llamadas fallen es lo esperado.
    if (text.includes(PLACEHOLDER_SUPABASE_URL)) return
    errors.push(`console: ${text}`)
  })
  return errors
}

/**
 * Nada se sale del ancho de la pantalla (docs/310, docs/352: medir a 360 px). Devuelve los
 * elementos visibles que pasan del borde derecho, para que el error diga cuál es.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const scroll = document.documentElement.scrollWidth
    const offenders: string[] = []
    if (scroll > width + 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        if (rect.right <= width + 1) continue
        // Un hijo de algo con desplazamiento propio (tablas, carruseles) no cuenta.
        let parent = el.parentElement
        let scrolls = false
        while (parent && parent !== document.body) {
          const style = getComputedStyle(parent)
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            scrolls = true
            break
          }
          parent = parent.parentElement
        }
        if (scrolls) continue
        const id = el.id ? `#${el.id}` : ""
        const cls = typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""
        offenders.push(`${el.tagName.toLowerCase()}${id}${cls} (borde derecho ${Math.round(rect.right)} px)`)
        if (offenders.length >= 5) break
      }
    }
    return { width, scroll, offenders }
  })
  expect(report.offenders, `La página mide ${report.scroll} px en una pantalla de ${report.width} px`).toEqual([])
  expect(report.scroll).toBeLessThanOrEqual(report.width + 1)
}

/**
 * Llaves de relleno para probar el sitio público sin backend (la revisión automática las
 * usa cuando no hay secretos): la app arranca, pero no hay ningún Supabase detrás.
 */
export const PLACEHOLDER_SUPABASE_URL = "http://127.0.0.1:54321"

/** Hay un Supabase real detrás (sin él, lo que necesita sesión no aplica). */
export const hasBackend = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== PLACEHOLDER_SUPABASE_URL,
)
