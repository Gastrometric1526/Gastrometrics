"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  MoreVertical,
  Search,
  ArrowLeft,
  Plus,
  Edit,
  Copy,
  Trash,
  UtensilsCrossed,
  Clock,
  ChefHat,
  Eye,
  Calendar,
  ListChecks,
  ShoppingCart,
  Info,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sidebar } from "@/components/sidebar"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { MenusTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { getMenus, deleteMenu, duplicateMenu, updateMenu, ensureMenusLoaded } from "@/lib/menus"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getBusinessById } from "@/lib/storage/businesses"
import { generateMenuPDF, type MenuPDFType } from "@/lib/pdf/menu-pdf-generator"
import { FileDown, Lock } from "lucide-react"
import { MenuWizard } from "@/components/menu-wizard"
import type { Menu } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"
import { AuthGuard } from "@/components/auth-guard"
import { formatCurrency } from "@/lib/currency"
import { hasFeatureAccess, useFeatureAccess } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAccessBlockReason } from "@/lib/plan-access"

export default function MenusPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const { isLoggedIn } = useAuth()
  const { t, language } = useLanguage()
  const canAccessMenus = useFeatureAccess("menus")
  const canExportAdminMenuPDF = useFeatureAccess("pdf_admin")
  const { toast } = useToast()

  const [menus, setMenus] = useState<Menu[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMenu, setPreviewMenu] = useState<Menu | null>(null)
  const [datePickerMenuId, setDatePickerMenuId] = useState<string | null>(null)

  useEffect(() => {
    loadMenus()
  }, [businessId])

  const loadMenus = async () => {
    try {
      await Promise.all([ensureMenusLoaded(businessId || "main"), ensureRecipesLoaded(businessId || "main")])
      const savedMenus = getMenus(businessId || "main")
      setMenus(savedMenus)
      setRecipes(getRecipes(businessId || "main"))
    } catch (error) {
      console.error("Error loading menus:", error)
      toast({
        title: t("menus_toast_load_error_title"),
        description: t("menus_toast_load_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMenus = useMemo(() => {
    return menus
      .filter((menu) => menu.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [menus, searchQuery])

  const handleEditMenu = (menu: Menu) => {
    setEditingMenu(menu)
    setShowEditor(true)
  }

  const handlePreviewMenu = (menu: Menu) => {
    setPreviewMenu(menu)
    setShowPreview(true)
  }

  const handleDeleteMenu = async (menuId: string) => {
    try {
      await deleteMenu(businessId || "main", menuId)
      setMenus((prev) => prev.filter((menu) => menu.id !== menuId))
      toast({
        title: t("menus_toast_deleted_title"),
        description: t("menus_toast_deleted_desc"),
      })
    } catch (error) {
      console.error("Error deleting menu:", error)
      toast({
        title: t("menus_toast_delete_error_title"),
        description: t("menus_toast_delete_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleDuplicateMenu = async (menuId: string) => {
    try {
      const duplicatedMenu = await duplicateMenu(businessId || "main", menuId)
      setMenus((prev) => [...prev, duplicatedMenu])
      toast({
        title: t("menus_toast_duplicated_title"),
        description: t("menus_toast_duplicated_desc"),
      })
    } catch (error) {
      console.error("Error duplicating menu:", error)
      toast({
        title: t("menus_toast_duplicate_error_title"),
        description: t("menus_toast_duplicate_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleExportMenuPDF = (menu: Menu, type: MenuPDFType) => {
    // BUG CORREGIDO (ver docs/34): el PDF interno de menú lleva costos y márgenes —
    // misma categoría de información sensible que "PDF Administrativo" de Ficha
    // Técnica (ya gateado a pdf_admin), pero este export se había quedado sin
    // bloquear. El PDF de cliente (sin costos) sigue libre en todos los planes.
    if (type === "interno" && !hasFeatureAccess("pdf_admin")) {
      toast({
        title: t("menus_toast_plan_locked_title"),
        description: t("menus_toast_plan_locked_desc"),
        variant: "destructive",
      })
      return
    }
    try {
      const business = getBusinessById(businessId || "main")
      const doc = generateMenuPDF(menu, recipes, {
        type,
        businessName: business?.name,
      })
      const suffix = type === "interno" ? "interno" : "cliente"
      doc.save(`menu-${menu.name.toLowerCase().replace(/\s+/g, "-")}-${suffix}.pdf`)
      toast({
        title: t("menus_toast_pdf_generated_title"),
        description: type === "interno" ? t("menus_toast_pdf_generated_internal_desc") : t("menus_toast_pdf_generated_client_desc"),
      })
    } catch (error) {
      console.error("Error exporting menu PDF:", error)
      toast({
        title: t("menus_toast_pdf_export_error_title"),
        description: t("menus_toast_pdf_export_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleMenuSaved = (savedMenu: Menu) => {
    setMenus((prev) => {
      const existing = prev.find((m) => m.id === savedMenu.id)
      if (existing) {
        return prev.map((m) => (m.id === savedMenu.id ? savedMenu : m))
      } else {
        return [...prev, savedMenu]
      }
    })
    setShowEditor(false)
    setEditingMenu(null)
  }

  const handleDateChange = async (menu: Menu, newDate: string) => {
    try {
      const updated = await updateMenu(businessId || "main", menu.id, { serviceDate: newDate || null })
      if (updated) {
        setMenus((prev) => prev.map((m) => (m.id === menu.id ? updated : m)))
      }
    } catch (error) {
      console.error("Error updating menu date:", error)
      toast({ title: t("menus_toast_load_error_title"), description: t("menus_toast_date_error_desc"), variant: "destructive" })
    }
  }

  const getTotalDishes = (menu: Menu) => menu.items.filter((item) => item.enabled).length

  const getOverridesCount = (menu: Menu) => {
    return menu.items.filter((item) => item.priceOverride !== null && item.priceOverride !== undefined).length
  }

  const getRecipePrice = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.unitPrice || 0

  const getAveragePrice = (menu: Menu) => {
    const enabledItems = menu.items.filter((item) => item.enabled)
    if (enabledItems.length === 0) return 0

    const totalPrice = enabledItems.reduce((sum, item) => {
      const price = item.priceOverride ?? getRecipePrice(item.recipeId)
      return sum + price
    }, 0)

    return totalPrice / enabledItems.length
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ""
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return t("menus_time_ago_less_than_hour")
    if (diffInHours < 24)
      return t(diffInHours > 1 ? "menus_time_ago_hours_plural" : "menus_time_ago_hours_singular").replace("{count}", String(diffInHours))

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7)
      return t(diffInDays > 1 ? "menus_time_ago_days_plural" : "menus_time_ago_days_singular").replace("{count}", String(diffInDays))

    return date.toLocaleDateString(getDateLocale(language), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatServiceDate = (dateString?: string | null) => {
    if (!dateString) return null
    const date = new Date(`${dateString}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString(getDateLocale(language), { day: "2-digit", month: "short", year: "numeric" })
  }

  if (canAccessMenus === null) {
    return null
  }

  if (!canAccessMenus) {
    return getAccessBlockReason("menus") === "admin" ? (
      <AdminRestrictedPage sectionName={t("menus_page_title")} />
    ) : (
      <FeatureLockedPage feature="menus" title={t("menus_locked_title")} description={t("menus_locked_desc")} />
    )
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
              <MenusTour />
              {/* Header Section */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <Link href={businessId ? `/business/${businessId}` : "/dashboard"}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 hover:bg-accent bg-transparent"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                      <span className="sm:hidden">{t("common_back")}</span>
                    </Button>
                  </Link>
                  <div className="flex items-center gap-3" data-tour="menus-header">
                    <div className="w-12 h-12 bg-chart-6/10 rounded-lg flex items-center justify-center">
                      <ChefHat className="h-6 w-6 text-chart-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("menus_page_title")}</h1>
                      <p className="text-sm md:text-base text-muted-foreground">{t("menus_page_subtitle")}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <Button
                    data-tour="menus-new"
                    size="lg"
                    className="gap-2 px-6 py-3 font-semibold"
                    onClick={() => {
                      setEditingMenu(null)
                      setShowEditor(true)
                    }}
                  >
                    <Plus className="h-5 w-5" />
                    {t("menus_new_button")}
                  </Button>
                </div>
              </div>

              {/* Stats Overview */}
              {menus.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="border-2 border-border bg-chart-1/5">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">{menus.length}</div>
                      <div className="text-sm font-medium text-muted-foreground">{t("menus_stat_created")}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-border bg-chart-2/5">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {menus.reduce((sum, menu) => sum + getTotalDishes(menu), 0)}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">{t("menus_stat_total_dishes")}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-border bg-chart-6/5">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-foreground mb-1">
                        {menus.reduce((sum, menu) => sum + getOverridesCount(menu), 0)}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">{t("menus_stat_custom_prices")}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Filters Card */}
              <Card className="border-border bg-card">
                <CardHeader className="bg-muted/20 border-b-2 border-border">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    {t("menus_search_filters_title")}
                  </CardTitle>
                  <CardDescription>{t("menus_search_filters_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        type="text"
                        placeholder={t("menus_search_placeholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 border-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Menus List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : filteredMenus.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <GastrometricsLogo className="h-24 w-24 opacity-[0.08] mb-6" />
                    <h3 className="text-xl font-bold mb-3">
                      {searchQuery ? t("menus_empty_search_title") : t("menus_empty_title")}
                    </h3>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                      {searchQuery ? t("menus_empty_search_desc") : t("menus_empty_desc")}
                    </p>
                    {!searchQuery && (
                      <Button
                        size="lg"
                        className="gap-2 px-8 py-3 font-semibold"
                        onClick={() => {
                          setEditingMenu(null)
                          setShowEditor(true)
                        }}
                      >
                        <Plus className="h-5 w-5" />
                        {t("menus_empty_cta")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMenus.map((menu) => {
                    const totalDishes = getTotalDishes(menu)
                    const overridesCount = getOverridesCount(menu)
                    const averagePrice = getAveragePrice(menu)
                    const serviceDateLabel = formatServiceDate(menu.serviceDate)

                    return (
                      <Card
                        key={menu.id}
                        className="border-border transition-all duration-300 bg-card group"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 bg-chart-6/10 rounded-lg flex items-center justify-center shrink-0">
                                  <UtensilsCrossed className="h-4 w-4 text-chart-6" />
                                </div>
                                <CardTitle className="text-lg font-bold text-foreground truncate">
                                  {menu.name}
                                </CardTitle>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimeAgo(menu.updatedAt)}</span>
                                {menu.menuType && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {menu.menuType}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  data-tour="menus-card-menu-trigger"
                                  variant="ghost"
                                  size="sm"
                                  // BUG CORREGIDO: opacity-0 + group-hover dejaba este menú
                                  // (Editar/Duplicar/Exportar/Generar Orden de Compra/Eliminar)
                                  // inalcanzable en móvil, donde no existe :hover. Ahora es
                                  // siempre visible por debajo de md, y sigue apareciendo solo
                                  // al pasar el mouse (o al enfocar con teclado) en pantallas
                                  // más grandes.
                                  className="h-8 w-8 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handlePreviewMenu(menu)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t("menus_action_preview")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditMenu(menu)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t("menus_action_edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicateMenu(menu.id)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  {t("menus_action_duplicate")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportMenuPDF(menu, "cliente")}>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  {t("menus_action_export_client")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportMenuPDF(menu, "interno")}>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  {t("menus_action_export_internal")}
                                  {canExportAdminMenuPDF === false && <Lock className="ml-2 h-3 w-3 opacity-60" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-tour="menus-generate-order"
                                  onClick={() => router.push(`/business/${businessId || "main"}/ordenes-compra?fromMenu=${menu.id}`)}
                                >
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  {t("menus_action_generate_order")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMenuToDelete(menu.id)
                                    setShowDeleteConfirmation(true)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  {t("menus_action_delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-4">
                          {/* Fecha de servicio, editable directo desde la tarjeta */}
                          <Popover
                            open={datePickerMenuId === menu.id}
                            onOpenChange={(open) => setDatePickerMenuId(open ? menu.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 text-sm rounded-lg border border-dashed border-border px-3 py-2 hover:border-primary hover:bg-accent transition-colors text-left"
                              >
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {serviceDateLabel ? (
                                  <span className="text-foreground font-medium">{serviceDateLabel}</span>
                                ) : (
                                  <span className="text-muted-foreground">{t("menus_add_service_date")}</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 space-y-2" align="start">
                              <Label htmlFor={`date-${menu.id}`} className="text-xs">
                                {t("menus_service_date_label")}
                              </Label>
                              <Input
                                id={`date-${menu.id}`}
                                type="date"
                                defaultValue={menu.serviceDate || ""}
                                onChange={(e) => handleDateChange(menu, e.target.value)}
                                autoFocus
                              />
                            </PopoverContent>
                          </Popover>

                          <div className="bg-muted/20 p-3 rounded-lg border">
                            <div className="flex items-center gap-2 text-sm">
                              <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-semibold text-foreground">
                                {menu.steps.length} {t(menu.steps.length !== 1 ? "menus_step_plural" : "menus_step_singular")}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="font-semibold text-foreground">
                                {totalDishes} {t(totalDishes !== 1 ? "menus_dish_plural" : "menus_dish_singular")}
                              </span>
                            </div>
                            {menu.steps.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {menu.steps.map((step) => (
                                  <Badge key={step.id} variant="secondary" className="text-[10px]">
                                    {step.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {averagePrice > 0 && (
                            <div className="bg-chart-2/10 p-3 rounded-lg border border-chart-2/30">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                  {t("menus_avg_price_label")}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground shrink-0"
                                      >
                                        <Info className="h-3.5 w-3.5" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 space-y-2 text-xs" align="start">
                                      <p className="font-mono p-2 bg-muted/50 rounded border">
                                        {t("menus_avg_price_tooltip_formula")
                                          .replace(/\{count\}/g, String(getTotalDishes(menu)))
                                          .replace("{amount}", formatCurrency(averagePrice))}
                                      </p>
                                      <p className="text-muted-foreground">{t("menus_avg_price_tooltip_note")}</p>
                                    </PopoverContent>
                                  </Popover>
                                </span>
                                <span className="text-lg font-bold text-foreground">{formatCurrency(averagePrice)}</span>
                              </div>
                            </div>
                          )}

                          {overridesCount > 0 && (
                            <Badge variant="outline" className="text-xs font-semibold">
                              {overridesCount} {t(overridesCount !== 1 ? "menus_custom_price_plural" : "menus_custom_price_singular")}
                            </Badge>
                          )}

                          <div className="flex gap-2 pt-2 border-t border-border/50">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-2 bg-transparent"
                              onClick={() => handlePreviewMenu(menu)}
                            >
                              <Eye className="h-4 w-4" />
                              {t("menus_view_button")}
                            </Button>
                            <Button size="sm" className="flex-1 gap-2" onClick={() => handleEditMenu(menu)}>
                              <Edit className="h-4 w-4" />
                              {t("menus_action_edit")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* Delete Confirmation Dialog */}
              <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("menus_delete_confirm_title")}</DialogTitle>
                    <DialogDescription>{t("menus_delete_confirm_desc")}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>
                      {t("common_cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (menuToDelete) {
                          handleDeleteMenu(menuToDelete)
                        }
                        setShowDeleteConfirmation(false)
                        setMenuToDelete(null)
                      }}
                    >
                      {t("menus_action_delete")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Menu Wizard Dialog */}
              <MenuWizard
                open={showEditor}
                onOpenChange={setShowEditor}
                menu={editingMenu}
                businessId={businessId || "main"}
                onMenuSaved={handleMenuSaved}
              />

              {/* Menu Preview Dialog */}
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5" />
                      {t("menus_preview_title_prefix")} {previewMenu?.name}
                    </DialogTitle>
                    <DialogDescription>{t("menus_preview_desc")}</DialogDescription>
                  </DialogHeader>
                  {previewMenu && (
                    <div className="space-y-6">
                      <div className="text-center border-b pb-4">
                        <h2 className="text-2xl font-bold text-foreground mb-2">{previewMenu.name}</h2>
                        <div className="flex items-center justify-center gap-3 text-muted-foreground flex-wrap">
                          {previewMenu.menuType && <Badge variant="outline">{previewMenu.menuType}</Badge>}
                          {formatServiceDate(previewMenu.serviceDate) && (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatServiceDate(previewMenu.serviceDate)}
                            </span>
                          )}
                          <span className="text-sm">
                            {t("menus_preview_created_on")}{" "}
                            {new Date(previewMenu.createdAt).toLocaleDateString(getDateLocale(language), {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {previewMenu.steps.map((step) => {
                        const stepItems = previewMenu.items.filter((item) => item.stepId === step.id && item.enabled)
                        if (stepItems.length === 0) return null

                        return (
                          <div key={step.id} className="space-y-3">
                            <h3 className="text-xl font-bold text-foreground border-b border-border pb-2">
                              {step.name}
                            </h3>
                            <div className="grid gap-3">
                              {stepItems.map((item) => {
                                const recipe = recipes.find((r) => r.id === item.recipeId)
                                const price = item.priceOverride ?? getRecipePrice(item.recipeId)
                                return (
                                  <div
                                    key={item.id}
                                    className="flex justify-between items-start p-3 bg-muted/20 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-foreground">
                                        {item.label || recipe?.name}
                                      </h4>
                                      {item.priceOverride !== null && item.priceOverride !== undefined && (
                                        <Badge variant="outline" className="mt-2 text-xs">
                                          {t("menus_preview_custom_price_badge")}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-right ml-4">
                                      <span className="text-lg font-bold text-foreground">{formatCurrency(price)}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPreview(false)}>
                      {t("menus_preview_close")}
                    </Button>
                    {previewMenu && (
                      <Button
                        onClick={() => {
                          setShowPreview(false)
                          handleEditMenu(previewMenu)
                        }}
                      >
                        {t("menus_preview_edit_menu")}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
