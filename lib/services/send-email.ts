/**
 * Envío de correo con reintentos (docs/142) — todo `resend.emails.send` de la app pasa
 * por acá. Pedido del dueño: "asegúrate que nunca se dañe el sistema de correos".
 *
 * - Reintenta (3 intentos, esperas de 1 s y 2.5 s) cuando Resend responde con un error
 *   pasajero: límite de velocidad (429), error interno o de red. Un error que no se
 *   arregla reintentando (correo inválido, dominio sin verificar, falta la API key) se
 *   devuelve en el primer intento.
 * - Deja al menos MIN_GAP_MS entre envíos dentro de la misma instancia: los envíos
 *   masivos (novedades, aviso legal, recordatorios del cron) iban uno tras otro sin
 *   pausa y Resend limita a pocos por segundo, así que en una lista larga algunos se
 *   rechazaban con 429 y se perdían.
 * - Igual que el SDK, nunca lanza: devuelve `{ data, error }`.
 */

import type { Resend } from "resend"

type SendPayload = Parameters<Resend["emails"]["send"]>[0]
type SendResult = Awaited<ReturnType<Resend["emails"]["send"]>>

const MIN_GAP_MS = 550
const RETRY_DELAYS_MS = [1000, 2500]
const RETRYABLE = new Set(["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests"])

let lastSendAt = 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Solo para pruebas: sin esperas reales. */
export const __emailTiming = { sleep, enabled: true }

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return true // excepción de red sin forma conocida
  const e = error as { name?: string; statusCode?: number | null }
  if (e.name && RETRYABLE.has(e.name)) return true
  if (typeof e.statusCode === "number") return e.statusCode === 429 || e.statusCode >= 500
  return false
}

async function waitTurn() {
  if (!__emailTiming.enabled) return
  const wait = lastSendAt + MIN_GAP_MS - Date.now()
  if (wait > 0) await __emailTiming.sleep(wait)
  lastSendAt = Date.now()
}

export async function sendWithRetry(resend: Resend, payload: SendPayload, label = "correo"): Promise<SendResult> {
  let last: SendResult = { data: null, error: null } as unknown as SendResult
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    await waitTurn()
    try {
      last = await resend.emails.send(payload)
      if (!last.error) return last
      if (!isRetryable(last.error)) return last
    } catch (thrown) {
      // El SDK no debería lanzar, pero un corte de red sí puede: se trata como pasajero.
      last = {
        data: null,
        error: { name: "application_error", message: thrown instanceof Error ? thrown.message : String(thrown), statusCode: null },
      } as unknown as SendResult
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      console.warn(`[send-email] ${label}: intento ${attempt + 1} falló, reintentando`, last.error)
      if (__emailTiming.enabled) await __emailTiming.sleep(RETRY_DELAYS_MS[attempt])
    }
  }
  console.error(`[send-email] ${label}: falló tras ${RETRY_DELAYS_MS.length + 1} intentos`, last.error)
  return last
}
