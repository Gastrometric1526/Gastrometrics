"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"

/**
 * Analíticas propias, guardadas en Supabase (ver docs/67 y app/api/track/route.ts) —
 * un `fetch` en cada cambio de ruta, en segundo plano, sin bloquear nada. No manda
 * nada para /admin, para no contaminar las estadísticas con las propias visitas del
 * dueño a su panel.
 */
export function AnalyticsTracker() {
  const pathname = usePathname()
  const { language } = useLanguage()

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive: el navegador puede terminar de mandar esto aunque la persona ya
      // haya navegado a la siguiente página antes de que la respuesta vuelva.
      keepalive: true,
      body: JSON.stringify({
        path: pathname,
        language,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
