"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Trash2, Check, X } from "lucide-react"
import type { InventoryItem } from "@/types/inventory"
import { useDebouncedCallback } from "@/lib/hooks/useDebounce"
import { getIngredients } from "@/lib/storage/ingredients"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"

// Modificar la interfaz InventoryTableProps para incluir una nueva prop para manejar cambios en el stock mínimo
interface InventoryTableProps {
  items: InventoryItem[]
  businessId?: string | null
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
  onSave: (items: InventoryItem[]) => void
  onPresentationChange?: (itemId: string, presentation: string) => void
  onMinStockChange?: (itemId: string, minStock: number) => void
  availablePresentations: string[]
}

// Actualizar la desestructuración de props para incluir onMinStockChange
export function InventoryTable({
  items,
  businessId,
  onEdit,
  onDelete,
  onSave,
  onPresentationChange,
  onMinStockChange,
  availablePresentations = [],
}: InventoryTableProps) {
  const { t } = useLanguage()
  const [editedItemId, setEditedItemId] = useState<string | null>(null)
  const [editedItems, setEditedItems] = useState([...items])
  const [ingredientsData, setIngredientsData] = useState<any[]>([])

  // BUG CORREGIDO: llamaba a getIngredients() sin businessId, así que siempre caía al
  // workspace "main" sin importar qué negocio se estuviera viendo — en un negocio
  // distinto a "main", esta tabla mostraba precios/nombres de los ingredientes
  // equivocados (los del negocio "main", no los del negocio real). app/inventario/page.tsx
  // ya calculaba el businessId real desde la URL, solo no se lo pasaba a este componente.
  useEffect(() => {
    const allIngredients = getIngredients(businessId)
    setIngredientsData(allIngredients)
  }, [businessId])

  // Re-sincronizar con la prop `items` cuando cambia desde afuera (búsqueda, alta, baja).
  // Sin esto, editedItems se congelaba en el primer render y los botones de
  // editar/eliminar de una fila operaban sobre datos obsoletos y desalineados
  // con lo que el usuario veía en pantalla tras filtrar o modificar la lista.
  // Se omite mientras hay una fila en edición para no perder cambios sin guardar.
  useEffect(() => {
    if (editedItemId === null) {
      setEditedItems([...items])
    }
  }, [items, editedItemId])

  const debouncedSave = useDebouncedCallback((updatedItems: InventoryItem[]) => {
    onSave(updatedItems)
  }, 500)

  const startEditing = (id: string) => {
    setEditedItemId(id)
  }

  const cancelEditing = () => {
    setEditedItemId(null)
    setEditedItems([...items])
  }

  const handleInputChange = (id: string, field: string, value: string | number) => {
    const updatedItems = editedItems.map((item) => {
      if (item.id === id) {
        // Preservar todos los campos existentes y solo actualizar el campo específico
        return { ...item, [field]: value }
      }
      return item
    })
    setEditedItems(updatedItems)
    debouncedSave(updatedItems)
  }

  const handleSaveRow = (id: string) => {
    setEditedItemId(null)
    onSave(editedItems)
  }

  const handlePresentationSelect = (itemId: string, presentation: string) => {
    // Actualizar inmediatamente el estado local para mostrar el valor seleccionado
    // preservando todos los demás datos
    const updatedItems = editedItems.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          presentation,
          // Importante: preservar estos valores
          currentStock: item.currentStock,
          supplier: item.supplier,
          minStock: item.minStock,
        }
      }
      return item
    })
    setEditedItems(updatedItems)

    // Llamar a la función de cambio de presentación para actualizar la base de datos
    if (onPresentationChange) {
      onPresentationChange(itemId, presentation)
    }
  }

  // Añadir un nuevo manejador para cambios en el stock mínimo después de handlePresentationSelect
  const handleMinStockChange = (itemId: string, minStock: number) => {
    // Actualizar el estado local
    const updatedItems = editedItems.map((item) => {
      if (item.id === itemId) {
        return { ...item, minStock }
      }
      return item
    })
    setEditedItems(updatedItems)

    // Notificar al componente padre sobre el cambio
    if (onMinStockChange) {
      onMinStockChange(itemId, minStock)
    }
  }

  // BUG CORREGIDO (ver docs/33): existía un `handleUnitChange` que nunca se llamaba
  // desde ningún lado (código muerto) y que además referenciaba `item.netContent`,
  // un campo que no existe en `InventoryItem` (types/inventory.ts) — no era una
  // función a medio cablear, era una función rota. La celda de unidad en la tabla
  // (más abajo) tenía un ternario que "aparentaba" ser editable en modo edición pero
  // renderizaba lo mismo en ambas ramas: la unidad nunca fue realmente editable pese
  // a que la fila sí entra en modo edición para el resto de las columnas. Cambiar la
  // unidad de un ingrediente ya registrado implicaría reescalar currentStock, minStock
  // y precio por unidad a la vez — no solo el campo unit — así que se deja fuera de
  // alcance por ahora en vez de improvisar una conversión a medias; la celda ahora es
  // honesta: siempre de solo lectura, sin fingir ser un campo editable.

  // Función para obtener el precio de compra correcto para un item
  const getPurchasePrice = (item: InventoryItem) => {
    // Primero intentamos obtener el precio directamente del item
    if (typeof item.price === "number" && item.price > 0) {
      return item.price
    }

    // Si no está disponible, buscamos en los ingredientes por nombre
    const matchingIngredient = ingredientsData.find((ing) => ing.name === item.name)
    if (matchingIngredient) {
      // Intentar obtener el precio de diferentes estructuras posibles
      if (typeof matchingIngredient.purchasePrice === "number") {
        return matchingIngredient.purchasePrice
      }
      if (matchingIngredient.pricing && typeof matchingIngredient.pricing.purchasePrice === "number") {
        return matchingIngredient.pricing.purchasePrice
      }
    }

    // Si todo lo demás falla, devolvemos 0
    return 0
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[14%] text-center">{t("inventario_table_category")}</TableHead>
            <TableHead className="w-[19%] text-center">{t("inventario_table_name")}</TableHead>
            <TableHead className="w-[10%] text-center">{t("inventario_table_presentation")}</TableHead>
            {/* Stock actual y mínimo combinados en una sola columna (docs/04 del
                paquete de diseño: "en bodega/mínimo combinados en una sola barra con
                la cifra al lado" — antes eran dos columnas numéricas separadas que
                había que comparar mentalmente). */}
            <TableHead className="w-[16%] text-center">{t("inventario_stock_combined_label")}</TableHead>
            <TableHead className="w-[8%] text-center">{t("inventario_table_unit")}</TableHead>
            <TableHead className="w-[10%] text-center">{t("inventario_purchase_price_label")}</TableHead>
            <TableHead className="w-[15%] text-center">{t("inventario_supplier_label")}</TableHead>
            <TableHead className="w-[8%] text-right">{t("inventario_table_actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {editedItems.map((item) => {
            // Obtener el precio de compra para este item
            const purchasePrice = getPurchasePrice(item)

            return (
              <TableRow key={item.id}>
                <TableCell className="text-center">
                  {editedItemId === item.id ? (
                    <Input
                      type="text"
                      value={item.category}
                      onChange={(e) => handleInputChange(item.id, "category", e.target.value)}
                    />
                  ) : (
                    item.category
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editedItemId === item.id ? (
                    <Input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleInputChange(item.id, "name", e.target.value)}
                    />
                  ) : (
                    item.name
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.presentation ? (
                    <span className="text-sm">{item.presentation}</span>
                  ) : (
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handlePresentationSelect(item.id, e.target.value)
                        }
                      }}
                    >
                      <option value="">{t("inventario_select_placeholder")}</option>
                      {availablePresentations.map((presentation) => (
                        <option key={presentation} value={presentation}>
                          {presentation}
                        </option>
                      ))}
                    </select>
                  )}
                </TableCell>
                {/* Stock combinado: barra de en-bodega-contra-mínimo + la cifra al lado.
                    El stock actual siempre fue de solo lectura acá (se edita registrando
                    inventario); el mínimo sigue editable en línea, igual que antes. */}
                <TableCell className="text-center">
                  {editedItemId === item.id ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-text-4">
                        {item.currentStock !== null ? `${item.currentStock} ${item.unit}` : "-"}
                      </span>
                      <Input
                        type="number"
                        value={item.minStock}
                        onChange={(e) => {
                          const newValue = Number(e.target.value)
                          handleInputChange(item.id, "minStock", newValue)
                        }}
                        className="text-center h-8 w-20"
                        min="0"
                        aria-label={t("inventario_min_stock_label")}
                      />
                    </div>
                  ) : item.currentStock !== null ? (
                    (() => {
                      const barPct = item.minStock > 0 ? Math.min(100, (item.currentStock / (item.minStock * 2)) * 100) : 100
                      const barColor =
                        item.status === "critical" ? "bg-destructive" : item.status === "low" ? "bg-warning" : "bg-success"
                      const textColor =
                        item.status === "critical" ? "text-destructive" : item.status === "low" ? "text-warning" : "text-foreground"
                      return (
                        <div className="flex flex-col items-center gap-1 w-[110px] mx-auto">
                          <span className={`text-sm font-medium tabular-nums ${textColor}`}>
                            {item.currentStock} / {item.minStock} {item.unit}
                          </span>
                          <div className="relative h-1 w-full rounded-full bg-secondary overflow-hidden">
                            <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-center">{item.unit}</TableCell>
                <TableCell className="text-center">
                  {editedItemId === item.id ? (
                    <Input
                      type="number"
                      value={item.price || 0}
                      onChange={(e) => handleInputChange(item.id, "price", Number(e.target.value))}
                    />
                  ) : (
                    <span className="font-medium text-foreground tabular-nums">
                      {formatCurrency(typeof item.price === "number" ? item.price : 0)}
                    </span>
                  )}
                </TableCell>
                {/* Proveedor es de solo lectura en esta edición rápida en línea — se edita
                    desde el diálogo completo ("Editar"). BUG CORREGIDO: antes se dibujaba
                    como un <Input readOnly> con fondo gris y un onChange que nunca podía
                    dispararse — se veía exactamente igual a los demás campos SÍ editables
                    de esta misma fila (Categoría, Nombre, Stock Mínimo, Precio), así que el
                    usuario intentaba escribir y no pasaba nada, sin ninguna pista de por
                    qué. Ahora se muestra como texto simple, igual que en modo lectura, con
                    una pista de cómo sí cambiarlo. */}
                <TableCell className="text-center">
                  {editedItemId === item.id ? (
                    <span className="text-sm text-muted-foreground" title={t("inventario_supplier_edit_hint")}>
                      {item.supplier || "-"}
                    </span>
                  ) : (
                    item.supplier || "-"
                  )}
                </TableCell>
                <TableCell className="text-right p-2 md:p-4">
                  <div className="flex justify-end gap-1 sm:gap-2">
                    {editedItemId === item.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSaveRow(item.id)
                          }}
                          className="h-8 w-8"
                          aria-label={t("common_save")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            cancelEditing()
                          }}
                          className="h-8 w-8"
                          aria-label={t("common_cancel")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditing(item.id)
                          }}
                          className="h-8 w-8"
                          aria-label={t("common_edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(item.id)
                          }}
                          className="h-8 w-8"
                          aria-label={t("common_delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
