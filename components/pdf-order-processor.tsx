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

interface PdfOrderProcessorProps {
  businessId?: string
}

// Create a memoized validation status component
const ValidationStatus = memo(({ validation }: { validation: ValidationResult }) => {
  if (validation.isValid) {
    return (
      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900">
        <CheckCircle className="h-3 w-3 mr-1" /> Validado
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
const OrderItem = memo(({ item, index }: { item: any; index: number }) => (
  <div key={index} className="border-t pt-2 flex justify-between items-center">
    <div className="flex-1">
      <p className="font-medium">{item.name}</p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {item.quantity} {item.unit}
        </span>
        <span>•</span>
        <span>{formatCurrency(item.unitPrice || 0)}/unidad</span>
        <span>•</span>
        <span>Total: {formatCurrency(item.totalPrice || 0)}</span>
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Proveedor: </span>
        <span>{item.supplier || "No especificado"}</span>
      </div>
    </div>
    <div>
      <ValidationStatus validation={item.validation} />
    </div>
  </div>
))

// Create a memoized order component
const OrderCard = memo(({ order, orderIndex }: { order: ProcessedOrder; orderIndex: number }) => (
  <div key={orderIndex} className="border rounded-lg p-4">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h4 className="text-base font-semibold">{order.orderName || `Orden #${order.orderNumber}`}</h4>
        <p className="text-sm text-muted-foreground">
          Número: {order.orderNumber} • Fecha: {new Date(order.date || Date.now()).toLocaleDateString()}
        </p>
      </div>
      <Badge variant="outline">{order.items.length} items</Badge>
    </div>

    <div className="space-y-2">
      {order.items.map((item, itemIndex) => (
        <OrderItem key={itemIndex} item={item} index={itemIndex} />
      ))}
    </div>

    <div className="mt-4 pt-2 border-t flex justify-between items-center">
      <span className="font-medium">Total:</span>
      <span className="font-bold">
        L{order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toFixed(2)}
      </span>
    </div>
  </div>
))

export function PdfOrderProcessor({ businessId }: PdfOrderProcessorProps) {
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
                title: "Error al procesar archivo",
                description: `No se pudo procesar ${file.name}: ${error instanceof Error ? error.message : "Error desconocido"}`,
                variant: "destructive",
              })
            }
          }),
        )

        setProcessedOrders(results)
        setActiveTab("results")

        toast({
          title: "Procesamiento completado",
          description: `Se procesaron ${results.length} órdenes de compra.`,
        })
      } catch (error) {
        console.error("Error processing files:", error)
        toast({
          title: "Error",
          description: "Ocurrió un error al procesar los archivos PDF.",
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
    [ingredients, toast],
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
        title: "Órdenes guardadas",
        description: `Se guardaron ${newOrders.length} órdenes de compra.`,
      })

      // Reset state
      setProcessedOrders([])
      setActiveTab("upload")
    } catch (error) {
      console.error("Error saving orders:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al guardar las órdenes de compra.",
        variant: "destructive",
      })
    }
  }, [processedOrders, businessId, toast])

  // Memoize the results content to prevent re-renders when nothing changes
  const resultsContent = useMemo(() => {
    if (processedOrders.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No hay resultados para mostrar</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Órdenes Procesadas</h3>
          <Button onClick={handleSaveOrders}>Guardar Órdenes</Button>
        </div>

        <ScrollArea className="h-[400px] rounded-md border p-4">
          <div className="space-y-6">
            {processedOrders.map((order, orderIndex) => (
              <OrderCard key={orderIndex} order={order} orderIndex={orderIndex} />
            ))}
          </div>
        </ScrollArea>
      </div>
    )
  }, [processedOrders, handleSaveOrders])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Procesador de Órdenes de Compra PDF</CardTitle>
        <CardDescription>Sube archivos PDF de órdenes de compra para procesarlos automáticamente</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Subir PDFs</TabsTrigger>
            <TabsTrigger value="results" disabled={processedOrders.length === 0}>
              Resultados {processedOrders.length > 0 && `(${processedOrders.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="py-4">
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Arrastra o selecciona archivos PDF</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sube PDFs de órdenes de compra para extraer automáticamente la información
                </p>
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
                        Procesando...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Seleccionar PDFs
                      </>
                    )}
                  </Button>
                </Label>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Información</AlertTitle>
                <AlertDescription>
                  El sistema extraerá información de proveedores y la validará contra tu base de datos de ingredientes.
                  Asegúrate de que tus ingredientes tengan información de proveedores actualizada.
                </AlertDescription>
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
