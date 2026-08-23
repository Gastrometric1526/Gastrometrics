"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { InventoryItem } from "@/types/inventory"
import { useLanguage } from "@/contexts/language-context"

interface InventoryFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
  initialData?: InventoryItem | null
}

const conversionFactors: { [key: string]: number } = {
  kg: 1000,
  g: 1,
  L: 1000,
  ml: 1,
  oz: 28.35,
  "fl oz": 29.57,
  lb: 453.59,
  gal: 3785.41,
}

export function InventoryForm({ onSubmit, onCancel, initialData }: InventoryFormProps) {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    currentStock: "",
    minStock: 0,
    unit: "kg", // Set default unit to kg
    price: 0,
    location: "",
    supplier: "",
    netContent: 0,
    presentation: "",
  })
  const [previousUnit, setPreviousUnit] = useState("kg") // Track previous unit
  const [presentations, setPresentations] = useState<string[]>([])

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        category: initialData.category || "",
        currentStock: initialData.currentStock !== null ? String(initialData.currentStock) : "",
        minStock: initialData.minStock || 0,
        unit: initialData.unit || "kg", // Set default unit to kg
        price: initialData.price || 0,
        location: initialData.location || "",
        supplier: initialData.supplier || "",
        netContent: initialData.netContent || 0,
        presentation: initialData.presentation || "",
      })
      setPreviousUnit(initialData.unit || "kg") // Initialize previous unit
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "minStock" || name === "netContent" || name === "price"
          ? Number.parseFloat(value) || 0
          : name === "currentStock"
            ? value // Mantener currentStock como string para permitir campo vacío
            : value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    if (name === "unit") {
      const newUnit = value
      const currentValue = formData.netContent || 0

      // Perform conversion
      let newValue = currentValue
      if (conversionFactors[previousUnit] && conversionFactors[newUnit]) {
        newValue = currentValue * (conversionFactors[previousUnit] / conversionFactors[newUnit])
      } else if (previousUnit === "g" && newUnit === "ml") {
        newValue = currentValue
      } else if (previousUnit === "ml" && newUnit === "g") {
        newValue = currentValue
      }

      setFormData((prev) => ({
        ...prev,
        netContent: newValue,
        unit: newUnit,
      }))
      setPreviousUnit(newUnit) // Update previous unit
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Convertir currentStock de string a número para el envío
    const submissionData = {
      ...formData,
      currentStock: formData.currentStock === "" ? null : Number(formData.currentStock),
    }
    onSubmit(submissionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t("inventario_table_name")}</Label>
          <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">{t("inventario_table_category")}</Label>
          <Input id="category" name="category" value={formData.category} onChange={handleChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentStock">{t("inventario_current_stock_label")}</Label>
          <Input
            id="currentStock"
            name="currentStock"
            type="number"
            min="0"
            step="0.01"
            value={formData.currentStock}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStock">{t("inventario_min_stock_label")}</Label>
          <Input
            id="minStock"
            name="minStock"
            type="number"
            min="0"
            step="0.01"
            value={formData.minStock || ""}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">{t("inventario_table_unit")}</Label>
          <Select value={formData.unit} onValueChange={(value) => handleSelectChange("unit", value)}>
            <SelectTrigger id="unit">
              <SelectValue placeholder={t("inventario_select_unit_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Kilogramo (kg)</SelectItem>
              <SelectItem value="g">Gramo (g)</SelectItem>
              <SelectItem value="L">Litro (L)</SelectItem>
              <SelectItem value="ml">Mililitro (ml)</SelectItem>
              <SelectItem value="oz">Onza (oz)</SelectItem>
              <SelectItem value="fl oz">Onza líquida (fl oz)</SelectItem>
              <SelectItem value="lb">Libra (lb)</SelectItem>
              <SelectItem value="gal">Galón (gal)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="netContent">{t("inventario_net_content_label")}</Label>
          <Input
            id="netContent"
            name="netContent"
            type="number"
            min="0"
            step="0.01"
            value={formData.netContent || ""}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="presentation">{t("inventario_table_presentation")}</Label>
          <Select
            value={formData.presentation || ""}
            onValueChange={(value) => setFormData({ ...formData, presentation: value })}
            disabled={true} // Siempre deshabilitado, solo editable desde el módulo de base de datos
          >
            <SelectTrigger>
              <SelectValue placeholder={t("inventario_select_presentation_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t("inventario_select_presentation_placeholder")}</SelectItem>
              {presentations.map((presentation) => (
                <SelectItem key={presentation} value={presentation}>
                  {presentation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("inventario_presentation_edit_hint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">{t("inventario_purchase_price_label")}</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price || ""}
            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">{t("inventario_location_label")}</Label>
          <Input id="location" name="location" value={formData.location} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">{t("inventario_supplier_label")}</Label>
          <Input id="supplier" name="supplier" value={formData.supplier} onChange={handleChange} />
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common_cancel")}
        </Button>
        <Button type="submit">{t("common_save")}</Button>
      </div>
    </form>
  )
}
