"use client"

import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Edit, Trash2, Lock, Info } from "lucide-react"
import type { Ingredient, Presentation, Unit } from "@/types/ingredient"
import { units, presentations, unitAbbreviations } from "@/types/ingredient"
import { convertBetweenUnits } from "@/lib/utils/calculations"
import { formatCurrency } from "@/lib/utils/consolidated-utils"
import { setDashboardData } from "@/utils/dashboard-data"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCategoryMermaPercentage } from "@/lib/merma-categories"
import { useLanguage } from "@/contexts/language-context"

type Props = {
  // Items to display (already filtered/sorted in the parent)
  items: Ingredient[]
  // Full source array for persistence updates
  allItems: Ingredient[]
  businessId?: string | null
  onEdit: (ingredient: Ingredient) => void
  onDelete: (ingredient: Ingredient) => void
  onChange?: (updated: Ingredient[]) => void
  // Se dispara solo cuando el usuario cambia la unidad de un ingrediente individual desde
  // esta tabla — a diferencia de onChange, que cubre cualquier edición. El padre lo usa para
  // devolver el switch métrico/imperial a su posición neutral (ya no todos los ingredientes
  // comparten el mismo sistema de unidades).
  onUnitChange?: () => void
  mermaSystemEnabled?: boolean
}

export function IngredientsTable({
  items,
  allItems,
  businessId,
  onEdit,
  onDelete,
  onChange,
  onUnitChange,
  mermaSystemEnabled,
}: Props) {
  const { t } = useLanguage()
  const [wacInfoIngredientId, setWacInfoIngredientId] = useState<string | null>(null)
  const wacInfoIngredient = wacInfoIngredientId ? allItems.find((i) => i.id === wacInfoIngredientId) || null : null
  const persist = useCallback(
    (updated: Ingredient[]) => {
      setDashboardData("ingredients", updated, businessId ?? undefined)
      // Notify other views
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ingredientsUpdated", {
            detail: {
              businessId: businessId || "main",
              action: "update",
            },
          }),
        )
      }
      onChange?.(updated)
    },
    [businessId, onChange],
  )

  const updateById = useCallback(
    (id: string, updater: (ing: Ingredient) => Ingredient) => {
      const updated = allItems.map((ing) => (ing.id === id ? updater(ing) : ing))
      persist(updated)
    },
    [allItems, persist],
  )

  const handleUnitChange = useCallback(
    (ingredient: Ingredient, newUnit: Unit) => {
      if (ingredient.unit === newUnit) return

      // Special handling for "unidad" - ingredients measured by individual units
      let convertedContent: number
      const currentContent = ingredient.pricing?.netContent || 0

      if (ingredient.unit === "unidad" || newUnit === "unidad") {
        // When converting from/to "unidad", maintain the numeric value but adjust context
        convertedContent = currentContent
      } else {
        // Normal unit conversion for weight/volume measurements
        convertedContent = convertBetweenUnits(currentContent, ingredient.unit, newUnit)
      }

      const purchasePrice = ingredient.pricing?.purchasePrice || 0
      const newPricePerUnit = convertedContent > 0 ? purchasePrice / convertedContent : 0

      updateById(ingredient.id, (ing) => ({
        ...ing,
        unit: newUnit,
        pricing: {
          ...ing.pricing,
          netContent: Math.round(convertedContent * 10000) / 10000, // 4 decimales de precisión interna
          pricePerUnit: Math.round(newPricePerUnit * 10000) / 10000, // 4 decimales de precisión interna
        },
        metadata: {
          ...ing.metadata,
          updatedAt: new Date().toISOString(),
          version: (ing.metadata?.version || 0) + 1,
        },
      }))
      onUnitChange?.()
    },
    [updateById, onUnitChange],
  )

  const handlePresentationChange = useCallback(
    (ingredient: Ingredient, newPresentation: Presentation) => {
      updateById(ingredient.id, (ing) => ({
        ...ing,
        presentation: newPresentation,
        metadata: {
          ...ing.metadata,
          updatedAt: new Date().toISOString(),
          version: (ing.metadata?.version || 0) + 1,
        },
      }))
    },
    [updateById],
  )

  const getMermaStatus = (ingredient: Ingredient) => {
    if (!mermaSystemEnabled) return null

    const mermaData = ingredient.merma

    // Si tiene merma habilitada explícitamente
    if (mermaData?.enabled) {
      return mermaData.useGlobal ? "global" : "custom"
    }

    // Si no tiene merma habilitada, verificar si la categoría tiene merma por defecto
    const categoryPercentage = getCategoryMermaPercentage(ingredient.category)
    if (categoryPercentage > 0) {
      return "global" // La categoría tiene merma global por defecto
    }

    // No tiene merma
    return null
  }

  const renderMermaIndicator = (ingredient: Ingredient) => {
    const status = getMermaStatus(ingredient)
    if (!status) return null

    const globalPercentage = getCategoryMermaPercentage(ingredient.category)

    switch (status) {
      case "global":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-100 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-300">
                G
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {t("ingredientes_tooltip_merma_global")}: {ingredient.merma?.globalPercentage || globalPercentage}%
              </p>
            </TooltipContent>
          </Tooltip>
        )
      case "custom":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-4 h-4 bg-orange-100 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold border border-orange-300">
                P
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {t("ingredientes_tooltip_merma_custom")}: {ingredient.merma?.customPercentage || ingredient.merma?.customValue || 0}
                {ingredient.merma?.customType === "percentage" ? "%" : ` ${t("ingredientes_units_suffix")}`}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      default:
        return null
    }
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        {mermaSystemEnabled && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t("ingredientes_merma_banner_active_title")}</span>
              <span className="text-xs text-blue-600 dark:text-blue-300">
                {t("ingredientes_table_merma_banner_desc")}
              </span>
            </div>
          </div>
        )}

        <table className="w-full min-w-[1200px]">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="px-4 py-4 text-left text-sm font-semibold text-foreground w-[14%]">{t("ingredientes_col_category")}</th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-foreground w-[18%]">
                {t("ingredientes_col_name")}
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[10%]">{t("ingredientes_field_presentation_label")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[8%]">{t("ingredientes_col_unit")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[12%]">{t("ingredientes_col_purchase_price")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[10%]">{t("ingredientes_col_net_content")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[12%]">{t("ingredientes_col_price_per_unit")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[10%]">{t("ingredientes_col_supplier")}</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-foreground w-[6%]">{t("ingredientes_col_actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((ingredient, index) => {
              const purchasePrice = ingredient.pricing?.purchasePrice || 0
              const netContent = ingredient.pricing?.netContent || 0
              const pricePerUnit = ingredient.pricing?.pricePerUnit || (netContent > 0 ? purchasePrice / netContent : 0)
              const weightedAverageCost = ingredient.pricing?.weightedAverageCost

              // Check if unit is "unidad" (should be locked)
              const isUnitLocked = ingredient.unit === "unidad"

              // Check if presentation is already selected (should be locked)
              const isPresentationLocked = Boolean(ingredient.presentation)

              return (
                <tr
                  key={ingredient.id}
                  className={`hover:bg-muted/20 transition-colors ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                >
                  {/* Categoría */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${
                          ingredient.category === "Sub Receta / produccion (Mise en place)"
                            ? "border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40"
                            : "border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40"
                        }`}
                      >
                        {ingredient.category}
                      </Badge>
                      {renderMermaIndicator(ingredient)}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="font-medium text-foreground text-sm leading-tight">{ingredient.name}</span>
                  </td>

                  {/* Presentación (dropdown con bloqueo) */}
                  <td className="px-4 py-4 text-center">
                    {isPresentationLocked ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-muted-foreground/20 w-[120px] justify-center mx-auto cursor-help">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{ingredient.presentation}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-center">
                            <p className="font-medium">🔒 {t("ingredientes_tooltip_presentation_locked_title")}</p>
                            <p className="text-xs">{t("ingredientes_tooltip_edit_to_change")}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Select
                        value={ingredient.presentation || ""}
                        onValueChange={(val) => handlePresentationChange(ingredient, val as Presentation)}
                      >
                        <SelectTrigger className="w-[120px] mx-auto h-9">
                          <SelectValue placeholder={t("ingredientes_select_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {presentations.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  {/* Unidad (dropdown con bloqueo especial para "unidad") */}
                  <td className="px-4 py-4 text-center">
                    {isUnitLocked ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 rounded-md border border-red-200 dark:border-red-900 w-[100px] justify-center mx-auto cursor-help">
                            <Lock className="h-3 w-3 text-red-600 dark:text-red-300" />
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">{ingredient.unit}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-center">
                            <p className="font-medium text-red-600 dark:text-red-300">
                              ⚠️ {t("ingredientes_tooltip_unit_locked_title").replace("{unit}", "unidad")}
                            </p>
                            <p className="text-xs">{t("ingredientes_tooltip_unit_locked_desc")}</p>
                            <p className="text-xs">{t("ingredientes_tooltip_edit_to_change")}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Select
                        value={ingredient.unit}
                        onValueChange={(val) => handleUnitChange(ingredient, val as Unit)}
                      >
                        <SelectTrigger className="w-[100px] mx-auto h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-green-600 dark:text-green-300 text-sm">
                        {formatCurrency(Number(purchasePrice.toFixed(2)))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ingredient.presentation || t("ingredientes_no_presentation_label")}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium text-sm text-foreground">
                        {ingredient.unit === "unidad" ? Math.round(netContent) : Number(netContent.toFixed(2))}
                      </span>
                      <span className="text-xs text-muted-foreground">{ingredient.unit}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-primary text-sm">
                        {formatCurrency(Number(pricePerUnit.toFixed(2)))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("ingredientes_per_prefix")} {unitAbbreviations[ingredient.unit] || ingredient.unit}
                      </span>
                      {typeof weightedAverageCost === "number" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setWacInfoIngredientId(ingredient.id)}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300 font-medium cursor-pointer mt-0.5 hover:underline"
                            >
                              {t("ingredientes_weighted_avg_label")}: {formatCurrency(Number(weightedAverageCost.toFixed(2)))}
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("ingredientes_weighted_avg_tooltip")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>

                  {/* Proveedor */}
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm text-foreground font-medium">
                        {ingredient.supplier || t("ingredientes_no_supplier")}
                      </span>
                      {ingredient.metadata?.updatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {t("ingredientes_updated_on_label")}: {new Date(ingredient.metadata.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Acciones - TODOS LOS INGREDIENTES PUEDEN SER ELIMINADOS */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(ingredient)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 dark:bg-blue-950/40 hover:text-blue-600 dark:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("ingredientes_tooltip_edit_ingredient")}</p>
                          {(isUnitLocked || isPresentationLocked) && (
                            <p className="text-xs text-amber-600 dark:text-amber-300">{t("ingredientes_tooltip_edit_unlocks_fields")}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>

                      {/* BOTÓN ELIMINAR PARA TODOS LOS INGREDIENTES - SIN RESTRICCIONES */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(ingredient)}
                            className="h-8 w-8 p-0 hover:bg-red-50 dark:bg-red-950/40 hover:text-red-600 dark:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("ingredientes_tooltip_delete_ingredient")}</p>
                          {ingredient.category === "Sub Receta / produccion (Mise en place)" && (
                            <p className="text-xs text-amber-600 dark:text-amber-300">⚠️ {t("ingredientes_tooltip_delete_subrecipe_warning")}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={wacInfoIngredient !== null} onOpenChange={(open) => !open && setWacInfoIngredientId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              {t("ingredientes_weighted_avg_info_title")}
            </DialogTitle>
          </DialogHeader>
          {wacInfoIngredient && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{t("ingredientes_weighted_avg_info_desc")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs">
                {t("ingredientes_weighted_avg_info_formula")}
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300">
                {t("ingredientes_weighted_avg_info_current_label")}{" "}
                <span className="font-bold">
                  {formatCurrency(Number((wacInfoIngredient.pricing?.weightedAverageCost || 0).toFixed(2)))}
                </span>{" "}
                {t("ingredientes_per_prefix")} {unitAbbreviations[wacInfoIngredient.unit] || wacInfoIngredient.unit}
                {typeof wacInfoIngredient.pricing?.weightedAverageQuantity === "number" && (
                  <>
                    {" "}
                    ({wacInfoIngredient.pricing.weightedAverageQuantity} {wacInfoIngredient.unit})
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
