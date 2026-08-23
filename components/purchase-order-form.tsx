"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Package } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"

export interface PurchaseOrderFormItem {
  id: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  supplier?: string
  // Presentación de compra (Saco, Caja, Botella...) — la orden debe pedirse así, no en
  // la unidad base de la receta. presentationQuantity es null cuando el ingrediente
  // todavía no tiene presentación configurada en su ficha; en ese caso se puede fijar
  // aquí mismo y se guarda de vuelta en la base de datos de ingredientes al enviar la
  // orden (ver handlePresentationChange más abajo y handleFormSubmit en purchase-order-page.tsx).
  presentation?: string | null
  presentationQuantity?: number | null
}

export interface PurchaseOrderFormData {
  id?: string
  orderNumber: string
  supplier: string
  orderDate: string
  expectedDeliveryDate: string
  status: "pending" | "approved" | "ordered" | "received" | "cancelled"
  items: PurchaseOrderFormItem[]
  subtotal: number
  tax: number
  total: number
  notes?: string
}

interface PurchaseOrderFormProps {
  onSubmit: (data: PurchaseOrderFormData) => void
  onCancel: () => void
  initialData?: PurchaseOrderFormData | null
  availableIngredients?: any[]
  // Se llama de inmediato (no solo al enviar la orden) cuando el usuario fija la
  // presentación de un ingrediente que todavía no la tenía, para que quede guardada en
  // la base de datos de ingredientes aunque la orden no se termine de crear.
  onPresentationChange?: (ingredientId: string, presentation: string) => void
}

const validUnits = ["g", "kg", "ml", "L", "oz", "fl oz", "unidad", "docena"]
const validPresentations = [
  "Lata",
  "Botella",
  "Frasco",
  "Caja",
  "Bolsa",
  "Bote",
  "Paquete",
  "Envase plástico",
  "Saco",
  "Tarrina",
  "Tetra Pak",
  "Ampolla",
  "Sobre",
  "Granel",
]

// BUG CORREGIDO: colores fijos sin variante dark:, a diferencia de los badges de
// estado en history-view.tsx (que usan variant="outline"/"secondary" y sí se adaptan).
const orderStatusDefs = [
  { value: "pending", labelKey: "pof_status_pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300" },
  { value: "approved", labelKey: "pof_status_approved", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
  { value: "ordered", labelKey: "pof_status_ordered", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
  { value: "received", labelKey: "pof_status_received", color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  { value: "cancelled", labelKey: "pof_status_cancelled", color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
] as const

export function PurchaseOrderForm({
  onSubmit,
  onCancel,
  initialData,
  availableIngredients = [],
  onPresentationChange,
}: PurchaseOrderFormProps) {
  const { t } = useLanguage()
  const orderStatuses = orderStatusDefs.map((s) => ({ ...s, label: t(s.labelKey) }))

  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    orderNumber: `PO-${Date.now()}`,
    supplier: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    status: "pending",
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    notes: "",
  })

  const [newItem, setNewItem] = useState<Partial<PurchaseOrderFormItem>>({
    ingredientId: "",
    ingredientName: "",
    quantity: 1,
    unit: "kg",
    unitPrice: 0,
    totalPrice: 0,
  })

  // BUG CORREGIDO: aqui se sumaba un 15% de impuesto fijo, incondicional y sin
  // ningun control en la UI para cambiarlo o quitarlo — contradice la regla del
  // proyecto (CLAUDE.md): "ISV/impuesto: 0 por defecto, opcional, sin logica de
  // pais especifica". Ademas pisaba en silencio el tax:0 que ya armaban
  // correctamente handleAutoSuggestOrder y la generacion desde menu en
  // purchase-order-page.tsx. Ahora es 0 por defecto y editable (mismo patron que
  // el campo ISV opcional de Ficha Tecnica).
  const [taxPercent, setTaxPercent] = useState<number>(0)

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setTaxPercent(initialData.subtotal > 0 ? (initialData.tax / initialData.subtotal) * 100 : 0)
    }
  }, [initialData])

  // Calcular totales cuando cambien los items o el % de impuesto
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.totalPrice, 0)
    const tax = subtotal * (taxPercent / 100)
    const total = subtotal + tax

    setFormData((prev) => ({
      ...prev,
      subtotal,
      tax,
      total,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.items, taxPercent])

  const handleInputChange = (field: keyof PurchaseOrderFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNewItemChange = (field: keyof PurchaseOrderFormItem, value: any) => {
    setNewItem((prev) => {
      const updated = { ...prev, [field]: value }

      // Calcular precio total cuando cambien cantidad o precio unitario
      if (field === "quantity" || field === "unitPrice") {
        const quantity = field === "quantity" ? value : prev.quantity || 0
        const unitPrice = field === "unitPrice" ? value : prev.unitPrice || 0
        updated.totalPrice = quantity * unitPrice
      }

      return updated
    })
  }

  const handleIngredientSelect = (ingredientId: string) => {
    const ingredient = availableIngredients.find((ing) => ing.id === ingredientId)
    if (ingredient) {
      setNewItem((prev) => ({
        ...prev,
        ingredientId,
        ingredientName: ingredient.name,
        unit: ingredient.unit || "kg",
        unitPrice: ingredient.pricing?.pricePerUnit || 0,
        supplier: ingredient.supplier,
        totalPrice: (prev.quantity || 1) * (ingredient.pricing?.pricePerUnit || 0),
      }))
    }
  }

  const addItem = () => {
    if (!newItem.ingredientId || !newItem.ingredientName || !newItem.quantity || !newItem.unitPrice) {
      return
    }

    const item: PurchaseOrderFormItem = {
      id: Date.now().toString(),
      ingredientId: newItem.ingredientId!,
      ingredientName: newItem.ingredientName!,
      quantity: newItem.quantity!,
      unit: newItem.unit || "kg",
      unitPrice: newItem.unitPrice!,
      totalPrice: newItem.totalPrice || 0,
      supplier: newItem.supplier,
    }

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }))

    // Reset new item form
    setNewItem({
      ingredientId: "",
      ingredientName: "",
      quantity: 1,
      unit: "kg",
      unitPrice: 0,
      totalPrice: 0,
    })
  }

  // Fija la presentación de un ítem que todavía no la tenía (o la cambia). Recalcula
  // presentationQuantity con el contenido neto de la ficha del ingrediente, igual que
  // lib/utils/presentation-quantity.ts, y avisa al padre para que quede guardada en la
  // base de datos de ingredientes, no solo en esta orden.
  const handleItemPresentationChange = (itemId: string, presentation: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item
        const ingredient = availableIngredients.find((ing) => ing.id === item.ingredientId)
        const netContent = ingredient?.pricing?.netContent
        const presentationQuantity =
          netContent && netContent > 0 ? Math.ceil(item.quantity / netContent) : item.presentationQuantity ?? null
        return { ...item, presentation, presentationQuantity }
      }),
    }))
    const item = formData.items.find((i) => i.id === itemId)
    if (item?.ingredientId) {
      onPresentationChange?.(item.ingredientId, presentation)
    }
  }

  const removeItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = orderStatuses.find((s) => s.value === status)
    return statusConfig ? <Badge className={statusConfig.color}>{statusConfig.label}</Badge> : null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {initialData?.id ? t("pof_title_edit") : t("pof_title_new")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">{t("pof_order_number_label")}</Label>
              <Input
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => handleInputChange("orderNumber", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">{t("pof_supplier_label")}</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => handleInputChange("supplier", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("pof_status_label")}</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderDate">{t("pof_order_date_label")}</Label>
              <Input
                id="orderDate"
                type="date"
                value={formData.orderDate}
                onChange={(e) => handleInputChange("orderDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate">{t("pof_expected_delivery_label")}</Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => handleInputChange("expectedDeliveryDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Item */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pof_add_ingredient_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("pof_ingredient_label")}</Label>
              <Select value={newItem.ingredientId || ""} onValueChange={handleIngredientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pof_ingredient_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableIngredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} - {ingredient.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("pof_quantity_label")}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.quantity || ""}
                onChange={(e) => handleNewItemChange("quantity", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pof_unit_label")}</Label>
              <Select value={newItem.unit || ""} onValueChange={(value) => handleNewItemChange("unit", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("pof_unit_price_label")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newItem.unitPrice || ""}
                onChange={(e) => handleNewItemChange("unitPrice", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <Button
              type="button"
              onClick={addItem}
              disabled={!newItem.ingredientId || !newItem.quantity || !newItem.unitPrice}
              className="h-10"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("pof_add_button")}
            </Button>
          </div>

          {newItem.totalPrice > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                {t("pof_item_total_prefix")} <span className="font-semibold">{formatCurrency(newItem.totalPrice)}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pof_items_title")} ({formData.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {formData.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("pof_no_items")}</p>
              <p className="text-sm">{t("pof_no_items_hint")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {formData.items.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground shrink-0">#{index + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.ingredientName}</p>
                        {item.presentation && item.presentationQuantity ? (
                          <p className="text-sm text-muted-foreground">
                            {item.presentationQuantity} {item.presentation}
                            {item.presentationQuantity !== 1 ? "s" : ""} ({item.quantity} {item.unit}) ×{" "}
                            {formatCurrency(item.unitPrice)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                          </p>
                        )}
                        {item.supplier && (
                          <p className="text-xs text-muted-foreground">
                            {t("pof_supplier_prefix")} {item.supplier}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!item.presentation && (
                      <div className="w-36">
                        <Select
                          value=""
                          onValueChange={(value) => handleItemPresentationChange(item.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={t("pof_presentation_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {validPresentations.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="font-semibold whitespace-nowrap">{formatCurrency(item.totalPrice)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      {formData.items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t("pof_subtotal_label")}</span>
                <span>{formatCurrency(formData.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span>{t("pof_tax_label")}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number.parseFloat(e.target.value) || 0)}
                    className="h-7 w-16 text-right"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <span>{formatCurrency(formData.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2">
                <span>{t("pof_total_label")}</span>
                <span>{formatCurrency(formData.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pof_notes_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="order-notes" className="sr-only">
            {t("pof_notes_title")}
          </Label>
          <Textarea
            id="order-notes"
            value={formData.notes || ""}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder={t("pof_notes_placeholder")}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("pof_cancel_button")}
        </Button>
        <Button type="submit" disabled={formData.items.length === 0} className="min-w-[120px]">
          {initialData?.id ? t("pof_update_button") : t("pof_create_button")}
        </Button>
      </div>
    </form>
  )
}
