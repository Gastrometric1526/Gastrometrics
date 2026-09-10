"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, CheckCircle, AlertCircle, Upload } from "lucide-react"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getPurchaseOrders, ensurePurchaseOrdersLoaded, savePurchaseOrders } from "@/lib/storage/purchase-orders"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { processPdfOrder } from "@/utils/pdf-order-processor"
import type { ProcessedOrder, ValidationResult, PurchaseOrder } from "@/types/purchase-order"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"

interface PdfOrderProcessorProps {
  businessId?: string
}

// Create a memoized validation status component
const ValidationStatus = memo(
  ({ validation, validatedLabel }: { validation: ValidationResult; validatedLabel: string }) => {
    if (validation.isValid) {
      return (
        <Badge variant="outline" className="bg-success-soft text-success">
          <CheckCircle className="h-3 w-3 mr-1" /> {validatedLabel}
        </Badge>
      )
    } else {
      return (
        <Badge
          variant="outline"
          className="bg-warning-soft dark:bg-amber-950/40 text-warning border-amber-200 dark:border-amber-900"
        >
          <AlertCircle className="h-3 w-3 mr-1" /> {validation.message}
        </Badge>
      )
    }
  },
)

// Create a memoized order item component
const OrderItem = memo(({ item, index, t }: { item: any; index: number; t: (key: any) => string }) => (
  <div key={index} className="border-t pt-2 flex justify-between items-center">
    <div className="flex-1">
      <p className="font-medium">{item.name}</p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {item.quantity} {item.unit}
        </span>
        <span>•</span>
        <span>
          {formatCurrency(item.unitPrice || 0)}
          {t("procesar_per_unit_suffix")}
        </span>
        <span>•</span>
        <span>
          {t("procesar_total_label")} {formatCurrency(item.totalPrice || 0)}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">{t("procesar_supplier_label")} </span>
        <span>{item.supplier || t("procesar_supplier_unspecified")}</span>
      </div>
    </div>
    <div>
      <ValidationStatus validation={item.validation} validatedLabel={t("procesar_validated_badge")} />
    </div>
  </div>
))

// Create a memoized order component
const OrderCard = memo(
  ({ order, orderIndex, t }: { order: ProcessedOrder; orderIndex: number; t: (key: any) => string }) => (
    <div key={orderIndex} className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-base font-semibold">
            {order.orderName || t("procesar_order_fallback_name").replace("{number}", String(order.orderNumber))}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t("procesar_order_number_label")} {order.orderNumber} • {t("procesar_order_date_label")}
            {""}
            {new Date(order.date || Date.now()).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline">
          {order.items.length} {t("procesar_items_suffix")}
        </Badge>
      </div>

      <div className="space-y-2">
        {order.items.map((item, itemIndex) => (
          <OrderItem key={itemIndex} item={item} index={itemIndex} t={t} />
        ))}
      </div>

      <div className="mt-4 pt-2 border-t flex justify-between items-center">
        <span className="font-medium">{t("procesar_total_label")}</span>
        <span className="font-bold">
          {formatCurrency(order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0))}
        </span>
      </div>
    </div>
  ),
)

export function PdfOrderProcessor({ businessId }: PdfOrderProcessorProps) {
  const { t } = useLanguage()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [processedOrders, setProcessedOrders] = useState<ProcessedOrder[]>([])
  const [activeTab, setActiveTab] = useState("upload")
  const [ingredientsRefreshKey, setIngredientsRefreshKey] = useState(0)
  // BUG CORREGIDO: sin esto, alguien que selecciona un PDF apenas entra a la pantalla
  // (antes de que ensureIngredientsLoaded resuelva) validaba sus líneas contra un
  // catálogo todavía vacío — la misma falla que el fix de abajo soluciona, solo que
  // acotada a esa ventana de carga en vez de permanente.
  const [ingredientsLoaded, setIngredientsLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // BUG CORREGIDO: leía el catálogo de ingredientes con getDashboardData(), un helper
  // @deprecated de puro localStorage que nada en la app escribe desde la migración a
  // Supabase (ver lib/storage/ingredients.ts) — siempre devolvía [], así que ninguna
  // línea de una orden en PDF podía validarse nunca contra el catálogo real. Ahora usa
  // la misma carga real (ensureIngredientsLoaded) que el resto de la app.
  useEffect(() => {
    let cancelled = false
    setIngredientsLoaded(false)
    ensureIngredientsLoaded(businessId).then(() => {
      if (!cancelled) {
        setIngredientsRefreshKey((k) => k + 1)
        setIngredientsLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const ingredients = useMemo(() => {
    return getIngredients(businessId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, ingredientsRefreshKey])

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return

      // BUG CORREGIDO: sin este guard, seleccionar un PDF antes de que el catálogo de
      // ingredientes terminara de cargar validaba cada línea contra un arreglo vacío.
      if (!ingredientsLoaded) {
        toast({
          title: t("procesar_toast_generic_error_title"),
          description: t("procesar_ingredients_loading"),
          variant: "destructive",
        })
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }

      setIsProcessing(true)
      setProcessedOrders([])

      try {
        const results: ProcessedOrder[] = []

        // Process files in parallel using Promise.all
        await Promise.all(
          Array.from(files).map(async (file) => {
            try {
              const result = await processPdfOrder(file, ingredients)
              results.push(result)
            } catch (error) {
              console.error(`Error processing file ${file.name}:`, error)
              toast({
                title: t("procesar_toast_file_error_title"),
                description: t("procesar_toast_file_error_desc")
                  .replace("{file}", file.name)
                  .replace("{error}", error instanceof Error ? error.message : t("procesar_unknown_error")),
                variant: "destructive",
              })
            }
          }),
        )

        setProcessedOrders(results)
        setActiveTab("results")

        toast({
          title: t("procesar_toast_done_title"),
          description: t("procesar_toast_done_desc").replace("{count}", String(results.length)),
        })
      } catch (error) {
        console.error("Error processing files:", error)
        toast({
          title: t("procesar_toast_generic_error_title"),
          description: t("procesar_toast_process_error_desc"),
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [ingredients, ingredientsLoaded, toast, t],
  )

  // BUG CORREGIDO: guardaba con un setDashboardData() local que escribía directo a
  // localStorage (business_${id}_purchaseOrders), una clave que ningún otro archivo de
  // la app lee desde la migración a Supabase (la fuente real es
  // lib/storage/purchase-orders.ts). El usuario veía "Órdenes guardadas" y la lista se
  // vaciaba, pero la orden no aparecía en Órdenes de Compra ni en Menú y Compras — se
  // perdía en silencio. Ahora usa el mismo store real que el resto de la app, y espera
  // la escritura real antes de limpiar la pantalla.
  const handleSaveOrders = useCallback(async () => {
    if (processedOrders.length === 0) return
    const effectiveBusinessId = businessId || "main"
    setIsSaving(true)

    try {
      await ensurePurchaseOrdersLoaded(effectiveBusinessId)
      const existingOrders = getPurchaseOrders(effectiveBusinessId)

      const newOrders: PurchaseOrder[] = processedOrders.map((order) => ({
        id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: order.orderName || `Orden #${order.orderNumber}`,
        number: order.orderNumber,
        date: order.date || new Date().toISOString(),
        recipes: [],
        items: order.items.map((item) => ({
          name: item.name,
          totalQuantity: item.quantity,
          unit: item.unit,
          costPerUnit: item.unitPrice || 0,
          purchaseCost: item.totalPrice || 0,
          quantityToBuy: item.quantity,
          supplier: item.supplier || "N/A",
        })),
        total: order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
        status: "pending",
      }))

      await savePurchaseOrders(effectiveBusinessId, [...existingOrders, ...newOrders])

      toast({
        title: t("procesar_toast_saved_title"),
        description: t("procesar_toast_saved_desc").replace("{count}", String(newOrders.length)),
      })

      // Reset state
      setProcessedOrders([])
      setActiveTab("upload")
    } catch (error) {
      console.error("Error saving orders:", error)
      toast({
        title: t("procesar_toast_generic_error_title"),
        description: t("procesar_toast_save_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [processedOrders, businessId, toast, t])

  // Memoize the results content to prevent re-renders when nothing changes
  const resultsContent = useMemo(() => {
    if (processedOrders.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{t("procesar_no_results")}</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">{t("procesar_results_title")}</h3>
          <Button onClick={handleSaveOrders} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("procesar_saving")}
              </>
            ) : (
              t("procesar_save_orders")
            )}
          </Button>
        </div>

        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="space-y-6">
            {processedOrders.map((order, orderIndex) => (
              <OrderCard key={orderIndex} order={order} orderIndex={orderIndex} t={t} />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }, [processedOrders, handleSaveOrders, isSaving, t])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("procesar_card_title")}</CardTitle>
        <CardDescription>{t("procesar_card_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">{t("procesar_tab_upload")}</TabsTrigger>
            <TabsTrigger value="results" disabled={processedOrders.length === 0}>
              {t("procesar_tab_results")} {processedOrders.length > 0 && `(${processedOrders.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center" data-tour="procesar-upload">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">{t("procesar_upload_heading")}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t("procesar_upload_desc")}</p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <Label htmlFor="pdf-upload" asChild>
                  <Button disabled={isProcessing || !ingredientsLoaded}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("procesar_processing")}
                      </>
                    ) : !ingredientsLoaded ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("procesar_ingredients_loading")}
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        {t("procesar_select_pdfs")}
                      </>
                    )}
                  </Button>
                </Label>
              </div>

              <Alert data-tour="procesar-info">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("procesar_info_title")}</AlertTitle>
                <AlertDescription>{t("procesar_info_desc")}</AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="results" className="py-4">
            {resultsContent}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
