"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { applyThemeAttribute, DEFAULT_THEME_SLUG } from "@/lib/theme-colors"

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
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const marketing = isMarketingRoute(pathname)

    if (marketing) {
      // Color de marca fijo en marketing, sin importar lo que la cuenta logueada en este
      // navegador tenga guardado — nunca lee localStorage aquí.
      applyThemeAttribute(DEFAULT_THEME_SLUG)
    } else {
      const businessRouteMatch = pathname?.match(/^\/business\/([^/?]+)/)
      const businessId = businessRouteMatch?.[1] || searchParams.get("business")
      const themeKey = businessId ? `business_${businessId}_color_theme` : "main_color_theme"
      const savedTheme = typeof window !== "undefined" ? localStorage.getItem(themeKey) : null
      applyThemeAttribute(savedTheme || DEFAULT_THEME_SLUG)
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
  }, [pathname, searchParams, resolvedTheme])

  return null
}
