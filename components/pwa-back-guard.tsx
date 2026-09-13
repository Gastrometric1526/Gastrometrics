"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

// Evita que el botón/gesto de "atrás" del celular cierre la app cuando está instalada
// como PWA (display-mode: standalone) — sin esto, en cuanto el historial de navegación
// del navegador se agota (por ejemplo, al abrir la app desde el ícono y visitar solo 1-2
// pantallas), un solo "atrás" saca al usuario de la app entera en vez de llevarlo a la
// pantalla anterior o, como mínimo, al Dashboard — pedido explícito del dueño del
// proyecto. Nunca corre en pestaña de navegador normal (solo standalone) ni para
// visitantes sin sesión (solo dentro de la app logueada) — a propósito, para no
// interferir con el "atrás" nativo esperado en el sitio de marketing/login.
//
// Técnica: se empuja un estado "centinela" (un duplicado de la URL actual) al historial.
// Mientras el usuario navega normalmente con <Link>/router.push, cada "atrás" real cae en
// una entrada de verdad (Next la maneja solo, este componente no hace nada). Solo cuando
// un "atrás" aterriza DE VUELTA en el centinela — el punto exacto en el que, sin esto, el
// siguiente "atrás" habría cerrado la app — se reacciona: si ya se está en /dashboard, se
// vuelve a armar el centinela en silencio (así el próximo "atrás" también queda atrapado,
// para siempre, sin cerrar nunca la app); si no, se manda al Dashboard con el router real
// de Next (no un cambio de URL a mano) para que la pantalla sí se re-renderice.
const SENTINEL_MARKER = "__gm_back_guard__"

export function PwaBackGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoggedIn } = useAuth()
  const activeRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    activeRef.current =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
  }, [])

  // Re-arma el centinela cada vez que se llega al Dashboard (por login, por tocar
  // "Inicio", o por el propio guard más abajo) — así siempre queda una entrada de
  // colchón lista para atrapar el próximo "atrás" desde ahí.
  useEffect(() => {
    if (!activeRef.current || !isLoggedIn || pathname !== "/dashboard") return
    window.history.pushState({ [SENTINEL_MARKER]: true }, "", window.location.href)
  }, [pathname, isLoggedIn])

  useEffect(() => {
    if (!activeRef.current || !isLoggedIn) return

    function handlePopState(event: PopStateEvent) {
      const state = event.state as Record<string, boolean> | null
      if (!state?.[SENTINEL_MARKER]) return // "atrás" real dentro de la app, Next ya lo maneja
      if (window.location.pathname === "/dashboard") {
        window.history.pushState({ [SENTINEL_MARKER]: true }, "", window.location.href)
      } else {
        router.replace("/dashboard")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [router, isLoggedIn])

  // Coloca el primer centinela apenas hay sesión activa (cubre entrar directo a una
  // pantalla que no es el Dashboard, ej. un enlace profundo) — sin esto, el primer
  // "atrás" de la sesión no tendría nada que atrapar.
  useEffect(() => {
    if (!activeRef.current || !isLoggedIn) return
    window.history.pushState({ [SENTINEL_MARKER]: true }, "", window.location.href)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  return null
}
