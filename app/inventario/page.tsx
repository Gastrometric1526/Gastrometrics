"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { useState, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { useBusinessIngredients } from "@/hooks/use-business-ingredients"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Sidebar } from "@/components/sidebar"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { InventarioTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { getInventory, saveInventory, getInventoryHistory } from "@/lib/storage/inventory"
import { getIngredients, saveIngredients } from "@/lib/storage/ingredients"
import { Badge } from "@/components/ui/badge"
import { InventoryForm } from "@/components/inventory/inventory-form"
import { formatDate } from "@/lib/constants"
import { InventoryDashboard } from "@/app/inventario/dashboard"
import { HistoryView } from "@/app/inventario/history-view"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import {
  PlusCircle,
  Search,
  Package,
  AlertTriangle,
  DollarSign,
  ClipboardList,
  BarChart3,
  Calendar,
  ArrowLeft,
} from "lucide-react"
import { presentations } from "@/types/ingredient"
import { RegisterInventoryModal } from "@/components/inventory/register-inventory-modal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getBusinessById } from "@/lib/storage/businesses"
import { downloadInventorySnapshotPDF, downloadCurrentInventoryPDF } from "@/lib/pdf/inventory-pdf-generator"
import { Download } from "lucide-react"
import { useFeatureAccess } from "@/lib/plan-access"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { getAccessBlockReason } from "@/lib/plan-access"
import { formatCurrency } from "@/lib/currency"

export default function InventoryPage() {
  const { isLoggedIn } = useAuth()
  const canAccessInventory = useFeatureAccess("inventory")
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const ingredients = useBusinessIngredients()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [searchTerm, setSearchQuery] = useState("")
  const { toast } = useToast()
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [inventoryHistory, setInventoryHistory] = useState<InventorySnapshot[]>([])
  const [activeTab, setActiveTab] = useState("inventory")
  const [isLoading, setIsLoading] = useState(true)
  const [isNoIngredientsDialogOpen, setIsNoIngredientsDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const [customMinStocks, setCustomMinStocks] = useState<Record<string, number>>({})
  const [isCriticalItemsDialogOpen, setIsCriticalItemsDialogOpen] = useState(false)

  const handleMinStockChange = (itemId: string, minStock: number) => {
    setCustomMinStocks((prev) => ({
      ...prev,
      [itemId]: minStock,
    }))

    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          minStock,
          status:
            item.currentStock !== null && item.currentStock <= minStock
              ? "critical"
              : item.currentStock !== null && item.currentStock <= minStock * 2
                ? "low"
                : "normal",
        }
      }
      return item
    })

    setItems(updatedItems)
  }

  const syncInventoryWithDatabase = (
    inventoryItems: InventoryItem[],
    ingredientsList: any[],
    updatePricesFromDB = false,
  ) => {
    return inventoryItems.map((item) => {
      const matchingIngredient = ingredientsList.find((ing) => ing.name === item.name)

      const hasCustomMinStock = customMinStocks[item.id] !== undefined

      if (matchingIngredient) {
        let updatedPrice = item.price

        if (updatePricesFromDB) {
          if (typeof matchingIngredient.purchasePrice === "number") {
            updatedPrice = matchingIngredient.purchasePrice
          } else if (matchingIngredient.pricing && typeof matchingIngredient.pricing.purchasePrice === "number") {
            updatedPrice = matchingIngredient.pricing.purchasePrice
          }
        }

        return {
          ...item,
          presentation: item.presentation || matchingIngredient.presentation,
          unit: item.unit || matchingIngredient.unit,
          price: updatedPrice,
          minStock: hasCustomMinStock ? customMinStocks[item.id] : item.minStock,
          currentStock: item.currentStock,
          status:
            item.currentStock !== null &&
            item.currentStock <= (hasCustomMinStock ? customMinStocks[item.id] : item.minStock)
              ? "critical"
              : item.currentStock !== null &&
                  item.currentStock <= (hasCustomMinStock ? customMinStocks[item.id] : item.minStock) * 2
                ? "low"
                : "normal",
        }
      }

      return {
        ...item,
        minStock: hasCustomMinStock ? customMinStocks[item.id] : item.minStock,
        currentStock: item.currentStock,
        status:
          item.currentStock !== null &&
          item.currentStock <= (hasCustomMinStock ? customMinStocks[item.id] : item.minStock)
            ? "critical"
            : item.currentStock !== null &&
                item.currentStock <= (hasCustomMinStock ? customMinStocks[item.id] : item.minStock) * 2
              ? "low"
              : "normal",
      }
    })
  }

  useEffect(() => {
    setIsLoading(true)

    const allIngredients = getIngredients(businessId)

    const timer = setTimeout(() => {
      if (ingredients.length > 0) {
        const storedInventory = getInventory(businessId)

        if (storedInventory && storedInventory.length > 0) {
          const currentItems = [...items]
          const syncedInventory = syncInventoryWithDatabase(storedInventory, allIngredients, true)

          // BUG CORREGIDO: este efecto se dispara cada vez que se abre/cierra
          // RegisterInventoryModal (isRegisterModalOpen en las dependencias). Al cerrar el
          // modal después de guardar una compra, sobreescribía el currentStock recién
          // guardado en storedInventory con el currentStock de "items" (el estado de esta
          // misma página, todavía desactualizado porque el guardado ocurrió dentro del
          // modal) — el resultado era que el stock actualizado se revertía a null/viejo
          // segundos después de registrar cualquier compra. storedInventory ya es la fuente
          // más reciente para currentStock; solo se preservan del estado local los campos
          // cosméticos que el usuario pudo haber editado sin persistir aún.
          const preservedInventory = syncedInventory.map((item) => {
            const existingItem = currentItems.find((current) => current.id === item.id)
            if (existingItem) {
              return {
                ...item,
                presentation: existingItem.presentation || item.presentation,
                supplier: existingItem.supplier || item.supplier,
                location: existingItem.location || item.location,
              }
            }
            return item
          })

          setItems(preservedInventory)
          saveInventory(preservedInventory, businessId)
        } else {
          const newInventoryItems = ingredients.map((ing) => {
            const matchingIngredient = allIngredients.find((dbIng: any) => dbIng.name === ing.name)

            let purchasePrice = 0

            if (ing.pricing && typeof ing.pricing.purchasePrice === "number") {
              purchasePrice = ing.pricing.purchasePrice
            } else if (typeof ing.purchasePrice === "number") {
              purchasePrice = ing.purchasePrice
            } else if (matchingIngredient) {
              if (typeof matchingIngredient.purchasePrice === "number") {
                purchasePrice = matchingIngredient.purchasePrice
              } else if (matchingIngredient.pricing && typeof matchingIngredient.pricing.purchasePrice === "number") {
                purchasePrice = matchingIngredient.pricing.purchasePrice
              }
            }

            const hasCustomMinStock = customMinStocks[ing.id] !== undefined
            const minStockValue = hasCustomMinStock
              ? customMinStocks[ing.id]
              : ing.netContent
                ? Number.parseFloat(ing.netContent)
                : 5

            return {
              id: ing.id,
              name: ing.name,
              category: ing.category,
              currentStock: null,
              minStock: minStockValue,
              unit: matchingIngredient?.unit || ing.unit,
              price: purchasePrice,
              location: ["Bodega Principal", "Almacén Secundario", "Cocina"][Math.floor(Math.random() * 3)],
              supplier: ing.supplier || "Proveedor General",
              lastUpdated: new Date().toLocaleDateString(),
              status: "normal",
              presentation: matchingIngredient?.presentation || null,
            }
          })
          setItems(newInventoryItems)
          saveInventory(newInventoryItems, businessId)
        }
      } else {
        setItems([])
      }

      const history = getInventoryHistory(businessId)
      setInventoryHistory(history || [])

      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [ingredients, isRegisterModalOpen])

  const handleCreate = () => {
    setSelectedItem(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id)
    setItems(updatedItems)
    saveInventory(updatedItems, businessId)
    toast({
      title: t("inventario_toast_success_title"),
      description: t("inventario_toast_item_deleted_desc"),
    })
  }

  const handleSave = (items: InventoryItem[]) => {
    const allIngredients = getIngredients(businessId)
    const syncedItems = syncInventoryWithDatabase(items, allIngredients, false)

    setItems(syncedItems)
  }

  const handleSubmit = (data: any) => {
    const existingItem = items.find((item) => item.id === selectedItem?.id)

    const allIngredients = getIngredients(businessId)
    const matchingIngredient = allIngredients.find((ing: any) => ing.name === data.name)

    // BUG CORREGIDO: price/unit se tomaban del ingrediente coincidente en Ingredientes
    // (o del item existente) ANTES que de data.price/data.unit — los campos que el
    // usuario acababa de escribir en este mismo formulario. Si el nombre coincidía con
    // un ingrediente real (el caso más común, ya que Inventario está pensado para
    // reflejar el mismo catálogo), cualquier precio o unidad que el usuario corrigiera
    // acá se descartaba en silencio y se guardaba el valor viejo. netContent tenía el
    // mismo problema pero peor: nunca se guardaba en absoluto (ni siquiera existía en
    // InventoryItem), así que ese campo requerido del formulario no servía para nada.
    // El sync automático con el catálogo de Ingredientes ya existe aparte
    // (syncInventoryWithDatabase, más abajo) — este formulario es donde el usuario
    // edita el ítem a mano, sus valores deben ganar.
    const newItem = {
      id: selectedItem?.id || uuidv4(),
      name: data.name,
      category: data.category,
      currentStock: data.currentStock,
      minStock: data.minStock,
      unit: data.unit || matchingIngredient?.unit || existingItem?.unit,
      price: data.price ?? existingItem?.price ?? matchingIngredient?.pricing?.purchasePrice ?? 0,
      netContent: data.netContent,
      location: data.location,
      supplier: data.supplier,
      lastUpdated: new Date().toLocaleDateString(),
      // BUG CORREGIDO: comparaba data.currentStock (que InventoryForm puede dejar en
      // null si no se ingresa nada) directo contra minStock — `null <= minStock`
      // coerce null a 0, así que un ítem recién creado sin stock ingresado quedaba
      // marcado "crítico" en vez de "sin contar todavía".
      status:
        data.currentStock === null || data.currentStock === undefined
          ? "normal"
          : data.currentStock <= data.minStock
            ? "critical"
            : data.currentStock <= data.minStock * 2
              ? "low"
              : "normal",
      presentation: matchingIngredient?.presentation || existingItem?.presentation || null,
    }

    let updatedItems
    if (selectedItem) {
      updatedItems = items.map((item) => (item.id === selectedItem.id ? newItem : item))
    } else {
      updatedItems = [...items, newItem]
    }

    setItems(updatedItems)
    saveInventory(updatedItems, businessId)
    setIsDialogOpen(false)
    setSelectedItem(null)
    toast({
      title: t("inventario_toast_success_title"),
      description: selectedItem ? t("inventario_toast_item_updated_desc") : t("inventario_toast_item_added_desc"),
    })
  }

  const handleCancel = () => {
    setIsDialogOpen(false)
    setSelectedItem(null)
  }

  // BUG CORREGIDO: esta funcion solo mostraba un toast simulando una exportacion,
  // nunca generaba ni descargaba ningun archivo real (ver docs/32). Ahora genera un
  // PDF real a partir del snapshot historico via lib/pdf/inventory-pdf-generator.ts.
  const exportInventory = (inventory: InventorySnapshot) => {
    try {
      const business = getBusinessById(businessId || "main")
      downloadInventorySnapshotPDF(inventory, { businessName: business?.name, businessId: businessId || "main" })
      toast({
        title: t("inventario_toast_exporting_title"),
        description: t("inventario_toast_exporting_desc").replace("{date}", formatDate(inventory.date, getDateLocale(language))),
      })
    } catch (error) {
      console.error("Error exporting inventory PDF:", error)
      toast({
        title: t("inventario_toast_error_title"),
        description: t("inventario_toast_pdf_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleExportCurrentInventory = () => {
    try {
      const business = getBusinessById(businessId || "main")
      downloadCurrentInventoryPDF(items, { businessName: business?.name, businessId: businessId || "main" })
    } catch (error) {
      console.error("Error exporting current inventory PDF:", error)
      toast({
        title: t("inventario_toast_error_title"),
        description: t("inventario_toast_pdf_error_desc"),
        variant: "destructive",
      })
    }
  }

  const handleRegisterInventoryClick = () => {
    if (ingredients.length === 0) {
      setIsNoIngredientsDialogOpen(true)
    } else {
      setIsRegisterModalOpen(true)
    }
  }

  const refreshInventoryData = () => {
    const currentItems = [...items]

    const storedInventory = getInventory(businessId)
    if (storedInventory) {
      // Mismo bug que en el useEffect de arriba: esta función la llama directamente
      // RegisterInventoryModal por su prop onOpenChange al cerrar tras guardar, ANTES de
      // que el useEffect debounced llegue a correr — así que era esta la que realmente
      // pisaba el currentStock recién guardado con el de "items" (desactualizado).
      const preservedInventory = storedInventory.map((item) => {
        const existingItem = currentItems.find((current) => current.id === item.id)
        if (existingItem) {
          return {
            ...item,
            presentation: existingItem.presentation || item.presentation,
            supplier: existingItem.supplier || item.supplier,
            location: existingItem.location || item.location,
          }
        }
        return item
      })

      setItems(preservedInventory)
      saveInventory(preservedInventory, businessId)
    }

    const history = getInventoryHistory(businessId)
    if (history) {
      setInventoryHistory(history)
    }

    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
    }, 100)
  }

  const navigateToIngredients = () => {
    router.push("/ingredientes")
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "" || item.category === categoryFilter
    const matchesStatus = statusFilter === "" || item.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const handlePresentationChange = (itemId: string, presentation: string) => {
    const inventoryItem = items.find((item) => item.id === itemId)
    if (!inventoryItem) return

    const allIngredients = getIngredients(businessId)
    if (!allIngredients) return

    const updatedIngredients = allIngredients.map((ing: any) => {
      if (ing.name === inventoryItem.name) {
        return { ...ing, presentation }
      }
      return ing
    })

    saveIngredients(updatedIngredients, businessId)

    const updatedItems = items.map((item) => {
      if (item.id === itemId) {
        return { ...item, presentation }
      }
      return item
    })

    setItems(updatedItems)
    saveInventory(updatedItems, businessId)

    toast({
      title: t("inventario_toast_presentation_updated_title"),
      description: t("inventario_toast_presentation_updated_desc_page"),
    })
  }

  if (!isLoggedIn) {
    return null
  }

  // canAccessInventory === null mientras el hook todavia no confirma que ya
  // estamos montados en el cliente (ver useFeatureAccess) — no renderizar nada
  // todavia evita el mismatch de hidratacion entre servidor y cliente.
  if (canAccessInventory === null) {
    return null
  }

  if (!canAccessInventory) {
    return getAccessBlockReason("inventory") === "admin" ? (
      <AdminRestrictedPage sectionName={t("nav_inventario")} />
    ) : (
      <FeatureLockedPage
        feature="inventory"
        title={t("inventario_locked_title")}
        description={t("inventario_locked_desc")}
      />
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <InventarioTour />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                <div data-tour="inv-header">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("inventario_page_title")}</h1>
                  <p className="text-muted-foreground mt-1">
                    {t("inventario_page_subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button data-tour="inv-add" onClick={handleCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t("inventario_add_product_button")}
                </Button>
                <Button data-tour="inv-register" onClick={handleRegisterInventoryClick} className="bg-green-600 hover:bg-green-700 text-white">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {t("inventario_register_button")}
                </Button>
                <Button data-tour="inv-export-pdf" variant="outline" onClick={handleExportCurrentInventory} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
            </div>

            <Tabs defaultValue="inventory" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <TabsList className="w-full sm:w-auto bg-card border border-border shadow-sm">
                  <TabsTrigger value="inventory" className="flex-1 sm:flex-initial data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Package className="mr-2 h-4 w-4" />
                    {t("inventario_tab_inventory")}
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="flex-1 sm:flex-initial">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {t("nav_dashboard")}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 sm:flex-initial">
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("inventario_tab_history")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="inventory" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-card shadow-md border border-border">
                    <CardContent className="flex items-center p-6">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t("inventario_stat_total_products")}</p>
                        <div className="flex items-baseline">
                          <h3 className="text-2xl font-bold text-foreground">{items.length}</h3>
                          <Badge variant="outline" className="ml-2 border-border">
                            {isLoading ? "..." : t("inventario_badge_filtered").replace("{count}", String(filteredItems.length))}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="bg-card shadow-md border border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setIsCriticalItemsDialogOpen(true)}
                  >
                    <CardContent className="flex items-center p-6">
                      <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mr-4">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t("inventario_stat_critical_products")}</p>
                        <div className="flex items-baseline">
                          <h3 className="text-2xl font-bold">
                            {
                              items.filter((item) => item.currentStock !== null && item.currentStock <= item.minStock)
                                .length
                            }
                          </h3>
                          <p className="text-sm text-muted-foreground ml-2">
                            {isLoading
                              ? ""
                              : items.length > 0
                                ? `${Math.round(
                                    (items.filter(
                                      (item) => item.currentStock !== null && item.currentStock <= item.minStock,
                                    ).length /
                                      items.length) *
                                      100,
                                  )}%`
                                : "0%"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card shadow-md border border-border">
                    <CardContent className="flex items-center p-6">
                      <div className="h-12 w-12 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center mr-4">
                        <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t("inventario_stat_total_value")}</p>
                        <div className="flex items-baseline">
                          <h3 className="text-2xl font-bold">
                            {formatCurrency(
                              items.reduce((sum, item) => sum + (item.currentStock || 0) * (item.price || 0), 0),
                            )}
                          </h3>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-md border border-border bg-card">
                  <CardHeader className="pb-3 bg-muted/30 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="text-card-foreground">{t("inventario_current_inventory_title")}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="search"
                            placeholder={t("inventario_search_placeholder")}
                            value={searchTerm}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 bg-background border-border focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-3 text-muted-foreground">{t("inventario_loading")}</span>
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="text-center py-12">
                        <GastrometricsLogo className="h-24 w-24 opacity-[0.08] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground">{t("inventario_empty_title")}</h3>
                        <p className="text-muted-foreground mt-1 mb-6">
                          {searchTerm
                            ? t("inventario_empty_search_desc")
                            : t("inventario_empty_no_search_desc")}
                        </p>
                        {searchTerm ? (
                          <Button variant="outline" onClick={() => setSearchQuery("")}>
                            {t("inventario_clear_search_button")}
                          </Button>
                        ) : (
                          <Button onClick={handleCreate}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            {t("inventario_add_product_button")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <InventoryTable
                        items={filteredItems}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSave={handleSave}
                        onPresentationChange={handlePresentationChange}
                        onMinStockChange={handleMinStockChange}
                        availablePresentations={[...presentations]}
                      />
                    )}
                  </CardContent>
                  <CardFooter className="border-t border-border px-6 py-3 bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      {t("inventario_showing_count")
                        .replace("{shown}", String(filteredItems.length))
                        .replace("{total}", String(items.length))}
                    </p>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="dashboard">
                <InventoryDashboard inventoryItems={items} inventoryHistory={inventoryHistory} isLoading={isLoading} />
              </TabsContent>

              <TabsContent value="history">
                {inventoryHistory && inventoryHistory.length > 0 ? (
                  <HistoryView
                    inventoryHistory={inventoryHistory}
                    exportInventory={exportInventory}
                    isLoading={isLoading}
                  />
                ) : (
                  <Card className="shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">{t("inventario_history_empty_title")}</h3>
                      <p className="text-muted-foreground text-center max-w-md mt-1 mb-6">
                        {t("inventario_history_empty_desc")}
                      </p>
                      <Button
                        onClick={handleRegisterInventoryClick}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t("inventario_register_button")}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog open={isNoIngredientsDialogOpen} onOpenChange={setIsNoIngredientsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("inventario_no_ingredients_title")}
            </DialogTitle>
            <DialogDescription>
              {t("inventario_no_ingredients_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <div className="rounded-full bg-amber-50 dark:bg-amber-950/40 p-3">
              <Package className="h-10 w-10 text-amber-500" />
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground px-4">
            {t("inventario_no_ingredients_body")}
          </p>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-center gap-2 mt-2">
            <Button variant="outline" onClick={() => setIsNoIngredientsDialogOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button onClick={navigateToIngredients} className="bg-amber-500 hover:bg-amber-600 text-white">
              {t("inventario_go_to_ingredients_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? t("inventario_edit_item_title") : t("inventario_add_item_title")}</DialogTitle>
            <DialogDescription>
              {t("inventario_item_form_desc")}
            </DialogDescription>
          </DialogHeader>
          <InventoryForm onSubmit={handleSubmit} onCancel={handleCancel} initialData={selectedItem} />
        </DialogContent>
      </Dialog>

      <RegisterInventoryModal
        open={isRegisterModalOpen}
        onOpenChange={(open) => {
          setIsRegisterModalOpen(open)
          if (!open) {
            refreshInventoryData()
          }
        }}
        ingredients={ingredients}
        businessId={businessId}
      />

      <Dialog open={isCriticalItemsDialogOpen} onOpenChange={setIsCriticalItemsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t("inventario_stat_critical_products")}
            </DialogTitle>
            <DialogDescription>{t("inventario_critical_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.filter((item) => item.currentStock !== null && item.currentStock <= item.minStock).length === 0 ? (
              <div className="text-center py-8">
                <p>{t("inventario_critical_empty")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("inventario_table_name")}</TableHead>
                    <TableHead>{t("inventario_min_stock_label")}</TableHead>
                    <TableHead>{t("inventario_current_stock_label")}</TableHead>
                    <TableHead>{t("inventario_table_missing")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .filter((item) => item.currentStock !== null && item.currentStock <= item.minStock)
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.minStock} {item.unit}
                        </TableCell>
                        <TableCell className="text-red-600 dark:text-red-300 font-medium">
                          {item.currentStock} {item.unit}
                        </TableCell>
                        <TableCell>
                          {(item.minStock - item.currentStock).toFixed(2)} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCriticalItemsDialogOpen(false)}>{t("common_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
