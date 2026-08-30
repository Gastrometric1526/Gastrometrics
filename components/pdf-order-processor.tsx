"use client"

import type React from "react"

import { useState, useRef, useCallback, useMemo, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, CheckCircle, AlertCircle, Upload } from "lucide-react"
import { getDashboardData } from "@/lib/dashboard-data"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { processPdfOrder } from "@/utils/pdf-order-processor"
import type { ProcessedOrder, ValidationResult } from "@/types/purchase-order"
import type { Ingredient } from "@/types/ingredient"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"

interface PdfOrderProcessorProps {
  businessId?: string
}

// Create a memoized validation status component
const ValidationStatus = memo(({ validation, validatedLabel }: { validation: ValidationResult; validatedLabel: string }) => {
  if (validation.isValid) {
    return (
      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900">
        <CheckCircle className="h-3 w-3 mr-1" /> {validatedLabel}
      </Badge>
    )
  } else {
    return (
      <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900">
        <AlertCircle className="h-3 w-3 mr-1" /> {validation.message}
      </Badge>
    )
  }
})

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
const OrderCard = memo(({ order, orderIndex, t }: { order: ProcessedOrder; orderIndex: number; t: (key: any) => string }) => (
  <div key={orderIndex} className="border rounded-lg p-4">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h4 className="text-base font-semibold">
          {order.orderName || t("procesar_order_fallback_name").replace("{number}", String(order.orderNumber))}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t("procesar_order_number_label")} {order.orderNumber} • {t("procesar_order_date_label")}{" "}
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
))

export function PdfOrderProcessor({ businessId }: PdfOrderProcessorProps) {
  const { t } = useLanguage()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedOrders, setProcessedOrders] = useState<ProcessedOrder[]>([])
  const [activeTab, setActiveTab] = useState("upload")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Memoize the ingredients to avoid repeated fetches
  const ingredients = useMemo(() => {
    return getDashboardData<Ingredient[]>("ingredients", businessId) || []
  }, [businessId])

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return

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
    [ingredients, toast, t],
  )

  const handleSaveOrders = useCallback(() => {
    if (processedOrders.length === 0) return

    try {
      // Get existing purchase orders
      const existingOrders = getDashboardData<any[]>("purchaseOrders", businessId) || []

      // Convert processed orders in a memory-efficient way
      const newOrders = processedOrders.map((order) => ({
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
      }))

      // Save the combined orders
      const updatedOrders = [...existingOrders, ...newOrders]

      // Helper function to store data
      function setDashboardData(key: string, data: any, businessId?: string): void {
        const storageKey = businessId ? `business_${businessId}_${key}` : `main_${key}`
        localStorage.setItem(storageKey, JSON.stringify(data))
      }

      setDashboardData("purchaseOrders", updatedOrders, businessId)

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
          <Button onClick={handleSaveOrders}>{t("procesar_save_orders")}</Button>
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
  }, [processedOrders, handleSaveOrders, t])

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
                  <Button disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("procesar_processing")}
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
