/**
 * Notificaciones push para quienes entran a /admin (docs/240): Web Push estándar. Chrome las
 * entrega por los servidores de Google; en iPhone hace falta instalar el sitio en la pantalla
 * de inicio. Cada aparato se suscribe desde /admin.
 *
 * Las claves VAPID y las suscripciones viven en un archivo del bucket privado `admin-push`, que
 * se crea solo: no hace falta migración ni variables de entorno, y la clave privada nunca
 * entra al repositorio (que es público). Nunca lanza: un aviso que falla no debe romper la
 * acción de quien lo provocó.
 */

import webpush, { type PushSubscription } from "web-push"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const BUCKET = "admin-push"
const FILE = "config.json"
// Web Push pide un contacto del remitente; la dirección del sitio es válida.
const VAPID_SUBJECT = "https://gastrometrics.org"

interface StoredSubscription {
  subscription: PushSubscription
  label: string
  addedAt: string
}

export interface PushConfig {
  publicKey: string
  privateKey: string
  subscriptions: StoredSubscription[]
}

export interface AdminPushMessage {
  title: string
  body: string
  /** Pantalla que abre al tocarla. */
  url?: string
}

/** Agrega o reemplaza un aparato (por su dirección de suscripción). Pura. */
export function withSubscription(list: StoredSubscription[], entry: StoredSubscription): StoredSubscription[] {
  return [...list.filter((s) => s.subscription.endpoint !== entry.subscription.endpoint), entry]
}

/** Quita los aparatos cuya suscripción ya no existe. Pura. */
export function withoutEndpoints(list: StoredSubscription[], endpoints: string[]): StoredSubscription[] {
  const gone = new Set(endpoints)
  return list.filter((s) => !gone.has(s.subscription.endpoint))
}

async function readConfig(): Promise<PushConfig | null> {
  const { data, error } = await getSupabaseAdminClient().storage.from(BUCKET).download(FILE)
  if (error || !data) return null
  return JSON.parse(await data.text()) as PushConfig
}

async function writeConfig(config: PushConfig): Promise<void> {
  const body = new Blob([JSON.stringify(config)], { type: "application/json" })
  const { error } = await getSupabaseAdminClient().storage.from(BUCKET).upload(FILE, body, { upsert: true, contentType: "application/json" })
  if (error) throw error
}

/** Lee la configuración y, la primera vez, crea el bucket y las claves. */
async function ensureConfig(): Promise<PushConfig> {
  const existing = await readConfig()
  if (existing) return existing
  const admin = getSupabaseAdminClient()
  const { error } = await admin.storage.getBucket(BUCKET)
  if (error) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, { public: false })
    if (createError) throw createError
  }
  const keys = webpush.generateVAPIDKeys()
  const config: PushConfig = { publicKey: keys.publicKey, privateKey: keys.privateKey, subscriptions: [] }
  await writeConfig(config)
  return config
}

export async function getAdminPushInfo(): Promise<{ publicKey: string; devices: number }> {
  const config = await ensureConfig()
  return { publicKey: config.publicKey, devices: config.subscriptions.length }
}

export async function addAdminPushDevice(subscription: PushSubscription, label: string): Promise<void> {
  const config = await ensureConfig()
  const entry = { subscription, label: label.slice(0, 80), addedAt: new Date().toISOString() }
  await writeConfig({ ...config, subscriptions: withSubscription(config.subscriptions, entry) })
}

export async function removeAdminPushDevice(endpoint: string): Promise<void> {
  const config = await ensureConfig()
  await writeConfig({ ...config, subscriptions: withoutEndpoints(config.subscriptions, [endpoint]) })
}

/** Manda el aviso a todos los aparatos. Devuelve a cuántos llegó; nunca lanza. */
export async function sendAdminPush(message: AdminPushMessage): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0
  try {
    const config = await readConfig()
    if (!config || config.subscriptions.length === 0) return 0
    const payload = JSON.stringify({ title: message.title, body: message.body.slice(0, 180), url: message.url || "/admin" })
    const options = {
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: config.publicKey, privateKey: config.privateKey },
      TTL: 24 * 60 * 60,
      timeout: 5000,
    }
    const gone: string[] = []
    let sent = 0
    await Promise.all(
      config.subscriptions.map(async ({ subscription }) => {
        try {
          await webpush.sendNotification(subscription, payload, options)
          sent++
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode
          // 404/410: el aparato canceló o cambió la suscripción.
          if (status === 404 || status === 410) gone.push(subscription.endpoint)
          else console.error("[admin-push] No se pudo enviar a un aparato:", status ?? error)
        }
      }),
    )
    if (gone.length > 0) await writeConfig({ ...config, subscriptions: withoutEndpoints(config.subscriptions, gone) })
    return sent
  } catch (error) {
    console.error("[admin-push] Error mandando la notificación:", error)
    return 0
  }
}
