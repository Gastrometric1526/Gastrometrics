"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { applyThemeAttribute, DEFAULT_THEME_SLUG } from "@/lib/theme-colors"

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

  useEffect(() => {
    const businessRouteMatch = pathname?.match(/^\/business\/([^/?]+)/)
    const businessId = businessRouteMatch?.[1] || searchParams.get("business")
    const themeKey = businessId ? `business_${businessId}_color_theme` : "main_color_theme"
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem(themeKey) : null
    applyThemeAttribute(savedTheme || DEFAULT_THEME_SLUG)
  }, [pathname, searchParams])

  return null
}
