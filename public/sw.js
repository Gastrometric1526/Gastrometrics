// Service worker mínimo — ver 09-sesion-continuidad.md.
// Objetivo único: cumplir el criterio de instalabilidad de PWA en Chrome/Android
// (manifest + service worker con manejador de "fetch") y cachear assets estáticos
// para que la carga sea más rápida en visitas repetidas. Esta app requiere internet
// para funcionar (localStorage vive en el dispositivo, pero no hay modo offline real
// de datos) — este service worker NO intenta ofrecer modo offline de datos, solo
// acelera la carga de la interfaz.

const CACHE_NAME = "gastrometrics-static-v1"
const STATIC_ASSETS = ["/icon-192x192.png", "/icon-512x512.png", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Solo interceptar assets estáticos propios; todo lo demás (navegación, datos)
  // va directo a la red — esta app necesita internet siempre (ver 00-README).
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return
  if (!STATIC_ASSETS.includes(url.pathname)) return

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  )
})
