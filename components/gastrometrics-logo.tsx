"use client"

import { useEffect, useState } from "react"
import { BRAND_LOGO_SRC, getThemeLogoSrc } from "@/lib/theme-colors"

type GastrometricsLogoProps = {
  className?: string
  title?: string
  /**
   * "brand": naranja fijo — fuera de la sesión (landing, /planes, login/registro, PDFs,
   * íconos de sistema). "theme": recoloreado al tema activo del negocio — dentro de la
   * sesión (sidebar, tour, estados vacíos). Ver docs/36, sección 1, "Regla de color".
   */
  variant?: "brand" | "theme"
}

// Logo oficial: círculo sólido con un tenedor en negativo cuyos dientes ascienden como
// barras de una gráfica (ver docs/36). El tenedor es transparente, no blanco — por eso
// un solo PNG por tema sirve en claro y en oscuro, igual que antes hacía el SVG dibujado
// a mano con hsl(var(--background)). Reemplaza ese SVG por el PNG oficial del tema activo.
export function GastrometricsLogo({ className, title = "Gastrometrics", variant = "theme" }: GastrometricsLogoProps) {
  const [themedSrc, setThemedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (variant !== "theme") return
    const updateFromDom = () => setThemedSrc(getThemeLogoSrc(document.documentElement.getAttribute("data-theme")))
    updateFromDom()
    // El selector de temas dispara este evento al cambiar (ver theme-switcher.tsx) —
    // sin esto, un logo ya montado (ej. el del sidebar) se queda con el PNG del tema
    // anterior hasta la próxima navegación completa.
    window.addEventListener("gm:theme-changed", updateFromDom)
    return () => window.removeEventListener("gm:theme-changed", updateFromDom)
  }, [variant])

  // Antes de montar (o fuera de sesión), naranja fijo: es el mismo valor que trae :root
  // por defecto, así que no hay parpadeo para la mayoría de los negocios nuevos.
  const src = variant === "brand" ? BRAND_LOGO_SRC : themedSrc || BRAND_LOGO_SRC

  // BUG EVITADO: un tamaño por defecto concatenado junto al className recibido (ej.
  // `h-10 w-10 ${className}`) compite con cualquier clase de alto/ancho que pase el
  // que llama — Tailwind no garantiza que la clase que aparece después en el string
  // gane en el CSS generado. Por eso el tamaño por defecto solo se aplica cuando no
  // se pasó className, nunca junto a uno.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={title} className={`object-contain ${className || "h-10 w-10"}`} />
}
