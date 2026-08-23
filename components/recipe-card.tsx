"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Eye,
  Edit,
  Trash2,
  Copy,
  MoreVertical,
  Clock,
  Users,
  DollarSign,
  ChefHat,
  Utensils,
  Calendar,
  ArrowRightLeft,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import type { Recipe } from "@/types/recipe"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { getClassificationLabel } from "@/lib/classification-labels"

interface RecipeCardProps {
  recipe: Recipe
  businessId?: string | null
  viewMode?: "grid" | "list"
  onEdit: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  onDuplicate: (recipe: Recipe) => void
  onView: (recipe: Recipe) => void
  onMigrate?: (recipe: Recipe) => void
  /** Doble click en la tarjeta: abre el panel lateral con todas las opciones de la receta. */
  onOpenDetails?: (recipe: Recipe) => void
}

export function RecipeCard({
  recipe,
  businessId,
  viewMode = "grid",
  onEdit,
  onDelete,
  onDuplicate,
  onView,
  onMigrate,
  onOpenDetails,
}: RecipeCardProps) {
  const [imageError, setImageError] = useState(false)
  const { language } = useLanguage()

  // Calcular estadísticas de la receta
  // BUG CORREGIDO: unitCost/yield/procedures no existen en Recipe (types/recipe.ts) —
  // siempre daban undefined, así que "Porciones" mostraba 1 y "Pasos" mostraba 0 para
  // TODAS las recetas sin importar sus valores reales. Los campos reales son
  // costPerServing, yieldAmount y procedure.
  const stats = {
    totalCost: recipe.totalCost || 0,
    costPerServing: recipe.costPerServing || 0,
    yield: recipe.yieldAmount || 1,
    ingredientsCount: recipe.ingredients?.length || 0,
    proceduresCount: recipe.procedure?.length || 0,
  }

  // Determinar el color del badge según la clasificación
  const getClassificationColor = (classification: string) => {
    const colors = {
      Entrada: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
      "Plato Principal": "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
      Postre: "bg-pink-50 text-pink-700 border-pink-200",
      Bebida: "bg-cyan-50 text-cyan-700 border-cyan-200",
      "Sub Receta": "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
      Aperitivo: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900",
      Guarnición: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900",
      Salsa: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
      Panadería: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
      Repostería: "bg-rose-50 text-rose-700 border-rose-200",
    }
    return colors[classification as keyof typeof colors] || "bg-gray-50 text-gray-700 border-gray-200"
  }

  // Vista de lista (móvil y desktop)
  if (viewMode === "list") {
    return (
      <Card
        className="border-border shadow-md hover:shadow-lg transition-all duration-300 bg-card cursor-pointer"
        onDoubleClick={() => onOpenDetails?.(recipe)}
        title="Doble clic para ver todas las opciones"
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Imagen - Más pequeña en móvil */}
            <div className="flex-shrink-0">
              <div className="w-full sm:w-24 h-20 sm:h-24 bg-muted rounded-lg overflow-hidden">
                {recipe.image && !imageError ? (
                  <img
                    src={recipe.image || "/placeholder.svg"}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ChefHat className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base sm:text-lg truncate">{recipe.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getClassificationColor(recipe.classification || "Otros")}`}
                    >
                      {recipe.classification ? getClassificationLabel(recipe.classification, language) : "Sin clasificar"}
                    </Badge>
                    {recipe.plate && (
                      <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                        <Utensils className="h-3 w-3 mr-1" />
                        {recipe.plate}
                      </Badge>
                    )}
                    {recipe.metadata?.migratedFrom && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900">
                        <ArrowRightLeft className="h-2 w-2 mr-1" />
                        Migrada
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Menú de acciones */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onView(recipe)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver receta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(recipe)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(recipe)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicar
                    </DropdownMenuItem>
                    {onMigrate && (
                      <DropdownMenuItem onClick={() => onMigrate(recipe)}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Migrar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(recipe)} className="text-red-600 dark:text-red-300 focus:text-red-600 dark:text-red-300">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Estadísticas en grid compacto para móvil */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-300" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-300">{formatCurrency(stats.totalCost)}</p>
                    <p className="text-muted-foreground text-xs">Costo total</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-300" />
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-300">{stats.yield}</p>
                    <p className="text-muted-foreground text-xs">Porciones</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <ChefHat className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-300" />
                  <div>
                    <p className="font-medium text-purple-600 dark:text-purple-300">{stats.ingredientsCount}</p>
                    <p className="text-muted-foreground text-xs">Ingredientes</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-300">
                      {recipe.metadata?.updatedAt
                        ? new Date(recipe.metadata.updatedAt).toLocaleDateString(getDateLocale(language), {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "N/A"}
                    </p>
                    <p className="text-muted-foreground text-xs">Actualizada</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Vista de grid (solo desktop)
  return (
    <Card
      className="border-border shadow-md hover:shadow-xl transition-all duration-300 bg-card group cursor-pointer"
      onDoubleClick={() => onOpenDetails?.(recipe)}
      title="Doble clic para ver todas las opciones"
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg leading-tight line-clamp-2">{recipe.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={`text-xs ${getClassificationColor(recipe.classification || "Otros")}`}
              >
                {recipe.classification ? getClassificationLabel(recipe.classification, language) : "Sin clasificar"}
              </Badge>
              {recipe.plate && (
                <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                  <Utensils className="h-3 w-3 mr-1" />
                  {recipe.plate}
                </Badge>
              )}
              {recipe.metadata?.migratedFrom && (
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900">
                  <ArrowRightLeft className="h-2 w-2 mr-1" />
                  Migrada
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView(recipe)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver receta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(recipe)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(recipe)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              {onMigrate && (
                <DropdownMenuItem onClick={() => onMigrate(recipe)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Migrar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(recipe)} className="text-red-600 dark:text-red-300 focus:text-red-600 dark:text-red-300">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Imagen */}
        <div className="w-full h-48 bg-muted rounded-lg overflow-hidden mb-4">
          {recipe.image && !imageError ? (
            <img
              src={recipe.image || "/placeholder.svg"}
              alt={recipe.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ChefHat className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Estadísticas */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-300" />
              <div>
                <p className="font-medium text-green-600 dark:text-green-300">{formatCurrency(stats.totalCost)}</p>
                <p className="text-muted-foreground text-xs">Costo total</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <div>
                <p className="font-medium text-blue-600 dark:text-blue-300">{stats.yield} porciones</p>
                <p className="text-muted-foreground text-xs">Rendimiento</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-purple-600 dark:text-purple-300" />
              <div>
                <p className="font-medium text-purple-600 dark:text-purple-300">{stats.ingredientsCount}</p>
                <p className="text-muted-foreground text-xs">Ingredientes</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-300">{stats.proceduresCount}</p>
                <p className="text-muted-foreground text-xs">Pasos</p>
              </div>
            </div>
          </div>

          {/* Fecha de actualización */}
          {recipe.metadata?.updatedAt && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Actualizada:{" "}
                {new Date(recipe.metadata.updatedAt).toLocaleDateString(getDateLocale(language), {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Indicador de migración */}
          {recipe.metadata?.migratedFrom && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-blue-600 dark:text-blue-300 flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                Migrada desde {recipe.metadata.migratedFrom === "main" ? "dashboard principal" : "otro negocio"}
              </p>
            </div>
          )}
        </div>

        {/* Botones de acción principales */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(recipe)}
            className="flex-1 border-border hover:bg-accent"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onEdit(recipe)}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
