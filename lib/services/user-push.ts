/**
 * Notificaciones push para todas las cuentas (docs/241). Mismo Web Push y mismas claves que
 * /admin (lib/services/admin-push.ts); los aparatos de cada cuenta viven en
 * `users/<cuenta>.json` del bucket privado, sin migración.
 *
 * Solo lo que pide una acción o que la persona está esperando (decisión de docs/241): respuesta
 * del chat, cobro fallido, plan por vencer, mes ganado por invitar, stock bajo y platos perdiendo
 * margen. Nada de recordatorios ni marketing. El título es el asunto del correo, ya en su idioma.
 * Nunca lanza: un aviso que falla no debe frenar el correo ni el cobro.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { BUCKET, deliver, ensureConfig, readConfig, withSubscription, withoutEndpoints, type AdminPushMessage, type StoredSubscription } from "./admin-push"
import type { PushSubscription } from "web-push"

/** Tope de aparatos por cuenta: el más viejo sale si se pasa. */
const MAX_DEVICES = 5

const fileOf = (accountId: string) => `users/${accountId}.json`

async function readDevices(accountId: string): Promise<StoredSubscription[]> {
  const { data, error } = await getSupabaseAdminClient().storage.from(BUCKET).download(fileOf(accountId))
  if (error || !data) return []
  return JSON.parse(await data.text()) as StoredSubscription[]
}

async function writeDevices(accountId: string, devices: StoredSubscription[]): Promise<void> {
  const body = new Blob([JSON.stringify(devices)], { type: "application/json" })
  const { error } = await getSupabaseAdminClient().storage.from(BUCKET).upload(fileOf(accountId), body, { upsert: true, contentType: "application/json" })
  if (error) throw error
}

export async function getUserPushInfo(accountId: string, endpoint: string | null): Promise<{ publicKey: string; registered: boolean }> {
  const config = await ensureConfig()
  const devices = endpoint ? await readDevices(accountId) : []
  return { publicKey: config.publicKey, registered: devices.some((d) => d.subscription.endpoint === endpoint) }
}

export async function addUserPushDevice(accountId: string, subscription: PushSubscription, label: string): Promise<void> {
  await ensureConfig()
  const entry = { subscription, label: label.slice(0, 80), addedAt: new Date().toISOString() }
  await writeDevices(accountId, withSubscription(await readDevices(accountId), entry).slice(-MAX_DEVICES))
}

export async function removeUserPushDevice(accountId: string, endpoint: string): Promise<void> {
  await writeDevices(accountId, withoutEndpoints(await readDevices(accountId), [endpoint]))
}

export async function sendUserPush(accountId: string, message: AdminPushMessage): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0
  try {
    const devices = await readDevices(accountId)
    if (devices.length === 0) return 0
    const config = await readConfig()
    if (!config) return 0
    const { sent, gone } = await deliver(config, devices, { ...message, url: message.url || "/dashboard" })
    if (gone.length > 0) await writeDevices(accountId, withoutEndpoints(devices, gone))
    return sent
  } catch (error) {
    console.error("[user-push] Error mandando la notificación:", error)
    return 0
  }
}
