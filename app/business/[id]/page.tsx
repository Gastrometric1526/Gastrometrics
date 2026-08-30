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
import { BusinessDetailTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getDashboardData } from "@/utils/dashboard"
import { updateBusiness, getBusinessById, refreshBusinesses } from "@/lib/storage/businesses"
import { compressLogoToDataUrl } from "@/lib/utils/logo-compress"
import { useActiveMembership } from "@/lib/plan-access"
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
  const { active: previewActive, member: previewMember } = useActiveMembership()
  const { setTheme } = useTheme()

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

  const expenseCategories = useMemo(
    () => [
      { key: "rent", label: t("business_expense_category_rent"), color: "#FF6B6B", icon: "🏢" },
      { key: "utilities", label: t("business_expense_category_utilities"), color: "#4ECDC4", icon: "⚡" },
      { key: "operationalCosts", label: t("business_expense_category_operational"), color: "#45B7D1", icon: "⚙️" },
      { key: "marketing", label: t("business_expense_category_marketing"), color: "#96CEB4", icon: "📢" },
      { key: "laborCosts", label: t("business_expense_category_labor"), color: "#FFEAA7", icon: "👥" },
      { key: "otherExpenses", label: t("business_expense_category_other"), color: "#DDA0DD", icon: "📦" },
    ],
    [t],
  )

  // Etiquetas para las secciones de menú (entrada/fuerte/postre/bebida) del simulador de
  // escenarios más abajo — definidas aquí (no memoizadas) para que se recalculen si el
  // usuario cambia de idioma, igual que expenseCategories.
  const sectionLabels: Record<MenuSection, string> = {
    entrada: t("business_scenario_section_entrada"),
    fuerte: t("business_scenario_section_fuerte"),
    postre: t("business_scenario_section_postre"),
    bebida: t("business_scenario_section_bebida"),
  }

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
            title: t("business_not_found_title"),
            description: t("business_toast_not_found_desc"),
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
          title: t("business_toast_load_error_title"),
          description: t("business_toast_load_error_desc"),
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
        title: t("business_toast_incomplete_data_title"),
        description: t("business_toast_incomplete_data_desc"),
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
          title: t("business_toast_scenario_calculated_title"),
          description: t("business_toast_scenario_calculated_desc"),
        })
      } else {
        toast({
          title: t("business_toast_calc_error_title"),
          description: t("business_toast_calc_error_desc"),
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error calculating scenario:", error)
      toast({
        title: t("business_toast_generic_calc_error_title"),
        description: t("business_toast_generic_calc_error_desc"),
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
        title: t("business_toast_scenario_saved_title"),
        description: t("business_toast_scenario_saved_desc"),
      })
    } catch (error) {
      console.error("Error saving scenario:", error)
      toast({
        title: t("business_toast_save_error_title"),
        description: t("business_toast_save_error_desc"),
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
        text: t("business_module_ficha_tecnica_title"),
        icon: FileText,
        description: t("business_module_ficha_tecnica_desc"),
        bgColor: "bg-chart-1/10 group-hover:bg-chart-1/20",
        textColor: "text-chart-1",
      },
      {
        href: `/ingredientes?business=${params.id}`,
        text: t("business_module_ingredientes_title"),
        icon: Database,
        description: t("business_module_ingredientes_desc"),
        bgColor: "bg-chart-2/10 group-hover:bg-chart-2/20",
        textColor: "text-chart-2",
      },
      {
        href: `/menus?business=${params.id}`,
        text: t("business_module_menus_title"),
        icon: UtensilsCrossed,
        description: t("business_module_menus_desc"),
        bgColor: "bg-chart-3/10 group-hover:bg-chart-3/20",
        textColor: "text-chart-3",
      },
      {
        href: `/menu-y-compras?business=${params.id}`,
        text: t("business_module_ordenes_title"),
        icon: ShoppingCart,
        description: t("business_module_ordenes_desc"),
        bgColor: "bg-chart-4/10 group-hover:bg-chart-4/20",
        textColor: "text-chart-4",
      },
      {
        href: `/mis-recetas?business=${params.id}`,
        text: t("business_module_mis_recetas_title"),
        icon: UtensilsCrossed,
        description: t("business_module_mis_recetas_desc"),
        bgColor: "bg-chart-5/10 group-hover:bg-chart-5/20",
        textColor: "text-chart-5",
      },
      {
        href: `/inventario?business=${params.id}`,
        text: t("business_module_inventario_title"),
        icon: Store,
        description: t("business_module_inventario_desc"),
        bgColor: "bg-chart-6/10 group-hover:bg-chart-6/20",
        textColor: "text-chart-6",
      },
      {
        href: `/estadisticas?business=${params.id}`,
        text: t("business_module_estadisticas_title"),
        icon: BarChart3,
        description: t("business_module_estadisticas_desc"),
        bgColor: "bg-chart-7/10 group-hover:bg-chart-7/20",
        textColor: "text-chart-7",
      },
    ],
    [params.id, t],
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
        title: t("business_alert_config_updated_title"),
        description: t("business_alert_config_updated_desc"),
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
      toast({ title: t("business_toast_invalid_file_title"), description: t("business_toast_invalid_file_desc"), variant: "destructive" })
      return
    }
    setIsCompressingLogo(true)
    try {
      const dataUrl = await compressLogoToDataUrl(file)
      setLogoPreview(dataUrl)
    } catch (error) {
      console.error("Error compressing logo:", error)
      toast({ title: t("business_toast_logo_process_error_title"), description: t("business_toast_logo_process_error_desc"), variant: "destructive" })
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
      title: logoPreview ? t("business_toast_logo_updated_title") : t("business_toast_logo_removed_title"),
      description: logoPreview
        ? t("business_toast_logo_updated_desc")
        : t("business_toast_logo_removed_desc"),
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
            <h2 className="text-xl font-semibold text-foreground">{t("business_loading_title")}</h2>
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
            <h2 className="text-2xl font-bold text-foreground mb-4">{t("business_not_found_title")}</h2>
            <Button onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("business_not_found_back_button")}
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
    return <AdminRestrictedPage sectionName={t("business_restricted_section_name").replace("{name}", business.name)} />
  }

  const totalExpenses = calculateTotalMonthlyExpenses(
    business.expenses || { rent: 0, utilities: 0, operationalCosts: 0, marketing: 0, laborCosts: 0, otherExpenses: 0 },
  )

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <BusinessDetailTour hasScenarioSection={!!(business?.hasFinancialData && menus.length > 0)} />
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6" data-tour="business-header">
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
                    <p className="text-base text-foreground/80 font-medium">{t("business_header_subtitle")}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link href={`/ficha-tecnica?business=${business?.id}`}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg px-6 py-3 h-auto font-semibold text-base">
                    <FileText className="h-5 w-5 mr-2" />
                    {t("business_header_new_recipe_button")}
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
                      {business?.hasFinancialData ? t("business_menu_edit_financial") : t("business_menu_add_financial")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openLogoDialog} className="cursor-pointer">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {business?.logo ? t("business_menu_change_logo") : t("business_menu_add_logo")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="font-semibold">
                      <Palette className="mr-2 h-4 w-4" />
                      {t("business_menu_theme_label")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <SunIcon className="mr-2 h-4 w-4" />
                      {t("business_menu_theme_light")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <MoonIcon className="mr-2 h-4 w-4" />
                      {t("business_menu_theme_dark")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Monitor className="mr-2 h-4 w-4" />
                      {t("business_menu_theme_system")}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" data-tour="business-modules">
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
                        <span className="text-sm font-bold">{t("business_module_access_now")}</span>
                        <ArrowLeft className="h-4 w-4 ml-2 flex-shrink-0 rotate-180" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Business Summary */}
            <Card className="border-2 border-border shadow-lg bg-card" data-tour="business-summary">
              <CardHeader className="bg-muted/20 border-b-2 border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">{t("business_summary_title")}</CardTitle>
                    <CardDescription>{t("business_summary_desc")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-8 space-y-8">
                {/* Datos ingresados al crear el negocio, siempre visibles, con o sin gastos configurados */}
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
                    {t("business_summary_business_data_heading")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{t("business_summary_type_label")}</p>
                      <p className="text-sm font-semibold text-foreground truncate">{business?.type || t("business_summary_type_default")}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{t("business_summary_plates_label")}</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {business?.estimatedMonthlyPlates ? business.estimatedMonthlyPlates.toLocaleString() : t("business_summary_not_set")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{t("business_summary_margin_label")}</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {business?.netProfitPercentage || 0}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3 col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground">{t("business_summary_description_label")}</p>
                      <p className="text-sm font-semibold text-foreground truncate">{business?.description || ""}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Default Values Table */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      {t("business_summary_defaults_heading")}
                    </h3>
                    <div className="space-y-3">
                      {business?.expenses &&
                        expenseCategories.map((category) => {
                          const expenses = business.expenses!
                          const value = expenses[category.key as keyof typeof expenses]
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
                                    <p className="text-xs text-muted-foreground">{t("business_expense_percent_of_total").replace("{percent}", percentage)}</p>
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
                          <span className="text-sm font-bold text-foreground">{t("business_summary_total_monthly_label")}</span>
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
                        <p className="font-semibold text-foreground mb-1">{t("business_chart_empty_title")}</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          {t("business_chart_empty_desc")}
                        </p>
                        <Button size="sm" className="mt-4 gap-2" onClick={() => setIsConfigOpen(true)}>
                          <Settings className="h-4 w-4" />
                          {t("business_chart_empty_button")}
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
                            formatter={(value) => {
                              const numericValue = typeof value === "number" ? value : Number(value)
                              const percentage = totalExpenses > 0 ? ((numericValue / totalExpenses) * 100).toFixed(1) : "0.0"
                              return [`${formatCurrency(numericValue)} (${percentage}%)`, t("business_chart_tooltip_amount_label")]
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
                            iconSize={0}
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
                              {t("business_chart_info_title")}
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t("business_chart_info_desc")}
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
              <Card className="border-2 border-border shadow-lg bg-card" data-tour="business-scenario">
                <CardHeader className="bg-muted/20 border-b-2 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-xl font-bold">{t("business_scenario_title")}</CardTitle>
                        <CardDescription>{t("business_scenario_subtitle")}</CardDescription>
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
                          {t("business_scenario_view_calc_button")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={saveCurrentScenario}
                          className="gap-2 bg-transparent"
                        >
                          <Save className="h-4 w-4" />
                          {t("business_scenario_save_button")}
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
                        <Label className="text-sm font-semibold mb-2 block">{t("business_scenario_menu_label")}</Label>
                        <Select
                          value={selectedMenuId}
                          onValueChange={(value) => {
                            setSelectedMenuId(value)
                            setScenarioParams((prev) => ({ ...prev, menuId: value }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("business_scenario_menu_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {menus.map((menu) => (
                              <SelectItem key={menu.id} value={menu.id}>
                                {menu.name}
                                {menu.items.some((item) => item.priceOverride !== null) && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {t("business_scenario_custom_prices_badge")}
                                  </Badge>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">{t("business_scenario_seats_label")}</Label>
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
                          <Label className="text-sm font-semibold mb-2 block">{t("business_scenario_services_per_day_label")}</Label>
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
                          <Label className="text-sm font-semibold mb-2 block">{t("business_scenario_days_open_label")}</Label>
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
                            {t("business_scenario_occupancy_label").replace(
                              "{percent}",
                              String(Math.round(scenarioParams.capacity.occupancy * 100)),
                            )}
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
                        <Label className="text-sm font-semibold mb-2 block">{t("business_scenario_mix_method_label")}</Label>
                        <Select
                          value={scenarioParams.mixMethod}
                          onValueChange={(value: any) => setScenarioParams((prev) => ({ ...prev, mixMethod: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="heuristica">{t("business_scenario_mix_heuristic")}</SelectItem>
                            <SelectItem value="capacidad">{t("business_scenario_mix_capacity")}</SelectItem>
                            <SelectItem value="ventas" disabled>
                              {t("business_scenario_mix_sales_soon")}
                            </SelectItem>
                            <SelectItem value="inventario" disabled>
                              {t("business_scenario_mix_inventory_soon")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(scenarioParams.mixMethod === "heuristica" || scenarioParams.mixMethod === "capacidad") && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">{t("business_scenario_section_weights_label")}</Label>
                          {(["entrada", "fuerte", "postre", "bebida"] as MenuSection[]).map((section) => (
                            <div key={section} className="flex items-center justify-between">
                              <span className="text-sm capitalize">{sectionLabels[section]}:</span>
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
                        <Label className="text-sm">{t("business_scenario_upsell_label")}</Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={calculateCurrentScenario}
                      disabled={isCalculating || !selectedMenuId}
                      className="px-8 py-3 text-base font-semibold"
                    >
                      {isCalculating ? t("business_scenario_calculating_button") : t("business_scenario_calculate_button")}
                    </Button>
                  </div>

                  {/* KPI Results */}
                  {currentScenario && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{t("business_scenario_results_heading")}</h3>
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
                              {t("business_scenario_confidence_label")}: {currentScenario.confidence}
                            </Badge>
                            {currentScenario.hasOverrides && <Badge variant="outline">{t("business_scenario_custom_prices_badge")}</Badge>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">{t("business_scenario_kpi_ticket_label")}</span>
                              </div>
                              <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{formatCurrency(currentScenario.TP)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                                <span className="text-sm font-semibold text-green-600 dark:text-green-300">{t("business_scenario_kpi_cost_label")}</span>
                              </div>
                              <div className="text-2xl font-bold text-green-800 dark:text-green-300">{formatCurrency(currentScenario.CVp)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <Target className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-300">{t("business_scenario_kpi_margin_label")}</span>
                              </div>
                              <div className="text-2xl font-bold text-purple-800 dark:text-purple-300">{formatCurrency(currentScenario.MC)}</div>
                            </CardContent>
                          </Card>

                          <Card className="border-2 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40">
                            <CardContent className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                                <span className="text-sm font-semibold text-orange-600 dark:text-orange-300">{t("business_scenario_kpi_breakeven_label")}</span>
                              </div>
                              <div className="text-lg font-bold text-orange-800 dark:text-orange-300">
                                {currentScenario.PE_plates.toLocaleString()} {t("business_scenario_plates_suffix")}
                              </div>
                              <div className="text-sm text-orange-700 dark:text-orange-300">
                                {formatCurrency(currentScenario.PE_revenue)}{t("business_scenario_per_month_suffix")}
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
                                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">{t("business_scenario_recommendation_heading")}</h4>
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
                  <h3 className="text-lg font-semibold mb-2">{t("business_scenario_title")}</h3>
                  <p className="text-muted-foreground mb-4 text-center">
                    {t("business_scenario_empty_desc")}
                  </p>
                  <Link href={`/menus?business=${params.id}`}>
                    <Button>{t("business_scenario_empty_button")}</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {!business?.hasFinancialData && (
              <Card className="border-2 border-border shadow-lg bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("business_financial_empty_heading")}</h3>
                  <p className="text-muted-foreground mb-4 text-center">
                    {t("business_financial_empty_desc")}
                  </p>
                  <Button onClick={() => setIsConfigOpen(true)}>{t("business_financial_empty_button")}</Button>
                </CardContent>
              </Card>
            )}

            {/* Actividad Reciente y Notificaciones, propias de este negocio, separadas del dashboard principal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden" data-tour="business-activity">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{t("business_activity_heading")}</span>
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
                      <p className="text-foreground/70 font-medium">{t("business_activity_empty_title")}</p>
                      <p className="text-xs text-foreground/50 mt-1">
                        {t("business_activity_empty_desc")}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-border shadow-lg bg-card h-80 overflow-hidden" data-tour="business-notifications">
                <CardHeader className="border-b-2 border-border p-4">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Bell className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{t("business_notifications_heading")}</span>
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
                      <p className="text-foreground/70 font-medium">{t("business_notifications_empty_title")}</p>
                      <p className="text-xs text-foreground/50 mt-1">{t("business_notifications_empty_desc")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Logo del negocio */}
            <Dialog open={isLogoDialogOpen} onOpenChange={setIsLogoDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t("business_logo_dialog_title")}</DialogTitle>
                  <DialogDescription>
                    {t("business_logo_dialog_desc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-center h-32 bg-muted/30 rounded-lg border-2 border-dashed border-border overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt={t("business_logo_preview_alt")} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs">{t("business_logo_none_label")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="business-logo-input" className="flex-1">
                      <div className="flex items-center justify-center gap-2 border border-border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors">
                        <Upload className="h-4 w-4" />
                        {isCompressingLogo ? t("business_logo_processing_label") : t("business_logo_choose_button")}
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
                      <Button variant="outline" size="icon" onClick={() => setLogoPreview(null)} title={t("business_logo_remove_title")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLogoDialogOpen(false)}>
                    {t("business_action_cancel")}
                  </Button>
                  <Button onClick={handleSaveLogo} disabled={isCompressingLogo}>
                    {t("business_action_save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Configuration Dialog */}
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t("business_config_dialog_title")}</DialogTitle>
                  <DialogDescription>
                    {t("business_config_dialog_desc")}
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
                                      rent: 0,
                                      utilities: 0,
                                      operationalCosts: 0,
                                      marketing: 0,
                                      laborCosts: 0,
                                      otherExpenses: 0,
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
                        {t("business_config_plates_label")}
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
                        placeholder={t("business_config_plates_placeholder")}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                    {t("business_action_cancel")}
                  </Button>
                  <Button onClick={handleConfigSave}>{t("business_config_save_button")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showScenarioDetails} onOpenChange={setShowScenarioDetails}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("business_scenario_details_title")}</DialogTitle>
                  <DialogDescription>
                    {t("business_config_dialog_desc")}
                  </DialogDescription>
                </DialogHeader>
                {currentScenario && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>{t("business_scenario_details_fixed_costs_label")}:</strong>{" "}
                        {formatCurrency(business?.expenses ? calculateTotalMonthlyExpenses(business.expenses) : 0)}
                      </div>
                      <div>
                        <strong>{t("business_scenario_details_mix_method_label")}:</strong> {currentScenario.params.mixMethod}
                      </div>
                      <div>
                        <strong>{t("business_scenario_mix_capacity")}:</strong> {currentScenario.PVm_est?.toLocaleString()} {t("business_scenario_plates_suffix")}
                      </div>
                      <div>
                        <strong>{t("business_scenario_confidence_label")}:</strong> {currentScenario.confidence}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-2">{t("business_scenario_formulas_heading")}</h4>
                      <div className="space-y-1 text-sm font-mono bg-muted p-3 rounded">
                        <div>{t("business_scenario_formula_tp").replace("{value}", formatCurrency(currentScenario.TP))}</div>
                        <div>{t("business_scenario_formula_cvp").replace("{value}", formatCurrency(currentScenario.CVp))}</div>
                        <div>MC = TP - CVp = {formatCurrency(currentScenario.MC)}</div>
                        <div>{t("business_scenario_formula_pe_plates").replace("{value}", currentScenario.PE_plates.toLocaleString())}</div>
                        <div>{t("business_scenario_formula_pe_revenue").replace("{value}", formatCurrency(currentScenario.PE_revenue))}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">{t("business_scenario_notes_heading")}</h4>
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
                    {t("business_action_close")}
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
