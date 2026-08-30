"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { useToast } from "@/hooks/use-toast"
import { Sidebar } from "@/components/sidebar"
import { NegociosTour } from "@/components/page-tours"
import { AddBusinessDialog } from "@/components/add-business-dialog"
import {
  Building2,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react"
import type { Business } from "@/types/business"
import { calculateExpensePercentages, calculateTotalMonthlyExpenses } from "@/types/business"
import { formatCurrency as formatCurrencyShared } from "@/lib/currency"
import { updateBusiness, deleteBusiness, getAllBusinesses, refreshBusinesses } from "@/lib/storage/businesses"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"

export default function NegociosPage() {
  const router = useRouter()
  const { isLoggedIn, authChecked } = useAuth()
  const { t, language } = useLanguage()
  const { toast } = useToast()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null)
  const [deleteSummary, setDeleteSummary] = useState({ recipes: 0, ingredients: 0 })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [stats, setStats] = useState({
    totalBusinesses: 0,
    activeBusinesses: 0,
    totalRevenue: 0,
  })

  // Función para obtener valores seguros de gastos
  const getSafeExpenseValue = (value: any): number => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0
    }
    return Number(value)
  }

  // BUG CORREGIDO: formateaba con "L" (Lempira) fijo sin importar la moneda elegida
  // en Configuración. Ahora delega en el formateador compartido (@/lib/currency),
  // conservando solo la parte útil de esta función local: blindar contra
  // valores null/NaN antes de formatear.
  const formatCurrency = (amount: any): string => {
    const safeAmount = getSafeExpenseValue(amount)
    return formatCurrencyShared(safeAmount)
  }

  useEffect(() => {
    if (!authChecked) return

    if (!isLoggedIn) {
      router.push("/login")
      return
    }

    loadBusinesses()
  }, [isLoggedIn, authChecked, router])

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      await refreshBusinesses()
      const savedBusinesses = getAllBusinesses()

      // Normalizar los datos de negocios para evitar errores
      const normalizedBusinesses = savedBusinesses.map((business: any) => ({
        ...business,
        expenses: business.expenses
          ? {
              rent: getSafeExpenseValue(business.expenses.rent),
              utilities: getSafeExpenseValue(business.expenses.utilities),
              operationalCosts: getSafeExpenseValue(business.expenses.operationalCosts),
              marketing: getSafeExpenseValue(business.expenses.marketing),
              laborCosts: getSafeExpenseValue(business.expenses.laborCosts),
              otherExpenses: getSafeExpenseValue(business.expenses.otherExpenses),
            }
          : null,
        estimatedMonthlyPlates: getSafeExpenseValue(business.estimatedMonthlyPlates),
        averageTicket: getSafeExpenseValue(business.averageTicket),
      }))

      setBusinesses(normalizedBusinesses)

      // Calculate stats
      const activeCount = normalizedBusinesses.filter((b: Business) => b.isActive !== false).length
      await Promise.all(normalizedBusinesses.map((business: Business) => ensureRecipesLoaded(business.id)))
      const totalRevenue = normalizedBusinesses.reduce((sum: number, business: Business) => {
        try {
          const businessRecipes = getRecipes(business.id)
          return (
            sum +
            businessRecipes.reduce((recipeSum: number, recipe) => {
              return recipeSum + getSafeExpenseValue(recipe.totalPrice)
            }, 0)
          )
        } catch (error) {
          console.error(`Error loading recipes for business ${business.id}:`, error)
          return sum
        }
      }, 0)

      setStats({
        totalBusinesses: normalizedBusinesses.length,
        activeBusinesses: activeCount,
        totalRevenue,
      })
    } catch (error) {
      console.error("Error loading businesses:", error)
      toast({
        title: t("negocios_toast_load_error_title"),
        description: t("negocios_toast_load_error_desc"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBusinessCreated = (newBusiness: Business) => {
    const normalizedBusiness = {
      ...newBusiness,
      expenses: newBusiness.expenses
        ? {
            rent: getSafeExpenseValue(newBusiness.expenses.rent),
            utilities: getSafeExpenseValue(newBusiness.expenses.utilities),
            operationalCosts: getSafeExpenseValue(newBusiness.expenses.operationalCosts),
            marketing: getSafeExpenseValue(newBusiness.expenses.marketing),
            laborCosts: getSafeExpenseValue(newBusiness.expenses.laborCosts),
            otherExpenses: getSafeExpenseValue(newBusiness.expenses.otherExpenses),
          }
        : undefined,
    }

    setBusinesses((prev) => [...prev, normalizedBusiness])
    setStats((prev) => ({
      ...prev,
      totalBusinesses: prev.totalBusinesses + 1,
      activeBusinesses: prev.activeBusinesses + 1,
    }))
    setShowAddDialog(false)
    toast({
      title: t("negocios_toast_created_title"),
      description: t("negocios_toast_created_desc").replace("{name}", newBusiness.name),
    })
  }

  const handleBusinessClick = (businessId: string) => {
    router.push(`/business/${businessId}`)
  }

  // BUG CORREGIDO: el badge Activo/Inactivo existía desde siempre pero no había forma
  // de poner un negocio en Inactivo — isActive se escribía en true al crear el negocio
  // y nunca se volvía a tocar. Esto le da una acción real: desactivar/reactivar no borra
  // nada (recetas, inventario, etc. quedan intactos), solo saca al negocio del conteo de
  // "Negocios Activos" y lo marca como archivado.
  const handleToggleActive = (business: Business) => {
    const nextIsActive = business.isActive === false
    updateBusiness(business.id, { isActive: nextIsActive })
    setBusinesses((prev) => prev.map((b) => (b.id === business.id ? { ...b, isActive: nextIsActive } : b)))
    setStats((prev) => ({
      ...prev,
      activeBusinesses: prev.activeBusinesses + (nextIsActive ? 1 : -1),
    }))
    toast({
      title: nextIsActive ? t("negocios_toast_reactivated_title") : t("negocios_toast_deactivated_title"),
      description: nextIsActive
        ? t("negocios_toast_reactivated_desc").replace("{name}", business.name)
        : t("negocios_toast_deactivated_desc").replace("{name}", business.name),
    })
  }

  // Pedido explícito del dueño del proyecto: hasta ahora deleteBusiness() (lib/storage/
  // businesses.ts) existía en la capa de storage pero ningún botón lo llamaba —
  // borrar un negocio no era posible desde la interfaz. Todas las tablas de negocio
  // tienen "business_id ... on delete cascade" (ver supabase/migrations), así que
  // borrar la fila de businesses ya limpia solo recetas, ingredientes, inventario,
  // menús y órdenes de compra — no hace falta borrar cada uno a mano acá.
  const openDeleteDialog = async (business: Business) => {
    await ensureIngredientsLoaded(business.id)
    setDeleteSummary({
      recipes: getRecipes(business.id).length,
      ingredients: getIngredients(business.id).length,
    })
    setBusinessToDelete(business)
  }

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return
    setIsDeleting(true)
    const ok = await deleteBusiness(businessToDelete.id)
    setIsDeleting(false)
    if (!ok) {
      toast({
        title: t("negocios_toast_delete_error_title"),
        description: t("negocios_toast_delete_error_desc"),
        variant: "destructive",
      })
      return
    }
    setBusinesses((prev) => prev.filter((b) => b.id !== businessToDelete.id))
    setStats((prev) => ({
      ...prev,
      totalBusinesses: prev.totalBusinesses - 1,
      activeBusinesses: businessToDelete.isActive !== false ? prev.activeBusinesses - 1 : prev.activeBusinesses,
    }))
    toast({
      title: t("negocios_toast_deleted_title"),
      description: t("negocios_toast_deleted_desc").replace("{name}", businessToDelete.name),
    })
    setBusinessToDelete(null)
    setDeleteConfirmName("")
  }

  const deleteConfirmMatches =
    !!businessToDelete && deleteConfirmName.trim().toLowerCase() === businessToDelete.name.trim().toLowerCase()

  // BUG CORREGIDO: new Date(undefined) no lanza una excepción, produce una fecha
  // inválida en silencio — el try/catch nunca se activaba y el resultado terminaba
  // siendo NaN, mostrando "NaN días activo" si createdAt llegaba vacío.
  const getDaysActive = (createdAt: string) => {
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return 0
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <NegociosTour />
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div data-tour="negocios-header">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("negocios_title")}</h1>
              <p className="text-sm md:text-base text-muted-foreground">{t("negocios_subtitle")}</p>
            </div>
            <Button
              data-tour="negocios-new"
              onClick={() => setShowAddDialog(true)}
              className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("negocios_new_button")}
            </Button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-tour="negocios-stats">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("negocios_stat_total")}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.totalBusinesses}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("negocios_stat_active")}</p>
                    <p className="text-2xl font-bold text-foreground">{stats.activeBusinesses}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("negocios_stat_revenue")}</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-300" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Businesses List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">{t("negocios_list_title")}</h2>
              <Badge variant="outline" className="text-xs">
                {businesses.length} {businesses.length === 1 ? t("negocios_count_singular") : t("negocios_count_plural")}
              </Badge>
            </div>

            {businesses.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("negocios_empty_title")}</h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">{t("negocios_empty_desc")}</p>
                  <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("negocios_empty_cta")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {businesses.map((business) => {
                  const expensePercentages = business.expenses ? calculateExpensePercentages(business.expenses) : null
                  const daysActive = getDaysActive(business.createdAt)

                  return (
                    <Card
                      key={business.id}
                      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 w-full"
                      onClick={() => handleBusinessClick(business.id)}
                    >
                      <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-3 bg-primary/10 rounded-lg">
                              <Building2 className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                  {business.name}
                                </h3>
                                <Badge
                                  variant={business.isActive !== false ? "default" : "secondary"}
                                  className={business.isActive !== false ? "bg-green-600" : ""}
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full mr-2 ${business.isActive !== false ? "bg-green-200" : "bg-gray-400"}`}
                                  />
                                  {business.isActive !== false ? t("negocios_badge_active") : t("negocios_badge_inactive")}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {t("negocios_created_label")}{" "}
                                  {new Date(business.createdAt).toLocaleDateString(getDateLocale(language), {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {daysActive} {daysActive === 1 ? t("negocios_days_singular") : t("negocios_days_plural")} {t("negocios_days_active_suffix")}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-blue-100 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                                    ID: {business.id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="group-hover:bg-primary group-hover:text-primary-foreground transition-all bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleBusinessClick(business.id)
                              }}
                            >
                              {t("negocios_access_button")}
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="shrink-0 bg-transparent"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => handleToggleActive(business)}>
                                  {business.isActive !== false ? (
                                    <>
                                      <PauseCircle className="h-4 w-4 mr-2" />
                                      {t("negocios_deactivate")}
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="h-4 w-4 mr-2" />
                                      {t("negocios_reactivate")}
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(business)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("negocios_delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <Separator className="mb-6" />

                        {/* Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Business Info */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
                              <h4 className="font-semibold text-foreground">{t("negocios_config_status_title")}</h4>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{t("negocios_financial_data_label")}</span>
                                <div className="flex items-center gap-2">
                                  {business.hasFinancialData ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />
                                      <span className="text-sm font-medium text-green-700 dark:text-green-300">{t("negocios_status_configured")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{t("negocios_status_pending")}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{t("negocios_initial_config_label")}</span>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300" />
                                  <span className="text-sm font-medium text-green-700 dark:text-green-300">{t("negocios_status_complete")}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Financial Summary */}
                          {business.hasFinancialData && business.expenses ? (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                              <div className="flex items-center gap-2 mb-3">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300">{t("negocios_financial_summary_title")}</h4>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_rent")}</span>
                                  <span className="font-medium text-blue-900 dark:text-blue-300">
                                    {formatCurrency(business.expenses.rent)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_utilities")}</span>
                                  <span className="font-medium text-blue-900 dark:text-blue-300">
                                    {formatCurrency(business.expenses.utilities)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_marketing")}</span>
                                  <span className="font-medium text-blue-900 dark:text-blue-300">
                                    {formatCurrency(business.expenses.marketing)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_operational")}</span>
                                  <span className="font-medium text-blue-900 dark:text-blue-300">
                                    {formatCurrency(business.expenses.operationalCosts)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_labor")}</span>
                                  <span className="font-medium text-blue-900 dark:text-blue-300">
                                    {formatCurrency(business.expenses.laborCosts)}
                                  </span>
                                </div>
                                {business.expenses.otherExpenses &&
                                  getSafeExpenseValue(business.expenses.otherExpenses) > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-blue-700 dark:text-blue-300">{t("negocios_expense_other")}</span>
                                      <span className="font-medium text-blue-900 dark:text-blue-300">
                                        {formatCurrency(business.expenses.otherExpenses)}
                                      </span>
                                    </div>
                                  )}
                                <Separator className="my-2" />
                                <div className="flex justify-between items-center font-bold">
                                  <span className="text-blue-800 dark:text-blue-300">{t("negocios_expense_total_monthly")}</span>
                                  <span className="text-lg text-blue-900 dark:text-blue-300">
                                    {formatCurrency(calculateTotalMonthlyExpenses(business.expenses))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-lg border border-amber-200 dark:border-amber-900">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                                <h4 className="font-semibold text-amber-800 dark:text-amber-300">{t("negocios_config_pending_title")}</h4>
                              </div>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{t("negocios_config_pending_desc")}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 bg-transparent"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Navigate to business setup or edit
                                  router.push(`/business/${business.id}`)
                                }}
                              >
                                {t("negocios_configure_now")}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AddBusinessDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onBusinessAdded={handleBusinessCreated}
      />

      {/* Borrar negocio — irreversible, requiere escribir el nombre exacto (mismo
          patrón que el borrado de cuentas en /admin, ver docs/71) */}
      <AlertDialog
        open={!!businessToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setBusinessToDelete(null)
            setDeleteConfirmName("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("negocios_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  {t("negocios_delete_confirm_summary")
                    .replace("{name}", businessToDelete?.name || "")
                    .replace("{recipes}", String(deleteSummary.recipes))
                    .replace("{ingredients}", String(deleteSummary.ingredients))}
                </p>
                <p className="font-semibold text-foreground">{t("negocios_delete_confirm_irreversible")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-business-confirm" className="text-xs text-muted-foreground">
              {t("negocios_delete_confirm_input_label").replace("{name}", businessToDelete?.name || "")}
            </Label>
            <Input
              id="delete-business-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={businessToDelete?.name}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common_cancel")}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteBusiness} disabled={!deleteConfirmMatches || isDeleting}>
              {isDeleting ? t("negocios_deleting") : t("negocios_delete_button")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
