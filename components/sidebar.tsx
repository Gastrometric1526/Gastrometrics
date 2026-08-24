"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import {
  ChefHat,
  Package,
  FileText,
  BarChart3,
  ShoppingCart,
  Menu,
  X,
  Home,
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  HelpCircle,
  Boxes,
  Sparkles,
  Users,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { SettingsDialog } from "@/components/settings-dialog"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"
import type { Business } from "@/types/business"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { getCurrentPlan, useFeatureAccess, useTeamPreview } from "@/lib/plan-access"
import type { FeatureKey } from "@/lib/plans"

function useNavigationItems() {
  const { t } = useLanguage()
  const canAccessTeam = useFeatureAccess("team")
  const { active: previewActive, member: previewMember } = useTeamPreview()
  const items = [
    { title: t("nav_dashboard"), href: "/dashboard", icon: Home, description: t("nav_dashboard_desc") },
    { title: t("nav_ficha_tecnica"), href: "/ficha-tecnica", icon: ChefHat, description: t("nav_ficha_tecnica_desc") },
    { title: t("nav_mis_recetas"), href: "/mis-recetas", icon: FileText, description: t("nav_mis_recetas_desc") },
    { title: t("nav_ingredientes"), href: "/ingredientes", icon: Package, description: t("nav_ingredientes_desc") },
    { title: t("nav_inventario"), href: "/inventario", icon: Boxes, description: t("nav_inventario_desc") },
  ]

  // Equipo va justo después de Inventario, y solo aparece una vez confirmado (tras
  // montar, ver useFeatureAccess) que el plan de la cuenta lo incluye — mismo patrón
  // de hidratación que el resto del gating de features (ver lib/plan-access.ts).
  if (canAccessTeam) {
    items.push({ title: t("nav_equipo"), href: "/equipo", icon: Users, description: t("nav_equipo_desc") })
  }

  items.push(
    { title: t("nav_menus"), href: "/menus", icon: UtensilsCrossed, description: t("nav_menus_desc") },
    {
      title: t("nav_ordenes_compra"),
      href: "/menu-y-compras",
      icon: ShoppingCart,
      description: t("nav_ordenes_compra_desc"),
    },
    { title: t("nav_estadisticas"), href: "/estadisticas", icon: BarChart3, description: t("nav_estadisticas_desc") },
    { title: t("nav_negocios"), href: "/negocios", icon: Building2, description: t("nav_negocios_desc") },
  )

  // Vista previa de Equipo activa (ver lib/storage/team-preview.ts): filtra la
  // navegación a exactamente lo que esa persona tiene permitido, en vez de mostrar
  // TODO lo que el plan real de la cuenta desbloquea. "Dashboard" y "Negocios" no
  // corresponden a ningún FeatureKey — dependen del alcance (scope) asignado: solo
  // ven el dashboard principal (y el listado de negocios) si su acceso es
  // "Dashboard principal", nunca si su acceso es a un negocio específico.
  if (previewActive && previewMember) {
    const hasScopeDashboard = previewMember.scope === "dashboard"
    const allowed = new Set(previewMember.allowedFeatures)
    const hrefFeatureMap: Record<string, FeatureKey[]> = {
      "/ficha-tecnica": ["recipes"],
      "/mis-recetas": ["recipes"],
      "/ingredientes": ["ingredients"],
      "/inventario": ["inventory"],
      "/menus": ["menus"],
      "/menu-y-compras": ["purchase_orders_manual", "purchase_orders_auto"],
      "/estadisticas": ["stats_panorama", "stats_finance"],
    }
    return items.filter((item) => {
      if (item.href === "/dashboard" || item.href === "/negocios") return hasScopeDashboard
      if (item.href === "/equipo") return false
      const required = hrefFeatureMap[item.href]
      if (!required) return true
      return required.some((f) => allowed.has(f))
    })
  }

  return items
}

const getContextualHref = (baseHref: string, businessId: string | null) => {
  // Si estamos dentro del contexto de un negocio específico, mantenerlo al navegar
  // por el sidebar. El id puede venir de la ruta (/business/{id}) o, una vez ya
  // dentro de una pantalla de negocio, del query param ?business= que usa cada
  // una de esas pantallas (ver app/ficha-tecnica/page.tsx, etc.) — antes solo se
  // leía de la ruta, así que el contexto se perdía en el primer click del sidebar
  // hecho desde dentro de, por ejemplo, /ficha-tecnica?business=xxx.
  if (!businessId || businessId === "main") return baseHref

  // Rutas que tienen contexto de negocio: la app usa rutas planas (no anidadas)
  // con el negocio pasado por query param ?business=, tal como lo consume cada
  // pantalla. "Dashboard" y "Negocios" quedan siempre fuera de este contexto a
  // propósito: son el dashboard principal y la lista de negocios, comparten uno
  // solo entre todos los negocios.
  const businessRoutes = [
    "/ficha-tecnica",
    "/mis-recetas",
    "/ingredientes",
    "/inventario",
    "/menus",
    "/menu-y-compras",
    "/estadisticas",
  ]
  if (businessRoutes.includes(baseHref)) {
    return `${baseHref}?business=${businessId}`
  }
  return baseHref
}

// BUG CORREGIDO: useSearchParams() (leído más abajo para conservar ?business= al
// navegar, ver getContextualHref) exige un límite de Suspense por encima para poder
// pre-renderizarse estáticamente — sin él, `next build` fallaba en cualquier página
// donde el primer render (antes de que se resuelva el estado de auth) ya montara
// <Sidebar />, como /negocios, /signup y /signup/payment. Se envuelve aquí, una sola
// vez, en vez de en cada página que use el sidebar.
export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  )
}

function SidebarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const businessPathMatch = pathname.match(/^\/business\/([^/]+)/)
  const currentBusinessId = businessPathMatch ? businessPathMatch[1] : searchParams.get("business")
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const navigationItems = useNavigationItems()
  const { active: previewActive } = useTeamPreview()
  const { theme, setTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(true) // Comienza colapsado por defecto
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const businesses = useAllBusinesses()
  const [currentPlanName, setCurrentPlanName] = useState("Foodie")

  // Persistir estado del sidebar
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-collapsed")
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState))
    }
  }, [])

  // Indicador de plan actual en el sidebar — se actualiza en vivo si el usuario
  // "compra" un plan (ver app/signup/payment/page.tsx) sin recargar la página.
  useEffect(() => {
    setCurrentPlanName(getCurrentPlan().name)
    const onPlanChanged = () => setCurrentPlanName(getCurrentPlan().name)
    window.addEventListener("planChanged", onPlanChanged)
    return () => window.removeEventListener("planChanged", onPlanChanged)
  }, [])

  const forcedByTourRef = useRef(false)
  const stateBeforeTourRef = useRef<{ collapsed: boolean; mobileOpen: boolean } | null>(null)

  useEffect(() => {
    if (forcedByTourRef.current) return
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed))
  }, [isCollapsed])

  // El tour guiado (components/onboarding-tour.tsx) necesita el sidebar expandido
  // (y abierto en móvil) para poder señalar cada sección por su nombre — sin esto
  // solo se verían íconos sueltos de 16px. Se restaura el estado real del usuario
  // al terminar, sin persistir el forzado como si fuera su preferencia.
  useEffect(() => {
    const handler = (e: Event) => {
      const active = (e as CustomEvent<{ active: boolean }>).detail?.active
      if (active) {
        setIsCollapsed((current) => {
          setIsMobileOpen((currentMobile) => {
            stateBeforeTourRef.current = { collapsed: current, mobileOpen: currentMobile }
            return window.innerWidth < 768 ? true : currentMobile
          })
          forcedByTourRef.current = true
          return false
        })
      } else {
        forcedByTourRef.current = false
        if (stateBeforeTourRef.current) {
          setIsCollapsed(stateBeforeTourRef.current.collapsed)
          setIsMobileOpen(stateBeforeTourRef.current.mobileOpen)
          stateBeforeTourRef.current = null
        }
      }
    }
    window.addEventListener("gm:tour", handler)
    return () => window.removeEventListener("gm:tour", handler)
  }, [])

  const { toast } = useToast()

  const handleLogout = () => {
    logout()
    // Navegación dura (no router.push): las páginas protegidas tienen su propio
    // guard que redirige a /login en cuanto isLoggedIn pasa a false, y ese guard
    // gana la carrera contra un router.push a "/" hecho desde aquí. Un cambio de
    // página completo no puede perder esa carrera.
    window.location.href = "/"
  }

  // Reactiva el tutorial de la página actual — el tour normal solo se muestra una vez
  // (bandera en localStorage, ver components/page-tour.tsx), este botón la borra y
  // fuerza a reabrirse desde el paso 1, sin importar si ya se vio antes.
  const handleRestartTour = () => {
    window.dispatchEvent(new CustomEvent("gm:tour:restart"))
    toast({ title: t("sidebar_restart_tour_toast") })
  }

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <>
      {/* Mobile Menu Button — en top-4 right-4, no left-4: el botón "Volver" de cada
          pantalla vive en top-4 left-4 dentro del contenido, y colisionaba con este
          botón fijo (ver docs/36). Ahora accede al drawer completo (Ingredientes, Órdenes
          de Compra, Ficha Técnica, Ajustes...); la navegación más usada vive en
          MobileBottomNav, abajo. */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "fixed right-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border border-border",
          previewActive ? "top-14" : "top-4",
        )}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <MobileBottomNav />

      {/* Sidebar */}
      <div
        data-tour="sidebar"
        className={cn(
          "fixed left-0 z-40 bg-card border-r border-border transition-all duration-300 flex flex-col",
          previewActive ? "top-10 h-[calc(100%-2.5rem)]" : "top-0 h-full",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Header */}
        <div className={cn("p-3 sm:p-4 border-b border-border", isCollapsed && "p-2")}>
          {isCollapsed ? (
            <div className="hidden md:flex flex-col items-center gap-2">
              <GastrometricsLogo className="h-7 w-7" />
              <Button variant="ghost" size="sm" onClick={toggleSidebar} className="h-8 w-8 p-0 hover:bg-accent">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <GastrometricsLogo className="h-8 w-8 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground text-sm truncate">Gastrometrics</h2>
                  <p className="text-xs text-muted-foreground truncate">Sistema gastronómico</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-accent flex-shrink-0 hidden md:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* User Info */}
        {!isCollapsed && (
          <div className="p-3 sm:p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs sm:text-sm font-medium text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate text-sm">{user?.name || "Usuario"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || "usuario@email.com"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn("flex-1 p-2 space-y-1 overflow-y-auto", isCollapsed ? "overflow-hidden" : "")}>
          {navigationItems.map((item) => {
            // BUG CORREGIDO: "Órdenes de Compra" apunta a /menu-y-compras, que es solo un
            // shell que hace router.replace() a /business/{id}/ordenes-compra (o
            // /ordenes-compra) — una vez que el redirect aterriza, pathname ya no
            // empezaba con /menu-y-compras, así que el ítem nunca se marcaba activo
            // mientras el usuario de verdad estaba viendo esa sección.
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/") ||
              (item.href === "/menu-y-compras" && (pathname === "/ordenes-compra" || pathname.includes("/ordenes-compra")))
            const contextualHref = getContextualHref(item.href, currentBusinessId)

            return (
              <Link key={item.href} href={contextualHref}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    isCollapsed && "justify-center px-2",
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0",
                      isActive ? "text-primary" : "text-foreground/70 group-hover:text-foreground",
                    )}
                  />

                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{item.title}</p>
                      <p className="text-xs opacity-75 truncate hidden sm:block">{item.description}</p>
                    </div>
                  )}

                  {!isCollapsed && isActive && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/20 text-primary text-xs flex-shrink-0 hidden sm:inline-flex"
                    >
                      Activo
                    </Badge>
                  )}

                  {/* Tooltip para modo colapsado */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.title}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}

          {/* Dashboard Navigation */}
          {pathname.startsWith("/business/") && !isCollapsed && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Navegación
              </div>
              <Link href="/dashboard">
                <div
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Home className="h-4 w-4 flex-shrink-0 text-foreground/70 group-hover:text-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">Dashboard Principal</p>
                    <p className="text-xs opacity-75 truncate hidden sm:block">Volver al panel principal</p>
                  </div>
                </div>
              </Link>
            </>
          )}

          {/* Businesses Section - Solo mostrar en dashboard principal */}
          {businesses.length > 0 && !isCollapsed && !pathname.startsWith("/business/") && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mis Negocios
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {businesses.map((business) => {
                  const businessPath = `/business/${business.id}`
                  const isBusinessActive = pathname.startsWith(businessPath)

                  return (
                    <Link key={business.id} href={businessPath}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                          isBusinessActive
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        )}
                        onClick={() => setIsMobileOpen(false)}
                      >
                        <Building2
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isBusinessActive ? "text-primary" : "text-foreground/70 group-hover:text-foreground",
                          )}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{business.name}</p>
                          <p className="text-xs opacity-75 truncate hidden sm:block">Dashboard del negocio</p>
                        </div>

                        {isBusinessActive && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/20 text-primary text-xs flex-shrink-0 hidden sm:inline-flex"
                          >
                            Activo
                          </Badge>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className={cn("p-2 border-t border-border space-y-1", isCollapsed && "p-1")}>
          {/* Reiniciar tutorial de la página actual */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestartTour}
            className={cn(
              "w-full justify-start gap-2 hover:bg-accent relative group",
              isCollapsed && "justify-center px-2",
            )}
          >
            <HelpCircle className="h-4 w-4 flex-shrink-0 text-foreground/70" />
            {!isCollapsed && <span className="text-sm">{t("sidebar_restart_tour")}</span>}

            {/* Tooltip para modo colapsado */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {t("sidebar_restart_tour")}
              </div>
            )}
          </Button>

          {/* Plan actual — punto de descubrimiento hacia /mi-plan (versión dentro del
              dashboard de /planes, la pública) desde dentro de la app. BUG CORREGIDO:
              antes esto mandaba a /planes, sacando por completo al usuario del shell
              de la app para cambiar de plan y volviendo recién después. */}
          <Link href="/mi-plan">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start gap-2 hover:bg-accent relative group",
                isCollapsed && "justify-center px-2",
              )}
            >
              <Sparkles className="h-4 w-4 flex-shrink-0 text-foreground/70" />
              {!isCollapsed && (
                <span className="text-sm truncate">
                  Plan: <span className="font-medium">{currentPlanName}</span>
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Plan: {currentPlanName}
                </div>
              )}
            </Button>
          </Link>

          {/* Settings with Theme Selector */}
          <SettingsDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2 hover:bg-accent relative group",
                  isCollapsed && "justify-center px-2",
                )}
              >
                <Settings className="h-4 w-4 flex-shrink-0 text-foreground/70" />
                {!isCollapsed && <span className="text-sm">{t("nav_ajustes")}</span>}

                {/* Tooltip para modo colapsado */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {t("nav_ajustes")}
                  </div>
                )}
              </Button>
            }
          />

          {/* Logout */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2 hover:bg-destructive/10 hover:text-destructive relative group",
                  isCollapsed && "justify-center px-2",
                )}
              >
                <LogOut className="h-4 w-4 flex-shrink-0 text-foreground/70" />
                {!isCollapsed && <span className="text-sm">Salir</span>}

                {/* Tooltip para modo colapsado */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Salir
                  </div>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a salir de tu cuenta y volver a la página principal. Todo lo que ya guardaste queda intacto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout}>Cerrar sesión</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main content spacer */}
      <div className={cn("hidden md:block transition-all duration-300", isCollapsed ? "w-16" : "w-64")} />
    </>
  )
}
