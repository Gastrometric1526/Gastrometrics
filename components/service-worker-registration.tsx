"use client"

import { useEffect } from "react"

// Ver 09-sesion-continuidad.md — registro del service worker para instalabilidad PWA.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencioso: si falla el registro (ej. entorno de desarrollo sin HTTPS),
        // la app sigue funcionando normal como sitio web, solo sin instalabilidad.
      })
    }
  }, [])

  return null
}
