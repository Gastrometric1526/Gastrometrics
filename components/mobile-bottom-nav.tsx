"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ChefHat, UtensilsCrossed, Package, BarChart3, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getMinimumPlanForFeature } from "@/lib/plan-access"
import { useToast } from "@/hooks/use-toast"

// Barra de navegación inferior en móvil (ver docs/36, prioridad alta #2): antes el
// drawer lateral era el único acceso a la navegación en teléfono, y su botón hamburguesa
// se solapaba con el botón "Volver" de cada pantalla. Estos 5 destinos son los de mayor
// uso — el resto (Ingredientes, Órdenes de Compra, Ficha Técnica, Ajustes...) sigue
// disponible desde el drawer completo.
export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { toast } = useToast()
  // Mismo candado visual por plan que components/sidebar.tsx (ver ese archivo para el
  // porqué): "Menús" e "Inventario" son los 2 de los 5 destinos de esta barra que un
  // plan no los incluye necesariamente — null-safe (hidratación) igual que el resto.
  const canAccessMenus = useFeatureAccess("menus")
  const canAccessInventory = useFeatureAccess("inventory")

  const items = [
    { href: "/dashboard", label: t("mobile_nav_inicio"), icon: Home, locked: false, feature: null as const },
    { href: "/mis-recetas", label: t("mobile_nav_recetas"), icon: ChefHat, locked: false, feature: null as const },
    { href: "/menus", label: t("nav_menus"), icon: UtensilsCrossed, locked: canAccessMenus === false, feature: "menus" as const },
    { href: "/inventario", label: t("nav_inventario"), icon: Package, locked: canAccessInventory === false, feature: "inventory" as const },
    { href: "/estadisticas", label: t("mobile_nav_numeros"), icon: BarChart3, locked: false, feature: null as const },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-sm border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const Icon = item.icon

        if (item.locked) {
          const minPlan = item.feature ? getMinimumPlanForFeature(item.feature) : null
          return (
            <button
              key={item.href}
              type="button"
              aria-disabled="true"
              onClick={() =>
                toast({
                  title: t("sidebar_locked_feature_toast_title"),
                  description: minPlan
                    ? t("sidebar_locked_feature_toast_desc").replace("{plan}", minPlan.name)
                    : t("sidebar_locked_feature_toast_desc_generic"),
                })
              }
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium text-muted-foreground/50"
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                <Lock className="h-2.5 w-2.5 absolute -top-0.5 -right-1.5" />
              </span>
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </button>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            // min-h-[56px]: por encima del mínimo de 44px de objetivo táctil (ver docs/36,
            // prioridad alta #5), con margen para el dedo pulgar en la fila inferior.
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate max-w-full px-0.5">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
