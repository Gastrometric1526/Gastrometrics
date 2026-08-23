"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ChefHat, UtensilsCrossed, Package, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

// Barra de navegación inferior en móvil (ver docs/36, prioridad alta #2): antes el
// drawer lateral era el único acceso a la navegación en teléfono, y su botón hamburguesa
// se solapaba con el botón "Volver" de cada pantalla. Estos 5 destinos son los de mayor
// uso — el resto (Ingredientes, Órdenes de Compra, Ficha Técnica, Ajustes...) sigue
// disponible desde el drawer completo.
const items = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/mis-recetas", label: "Recetas", icon: ChefHat },
  { href: "/menus", label: "Menús", icon: UtensilsCrossed },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/estadisticas", label: "Números", icon: BarChart3 },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-sm border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        const Icon = item.icon
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
