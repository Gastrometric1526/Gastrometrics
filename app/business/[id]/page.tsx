"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  FileText,
  Database,
  ShoppingCart,
  UtensilsCrossed,
  Settings,
  Palette,
  Monitor,
  SunIcon,
  MoonIcon,
  ArrowLeft,
  Store,
  BarChart3,
  Calculator,
  TrendingUp,
  Target,
  DollarSign,
  Save,
  Eye,
  AlertCircle,
  Info,
  PieChart as PieChartIcon,
  Activity,
  Bell,
  ImageIcon,
  Trash2,
  Upload,
} from "lucide-react"
import type { Business } from "@/types/business"
import { calculateTotalMonthlyExpenses } from "@/types/business"
import { useToast } from "@/hooks/use-toast"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getDashboardData } from "@/utils/dashboard"
import { updateBusiness, getBusinessById, refreshBusinesses } from "@/lib/storage/businesses"
import { compressLogoToDataUrl } from "@/lib/utils/logo-compress"
import { useTeamPreview } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ActivityTracker, type UserActivity, type SystemAlert } from "@/lib/activity-tracker"
import { getMenus } from "@/lib/menus"
import { addScenarioResult } from "@/lib/storage/menus.store"
import { calculateScenario, generateRecommendation } from "@/lib/analytics/menuScenario"
import type { Menu, MenuSection, ScenarioParams, ScenarioResult } from "@/lib/types/menus"
import { formatCurrency } from "@/lib/currency"

const roundToNextHundred = (num: number) => {
  return Math.ceil(num / 100) * 100
}

const defaultExpenses = {
  rent: 0,
  utilities: 0,
  operationalCosts: 0,
  marketing: 0,
  laborCosts: 0,
  otherExpenses: 0,
}

export default function BusinessDashboard({ params }: { params: { id: string } }) {
  const [business, setBusiness] = useState<Business | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [editedBusiness, setEditedBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<UserActivity[]>([])
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [menus, setMenus] = useState<Menu[]>([])
  const [selectedMenuId, setSelectedMenuId] = useState<string>("")
  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    businessId: params.id,
    menuId: "",
    capacity: { seats: 20, servicesPerDay: 2, daysOpen: 25, occupancy: 0.7 },
    mixMethod: "heuristica",
    categoryWeights: { entrada: 20, fuerte: 55, postre: 10, bebida: 15 },
    upsellBebidas: false,
  })
  const [currentScenario, setCurrentScenario] = useState<ScenarioResult | null>(null)
  const [showScenarioDetails, setShowScenarioDetails] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isLogoDialogOpen, setIsLogoDialogOpen] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isCompressingLogo, setIsCompressingLogo] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
  const { isLoggedIn, authChecked } = useAuth()
  const { active: previewActive, member: previewMember } = useTeamPreview()
  const { setTheme } = useTheme()

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

  const expenseCategories = useMemo(
    () => [
      { key: "rent", label: "Renta", color: "#FF6B6B", icon: "🏢" },
      { key: "utilities", label: "Servicios", color: "#4ECDC4", icon: "⚡" },
      { key: "operationalCosts", label: "Operación", color: "#45B7D1", icon: "⚙️" },
      { key: "marketing", label: "Marketing", color: "#96CEB4", icon: "📢" },
      { key: "laborCosts", label: "Personal", color: "#FFEAA7", icon: "👥" },
      { key: "otherExpenses", label: "Otros", color: "#DDA0DD", icon: "📦" },
    ],
    [],
  )

  const [chartData, setChartData] = useState<{ name: string; value: number; color: string }[]>([])

  useEffect(() => {
    if (business?.expenses) {
      const totalExpenses = calculateTotalMonthlyExpenses(business.expenses)
      const data = Object.entries(business.expenses)
        .map(([key, value]) => {
          const category = expenseCategories.find((cat) => cat.key === key)
          return {
            name: category?.label || key,
            value: Number(value),
            color: category?.color || "#9ca3af",
          }
        })
        .filter((item) => item.value > 0)
      setChartData(data)
    }
  }, [business, expenseCategories])

  useEffect(() => {
    if (!authChecked) return

    if (!isLoggedIn) {
      router.push("/login")
      return
    }

    const loadBusiness = async () => {
      try {
        await refreshBusinesses()
        const currentBusiness = getBusinessById(params.id)

        if (!currentBusiness) {
          toast({
            title: "Negocio no encontrado",
            description: "El negocio que buscas no existe o ha sido eliminado.",
            variant: "destructive",
          })
          router.push("/dashboard")
          return
        }

        // Ensure business has proper structure with safe defaults
        const businessWithDefaults: Business = {
          ...currentBusiness,
          expenses: {
            rent: Number(currentBusiness.expenses?.rent) || 0,
            utilities: Number(currentBusiness.expenses?.utilities) || 0,
            operationalCosts: Number(currentBusiness.expenses?.operationalCosts) || 0,
            marketing: Number(currentBusiness.expenses?.marketing) || 0,
            laborCosts: Number(currentBusiness.expenses?.laborCosts) || 0,
            otherExpenses: Number(currentBusiness.expenses?.otherExpenses) || 0,
          },
          hasFinancialData: currentBusiness.hasFinancialData || false,
          estimatedMonthlyPlates: Number(currentBusiness.estimatedMonthlyPlates) || 0,
          netProfitPercentage: Number(currentBusiness.netProfitPercentage) || 0,
        }

        setBusiness(businessWithDefaults)
        setEditedBusiness({
          ...businessWithDefaults,
          expenses: businessWithDefaults.expenses || defaultExpenses,
        })

        // BUG CORREGIDO: al navegar de un negocio a otro sin recargar la página (misma
        // ruta, Next.js no remonta el componente), selectedMenuId/scenarioParams.menuId
        // seguían apuntando al menú del negocio ANTERIOR — loadMenus() solo auto-selecciona
        // un menú nuevo "si no hay uno ya elegido", y como el ID viejo seguía ahí (aunque
        // perteneciera a otro negocio), nunca se actualizaba. El simulador de escenarios
        // podía quedar mostrando resultados calculados para el negocio anterior bajo el
        // encabezado del nuevo. Se resetea explícitamente antes de volver a cargar menús.
        setSelectedMenuId("")
        setScenarioParams((prev) => ({ ...prev, businessId: params.id, menuId: "" }))
        setCurrentScenario(null)

        // loadMenus() lee `selectedMenuId` de su clausura, que en esta misma pasada
        // síncrona del efecto todavía no refleja el setSelectedMenuId("") de arriba
        // (las actualizaciones de estado de React no son síncronas) — se le pasa
        // explícito que fuerce la selección para no depender de ese valor obsoleto.
        loadMenus(true)

        // Load business-specific activity and alerts
        loadBusinessActivity()
        loadBusinessAlerts()

        // Cargar datos específicos del negocio
        const ingredients = getDashboardData("ingredients", params.id)
        const recipes = getDashboardData("recipes", params.id)
        const purchaseOrders = getDashboardData("purchaseOrders", params.id)

        console.log("Ingredientes del negocio:", ingredients)
        console.log("Recetas del negocio:", recipes)
        console.log("Órdenes de compra del negocio:", purchaseOrders)
      } catch (error) {
        console.error("Error loading business:", error)
        toast({
          title: "Error",
          description: "Hubo un problema al cargar el negocio.",
          variant: "destructive",
        })
        router.push("/dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadBusiness()
  }, [params.id, router, isLoggedIn, authChecked, toast])

  const loadMenus = (forceSelectFirst = false) => {
    try {
      const businessMenus = getMenus(params.id)
      setMenus(businessMenus)
      if (businessMenus.length > 0 && (forceSelectFirst || !selectedMenuId)) {
        setSelectedMenuId(businessMenus[0].id)
        setScenarioParams((prev) => ({ ...prev, menuId: businessMenus[0].id }))
      }
    } catch (error) {
      console.error("Error loading menus:", error)
    }
  }

  const loadBusinessActivity = () => {
    try {
      const activities = ActivityTracker.getRecentActivities(params.id, 10)
      setRecentActivity(activities)
    } catch (error) {
      console.error("Error loading business activity:", error)
      setRecentActivity([])
    }
  }

  const loadBusinessAlerts = () => {
    try {
      const alerts = ActivityTracker.getAlerts(params.id).slice(0, 5)
      setSystemAlerts(alerts)
    } catch (error) {
      console.error("Error loading business alerts:", error)
      setSystemAlerts([])
    }
  }

  const calculateCurrentScenario = () => {
    if (!selectedMenuId || !business?.expenses) {
      toast({
        title: "Datos incompletos",
        description: "Selecciona un menú y asegúrate de que los datos financieros estén configurados.",
        variant: "destructive",
      })
      return
    }

    setIsCalculating(true)

    try {
      const params: ScenarioParams = {
        ...scenarioParams,
        businessId: business.id,
        menuId: selectedMenuId,
      }

      const result = calculateScenario(business.id, selectedMenuId, params)

      if (result) {
        setCurrentScenario(result)
        toast({
          title: "Escenario calculado",
          description: "Los KPIs han sido calculados exitosamente.",
        })
      } else {
        toast({
          title: "Error en el cálculo",
          description: "No se pudo calcular el escenario. Verifica los datos del menú.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error calculating scenario:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al calcular el escenario.",
        variant: "destructive",
      })
    } finally {
      setIsCalculating(false)
    }
  }

  const saveCurrentScenario = () => {
    if (!currentScenario) return

    try {
      addScenarioResult(business!.id, currentScenario)
      toast({
        title: "Escenario guardado",
        description: "El escenario ha sido guardado en las estadísticas.",
      })
    } catch (error) {
      console.error("Error saving scenario:", error)
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el escenario.",
        variant: "destructive",
      })
    }
  }

  const updateCategoryWeight = (section: MenuSection, value: number) => {
    const newWeights = { ...scenarioParams.categoryWeights, [section]: value }

    // Normalize to 100%
    const total = Object.values(newWeights).reduce((sum, val) => sum + (val || 0), 0)
    if (total > 0) {
      Object.keys(newWeights).forEach((key) => {
        newWeights[key as MenuSection] = Math.round((newWeights[key as MenuSection]! / total) * 100)
      })
    }

    setScenarioParams((prev) => ({ ...prev, categoryWeights: newWeights }))
  }

  const menuItems = useMemo(
    () => [
      {
        href: `/ficha-tecnica?business=${params.id}`,
        text: "Ficha Técnica",
        icon: FileText,
        description: "Crear y gestionar fichas técnicas de recetas",
        bgColor: "bg-chart-1/10 group-hover:bg-chart-1/20",
        textColor: "text-chart-1",
      },
      {
        href: `/ingredientes?business=${params.id}`,
        text: "Base de Datos de Ingredientes",
        icon: Database,
        description: "Gestionar ingredientes y precios del negocio",
        bgColor: "bg-chart-2/10 group-hover:bg-chart-2/20",
        textColor: "text-chart-2",
      },
      {
        href: `/menus?business=${params.id}`,
        text: "Menús",
        icon: UtensilsCrossed,
        description: "Crear y gestionar menús del negocio",
        bgColor: "bg-chart-3/10 group-hover:bg-chart-3/20",
        textColor: "text-chart-3",
      },
      {
        href: `/menu-y-compras?business=${params.id}`,
        text: "Órdenes de Compra",
        icon: ShoppingCart,
        description: "Generar órdenes de compra",
        bgColor: "bg-chart-4/10 group-hover:bg-chart-4/20",
        textColor: "text-chart-4",
      },
      {
        href: `/mis-recetas?business=${params.id}`,
        text: "Mis Recetas",
        icon: UtensilsCrossed,
        description: "Explorar y organizar recetas guardadas",
        bgColor: "bg-chart-5/10 group-hover:bg-chart-5/20",
        textColor: "text-chart-5",
      },
      {
        href: `/inventario?business=${params.id}`,
        text: "Inventario",
        icon: Store,
        description: "Control de stock y gestión de almacén",
        bgColor: "bg-chart-6/10 group-hover:bg-chart-6/20",
        textColor: "text-chart-6",
      },
      {
        href: `/estadisticas?business=${params.id}`,
        text: "Estadísticas",
        icon: BarChart3,
        description: "Análisis y reportes detallados del negocio",
        bgColor: "bg-chart-7/10 group-hover:bg-chart-7/20",
        textColor: "text-chart-7",
      },
    ],
    [params.id],
  ).filter((item) => {
    // BUG CORREGIDO: mismo problema que la grilla de Acciones Rápidas del dashboard
    // principal (ver app/dashboard/page.tsx) — sin esto, el dashboard de un negocio
    // seguía mostrando las 7 tarjetas completas aunque el administrador solo le
    // hubiera dado a esta persona acceso a una o dos herramientas.
    if (!previewActive || !previewMember) return true
    const hrefFeatureMap: Record<string, string[]> = {
      "/ficha-tecnica": ["recipes"],
      "/mis-recetas": ["recipes"],
      "/ingredientes": ["ingredients"],
      "/inventario": ["inventory"],
      "/menus": ["menus"],
      "/menu-y-compras": ["purchase_orders_manual", "purchase_orders_auto"],
      "/estadisticas": ["stats_panorama", "stats_finance"],
    }
    const base = item.href.split("?")[0]
    const required = hrefFeatureMap[base]
    if (!required) return true
    return required.some((f) => previewMember.allowedFeatures.includes(f as any))
  })

  const handleConfigSave = () => {
    if (editedBusiness) {
      const updatedBusiness: Business = {
        ...editedBusiness,
        hasFinancialData: true,
        expenses: {
          rent: Number(editedBusiness.expenses?.rent) || 0,
          utilities: Number(editedBusiness.expenses?.utilities) || 0,
          operationalCosts: Number(editedBusiness.expenses?.operationalCosts) || 0,
          marketing: Number(editedBusiness.expenses?.marketing) || 0,
          laborCosts: Number(editedBusiness.expenses?.laborCosts) || 0,
          otherExpenses: Number(editedBusiness.expenses?.otherExpenses) || 0,
        },
        estimatedMonthlyPlates: Number(editedBusiness.estimatedMonthlyPlates) || 0,
      }

      setBusiness(updatedBusiness)
      updateBusiness(updatedBusiness.id, updatedBusiness)

      // Track activity
      try {
        ActivityTracker.addActivity(t("business_activity_financial_updated"), "business", params.id)
        ActivityTracker.addAlert(
          "success",
          t("business_alert_config_updated_title"),
          t("business_alert_config_updated_desc"),
          params.id,
        )
      } catch (error) {
        console.error("Error tracking activity:", error)
      }

      setIsConfigOpen(false)
      toast({
        title: "Configuración actualizada",
        description: "Los datos financieros del negocio han sido actualizados exitosamente.",
      })

      // Reload activity
      loadBusinessActivity()
      loadBusinessAlerts()
    }
  }

  const handleMarkAlertAsRead = (alertId: string) => {
    try {
      ActivityTracker.markAlertAsRead(alertId, params.id)
      loadBusinessAlerts()
    } catch (error) {
      console.error("Error marking alert as read:", error)
    }
  }

  const openLogoDialog = () => {
    setLogoPreview(business?.logo || null)
    setIsLogoDialogOpen(true)
  }

  const handleLogoFileChange = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Elige un archivo de imagen (PNG, JPG, etc).", variant: "destructive" })
      return
    }
    setIsCompressingLogo(true)
    try {
      const dataUrl = await compressLogoToDataUrl(file)
      setLogoPreview(dataUrl)
    } catch (error) {
      console.error("Error compressing logo:", error)
      toast({ title: "No se pudo procesar la imagen", description: "Intenta con otro archivo.", variant: "destructive" })
    } finally {
      setIsCompressingLogo(false)
    }
  }

  const handleSaveLogo = () => {
    if (!business) return
    updateBusiness(business.id, { logo: logoPreview || undefined })
    setBusiness({ ...business, logo: logoPreview || undefined })
    setIsLogoDialogOpen(false)
    toast({
      title: logoPreview ? "Logo actualizado" : "Logo quitado",
      description: logoPreview
        ? "Se usará en los PDFs que ya soportan logo (Ficha Técnica, Orden de Compra)."
        : "Ya no se mostrará ningún logo en los PDFs de este negocio.",
    })
  }

  // BUG CORREGIDO (ver docs/33): tres cosas se limpian juntas aquí porque estaban
  // enredadas entre sí:
  // 1. `renderFinancialMetrics` nunca se llamaba en ningún lado (código muerto).
  // 2. Declaraba su propio `formatCurrency` local hardcodeado a Lempira, que TAPABA
  //    (shadowing) el `formatCurrency` correcto ya importado de @/lib/currency arriba
  //    (línea 69) para el resto del componente — todas las cifras reales que sí se
  //    muestran (Scenario Analysis, gastos, tooltip del pastel) usaban esta versión
  //    hardcodeada en vez de la moneda elegida en Configuración.
  // 3. `expenseChartData`/`translateExpenseKey` eran una segunda implementación de
  //    agregación de gastos, paralela y muerta — el gráfico real usa `chartData`
  //    (el useEffect de arriba), no `expenseChartData`.
  const getSafeExpenseValue = (value: any): number => {
    return Number(value) || 0
  }

  if (!isLoggedIn) {
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-foreground">Cargando negocio...</h2>
          </div>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Negocio no encontrado</h2>
            <Button onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Vista previa de Equipo (ver /equipo, botón "Vista previa"): si el acceso
  // configurado de esta persona es "Dashboard principal" puede ver cualquier negocio
  // (igual que hoy el dueño de la cuenta); si es a un negocio ESPECÍFICO, solo puede
  // ver ese, nunca otro.
  if (previewActive && previewMember && previewMember.scope !== "dashboard" && previewMember.scope !== params.id) {
    return <AdminRestrictedPage sectionName={`El negocio "${business.name}"`} />
  }

  const totalExpenses = calculateTotalMonthlyExpenses(business.expenses || {})

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => router.push("/dashboard")}
                  className="flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {business?.logo ? (
                      <img src={business.logo} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Store className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{business?.name}</h1>
                    <p className="text-base text-foreground/80 font-medium">Dashboard del negocio</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link href={`/ficha-tecnica?business=${business?.id}`}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg px-6 py-3 h-auto font-semibold text-base">
                    <FileText className="h-5 w-5 mr-2" />
                    Nueva Receta
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-2 border-border hover:bg-accent bg-transparent h-12 w-12 flex-shrink-0"
                    >
                      <Settings className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setIsConfigOpen(true)} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      {business?.hasFinancialData ? "Editar datos financieros" : "Agregar datos financieros"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openLogoDialog} className="cursor-pointer">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {business?.logo ? "Cambiar logo del negocio" : "Agregar logo del negocio"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="font-semibold">
                      <Palette className="mr-2 h-4 w-4" />
                      Tema de la aplicación
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <SunIcon className="mr-2 h-4 w-4" />
                      Claro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <MoonIcon className="mr-2 h-4 w-4" />
                      Oscuro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Monitor className="mr-2 h-4 w-4" />
                      Sistema
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="p-2">
                      <ThemeSwitcher businessId={business?.id} showLightDark={false} />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Stats Grid - Tarjetas de módulos optimizadas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {menuItems.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Card className="border-2 border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card group cursor-pointer h-56 overflow-hidden">
                    <CardContent className="p-6 h-full flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg ${action.bgColor} w-fit transition-all duration-300`}>
                          <action.icon className={`h-8 w-8 ${action.textColor}`} />
                        </div>
                        <div className="space-y-3 min-w-0">
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                            {action.text}
                          </h3>
                          <p className="text-sm text-foreground/70 font-medium leading-relaxed line-clamp-3">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center text-primary group-hover:translate-x-1 transition-transform mt-4 pt-4 border-t border-border/50">
                        <span className="text-sm font-bold">Acceder ahora</span>
                        <ArrowLeft className="h-4 w-4 ml-2 flex-shrink-0 rotate-180" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Business Summary */}
            <Card className="border-2 border-border shadow-lg bg-card">
              <CardHeader className="bg-muted/20 border-b-2 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Resumen del Negocio</CardTitle>
                    <CardDescription>Distribución de gastos operacionales y valores predeterminados</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-8 space-y-8">
                {/* Datos ingresados al crear el negocio, siempre visibles, con o sin gastos configurados */}
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                    Datos del Negocio
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Tipo de negocio</p>
                      <p className="text-sm font-semibold text-foreground truncate">{business?.type || "Restaurante"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Platos mensuales estimados</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {business?.estimatedMonthlyPlates ? business.estimatedMonthlyPlates.toLocaleString() : "Sin configurar"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Margen de ganancia neta</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {business?.netProfitPercentage || 0}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground">Descripción</p>
                      <p className="text-sm font-semibold text-foreground truncate">{business?.description || ""}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Default Values Table */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Valores Predeterminados
                    </h3>
                    <div className="space-y-3">
                      {business?.expenses &&
                        expenseCategories.map((category) => {
                          const value = business.expenses[category.key as keyof typeof business.expenses]
                          if (!value || value === 0) return null

                          const percentage = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : "0.0"

                          return (
                            <div
                              key={category.key}
                              className="group relative overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-md"
                              style={{
                                borderColor: `${category.color}55`,
                                backgroundColor: `${category.color}0D`,
                              }}
                            >
                              <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                                    style={{ backgroundColor: `${category.color}26` }}
                                  >
                                    {category.icon}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{category.label}</p>
                                    <p className="text-xs text-muted-foreground">{percentage}% del total</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-foreground tabular-nums">
                                    {formatCurrency(value)}
                                  </p>
                                </div>
                              </div>
                              <div
                                className="absolute bottom-0 left-0 h-1 transition-all duration-300 group-hover:h-1.5"
                                style={{ width: `${percentage}%`, backgroundColor: category.color }}
                              ></div>
                            </div>
                          )
                        })}
                      <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">Total Mensual</span>
                          <span className="text-xl font-bold text-foreground tabular-nums">
                            {formatCurrency(totalExpenses)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Pie Chart */}
                  <div className="lg:col-span-2 flex flex-col items-center justify-center min-w-0">
                    {chartData.length === 0 ? (
                      <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-border rounded-xl">
                        <PieChartIcon className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="font-semibold text-foreground mb-1">Todavía no hay gastos configurados</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Agrega renta, servicios, marketing y demás gastos mensuales para ver aquí la distribución
                          de tu negocio.
                        </p>
                        <Button size="sm" className="mt-4 gap-2" onClick={() => setIsConfigOpen(true)}>
                          <Settings className="h-4 w-4" />
                          Configurar gastos
                        </Button>
                      </div>
                    ) : (
                    <>
                    <div className="w-full max-w-2xl">
                      <ResponsiveContainer width="100%" height={360}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={130}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke="hsl(var(--card))"
                                strokeWidth={3}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => {
                              const percentage = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : "0.0"
                              return [`${formatCurrency(value)} (${percentage}%)`, "Monto"]
                            }}
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              color: "hsl(var(--popover-foreground))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "12px",
                              boxShadow: "0 12px 24px -8px rgba(0, 0, 0, 0.25)",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "10px 14px",
                            }}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={56}
                            wrapperStyle={{ paddingTop: "16px" }}
                            formatter={(value, entry: any) => {
                              const percentage =
                                totalExpenses > 0
                                  ? (((entry.payload?.value || 0) / totalExpenses) * 100).toFixed(1)
                                  : "0.0"
                              return (
                                <span className="text-xs font-semibold text-foreground inline-flex items-center gap-1.5 mx-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-sm border border-border"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  {value} ({percentage}%)
                                </span>
                              )
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Info Box */}
                    <div className="mt-6 w-full max-w-2xl">
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <Info className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground mb-1">
                              Aplicación automática en Fichas Técnicas
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Los porcentajes de esta gráfica se aplican automáticamente en las fichas técnicas para
                              el cálculo del precio de venta. Los valores representan tus gastos mensuales reales y
                              son la base de todos los cálculos financieros del negocio.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scenario Analysis Section */}
            {business?.hasFinancialData && menus.length > 0 && (
              <Card className="border-2 border-border shadow-lg bg-card">
                <CardHeader className="bg-muted/20 border-b-2 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-xl font-bold">Análisis de Escenarios</CardTitle>
                        <CardDescription>Simula KPIs financieros basados en tus menús</CardDescription>
                      </div>
                    </div>
                    {currentScenario && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowScenarioDetails(true)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Cálculo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={saveCurrentScenario}
                          className="gap-2 bg-transparent"
                        >
                          <Save className="h-4 w-4" />
                          Guardar Escenario
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Menu and Capacity Controls */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Menú</Label>
                        <Select
                          value={selectedMenuId}
                          onValueChange={(value) => {
                            setSelectedMenuId(value)
                            setScenarioParams((prev) => ({ ...prev, menuId: value }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un menú" />
                          </SelectTrigger>
                          <SelectContent>
                            {menus.map((menu) => (
                              <SelectItem key={menu.id} value={menu.id}>
                                {menu.name}
                                {menu.items.some((item) => item.priceOverride !== null) && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    Precios personalizados
                                  </Badge>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Asientos</Label>
                          <Input
                            type="number"
                            min="1"
                            value={scenarioParams.capacity.seats}
                            onChange={(e) =>
                              setScenarioParams((prev) => ({
                                ...prev,
                                capacity: { ...prev.capacity, seats: Math.max(1, Number.parseInt(e.target.value) || 1) },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Servicios/día</Label>
                          <Input
                            type="number"
                            min="1"
                            value={scenarioParams.capacity.servicesPerDay}
                            onChange={(e) =>
                              setScenarioParams((prev) => ({
                                ...prev,
                                capacity: { ...prev.capacity, servicesPerDay: Math.max(1, Number.parseInt(e.target.value) || 1) },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Días abiertos/mes</Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={scenarioParams.capacity.daysOpen}
                            onChange={(e) =>
                              setScenarioParams((prev) => ({
                                ...prev,
                                capacity: { ...prev.capacity, daysOpen: Math.max(1, Number.parseInt(e.target.value) || 1) },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">
                            Ocupación ({Math.round(scenarioParams.capacity.occupancy * 100)}%)
                          </Label>
                          <Slider
                            value={[scenarioParams.capacity.occupancy * 100]}
                            onValueChange={([value]) =>
                              setScenarioParams((prev) => ({
                                ...prev,
                                capacity: { ...prev.capacity, occupancy: value / 100 },
                              }))
                            }
                            max={100}
                            min={10}
                            step={5}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Método de Mezcla</Label>
                        <Select
                          value={scenarioParams.mixMethod}
                          onValueChange={(value: any) => setScenarioParams((prev) => ({ ...prev, mixMethod: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="heuristica">Heurística (por categoría)</SelectItem>
                            <SelectItem value="capacidad">Capacidad estimada</SelectItem>
                            <SelectItem value="ventas" disabled>
                              Ventas históricas (próximamente)
                            </SelectItem>
                            <SelectItem value="inventario" disabled>
                              Inventario (próximamente)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(scenarioParams.mixMethod === "heuristica" || scenarioParams.mixMethod === "capacidad") && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">Pesos por Sección (%)</Label>
                          {(["entrada", "fuerte", "postre", "bebida"] as MenuSection[]).map((section) => (
                            <div key={section} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{section}s:</span>
                              <div className="flex items-center gap-2 w-32">
                                <Slider
                                  value={[scenarioParams.categoryWeights?.[section] || 0]}
                                  onValueChange={([value]) => updateCategoryWeight(section, value)}
                                  max={100}
                                  min={0}
                                  step={5}
                                  className="flex-1"
                                />
                                <span className="text-sm font-medium w-8">
                                  {scenarioParams.categoryWeights?.[section] || 0}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={scenarioParams.upsellBebidas}
                          onCheckedChange={(checked) =>
                            setScenarioParams((prev) => ({ ...prev, upsellBebidas: checked }))
                          }
                        />
                        <Label className="text-sm">Upsell bebidas (+10%)</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={calculateCurrentScenario}
                      disabled={isCalculating || !selectedMenuId}
                      className="px-8 py-3 text-base font-semibold"
                    >
                      {isCalculating ? "Calculando..." : "Calcular KPIs"}
                    </Button>
                  </div>

                  {/* KPI Results */}
                  {currentScenario && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Resultados del Escenario</h3>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                currentScenario.confidence === "alta"
                                  ? "default"
                                  : currentScenario.confidence === "media"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              Confianza: {currentScenario.confidence}
                            </Badge>
                            {currentScenario.hasOverrides && <Badge variant="outline">Precios personalizados</Badge>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">Ticket Promedio</span>
                              </div>
                              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{formatCurrency(currentScenario.TP)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                                <span className="text-sm font-semibold text-green-600 dark:text-green-300">Costo Promedio</span>
                              </div>
                              <div className="text-2xl font-bold text-green-800 dark:text-green-300">{formatCurrency(currentScenario.CVp)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <Target className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-300">Margen Medio</span>
                              </div>
                              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">{formatCurrency(currentScenario.MC)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                                <span className="text-sm font-semibold text-orange-600 dark:text-orange-300">Punto Equilibrio</span>
                              </div>
                              <div className="text-lg font-bold text-orange-800 dark:text-orange-300">
                                {currentScenario.PE_plates.toLocaleString()} platos/mes
                              </div>
                              <div className="text-sm text-orange-700 dark:text-orange-300">
                                {formatCurrency(currentScenario.PE_revenue)}/mes
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Recommendation */}
                        <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                              <div>
                                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Recomendación</h4>
                                <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                                  {generateRecommendation(currentScenario)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty state for scenario analysis */}
            {business?.hasFinancialData && menus.length === 0 && (
              <Card className="border-2 border-border shadow-lg bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Análisis de Escenarios</h3>
                  <p className="text-muted-foreground mb-4 text-center">
                    Crea al menos un menú para simular KPIs financieros
                  </p>
                  <Link href={`/menus?business=${params.id}`}>
                    <Button>Crear Primer Menú</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {!business?.hasFinancialData && (
              <Card className="border-2 border-border shadow-lg bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Completa los datos financieros</h3>
                  <p className="text-muted-foreground mb-4 text-center">
                    Agrega los gastos mensuales de tu negocio para calcular el punto de equilibrio
                  </p>
                  <Button onClick={() => setIsConfigOpen(true)}>Agregar Datos Financieros</Button>
                </CardContent>
              </Card>
            )}

            {/* Actividad Reciente y Notificaciones, propias de este negocio, separadas del dashboard principal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Actividad Reciente</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border"
                        >
                          <div className="text-lg flex-shrink-0 mt-0.5">
                            {ActivityTracker.getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground line-clamp-2">{activity.action}</p>
                            <p className="text-xs text-foreground/70 font-medium mt-1">
                              {ActivityTracker.formatTimeAgo(activity.timestamp)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs font-semibold border-2 flex-shrink-0 capitalize">
                            {activity.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 text-foreground/30 mx-auto mb-4" />
                      <p className="text-foreground/70 font-medium">Sin actividad reciente</p>
                      <p className="text-xs text-foreground/50 mt-1">
                        Empieza a crear recetas o ingredientes para ver tu actividad aquí
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Bell className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Notificaciones</span>
                    {systemAlerts.filter((alert) => !alert.read).length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {systemAlerts.filter((alert) => !alert.read).length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 h-full overflow-y-auto">
                  {systemAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {systemAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            alert.type === "success"
                              ? "bg-green-100 border-green-300 hover:bg-green-50 dark:bg-green-950/40"
                              : alert.type === "warning"
                                ? "bg-amber-100 border-amber-300 hover:bg-amber-50 dark:bg-amber-950/40"
                                : alert.type === "error"
                                  ? "bg-red-100 border-red-300 hover:bg-red-50 dark:bg-red-950/40"
                                  : "bg-blue-100 border-blue-300 hover:bg-blue-50 dark:bg-blue-950/40"
                          } ${alert.read ? "opacity-60" : ""}`}
                          onClick={() => handleMarkAlertAsRead(alert.id)}
                        >
                          <div className="text-lg flex-shrink-0 mt-0.5">{ActivityTracker.getAlertIcon(alert.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-bold ${
                                alert.type === "success"
                                  ? "text-green-900 dark:text-green-300"
                                  : alert.type === "warning"
                                    ? "text-amber-900 dark:text-amber-300"
                                    : alert.type === "error"
                                      ? "text-red-900 dark:text-red-300"
                                      : "text-blue-900 dark:text-blue-300"
                              }`}
                            >
                              {alert.title}
                            </p>
                            <p
                              className={`text-xs font-medium mt-1 ${
                                alert.type === "success"
                                  ? "text-green-800 dark:text-green-300"
                                  : alert.type === "warning"
                                    ? "text-amber-800 dark:text-amber-300"
                                    : alert.type === "error"
                                      ? "text-red-800 dark:text-red-300"
                                      : "text-blue-800 dark:text-blue-300"
                              }`}
                            >
                              {alert.message}
                            </p>
                            <p className="text-xs text-foreground/50 mt-1">
                              {ActivityTracker.formatTimeAgo(alert.timestamp)}
                            </p>
                          </div>
                          {!alert.read && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 text-foreground/30 mx-auto mb-4" />
                      <p className="text-foreground/70 font-medium">Sin notificaciones</p>
                      <p className="text-xs text-foreground/50 mt-1">Las notificaciones del sistema aparecerán aquí</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Logo del negocio */}
            <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Logo del negocio</DialogTitle>
                  <DialogDescription>
                    Se usa en el encabezado de los PDFs que ya soportan logo (Ficha Técnica y Orden de Compra). Los
                    demás PDFs todavía no lo dibujan — está pendiente para una próxima actualización.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-center h-32 bg-muted/30 rounded-lg border-2 border-dashed border-border overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Vista previa del logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs">Sin logo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="business-logo-input" className="flex-1">
                      <div className="flex items-center justify-center gap-2 border border-border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors">
                        <Upload className="h-4 w-4" />
                        {isCompressingLogo ? "Procesando..." : "Elegir imagen"}
                      </div>
                      <input
                        id="business-logo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isCompressingLogo}
                        onChange={(e) => handleLogoFileChange(e.target.files?.[0])}
                      />
                    </Label>
                    {logoPreview && (
                      <Button variant="outline" size="icon" onClick={() => setLogoPreview(null)} title="Quitar logo">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLogoDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveLogo} disabled={isCompressingLogo}>
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Configuration Dialog */}
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Datos Financieros del Negocio</DialogTitle>
                  <DialogDescription>
                    Actualiza los gastos mensuales para obtener un análisis más preciso.
                  </DialogDescription>
                </DialogHeader>
                {editedBusiness && (
                  <div className="grid gap-4 py-4">
                    {expenseCategories.map((category) => (
                      <div key={category.key} className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor={category.key} className="text-right capitalize">
                          {category.label}
                        </Label>
                        <Input
                          id={category.key}
                          value={editedBusiness.expenses?.[category.key as keyof typeof editedBusiness.expenses] || 0}
                          onChange={(e) =>
                            setEditedBusiness((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    expenses: {
                                      ...prev.expenses,
                                      [category.key]: getSafeExpenseValue(e.target.value),
                                    },
                                  }
                                : null,
                            )
                          }
                          type="number"
                          min="0"
                          className="col-span-2"
                          placeholder="L 0.00"
                        />
                      </div>
                    ))}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="estimatedMonthlyPlates" className="text-right">
                        Platos/Mes Estimados
                      </Label>
                      <Input
                        id="estimatedMonthlyPlates"
                        value={editedBusiness.estimatedMonthlyPlates || 0}
                        onChange={(e) =>
                          setEditedBusiness((prev) =>
                            prev ? { ...prev, estimatedMonthlyPlates: Number.parseInt(e.target.value) || 0 } : null,
                          )
                        }
                        type="number"
                        min="0"
                        className="col-span-2"
                        placeholder="Ej: 1000"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleConfigSave}>Guardar Cambios</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showScenarioDetails} onOpenChange={setShowScenarioDetails}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Detalles del Cálculo</DialogTitle>
                  <DialogDescription>
                    Actualiza los gastos mensuales para obtener un análisis más preciso.
                  </DialogDescription>
                </DialogHeader>
                {currentScenario && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Costos Fijos (CF):</strong>{" "}
                        {formatCurrency(business?.expenses ? calculateTotalMonthlyExpenses(business.expenses) : 0)}
                      </div>
                      <div>
                        <strong>Método de mezcla:</strong> {currentScenario.params.mixMethod}
                      </div>
                      <div>
                        <strong>Capacidad estimada:</strong> {currentScenario.PVm_est?.toLocaleString()} platos/mes
                      </div>
                      <div>
                        <strong>Confianza:</strong> {currentScenario.confidence}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-2">Fórmulas utilizadas:</h4>
                      <div className="space-y-1 text-sm font-mono bg-muted p-3 rounded">
                        <div>TP = Σ(w_i × precio_i) = {formatCurrency(currentScenario.TP)}</div>
                        <div>CVp = Σ(w_i × costo_i) = {formatCurrency(currentScenario.CVp)}</div>
                        <div>MC = TP - CVp = {formatCurrency(currentScenario.MC)}</div>
                        <div>PE_platos = CF / MC = {currentScenario.PE_plates.toLocaleString()}</div>
                        <div>PE_ingresos = PE_platos × TP = {formatCurrency(currentScenario.PE_revenue)}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Notas y supuestos:</h4>
                      <ul className="text-sm space-y-1">
                        {currentScenario.notes.map((note, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowScenarioDetails(false)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  )
}
