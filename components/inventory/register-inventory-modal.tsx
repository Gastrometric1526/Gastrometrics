"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Ingredient } from "@/types/ingredient"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, ChevronRight, ChevronLeft, Info, Search, AlertCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ActivityTracker } from "@/lib/activity-tracker"
import { v4 as uuidv4 } from "uuid"
import { Badge } from "@/components/ui/badge"

// Add the missing import for setDashboardData
import { setDashboardData } from "@/utils/dashboard"
import { saveInventory, getInventory, addInventorySnapshot, getInventoryHistory } from "@/lib/storage/inventory"
import { getIngredients, saveIngredients } from "@/lib/storage/ingredients"
import { presentations } from "@/types/ingredient"
import { updateIngredientPriceAndRecalculate } from "@/lib/recalculate"
import { computeWeightedAverageCost } from "@/lib/utils/weighted-average-cost"
import { useLanguage } from "@/contexts/language-context"

interface RegisterInventoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredients: Ingredient[]
  businessId?: string | null
}

interface IngredientWithQuantity extends Ingredient {
  quantity: number
  calculatedQuantity?: number
  supplier?: string
}

const classifications = ["Bebidas", "Comida", "Limpieza"]

export function RegisterInventoryModal({ open, onOpenChange, ingredients, businessId }: RegisterInventoryModalProps) {
  const { t } = useLanguage()
  const classificationLabels: Record<string, string> = {
    "Inventario Global": t("inventario_register_division_global"),
    Bebidas: t("inventario_division_beverages"),
    Comida: t("inventario_division_food"),
    Limpieza: t("inventario_division_cleaning"),
  }
  const [step, setStep] = useState(1)
  const [inventoryType, setInventoryType] = useState<"inicial" | "final" | "nueva compra">("inicial")
  const [period, setPeriod] = useState<"diario" | "semanal" | "mensual">("diario")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [division, setDivision] = useState("Inventario Global")
  const [notes, setNotes] = useState("")
  const [windowHeight, setWindowHeight] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)
  const { toast } = useToast()
  const [ingredientsWithQuantity, setIngredientsWithQuantity] = useState<IngredientWithQuantity[]>([])
  const [availablePresentations, setAvailablePresentations] = useState<string[]>(presentations || [])

  // Primero, agregar el estado para el modo de inventario
  // Añadir después de la declaración de otros estados, cerca de la línea 70

  const [inventoryMode, setInventoryMode] = useState<"metric" | "presentation">("metric")

  // Declare missing variables
  const [orderName, setOrderName] = useState("Inventario")
  const [orderNumber, setOrderNumber] = useState(1)
  const [selectedRecipes, setSelectedRecipes] = useState([])
  const [purchaseOrderData, setPurchaseOrderData] = useState([])

  // Necesitamos modificar la inicialización de ingredientsWithQuantity para incluir la información de presentación y contenido neto
  // Buscar el useEffect que inicializa ingredientsWithQuantity (alrededor de la línea 80) y reemplazar:

  // Initialize ingredients with quantity
  useEffect(() => {
    if (ingredients.length > 0) {
      const allIngredients = getIngredients(businessId)

      const currentInventory = getInventory(businessId)

      // Guardar el estado actual de ingredientsWithQuantity para preservar valores importantes
      const currentIngredients = [...ingredientsWithQuantity]

      const newIngredientsWithQuantity = ingredients.map((ing) => {
        // Buscar el ingrediente en el estado actual para preservar valores importantes
        const currentIngredient = currentIngredients.find((curr) => curr.id === ing.id)

        // Buscar el ingrediente en la base de datos para obtener la información más actualizada
        const matchingIngredient = allIngredients.find((dbIng: any) => dbIng.id === ing.id)

        // Buscar el ingrediente en el inventario actual para obtener el stock existente
        const inventoryItem = currentInventory.find((item: any) => item.id === ing.id || item.name === ing.name)

        // Determinar el contenido neto correcto SIEMPRE desde la base de datos
        let netContent = 0
        if (matchingIngredient && matchingIngredient.pricing && matchingIngredient.pricing.netContent) {
          netContent = matchingIngredient.pricing.netContent
        } else if (ing.pricing && ing.pricing.netContent) {
          netContent = ing.pricing.netContent
        }

        // Determinar el precio correcto SIEMPRE desde la base de datos
        let purchasePrice = 0
        if (matchingIngredient && matchingIngredient.pricing && matchingIngredient.pricing.purchasePrice) {
          purchasePrice = matchingIngredient.pricing.purchasePrice
        } else if (matchingIngredient && typeof matchingIngredient.purchasePrice === "number") {
          purchasePrice = matchingIngredient.purchasePrice
        } else if (ing.pricing && ing.pricing.purchasePrice) {
          purchasePrice = ing.pricing.purchasePrice
        }

        // Determinar la presentación correcta
        // Prioridad: 1) Valor actual, 2) BD ingrediente, 3) Ingrediente original
        const presentation =
          currentIngredient?.presentation || matchingIngredient?.presentation || ing.presentation || null

        // Determinar el stock actual
        // Prioridad: 1) Valor actual, 2) Inventario, 3) Valor por defecto
        const currentStock = currentIngredient ? currentIngredient.quantity : inventoryItem?.currentStock || 0

        // Obtener el proveedor
        // Prioridad: 1) Valor actual, 2) BD ingrediente, 3) Inventario, 4) Ingrediente original
        const supplier =
          currentIngredient?.supplier ||
          matchingIngredient?.supplier ||
          inventoryItem?.supplier ||
          ing.supplier ||
          "No especificado"

        return {
          ...ing,
          quantity: currentStock, // Inicializar con el stock actual preservado
          calculatedQuantity: currentStock, // Nuevo campo para almacenar la cantidad calculada
          presentation: presentation,
          price: purchasePrice,
          supplier: supplier, // Añadir el proveedor
          pricing: {
            ...(ing.pricing || {}),
            netContent: netContent,
            purchasePrice: purchasePrice,
          },
        }
      })

      setIngredientsWithQuantity(newIngredientsWithQuantity)

      // También actualizar las presentaciones disponibles desde la base de datos
      const dbPresentations = [
        ...new Set(allIngredients.filter((ing) => ing.presentation).map((ing) => ing.presentation)),
      ]

      if (dbPresentations.length > 0) {
        // Combinar con las presentations predefinidas, eliminando duplicados
        setAvailablePresentations([...new Set([...presentations, ...dbPresentations])])
      }
    }
  }, [ingredients]) // Quitar ingredientsWithQuantity de las dependencias para evitar bucles

  // Update window height on resize and initial load
  useEffect(() => {
    const updateDimensions = () => {
      setWindowHeight(window.innerHeight)
      if (contentRef.current) {
        setContentHeight(contentRef.current.clientHeight)
      }
    }

    // Set initial dimensions
    updateDimensions()

    // Add event listener
    window.addEventListener("resize", updateDimensions)

    // Clean up
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Update content height when step changes
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.clientHeight)
    }
  }, [step])

  // Calculate max content height based on window height
  const maxContentHeight = windowHeight ? Math.max(300, Math.min(windowHeight * 0.6, 500)) : 400

  // Calculate table height (leave space for search box and navigation)
  const tableMaxHeight = Math.max(200, maxContentHeight - 160)

  const handleNext = () => {
    setStep(step + 1)
  }

  const handlePrevious = () => {
    setStep(step - 1)
  }

  // Update the handleSave function to properly save inventory data to both history and current inventory
  // and ensure data synchronization across the application

  // Replace the existing handleSave function with this improved version
  const handleSave = async () => {
    // Create inventory snapshot with only ingredients that have quantities > 0
    const ingredientsWithValues = ingredientsWithQuantity.filter((ing) => ing.quantity > 0)

    if (ingredientsWithValues.length === 0) {
      toast({
        title: t("inventario_toast_error_title"),
        description: t("inventario_toast_no_ingredients_desc"),
        variant: "destructive",
      })
      return
    }

    // Create a new inventory snapshot for history
    const newInventorySnapshot = {
      id: uuidv4(),
      date: date ? date.toISOString() : new Date().toISOString(),
      type: inventoryType,
      periodicity: period,
      division: division,
      notes: notes,
      inventoryMode: inventoryMode, // Guardar el modo de inventario
      modifiedItems: ingredientsWithValues.length,
      totalValue: ingredientsWithValues.reduce(
        (sum, item) => sum + (item.calculatedQuantity || item.quantity) * (item.price || 0),
        0,
      ),
      items: ingredientsWithValues.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: inventoryMode === "presentation" ? item.calculatedQuantity || item.quantity : item.quantity,
        displayQuantity: item.quantity, // Guardar la cantidad mostrada al usuario
        unit: item.unit,
        price: item.price || 0,
        totalPrice: (item.calculatedQuantity || item.quantity) * (item.price || 0),
        presentation: item.presentation, // Guardar la presentación
        netContent: item.pricing?.netContent || 0, // Guardar el contenido neto
        priceAtDate: item.price || 0,
        previousPrice: item.previousPrice || item.price || 0,
        supplier: item.supplier || "No especificado", // Guardar el proveedor
      })),
      createdAt: new Date().toISOString(),
      createdBy: "Usuario Actual",
    }

    addInventorySnapshot(newInventorySnapshot, businessId)

    // Update current inventory with new quantities
    // Get current inventory from the database
    const currentInventory = getInventory(businessId)

    // En la función handleSave, asegurarse de que se actualicen todos los campos necesarios
    const updatedInventory = currentInventory.map((item) => {
      const matchingItem = ingredientsWithValues.find((ing) => ing.id === item.id)
      if (matchingItem) {
        return {
          ...item,
          currentStock:
            inventoryMode === "presentation"
              ? matchingItem.calculatedQuantity || matchingItem.quantity
              : matchingItem.quantity, // Asegurar que se guarde la cantidad correcta
          lastUpdated: new Date().toLocaleDateString(),
          price: matchingItem.price, // Update purchase price
          presentation: matchingItem.presentation, // Asegurar que se actualice la presentación
          status:
            (matchingItem.calculatedQuantity || matchingItem.quantity) <= item.minStock
              ? "critical"
              : (matchingItem.calculatedQuantity || matchingItem.quantity) <= item.minStock * 2
                ? "low"
                : "normal",
        }
      }
      return item
    })

    saveInventory(updatedInventory, businessId)

    // Also update ingredients with the new data from the database
    const allIngredients = getIngredients(businessId)

    // Costo promedio ponderado: solo tiene sentido en "nueva compra" (las otras
    // modalidades son conteos de inventario, no compras). La cantidad comprada se infiere
    // como el incremento sobre el stock previo. Se usa ing.currentStock (el registro de
    // ingredientes, ya confiable) en vez de currentInventory[].currentStock: esa colección
    // paralela nunca se popula de forma consistente (queda en null) y habría inflado la
    // cantidad comprada en cada compra sucesiva.
    const updatedIngredients = allIngredients.map((ing) => {
      const matchingItem: any = ingredientsWithValues.find((item) => item.id === ing.id)
      if (matchingItem) {
        const newPurchasePrice = matchingItem.price || ing.pricing?.purchasePrice || 0
        let weightedAverageCost = ing.pricing?.weightedAverageCost
        let weightedAverageQuantity = ing.pricing?.weightedAverageQuantity || 0

        if (inventoryType === "nueva compra" && matchingItem.price > 0) {
          const newStock =
            inventoryMode === "presentation"
              ? matchingItem.calculatedQuantity || matchingItem.quantity
              : matchingItem.quantity
          const result = computeWeightedAverageCost({
            previousStock: (ing as any).currentStock || 0,
            newStock,
            purchasePrice: matchingItem.price,
            netContent: matchingItem.pricing?.netContent || ing.pricing?.netContent || 1,
            previousWeightedAverageCost: weightedAverageCost,
            previousWeightedAverageQuantity: weightedAverageQuantity,
          })
          weightedAverageCost = result.weightedAverageCost
          weightedAverageQuantity = result.weightedAverageQuantity
        }

        return {
          ...ing,
          currentStock:
            inventoryMode === "presentation"
              ? matchingItem.calculatedQuantity || matchingItem.quantity
              : matchingItem.quantity, // Asegurar que se guarde la cantidad correcta
          pricing: {
            ...(ing.pricing || {}),
            purchasePrice: newPurchasePrice,
            weightedAverageCost,
            weightedAverageQuantity,
          },
          lastUpdated: new Date().toISOString(),
        }
      }
      return ing
    })

    saveIngredients(updatedIngredients, businessId)

    // Also update using the dashboard data function for consistency with the database
    setDashboardData("inventory", updatedInventory)
    setDashboardData("inventoryHistory", getInventoryHistory(businessId))
    setDashboardData("ingredients", updatedIngredients)

    // Show success message
    toast({
      title: t("inventario_toast_registered_title"),
      description: t("inventario_toast_registered_desc").replace("{count}", String(ingredientsWithValues.length)),
      variant: "success",
    })

    ActivityTracker.addActivity(
      `Inventario registrado: ${ingredientsWithValues.length} producto${ingredientsWithValues.length !== 1 ? "s" : ""} (${inventoryType})`,
      "inventory",
      businessId,
      { snapshotId: newInventorySnapshot.id, itemCount: ingredientsWithValues.length },
    )

    onOpenChange(false)

    // Cascada de precios: cualquier ingrediente cuyo precio cambió en esta compra dispara
    // el recálculo automático del costo de todas las recetas y sub-recetas que lo usan
    // (updateIngredientPriceAndRecalculate, ya usado también en la edición de Ingredientes).
    // Es el flujo principal por el que deberían entrar los precios: el usuario solo compra,
    // el sistema propaga el cambio solo. Se corre después de cerrar el diálogo para no
    // bloquear el flujo principal con la espera.
    const priceChanges = ingredientsWithValues
      .map((item) => {
        const original = allIngredients.find((ing) => ing.id === item.id)
        const oldPrice = original?.pricing?.purchasePrice || 0
        const newPrice = item.price || 0
        return oldPrice !== newPrice ? { id: item.id, name: item.name, oldPrice, newPrice } : null
      })
      .filter((change): change is { id: string; name: string; oldPrice: number; newPrice: number } => change !== null)

    if (priceChanges.length > 0) {
      Promise.all(priceChanges.map((change) => updateIngredientPriceAndRecalculate(businessId || "main", change.id, change.newPrice)))
        .then((results) => {
          const totalRecipes = results.reduce((sum, r) => sum + r.affectedRecipes.length, 0)
          const totalSubRecipes = results.reduce((sum, r) => sum + r.affectedSubRecipes.length, 0)
          if (totalRecipes > 0) {
            const subRecipesSuffix =
              totalSubRecipes > 0
                ? t("inventario_toast_costs_updated_subrecipes").replace("{count}", String(totalSubRecipes))
                : ""
            toast({
              title: t("inventario_toast_costs_updated_title"),
              description:
                priceChanges.length === 1
                  ? t("inventario_toast_costs_updated_single")
                      .replace("{name}", priceChanges[0].name)
                      .replace("{count}", String(totalRecipes))
                      .replace("{subrecipes}", subRecipesSuffix)
                  : t("inventario_toast_costs_updated_multiple")
                      .replace("{priceCount}", String(priceChanges.length))
                      .replace("{count}", String(totalRecipes))
                      .replace("{subrecipes}", subRecipesSuffix),
            })
          }
        })
        .catch((error) => {
          console.error("Error al recalcular recetas afectadas por cambio de precio:", error)
        })
    }
  }

  // Modificar la función handleQuantityChange para manejar el cálculo automático
  // Buscar la función handleQuantityChange (alrededor de la línea 170) y reemplazar:

  // BUG CORREGIDO (ver docs/33): en modo presentación, esta función guardaba el
  // número crudo tipeado (ej. "3" cajas) directo en `ing.quantity` — pero
  // `presentationCount` en el render se calcula como `Math.round(ing.quantity /
  // netContent)`, asumiendo que `quantity` ya está en unidad base (así arranca:
  // `quantity: currentStock` al inicializar, ver arriba). Resultado: al escribir "3",
  // en el siguiente render se recalculaba `Math.round(3 / netContent)` — con
  // netContent=5 eso es "1", el campo "saltaba" a un número distinto al que se
  // escribió, mientras el texto de ayuda de al lado sí mostraba el valor correcto.
  // Ahora `quantity` se mantiene siempre en unidad base (mismo significado en los
  // dos modos), multiplicando por netContent aquí en vez de en el render.
  const handleQuantityChange = (id: string, value: number) => {
    setIngredientsWithQuantity((prev) =>
      prev.map((ing) => {
        if (ing.id === id) {
          const netContent = ing.pricing?.netContent || 0
          if (inventoryMode === "presentation" && netContent > 0) {
            const baseQuantity = value * netContent
            return {
              ...ing,
              quantity: baseQuantity,
              calculatedQuantity: baseQuantity,
            }
          }
          // En modo métrico, la cantidad ingresada ya es la cantidad real
          return {
            ...ing,
            quantity: value,
            calculatedQuantity: value,
          }
        }
        return ing
      }),
    )
  }

  // Precio pagado en ESTA compra — el único lugar del sistema donde se espera que el
  // usuario escriba un precio. Al guardar, handleSave compara este valor contra el precio
  // que el ingrediente ya tenía y, si cambió, dispara la cascada de recálculo automático
  // sobre todas las recetas y sub-recetas que lo usan (ver updateIngredientPriceAndRecalculate).
  const handlePriceFieldChange = (id: string, value: number) => {
    setIngredientsWithQuantity((prev) => prev.map((ing) => (ing.id === id ? { ...ing, price: value } : ing)))
  }

  // Mejorar la función handlePresentationChange para obtener correctamente el contenido neto de la base de datos
  // y asegurar que se actualice correctamente en la base de datos

  const handlePresentationChange = (ingredientId: string, presentation: string) => {
    // Buscar en la base de datos el ingrediente y toda su información relevante
    const allIngredients = getIngredients(businessId)
    if (!allIngredients) return

    const currentInventory = getInventory(businessId)

    const matchingIngredient = allIngredients.find((dbIng: any) => dbIng.id === ingredientId)
    const inventoryItem = currentInventory.find((item: any) => item.id === ingredientId)

    // Obtener el ingrediente actual del estado para preservar valores importantes
    const currentIngredient = ingredientsWithQuantity.find((ing) => ing.id === ingredientId)

    // Obtener datos críticos de la base de datos
    let netContent = 0
    let purchasePrice = 0
    let supplier = ""

    // SIEMPRE obtener los datos desde la base de datos
    if (matchingIngredient) {
      // Obtener contenido neto
      if (matchingIngredient.pricing && typeof matchingIngredient.pricing.netContent === "number") {
        netContent = matchingIngredient.pricing.netContent
      }

      // Obtener precio de compra
      if (matchingIngredient.pricing && typeof matchingIngredient.pricing.purchasePrice === "number") {
        purchasePrice = matchingIngredient.pricing.purchasePrice
      } else if (typeof matchingIngredient.purchasePrice === "number") {
        purchasePrice = matchingIngredient.purchasePrice
      }

      // Obtener proveedor
      if (matchingIngredient.supplier) {
        supplier = matchingIngredient.supplier
      }
    }

    // Si no encontramos el proveedor en el ingrediente, buscarlo en el inventario
    if (!supplier && inventoryItem && inventoryItem.supplier) {
      supplier = inventoryItem.supplier
    }

    // Si todavía no tenemos proveedor, preservar el proveedor actual
    if (!supplier && currentIngredient && currentIngredient.supplier) {
      supplier = currentIngredient.supplier
    }

    // Actualizar el estado local con la información de la base de datos
    setIngredientsWithQuantity((prev) =>
      prev.map((ing) => {
        if (ing.id === ingredientId) {
          // Recalcular la cantidad según el modo y el contenido neto
          const currentQuantity = ing.quantity || 0
          const calculatedQuantity =
            inventoryMode === "presentation" && netContent > 0 ? currentQuantity * netContent : currentQuantity

          return {
            ...ing,
            presentation,
            // Preservar valores existentes
            quantity: ing.quantity,
            price: purchasePrice || ing.price,
            supplier: supplier || ing.supplier || "No especificado", // Preservar el proveedor
            pricing: {
              ...(ing.pricing || {}),
              netContent: netContent,
              purchasePrice: purchasePrice,
            },
            calculatedQuantity,
          }
        }
        return ing
      }),
    )

    // Actualizar la base de datos de ingredientes
    const updatedIngredients = allIngredients.map((ing: any) => {
      if (ing.id === ingredientId) {
        return {
          ...ing,
          presentation,
          supplier: supplier || ing.supplier, // Preservar el proveedor
          pricing: {
            ...(ing.pricing || {}),
            netContent: netContent,
            purchasePrice: purchasePrice,
          },
        }
      }
      return ing
    })

    // Guardar los cambios en la base de datos de ingredientes
    saveIngredients(updatedIngredients, businessId)

    // Actualizar también el inventario actual en la base de datos
    const updatedInventory = currentInventory.map((item: any) => {
      if (item.id === ingredientId) {
        return {
          ...item,
          presentation,
          price: purchasePrice || item.price,
          supplier: supplier || item.supplier, // Preservar el proveedor
        }
      }
      return item
    })

    // Guardar los cambios en el inventario actual
    saveInventory(updatedInventory, businessId)

    // Mostrar mensaje de éxito
    toast({
      title: t("inventario_toast_presentation_updated_title"),
      description: t("inventario_toast_presentation_updated_desc_register"),
      variant: "success",
    })
  }

  // Filter ingredients based on search term
  const filteredIngredients = ingredientsWithQuantity.filter(
    (ingredient) =>
      ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ingredient.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Get ingredients with quantities > 0
  const ingredientsWithValues = ingredientsWithQuantity.filter((ing) => ing.quantity > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:w-[90vw] max-w-3xl mx-auto my-1 p-3 sm:p-4 flex flex-col"
        style={{
          maxHeight: "95vh",
        }}
      >
        <DialogHeader className="border-b pb-3 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold">{t("inventario_register_button")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {t("inventario_register_step_progress")
              .replace("{step}", String(step))
              .replace(
                "{stepName}",
                step === 1
                  ? t("inventario_register_step1_name")
                  : step === 2
                    ? t("inventario_register_step2_name")
                    : t("inventario_register_step3_name"),
              )}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex justify-center py-2 overflow-x-auto flex-shrink-0">
          <div className="flex items-center min-w-max px-2">
            <StepIndicator active={step >= 1} completed={step > 1} label={t("inventario_register_step1_short")} />
            <StepConnector active={step > 1} />
            <StepIndicator active={step >= 2} completed={step > 2} label={t("nav_ingredientes")} />
            <StepConnector active={step > 2} />
            <StepIndicator active={step >= 3} completed={false} label={t("inventario_register_step3_name")} />
          </div>
        </div>

        {/* Content Area with ref for measuring */}
        <div className="flex-grow overflow-auto min-h-0">
          {step === 1 && (
            <div
              className="py-2 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300"
              style={{ maxHeight: `${maxContentHeight}px` }}
            >
              <Card className="border-none shadow-none">
                <CardContent className="p-0 sm:p-3">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        id="inventoryType"
                        label={t("inventario_register_type_label")}
                        tooltip={t("inventario_register_type_tooltip")}
                      >
                        <Select
                          value={inventoryType}
                          onValueChange={(value) => setInventoryType(value as "inicial" | "final" | "nueva compra")}
                        >
                          <SelectTrigger id="inventoryType" className="w-full h-9">
                            <SelectValue placeholder={t("inventario_register_select_type_placeholder")} />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="w-full"
                            style={{ maxWidth: "min(calc(95vw - 2rem), 400px)" }}
                          >
                            <SelectItem value="inicial">{t("inventario_register_type_initial")}</SelectItem>
                            <SelectItem value="final">{t("inventario_register_type_final")}</SelectItem>
                            <SelectItem value="nueva compra">{t("inventario_type_new_purchase")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        id="period"
                        label={t("inventario_period_label")}
                        tooltip={t("inventario_register_period_tooltip")}
                      >
                        <Select
                          value={period}
                          onValueChange={(value) => setPeriod(value as "diario" | "semanal" | "mensual")}
                        >
                          <SelectTrigger id="period" className="w-full h-9">
                            <SelectValue placeholder={t("inventario_register_select_period_placeholder")} />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="w-full"
                            style={{ maxWidth: "min(calc(95vw - 2rem), 400px)" }}
                          >
                            <SelectItem value="diario">{t("inventario_period_daily")}</SelectItem>
                            <SelectItem value="semanal">{t("inventario_period_weekly")}</SelectItem>
                            <SelectItem value="mensual">{t("inventario_period_monthly")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField id="date" label={t("inventario_date_label")} tooltip={t("inventario_register_date_tooltip")}>
                        <div className="relative w-full">
                          <Input
                            id="date"
                            readOnly
                            value={date ? format(date, "dd/MM/yyyy", { locale: es }) : ""}
                            className="w-full h-9 pr-10"
                          />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-9 w-9"
                                aria-label={t("inventario_register_select_date_aria")}
                              >
                                <CalendarIcon className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="p-0"
                              align="end"
                              sideOffset={4}
                              style={{
                                maxWidth: "min(calc(95vw - 16px), 400px)",
                                width: "auto",
                              }}
                            >
                              <Calendar initialFocus mode="single" selected={date} onSelect={setDate} locale={es} />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </FormField>

                      <FormField
                        id="division"
                        label={t("inventario_register_division_label")}
                        tooltip={t("inventario_register_division_tooltip")}
                      >
                        <Select value={division} onValueChange={(value) => setDivision(value)}>
                          <SelectTrigger id="division" className="w-full h-9">
                            <SelectValue placeholder={t("inventario_register_division_global")} />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="w-full"
                            style={{ maxWidth: "min(calc(95vw - 2rem), 400px)" }}
                          >
                            <div className="max-h-[200px] overflow-y-auto">
                              <SelectItem value="Inventario Global">{t("inventario_register_division_global")}</SelectItem>
                              {classifications.map((classification) => (
                                <SelectItem key={classification} value={classification}>
                                  {classificationLabels[classification] || classification}
                                </SelectItem>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>

                    <FormField
                      id="notes"
                      label={t("inventario_register_notes_label")}
                      tooltip={t("inventario_register_notes_tooltip")}
                    >
                      <Input
                        id="notes"
                        placeholder={t("inventario_register_notes_placeholder")}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-9"
                      />
                    </FormField>
                  </div>
                  {/* Modificar el Step 1 para incluir la selección de modo de inventario
                  Buscar la sección donde está el Step 1 (alrededor de la línea 200) y agregar después del último FormField: */}
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs font-medium">{t("inventario_mode_label")}</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="metricMode"
                          name="inventoryMode"
                          value="metric"
                          checked={inventoryMode === "metric"}
                          onChange={() => setInventoryMode("metric")}
                          className="h-4 w-4 text-primary"
                        />
                        <Label htmlFor="metricMode" className="text-sm font-normal cursor-pointer">
                          {t("inventario_register_mode_metric_option")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="presentationMode"
                          name="inventoryMode"
                          value="presentation"
                          checked={inventoryMode === "presentation"}
                          onChange={() => setInventoryMode("presentation")}
                          className="h-4 w-4 text-primary"
                        />
                        <Label htmlFor="presentationMode" className="text-sm font-normal cursor-pointer">
                          {t("inventario_register_mode_presentation_option")}
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inventoryMode === "presentation"
                        ? t("inventario_register_mode_presentation_help")
                        : t("inventario_register_mode_metric_help")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <Card className="border shadow-sm mt-2">
              <CardHeader className="p-3 pb-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t("inventario_register_search_ingredients_placeholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                  <span>
                    {t("inventario_register_ingredients_count")
                      .replace("{count}", String(filteredIngredients.length))
                      .replace("{total}", String(ingredients.length))}
                    {searchTerm && ` ${t("inventario_register_filtered_suffix")}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {t("inventario_register_with_values_badge").replace("{count}", String(ingredientsWithValues.length))}
                    </Badge>
                    <span className="italic">{t("inventario_register_scroll_hint")}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Ingredients Container with fixed height */}
                <div
                  className="overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300"
                  style={{ height: `${tableMaxHeight}px` }}
                >
                  {filteredIngredients.length > 0 ? (
                    <div className="overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: "touch" }}>
                      {/* Modificar el Step 2 (tabla de ingredientes) para adaptar la visualización según el modo seleccionado
                      Buscar la sección de TableHeader en el Step 2 (alrededor de la línea 300) y reemplazar: */}
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap w-[45%] sticky top-0 bg-background z-10 border-b text-center">
                              {t("inventario_table_name")}
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-[35%] sticky top-0 bg-background z-10 border-b text-center">
                              {t("inventario_table_category")}
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-[10%] sticky top-0 bg-background z-10 border-b text-center">
                              {inventoryMode === "presentation" ? t("inventario_table_presentation") : t("inventario_table_unit")}
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-[10%] sticky top-0 bg-background z-10 border-b text-center">
                              {inventoryMode === "presentation" ? t("inventario_table_quantity") : t("inventario_table_stock")}
                            </TableHead>
                            {inventoryType === "nueva compra" && (
                              <TableHead className="whitespace-nowrap w-[15%] sticky top-0 bg-background z-10 border-b text-center">
                                {t("inventario_register_price_paid_header")}
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        {/* Modificar el TableBody para mostrar la presentación y manejar el cálculo automático
                        Buscar la sección de TableBody en el Step 2 (alrededor de la línea 320) y reemplazar: */}
                        <TableBody>
                          {filteredIngredients.map((ingredient) => {
                            // Verificar si el ingrediente tiene presentación y contenido neto
                            const hasPresentation = !!ingredient.presentation
                            const netContent = ingredient.pricing?.netContent || 0

                            // Calcular la cantidad de presentaciones si estamos en modo presentación
                            const presentationCount =
                              netContent > 0 ? Math.round((ingredient.quantity || 0) / netContent) : 0

                            return (
                              <TableRow key={ingredient.id} className={ingredient.quantity > 0 ? "bg-primary/5" : ""}>
                                <TableCell className="max-w-[150px] truncate py-2 text-center">
                                  {ingredient.name}
                                </TableCell>
                                <TableCell className="max-w-[120px] truncate py-2 text-center">
                                  {ingredient.category}
                                </TableCell>
                                <TableCell className="whitespace-nowrap py-2 text-center">
                                  {inventoryMode === "presentation" ? (
                                    hasPresentation ? (
                                      // Mostrar la presentación con el contenido neto correctamente formateado desde la base de datos
                                      <span className="text-sm font-medium">
                                        {ingredient.presentation} ({ingredient.pricing?.netContent || 0}{" "}
                                        {ingredient.unit})
                                      </span>
                                    ) : (
                                      // Solo mostrar el selector de presentación si NO tiene una presentación existente
                                      <Select
                                        value=""
                                        onValueChange={(value) => handlePresentationChange(ingredient.id, value)}
                                      >
                                        <SelectTrigger className="w-full h-8 text-xs">
                                          <SelectValue placeholder={t("inventario_select_placeholder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availablePresentations.map((p) => (
                                            <SelectItem key={p} value={p}>
                                              {p}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )
                                  ) : (
                                    // En modo métrico, simplemente mostrar la unidad
                                    <span className="text-center">{ingredient.unit}</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  {inventoryMode === "presentation" && hasPresentation && netContent > 0 ? (
                                    <div className="flex items-center justify-center space-x-2">
                                      <Input
                                        type="number"
                                        value={presentationCount > 0 ? presentationCount : ""}
                                        onChange={(e) => {
                                          const value = Number.parseFloat(e.target.value) || 0
                                          // Calcular automáticamente el stock real basado en la presentación
                                          handleQuantityChange(ingredient.id, value)
                                        }}
                                        className="w-16 h-8 text-center"
                                        placeholder="0"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        = {ingredient.calculatedQuantity || 0} {ingredient.unit}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex justify-center">
                                      <Input
                                        type="number"
                                        value={ingredient.quantity || ""}
                                        onChange={(e) =>
                                          handleQuantityChange(ingredient.id, Number.parseFloat(e.target.value) || 0)
                                        }
                                        className="w-16 h-8 text-center"
                                        placeholder="0"
                                      />
                                    </div>
                                  )}
                                </TableCell>
                                {inventoryType === "nueva compra" && (
                                  <TableCell className="py-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={ingredient.price || ""}
                                        onChange={(e) =>
                                          handlePriceFieldChange(ingredient.id, Number.parseFloat(e.target.value) || 0)
                                        }
                                        className="w-20 h-8 text-center"
                                        placeholder="0.00"
                                      />
                                      {ingredient.pricing?.purchasePrice > 0 &&
                                        ingredient.price > 0 &&
                                        ingredient.price !== ingredient.pricing.purchasePrice && (
                                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {t("inventario_register_previous_price").replace(
                                              "{price}",
                                              ingredient.pricing.purchasePrice.toFixed(2),
                                            )}
                                          </span>
                                        )}
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? t("inventario_register_empty_search")
                          : t("inventario_register_empty_no_data")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <div
              className="py-2 overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300"
              style={{ maxHeight: `${maxContentHeight}px` }}
            >
              <Card className="border-none shadow-none">
                <CardContent className="p-0 sm:p-3">
                  <h3 className="text-base font-semibold mb-3">{t("inventario_register_summary_title")}</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground">{t("inventario_register_type_label")}</p>
                        <p className="font-medium text-sm capitalize text-foreground">{inventoryType}</p>
                      </div>
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground">{t("inventario_period_label")}</p>
                        <p className="font-medium text-sm capitalize text-foreground">{period}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground">{t("inventario_date_label")}</p>
                        <p className="font-medium text-sm text-foreground">
                          {date ? format(date, "PPP", { locale: es }) : t("inventario_register_no_date_selected")}
                        </p>
                      </div>
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground">{t("inventario_register_division_label")}</p>
                        <p className="font-medium text-sm text-foreground">{classificationLabels[division] || division}</p>
                      </div>
                    </div>
                    {/* Modificar la sección de confirmación (Step 3) para mostrar información sobre el modo de inventario
                    Buscar la sección donde se muestra el resumen del inventario en el Step 3 y agregar después de la división de inventario: */}
                    <div className="p-2 bg-muted rounded-md">
                      <p className="text-xs font-medium text-muted-foreground">{t("inventario_mode_label")}</p>
                      <p className="font-medium text-sm text-foreground">
                        {inventoryMode === "presentation" ? t("inventario_mode_by_presentation") : t("inventario_mode_metric_imperial")}
                      </p>
                    </div>

                    {notes && (
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground">{t("inventario_register_notes_label")}</p>
                        <p className="font-medium text-sm text-foreground">{notes}</p>
                      </div>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold mt-4 mb-2">{t("inventario_register_registered_ingredients_label")}</h4>
                  {ingredientsWithValues.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      {/* Modificar la tabla de ingredientes en el Step 3 para mostrar información sobre presentaciones
                      Buscar la sección de la tabla en el Step 3 y reemplazar: */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="py-1.5">{t("inventario_table_name")}</TableHead>
                            <TableHead className="py-1.5">{t("inventario_table_category")}</TableHead>
                            <TableHead className="py-1.5 text-right">{t("inventario_table_quantity")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredientsWithValues.map((ingredient) => (
                            <TableRow key={ingredient.id}>
                              <TableCell className="max-w-[200px] truncate py-1.5">{ingredient.name}</TableCell>
                              <TableCell className="max-w-[120px] truncate py-1.5">{ingredient.category}</TableCell>
                              <TableCell className="py-1.5 text-right">
                                <span className="font-medium">{ingredient.quantity}</span> {ingredient.unit}
                                {inventoryMode === "presentation" &&
                                  ingredient.presentation &&
                                  ingredient.pricing?.netContent > 0 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({Math.round(ingredient.quantity / ingredient.pricing.netContent)}{" "}
                                      {ingredient.presentation})
                                    </span>
                                  )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {ingredientsWithValues.length > 10 && (
                        <div className="p-1.5 text-center text-xs text-muted-foreground border-t">
                          {t("inventario_register_more_ingredients").replace("{count}", String(ingredientsWithValues.length - 10))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 border rounded-md bg-amber-50 dark:bg-amber-950/40">
                      <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
                      <p className="text-amber-800 dark:text-amber-300 font-medium">{t("inventario_register_no_values_title")}</p>
                      <p className="text-muted-foreground text-sm text-center mt-1">
                        {t("inventario_register_no_values_desc")}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setStep(2)}
                        className="mt-4 border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {t("inventario_register_back_to_ingredients_button")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {step !== 2 && (
          <DialogFooter className="border-t pt-3 mt-2 px-2 sm:px-4 pb-2 flex-shrink-0">
            <div className="flex w-full justify-between">
              <div>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    size="sm"
                    className="gap-1 bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("inventario_previous_button")}
                  </Button>
                )}
              </div>
              <div>
                {step < 3 ? (
                  <Button type="button" onClick={handleNext} size="sm" className="gap-1">
                    {t("tour_next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleSave} size="sm" disabled={ingredientsWithValues.length === 0}>
                    {t("common_save")}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}
        {step === 2 && (
          <div className="flex-shrink-0 border-t pt-3 mt-2 px-2 sm:px-4 pb-2">
            <div className="flex w-full justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                size="sm"
                className="gap-1 bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("inventario_previous_button")}
              </Button>
              <Button onClick={handleNext} size="sm" className="gap-1">
                {t("inventario_continue_button")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface FormFieldProps {
  id: string
  label: string
  tooltip?: string
  children: React.ReactNode
}

function FormField({ id, label, tooltip, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
    </div>
  )
}

export interface StepIndicatorProps {
  active: boolean
  completed: boolean
  label: string
}

function StepIndicator({ active, completed, label }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
          completed
            ? "bg-green-600 text-white shadow-sm"
            : active
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground border border-border"
        }`}
      >
        {completed ? "✓" : active ? "•" : ""}
      </div>
      <p className={`text-xs mt-1 font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
    </div>
  )
}

interface StepConnectorProps {
  active: boolean
}

function StepConnector({ active }: StepConnectorProps) {
  return (
    <div
      className={`h-1 w-6 sm:w-8 rounded-full transition-colors duration-300 ${active ? "bg-green-600" : "bg-muted"}`}
    ></div>
  )
}
