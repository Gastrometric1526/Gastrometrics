/**
 * Pantallas con sesión en un navegador real (docs/355). Solo corre con una cuenta de
 * prueba: E2E_EMAIL y E2E_PASSWORD (variables de entorno o secretos de GitHub, nunca en
 * el código: el repositorio es público) y las llaves de Supabase. SOLO LEE: abre cada
 * módulo y revisa que cargue sin errores y que nada se salga del ancho, también a 360 px
 * (lo que docs/352 dejó pendiente). No crea, cambia ni borra datos.
 */

import { test, expect, type Page } from "@playwright/test"
import { collectPageErrors, expectNoHorizontalOverflow, hasBackend } from "./helpers"

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.skip(!email || !password || !hasBackend, "Necesita E2E_EMAIL, E2E_PASSWORD y las llaves de Supabase")

const APP_PAGES = ["/dashboard", "/ingredientes", "/mis-recetas", "/ficha-tecnica", "/menus", "/inventario", "/mi-plan"]

async function signIn(page: Page) {
  await page.goto("/login")
  await page.locator("#email").fill(email!)
  await page.locator("#password").fill(password!)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 })
}

test.describe.configure({ mode: "serial" })

test.beforeEach(async ({ page }) => {
  await signIn(page)
})

for (const path of APP_PAGES) {
  test(`${path} carga sin errores y nada se sale del ancho`, async ({ page }) => {
    const errors = collectPageErrors(page)
    await page.goto(path, { waitUntil: "networkidle" })
    expect(new URL(page.url()).pathname, `${path} no debe mandar a iniciar sesión`).not.toMatch(/^\/login/)
    await expect(page.locator("main, body").first()).not.toBeEmpty()
    await expectNoHorizontalOverflow(page)
    expect(errors, `errores en ${path}`).toEqual([])
  })
}
