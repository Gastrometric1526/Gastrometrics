"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { logActivity, type ActivityModule } from "@/lib/services/activity-log"

/**
 * Registra "entró a tal módulo" en el log real de Actividad (ver docs/87) — pedido
 * explícito del dueño del proyecto: la tarjeta "Actividad" debe mostrar si alguien
 * entró a un módulo, y en el caso de equipo, quién.
 *
 * Mismo patrón que PresenceTracker/AnalyticsTracker/ThemeInitializer: componente
 * cliente global, montado una sola vez en app/layout.tsx, sin UI propia — no se toca
 * ninguna página de módulo individualmente. Lista blanca de rutas (no lista negra),
 * para no registrar nunca marketing, auth, ni /admin.
 */

const MODULE_ROUTES: Record<string, ActivityModule> = {
  "/dashboard": "dashboard",
  "/ficha-tecnica": "ficha_tecnica",
  "/mis-recetas": "recetas",
  "/ingredientes": "ingredientes",
  "/inventario": "inventario",
  "/equipo": "equipo",
  "/menus": "menus",
  "/menu-y-compras": "ordenes_compra",
  "/estadisticas": "estadisticas",
  "/negocios": "negocios",
}

function resolveModule(pathname: string | null): ActivityModule | null {
  if (!pathname) return null
  if (pathname.startsWith("/business/")) return "negocios"
  return MODULE_ROUTES[pathname] || null
}

function resolveBusinessId(pathname: string | null, searchParams: URLSearchParams): string | null {
  const businessRouteMatch = pathname?.match(/^\/business\/([^/?]+)/)
  return businessRouteMatch?.[1] || searchParams.get("business") || null
}

export function ModuleActivityTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLoggedIn, user } = useAuth()
  const lastLoggedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn || !user) return

    const module = resolveModule(pathname)
    if (!module) return

    const businessId = resolveBusinessId(pathname, searchParams)
    const dedupeKey = `${module}|${businessId ?? ""}`
    if (lastLoggedRef.current === dedupeKey) return
    lastLoggedRef.current = dedupeKey

    logActivity({ user, businessId, module, action: "entered" })
  }, [pathname, searchParams, isLoggedIn, user])

  return null
}
