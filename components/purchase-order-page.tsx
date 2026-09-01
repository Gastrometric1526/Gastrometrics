"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { getPurchaseOrders, savePurchaseOrders, duplicatePurchaseOrder, ensurePurchaseOrdersLoaded } from "@/lib/storage/purchase-orders"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { logActivity } from "@/lib/services/activity-log"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PurchaseOrderForm, type PurchaseOrderFormData, type PurchaseOrderFormItem } from "./purchase-order-form"
import { PackageSearch, ChefHat, Info } from "lucide-react"
import { OrdenesCompraTour } from "@/components/page-tours"
import { Sidebar } from "@/components/sidebar"
import { Flame, DollarSign, Boxes } from "lucide-react"
import { getIngredients, updateIngredient, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getInventory, ensureInventoryLoaded } from "@/lib/storage/inventory"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getMenuById, ensureMenusLoaded } from "@/lib/menus"
import { generateMenuIngredientList } from "@/lib/menus"
import { sortPurchaseOrderItemsBySupplier } from "@/lib/purchase-orders"
import { computePresentationQuantity } from "@/lib/utils/presentation-quantity"
import { ActivityTracker } from "@/lib/activity-tracker"
import { getBusinessById } from "@/lib/storage/businesses"
import { downloadPurchaseOrderPDF } from "@/lib/pdf/purchase-order-pdf-generator"
import { Download } from "lucide-react"
import { hasFeatureAccess, useFeatureAccess } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAccessBlockReason } from "@/lib/plan-access"
import type { Ingredient } from "@/types/ingredient"
import type { PurchaseOrder } from "@/types/purchase-order"

export function PurchaseOrderPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const businessId = params?.id as string | undefined

  const orderStatusLabels: Record<string, string> = {
    pending: t("ordenes_status_pending"),
    approved: t("ordenes_status_approved"),
    ordered: t("ordenes_status_ordered"),
    received: t("ordenes_status_received"),
    cancelled: t("ordenes_status_cancelled"),
  }
  const canAccessManualOrders = useFeatureAccess("purchase_orders_manual")
  const canAccessAutoOrders = useFeatureAccess("purchase_orders_auto")

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [suggestedFormData, setSuggestedFormData] = useState<PurchaseOrderFormData | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [inventoryItems, setInventoryItems] = useState<ReturnType<typeof getInventory>>([])
  const [recipeIngredientCounts, setRecipeIngredientCounts] = useState<[string, number][]>([])
  const [isAutoSuggestInfoOpen, setIsAutoSuggestInfoOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      ensureIngredientsLoaded(businessId),
      ensureInventoryLoaded(businessId),
      ensureRecipesLoaded(businessId),
    ]).then(() => {
      if (cancelled) return
      setIngredients(getIngredients(businessId))
      setInventoryItems(getInventory(businessId))

      const recipes = getRecipes(businessId)
      const counts = new Map<string, number>()
      recipes.forEach((r) => {
        const namesInRecipe = new Set((r.ingredients || []).map((ing) => ing.name).filter(Boolean))
        namesInRecipe.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1))
      })
      setRecipeIngredientCounts(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]))
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const mostUsedIngredients = useMemo(() => recipeIngredientCounts.slice(0, 3), [recipeIngredientCounts])

  const mostSpentInventoryIngredients = useMemo(
    () =>
      [...inventoryItems]
        .map((item) => ({ ...item, totalValue: (item.currentStock || 0) * (item.price || 0) }))
        .filter((item) => item.totalValue > 0)
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 3),
    [inventoryItems],
  )

  const mostExpensiveIngredients = useMemo(
    () =>
      [...ingredients]
        .filter((ing) => (ing.pricing?.pricePerUnit || 0) > 0)
        .sort((a, b) => (b.pricing?.pricePerUnit || 0) - (a.pricing?.pricePerUnit || 0))
        .slice(0, 3),
    [ingredients],
  )

  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.status === "low" || item.status === "critical"),
    [inventoryItems],
  )

  const handleDownloadOrderPDF = (order: PurchaseOrder) => {
    try {
      const business = getBusinessById(businessId || "main")
      downloadPurchaseOrderPDF(order, { businessName: business?.name, businessLogo: business?.logo, businessId: businessId || "main" })
    } catch (error) {
      console.error("Error downloading purchase order PDF:", error)
      toast({
        title: t("ordenes_toast_pdf_error_title"),
        description: t("ordenes_toast_pdf_error_desc"),
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([
        businessId ? ensurePurchaseOrdersLoaded(businessId) : Promise.resolve(),
        businessId ? ensureMenusLoaded(businessId) : Promise.resolve(),
        businessId ? ensureIngredientsLoaded(businessId) : Promise.resolve(),
        businessId ? ensureRecipesLoaded(businessId) : Promise.resolve(),
      ])
      if (cancelled) return
      loadOrdersAndDeepLinks()
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, searchParams, toast, t])

  function loadOrdersAndDeepLinks() {
    const loadedOrders = businessId ? getPurchaseOrders(businessId) : []
    setOrders(loadedOrders)

    // Deep-link desde menu-y-compras: ?edit={orderId} abre directo el diálogo de edición.
    const editId = searchParams.get("edit")
    if (editId) {
      const orderToEdit = loadedOrders.find((o) => o.id === editId)
      if (orderToEdit) {
        setEditingOrder(orderToEdit)
        setIsCreateDialogOpen(true)
      } else {
        toast({
          title: t("ordenes_toast_order_not_found_title"),
          description: t("ordenes_toast_order_not_found_desc"),
          variant: "destructive",
        })
      }
      return
    }

    // Deep-link desde /menus ("Generar Orden de Compra" en el menú de acciones de un
    // menú): ?fromMenu={menuId} arma una orden sugerida a partir de lo que ese menú
    // necesita (ver lib/menus.ts generateMenuIngredientList) menos lo que ya hay en
    // inventario, y abre el diálogo ya lleno para revisar antes de guardar.
    const fromMenuId = searchParams.get("fromMenu")
    if (fromMenuId && businessId) {
      if (!hasFeatureAccess("purchase_orders_auto")) {
        toast({
          title: t("ordenes_toast_plan_locked_title"),
          description: t("ordenes_toast_plan_locked_auto_menu_desc"),
          variant: "destructive",
        })
        return
      }

      const menu = getMenuById(businessId, fromMenuId)
      if (!menu) {
        toast({
          title: t("ordenes_toast_menu_not_found_title"),
          description: t("ordenes_toast_menu_not_found_desc"),
          variant: "destructive",
        })
        return
      }

      const result = generateMenuIngredientList(businessId, menu)
      if (result.items.length === 0) {
        toast({
          title: t("ordenes_toast_nothing_to_buy_title"),
          description: t("ordenes_toast_nothing_to_buy_desc"),
        })
        return
      }

      const currentIngredients = getIngredients(businessId)
      const items: PurchaseOrderFormItem[] = sortPurchaseOrderItemsBySupplier(
        result.items.map((item, index) => ({
          id: `menu-${fromMenuId}-${item.ingredientId}-${index}`,
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          quantity: Math.round(item.quantity * 100) / 100,
          unit: item.unit,
          unitPrice: Math.round(item.unitPrice * 100) / 100,
          totalPrice: Math.round(item.totalPrice * 100) / 100,
          supplier: item.supplier || "",
          presentation: item.presentation,
          presentationQuantity: item.presentationQuantity,
        })),
      )
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)

      setEditingOrder(null)
      setSuggestedFormData({
        orderNumber: `OC-${menu.name}-${Date.now()}`,
        supplier: "",
        orderDate: new Date().toISOString().split("T")[0],
        expectedDeliveryDate: "",
        status: "pending",
        items,
        subtotal,
        tax: 0,
        total: subtotal,
        notes: `Generada a partir del menú "${menu.name}". Ya se restó lo que hay en inventario — revisa cantidades y proveedor antes de guardar.`,
      })
      setIsCreateDialogOpen(true)
      toast({
        title: t("ordenes_toast_generated_from_menu_title"),
        description: t("ordenes_toast_generated_from_menu_desc").replace("{count}", String(items.length)).replace("{menu}", menu.name),
      })
    }
  }

  // Fija/cambia la presentación de un ingrediente directo desde la orden de compra (el
  // usuario la está viendo faltante justo ahí) y la persiste en su ficha, para que no
  // vuelva a faltar en la próxima orden que lo incluya.
  const handlePresentationPersist = (ingredientId: string, presentation: string) => {
    if (!businessId) return
    updateIngredient(ingredientId, { presentation: presentation as Ingredient["presentation"] }, businessId)
    setIngredients(getIngredients(businessId))
  }

  // Filtrar órdenes según término de búsqueda y estado
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || (order.status || "pending") === statusFilter
    return matchesSearch && matchesStatus
  })

  // Ordenar por fecha de creación (más reciente primero)
  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime(),
  )

  // Funciones para crear, editar y eliminar órdenes
  const handleCreateOrder = () => {
    setEditingOrder(null)
    setSuggestedFormData(null)
    setIsCreateDialogOpen(true)
  }

  // Genera una orden pre-llenada a partir de los ingredientes con stock bajo/crítico
  // (mismo status que ya calcula Inventario, ver types/inventory.ts). No se guarda nada
  // todavía: solo abre el formulario ya lleno para que el usuario revise cantidades y
  // proveedor antes de confirmar, igual que si la hubiera armado a mano.
  const handleAutoSuggestLocked = () => {
    toast({
      title: t("ordenes_toast_plan_locked_title"),
      description: t("ordenes_toast_plan_locked_auto_stock_desc"),
      variant: "destructive",
    })
  }

  const handleAutoSuggestOrder = () => {
    if (lowStockItems.length === 0) {
      toast({
        title: t("ordenes_toast_no_low_stock_title"),
        description: t("ordenes_toast_no_low_stock_desc"),
      })
      return
    }

    const items: PurchaseOrderFormItem[] = sortPurchaseOrderItemsBySupplier(
      lowStockItems.map((item, index) => {
        const ingredient = ingredients.find((ing) => ing.id === item.id)
        const unitPrice = ingredient?.pricing?.pricePerUnit || item.price || 0
        // Repone hasta el doble del mínimo configurado, para dejar margen antes de
        // volver a caer en alerta en vez de comprar justo lo mínimo otra vez.
        const targetStock = item.minStock * 2
        const quantity = Math.max(targetStock - (item.currentStock || 0), item.minStock)
        const { presentation, presentationQuantity } = computePresentationQuantity(
          (ingredient as Ingredient | undefined) || ({ presentation: item.presentation, unit: item.unit } as Ingredient),
          quantity,
        )

        return {
          id: `sugerido-${item.id}-${index}`,
          ingredientId: item.id,
          ingredientName: item.name,
          quantity: Math.round(quantity * 100) / 100,
          unit: item.unit,
          unitPrice: Math.round(unitPrice * 100) / 100,
          totalPrice: Math.round(quantity * unitPrice * 100) / 100,
          supplier: ingredient?.supplier || item.supplier || "",
          presentation,
          presentationQuantity,
        }
      }),
    )

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)

    // El campo "Proveedor" del encabezado es obligatorio en el formulario; si todos los
    // ingredientes sugeridos comparten proveedor se usa ese, si no, un texto genérico
    // (mismo texto que ya usan las órdenes armadas a mano con varios proveedores).
    const distinctSuppliers = new Set(items.map((item) => item.supplier).filter(Boolean))
    const headerSupplier = distinctSuppliers.size === 1 ? Array.from(distinctSuppliers)[0]! : t("ordenes_multiple_suppliers")

    setEditingOrder(null)
    setSuggestedFormData({
      orderNumber: `OC-Sugerida-${Date.now()}`,
      supplier: headerSupplier,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: "",
      status: "pending",
      items,
      subtotal,
      tax: 0,
      total: subtotal,
      notes: "Generada automáticamente a partir de ingredientes con stock bajo o crítico. Revisa cantidades y proveedor antes de guardar.",
    })
    setIsCreateDialogOpen(true)
    toast({
      title: t("ordenes_toast_suggestion_generated_title"),
      description: t("ordenes_toast_suggestion_generated_desc").replace("{count}", String(items.length)),
    })
  }

  const handleEditOrder = (order: PurchaseOrder) => {
    setEditingOrder(order)
    setIsCreateDialogOpen(true)
  }

  // BUG CORREGIDO: usaba confirm() nativo del navegador — sin estilo, no se adapta a
  // modo oscuro, y bloquea el hilo principal — en vez del AlertDialog que ya usa el
  // resto de la app para confirmaciones destructivas (ej. cerrar sesión en el sidebar).
  const [orderPendingDelete, setOrderPendingDelete] = useState<string | null>(null)

  const handleDeleteOrder = (orderId: string) => {
    setOrderPendingDelete(orderId)
  }

  const confirmDeleteOrder = () => {
    if (!orderPendingDelete) return
    const orderId = orderPendingDelete
    const updatedOrders = orders.filter((order) => order.id !== orderId)
    if (businessId) {
      savePurchaseOrders(businessId, updatedOrders)
    }
    setOrders(updatedOrders)
    setOrderPendingDelete(null)
    toast({
      title: t("ordenes_toast_deleted_title"),
      description: t("ordenes_toast_deleted_desc"),
    })
  }

  const handleDuplicateOrder = async (orderId: string) => {
    if (!businessId) return
    try {
      const newOrder = await duplicatePurchaseOrder(businessId, orderId)
      if (newOrder) {
        setOrders(businessId ? getPurchaseOrders(businessId) : [])
        toast({
          title: t("ordenes_toast_duplicated_title"),
          description: t("ordenes_toast_duplicated_desc"),
        })
      }
    } catch (error) {
      console.error("Error duplicating order:", error)
      toast({
        title: t("ordenes_toast_duplicate_error_title"),
        description: t("ordenes_toast_duplicate_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false)
    setEditingOrder(null)
    setSuggestedFormData(null)

    const updatedOrders = businessId ? getPurchaseOrders(businessId) : []
    setOrders(updatedOrders)
  }

  // BUG CORREGIDO: este componente le pasaba a <PurchaseOrderForm> props que ese
  // formulario nunca declara (businessId, onClose) en vez de los que sí usa
  // (onSubmit, onCancel) — el botón "Crear Orden"/"Actualizar Orden" llamaba a
  // onSubmit(formData) con onSubmit === undefined, crasheando siempre al enviar.
  // Tampoco se le pasaba availableIngredients, así que el selector de ingredientes
  // del formulario estaba siempre vacío. Se conecta correctamente aquí, mapeando
  // entre la forma que persiste lib/storage/purchase-orders.ts (types/purchase-order.ts)
  // y la forma que usa el formulario internamente (PurchaseOrderFormData).
  const handleFormSubmit = (data: PurchaseOrderFormData) => {
    if (!businessId) return

    const order: PurchaseOrder = {
      id: editingOrder?.id || `OC-${Date.now()}`,
      name: data.orderNumber,
      number: editingOrder?.number ?? Date.now(),
      date: data.orderDate,
      recipes: editingOrder?.recipes || [],
      items: data.items.map((item) => ({
        id: item.id,
        name: item.ingredientName,
        totalQuantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.unitPrice,
        purchaseCost: item.totalPrice,
        quantityToBuy: item.quantity,
        supplier: item.supplier || data.supplier || "",
        presentation: item.presentation,
        presentationQuantity: item.presentationQuantity,
      })),
      total: data.total,
      status: data.status,
      supplier: data.supplier,
      createdAt: editingOrder?.createdAt || new Date().toISOString(),
    }

    const updatedOrders = editingOrder
      ? orders.map((o) => (o.id === order.id ? order : o))
      : [...orders, order]

    savePurchaseOrders(businessId, updatedOrders)
    setOrders(updatedOrders)
    setIsCreateDialogOpen(false)
    setEditingOrder(null)
    setSuggestedFormData(null)
    ActivityTracker.addActivity(
      (editingOrder ? t("ordenes_activity_updated") : t("ordenes_activity_created")).replace("{name}", order.name),
      "purchase-order",
      businessId,
      { orderId: order.id, total: order.total },
    )
    if (user && businessId) {
      logActivity({
        user,
        businessId: businessId !== "main" ? businessId : null,
        module: "ordenes_compra",
        action: editingOrder ? "updated" : "created",
        entityLabel: order.name,
      })
    }
    toast({
      title: editingOrder ? t("ordenes_toast_updated_title") : t("ordenes_toast_created_title"),
      description: t("ordenes_toast_saved_desc").replace("{name}", order.name),
    })
  }

  // Traduce la orden guardada (forma de types/purchase-order.ts) a la forma que espera
  // el formulario para poder editarla — son campos distintos por diseño (ver arriba).
  const editingOrderFormData: PurchaseOrderFormData | null = editingOrder
    ? {
        id: editingOrder.id,
        orderNumber: editingOrder.name,
        supplier: editingOrder.supplier || "",
        orderDate: editingOrder.date,
        expectedDeliveryDate: "",
        status: editingOrder.status || "pending",
        items: editingOrder.items.map((item, index) => ({
          id: item.id || `item-${index}`,
          ingredientId: "",
          ingredientName: item.name,
          quantity: item.totalQuantity,
          unit: item.unit,
          unitPrice: item.costPerUnit,
          totalPrice: item.purchaseCost,
          supplier: item.supplier,
          presentation: item.presentation,
          presentationQuantity: item.presentationQuantity,
        })),
        subtotal: editingOrder.total,
        tax: 0,
        total: editingOrder.total,
        notes: "",
      }
    : null

  if (canAccessManualOrders === null) {
    return null
  }

  if (!canAccessManualOrders) {
    return getAccessBlockReason("purchase_orders_manual") === "admin" ? (
      <AdminRestrictedPage sectionName={t("ordenes_title")} />
    ) : (
      <FeatureLockedPage feature="purchase_orders_manual" title={t("ordenes_locked_title")} description={t("ordenes_locked_desc")} />
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 container mx-auto py-6 space-y-6">
        <OrdenesCompraTour />
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3" data-tour="ordenes-header">
          <div className="flex items-center gap-2 md:gap-4">
            <Link href={businessId ? `/business/${businessId}` : "/dashboard"}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common_back")}
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{t("ordenes_title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-tour="ordenes-auto-suggest"
              variant="outline"
              onClick={canAccessAutoOrders ? handleAutoSuggestOrder : handleAutoSuggestLocked}
              className="gap-2"
            >
              <PackageSearch className="h-4 w-4" />
              {t("ordenes_auto_suggest_button")}
              {canAccessAutoOrders && lowStockItems.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {lowStockItems.length}
                </Badge>
              )}
            </Button>
            {canAccessAutoOrders && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                onClick={() => setIsAutoSuggestInfoOpen(true)}
                title={t("ordenes_auto_suggest_info_tooltip")}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
            <Button data-tour="ordenes-new" onClick={handleCreateOrder}>{t("ordenes_new_button")}</Button>
          </div>
        </div>

        <Card data-tour="ordenes-search">
          <CardHeader>
            <CardTitle>{t("ordenes_search_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">{t("ordenes_search_name_label")}</Label>
                <Input
                  id="search"
                  placeholder={t("ordenes_search_placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Label htmlFor="status-filter">{t("ordenes_status_label")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("ordenes_status_all")}</SelectItem>
                    {Object.entries(orderStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour="ordenes-insights">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="h-4 w-4 text-chart-4" />
                {t("ordenes_insight_most_used_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {mostUsedIngredients.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("ordenes_insight_no_data")}</p>
              ) : (
                mostUsedIngredients.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{name}</span>
                    <span className="font-semibold text-foreground shrink-0">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Boxes className="h-4 w-4 text-chart-5" />
                {t("ordenes_insight_most_spent_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {mostSpentInventoryIngredients.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("ordenes_insight_no_data")}</p>
              ) : (
                mostSpentInventoryIngredients.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{item.name}</span>
                    <span className="font-semibold text-foreground shrink-0">{formatCurrency(item.totalValue)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-1" />
                {t("ordenes_insight_most_expensive_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {mostExpensiveIngredients.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("ordenes_insight_no_data")}</p>
              ) : (
                mostExpensiveIngredients.map((ing) => (
                  <div key={ing.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{ing.name}</span>
                    <span className="font-semibold text-foreground shrink-0">
                      {formatCurrency(ing.pricing?.pricePerUnit || 0)}/{ing.unit}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("ordenes_list_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>{t("ordenes_table_name")}</TableHead>
                      <TableHead>{t("ordenes_table_date")}</TableHead>
                      <TableHead>{t("ordenes_status_label")}</TableHead>
                      <TableHead>{t("ordenes_table_items")}</TableHead>
                      <TableHead>{t("ordenes_table_total")}</TableHead>
                      <TableHead>{t("ordenes_table_actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          {t("ordenes_table_empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.name}</TableCell>
                          <TableCell>{formatDate(order.date, getDateLocale(language))}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{orderStatusLabels[order.status || "pending"]}</Badge>
                          </TableCell>
                          <TableCell>{order.items.length}</TableCell>
                          <TableCell>{formatCurrency(order.total)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditOrder(order)}>
                                {t("ordenes_edit_button")}
                              </Button>
                              <Button data-tour="ordenes-row-pdf" variant="outline" size="sm" className="gap-1" onClick={() => handleDownloadOrderPDF(order)}>
                                <Download className="h-3.5 w-3.5" />
                                {t("ordenes_pdf_button")}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDuplicateOrder(order.id)}>
                                {t("ordenes_duplicate_button")}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteOrder(order.id)}>
                                {t("ordenes_delete_button")}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOrder ? t("ordenes_dialog_title_edit") : t("ordenes_dialog_title_new")}</DialogTitle>
              <DialogDescription>
                {editingOrder ? t("ordenes_dialog_desc_edit") : t("ordenes_dialog_desc_new")}
              </DialogDescription>
            </DialogHeader>

            <PurchaseOrderForm
              initialData={editingOrderFormData || suggestedFormData}
              availableIngredients={ingredients}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseDialog}
              onPresentationChange={handlePresentationPersist}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isAutoSuggestInfoOpen} onOpenChange={setIsAutoSuggestInfoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                {t("ordenes_auto_suggest_info_tooltip")}
              </DialogTitle>
              <DialogDescription>{t("ordenes_suggest_info_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs">{t("ordenes_suggest_info_formula")}</div>
              <p className="text-muted-foreground">{t("ordenes_suggest_info_note")}</p>
              {lowStockItems.length > 0 &&
                (() => {
                  const example = lowStockItems[0]
                  const targetStock = example.minStock * 2
                  const suggested = Math.max(targetStock - (example.currentStock || 0), example.minStock)
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300">
                      <p className="font-medium mb-1">{t("ordenes_suggest_info_example_prefix").replace("{name}", example.name)}</p>
                      <p className="font-mono text-xs">
                        máx(2 × {example.minStock} − {example.currentStock || 0}, {example.minStock}) = {Math.round(suggested * 100) / 100}{" "}
                        {example.unit}
                      </p>
                    </div>
                  )
                })()}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!orderPendingDelete} onOpenChange={(open) => !open && setOrderPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("ordenes_delete_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("ordenes_delete_confirm_desc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("ordenes_delete_button")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
