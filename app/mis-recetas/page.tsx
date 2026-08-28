"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Search,
  Plus,
  Filter,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  ChefHat,
  DollarSign,
  Clock,
  Users,
  TrendingUp,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Building2,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Copy,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MisRecetasTour } from "@/components/page-tours"
import { RecipeCard } from "@/components/recipe-card"
import { useAuth } from "@/contexts/auth-context"
import { useFeatureAccess } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useNotification } from "@/hooks/use-notification"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import {
  getRecipes,
  saveRecipes,
  deleteRecipe as deleteRecipeFromStorage,
  getTrashedRecipes,
  restoreRecipeFromTrash,
  permanentlyDeleteRecipe,
  getTrashDaysRemaining,
  ensureRecipesLoaded,
  ensureTrashLoaded,
  type TrashedRecipe,
} from "@/lib/storage/recipes"
import { SUBRECIPE_CLASSIFICATION, classifications as recipeClassifications } from "@/types/recipe"
import { getClassificationLabel } from "@/lib/classification-labels"
import { useLanguage } from "@/contexts/language-context"
import { syncSubRecipeToIngredient, deleteSubRecipeIngredient } from "@/lib/subrecipe/core"
import { migrateCompleteRecipe } from "@/lib/subrecipe/migration"
import { getAllBusinesses } from "@/lib/storage/businesses"
import type { Recipe } from "@/types/recipe"
import type { Business } from "@/types/business"

// Clasificaciones disponibles
// BUG CORREGIDO: esta lista era una copia local con valores que no coinciden con ninguna
// clasificación real (Ficha Técnica guarda "Línea caliente (Cuisine chaude)", etc., desde
// types/recipe.ts) — el filtro de clasificación nunca podía encontrar ninguna receta,
// silenciosamente. Ahora usa la misma lista canónica que Ficha Técnica.
const classificationFilterOptions = ["Todas", ...recipeClassifications]

// Opciones de ordenamiento
const sortOptions = [
  { value: "name-asc", label: "Nombre A-Z", icon: SortAsc },
  { value: "name-desc", label: "Nombre Z-A", icon: SortDesc },
  { value: "cost-asc", label: "Menor costo", icon: TrendingUp },
  { value: "cost-desc", label: "Mayor costo", icon: TrendingUp },
  { value: "recent", label: "Más recientes", icon: Clock },
  { value: "oldest", label: "Más antiguos", icon: Clock },
]

export default function MisRecetasPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { isLoggedIn, authChecked } = useAuth()
  const { language } = useLanguage()
  const { showSuccess, showError, showInfo } = useNotification()
  const canAccessRecipes = useFeatureAccess("recipes")

  // Estados principales
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Papelera de recetas (ver documento de continuidad) — retención de 30 días
  const [showTrashDialog, setShowTrashDialog] = useState(false)
  const [trashedRecipes, setTrashedRecipes] = useState<TrashedRecipe[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClassification, setSelectedClassification] = useState("Todas")
  const [sortBy, setSortBy] = useState("recent")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showFilters, setShowFilters] = useState(false)

  // Estados de diálogos
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null)
  const [recipeToMigrate, setRecipeToMigrate] = useState<Recipe | null>(null)
  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([])
  const [selectedTargetBusiness, setSelectedTargetBusiness] = useState<string>("")
  const [isMigrating, setIsMigrating] = useState(false)

  // Estado móvil
  const [isMobile, setIsMobile] = useState(false)

  // Panel lateral de opciones — se abre con doble clic en una receta
  const [detailsRecipe, setDetailsRecipe] = useState<Recipe | null>(null)

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Cargar recetas
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        setIsLoading(true)
        await ensureRecipesLoaded(businessId)
        const savedRecipes = getRecipes(businessId)
        setRecipes(savedRecipes)

        // Negocios disponibles como destino de migración: todos excepto el actual.
        const businesses = getAllBusinesses().filter((b) => b.id !== businessId)
        setAvailableBusinesses(businesses)
      } catch (error) {
        console.error("Error loading recipes:", error)
        showError("Error al cargar", "No se pudieron cargar las recetas")
      } finally {
        setIsLoading(false)
      }
    }

    loadRecipes()

    const handleRecipesUpdate = (event: CustomEvent) => {
      if (event.detail.businessId === businessId) {
        loadRecipes()
      }
    }

    window.addEventListener("recipesUpdated", handleRecipesUpdate as EventListener)
    return () => window.removeEventListener("recipesUpdated", handleRecipesUpdate as EventListener)
  }, [businessId, showError])

  // Filtrar y ordenar recetas
  const filteredAndSortedRecipes = useMemo(() => {
    let filtered = recipes

    // Aplicar filtro de búsqueda
    if (searchQuery.length >= 2) {
      filtered = filtered.filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.classification?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipe.plate?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Aplicar filtro de clasificación
    if (selectedClassification !== "Todas") {
      filtered = filtered.filter((recipe) => recipe.classification === selectedClassification)
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name)
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "cost-asc":
          return (a.totalCost || 0) - (b.totalCost || 0)
        case "cost-desc":
          return (b.totalCost || 0) - (a.totalCost || 0)
        // BUG CORREGIDO: comparaba a.createdAt contra b.updatedAt (campos distintos entre
        // los dos lados), lo que no es un orden válido — el resultado era inestable en
        // cuanto una receta editada tenía updatedAt distinto de createdAt.
        case "recent":
          return new Date(b.metadata?.updatedAt || 0).getTime() - new Date(a.metadata?.updatedAt || 0).getTime()
        case "oldest":
          return new Date(a.metadata?.updatedAt || 0).getTime() - new Date(b.metadata?.updatedAt || 0).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [recipes, searchQuery, selectedClassification, sortBy])

  // Calcular estadísticas
  const stats = useMemo(() => {
    const totalRecipes = recipes.length
    const subRecipes = recipes.filter((r) => r.classification === SUBRECIPE_CLASSIFICATION).length
    const avgCost = recipes.length > 0 ? recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / recipes.length : 0
    const totalValue = recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0)

    return { totalRecipes, subRecipes, avgCost, totalValue }
  }, [recipes])

  // Function to check if ingredient exists in target database
  // Manejar migración
  const handleMigration = async () => {
    if (!selectedTargetBusiness || !recipeToMigrate) {
      showError("Selecciona destino", "Debes seleccionar un negocio de destino")
      return
    }

    try {
      setIsMigrating(true)
      console.log("🚀 Iniciando migración de receta:", recipeToMigrate.name)

      // Usar la función mejorada de migración completa
      const migrationResult = await migrateCompleteRecipe(recipeToMigrate, businessId, selectedTargetBusiness)

      if (!migrationResult.success || !migrationResult.migratedRecipe) {
        throw new Error(migrationResult.error || "Error en migración")
      }

      const { migratedRecipe, migratedIngredients, migratedSubRecipes, skippedIngredients } = migrationResult

      if (recipeToMigrate.classification === SUBRECIPE_CLASSIFICATION || recipeToMigrate.isSubRecipe) {
        await syncSubRecipeToIngredient(migratedRecipe, selectedTargetBusiness)
        console.log("✅ Sub-receta sincronizada en destino")
      }

      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: {
            businessId: selectedTargetBusiness,
            action: "migrated",
          },
        }),
      )

      setShowMigrationDialog(false)
      setRecipeToMigrate(null)
      setSelectedTargetBusiness("")

      let message = `Receta "${recipeToMigrate.name}" migrada exitosamente`
      if (migratedSubRecipes.length > 0) {
        message += `\n• ${migratedSubRecipes.length} sub-receta${migratedSubRecipes.length !== 1 ? "s" : ""} migrada${migratedSubRecipes.length !== 1 ? "s" : ""} junto con sus propios ingredientes`
      }
      if (migratedIngredients.length > 0) {
        message += `\n• ${migratedIngredients.length} ingredientes migrados`
      }
      if (skippedIngredients.length > 0) {
        message += `\n• ${skippedIngredients.length} ingredientes ya existían (reutilizados)`
      }
      if (recipeToMigrate.classification === SUBRECIPE_CLASSIFICATION || recipeToMigrate.isSubRecipe) {
        message += `\n• Ingrediente de sub-receta creado automáticamente`
      }

      showSuccess("Migración completada", message)
      console.log("✅ Migración completada exitosamente")
    } catch (error) {
      console.error("❌ Error migrating recipe:", error)
      showError("Error en migración", error instanceof Error ? error.message : "No se pudo migrar la receta")
    } finally {
      setIsMigrating(false)
    }
  }

  // Manejar eliminación
  const handleDelete = (recipe: Recipe) => {
    setRecipeToDelete(recipe)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!recipeToDelete) return

    try {
      const success = await deleteRecipeFromStorage(recipeToDelete.id, businessId)

      if (!success) {
        throw new Error("No se pudo eliminar la receta")
      }

      if (recipeToDelete.classification === SUBRECIPE_CLASSIFICATION || recipeToDelete.isSubRecipe) {
        await deleteSubRecipeIngredient(recipeToDelete.id, businessId)
      }

      const updatedRecipes = getRecipes(businessId)
      setRecipes(updatedRecipes)

      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: {
            businessId,
            action: "delete",
            recipeId: recipeToDelete.id,
          },
        }),
      )

      showSuccess("Receta movida a la papelera", "Puedes restaurarla desde la papelera durante los próximos 30 días")
      setShowDeleteDialog(false)
      setRecipeToDelete(null)
    } catch (error) {
      console.error("Error deleting recipe:", error)
      showError("Error al eliminar", "No se pudo eliminar la receta")
    }
  }

  // Papelera de recetas (ver documento de continuidad)
  const openTrash = async () => {
    await ensureTrashLoaded(businessId)
    setTrashedRecipes(getTrashedRecipes(businessId))
    setShowTrashDialog(true)
  }

  const handleRestore = async (recipeId: string) => {
    try {
      const success = await restoreRecipeFromTrash(recipeId, businessId)
      if (!success) throw new Error("No se pudo restaurar la receta")

      setRecipes(getRecipes(businessId))
      setTrashedRecipes(getTrashedRecipes(businessId))
      showSuccess("Receta restaurada", "La receta volvió a Mis Recetas")
    } catch (error) {
      console.error("Error restoring recipe:", error)
      showError("Error al restaurar", "No se pudo restaurar la receta")
    }
  }

  const handlePermanentDelete = async (recipeId: string) => {
    try {
      const success = await permanentlyDeleteRecipe(recipeId, businessId)
      if (!success) throw new Error("No se pudo eliminar la receta")

      setTrashedRecipes(getTrashedRecipes(businessId))
      showSuccess("Receta eliminada permanentemente", "Esta acción no se puede deshacer")
    } catch (error) {
      console.error("Error permanently deleting recipe:", error)
      showError("Error al eliminar", "No se pudo eliminar la receta permanentemente")
    }
  }

  // Manejar duplicación
  const handleDuplicate = (recipe: Recipe) => {
    try {
      const duplicatedRecipe: Recipe = {
        ...recipe,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${recipe.name} (Copia)`,
        businessId,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          copiedFrom: recipe.id,
        },
      }

      const currentRecipes = getRecipes(businessId)
      const updatedRecipes = [...currentRecipes, duplicatedRecipe]
      saveRecipes(updatedRecipes, businessId)
      setRecipes(updatedRecipes)

      window.dispatchEvent(
        new CustomEvent("recipesUpdated", {
          detail: {
            businessId,
            action: "duplicate",
            recipeId: duplicatedRecipe.id,
          },
        }),
      )

      showSuccess("Receta duplicada", "Se ha creado una copia de la receta")
    } catch (error) {
      console.error("Error duplicating recipe:", error)
      showError("Error al duplicar", "No se pudo duplicar la receta")
    }
  }

  // Manejar migración desde card
  const handleMigrateFromCard = (recipe: Recipe) => {
    setRecipeToMigrate(recipe)
    setShowMigrationDialog(true)
  }

  const handleEdit = (recipe: Recipe) => {
    router.push(`/ficha-tecnica/${recipe.id}?business=${businessId}&mode=edit`)
  }

  const handleView = (recipe: Recipe) => {
    router.push(`/ficha-tecnica/${recipe.id}?business=${businessId}&mode=view`)
  }

  if (!authChecked) {
    return null
  }

  if (!isLoggedIn) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Por favor, inicia sesión para ver esta página.</p>
      </div>
    )
  }

  if (canAccessRecipes === null) {
    return null
  }

  if (!canAccessRecipes) {
    return <AdminRestrictedPage sectionName="Mis Recetas" />
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-2 md:p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <MisRecetasTour />
          {/* Header Section - Responsivo */}
          <div className="flex flex-col gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                <Link href={businessId ? `/business/${businessId}` : "/dashboard"}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 md:gap-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200 p-2 md:p-3"
                  >
                    <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Volver</span>
                  </Button>
                </Link>
                <div className="flex-1 sm:flex-none" data-tour="recetas-header">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                    Mis Recetas
                  </h1>
                  <p className="text-xs md:text-sm lg:text-base text-muted-foreground hidden sm:block">
                    Gestiona y organiza todas tus recetas de cocina
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <Link href={`/ficha-tecnica${businessId ? `?business=${businessId}` : ""}`}>
                  <Button data-tour="recetas-new" className="gap-1 md:gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg text-xs md:text-sm px-3 md:px-4 py-2">
                    <Plus className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">Nueva Receta</span>
                    <span className="sm:hidden">Nueva</span>
                  </Button>
                </Link>

                {/* BUG CORREGIDO: openTrash() antes solo estaba conectado a un botón dentro
                    del estado vacío "0 resultados" — cualquier negocio con recetas visibles
                    no tenía forma de llegar a la Papelera. Ahora es un botón permanente aquí. */}
                <Button
                  data-tour="recetas-trash"
                  variant="outline"
                  size="sm"
                  onClick={openTrash}
                  className="gap-1 md:gap-2 border-border text-xs md:text-sm px-3 md:px-4 py-2"
                >
                  <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Papelera</span>
                </Button>

                {/* Botón de filtros móvil */}
                {isMobile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-1 border-border px-3 py-2"
                  >
                    <Filter className="h-3 w-3" />
                    {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </div>

            {/* Statistics Dashboard - Grid responsivo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-tour="recetas-stats">
              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                      <ChefHat className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-lg md:text-2xl font-bold text-foreground">{stats.totalRecipes}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-green-50 dark:bg-green-950/40 rounded-lg">
                      <Users className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-lg md:text-2xl font-bold text-foreground">{stats.subRecipes}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">Sub-recetas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                      <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <p className="text-lg md:text-2xl font-bold text-foreground">{formatCurrency(stats.avgCost)}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">Costo Prom.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-1.5 md:p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg">
                      <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-lg md:text-2xl font-bold text-foreground">
                        {formatCurrency(stats.totalValue)}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground">Valor Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Search - Responsivo */}
            <Card className="border-border shadow-lg bg-card">
              <CardContent className="p-4 md:p-6">
                {/* Búsqueda siempre visible */}
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Buscar recetas por nombre, clasificación o plato..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-border focus:ring-2 focus:ring-primary text-sm md:text-base"
                    />
                  </div>

                  {/* Filtros - Colapsables en móvil */}
                  <div
                    className={`${isMobile && !showFilters ? "hidden" : "flex"} flex-col md:flex-row gap-3 md:gap-4`}
                  >
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                      <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                        <SelectTrigger className="w-full sm:w-48 border-border focus:ring-2 focus:ring-primary">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {classificationFilterOptions.map((classification) => (
                            <SelectItem key={classification} value={classification}>
                              {classification === "Todas"
                                ? "Todas"
                                : getClassificationLabel(classification as (typeof recipeClassifications)[number], language)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-48 border-border focus:ring-2 focus:ring-primary">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* View Mode Toggle - Solo en desktop */}
                    <div className="hidden md:flex items-center gap-2">
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="gap-2"
                      >
                        <Grid3X3 className="h-4 w-4" />
                        Grid
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="gap-2"
                      >
                        <List className="h-4 w-4" />
                        Lista
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Summary - Responsivo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 md:p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-lg px-2 md:px-3 py-1 bg-muted text-foreground font-medium text-xs md:text-sm"
                >
                  {filteredAndSortedRecipes.length} recetas encontradas
                </Badge>
                {selectedClassification !== "Todas" && (
                  <Badge
                    variant="outline"
                    className="rounded-lg px-2 md:px-3 py-1 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 text-xs"
                  >
                    {getClassificationLabel(selectedClassification as (typeof recipeClassifications)[number], language)}
                  </Badge>
                )}
                {searchQuery && (
                  <Badge
                    variant="outline"
                    className="rounded-lg px-2 md:px-3 py-1 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 text-xs"
                  >
                    Búsqueda: "{searchQuery.length > 20 ? searchQuery.substring(0, 20) + "..." : searchQuery}"
                  </Badge>
                )}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                {isMobile
                  ? `${filteredAndSortedRecipes.length} resultados`
                  : `Mostrando ${filteredAndSortedRecipes.length} de ${recipes.length} recetas`}
              </div>
            </div>
          </div>

          {/* Main Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredAndSortedRecipes.length === 0 ? (
            <Card className="border-border shadow-xl bg-card">
              <CardContent className="flex flex-col items-center justify-center py-12 md:py-16">
                <ChefHat className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4 md:mb-6" />
                <h3 className="text-lg md:text-xl font-semibold mb-2 md:mb-3 text-foreground text-center">
                  {recipes.length === 0 ? "No hay recetas registradas" : "No se encontraron recetas"}
                </h3>
                <p className="text-muted-foreground text-center mb-6 md:mb-8 text-sm md:text-base px-4">
                  {recipes.length === 0
                    ? "Comienza creando tu primera receta con nuestra ficha técnica."
                    : "Intenta ajustar los filtros de búsqueda para encontrar lo que buscas."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Link href={`/ficha-tecnica${businessId ? `?business=${businessId}` : ""}`}>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      {recipes.length === 0 ? "Crear Primera Receta" : "Nueva Receta"}
                    </Button>
                  </Link>
                  {recipes.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("")
                        setSelectedClassification("Todas")
                      }}
                      className="border-border hover:bg-accent w-full sm:w-auto"
                    >
                      Limpiar Filtros
                    </Button>
                  )}
                  <Button variant="outline" onClick={openTrash} className="border-border hover:bg-accent w-full sm:w-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Papelera
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div
              className={`grid gap-4 md:gap-6 ${
                viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
              }`}
            >
              {filteredAndSortedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  businessId={businessId}
                  viewMode={isMobile ? "list" : viewMode}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onView={handleView}
                  onMigrate={availableBusinesses.length > 0 || businessId !== "main" ? handleMigrateFromCard : undefined}
                  onOpenDetails={setDetailsRecipe}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-border max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-300 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirmar Eliminación
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm md:text-base">
              ¿Estás seguro de que quieres eliminar la receta <strong>"{recipeToDelete?.name}"</strong>? Esta acción no
              se puede deshacer.
            </p>
            {recipeToDelete?.classification === SUBRECIPE_CLASSIFICATION && (
              <Alert className="mt-4 border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                <AlertDescription className="text-amber-800 dark:text-amber-300">
                  <strong>Nota:</strong> Esta es una sub-receta. Al eliminarla, también se eliminará el ingrediente
                  asociado automáticamente.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setRecipeToDelete(null)
              }}
              className="border-border w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <DialogContent className="bg-card border-border max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Migrar Receta a Otro Negocio
            </DialogTitle>
            <DialogDescription>
              <p className="text-base text-foreground mt-2">
                Estás a punto de migrar la receta <strong>"{recipeToMigrate?.name}"</strong> a otro negocio.
              </p>
              <Alert className="mt-4 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40">
                <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  <p className="text-sm font-medium mb-1.5">Se migrará todo junto:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Se creará una copia de la receta en el negocio destino</li>
                    <li>Los ingredientes utilizados se migrarán si no existen en el destino</li>
                    <li>
                      Si la receta usa sub-recetas, esas sub-recetas también se migrarán completas (con sus propios
                      ingredientes), no solo como un costo
                    </li>
                    <li>Los ingredientes migrados tendrán un indicador especial</li>
                    {recipeToMigrate?.classification === SUBRECIPE_CLASSIFICATION && (
                      <li>Se creará el ingrediente correspondiente para la sub-receta</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-business" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Negocio destino
              </Label>
              <Select value={selectedTargetBusiness} onValueChange={setSelectedTargetBusiness}>
                <SelectTrigger id="target-business">
                  <SelectValue placeholder="Selecciona un negocio" />
                </SelectTrigger>
                <SelectContent>
                  {businessId !== "main" && <SelectItem value="main">Dashboard Principal</SelectItem>}
                  {availableBusinesses.map((business) => (
                    <SelectItem key={business.id} value={business.id}>
                      {business.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowMigrationDialog(false)
                setRecipeToMigrate(null)
                setSelectedTargetBusiness("")
              }}
              disabled={isMigrating}
              className="border-border w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMigration}
              disabled={!selectedTargetBusiness || isMigrating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
            >
              {isMigrating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Migrando...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Migrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Papelera de recetas, ver documento de continuidad. Retención de 30 días. */}
      <Dialog open={showTrashDialog} onOpenChange={setShowTrashDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Papelera de Recetas
            </DialogTitle>
            <DialogDescription>
              Las recetas eliminadas se conservan aquí 30 días antes de borrarse definitivamente.
            </DialogDescription>
          </DialogHeader>

          {trashedRecipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">La papelera está vacía.</div>
          ) : (
            <div className="space-y-3">
              {trashedRecipes.map(({ recipe, deletedAt }) => {
                const daysRemaining = getTrashDaysRemaining(deletedAt)
                return (
                  <Card key={recipe.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{recipe.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Eliminada el {new Date(deletedAt).toLocaleDateString()} ·{" "}
                          {daysRemaining > 0
                            ? `${daysRemaining} día${daysRemaining === 1 ? "" : "s"} restante${daysRemaining === 1 ? "" : "s"}`
                            : "Se purgará muy pronto"}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(recipe.id)}>
                          Restaurar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handlePermanentDelete(recipe.id)}>
                          Borrar ya
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Panel lateral de opciones, se abre con doble clic en una receta */}
      <Sheet open={detailsRecipe !== null} onOpenChange={(open) => !open && setDetailsRecipe(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          {detailsRecipe && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="pr-6">{detailsRecipe.name}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        detailsRecipe.classification === SUBRECIPE_CLASSIFICATION
                          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {detailsRecipe.classification || "Sin clasificar"}
                    </Badge>
                    {detailsRecipe.plate && <Badge variant="secondary">{detailsRecipe.plate}</Badge>}
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-3 py-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Costo total</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(detailsRecipe.totalCost || 0)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Precio de venta</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(detailsRecipe.unitPrice || 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Rendimiento</p>
                  <p className="text-lg font-semibold text-foreground">
                    {detailsRecipe.yieldAmount || detailsRecipe.servings || ""}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Ingredientes</p>
                  <p className="text-lg font-semibold text-foreground">{detailsRecipe.ingredients?.length || 0}</p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2 py-4">
                <Button
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleView(detailsRecipe)
                    setDetailsRecipe(null)
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Ver ficha completa
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleEdit(detailsRecipe)
                    setDetailsRecipe(null)
                  }}
                >
                  <Edit className="h-4 w-4" />
                  Editar receta
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleDuplicate(detailsRecipe)
                    setDetailsRecipe(null)
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Duplicar receta
                </Button>
                {(availableBusinesses.length > 0 || businessId !== "main") && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      handleMigrateFromCard(detailsRecipe)
                      setDetailsRecipe(null)
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Migrar a otro negocio
                  </Button>
                )}
              </div>

              <SheetFooter className="mt-auto">
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    handleDelete(detailsRecipe)
                    setDetailsRecipe(null)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar receta
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
