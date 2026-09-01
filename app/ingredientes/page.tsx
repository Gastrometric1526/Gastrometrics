"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { hasFeatureAccess, useFeatureAccess } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Filter,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Tag,
  Upload,
  Download,
  FileSpreadsheet,
  Settings,
  Info,
  X,
  ChevronRight,
  Truck,
  Scale,
  Ruler,
  AlertCircle,
  Lock,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useNotification } from "@/hooks/use-notification"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { FileUpload } from "@/components/file-upload"
import { MermaManagementDialog } from "@/components/merma-management-dialog"
import type { Ingredient } from "@/types/ingredient"
import { categories, units, presentations } from "@/types/ingredient"
import { getIngredients, saveIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { parseExcelFile, createIngredientsExcelTemplate } from "@/lib/excel-utils"
import { IngredientsTable } from "@/components/ingredients/ingredients-table"
import { IngredientesTour } from "@/components/page-tours"
import { convertAllIngredientsToSystem } from "@/lib/utils/calculations"
import { updateIngredientPriceAndRecalculate } from "@/lib/recalculate"
import { ActivityTracker } from "@/lib/activity-tracker"

// Helper function for generating unique IDs
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9)

type Translator = ReturnType<typeof useLanguage>["t"]

// Sort options (traducidos en tiempo de render, ver getSortOptions más abajo)
const getSortOptions = (t: Translator) => [
  { value: "name", label: t("ingredientes_sort_name_asc") },
  { value: "name-desc", label: t("ingredientes_sort_name_desc") },
  { value: "cost", label: t("ingredientes_sort_cost_asc") },
  { value: "cost-desc", label: t("ingredientes_sort_cost_desc") },
  { value: "category", label: t("ingredientes_sort_category") },
  { value: "supplier", label: t("ingredientes_sort_supplier") },
  { value: "recent", label: t("ingredientes_sort_recent") },
]

// Form steps for ingredient wizard (traducidos en tiempo de render, ver getFormSteps más abajo)
const getFormSteps = (t: Translator) => [
  { id: "basic", title: t("ingredientes_step_basic_title"), icon: Package },
  { id: "pricing", title: t("ingredientes_step_pricing_title"), icon: DollarSign },
  { id: "supplier", title: t("ingredientes_step_supplier_title"), icon: Truck },
  { id: "additional", title: t("ingredientes_step_additional_title"), icon: Info },
]

// Columnas que el sistema pide vía Excel: solo estas 4. Categoría, presentación,
// proveedor y notas se llenan después en la tabla con opciones seleccionables.
const EXCEL_COLUMN_MAPPINGS = {
  name: ["nombre", "name", "ingrediente", "producto", "item"],
  unit: ["unidad", "unit", "medida", "u"],
  price: ["precio", "price", "costo", "valor", "importe"],
  content: ["contenido", "content", "cantidad", "peso", "volumen", "neto"],
  category: ["categoria", "category", "rubro", "clasificacion"],
  supplier: ["proveedor", "supplier", "vendor"],
}

// Sin tildes/diéresis y en mayúsculas, para comparar sin importar cómo haya escrito
// el usuario la categoría en el Excel ("Lácteos y derivados"=="LACTEOS Y DERIVADOS").
const stripAccents = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()

/**
 * Empareja la categoría que venga en el Excel importado contra las categorías reales
 * que ya ofrece la base de datos (types/ingredient.ts, `categories`) — sin importar
 * tildes, mayúsculas/minúsculas, o espacios extra. Si no hay ninguna coincidencia,
 * cae a"OTROS"en vez de fallar la fila completa.
 */
const normalizeCategory = (value: string): (typeof categories)[number] => {
  if (!value) return "OTROS"
  const normalizedValue = stripAccents(value)
  const match = categories.find((cat) => stripAccents(cat) === normalizedValue)
  if (match) return match

  // Coincidencia parcial como último recurso (ej."Lacteos"sin"y derivados").
  const partial = categories.find(
    (cat) => stripAccents(cat).includes(normalizedValue) || normalizedValue.includes(stripAccents(cat)),
  )
  return partial || "OTROS"
}

// Function to find matching column
const findMatchingColumn = (headers: string[], possibleNames: string[]): string | null => {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim())

  for (const possibleName of possibleNames) {
    const found = normalizedHeaders.find(
      (header) => header.includes(possibleName.toLowerCase()) || possibleName.toLowerCase().includes(header),
    )
    if (found) {
      return headers[normalizedHeaders.indexOf(found)]
    }
  }
  return null
}

// Function to normalize unit values
const normalizeUnit = (value: string): string => {
  if (!value) return "gramos"

  const normalized = value.toLowerCase().trim()

  // Map common variations to standard units
  const unitMappings: { [key: string]: string } = {
    g: "gramos",
    gr: "gramos",
    gram: "gramos",
    gramo: "gramos",
    kg: "kilogramos",
    kilo: "kilogramos",
    kilogramo: "kilogramos",
    ml: "mililitros",
    mililitro: "mililitros",
    l: "litros",
    lt: "litros",
    litro: "litros",
    oz: "onzas",
    onza: "onzas",
    lb: "libras",
    libra: "libras",
    taza: "tazas",
    cup: "tazas",
    cdta: "cucharaditas",
    cucharadita: "cucharaditas",
    tsp: "cucharaditas",
    cda: "cucharadas",
    cucharada: "cucharadas",
    tbsp: "cucharadas",
    pza: "unidad",
    pieza: "unidad",
    u: "unidad",
    ud: "unidad",
    unit: "unidad",
  }

  // Check if it's already a valid unit
  if (units.includes(normalized as any)) {
    return normalized
  }

  // Try to find a mapping
  for (const [key, value] of Object.entries(unitMappings)) {
    if (normalized === key || normalized.includes(key)) {
      return value
    }
  }

  return "gramos"
}

export default function IngredientesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const { isLoggedIn, authChecked } = useAuth()
  const canAccessMerma = useFeatureAccess("merma")
  const canAccessIngredients = useFeatureAccess("ingredients")
  const { showSuccess, showError, showInfo } = useNotification()
  const { t } = useLanguage()

  const sortOptions = useMemo(() => getSortOptions(t), [t])
  const FORM_STEPS = useMemo(() => getFormSteps(t), [t])

  // State management
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Todas")
  const [sortBy, setSortBy] = useState("name")

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showMermaDialog, setShowMermaDialog] = useState(false)
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null)
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null)

  // Form wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: "",
    category: "OTROS",
    unit: "gramos",
    presentation: "Bolsa",
    pricing: {
      purchasePrice: 0,
      netContent: 1,
      pricePerUnit: 0,
      lastUpdated: new Date().toISOString(),
    },
    supplier: "",
    notes: "",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  })

  // Flujo de avance automático con Enter en el paso 1 del asistente (mismo patrón
  // que Ficha Técnica): Nombre -> Categoría -> Unidad -> Presentación, para no
  // obligar al usuario a tocar el mouse en cada campo. 200ms de espera antes de
  // enfocar el siguiente campo porque el Select de Radix devuelve el foco a su
  // propio trigger como parte de su animación de cierre (~150ms).
  const ingredientNameInputRef = useRef<HTMLInputElement>(null)
  const ingredientCategoryTriggerRef = useRef<HTMLButtonElement>(null)
  const ingredientUnitTriggerRef = useRef<HTMLButtonElement>(null)
  const ingredientPresentationTriggerRef = useRef<HTMLButtonElement>(null)
  const [ingredientCategoryOpen, setIngredientCategoryOpen] = useState(false)
  const [ingredientUnitOpen, setIngredientUnitOpen] = useState(false)
  const [ingredientPresentationOpen, setIngredientPresentationOpen] = useState(false)
  const FIELD_ADVANCE_DELAY_MS = 200

  const focusAndOpenIngredientCategory = useCallback(() => {
    setTimeout(() => {
      ingredientCategoryTriggerRef.current?.focus()
      setIngredientCategoryOpen(true)
    }, FIELD_ADVANCE_DELAY_MS)
  }, [])

  const focusAndOpenIngredientUnit = useCallback(() => {
    setTimeout(() => {
      ingredientUnitTriggerRef.current?.focus()
      setIngredientUnitOpen(true)
    }, FIELD_ADVANCE_DELAY_MS)
  }, [])

  const focusAndOpenIngredientPresentation = useCallback(() => {
    setTimeout(() => {
      ingredientPresentationTriggerRef.current?.focus()
      setIngredientPresentationOpen(true)
    }, FIELD_ADVANCE_DELAY_MS)
  }, [])

  const handleIngredientNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        focusAndOpenIngredientCategory()
      }
    },
    [focusAndOpenIngredientCategory],
  )

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)

  const [activeSystem, setActiveSystem] = useState<"metric" | "imperial" | "mixed" | null>(null)

  // Load ingredients
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        setIsLoading(true)
        await ensureIngredientsLoaded(businessId)
        const savedIngredients = getIngredients(businessId)
        setIngredients(savedIngredients)
      } catch (error) {
        console.error("Error loading ingredients:", error)
        showError(t("ingredientes_toast_load_error_title"), t("ingredientes_toast_load_error_desc"))
      } finally {
        setIsLoading(false)
      }
    }

    loadIngredients()

    // Listen for ingredient updates
    const handleIngredientsUpdate = (event: CustomEvent) => {
      if (event.detail.businessId === (businessId || "main")) {
        loadIngredients()
      }
    }

    window.addEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
    return () => window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
  }, [businessId, showError, t])

  const detectActiveSystem = useCallback(() => {
    if (ingredients.length === 0) {
      setActiveSystem(null)
      return
    }

    const metricUnits = ["gramos", "kilogramos", "mililitros", "litros"]
    const imperialUnits = ["onzas", "libras", "onzas fluidas", "onzas líquidas", "galones"]

    let metricCount = 0
    let imperialCount = 0
    let unitCount = 0

    ingredients.forEach((ingredient) => {
      if (ingredient.unit === "unidad") {
        unitCount++
      } else if (metricUnits.includes(ingredient.unit)) {
        metricCount++
      } else if (imperialUnits.includes(ingredient.unit)) {
        imperialCount++
      }
    })

    const totalCountableIngredients = metricCount + imperialCount

    if (totalCountableIngredients === 0) {
      setActiveSystem(null)
    } else if (metricCount > 0 && imperialCount === 0) {
      setActiveSystem("metric")
    } else if (imperialCount > 0 && metricCount === 0) {
      setActiveSystem("imperial")
    } else {
      setActiveSystem("mixed")
    }
  }, [ingredients])

  useEffect(() => {
    detectActiveSystem()
  }, [ingredients, detectActiveSystem])

  // Filter and sort ingredients
  const filteredAndSortedIngredients = useMemo(() => {
    let filtered = ingredients

    // Apply search filter
    if (searchQuery.length >= 2) {
      filtered = filtered.filter(
        (ingredient) =>
          ingredient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ingredient.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ingredient.supplier?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply category filter
    if (selectedCategory !== "Todas") {
      filtered = filtered.filter((ingredient) => ingredient.category === selectedCategory)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "cost":
          return (a.pricing?.pricePerUnit || 0) - (b.pricing?.pricePerUnit || 0)
        case "cost-desc":
          return (b.pricing?.pricePerUnit || 0) - (a.pricing?.pricePerUnit || 0)
        case "category":
          return a.category.localeCompare(b.category)
        case "supplier":
          return (a.supplier || "").localeCompare(b.supplier || "")
        case "recent":
          return new Date(b.metadata?.updatedAt || 0).getTime() - new Date(a.metadata?.updatedAt || 0).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [ingredients, searchQuery, selectedCategory, sortBy])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalIngredients = ingredients.length
    const subRecipes = ingredients.filter((i) => i.category === "Sub Receta / produccion (Mise en place)").length
    const avgCost =
      ingredients.length > 0
        ? ingredients.reduce((sum, i) => sum + (i.pricing?.pricePerUnit || 0), 0) / ingredients.length
        : 0
    const categoriesCount = [...new Set(ingredients.map((i) => i.category))].length
    const totalValue = ingredients.reduce((sum, i) => sum + (i.pricing?.purchasePrice || 0), 0)

    return { totalIngredients, subRecipes, avgCost, categories: categoriesCount, totalValue }
  }, [ingredients])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const excelFile = files.find(
        (file) =>
          file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.type === "application/vnd.ms-excel" ||
          file.name.endsWith(".xlsx") ||
          file.name.endsWith(".xls"),
      )

      if (excelFile) {
        setImportFile(excelFile)
        setShowImportDialog(true)
        processImportFile(excelFile)
      } else {
        showError(t("ingredientes_toast_invalid_file_title"), t("ingredientes_toast_invalid_file_desc"))
      }
    },
    [showError, t],
  )

  // Process import file
  const processImportFile = async (file: File) => {
    try {
      const data = await parseExcelFile(file)
      setImportPreview(data.slice(0, 10)) // Show first 10 rows as preview
      showInfo(
        t("ingredientes_toast_file_processed_title"),
        t("ingredientes_toast_file_processed_desc").replace("{count}", String(data.length)),
      )
    } catch (error) {
      console.error("Error processing file:", error)
      showError(t("ingredientes_toast_process_error_title"), t("ingredientes_toast_process_error_desc"))
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      // Columnas y desplegable de Categoría restringido a las categorías reales de la
      // base de datos (categories, importado de types/ingredient.ts) — ver
      // createIngredientsExcelTemplate para el detalle completo.
      const blob = await createIngredientsExcelTemplate(categories, units)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "plantilla-ingredientes-gastrometrics.xlsx"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSuccess(t("ingredientes_toast_template_downloaded_title"), t("ingredientes_toast_template_downloaded_desc"))
    } catch (error) {
      console.error("Error downloading template:", error)
      showError(
        t("ingredientes_toast_template_download_error_title"),
        t("ingredientes_toast_template_download_error_desc"),
      )
    }
  }

  // Enhanced import function with better column mapping
  const handleImport = async () => {
    if (!importFile) return

    setIsImporting(true)
    setImportProgress(0)

    try {
      const data = await parseExcelFile(importFile)
      const totalRows = data.length
      let importedCount = 0
      let errorCount = 0
      const newIngredients: Ingredient[] = []

      if (data.length === 0) {
        throw new Error(t("ingredientes_error_no_valid_data"))
      }

      // Get headers from first row to map columns intelligently
      const headers = Object.keys(data[0])
      console.log("Excel headers found:", headers)

      // Map columns intelligently
      const columnMap = {
        name: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.name),
        unit: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.unit),
        price: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.price),
        content: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.content),
        category: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.category),
        supplier: findMatchingColumn(headers, EXCEL_COLUMN_MAPPINGS.supplier),
      }

      console.log("Column mapping:", columnMap)

      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        setImportProgress((i / totalRows) * 100)

        try {
          // Extract data using intelligent column mapping
          const name = columnMap.name ? (row[columnMap.name] || "").toString().trim() : ""
          const unitRaw = columnMap.unit ? (row[columnMap.unit] || "").toString().trim() : ""
          const priceRaw = columnMap.price ? row[columnMap.price] : 0
          const contentRaw = columnMap.content ? row[columnMap.content] : 1
          const categoryRaw = columnMap.category ? (row[columnMap.category] || "").toString().trim() : ""
          const supplierRaw = columnMap.supplier ? (row[columnMap.supplier] || "").toString().trim() : ""

          // Skip empty rows
          if (!name && !priceRaw) {
            continue
          }

          // Validate and normalize data
          const ingredientName = name || `Ingrediente ${i + 1}`
          const unit = normalizeUnit(unitRaw)
          // La categoría del Excel se compara contra las categorías reales que ya
          // ofrece la base de datos (sin importar tildes/mayúsculas) — si la fila no
          // trae categoría, o no coincide con ninguna, cae a"OTROS"(editable después
          // desde el selector de la tabla, igual que antes).
          const category = normalizeCategory(categoryRaw)
          const presentation = undefined

          const purchasePrice = Number(priceRaw) || 0
          const netContent = Number(contentRaw) || 1

          // Validate required fields
          if (purchasePrice <= 0) {
            console.warn(`Row ${i + 1}: Invalid price (${priceRaw}), skipping`)
            errorCount++
            continue
          }

          if (netContent <= 0) {
            console.warn(`Row ${i + 1}: Invalid content (${contentRaw}), skipping`)
            errorCount++
            continue
          }

          const newIngredient: Ingredient = {
            id: generateUniqueId(),
            name: ingredientName,
            category: category as any,
            unit: unit as any,
            presentation: presentation,
            pricing: {
              purchasePrice,
              netContent,
              pricePerUnit: purchasePrice / netContent,
              lastUpdated: new Date().toISOString(),
            },
            supplier: supplierRaw || "Proveedor General",
            notes: "",
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
          }

          // Check if ingredient already exists (by name)
          const existingIngredient = ingredients.find(
            (ing) => ing.name.toLowerCase() === newIngredient.name.toLowerCase(),
          )

          if (!existingIngredient) {
            newIngredients.push(newIngredient)
            importedCount++
          } else {
            console.log(`Ingredient"${newIngredient.name}"already exists, skipping`)
          }
        } catch (rowError) {
          console.error(`Error processing row ${i + 1}:`, rowError)
          errorCount++
        }

        // Small delay to show progress
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      setImportProgress(100)

      // Update state immediately
      const updatedIngredients = [...ingredients, ...newIngredients]
      setIngredients(updatedIngredients)

      saveIngredients(updatedIngredients, businessId)

      // Trigger update event for other components
      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: {
            businessId: businessId || "main",
            action: "import",
            count: importedCount,
          },
        }),
      )

      // Track activity for dashboard
      if (typeof window !== "undefined") {
        ActivityTracker.addActivity(
          t("ingredientes_activity_bulk_import").replace("{count}", String(importedCount)),
          "ingredient",
          businessId || undefined,
          { importedCount, errorCount, fileName: importFile.name },
        )

        ActivityTracker.addAlert(
          "success",
          t("ingredientes_toast_import_success_title"),
          t("ingredientes_activity_import_success_desc")
            .replace("{count}", String(importedCount))
            .replace("{fileName}", importFile.name),
          businessId || undefined,
        )
      }

      const message =
        errorCount > 0
          ? t("ingredientes_toast_import_success_with_errors")
              .replace("{count}", String(importedCount))
              .replace("{errorCount}", String(errorCount))
          : t("ingredientes_toast_import_success_desc").replace("{count}", String(importedCount))

      showSuccess(t("ingredientes_toast_import_success_title"), message)

      setShowImportDialog(false)
      setImportFile(null)
      setImportPreview([])
    } catch (error) {
      console.error("Error importing:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      showError(
        t("ingredientes_toast_import_error_title"),
        t("ingredientes_toast_import_error_desc").replace("{message}", errorMessage),
      )

      // Track error activity
      if (typeof window !== "undefined") {
        ActivityTracker.addActivity(
          t("ingredientes_activity_import_error").replace("{fileName}", importFile?.name || ""),
          "ingredient",
          businessId || undefined,
          { error: errorMessage },
        )

        ActivityTracker.addAlert(
          "error",
          t("ingredientes_alert_import_error_title"),
          t("ingredientes_alert_import_error_desc").replace("{fileName}", importFile?.name || ""),
          businessId || undefined,
        )
      }
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  // Handle form navigation
  const nextStep = () => {
    if (currentStep < FORM_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Validate current step
  const isStepValid = () => {
    switch (currentStep) {
      case 0: // Basic info
        return formData.name?.trim() && formData.category && formData.unit
      case 1: // Pricing
        return (
          formData.pricing?.purchasePrice !== undefined &&
          formData.pricing?.netContent !== undefined &&
          formData.pricing.purchasePrice > 0 &&
          formData.pricing.netContent > 0
        )
      case 2: // Supplier
        return true // Optional step
      case 3: // Additional
        return true // Optional step
      default:
        return false
    }
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!isStepValid()) {
      showError(t("ingredientes_toast_incomplete_title"), t("ingredientes_toast_incomplete_desc"))
      return
    }

    try {
      const currentTimestamp = new Date().toISOString()

      // Calculate price per unit
      const pricePerUnit = (formData.pricing?.purchasePrice || 0) / (formData.pricing?.netContent || 1)

      const ingredientData: Ingredient = {
        ...formData,
        pricing: {
          ...formData.pricing!,
          pricePerUnit,
          lastUpdated: currentTimestamp,
        },
        metadata: {
          ...formData.metadata!,
          updatedAt: currentTimestamp,
        },
      } as Ingredient

      if (ingredientToEdit) {
        // Detectar si el precio de compra cambió, para preguntar antes de
        // recalcular en cascada las recetas afectadas (lib/recalculate.ts
        // ya tenía esta lógica escrita, pero ninguna pantalla la llamaba).
        const oldPurchasePrice = ingredientToEdit.pricing?.purchasePrice || 0
        const newPurchasePrice = ingredientData.pricing?.purchasePrice || 0
        const priceChanged = oldPurchasePrice !== newPurchasePrice

        // Update existing ingredient
        const updatedIngredients = ingredients.map((ing) =>
          ing.id === ingredientToEdit.id ? { ...ingredientData, id: ingredientToEdit.id } : ing,
        )

        setIngredients(updatedIngredients)
        saveIngredients(updatedIngredients, businessId)

        if (priceChanged) {
          const confirmRecalculate = window.confirm(
            t("ingredientes_confirm_price_changed")
              .replace("{old}", formatCurrency(oldPurchasePrice))
              .replace("{new}", formatCurrency(newPurchasePrice)),
          )

          if (confirmRecalculate) {
            try {
              const result = await updateIngredientPriceAndRecalculate(
                businessId || "main",
                ingredientToEdit.id,
                newPurchasePrice,
              )
              if (result.affectedRecipes.length > 0) {
                showSuccess(
                  t("ingredientes_toast_recipes_recalculated_title"),
                  t("ingredientes_toast_recipes_recalculated_desc").replace(
                    "{count}",
                    String(result.affectedRecipes.length),
                  ),
                )
              }
            } catch (error) {
              console.error("Error al recalcular recetas afectadas:", error)
              showError(t("ingredientes_toast_recalc_error_title"), t("ingredientes_toast_recalc_error_desc"))
            }
          }
        }

        window.dispatchEvent(
          new CustomEvent("ingredientsUpdated", {
            detail: {
              businessId: businessId || "main",
              action: "update",
              ingredientId: ingredientToEdit.id,
            },
          }),
        )

        // Track activity
        if (typeof window !== "undefined") {
          ActivityTracker.addActivity(
            t("ingredientes_activity_updated").replace("{name}", ingredientData.name),
            "ingredient",
            businessId || undefined,
            { action: "update", ingredientId: ingredientToEdit.id },
          )
        }

        showSuccess(t("ingredientes_toast_updated_title"), t("ingredientes_toast_updated_desc"))
        setShowEditDialog(false)
        setIngredientToEdit(null)
      } else {
        // Add new ingredient
        const newIngredient: Ingredient = {
          ...ingredientData,
          id: generateUniqueId(),
          metadata: {
            ...ingredientData.metadata!,
            createdAt: currentTimestamp,
          },
        }

        const updatedIngredients = [...ingredients, newIngredient]
        setIngredients(updatedIngredients)
        saveIngredients(updatedIngredients, businessId)

        window.dispatchEvent(
          new CustomEvent("ingredientsUpdated", {
            detail: {
              businessId: businessId || "main",
              action: "create",
              ingredientId: newIngredient.id,
            },
          }),
        )

        // Track activity
        if (typeof window !== "undefined") {
          ActivityTracker.addActivity(
            t("ingredientes_activity_created").replace("{name}", newIngredient.name),
            "ingredient",
            businessId || undefined,
            { action: "create", ingredientId: newIngredient.id },
          )
        }

        showSuccess(t("ingredientes_toast_created_title"), t("ingredientes_toast_created_desc"))
        setShowAddDialog(false)
      }

      // Reset form
      resetForm()
    } catch (error) {
      console.error("Error saving ingredient:", error)
      showError(t("ingredientes_toast_save_error_title"), t("ingredientes_toast_save_error_desc"))
    }
  }

  // Reset form
  const resetForm = () => {
    setCurrentStep(0)
    setFormData({
      name: "",
      category: "OTROS",
      unit: "gramos",
      presentation: "Bolsa",
      pricing: {
        purchasePrice: 0,
        netContent: 1,
        pricePerUnit: 0,
        lastUpdated: new Date().toISOString(),
      },
      supplier: "",
      notes: "",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    })
  }

  // Handle edit
  const handleEdit = (ingredient: Ingredient) => {
    setIngredientToEdit(ingredient)
    setFormData(ingredient)
    setCurrentStep(0)
    setShowEditDialog(true)
  }

  // Handle delete - PERMITIR ELIMINAR INGREDIENTES DE SUB-RECETAS
  const handleDelete = (ingredient: Ingredient) => {
    setIngredientToDelete(ingredient)
    setShowDeleteDialog(true)
  }

  // Confirm delete - PERMITIR ELIMINAR INGREDIENTES DE SUB-RECETAS
  const confirmDelete = () => {
    if (!ingredientToDelete) return

    try {
      const updatedIngredients = ingredients.filter((ing) => ing.id !== ingredientToDelete.id)
      setIngredients(updatedIngredients)
      saveIngredients(updatedIngredients, businessId)

      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: {
            businessId: businessId || "main",
            action: "delete",
            ingredientId: ingredientToDelete.id,
          },
        }),
      )

      // Track activity
      if (typeof window !== "undefined") {
        ActivityTracker.addActivity(
          t("ingredientes_activity_deleted").replace("{name}", ingredientToDelete.name),
          "ingredient",
          businessId || undefined,
          { action: "delete", ingredientId: ingredientToDelete.id },
        )
      }

      showSuccess(t("ingredientes_toast_deleted_title"), t("ingredientes_toast_deleted_desc"))
      setShowDeleteDialog(false)
      setIngredientToDelete(null)
    } catch (error) {
      console.error("Error deleting ingredient:", error)
      showError(t("ingredientes_toast_delete_error_title"), t("ingredientes_toast_delete_error_desc"))
    }
  }

  // Export ingredients
  const handleExport = () => {
    try {
      const exportData = ingredients.map((ing) => ({
        [t("ingredientes_export_col_name")]: ing.name,
        [t("ingredientes_export_col_category")]: ing.category,
        [t("ingredientes_export_col_unit")]: ing.unit,
        [t("ingredientes_export_col_presentation")]: ing.presentation,
        [t("ingredientes_col_purchase_price")]: ing.pricing?.purchasePrice || 0,
        [t("ingredientes_col_net_content")]: ing.pricing?.netContent || 0,
        [t("ingredientes_col_price_per_unit")]: ing.pricing?.pricePerUnit || 0,
        [t("ingredientes_col_supplier")]: ing.supplier || "",
        [t("ingredientes_export_col_notes")]: ing.notes || "",
        [t("ingredientes_export_col_created_at")]: ing.metadata?.createdAt || "",
        [t("ingredientes_export_col_updated_at")]: ing.metadata?.updatedAt || "",
      }))

      const csvContent = [
        Object.keys(exportData[0]).join(","),
        ...exportData.map((row) => Object.values(row).join(",")),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ingredientes_${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      showSuccess(t("ingredientes_toast_export_success_title"), t("ingredientes_toast_export_success_desc"))
    } catch (error) {
      console.error("Error exporting:", error)
      showError(t("ingredientes_toast_export_error_title"), t("ingredientes_toast_export_error_desc"))
    }
  }

  const handleMermaSave = (updatedIngredients: Ingredient[]) => {
    // Actualizar el estado local inmediatamente
    setIngredients(updatedIngredients)

    // Asegurar que los datos se guarden en la base de datos
    saveIngredients(updatedIngredients, businessId)

    // Mostrar confirmación
    showSuccess(t("ingredientes_toast_merma_updated_title"), t("ingredientes_toast_merma_updated_desc"))

    setTimeout(() => {
      // Trigger a re-render by updating the state again
      const currentData = getIngredients(businessId)
      if (currentData) {
        setIngredients([...currentData])
      }
    }, 100)
  }

  useEffect(() => {
    const handleIngredientsUpdate = (event: CustomEvent) => {
      if (event.detail.businessId === (businessId || "main") && event.detail.action === "merma-update") {
        // Actualizar con los datos del evento
        if (event.detail.data) {
          setIngredients([...event.detail.data])
        } else {
          const currentData = getIngredients(businessId)
          if (currentData) {
            setIngredients([...currentData])
          }
        }
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)

      return () => {
        window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
      }
    }
  }, [businessId])

  const convertToMetric = useCallback(() => {
    try {
      console.log("Iniciando conversión a métrico...")
      const updatedIngredients = convertAllIngredientsToSystem(ingredients, "metric")
      console.log("Ingredientes convertidos:", updatedIngredients)

      // Forzar actualización del estado
      setIngredients([...updatedIngredients])

      saveIngredients(updatedIngredients, businessId)

      // Actualizar el sistema activo
      setActiveSystem("metric")

      // Mostrar notificación de éxito
      showSuccess(t("ingredientes_toast_converted_metric").replace("{count}", String(updatedIngredients.length)))

      // Disparar evento para sincronizar con otros componentes
      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: { businessId: businessId || "main", data: updatedIngredients, action: "unit-conversion" },
        }),
      )

      // Forzar re-render después de un breve delay
      setTimeout(() => {
        const currentData = getIngredients(businessId)
        if (currentData) {
          setIngredients([...currentData])
        }
      }, 100)
    } catch (error) {
      console.error("Error al convertir a métrico:", error)
      showError(t("ingredientes_toast_convert_metric_error"))
    }
  }, [ingredients, businessId, showSuccess, showError, t])

  const convertToImperial = useCallback(() => {
    try {
      console.log("Iniciando conversión a imperial...")
      const updatedIngredients = convertAllIngredientsToSystem(ingredients, "imperial")
      console.log("Ingredientes convertidos:", updatedIngredients)

      // Forzar actualización del estado
      setIngredients([...updatedIngredients])

      saveIngredients(updatedIngredients, businessId)

      // Actualizar el sistema activo
      setActiveSystem("imperial")

      // Mostrar notificación de éxito
      showSuccess(t("ingredientes_toast_converted_imperial").replace("{count}", String(updatedIngredients.length)))

      // Disparar evento para sincronizar con otros componentes
      window.dispatchEvent(
        new CustomEvent("ingredientsUpdated", {
          detail: { businessId: businessId || "main", data: updatedIngredients, action: "unit-conversion" },
        }),
      )

      // Forzar re-render después de un breve delay
      setTimeout(() => {
        const currentData = getIngredients(businessId)
        if (currentData) {
          setIngredients([...currentData])
        }
      }, 100)
    } catch (error) {
      console.error("Error al convertir a imperial:", error)
      showError(t("ingredientes_toast_convert_imperial_error"))
    }
  }, [ingredients, businessId, showSuccess, showError, t])

  const handleMassUnitConversion = useCallback(
    (targetSystem: "metric" | "imperial") => {
      const updatedIngredients = convertAllIngredientsToSystem(ingredients, targetSystem)

      setIngredients(updatedIngredients)
      saveIngredients(updatedIngredients, businessId)

      setActiveSystem(targetSystem)

      // Disparar evento de actualización
      if (typeof window !== "undefined") {
        const event = new CustomEvent("ingredientsUpdated", {
          detail: {
            businessId: businessId || "main",
            action: "mass_unit_conversion",
            targetSystem,
          },
        })
        window.dispatchEvent(event)
      }

      const systemName =
        targetSystem === "metric" ? t("ingredientes_system_metric_name") : t("ingredientes_system_imperial_name")
      const baseUnits =
        targetSystem === "metric" ? t("ingredientes_units_metric_base") : t("ingredientes_units_imperial_base")

      showSuccess(
        t("ingredientes_toast_mass_conversion_title").replace("{system}", systemName),
        t("ingredientes_toast_mass_conversion_desc")
          .replace("{count}", String(updatedIngredients.length))
          .replace("{units}", baseUnits),
      )
    },
    [ingredients, businessId, showSuccess, t],
  )

  if (!authChecked) {
    return null
  }

  if (!isLoggedIn) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>{t("ingredientes_please_login")}</p>
      </div>
    )
  }

  if (canAccessIngredients === null) {
    return null
  }

  if (!canAccessIngredients) {
    return <AdminRestrictedPage sectionName="Ingredientes" />
  }

  return (
    <div
      className="flex min-h-screen bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <IngredientesTour />
          {/* Drag overlay */}
          {isDragOver && (
            <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-card p-8 rounded-xl border-2 border-dashed border-primary">
                <div className="text-center">
                  <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{t("ingredientes_drag_drop_title")}</h3>
                  <p className="text-muted-foreground">{t("ingredientes_drag_drop_desc")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Header Section */}
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                <div data-tour="ing-header">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    {t("ingredientes_page_title")}
                  </h1>
                  <p className="text-sm md:text-base text-muted-foreground">{t("ingredientes_page_subtitle")}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                {ingredients.some((ing) => ing.merma?.enabled) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-success-soft border rounded-md">
                    <div className="w-2 h-2 bg-success-soft0 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-success">
                      {t("ingredientes_merma_system_active_badge")}
                    </span>
                  </div>
                )}

                <Button
                  data-tour="ing-new"
                  onClick={() => setShowAddDialog(true)}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {t("ingredientes_new_ingredient_button")}
                </Button>
                <Button
                  data-tour="ing-import"
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                  className="gap-2 hover:bg-accent hover:text-accent-foreground border-border"
                >
                  <Upload className="h-4 w-4" />
                  {t("ingredientes_import_excel_button")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2 hover:bg-accent hover:text-accent-foreground border-border bg-transparent"
                  disabled={ingredients.length === 0}
                >
                  <Download className="h-4 w-4" />
                  {t("common_export")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    hasFeatureAccess("merma")
                      ? setShowMermaDialog(true)
                      : showInfo(t("ingredientes_merma_locked_title"), t("ingredientes_merma_locked_desc"))
                  }
                  className="gap-2 hover:bg-accent hover:text-accent-foreground border-border"
                  disabled={ingredients.length === 0}
                >
                  <Settings className="h-4 w-4" />
                  {t("ingredientes_manage_merma_button")}
                  {canAccessMerma === false && <Lock className="h-3.5 w-3.5 opacity-60" />}
                </Button>
              </div>
            </div>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-border transition-all duration-300 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.totalIngredients}</p>
                      <p className="text-sm text-muted-foreground">{t("ingredientes_stat_total")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border transition-all duration-300 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success-soft rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.subRecipes}</p>
                      <p className="text-sm text-muted-foreground">{t("ingredientes_stat_subrecipes")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border transition-all duration-300 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning-soft dark:bg-amber-950/40 rounded-lg">
                      <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.avgCost)}</p>
                      <p className="text-sm text-muted-foreground">{t("ingredientes_stat_avg_cost")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border transition-all duration-300 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg">
                      <Tag className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.categories}</p>
                      <p className="text-sm text-muted-foreground">{t("ingredientes_stat_categories")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border transition-all duration-300 bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-danger-soft rounded-lg">
                      <TrendingUp className="h-5 w-5 text-destructive dark:text-red-300" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
                      <p className="text-sm text-muted-foreground">{t("ingredientes_stat_total_value")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Search */}
            <Card className="border-border bg-card" data-tour="ing-search">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="text"
                      placeholder={t("ingredientes_search_placeholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-border focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48 border-border focus:ring-2 focus:ring-primary">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todas">{t("ingredientes_all_categories")}</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48 border-border focus:ring-2 focus:ring-primary">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Summary */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="rounded-lg px-3 py-1 bg-muted text-foreground font-medium">
                  {t("ingredientes_found_count").replace("{count}", String(filteredAndSortedIngredients.length))}
                </Badge>
                {selectedCategory !== "Todas" && (
                  <Badge
                    variant="outline"
                    className="rounded-lg px-3 py-1 border-blue-200 dark:border-blue-900 text-info bg-blue-50"
                  >
                    {selectedCategory}
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="outline" className="rounded-lg px-3 py-1 text-success bg-success-soft">
                    {t("ingredientes_search_label")}:"{searchQuery}"
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                {activeSystem === "mixed" && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="h-3 w-3" />
                    {t("ingredientes_mixed_system")}
                  </div>
                )}
                <div className="flex items-center gap-2" data-tour="ing-unit-switch">
                  <Scale
                    className={`h-4 w-4 ${activeSystem === "metric" ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-medium ${activeSystem === "metric" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {t("ingredientes_metric_label")}
                  </span>
                  <SwitchPrimitives.Root
                    checked={activeSystem === "imperial"}
                    onCheckedChange={(checked) => (checked ? convertToImperial() : convertToMetric())}
                    disabled={ingredients.length === 0}
                    aria-label={t("ingredientes_unit_switch_aria")}
                    className="peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
                  >
                    <SwitchPrimitives.Thumb
                      className={`pointer-events-none block h-5 w-5 rounded-full bg-background ring-0 transition-transform ${
                        activeSystem === "metric"
                          ? "translate-x-0"
                          : activeSystem === "imperial"
                            ? "translate-x-5"
                            : "translate-x-2.5"
                      }`}
                    />
                  </SwitchPrimitives.Root>
                  <span
                    className={`text-sm font-medium ${activeSystem === "imperial" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {t("ingredientes_imperial_label")}
                  </span>
                  <Ruler
                    className={`h-4 w-4 ${activeSystem === "imperial" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="text-sm text-muted-foreground">{t("ingredientes_drag_hint")}</div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredAndSortedIngredients.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Package className="h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {ingredients.length === 0
                    ? t("ingredientes_empty_no_ingredients")
                    : t("ingredientes_empty_not_found")}
                </h3>
                <p className="text-muted-foreground text-center mb-8">
                  {ingredients.length === 0
                    ? t("ingredientes_empty_no_ingredients_desc")
                    : t("ingredientes_empty_not_found_desc")}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {ingredients.length === 0
                      ? t("ingredientes_add_first_button")
                      : t("ingredientes_new_ingredient_button")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowImportDialog(true)}
                    className="border-border hover:bg-accent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t("ingredientes_import_from_excel_button")}
                  </Button>
                  {ingredients.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedCategory("Todas")
                      }}
                      className="border-border hover:bg-accent"
                    >
                      {t("ingredientes_clear_filters_button")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card" data-tour="ing-table">
              <CardContent className="p-0">
                <IngredientsTable
                  items={filteredAndSortedIngredients}
                  allItems={ingredients}
                  businessId={businessId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onChange={(updated) => {
                    setIngredients(updated)
                    saveIngredients(updated, businessId)
                  }}
                  onUnitChange={() => setActiveSystem(null)}
                  mermaSystemEnabled={ingredients.some((ing) => ing.merma?.enabled)}
                />

                {/* Tabla Resumen al Final (preservada) */}
                <div className="border-t border-border bg-muted/20 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <span className="font-semibold text-foreground">{t("ingredientes_summary_total_label")}</span>
                      <p className="text-xl font-bold text-primary">{filteredAndSortedIngredients.length}</p>
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-foreground">
                        {t("ingredientes_summary_total_value_label")}
                      </span>
                      <p className="text-xl font-bold text-green-600 dark:text-green-300">
                        {formatCurrency(
                          filteredAndSortedIngredients.reduce((sum, ing) => sum + (ing.pricing?.purchasePrice || 0), 0),
                        )}
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-foreground">{t("ingredientes_summary_avg_cost_label")}</span>
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-300">
                        {formatCurrency(
                          filteredAndSortedIngredients.length > 0
                            ? filteredAndSortedIngredients.reduce(
                                (sum, ing) => sum + (ing.pricing?.pricePerUnit || 0),
                                0,
                              ) / filteredAndSortedIngredients.length
                            : 0,
                        )}
                      </p>
                    </div>
                    <div className="text-center">
                      <span className="font-semibold text-foreground">
                        {t("ingredientes_summary_unique_categories_label")}
                      </span>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-300">
                        {[...new Set(filteredAndSortedIngredients.map((ing) => ing.category))].length}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Ingredient Dialog - Wizard Style */}
      <Dialog
        open={showAddDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false)
            setShowEditDialog(false)
            setIngredientToEdit(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {ingredientToEdit ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {ingredientToEdit ? t("ingredientes_dialog_edit_title") : t("ingredientes_dialog_add_title")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {ingredientToEdit ? t("ingredientes_dialog_edit_desc") : t("ingredientes_dialog_add_desc")}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-6">
            {FORM_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    index <= currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? <CheckCircle className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <div className="ml-2 hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      index <= currentStep ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < FORM_STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
              </div>
            ))}
          </div>

          <Progress value={((currentStep + 1) / FORM_STEPS.length) * 100} className="mb-6" />

          {/* Form Steps */}
          <div className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t("ingredientes_step_basic_title")}</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground font-medium">
                    {t("ingredientes_field_name_label")}
                  </Label>
                  <Input
                    id="name"
                    ref={ingredientNameInputRef}
                    value={formData.name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    onKeyDown={handleIngredientNameKeyDown}
                    placeholder={t("ingredientes_field_name_placeholder")}
                    className="border-border focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-foreground font-medium">
                      {t("ingredientes_field_category_label")}
                    </Label>
                    <Select
                      value={formData.category || ""}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, category: value as any }))
                        focusAndOpenIngredientUnit()
                      }}
                      open={ingredientCategoryOpen}
                      onOpenChange={setIngredientCategoryOpen}
                    >
                      <SelectTrigger
                        ref={ingredientCategoryTriggerRef}
                        className="border-border focus:ring-2 focus:ring-primary"
                      >
                        <SelectValue placeholder={t("ingredientes_select_placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit" className="text-foreground font-medium">
                      {t("ingredientes_field_unit_label")}
                    </Label>
                    <Select
                      value={formData.unit || ""}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, unit: value as any }))
                        focusAndOpenIngredientPresentation()
                      }}
                      open={ingredientUnitOpen}
                      onOpenChange={setIngredientUnitOpen}
                    >
                      <SelectTrigger
                        ref={ingredientUnitTriggerRef}
                        className="border-border focus:ring-2 focus:ring-primary"
                      >
                        <SelectValue placeholder={t("ingredientes_select_placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="presentation" className="text-foreground font-medium">
                      {t("ingredientes_field_presentation_label")}
                    </Label>
                    <Select
                      value={formData.presentation || ""}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, presentation: value as any }))}
                      open={ingredientPresentationOpen}
                      onOpenChange={setIngredientPresentationOpen}
                    >
                      <SelectTrigger
                        ref={ingredientPresentationTriggerRef}
                        className="border-border focus:ring-2 focus:ring-primary"
                      >
                        <SelectValue placeholder={t("ingredientes_select_placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {presentations.map((presentation) => (
                          <SelectItem key={presentation} value={presentation}>
                            {presentation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Pricing */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t("ingredientes_step_pricing_title")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice" className="text-foreground font-medium">
                      {t("ingredientes_field_purchase_price_label")}
                    </Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.pricing?.purchasePrice || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing!,
                            purchasePrice: Number(e.target.value),
                          },
                        }))
                      }
                      placeholder="0.00"
                      className="border-border focus:ring-2 focus:ring-primary"
                      required
                    />
                    <p className="text-xs text-muted-foreground">{t("ingredientes_field_purchase_price_hint")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="netContent" className="text-foreground font-medium">
                      {t("ingredientes_field_net_content_label")}
                    </Label>
                    <Input
                      id="netContent"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.pricing?.netContent || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing!,
                            netContent: Number(e.target.value),
                          },
                        }))
                      }
                      placeholder="1.00"
                      className="border-border focus:ring-2 focus:ring-primary"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("ingredientes_field_net_content_hint").replace("{unit}", formData.unit || "unidades")}
                    </p>
                  </div>
                </div>

                {/* Example calculation */}
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <p className="font-medium mb-2">{t("ingredientes_example_calc_label")}</p>
                  <p className="text-muted-foreground">
                    {t("ingredientes_example_calc_text")
                      .replace("{netContent}", String(formData.pricing?.netContent || 1))
                      .replace(/\{unit\}/g, formData.unit || "unidades")
                      .replace("{price}", formatCurrency(formData.pricing?.purchasePrice || 0))
                      .replace(
                        "{perUnit}",
                        formatCurrency((formData.pricing?.purchasePrice || 0) / (formData.pricing?.netContent || 1)),
                      )}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Supplier */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t("ingredientes_step_supplier_full_title")}</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier" className="text-foreground font-medium">
                    {t("ingredientes_field_supplier_label")}
                  </Label>
                  <Input
                    id="supplier"
                    value={formData.supplier || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                    placeholder={t("ingredientes_field_supplier_placeholder")}
                    className="border-border focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Additional Information */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{t("ingredientes_step_additional_title")}</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-foreground font-medium">
                    {t("ingredientes_field_notes_label")}
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={t("ingredientes_field_notes_placeholder")}
                    className="border-border focus:ring-2 focus:ring-primary min-h-[100px]"
                  />
                </div>

                {/* Summary */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-3">{t("ingredientes_summary_title")}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_name_label")}</span>
                      <span className="font-medium">{formData.name || t("ingredientes_summary_no_name")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_category_label")}</span>
                      <span className="font-medium">{formData.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_purchase_price_label")}</span>
                      <span className="font-medium">{formatCurrency(formData.pricing?.purchasePrice || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_net_content_label")}</span>
                      <span className="font-medium">
                        {formData.pricing?.netContent || 0} {formData.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_price_per_unit_label")}</span>
                      <span className="font-medium text-primary">
                        {formatCurrency((formData.pricing?.purchasePrice || 0) / (formData.pricing?.netContent || 1))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={prevStep} className="border-border bg-transparent">
                  {t("ingredientes_prev_button")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  setShowEditDialog(false)
                  setIngredientToEdit(null)
                  resetForm()
                }}
                className="border-border"
              >
                {t("common_cancel")}
              </Button>
              {currentStep < FORM_STEPS.length - 1 ? (
                <Button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t("ingredientes_next_button")}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {ingredientToEdit ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {ingredientToEdit ? t("ingredientes_update_button") : t("ingredientes_add_button")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-4xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("ingredientes_import_dialog_title")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("ingredientes_import_dialog_desc")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">{t("ingredientes_tab_upload")}</TabsTrigger>
              <TabsTrigger value="template">{t("ingredientes_tab_template")}</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              {!importFile ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <FileSpreadsheet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("ingredientes_select_file_title")}</h3>
                  <p className="text-muted-foreground mb-4">{t("ingredientes_select_file_desc")}</p>
                  <FileUpload
                    onFileSelect={(file) => {
                      setImportFile(file)
                      processImportFile(file)
                    }}
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{importFile.name}</p>
                        <p className="text-sm text-muted-foreground">{(importFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImportFile(null)
                        setImportPreview([])
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {importPreview.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">{t("ingredientes_preview_title")}</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-64">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                {Object.keys(importPreview[0] || {}).map((key) => (
                                  <th key={key} className="p-2 text-left font-medium">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.map((row, index) => (
                                <tr key={index} className="border-t">
                                  {Object.values(row).map((value: any, cellIndex) => (
                                    <td key={cellIndex} className="p-2">
                                      {String(value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {isImporting && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t("ingredientes_importing_label")}</span>
                        <span className="text-sm text-muted-foreground">{Math.round(importProgress)}%</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="template" className="space-y-4">
              <div className="p-6 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h4 className="font-semibold mb-1">{t("ingredientes_template_format_title")}</h4>
                    <p className="text-sm text-muted-foreground">{t("ingredientes_template_format_desc")}</p>
                  </div>
                  <Button onClick={handleDownloadTemplate} className="gap-2 shrink-0">
                    <Download className="h-4 w-4" />
                    {t("ingredientes_download_template_button")}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{t("ingredientes_template_columns_intro")}</p>
                <div className="text-sm">
                  <strong>{t("ingredientes_recognized_columns_label")}</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Categoría / categoria / CATEGORIA (con lista desplegable en la plantilla descargada)</li>
                    <li>Nombre / nombre / NOMBRE / Ingredientes</li>
                    <li>Unidad / unidad / UNIDAD</li>
                    <li>Precio de Compra / precio / PRECIO</li>
                    <li>Contenido Neto / contenido / CONTENIDO</li>
                    <li>Proveedor / proveedor / PROVEEDOR</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 dark:border-blue-900 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-300 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-info mb-1">{t("ingredientes_import_tips_title")}</p>
                    <ul className="text-info space-y-1">
                      <li>• {t("ingredientes_import_tip_1")}</li>
                      <li>• {t("ingredientes_import_tip_2")}</li>
                      <li>• {t("ingredientes_import_tip_3")}</li>
                      <li>• {t("ingredientes_import_tip_4")}</li>
                      <li>• {t("ingredientes_import_tip_5")}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="border-border">
              {t("common_cancel")}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("ingredientes_importing_button_label")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("ingredientes_import_submit_button")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-destructive dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("ingredientes_delete_dialog_title")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("ingredientes_delete_dialog_desc_prefix")} <strong>"{ingredientToDelete?.name}"</strong>
              {t("ingredientes_delete_dialog_desc_suffix")}
              {ingredientToDelete?.category === "Sub Receta / produccion (Mise en place)" && (
                <div className="mt-2 p-2 bg-warning-soft dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded text-warning text-sm">
                  <strong>{t("ingredientes_note_label")}</strong> {t("ingredientes_delete_subrecipe_warning")}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="border-border">
              {t("common_cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" />
              {t("ingredientes_delete_confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merma Management Dialog */}
      <MermaManagementDialog
        open={showMermaDialog}
        onOpenChange={setShowMermaDialog}
        businessId={businessId}
        ingredients={ingredients}
        onSave={handleMermaSave}
      />
    </div>
  )
}
