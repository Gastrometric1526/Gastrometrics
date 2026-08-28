"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, ChevronsUpDown, Upload, Settings, RotateCcw, Calculator, Info } from "lucide-react"
import { CalculationInfoDialog } from "./calculation-info-dialog"
import { cn } from "@/lib/utils"
import { getRecipeById, saveRecipe, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { ActivityTracker } from "@/lib/activity-tracker"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getBusinessById, getEffectivePricingDefaults, setEffectivePricingDefaults } from "@/lib/storage/businesses"
import {
  calculateTotalMonthlyExpenses,
  DEFAULT_PRICING_METHOD,
  DEFAULT_TARGET_FOOD_COST_PERCENT,
  type PricingMethod,
} from "@/types/business"
import { syncSubRecipeToIngredient } from "@/lib/subrecipe/core"
import type { Recipe, RecipeIngredient } from "@/types/recipe"
import { classifications, recipeSteps, SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import { unitAbbreviations } from "@/types/ingredient"
import { NumericInput } from "@/components/ui/numeric-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/currency"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getClassificationLabel } from "@/lib/classification-labels"

interface TechnicalSheetProps {
  mode: "new" | "view" | "edit"
  recipeId?: string
  businessId?: string
}

// Exportada (antes privada del componente) para poder cubrirla con una prueba
// unitaria directa — es la regla de negocio confirmada "un solo redondeo, en precio
// de venta unitario, hacia el 5 más alto" (ver CLAUDE.md, docs/04).
export function roundToNearestFive(value: number): number {
  return Math.ceil(value / 5) * 5
}

export function TechnicalSheet({ mode, recipeId, businessId = "main" }: TechnicalSheetProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { language, t } = useLanguage()
  const [isEditMode, setIsEditMode] = useState(mode === "new" || mode === "edit")

  // El botón "Editar" en la página de ver receta navega a la misma ruta con
  // ?mode=edit — no remonta este componente, así que isEditMode debe re-derivarse
  // del prop `mode` cada vez que cambia, o el formulario se queda en modo lectura
  // aunque la URL ya diga "edit" (bug reportado: "el botón editar no hace nada").
  useEffect(() => {
    setIsEditMode(mode === "new" || mode === "edit")
  }, [mode])
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([])
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({})
  const [showPriceSettings, setShowPriceSettings] = useState(false)
  const [showCalculationInfo, setShowCalculationInfo] = useState(false)
  const quantityInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const [recipe, setRecipe] = useState<Recipe>({
    id: recipeId || `recipe-${Date.now()}`,
    name: "",
    classification: "",
    plate: "",
    servings: 1,
    yieldAmount: 0,
    yieldUnit: "g",
    ingredients: [
      {
        id: `ing-${Date.now()}`,
        ingredientId: null,
        name: "",
        category: "",
        quantity: 0,
        unit: "",
        measure: "",
        cost: 0,
        unitCost: 0,
        costPerMeasure: 0,
        extension: 0,
      },
    ],
    procedure: [""],
    totalCost: 0,
    costPerServing: 0,
    businessId,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  })

  const [paxModifier, setPaxModifier] = useState<number>(0)
  const [contributionMargin, setContributionMargin] = useState<number>(30)
  const [publicServices, setPublicServices] = useState<number>(10)
  const [marketing, setMarketing] = useState<number>(10)
  const [operationalCosts, setOperationalCosts] = useState<number>(30)
  const [laborCosts, setLaborCosts] = useState<number>(25)
  const [isv, setIsv] = useState<number>(0)
  const [customUnitProfitInput, setCustomUnitProfitInput] = useState<string>("")
  const [customPriceInput, setCustomPriceInput] = useState<string>("")
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>(DEFAULT_PRICING_METHOD)
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState<number>(DEFAULT_TARGET_FOOD_COST_PERCENT)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([ensureIngredientsLoaded(businessId), ensureRecipesLoaded(businessId)])
      if (cancelled) return
      loadTechnicalSheetData()
    })()
    return () => {
      cancelled = true
    }
  }, [recipeId, mode, businessId])

  function loadTechnicalSheetData() {
    const ingredients = getIngredients(businessId)
    setAvailableIngredients(ingredients)

    // Método de costeo: el que ya tenga guardado ESTA receta manda; si es una receta
    // nueva, se parte del método por defecto configurado en el negocio (con fallback
    // a DEFAULT_PRICING_METHOD si el negocio tampoco lo definió — ver types/business.ts).
    // getEffectivePricingDefaults funciona igual para "main" (el workspace por defecto,
    // que nunca tiene una fila real en getAllBusinesses()) y para negocios reales — ver
    // lib/storage/businesses.ts.
    const pricingDefaults = getEffectivePricingDefaults(businessId)

    if (recipeId && (mode === "view" || mode === "edit")) {
      const existingRecipe = getRecipeById(recipeId, businessId)
      if (existingRecipe) {
        // "Procedimiento y Observaciones" es un solo campo (recipe.procedure) — antes eran
        // dos arreglos separados; para no perder texto ya guardado en recetas de esa etapa
        // anterior, se agrega lo que hubiera en "observations" al final del procedimiento la
        // primera vez que se abre esa receta. Si la receta no tiene ninguna línea todavía,
        // se deja una vacía para que el editor siempre tenga dónde escribir.
        const mergedProcedure = [
          ...(existingRecipe.procedure || []),
          ...(existingRecipe.observations || []),
        ].filter((line) => line.trim() !== "")
        setRecipe({
          ...existingRecipe,
          procedure: mergedProcedure.length > 0 ? mergedProcedure : [""],
          observations: undefined,
        })
        setContributionMargin(existingRecipe.contributionMargin || 30)
        setPublicServices(existingRecipe.publicServices || 10)
        setMarketing(existingRecipe.marketing || 10)
        setOperationalCosts(existingRecipe.operationalCosts || 30)
        setLaborCosts(existingRecipe.laborCosts || 25)
        setIsv(existingRecipe.isv || 0)
        setPricingMethod(existingRecipe.pricingMethod || pricingDefaults.pricingMethod || DEFAULT_PRICING_METHOD)
        setTargetFoodCostPercent(
          existingRecipe.targetFoodCostPercent ||
            pricingDefaults.targetFoodCostPercent ||
            DEFAULT_TARGET_FOOD_COST_PERCENT,
        )
        if (existingRecipe.customUnitProfit !== undefined && existingRecipe.customUnitProfit !== null) {
          setCustomUnitProfitInput(existingRecipe.customUnitProfit.toString())
        }
        if (existingRecipe.customUnitPrice !== undefined && existingRecipe.customUnitPrice !== null) {
          setCustomPriceInput(existingRecipe.customUnitPrice.toString())
        }
      }
    } else {
      setPricingMethod(pricingDefaults.pricingMethod || DEFAULT_PRICING_METHOD)
      setTargetFoodCostPercent(pricingDefaults.targetFoodCostPercent || DEFAULT_TARGET_FOOD_COST_PERCENT)
    }
  }

  // Elegir un método de costeo aquí lo vuelve el default del negocio de inmediato (no
  // solo al guardar esta receta) — pedido explícito: "al seleccionar un metodo ese se
  // vuelva el default para todas las recetas". Las recetas que ya tengan su propio
  // pricingMethod guardado explícitamente no se tocan (ver el fallback en el useEffect
  // de arriba: receta propia -> default del negocio -> default global); esto solo
  // cambia qué default heredan las recetas que nunca lo sobreescribieron.
  const handlePricingMethodChange = useCallback(
    (value: PricingMethod) => {
      setPricingMethod(value)
      setEffectivePricingDefaults(businessId, { pricingMethod: value })
      toast({
        title: t("ficha_tecnica_toast_pricing_method_updated_title"),
        description: t("ficha_tecnica_toast_pricing_method_updated_desc"),
      })
    },
    [businessId, toast, t],
  )

  const handleTargetFoodCostPercentChange = useCallback(
    (value: number) => {
      setTargetFoodCostPercent(value)
      setEffectivePricingDefaults(businessId, { targetFoodCostPercent: value })
    },
    [businessId],
  )

  const calculations = useMemo(() => {
    // El modificador de PAX escala relativo al rendimiento actual de la receta
    // (campo "Rendimiento" = recipe.yieldAmount), no a recipe.servings — ese campo
    // no tiene ningún input en este formulario y se queda fijo en 1 (su default),
    // lo que hacía que el multiplicador siempre partiera de una base de 1 persona
    // en vez del rendimiento real ya declarado. Ver hallazgo: "modificador de PAX
    // no funciona" — daba números ~10x más altos de lo esperado.
    const baseYield = recipe.yieldAmount > 0 ? recipe.yieldAmount : recipe.servings || 1
    const paxMultiplier = paxModifier > 0 ? paxModifier / baseYield : 1
    const productionCost = recipe.ingredients.reduce((sum, ing) => sum + (ing.extension || 0), 0) * paxMultiplier

    // Cantidad de cada ingrediente ya escalada al pax objetivo, redondeada hacia arriba
    // (nunca quedarse corto en cocina) — precisión a 1 decimal para no distorsionar
    // ingredientes de baja cantidad como especias. Ver 09-sesion-continuidad.md.
    const scaledIngredientQuantities = recipe.ingredients.map((ing) =>
      paxMultiplier !== 1 ? Math.ceil(ing.quantity * paxMultiplier * 10) / 10 : ing.quantity,
    )

    const yieldByWeight =
      recipe.ingredients.reduce((sum, ing) => {
        if (ing.quantity > 0 && ing.ingredientId) {
          return sum + ing.quantity
        }
        return sum
      }, 0) * paxMultiplier

    const effectiveYield =
      recipe.yieldAmount && recipe.yieldAmount > 0 ? recipe.yieldAmount * paxMultiplier : yieldByWeight

    const unitCost = effectiveYield > 0 ? productionCost / effectiveYield : 0

    const publicServicesAmount = productionCost * (publicServices / 100)
    const marketingAmount = productionCost * (marketing / 100)
    const operationalCostsAmount = productionCost * (operationalCosts / 100)
    const laborCostsAmount = productionCost * (laborCosts / 100)
    const isvAmount = productionCost * (isv / 100)
    const netProfitAmount = productionCost * (contributionMargin / 100)

    // Costo fijo del negocio, prorrateado a esta receta (documento 01, sección de rubros).
    // Se calcula igual que "costPerPlate" en la pantalla de negocio (gastos mensuales totales
    // ÷ platos mensuales estimados) y se inyecta automáticamente como un rubro más, sin que
    // el usuario tenga que escribirlo receta por receta. Si el negocio no tiene gastos
    // configurados, el rubro no aparece (fixedCostPerPlate queda en 0).
    const business = businessId ? getBusinessById(businessId) : null
    const fixedCostPerPlate =
      business?.expenses && business.estimatedMonthlyPlates && business.estimatedMonthlyPlates > 0
        ? calculateTotalMonthlyExpenses(business.expenses) / business.estimatedMonthlyPlates
        : 0
    const fixedCostAmount = fixedCostPerPlate * effectiveYield
    const fixedCostPercentage = productionCost > 0 ? (fixedCostAmount / productionCost) * 100 : 0

    // BUG CORREGIDO (ver 02-hallazgos-codigo-y-excel.md, sección "Resumen de costos"):
    // esta suma incluía "productionCost" además de los 6 rubros, y ese total se dividía
    // entre el rendimiento para obtener la ganancia unitaria. Eso duplicaba el costo
    // unitario dentro de la ganancia unitaria, porque más abajo "recommendedPrice" vuelve
    // a sumar unitCost por separado. El mismo bug existe en el Excel maestro original
    // (celda K26), documentado en el mismo archivo de hallazgos.
    // Además, este paso tenía un redondeo intermedio (roundToNearestFive) que contradice
    // la decisión confirmada: el único redondeo va en el precio de venta unitario, no aquí.
    // "calculatedSalePrice" ahora es solo la suma de los 6 rubros — coincide con el "Total"
    // que se muestra debajo de esa lista en la UI (antes ese Total no coincidía con la suma
    // de las filas que tenía arriba, porque incluía productionCost sin mostrarlo).
    const calculatedSalePrice =
      publicServicesAmount +
      marketingAmount +
      operationalCostsAmount +
      laborCostsAmount +
      isvAmount +
      netProfitAmount +
      fixedCostAmount

    const calculatedUnitProfit = effectiveYield > 0 ? calculatedSalePrice / effectiveYield : 0

    const customValue = customUnitProfitInput !== "" ? Number.parseFloat(customUnitProfitInput) : null
    const unitProfit = customValue !== null && !isNaN(customValue) ? customValue : calculatedUnitProfit

    // Método GastroMetrics (conservador): seis rubros sumados sobre el costo de producción.
    const gastrometricsPrice = roundToNearestFive(unitCost + unitProfit)

    // Método Food Cost % (estándar de industria): Precio = Costo unitario / Food Cost % objetivo.
    // Ej. costo unitario L20, food cost objetivo 30% → precio = 20 / 0.30 = L66.67 → redondeado L70.
    // No usa los seis rubros — es un solo número, más simple pero menos granular.
    const foodCostPrice =
      targetFoodCostPercent > 0 && unitCost > 0 ? roundToNearestFive(unitCost / (targetFoodCostPercent / 100)) : 0

    const recommendedPrice = pricingMethod === "food_cost" ? foodCostPrice : gastrometricsPrice

    // El precio de venta calculado es siempre una sugerencia — si el usuario escribió un
    // precio directamente, ese manda para todo lo que sigue (venta total, márgenes, etc.).
    // Si nunca lo toca, se usa el sugerido tal cual, sin que tenga que hacer nada.
    const customPriceValue = customPriceInput !== "" ? Number.parseFloat(customPriceInput) : null
    const finalPrice = customPriceValue !== null && !isNaN(customPriceValue) ? customPriceValue : recommendedPrice

    const totalSales = finalPrice * effectiveYield

    const totalNetProfit = totalSales - productionCost

    const calculatedContributionMargin = totalSales > 0 ? ((totalSales - productionCost) / totalSales) * 100 : 0

    // "Costo %" (food cost), Excel maestro H11 = H33/H10*100 (documento 01, sección 10).
    // No editable, solo informativo.
    const foodCostPercent = totalSales > 0 ? (productionCost / totalSales) * 100 : 0

    return {
      productionCost,
      yieldByWeight,
      yieldAmount: effectiveYield,
      unitCost,
      calculatedUnitProfit,
      unitProfit,
      recommendedPrice,
      finalPrice,
      gastrometricsPrice,
      foodCostPrice,
      totalSales,
      netProfit: totalNetProfit,
      publicServicesAmount,
      marketingAmount,
      operationalCostsAmount,
      laborCostsAmount,
      isvAmount,
      netProfitAmount,
      calculatedContributionMargin,
      calculatedSalePrice, // Agregado para mostrar el total calculado
      fixedCostAmount,
      fixedCostPercentage,
      foodCostPercent,
      scaledIngredientQuantities,
      paxMultiplier,
    }
  }, [
    recipe.ingredients,
    recipe.yieldAmount,
    recipe.servings,
    contributionMargin,
    customUnitProfitInput,
    paxModifier,
    publicServices,
    marketing,
    operationalCosts,
    laborCosts,
    isv,
    businessId,
    pricingMethod,
    targetFoodCostPercent,
    customPriceInput,
  ])

  useEffect(() => {
    setRecipe((prev) => ({
      ...prev,
      totalCost: calculations.productionCost,
      costPerServing: calculations.unitCost,
      unitPrice: calculations.finalPrice,
      totalPrice: calculations.totalSales,
      netProfit: calculations.netProfit,
      customUnitProfit: customUnitProfitInput !== "" ? Number.parseFloat(customUnitProfitInput) : undefined,
      customUnitPrice: customPriceInput !== "" ? Number.parseFloat(customPriceInput) : undefined,
      contributionMargin,
      publicServices,
      marketing,
      operationalCosts,
      laborCosts,
      isv,
    }))
  }, [
    calculations,
    contributionMargin,
    publicServices,
    marketing,
    operationalCosts,
    laborCosts,
    isv,
    customUnitProfitInput,
    customPriceInput,
  ])

  const handlePopoverOpenChange = useCallback((index: number, open: boolean) => {
    setOpenPopovers((prev) => ({
      ...prev,
      [index]: open,
    }))
  }, [])

  const handleFieldUpdate = useCallback((field: keyof Recipe, value: any) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  // Flujo de avance automático con Enter: Nombre -> Clasificación -> Paso ->
  // Rendimiento -> Modificador de PAX. Pedido explícito: "al hacer enter debe
  // moverse a la siguiente area interactable", excepto en el engranaje de
  // ajustes, la selección de ingredientes, y Procedimiento y Observaciones,
  // donde el usuario debe seguir controlando todo manualmente.
  const nameInputRef = useRef<HTMLInputElement>(null)
  const classificationTriggerRef = useRef<HTMLButtonElement>(null)
  const plateTriggerRef = useRef<HTMLButtonElement>(null)
  const yieldAmountInputRef = useRef<HTMLInputElement>(null)
  const paxModifierInputRef = useRef<HTMLInputElement>(null)
  const [classificationOpen, setClassificationOpen] = useState(false)
  const [plateOpen, setPlateOpen] = useState(false)

  // Los Select de Radix devuelven el foco a su propio trigger como parte de su
  // animación de cierre (data-state=closed, ~150ms por la transición de shadcn/ui
  // en components/ui/select.tsx) — abrir el siguiente campo antes de que esa
  // animación termine pierde el foco de vuelta al trigger que se acaba de cerrar.
  // 200ms deja tiempo de sobra sin sentirse lento para quien está tipeando.
  const FOCUS_ADVANCE_DELAY_MS = 200

  const focusAndOpenClassification = useCallback(() => {
    setTimeout(() => {
      classificationTriggerRef.current?.focus()
      setClassificationOpen(true)
    }, FOCUS_ADVANCE_DELAY_MS)
  }, [])

  const focusAndOpenPlate = useCallback(() => {
    setTimeout(() => {
      plateTriggerRef.current?.focus()
      setPlateOpen(true)
    }, FOCUS_ADVANCE_DELAY_MS)
  }, [])

  const focusAndSelectYieldAmount = useCallback(() => {
    setTimeout(() => {
      yieldAmountInputRef.current?.focus()
      yieldAmountInputRef.current?.select()
    }, FOCUS_ADVANCE_DELAY_MS)
  }, [])

  const focusAndSelectPaxModifier = useCallback(() => {
    setTimeout(() => {
      paxModifierInputRef.current?.focus()
      paxModifierInputRef.current?.select()
    }, FOCUS_ADVANCE_DELAY_MS)
  }, [])

  const handleEnterAdvance = useCallback((next: () => void) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        next()
      }
    }
  }, [])

  const updateIngredient = useCallback(
    (index: number, field: keyof RecipeIngredient, value: string | number) => {
      const newIngredients = [...recipe.ingredients]

      if (field === "ingredientId") {
        const selectedIngredient = availableIngredients.find((ing) => ing.id === value)
        if (selectedIngredient) {
          const measure = unitAbbreviations[selectedIngredient.unit] || selectedIngredient.unit

          newIngredients[index] = {
            ...newIngredients[index],
            ingredientId: selectedIngredient.id,
            name: selectedIngredient.name,
            category: selectedIngredient.category,
            measure: measure,
            unit: selectedIngredient.unit,
            unitCost: selectedIngredient.pricing.pricePerUnit,
            costPerMeasure: selectedIngredient.pricing.pricePerUnit,
            extension: newIngredients[index].quantity * selectedIngredient.pricing.pricePerUnit,
          }

          setOpenPopovers((prev) => ({ ...prev, [index]: false }))

          setTimeout(() => {
            const quantityInput = quantityInputRefs.current[index]
            if (quantityInput) {
              quantityInput.focus()
              quantityInput.select()
            }
          }, 100)
        }
      } else if (field === "quantity") {
        newIngredients[index] = {
          ...newIngredients[index],
          quantity: Number(value),
          extension: Number(value) * newIngredients[index].unitCost,
        }
      } else {
        newIngredients[index] = { ...newIngredients[index], [field]: value }
      }

      if (
        index === newIngredients.length - 1 &&
        newIngredients[index].ingredientId &&
        newIngredients[index].quantity > 0
      ) {
        newIngredients.push({
          id: `ing-${Date.now()}`,
          ingredientId: null,
          name: "",
          category: "",
          quantity: 0,
          unit: "",
          measure: "",
          cost: 0,
          unitCost: 0,
          costPerMeasure: 0,
          extension: 0,
        })
      }

      setRecipe((prev) => ({ ...prev, ingredients: newIngredients }))
    },
    [recipe.ingredients, availableIngredients],
  )

  const handleQuantityKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const newIngredients = [...recipe.ingredients]

        if (
          index === newIngredients.length - 1 &&
          newIngredients[index].ingredientId &&
          newIngredients[index].quantity > 0
        ) {
          newIngredients.push({
            id: `ing-${Date.now()}`,
            ingredientId: null,
            name: "",
            category: "",
            quantity: 0,
            unit: "",
            measure: "",
            cost: 0,
            unitCost: 0,
            costPerMeasure: 0,
            extension: 0,
          })
          setRecipe((prev) => ({ ...prev, ingredients: newIngredients }))
        }

        setTimeout(() => {
          setOpenPopovers((prev) => ({ ...prev, [index + 1]: true }))
        }, 100)
      }
    },
    [recipe.ingredients],
  )

  const addNewIngredient = useCallback(() => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          id: `ing-${Date.now()}`,
          ingredientId: null,
          name: "",
          category: "",
          quantity: 0,
          unit: "",
          measure: "",
          cost: 0,
          unitCost: 0,
          costPerMeasure: 0,
          extension: 0,
        },
      ],
    }))
  }, [])

  const handleProcedureChange = useCallback((index: number, value: string) => {
    setRecipe((prev) => {
      const newProcedures = [...prev.procedure]
      newProcedures[index] = value
      return { ...prev, procedure: newProcedures }
    })
  }, [])

  const procedureInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const handleProcedureKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    setRecipe((prev) => {
      const isLast = index === prev.procedure.length - 1
      const newProcedures = isLast ? [...prev.procedure, ""] : prev.procedure
      return { ...prev, procedure: newProcedures }
    })
    setTimeout(() => {
      procedureInputRefs.current[index + 1]?.focus()
    }, 0)
  }, [])

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      setRecipe((prev) => ({ ...prev, image: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }, [])

  const [isDraggingImage, setIsDraggingImage] = useState(false)

  const handleImageDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDraggingImage(false)
      const file = e.dataTransfer.files?.[0]
      if (file && file.type.startsWith("image/")) {
        handleImageUpload(file)
      }
    },
    [handleImageUpload],
  )

  const handleSaveRecipe = useCallback(async () => {
    try {
      if (!recipe.name || recipe.name.trim() === "") {
        toast({
          title: t("ficha_tecnica_toast_missing_name_title"),
          description: t("ficha_tecnica_toast_missing_name_desc"),
          variant: "destructive",
        })
        return
      }

      if (!recipe.classification) {
        toast({
          title: t("ficha_tecnica_toast_missing_classification_title"),
          description: t("ficha_tecnica_toast_missing_classification_desc"),
          variant: "destructive",
        })
        return
      }

      const validIngredients = recipe.ingredients.filter((ing) => ing.ingredientId && ing.quantity > 0)

      if (validIngredients.length === 0) {
        toast({
          title: t("ficha_tecnica_toast_missing_ingredient_title"),
          description: t("ficha_tecnica_toast_missing_ingredient_desc"),
          variant: "destructive",
        })
        return
      }

      const isSubRecipe = recipe.classification === SUBRECIPE_CLASSIFICATION
      const effectiveYield = recipe.yieldAmount > 0 ? recipe.yieldAmount : calculations.yieldByWeight

      if (!isSubRecipe && effectiveYield <= 0) {
        toast({
          title: t("ficha_tecnica_toast_missing_yield_title"),
          description: t("ficha_tecnica_toast_missing_yield_desc"),
          variant: "destructive",
        })
        return
      }

      const validProcedures = recipe.procedure.filter((step) => step.trim() !== "")

      const pricingConfig: any = {
        publicServices,
        marketing,
        operationalCosts,
        laborCosts,
        netProfit: contributionMargin,
        isv,
        isDefault: false,
      }

      // Modificador de PAX: si está activo al guardar, la receta se persiste ya
      // escalada (yieldAmount e ingredientes), y se congela un "originalSnapshot"
      // con los valores de antes de escalar — solo la primera vez, para que el
      // botón "Restaurar receta original" siempre pueda volver al tamaño real sin
      // importar cuántas veces se re-escale y guarde después. Ver
      // handleRestoreOriginalSize más abajo.
      const paxIsActive = paxModifier > 0 && calculations.paxMultiplier !== 1
      const scaledIngredients = paxIsActive
        ? validIngredients.map((ing) => {
            const scaledQuantity = Math.ceil(ing.quantity * calculations.paxMultiplier * 10) / 10
            return {
              ...ing,
              quantity: scaledQuantity,
              extension: scaledQuantity * (ing.unitCost || 0),
            }
          })
        : validIngredients
      const scaledYieldAmount = paxIsActive ? effectiveYield * calculations.paxMultiplier : effectiveYield
      const originalSnapshot = paxIsActive
        ? recipe.originalSnapshot ?? { yieldAmount: effectiveYield, ingredients: validIngredients }
        : recipe.originalSnapshot

      const recipeToSave: Recipe = {
        ...recipe,
        yieldAmount: scaledYieldAmount,
        ingredients: scaledIngredients,
        originalSnapshot,
        procedure: validProcedures,
        observations: undefined,
        pricingConfig,
        customUnitProfit: customUnitProfitInput !== "" ? Number.parseFloat(customUnitProfitInput) : undefined,
        customUnitPrice: customPriceInput !== "" ? Number.parseFloat(customPriceInput) : undefined,
        contributionMargin,
        publicServices,
        marketing,
        operationalCosts,
        laborCosts,
        isv,
        pricingMethod,
        targetFoodCostPercent,
        metadata: {
          ...recipe.metadata,
          updatedAt: new Date().toISOString(),
          version: (recipe.metadata?.version || 0) + 1,
        },
      }

      const savedRecipe = await saveRecipe(recipeToSave, businessId)

      ActivityTracker.addActivity(
        mode === "edit" ? `Receta actualizada: ${savedRecipe.name}` : `Nueva receta: ${savedRecipe.name}`,
        "recipe",
        businessId,
        { action: mode === "edit" ? "update" : "create", recipeId: savedRecipe.id },
      )

      if (savedRecipe.classification === SUBRECIPE_CLASSIFICATION) {
        await syncSubRecipeToIngredient(savedRecipe, businessId)
      }

      router.push("/mis-recetas")
    } catch (error) {
      console.error("Error al guardar la receta:", error)
      toast({
        title: t("ficha_tecnica_toast_save_error_title"),
        description: error instanceof Error ? error.message : t("ficha_tecnica_toast_save_error_desc"),
        variant: "destructive",
      })
    }
  }, [
    recipe,
    businessId,
    router,
    toast,
    t,
    contributionMargin,
    publicServices,
    marketing,
    operationalCosts,
    laborCosts,
    isv,
    customUnitProfitInput,
    calculations.yieldByWeight,
    paxModifier,
    calculations.paxMultiplier,
  ])

  // Restaura el rendimiento e ingredientes al tamaño original guardado en
  // originalSnapshot (ver handleSave) y limpia el modificador — el usuario debe
  // seguir presionando "Guardar" para confirmar el cambio, igual que cualquier
  // otra edición de este formulario, nada se guarda solo.
  const handleRestoreOriginalSize = useCallback(() => {
    if (!recipe.originalSnapshot) return
    const { yieldAmount, ingredients } = recipe.originalSnapshot
    setRecipe((prev) => ({
      ...prev,
      yieldAmount,
      ingredients,
      originalSnapshot: undefined,
    }))
    setPaxModifier(0)
    toast({
      title: t("ficha_tecnica_toast_recipe_restored_title"),
      description: t("ficha_tecnica_toast_recipe_restored_desc"),
    })
  }, [recipe.originalSnapshot, toast, t])

  const handleUnitProfitChange = useCallback((value: string) => {
    setCustomUnitProfitInput(value)
  }, [])

  const handleUnitProfitBlur = useCallback(() => {
    if (customUnitProfitInput === "" || isNaN(Number.parseFloat(customUnitProfitInput))) {
      setCustomUnitProfitInput("")
    }
  }, [customUnitProfitInput])

  const handlePriceChange = useCallback((value: string) => {
    setCustomPriceInput(value)
  }, [])

  const handlePriceBlur = useCallback(() => {
    if (customPriceInput === "" || isNaN(Number.parseFloat(customPriceInput))) {
      setCustomPriceInput("")
    }
  }, [customPriceInput])

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <Card className="w-full mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">{t("nav_ficha_tecnica")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4" data-tour="ficha-name-classification">
                <div>
                  <Label htmlFor="name">{t("ficha_tecnica_field_name")}</Label>
                  <Input
                    id="name"
                    ref={nameInputRef}
                    value={recipe.name}
                    onChange={(e) => handleFieldUpdate("name", e.target.value)}
                    onKeyDown={isEditMode ? handleEnterAdvance(focusAndOpenClassification) : undefined}
                    disabled={!isEditMode}
                    placeholder={!isEditMode && !recipe.name ? "" : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="classification">{t("ficha_tecnica_field_classification")}</Label>
                  <Select
                    value={recipe.classification}
                    onValueChange={(value) => {
                      handleFieldUpdate("classification", value)
                      if (isEditMode) focusAndOpenPlate()
                    }}
                    open={classificationOpen}
                    onOpenChange={setClassificationOpen}
                    disabled={!isEditMode}
                  >
                    <SelectTrigger
                      id="classification"
                      ref={classificationTriggerRef}
                      className={!recipe.classification ? "text-muted-foreground" : undefined}
                    >
                      <SelectValue placeholder={t("ficha_tecnica_classification_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {classifications.map((classification) => (
                        <SelectItem key={classification} value={classification}>
                          {getClassificationLabel(classification, language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4" data-tour="ficha-paso-rendimiento">
                <div>
                  <Label htmlFor="plate">{t("ficha_tecnica_field_step")}</Label>
                  <Select
                    value={recipe.plate}
                    onValueChange={(value) => {
                      handleFieldUpdate("plate", value)
                      if (isEditMode) focusAndSelectYieldAmount()
                    }}
                    open={plateOpen}
                    onOpenChange={setPlateOpen}
                    disabled={!isEditMode}
                  >
                    <SelectTrigger ref={plateTriggerRef}>
                      <SelectValue placeholder={t("ficha_tecnica_step_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {recipeSteps.map((step) => (
                        <SelectItem key={step} value={step}>
                          {step}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="yieldAmount">{t("ficha_tecnica_field_yield")}</Label>
                  {isEditMode ? (
                    <NumericInput
                      id="yieldAmount"
                      ref={yieldAmountInputRef}
                      value={recipe.yieldAmount || ""}
                      onChange={(value) => handleFieldUpdate("yieldAmount", value)}
                      onKeyDown={handleEnterAdvance(focusAndSelectPaxModifier)}
                      placeholder=""
                      decimalPlaces={2}
                      min={0}
                    />
                  ) : (
                    <Input
                      id="yieldAmount"
                      type="text"
                      value={recipe.yieldAmount > 0 ? recipe.yieldAmount : ""}
                      disabled
                      placeholder=""
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contributionMargin">{t("ficha_tecnica_field_contribution_margin")}</Label>
                  <div className="relative">
                    <Input
                      id="contributionMargin"
                      type="text"
                      value={
                        calculations.calculatedContributionMargin > 0
                          ? `${calculations.calculatedContributionMargin.toFixed(2)}`
                          : ""
                      }
                      disabled
                      placeholder=""
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="yieldByWeight">{t("ficha_tecnica_field_yield_by_weight")}</Label>
                  <Input
                    id="yieldByWeight"
                    type="text"
                    value={calculations.yieldByWeight > 0 ? Math.floor(calculations.yieldByWeight) : ""}
                    disabled
                    placeholder=""
                  />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg" data-tour="ficha-pax">
                <Label htmlFor="paxModifier" className="font-semibold">
                  {t("tour_ficha_pax_title")}
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  {isEditMode ? (
                    <NumericInput
                      id="paxModifier"
                      ref={paxModifierInputRef}
                      value={paxModifier || ""}
                      onChange={(value) => setPaxModifier(value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          e.currentTarget.blur()
                        }
                      }}
                      className="w-24"
                      placeholder="0"
                      decimalPlaces={0}
                      min={0}
                    />
                  ) : (
                    <Input
                      id="paxModifier"
                      type="text"
                      value={paxModifier > 0 ? paxModifier : ""}
                      className="w-24"
                      disabled
                      placeholder=""
                    />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {t("ficha_tecnica_pax_hint")}
                  </span>
                </div>
                {recipe.originalSnapshot && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreOriginalSize}
                    disabled={!isEditMode}
                    className="mt-3 gap-2 bg-transparent"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("ficha_tecnica_restore_original_button")}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-start">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg w-48 h-48 flex items-center justify-center bg-muted/50 transition-colors",
                  isEditMode && isDraggingImage && "border-primary bg-primary/10",
                )}
                onDragOver={
                  isEditMode
                    ? (e) => {
                        e.preventDefault()
                        setIsDraggingImage(true)
                      }
                    : undefined
                }
                onDragLeave={isEditMode ? () => setIsDraggingImage(false) : undefined}
                onDrop={isEditMode ? handleImageDrop : undefined}
              >
                {recipe.image ? (
                  <img
                    src={recipe.image || "/placeholder.svg"}
                    alt="Recipe"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {isEditMode ? t("ficha_tecnica_image_drag_hint") : t("ficha_tecnica_no_image")}
                    </p>
                    {isEditMode && (
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="image-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file)
                        }}
                      />
                    )}
                    {isEditMode && (
                      <label
                        htmlFor="image-upload"
                        className="mt-2 inline-block cursor-pointer text-xs text-primary hover:underline"
                      >
                        {t("ficha_tecnica_select_file")}
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full mx-auto" data-tour="ficha-ingredients-table">
        <CardHeader>
          <CardTitle>{t("nav_ingredientes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditMode && (
            <Button variant="outline" onClick={addNewIngredient} className="mb-4 bg-transparent">
              {t("ficha_tecnica_add_ingredient_button")}
            </Button>
          )}
          <div className="border rounded-md overflow-auto max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="text-center w-12">#</TableHead>
                  <TableHead className="text-center">{t("ficha_tecnica_col_category")}</TableHead>
                  <TableHead className="text-center">{t("nav_ingredientes")}</TableHead>
                  <TableHead className="text-center">{t("ficha_tecnica_col_quantity")}</TableHead>
                  <TableHead className="text-center">{t("ficha_tecnica_col_measure")}</TableHead>
                  <TableHead className="text-center">{t("ficha_tecnica_col_cost_per_measure")}</TableHead>
                  <TableHead className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-help">
                            {t("ficha_tecnica_col_extension")}
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("ficha_tecnica_extension_tooltip")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.ingredients.map((ingredient, index) => (
                  <TableRow key={ingredient.id}>
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell className="text-center">{ingredient.category || ""}</TableCell>
                    <TableCell>
                      {isEditMode ? (
                        <Popover
                          open={openPopovers[index]}
                          onOpenChange={(open) => handlePopoverOpenChange(index, open)}
                        >
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between bg-transparent">
                              <span className="truncate">{ingredient.name || t("ficha_tecnica_select_ingredient_placeholder")}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput
                                placeholder={t("ficha_tecnica_search_ingredient_placeholder")}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    const firstItem = document.querySelector("[cmdk-item]") as HTMLElement
                                    firstItem?.click()
                                  }
                                }}
                              />
                              <CommandList className="max-h-[300px]">
                                <CommandEmpty>{t("ficha_tecnica_no_ingredients_found")}</CommandEmpty>
                                <CommandGroup>
                                  {availableIngredients.map((ing) => (
                                    <CommandItem
                                      key={ing.id}
                                      value={ing.name}
                                      onSelect={() => updateIngredient(index, "ingredientId", ing.id)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          ingredient.ingredientId === ing.id ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      <div>
                                        <div className="font-medium">{ing.name}</div>
                                        <div className="text-xs text-muted-foreground">{ing.category}</div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="block text-center">{ingredient.name || ""}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditMode ? (
                        <span className="flex flex-col items-center gap-0.5">
                          <NumericInput
                            ref={(el) => {
                              if (el) {
                                const input = el.querySelector ? el.querySelector("input") : el
                                quantityInputRefs.current[index] = input as HTMLInputElement
                              }
                            }}
                            value={ingredient.quantity}
                            onChange={(value) => updateIngredient(index, "quantity", value)}
                            onKeyDown={(e) => handleQuantityKeyDown(e, index)}
                            className="w-20 mx-auto"
                            min={0}
                            allowDecimals
                            decimalPlaces={3}
                          />
                          {calculations.paxMultiplier !== 1 && ingredient.quantity > 0 && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              → {calculations.scaledIngredientQuantities[index]?.toFixed(1)} {t("ficha_tecnica_scaled_label")}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>
                          {ingredient.quantity > 0 ? (
                            calculations.paxMultiplier !== 1 ? (
                              <span className="flex flex-col items-center">
                                <span className="font-semibold">
                                  {calculations.scaledIngredientQuantities[index]?.toFixed(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({t("ficha_tecnica_base_label")}: {ingredient.quantity.toFixed(3)})
                                </span>
                              </span>
                            ) : (
                              ingredient.quantity.toFixed(3)
                            )
                          ) : (
                            ""
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{ingredient.measure || ""}</TableCell>
                    <TableCell className="text-center font-mono">
                      {ingredient.unitCost > 0 ? formatCurrency(ingredient.unitCost) : ""}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {(ingredient.extension ?? 0) > 0 ? formatCurrency(ingredient.extension ?? 0) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full mx-auto border-2">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t("ficha_tecnica_total_production_cost")}</h3>
            <p className="text-3xl font-bold">
              {calculations.productionCost > 0 ? formatCurrency(calculations.productionCost) : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full mx-auto">
        <CardHeader>
          <CardTitle>{t("ficha_tecnica_procedure_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditMode ? (
            <div className="space-y-2">
              {recipe.procedure.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-sm text-muted-foreground text-right">{index + 1}.</span>
                  <Input
                    ref={(el) => {
                      procedureInputRefs.current[index] = el
                    }}
                    value={step}
                    onChange={(e) => handleProcedureChange(index, e.target.value)}
                    onKeyDown={(e) => handleProcedureKeyDown(e, index)}
                    placeholder={index === 0 ? t("ficha_tecnica_procedure_placeholder") : ""}
                  />
                </div>
              ))}
            </div>
          ) : recipe.procedure.filter((s) => s.trim() !== "").length > 0 ? (
            <ol className="space-y-1.5">
              {recipe.procedure
                .filter((s) => s.trim() !== "")
                .map((step, index) => (
                  <li key={index} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t("ficha_tecnica_no_procedure")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="w-full mx-auto" data-tour="ficha-pricing">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("tour_ficha_pricing_title")}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowCalculationInfo(true)}>
                <Calculator className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
              <Dialog open={showPriceSettings} onOpenChange={setShowPriceSettings}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("ficha_tecnica_percentage_settings_title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="publicServices-setting">{t("ficha_tecnica_field_public_services")}</Label>
                    <NumericInput
                      id="publicServices-setting"
                      value={publicServices}
                      onChange={(value) => setPublicServices(value)}
                      placeholder="10"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marketing-setting">{t("ficha_tecnica_field_marketing")}</Label>
                    <NumericInput
                      id="marketing-setting"
                      value={marketing}
                      onChange={(value) => setMarketing(value)}
                      placeholder="10"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="operationalCosts-setting">{t("ficha_tecnica_field_operational_costs")}</Label>
                    <NumericInput
                      id="operationalCosts-setting"
                      value={operationalCosts}
                      onChange={(value) => setOperationalCosts(value)}
                      placeholder="30"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="laborCosts-setting">{t("ficha_tecnica_field_labor_costs")}</Label>
                    <NumericInput
                      id="laborCosts-setting"
                      value={laborCosts}
                      onChange={(value) => setLaborCosts(value)}
                      placeholder="35"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="isv-setting">{t("ficha_tecnica_field_isv")}</Label>
                    <NumericInput
                      id="isv-setting"
                      value={isv}
                      onChange={(value) => setIsv(value)}
                      placeholder="0"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contributionMargin-setting">{t("ficha_tecnica_field_net_profit")}</Label>
                    <NumericInput
                      id="contributionMargin-setting"
                      value={contributionMargin}
                      onChange={(value) => setContributionMargin(value)}
                      placeholder="25"
                      decimalPlaces={2}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <Label htmlFor="pricingMethod" className="font-semibold">
                  {t("ficha_tecnica_pricing_method_label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("ficha_tecnica_pricing_method_desc")}
                </p>
              </div>
              {isEditMode ? (
                <Select value={pricingMethod} onValueChange={handlePricingMethodChange}>
                  <SelectTrigger id="pricingMethod" className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gastrometrics">{t("ficha_tecnica_pricing_method_gastrometrics")}</SelectItem>
                    <SelectItem value="food_cost">{t("ficha_tecnica_pricing_method_food_cost")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm font-medium">
                  {pricingMethod === "food_cost" ? t("ficha_tecnica_pricing_method_food_cost") : t("ficha_tecnica_pricing_method_gastrometrics")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? t("ficha_tecnica_pricing_method_saved_hint")
                : ""}
            </p>
          </div>

          {pricingMethod === "food_cost" ? (
            // Food Cost %: el precio sale directo del costo unitario y el % objetivo — no
            // hay rubros que sumar, así que se reemplaza por completo el desglose de
            // GastroMetrics. Pedido explícito: mostrar solo uno de los dos sistemas a la vez.
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="targetFoodCostPercent" className="text-sm whitespace-nowrap">
                  {t("ficha_tecnica_field_target_food_cost")}
                </Label>
                {isEditMode ? (
                  <NumericInput
                    id="targetFoodCostPercent"
                    value={targetFoodCostPercent}
                    onChange={handleTargetFoodCostPercentChange}
                    className="w-24"
                    placeholder="30"
                    decimalPlaces={1}
                    min={1}
                    max={99}
                  />
                ) : (
                  <span className="text-sm font-medium">{targetFoodCostPercent}%</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {t("ficha_tecnica_target_food_cost_hint")}
                </span>
              </div>

              <div className="flex justify-between items-center border-b pb-2">
                <span>{t("ficha_tecnica_unit_production_cost_label")}</span>
                <span className="font-mono">
                  {calculations.unitCost > 0 ? formatCurrency(calculations.unitCost) : ""}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span>{t("ficha_tecnica_field_target_food_cost")}</span>
                <span className="font-mono">{targetFoodCostPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center pt-2 font-bold">
                <span>{t("ficha_tecnica_sale_price_formula_label")}</span>
                <span className="font-mono">
                  {calculations.foodCostPrice > 0 ? formatCurrency(calculations.foodCostPrice) : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label: t("ficha_tecnica_item_public_services"),
                  value: calculations.publicServicesAmount,
                  percentage: publicServices,
                },
                { label: t("ficha_tecnica_item_marketing"), value: calculations.marketingAmount, percentage: marketing },
                {
                  label: t("ficha_tecnica_item_operational_costs"),
                  value: calculations.operationalCostsAmount,
                  percentage: operationalCosts,
                },
                {
                  label: t("ficha_tecnica_item_labor_costs"),
                  value: calculations.laborCostsAmount,
                  percentage: laborCosts,
                },
                { label: t("ficha_tecnica_item_isv"), value: calculations.isvAmount, percentage: isv },
                {
                  label: t("ficha_tecnica_item_net_profit"),
                  value: calculations.netProfitAmount,
                  percentage: contributionMargin,
                },
                ...(calculations.fixedCostAmount > 0
                  ? [
                      {
                        label: t("ficha_tecnica_item_fixed_cost"),
                        value: calculations.fixedCostAmount,
                        percentage: calculations.fixedCostPercentage,
                      },
                    ]
                  : []),
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground">({item.percentage.toFixed(2)}%)</span>
                  </div>
                  <span className="font-mono">{item.value > 0 ? formatCurrency(item.value) : ""}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-bold">
                <span>{t("ficha_tecnica_total_label")}</span>
                <span className="font-mono">
                  {calculations.calculatedSalePrice > 0 ? formatCurrency(calculations.calculatedSalePrice) : ""}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full mx-auto" data-tour="ficha-summary">
        <CardHeader>
          <CardTitle>{t("tour_ficha_summary_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ficha_tecnica_col_production_cost")}</TableHead>
                <TableHead>{t("ficha_tecnica_field_yield")}</TableHead>
                <TableHead>{t("ficha_tecnica_col_unit_cost")}</TableHead>
                <TableHead>{t("ficha_tecnica_col_unit_profit")}</TableHead>
                <TableHead>{t("ficha_tecnica_col_unit_sale_price")}</TableHead>
                <TableHead>{t("ficha_tecnica_col_total_sale_price")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">
                  {calculations.productionCost > 0 ? formatCurrency(calculations.productionCost) : ""}
                </TableCell>
                <TableCell className="font-mono">
                  {calculations.yieldAmount > 0 ? Math.floor(calculations.yieldAmount) : ""}
                </TableCell>
                <TableCell className="font-mono">
                  {calculations.unitCost > 0 ? formatCurrency(calculations.unitCost) : ""}
                </TableCell>
                <TableCell>
                  {isEditMode && calculations.yieldAmount > 0 ? (
                    <Input
                      type="number"
                      value={customUnitProfitInput}
                      onChange={(e) => handleUnitProfitChange(e.target.value)}
                      onBlur={handleUnitProfitBlur}
                      placeholder={calculations.calculatedUnitProfit.toFixed(2)}
                      className="w-24 font-mono"
                      step="0.01"
                      min="0"
                    />
                  ) : calculations.unitProfit > 0 ? (
                    <span className="font-mono">{formatCurrency(calculations.unitProfit)}</span>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell>
                  {isEditMode ? (
                    <div className="space-y-1">
                      <Input
                        type="number"
                        value={customPriceInput}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        onBlur={handlePriceBlur}
                        placeholder={calculations.recommendedPrice.toFixed(2)}
                        className="w-24 font-mono"
                        step="0.01"
                        min="0"
                      />
                      {customPriceInput !== "" && (
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {t("ficha_tecnica_suggested_label")}: L{calculations.recommendedPrice.toFixed(2)}
                        </p>
                      )}
                    </div>
                  ) : calculations.finalPrice > 0 ? (
                    <span className="font-mono">L{calculations.finalPrice.toFixed(2)}</span>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {calculations.totalSales > 0 ? formatCurrency(calculations.totalSales) : ""}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-col sm:flex-row justify-between gap-4">
            <div className="w-full sm:w-1/2">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-bold">{t("ficha_tecnica_field_contribution_margin")}</TableCell>
                    <TableCell className="font-mono text-primary font-semibold">
                      {calculations.calculatedContributionMargin > 0
                        ? `${calculations.calculatedContributionMargin.toFixed(2)}%`
                        : ""}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="w-full sm:w-1/2">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-bold">{t("ficha_tecnica_net_profit_total_sales_label")}</TableCell>
                    <TableCell className="font-mono">
                      {calculations.netProfit > 0 ? formatCurrency(calculations.netProfit) : ""}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="mt-4 w-full sm:w-1/2">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold">{t("ficha_tecnica_food_cost_percent_label")}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {calculations.foodCostPercent > 0 ? `${calculations.foodCostPercent.toFixed(2)}%` : ""}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isEditMode && (
        <div className="flex justify-end w-full mx-auto" data-tour="ficha-save">
          <Button onClick={handleSaveRecipe} className="px-8">
            {t("ficha_tecnica_save_recipe_button")}
          </Button>
        </div>
      )}

      <CalculationInfoDialog
        open={showCalculationInfo}
        onOpenChange={setShowCalculationInfo}
        productionCost={calculations.productionCost}
        yieldAmount={calculations.yieldAmount}
        unitCost={calculations.unitCost}
        paxModifier={paxModifier}
        paxMultiplier={calculations.paxMultiplier}
        pricingMethod={pricingMethod}
        targetFoodCostPercent={targetFoodCostPercent}
        percentages={{ publicServices, marketing, operationalCosts, laborCosts, isv, contributionMargin }}
        amounts={{
          publicServicesAmount: calculations.publicServicesAmount,
          marketingAmount: calculations.marketingAmount,
          operationalCostsAmount: calculations.operationalCostsAmount,
          laborCostsAmount: calculations.laborCostsAmount,
          isvAmount: calculations.isvAmount,
          netProfitAmount: calculations.netProfitAmount,
        }}
        unitProfit={calculations.unitProfit}
        gastrometricsPrice={calculations.gastrometricsPrice}
        foodCostPrice={calculations.foodCostPrice}
        finalPrice={calculations.finalPrice}
        totalSales={calculations.totalSales}
        netProfit={calculations.netProfit}
        calculatedContributionMargin={calculations.calculatedContributionMargin}
        foodCostPercent={calculations.foodCostPercent}
      />
    </div>
  )
}
