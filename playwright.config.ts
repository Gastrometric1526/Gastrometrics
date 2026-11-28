/**
 * Pruebas de punta a punta en un navegador real (docs/355). Corren contra la app ya
 * construida (`npm run build`), servida con `next start` en el puerto 3100, o contra otra
 * dirección con E2E_BASE_URL (por ejemplo, una vista previa de Vercel).
 *
 *   npm run test:e2e
 *
 * - e2e/public.spec.ts: sitio público, sin sesión ni llaves. Corre siempre (también en
 *   la revisión automática de GitHub).
 * - e2e/app.spec.ts: pantallas con sesión. Solo corre con E2E_EMAIL y E2E_PASSWORD (una
 *   cuenta de prueba, nunca la del dueño) y las llaves de Supabase. Solo lee: no crea,
 *   cambia ni borra nada.
 *
 * Los archivos se llaman *.spec.ts para que Vitest (que toma *.test.ts) no los corra.
 */

import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "es-HN",
    timezoneId: "America/Tegucigalpa",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "computadora", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
