"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { applyThemeAttribute, DEFAULT_THEME_SLUG, effectiveThemeSlug } from "@/lib/theme-colors"
import { THEME_PREFS_EVENT, saveDisplayMode, syncThemeFromAccount } from "@/lib/theme-sync"
import { useAuth } from "@/contexts/auth-context"
import { useAllBusinesses } from "@/lib/storage/businesses"

// Páginas públicas de marketing — deben verse siempre igual (claro, Naranja Brasa) sin
// importar el modo oscuro ni el color de tema que el usuario haya guardado en la app,
// a pedido explícito del dueño del proyecto. Ojo al agregar una ruta nueva de marketing:
// hay que sumarla aquí también, o heredará el tema de quien esté logueado en ese navegador.
const MARKETING_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/about$/,
  /^\/planes$/,
  /^\/contacto$/,
  /^\/terminos-de-uso$/,
  /^\/politica-privacidad$/,
  /^\/caracteristicas(\/|$)/,
  /^\/recursos(\/|$)/,
]

function isMarketingRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return MARKETING_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}

// BUG CORREGIDO: el tema de color guardado (del dashboard principal o de un negocio
// específico) solo se re-aplicaba cuando el usuario abría el selector que lo lee
// (ThemeSwitcher, montado dentro del diálogo de Configuración o del menú de tema en
// la página de negocio — ambos son contenido de Radix que no se monta hasta que se
// abre). En cualquier carga fresca de página, o navegación a una pantalla que nunca
// abre ese selector, el tema volvía en silencio al default (Naranja Brasa) aunque
// localStorage ya tuviera guardado otro color — el usuario tenía que reabrir
// Configuración cada vez para "recuperar" su color.
//
// Este componente, montado una sola vez en el layout raíz, no tiene UI propia: solo
// re-aplica el tema correcto cada vez que cambia la ruta o el negocio activo (ya sea
// por segmento de ruta `/business/{id}` o por query param `?business={id}`, los dos
// patrones que ya usa el resto de la app), sin depender de que el usuario abra ningún
// selector primero.
export function ThemeInitializer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // resolvedTheme (no theme) porque también cubre "system" resuelto al claro/oscuro real
  // del sistema operativo — es lo mismo que next-themes usa internamente para decidir la
  // clase "dark" en <html>.
  const { resolvedTheme, theme, setTheme } = useTheme()
  const { user } = useAuth()
  const businesses = useAllBusinesses()
  // Sube cuando cambia una preferencia (aquí o desde la cuenta) para volver a aplicar el color.
  const [prefsVersion, setPrefsVersion] = useState(0)
  useEffect(() => {
    const bump = () => setPrefsVersion((v) => v + 1)
    window.addEventListener(THEME_PREFS_EVENT, bump)
    return () => window.removeEventListener(THEME_PREFS_EVENT, bump)
  }, [])

  // Lo que tiene la cuenta manda en cualquier aparato (docs/309).
  const accountMode = useRef<string | null>(null)
  const synced = useRef(false)
  // Modo que se está aplicando desde la cuenta: mientras llega, no se sube nada (si no, el
  // modo viejo de este aparato pisaría el de la cuenta).
  const incomingMode = useRef<string | null>(null)
  useEffect(() => {
    if (!user) return
    const { displayMode } = syncThemeFromAccount(user.user_metadata, businesses)
    accountMode.current = displayMode
    synced.current = true
    if (displayMode && displayMode !== theme) {
      incomingMode.current = displayMode
      setTheme(displayMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, businesses])

  // Modo claro/oscuro elegido en este aparato: se guarda en la cuenta para los demás.
  useEffect(() => {
    if (!user || !synced.current || !theme) return
    if (theme !== "light" && theme !== "dark" && theme !== "system") return
    if (incomingMode.current) {
      if (incomingMode.current === theme) incomingMode.current = null
      return
    }
    if (accountMode.current === theme) return
    accountMode.current = theme
    void saveDisplayMode(theme)
  }, [user, theme])

  useEffect(() => {
    const marketing = isMarketingRoute(pathname)

    if (marketing) {
      // Color de marca fijo en marketing, sin importar lo que la cuenta logueada en este
      // navegador tenga guardado — nunca lee localStorage aquí.
      applyThemeAttribute(DEFAULT_THEME_SLUG)
    } else {
      const businessRouteMatch = pathname?.match(/^\/business\/([^/?]+)/)
      const businessId = businessRouteMatch?.[1] || searchParams.get("business")
      // El color del negocio si tiene uno propio; si no, el de la persona (docs/309).
      applyThemeAttribute(effectiveThemeSlug(businessId))
    }

    // Claro/oscuro: en marketing siempre claro. Se manipula la clase "dark" de <html>
    // directo (en vez de useTheme().setTheme, que persiste en localStorage["theme"]) para
    // no pisar la preferencia real del usuario — con setTheme, cerrar el navegador
    // estando en "/" habría guardado "claro" como si fuera su elección real, y su modo
    // oscuro real se habría perdido. Al salir de marketing, se vuelve a alinear la clase
    // con resolvedTheme (lo que next-themes ya sabe que es la preferencia real) por si
    // esta misma pestaña vino de haber forzado claro en una página de marketing.
    if (typeof document !== "undefined") {
      if (marketing) {
        document.documentElement.classList.remove("dark")
      } else if (resolvedTheme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }, [pathname, searchParams, resolvedTheme, prefsVersion])

  return null
}
