"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { hasFeatureAccess, useFeatureAccess } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  Camera,
  Receipt,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useNotification } from "@/hooks/use-notification"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { FileUpload } from "@/components/file-upload"
import { MermaManagementDialog } from "@/components/merma-management-dialog"
import { matchCategoryLabel } from "@/lib/ingredient-labels"
import type { Ingredient } from "@/types/ingredient"
import { categories, units, presentations } from "@/types/ingredient"
import { getCategoryLabel, getUnitLabel, getPresentationLabel } from "@/lib/ingredient-labels"
import { getIngredients, saveIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import type { Recipe } from "@/types/recipe"
import { parseWorkbookSheets, createIngredientsExcelTemplate } from "@/lib/excel-utils"
import { mapIngredientRows, splitPastedList, parseLocaleNumber, pickIngredientSheet, type ImportedIngredientRow } from "@/lib/ingredient-import"
import { guessCategory } from "@/lib/recipe-import/guess-category"
import { getCurrentCurrencyCode } from "@/lib/currency"
import { parseReceiptText } from "@/lib/receipt-import"
import { useOcrUsage } from "@/lib/ocr-usage"
import { OCR_LANG } from "@/lib/recipe-import/ocr"
import { IngredientsTable } from "@/components/ingredients/ingredients-table"
import { IngredientesTour } from "@/components/page-tours"
import { convertAllIngredientsToSystem } from "@/lib/utils/calculations"
import { updateIngredientPriceAndRecalculate } from "@/lib/recalculate"
import { ActivityTracker } from "@/lib/activity-tracker"
import { trackEvent } from "@/lib/analytics/track-event"
import { logActivity } from "@/lib/services/activity-log"
import { ALLERGENS, allergenLabelKey } from "@/lib/allergens"
import { formatUnitPrice } from "@/lib/currency"

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

// Columnas, números y listas pegadas de la importación: lib/ingredient-import.ts (docs/148).

// Sin tildes/diéresis y en mayúsculas, para comparar sin importar cómo haya escrito
// el usuario la categoría en el Excel ("Lácteos y derivados"=="LACTEOS Y DERIVADOS").
const stripAccents = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()

/**
 * Empareja la categoría que venga en el Excel importado contra las categorías reales
 * que ya ofrece la base de datos (types/ingredient.ts, `categories`) — sin importar
 * tildes, mayúsculas/minúsculas, espacios extra, o el idioma en que venga escrita
 * (matchCategoryLabel reconoce las etiquetas de los 6 idiomas seleccionables, ver
 * lib/ingredient-labels.ts). Si no hay ninguna coincidencia, cae a"OTROS"en vez de
 * fallar la fila completa.
 */
const normalizeCategory = (value: string): (typeof categories)[number] => {
  if (!value) return "OTROS"
  const normalizedValue = stripAccents(value)
  const match = categories.find((cat) => stripAccents(cat) === normalizedValue)
  if (match) return match

  const translatedMatch = matchCategoryLabel(value)
  if (translatedMatch) return translatedMatch

  // Coincidencia parcial como último recurso (ej."Lacteos"sin"y derivados").
  const partial = categories.find(
    (cat) => stripAccents(cat).includes(normalizedValue) || normalizedValue.includes(stripAccents(cat)),
  )
  return partial || "OTROS"
}


export default function IngredientesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business")
  const { isLoggedIn, authChecked, user } = useAuth()
  const canAccessMerma = useFeatureAccess("merma")
  const canAccessIngredients = useFeatureAccess("ingredients")
  const { showSuccess, showError, showInfo } = useNotification()
  const { t, language } = useLanguage()

  const sortOptions = useMemo(() => getSortOptions(t), [t])
  const FORM_STEPS = useMemo(() => getFormSteps(t), [t])

  // State management
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  // Solo para calcular que recetas se afectan al borrar un ingrediente (ver mas
  // abajo) — esta pantalla no muestra ni edita recetas directamente.
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Todas")
  const [sortBy, setSortBy] = useState("name")

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  // Tras importar ingredientes, se sugiere el siguiente paso: traer las recetas (docs/148).
  const [importedCount, setImportedCount] = useState(0)
  // ?import=1 (desde "Tu camino" del Dashboard): abre directo la importación.
  useEffect(() => {
    if (searchParams.get("import") !== "1") return
    setShowImportDialog(true)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("import")
    router.replace(params.size ? `/ingredientes?${params}` : "/ingredientes")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [showMermaDialog, setShowMermaDialog] = useState(false)
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null)
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null)
  // Recetas que usan el ingrediente que se va a borrar — para avisar ANTES de
  // confirmar (pedido explícito: nunca se sabía qué recetas se afectaban).
  const [recipesUsingIngredientToDelete, setRecipesUsingIngredientToDelete] = useState<Recipe[]>([])

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
  // Filas ya interpretadas (lib/ingredient-import.ts): la vista previa muestra lo que
  // de verdad se va a importar, no las columnas crudas del archivo (docs/148).
  const [importRows, setImportRows] = useState<ImportedIngredientRow[]>([])
  const [pasteText, setPasteText] = useState("")
  // Ticket o factura (docs/151): leído con OCR; permite actualizar precios existentes
  const [fromReceipt, setFromReceipt] = useState(false)
  // Libro de Excel con varias hojas (docs/152): cuál se importa
  const [importSheets, setImportSheets] = useState<{ name: string; rows: unknown[][] }[]>([])
  const [importSheet, setImportSheet] = useState(0)
  // Filas sin precio: se importan en 0 para completarlas después (migrar todo de una vez)
  const [includeNoPrice, setIncludeNoPrice] = useState(true)
  // Actualizar precios de lo que ya existe: marcado por defecto con un ticket; con un
  // Excel (p. ej. la lista del proveedor) se ofrece desmarcado (docs/152).
  const [updateExisting, setUpdateExisting] = useState(false)
  // Por plan (docs/153): crear ingredientes desde un ticket o una lista es libre en todos
  // los planes; actualizar el precio de los que ya existen es de Home Cook en adelante.
  const canImportPrices = useFeatureAccess("price_import") === true
  const logOcrRead = useOcrUsage()
  const [receiptProgress, setReceiptProgress] = useState<number | null>(null)
  const receiptCameraRef = useRef<HTMLInputElement>(null)
  const receiptFileRef = useRef<HTMLInputElement>(null)
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
        // Best-effort: solo se usa para el aviso de "recetas afectadas" al borrar,
        // no bloquea la carga de ingredientes si falla.
        await ensureRecipesLoaded(businessId)
        setRecipes(getRecipes(businessId))
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
          /\.(xlsx|xlsm|xls|csv|txt)$/i.test(file.name),
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
      const sheets = await parseWorkbookSheets(file)
      const index = pickIngredientSheet(sheets)
      setImportSheets(sheets)
      setImportSheet(index)
      const rows = mapIngredientRows(sheets[index]?.rows ?? [], { currency: getCurrentCurrencyCode() })
      setImportRows(rows)
      showInfo(
        t("ingredientes_toast_file_processed_title"),
        t("ingredientes_toast_file_processed_desc").replace("{count}", String(rows.length)),
      )
    } catch (error) {
      console.error("Error processing file:", error)
      showError(t("ingredientes_toast_process_error_title"), t("ingredientes_toast_process_error_desc"))
    }
  }

  const changeImportSheet = (index: number) => {
    setImportSheet(index)
    setImportRows(mapIngredientRows(importSheets[index]?.rows ?? [], { currency: getCurrentCurrencyCode() }))
  }

  // Lista pegada (de Excel, Google Sheets, un correo o WhatsApp) — sin archivo (docs/148).
  const handlePasteList = () => {
    const rows = mapIngredientRows(splitPastedList(pasteText), { currency: getCurrentCurrencyCode() })
    if (!rows.length) {
      showError(t("ingredientes_toast_process_error_title"), t("ingredientes_paste_empty"))
      return
    }
    setImportRows(rows)
    setImportFile(new File([pasteText], `${t("ingredientes_paste_source")}.txt`, { type: "text/plain" }))
  }

  /**
   * Ticket o factura de supermercado (docs/151): foto o PDF → OCR en el dispositivo →
   * productos con precio (lib/receipt-import.ts) → la misma vista previa de siempre.
   */
  const handleReceiptFile = async (file: File) => {
    setReceiptProgress(0)
    try {
      const latin = OCR_LANG[language] && OCR_LANG[language] !== "chi_sim" ? OCR_LANG[language] : "eng"
      const lang = OCR_LANG[language] || "spa"
      let text = ""
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const { openRecipePdf, ocrPdfPage } = await import("@/lib/recipe-import/pdf")
        const info = await openRecipePdf(file, (p) => setReceiptProgress(p * 0.3))
        text = info.pages.map((pg) => pg.text ?? "").join("\n").trim()
        if (!text) logOcrRead("receipt")
        if (!text) text = (await ocrPdfPage(file, 1, lang, latin, (p) => setReceiptProgress(0.3 + p * 0.7), { layout: "receipt" })).text
      } else {
        logOcrRead("receipt")
        const { recognizeWithLanguageCheck } = await import("@/lib/recipe-import/ocr")
        text = (await recognizeWithLanguageCheck(file, lang, latin, (p) => setReceiptProgress(p), { layout: "receipt" })).text
      }
      const rows = parseReceiptText(text, { currency: getCurrentCurrencyCode() })
      if (!rows.length) {
        showError(t("ingredientes_receipt_empty_title"), t("ingredientes_receipt_empty_desc"))
        return
      }
      setImportRows(rows)
      setFromReceipt(true)
      setUpdateExisting(canImportPrices)
      setImportFile(new File([text], `${t("ingredientes_receipt_source")}.txt`, { type: "text/plain" }))
    } catch (error) {
      console.error("[ingredientes] Ticket:", error)
      showError(t("ingredientes_receipt_empty_title"), t("ingredientes_receipt_error_desc"))
    } finally {
      setReceiptProgress(null)
    }
  }

  const updateImportRow = (index: number, patch: Partial<ImportedIngredientRow>) =>
    setImportRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  /** Ingrediente existente con el mismo nombre y unidad: su precio se puede actualizar. */
  const existingForUpdate = (row: ImportedIngredientRow) => {
    const key = (row.name || "").toLowerCase()
    return ingredients.find((ing) => ing.name.toLowerCase() === key && ing.unit === row.unit) ?? null
  }

  // Por qué se omitiría una fila (sin precio o ya existe), para la vista previa.
  const importSkipReason = (row: ImportedIngredientRow, index: number): string | null => {
    if (!(row.price > 0) && !(includeNoPrice && row.name)) return t("ingredientes_preview_skip_price")
    const key = (row.name || "").toLowerCase()
    if (ingredients.some((ing) => ing.name.toLowerCase() === key)) {
      return updateExisting && row.price > 0 && existingForUpdate(row) ? null : t("ingredientes_preview_skip_exists")
    }
    if (importRows.slice(0, index).some((r) => (r.name || "").toLowerCase() === key)) return t("ingredientes_preview_skip_exists")
    return null
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
      const data = importRows
      const totalRows = data.length
      let importedCount = 0
      let errorCount = 0
      const newIngredients: Ingredient[] = []

      if (data.length === 0) {
        throw new Error(t("ingredientes_error_no_valid_data"))
      }

      const seen = new Set(ingredients.map((ing) => ing.name.toLowerCase()))
      const priceUpdates: { id: string; price: number }[] = []
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        // La categoría se compara contra las reales (sin tildes/mayúsculas, 6 idiomas);
        // si no coincide, entra como OTROS y se corrige desde la tabla.
        const ingredientName = row.name || `${t("ingredientes_default_name_prefix")} ${i + 1}`
        const price = row.price > 0 ? row.price : includeNoPrice ? 0 : NaN
        if (!(price >= 0) || !(row.content > 0) || (!row.name && !(row.price > 0))) {
          errorCount++
          continue
        }
        if (seen.has(ingredientName.toLowerCase())) {
          // Ticket: el mismo producto ya existe con la misma unidad → nuevo precio, llevado
          // a su contenido neto (precio por g/ml/unidad del ticket × contenido existente).
          const existing = updateExisting && row.price > 0 ? existingForUpdate(row) : null
          if (existing && !priceUpdates.some((u) => u.id === existing.id)) {
            const net = existing.pricing?.netContent || 1
            priceUpdates.push({ id: existing.id, price: Math.round((row.price / row.content) * net * 100) / 100 })
          }
          continue
        }
        seen.add(ingredientName.toLowerCase())
        const now = new Date().toISOString()
        newIngredients.push({
          id: generateUniqueId(),
          name: ingredientName,
          // Sin categoría en la lista: se sugiere por el nombre (mismas palabras clave que el
          // importador de recetas), en vez de mandar todo a "Otros".
          category: (row.category ? normalizeCategory(row.category) : guessCategory(ingredientName)) as any,
          unit: row.unit as any,
          presentation: undefined,
          pricing: {
            purchasePrice: price,
            netContent: row.content,
            pricePerUnit: price / row.content,
            lastUpdated: now,
          },
          supplier: row.supplier || t("ingredientes_default_supplier"),
          notes: "",
          metadata: { createdAt: now, updatedAt: now, version: 1 },
        })
        importedCount++
        if (i % 50 === 0) {
          setImportProgress((i / totalRows) * 100)
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }

      setImportProgress(100)

      // Update state immediately
      const updatedIngredients = [...ingredients, ...newIngredients]
      setIngredients(updatedIngredients)

      await saveIngredients(updatedIngredients, businessId)

      // Precios actualizados desde el ticket: misma función que al editar un precio a mano,
      // que recalcula en cascada las recetas que usan ese ingrediente.
      let updatedPrices = 0
      for (const update of priceUpdates) {
        try {
          await updateIngredientPriceAndRecalculate(businessId || "main", update.id, update.price)
          updatedPrices++
        } catch (error) {
          console.error("[ingredientes] No se pudo actualizar el precio:", error)
        }
      }
      if (updatedPrices > 0) {
        showSuccess(t("ingredientes_receipt_updated_title"), t("ingredientes_receipt_updated_desc").replace("{count}", String(updatedPrices)))
      }

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
      if (importedCount > 0) setImportedCount(importedCount)

      setShowImportDialog(false)
      setImportFile(null)
      setImportRows([])
      setPasteText("")
      setFromReceipt(false)
      setUpdateExisting(false)
      setImportSheets([])
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

        if (user) {
          logActivity({
            user,
            businessId: businessId && businessId !== "main" ? businessId : null,
            module: "ingredientes",
            action: "updated",
            entityLabel: ingredientData.name,
          })
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

        if (user) {
          logActivity({
            user,
            businessId: businessId && businessId !== "main" ? businessId : null,
            module: "ingredientes",
            action: "created",
            entityLabel: newIngredient.name,
          })
        }

        showSuccess(t("ingredientes_toast_created_title"), t("ingredientes_toast_created_desc"))
        setShowAddDialog(false)
        trackEvent("first_ingredient_created", businessId)
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
  // Antes no había forma de saber, antes de confirmar, qué recetas quedarían con un
  // ingrediente roto/faltante al borrarlo — pedido explícito: avisar cuáles se
  // afectan (mismo filtro que ya usa lib/recalculate.ts para el caso de cambio de
  // precio, aplicado aquí al borrado).
  const handleDelete = (ingredient: Ingredient) => {
    setIngredientToDelete(ingredient)
    setRecipesUsingIngredientToDelete(
      recipes.filter((recipe) => recipe.ingredients?.some((item) => item.ingredientId === ingredient.id)),
    )
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

      if (user) {
        logActivity({
          user,
          businessId: businessId && businessId !== "main" ? businessId : null,
          module: "ingredientes",
          action: "deleted",
          entityLabel: ingredientToDelete.name,
        })
      }

      showSuccess(t("ingredientes_toast_deleted_title"), t("ingredientes_toast_deleted_desc"))
      setShowDeleteDialog(false)
      setIngredientToDelete(null)
      setRecipesUsingIngredientToDelete([])
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
    return <AdminRestrictedPage sectionName={t("nav_ingredientes")} />
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
          <IngredientesTour onOpenImport={() => setShowImportDialog(true)} />
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
            {importedCount > 0 && (
              <div className="rounded-xl border border-primary/40 bg-primary-soft/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("ingredientes_next_recipes_title").replace("{count}", String(importedCount))}
                  </p>
                  <p className="text-xs text-text-3">{t("ingredientes_next_recipes_desc")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/mis-recetas?import=1${businessId ? `&business=${businessId}` : ""}`}>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      {t("ingredientes_next_recipes_cta")}
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setImportedCount(0)} aria-label={t("common_close")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
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
                            {getCategoryLabel(category, language)}
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
                    className="rounded-lg px-3 py-1 border-blue-200 dark:border-blue-900 text-info bg-info-soft"
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
                    className={`h-4 w-4 ${activeSystem === "metric" ? "text-info" : "text-muted-foreground"}`}
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
                    className={`h-4 w-4 ${activeSystem === "imperial" ? "text-warning" : "text-muted-foreground"}`}
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
                {/* Sin ingredientes (docs/145): la importación masiva va primero y destacada,
                    con la opción manual siempre visible al lado. */}
                {ingredients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center -mt-4 mb-6 max-w-md">{t("ingredientes_empty_import_hint")}</p>
                )}
                <div className={`flex flex-col sm:flex-row gap-4 ${ingredients.length === 0 ? "sm:flex-row-reverse" : ""}`}>
                  <Button
                    variant={ingredients.length === 0 ? "outline" : "default"}
                    onClick={() => setShowAddDialog(true)}
                    className={ingredients.length === 0 ? "border-border hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {ingredients.length === 0
                      ? t("ingredientes_add_first_button")
                      : t("ingredientes_new_ingredient_button")}
                  </Button>
                  <Button
                    variant={ingredients.length === 0 ? "default" : "outline"}
                    onClick={() => setShowImportDialog(true)}
                    className={ingredients.length === 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border hover:bg-accent"}
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
                            {getCategoryLabel(category, language)}
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
                            {getUnitLabel(unit, language)}
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
                            {getPresentationLabel(presentation, language)}
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
                    {/* BUG REAL encontrado en vivo: este campo usaba <Input type="number" min="0">
                        en vez de <NumericInput> (el componente que ya usa el resto de la app para
                        números — ver components/ui/numeric-input.tsx). El atributo HTML `min` de un
                        input nativo solo se aplica a las flechitas del spinner y a la validación del
                        <form>, NO bloquea escribir un número negativo con el teclado — se pudo
                        escribir "-50" y quedaba aceptado en el campo. isStepValid() sí rechazaba el
                        precio negativo, pero eso solo dejaba el botón "Siguiente" deshabilitado sin
                        ninguna explicación — silencioso, sin mensaje. NumericInput bloquea el guion
                        al teclear, así que ahora ni siquiera se puede escribir un precio negativo. */}
                    <NumericInput
                      id="purchasePrice"
                      min={0}
                      decimalPlaces={2}
                      value={formData.pricing?.purchasePrice ?? 0}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing!,
                            purchasePrice: value,
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
                    <NumericInput
                      id="netContent"
                      min={0.01}
                      decimalPlaces={2}
                      value={formData.pricing?.netContent ?? 0}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          pricing: {
                            ...prev.pricing!,
                            netContent: value,
                          },
                        }))
                      }
                      placeholder="1.00"
                      className="border-border focus:ring-2 focus:ring-primary"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("ingredientes_field_net_content_hint").replace(
                        "{unit}",
                        formData.unit ? getUnitLabel(formData.unit, language) : "unidades",
                      )}
                    </p>
                  </div>
                </div>

                {/* Example calculation */}
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  <p className="font-medium mb-2">{t("ingredientes_example_calc_label")}</p>
                  <p className="text-muted-foreground">
                    {t("ingredientes_example_calc_text")
                      .replace("{netContent}", String(formData.pricing?.netContent || 1))
                      .replace(/\{unit\}/g, formData.unit ? getUnitLabel(formData.unit, language) : "unidades")
                      .replace("{price}", formatCurrency(formData.pricing?.purchasePrice || 0))
                      .replace(
                        "{perUnit}",
                        formatUnitPrice((formData.pricing?.purchasePrice || 0) / (formData.pricing?.netContent || 1)),
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

                {/* Alérgenos (docs/137): las recetas los heredan solas. */}
                <div className="space-y-2">
                  <Label className="text-foreground font-medium">{t("allergens_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("allergens_ingredient_hint")}</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("allergens_label")}>
                    {ALLERGENS.map((key) => {
                      const selected = (formData.allergens || []).includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setFormData((prev) => {
                              const current = prev.allergens || []
                              return {
                                ...prev,
                                allergens: selected ? current.filter((a) => a !== key) : [...current, key],
                              }
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-transparent text-foreground hover:bg-muted"
                          }`}
                        >
                          {t(allergenLabelKey(key))}
                        </button>
                      )
                    })}
                  </div>
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
                      <span className="font-medium">{formData.category ? getCategoryLabel(formData.category, language) : ""}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_purchase_price_label")}</span>
                      <span className="font-medium">{formatCurrency(formData.pricing?.purchasePrice || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_net_content_label")}</span>
                      <span className="font-medium">
                        {formData.pricing?.netContent || 0}{" "}
                        {formData.unit ? getUnitLabel(formData.unit, language) : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("ingredientes_summary_price_per_unit_label")}</span>
                      <span className="font-medium text-primary">
                        {formatUnitPrice((formData.pricing?.purchasePrice || 0) / (formData.pricing?.netContent || 1))}
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
                    accept=".xlsx,.xlsm,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel,text/csv,text/plain"
                  />
                  <div className="mt-6 pt-6 border-t border-border text-left space-y-2">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      {t("ingredientes_receipt_title")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("ingredientes_receipt_desc")}</p>
                    <input
                      ref={receiptCameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleReceiptFile(f)
                        e.target.value = ""
                      }}
                    />
                    <input
                      ref={receiptFileRef}
                      type="file"
                      accept="image/*,application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleReceiptFile(f)
                        e.target.value = ""
                      }}
                    />
                    {receiptProgress !== null ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">
                          {t("ingredientes_receipt_reading").replace("{p}", String(Math.round(receiptProgress * 100)))}
                        </p>
                        <Progress value={receiptProgress * 100} />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => receiptCameraRef.current?.click()}>
                          <Camera className="h-4 w-4 mr-2" />
                          {t("ingredientes_receipt_photo")}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => receiptFileRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          {t("ingredientes_receipt_upload")}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 pt-6 border-t border-border text-left space-y-2">
                    <Label htmlFor="ingredient-paste" className="text-sm font-medium text-foreground">
                      {t("ingredientes_paste_title")}
                    </Label>
                    <Textarea
                      id="ingredient-paste"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={t("ingredientes_paste_placeholder")}
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={handlePasteList} disabled={!pasteText.trim()}>
                        {t("ingredientes_paste_button")}
                      </Button>
                    </div>
                  </div>
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
                        setImportRows([])
                        setFromReceipt(false)
                        setImportSheets([])
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {importRows.length > 0 && (() => {
                    const reasons = importRows.map((row, i) => importSkipReason(row, i))
                    const ready = reasons.filter((r) => r === null).length
                    return (
                      <div className="space-y-2">
                        <h4 className="font-semibold">{t("ingredientes_preview_title")}</h4>
                        {importSheets.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{t("ingredientes_sheet_label")}</span>
                            <Select value={String(importSheet)} onValueChange={(v) => changeImportSheet(Number(v))}>
                              <SelectTrigger className="h-8 w-full sm:w-[260px]" aria-label={t("ingredientes_sheet_label")}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {importSheets.map((sh, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {sh.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {importRows.some((r) => !(r.price > 0) && r.name) && (
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={includeNoPrice} onCheckedChange={(v) => setIncludeNoPrice(v === true)} />
                            {t("ingredientes_include_no_price").replace(
                              "{count}",
                              String(importRows.filter((r) => !(r.price > 0) && r.name).length),
                            )}
                          </label>
                        )}
                        {(fromReceipt || importRows.some((r) => r.price > 0 && existingForUpdate(r))) && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                            {fromReceipt && <p className="text-xs text-muted-foreground">{t("ingredientes_receipt_review_hint")}</p>}
                            <label className={`flex items-center gap-2 text-sm ${canImportPrices ? "" : "opacity-60"}`}>
                              <Checkbox
                                checked={updateExisting && canImportPrices}
                                disabled={!canImportPrices}
                                onCheckedChange={(v) => setUpdateExisting(v === true)}
                              />
                              {t("ingredientes_receipt_update_existing")}
                            </label>
                            {!canImportPrices && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="h-3.5 w-3.5" />
                                {t("price_import_locked")}{" "}
                                <Link href="/planes" className="text-primary hover:underline">
                                  {t("price_import_see_plans")}
                                </Link>
                              </p>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {t("ingredientes_preview_summary")
                            .replace("{ready}", String(ready))
                            .replace("{skipped}", String(importRows.length - ready))}
                        </p>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="p-2 text-left font-medium">{t("ingredientes_preview_col_name")}</th>
                                  <th className="p-2 text-left font-medium">{t("ingredientes_preview_col_content")}</th>
                                  <th className="p-2 text-right font-medium">{t("ingredientes_preview_col_price")}</th>
                                  <th className="p-2 text-left font-medium">{t("ingredientes_preview_col_status")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {importRows.slice(0, 100).map((row, index) => (
                                  <tr key={index} className={"border-t " + (reasons[index] ? "text-muted-foreground" : "")}>
                                    {/* Nombre y precio editables antes de importar (docs/151): el OCR de
                                        un ticket puede confundir un dígito o abreviar un nombre. */}
                                    <td className="p-1">
                                      <Input
                                        value={row.name}
                                        onChange={(e) => updateImportRow(index, { name: e.target.value })}
                                        className="h-8 min-w-[160px] text-sm"
                                        aria-label={t("ingredientes_preview_col_name")}
                                      />
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                      {row.content} {getUnitLabel(row.unit as any, language)}
                                    </td>
                                    <td className="p-1 text-right">
                                      <Input
                                        inputMode="decimal"
                                        value={row.price > 0 ? String(row.price) : ""}
                                        placeholder="—"
                                        onChange={(e) => updateImportRow(index, { price: parseLocaleNumber(e.target.value) })}
                                        className="h-8 w-24 text-right tabular-nums text-sm ml-auto"
                                        aria-label={t("ingredientes_preview_col_price")}
                                      />
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                      {reasons[index] ? (
                                        <span className="text-destructive">{reasons[index]}</span>
                                      ) : (
                                        <span className="text-success">
                                          {updateExisting && row.price > 0 && existingForUpdate(row)
                                            ? t("ingredientes_preview_will_update")
                                            : row.price > 0
                                              ? t("ingredientes_preview_ok")
                                              : t("ingredientes_preview_no_price_ok")}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

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
                    <li>{t("ingredientes_import_col_category")}</li>
                    <li>{t("ingredientes_import_col_name")}</li>
                    <li>{t("ingredientes_import_col_unit")}</li>
                    <li>{t("ingredientes_import_col_price")}</li>
                    <li>{t("ingredientes_import_col_content")}</li>
                    <li>{t("ingredientes_import_col_supplier")}</li>
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
              {recipesUsingIngredientToDelete.length > 0 && (
                <div className="mt-2 p-3 bg-destructive/10 dark:bg-red-950/40 border border-destructive/30 dark:border-red-900 rounded text-sm">
                  <p className="font-medium text-destructive dark:text-red-300">
                    {t("ingredientes_delete_affected_recipes_title").replace(
                      "{count}",
                      String(recipesUsingIngredientToDelete.length),
                    )}
                  </p>
                  <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-muted-foreground">
                    {recipesUsingIngredientToDelete.slice(0, 8).map((recipe) => (
                      <li key={recipe.id}>{recipe.name}</li>
                    ))}
                    {recipesUsingIngredientToDelete.length > 8 && (
                      <li>
                        {t("ingredientes_delete_affected_recipes_more").replace(
                          "{count}",
                          String(recipesUsingIngredientToDelete.length - 8),
                        )}
                      </li>
                    )}
                  </ul>
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
