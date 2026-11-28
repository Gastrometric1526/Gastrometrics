/**
 * Sitio público en un navegador real (docs/355): cada página abre sin errores y nada se
 * sale del ancho en computadora ni en un celular de 360 px. No necesita sesión ni llaves.
 */

import { test, expect } from "@playwright/test"
import { collectPageErrors, expectNoHorizontalOverflow, hasBackend } from "./helpers"

const PUBLIC_PAGES = [
  "/",
  "/planes",
  "/calculadora-food-cost",
  "/about",
  "/contacto",
  "/login",
  "/signup",
  "/terminos-de-uso",
  "/politica-privacidad",
]

for (const path of PUBLIC_PAGES) {
  test(`${path} abre sin errores y nada se sale del ancho`, async ({ page }) => {
    const errors = collectPageErrors(page)
    const response = await page.goto(path, { waitUntil: "networkidle" })
    expect(response?.status(), `respuesta de ${path}`).toBeLessThan(400)
    await expect(page.locator("body")).not.toBeEmpty()
    await expectNoHorizontalOverflow(page)
    expect(errors, `errores en ${path}`).toEqual([])
  })
}

test("la portada dice desde el inicio que se importa lo que ya se tiene (docs/256)", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByText("Trae lo que ya tienes").first()).toBeVisible()
})

test("Planes muestra los 5 planes", async ({ page }) => {
  await page.goto("/planes")
  for (const plan of ["Foodie", "Home Cook", "Chef de Partie", "Sous Chef", "Chef Ejecutivo"]) {
    await expect(page.getByText(plan, { exact: false }).first(), plan).toBeVisible()
  }
})

test("Iniciar sesión tiene correo, contraseña y botón", async ({ page }) => {
  await page.goto("/login")
  await expect(page.locator("#email")).toBeVisible()
  await expect(page.locator("#password")).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test.describe("con backend", () => {
  test.skip(!hasBackend, "Necesita las llaves de Supabase")

  test("el manual en PDF no se entrega sin sesión", async ({ request }) => {
    const response = await request.get("/api/manual")
    expect(response.status()).toBe(401)
  })
})
