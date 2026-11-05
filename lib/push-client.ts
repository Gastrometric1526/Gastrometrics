"use client"

/**
 * Registrar este aparato para recibir notificaciones (docs/240, docs/241). Lo comparten la
 * cuenta (`/api/push`) y /admin (`/api/admin/push`): el navegador tiene UNA suscripción por sitio
 * y cada una guarda su lista. Por eso «quitar» solo saca el aparato de esa lista, sin cancelar
 * la suscripción del navegador, que la otra puede seguir usando.
 */

export type PushApi = "/api/push" | "/api/admin/push"

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

/** iPhone o iPad en Safari sin instalar: ahí Apple no deja recibir avisos. */
export function needsHomeScreen(): boolean {
  if (typeof window === "undefined") return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  return ios && !(navigator as Navigator & { standalone?: boolean }).standalone
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Sin esperar a `ready`, que nunca termina si no hay service worker. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function isDeviceRegistered(api: PushApi): Promise<boolean> {
  const subscription = await currentSubscription()
  if (!subscription) return false
  const res = await fetch(`${api}?endpoint=${encodeURIComponent(subscription.endpoint)}`)
  if (!res.ok) return false
  return Boolean((await res.json()).registered)
}

/** Pide el permiso y registra el aparato. false si la persona no dio permiso. */
export async function registerDevice(api: PushApi): Promise<boolean> {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return false
  const info = await fetch(api).then((r) => (r.ok ? r.json() : Promise.reject(new Error("push"))))
  const reg = await navigator.serviceWorker.ready
  const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(info.publicKey) }))
  const body = api === "/api/admin/push" ? { action: "subscribe" } : {}
  const saved = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, subscription: subscription.toJSON(), label: navigator.userAgent }),
  })
  if (!saved.ok) throw new Error("push")
  return true
}

export async function unregisterDevice(api: PushApi): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await fetch(api, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
}
