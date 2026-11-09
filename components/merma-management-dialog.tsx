"use client"

import { signalJourney } from "@/lib/journey"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, RefreshCw, Info, Lock } from "lucide-react"
import { useFeatureAccess } from "@/lib/plan-access"
import { getCategoryMermaPercentage, calculateCategoryMerma, getMermaLevel } from "@/lib/merma-categories"
import { MermaInfoDialog } from "./merma-info-dialog"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryLabel, getMermaLevelLabel, getUnitLabel, getUnitLabelFor } from "@/lib/ingredient-labels"
import { formatCurrency, formatUnitPrice } from "@/lib/currency"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  previewIngredientCostChanges,
  recalculateAfterIngredientChanges,
  requestSubRecipePricePrompt,
  type RecalculationResult,
} from "@/lib/recalculate"
import { getIngredients } from "@/lib/storage/ingredients"
import { useAuth } from "@/contexts/auth-context"
import { logActivity, logPriceRuleChanges } from "@/lib/services/activity-log"
import type { Ingredient } from "@/types/ingredient"

interface MermaManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId?: string | null
  ingredients: Ingredient[]
  onSave?: (updatedIngredients: Ingredient[]) => void | Promise<void>
}

export function MermaManagementDialog({
  open,
  onOpenChange,
  businessId,
  ingredients: initialIngredients,
  onSave,
}: MermaManagementDialogProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [mermaSystemActive, setMermaSystemActive] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  // Recetas que cambian de costo con la merma nueva: se muestran antes de guardar (docs/228).
  const [recalcPreview, setRecalcPreview] = useState<RecalculationResult | null>(null)
  const [originalValues, setOriginalValues] = useState<{ [key: string]: { netContent: number; pricePerUnit: number } }>(
    {},
  )
  const { toast } = useToast()
  const { t, language } = useLanguage()
  const { user } = useAuth()
  // Merma por categoría en todos los planes; la personalizada por ingrediente, desde Home
  // Cook (docs/272). Quien bajó de plan conserva sus valores y puede volver a la global.
  const canCustom = useFeatureAccess("merma_custom") === true

  useEffect(() => {
    if (open && initialIngredients.length > 0) {
      // Guardar valores originales al abrir el diálogo
      const originals: { [key: string]: { netContent: number; pricePerUnit: number } } = {}

      const processedIngredients = initialIngredients.map((ing) => {
        // Guardar valores originales si no están ya guardados
        if (!ing.originalNetContent) {
          originals[ing.id] = {
            netContent: ing.pricing.netContent,
            pricePerUnit: ing.pricing.pricePerUnit,
          }
        }

        return {
          ...ing,
          merma: ing.merma || {
            enabled: false,
            useGlobal: true,
            globalPercentage: getCategoryMermaPercentage(ing.category),
            customType: "percentage",
            customPercentage: 0,
            customValue: 0,
          },
          originalNetContent: ing.originalNetContent !== undefined ? ing.originalNetContent : ing.pricing.netContent,
        }
      })

      setOriginalValues(originals)
      setIngredients(processedIngredients)
      setMermaSystemActive(processedIngredients.some((ing) => ing.merma?.enabled))
    }
  }, [open, initialIngredients])

  const handleSystemToggle = (checked: boolean) => {
    setIsApplying(true)
    setMermaSystemActive(checked)

    const updatedIngredients = ingredients.map((ing) => {
      // Usar valores originales guardados o el contenido actual
      const originalContent =
        ing.originalNetContent !== undefined
          ? ing.originalNetContent
          : originalValues[ing.id]?.netContent || ing.pricing.netContent

      if (checked) {
        // Activar sistema de mermas
        let adjustedContent = originalContent
        const mermaData = ing.merma || {
          enabled: true,
          useGlobal: true,
          globalPercentage: getCategoryMermaPercentage(ing.category),
          customType: "percentage",
          customPercentage: 0,
          customValue: 0,
        }

        if (!mermaData.useGlobal && (mermaData.customPercentage > 0 || mermaData.customValue > 0)) {
          // Aplicar merma personalizada
          if (mermaData.customType === "percentage") {
            adjustedContent = originalContent * (1 - mermaData.customPercentage / 100)
          } else {
            adjustedContent = originalContent - mermaData.customValue
          }
        } else {
          // Aplicar merma global por categoría
          adjustedContent = calculateCategoryMerma(originalContent, ing.category)
        }

        return {
          ...ing,
          merma: {
            ...mermaData,
            enabled: true,
          },
          originalNetContent: originalContent,
          pricing: {
            ...ing.pricing,
            netContent: Math.max(0.1, adjustedContent),
            pricePerUnit: ing.pricing.purchasePrice / Math.max(0.1, adjustedContent),
          },
        }
      } else {
        // Desactivar sistema de mermas - restaurar valores originales
        const originalPricePerUnit = originalValues[ing.id]?.pricePerUnit || ing.pricing.purchasePrice / originalContent
        const mermaData = ing.merma || {
          enabled: false,
          useGlobal: true,
          globalPercentage: getCategoryMermaPercentage(ing.category),
          customType: "percentage" as const,
          customPercentage: 0,
          customValue: 0,
        }

        return {
          ...ing,
          merma: {
            ...mermaData,
            enabled: false,
          },
          originalNetContent: originalContent,
          pricing: {
            ...ing.pricing,
            netContent: originalContent,
            pricePerUnit: originalPricePerUnit,
          },
        }
      }
    })

    setIngredients(updatedIngredients)
    setIsApplying(false)
  }

  const toggleCustomization = (id: string) => {
    if (!mermaSystemActive) return
    const current = ingredients.find((ing) => ing.id === id)
    if (!canCustom && current?.merma?.useGlobal !== false) {
      toast({ title: t("ingredientes_merma_custom_locked_title"), description: t("ingredientes_merma_custom_locked_desc") })
      return
    }

    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === id) {
          const newUseGlobal = !ing.merma?.useGlobal
          const originalContent = ing.originalNetContent || originalValues[ing.id]?.netContent || ing.pricing.netContent

          let adjustedContent = originalContent
          if (!newUseGlobal && ing.merma && (ing.merma.customPercentage > 0 || ing.merma.customValue > 0)) {
            // Aplicar merma personalizada
            if (ing.merma.customType === "percentage") {
              adjustedContent = originalContent * (1 - ing.merma.customPercentage / 100)
            } else {
              adjustedContent = originalContent - ing.merma.customValue
            }
          } else {
            // Aplicar merma global
            adjustedContent = calculateCategoryMerma(originalContent, ing.category)
          }

          const mermaData = ing.merma || {
            enabled: false,
            useGlobal: true,
            globalPercentage: getCategoryMermaPercentage(ing.category),
            customType: "percentage" as const,
            customPercentage: 0,
            customValue: 0,
          }

          return {
            ...ing,
            merma: {
              ...mermaData,
              useGlobal: newUseGlobal,
              globalPercentage: getCategoryMermaPercentage(ing.category),
            },
            pricing: {
              ...ing.pricing,
              netContent: Math.max(0.1, adjustedContent),
              pricePerUnit: ing.pricing.purchasePrice / Math.max(0.1, adjustedContent),
            },
          }
        }
        return ing
      }),
    )
  }

  const updateMermaValue = (id: string, value: number) => {
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === id && ing.merma && !ing.merma.useGlobal) {
          const originalContent = ing.originalNetContent || originalValues[ing.id]?.netContent || ing.pricing.netContent
          let adjustedContent = originalContent

          if (value > 0) {
            if (ing.merma.customType === "percentage") {
              adjustedContent = originalContent * (1 - value / 100)
            } else {
              adjustedContent = originalContent - value
            }
          }

          return {
            ...ing,
            merma: {
              ...ing.merma,
              customPercentage: ing.merma.customType === "percentage" ? value : ing.merma.customPercentage,
              customValue: ing.merma.customType === "quantity" ? value : ing.merma.customValue,
            },
            pricing: {
              ...ing.pricing,
              netContent: Math.max(0.1, adjustedContent),
              pricePerUnit: ing.pricing.purchasePrice / Math.max(0.1, adjustedContent),
            },
          }
        }
        return ing
      }),
    )
  }

  const updateMermaType = (id: string, type: "quantity" | "percentage") => {
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === id && ing.merma) {
          return {
            ...ing,
            merma: {
              ...ing.merma,
              customType: type,
              customPercentage: 0,
              customValue: 0,
            },
          }
        }
        return ing
      }),
    )
  }

  // Guardar: si la merma cambia el costo de alguna receta, primero se muestra cuáles y
  // cómo (costo y precio) y se guarda solo al confirmar (docs/228).
  const saveChanges = () => {
    const preview = previewIngredientCostChanges(businessId || "main", ingredients)
    if (preview.affectedRecipes.length > 0) {
      setRecalcPreview(preview)
      return
    }
    void applyChanges()
  }

  const applyChanges = async () => {
    setIsApplying(true)
    setRecalcPreview(null)
    const bid = businessId || "main"

    try {
      // Costos antes de guardar, para saber qué ingredientes cambiaron.
      const previous = getIngredients(bid).map((ing) => ({ ...ing, pricing: { ...ing.pricing } }))
      await onSave?.(ingredients)
      // Las fichas que usan esos ingredientes se recalculan en cascada, con la misma regla
      // de precio que un cambio de precio de compra (docs/162, docs/164).
      const recalc = await recalculateAfterIngredientChanges(bid, previous, ingredients)
      logPriceRuleChanges(recalc.priceChanges, user, businessId && businessId !== "main" ? businessId : null)
      requestSubRecipePricePrompt(bid, [recalc])
      // El tutorial guiado (docs/221) sigue solo con la merma guardada.
      signalJourney("merma-saved")

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ingredientsUpdated", {
            detail: {
              businessId: businessId || "main",
              action: "merma-update",
              data: ingredients,
            },
          }),
        )
      }

      if (user) {
        logActivity({
          user,
          businessId: businessId && businessId !== "main" ? businessId : null,
          module: "merma",
          action: mermaSystemActive ? "activated" : "deactivated",
        })
      }

      const recalculated = recalc.affectedRecipes.filter((r) => Math.abs(r.costDifference) > 0.005).length
      toast({
        title: mermaSystemActive
          ? t("ingredientes_merma_toast_activated_title")
          : t("ingredientes_merma_toast_deactivated_title"),
        description:
          recalculated === 1
            ? t("merma_recalc_done_desc_one")
            : recalculated > 1
            ? t("merma_recalc_done_desc").replace("{count}", String(recalculated))
            : mermaSystemActive
              ? t("ingredientes_merma_toast_activated_desc")
              : t("ingredientes_merma_toast_deactivated_desc"),
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error saving:", error)
      toast({
        title: t("ingredientes_merma_toast_error_title"),
        description: t("ingredientes_merma_toast_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (ingredients.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ingredientes_merma_dialog_title")}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t("ingredientes_merma_empty_title")}
              <br />
              {t("ingredientes_merma_empty_desc")}
            </p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              {t("common_close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0" data-journey="merma-dialog">
          <div className="flex-shrink-0 p-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center justify-between">
                {t("ingredientes_merma_dialog_title")}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInfoDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Info className="h-4 w-4" />
                  {t("ingredientes_merma_info_button")}
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20" data-journey="merma-master">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Switch
                    id="master-merma"
                    checked={mermaSystemActive}
                    onCheckedChange={handleSystemToggle}
                    disabled={isApplying}
                  />
                  <Label htmlFor="master-merma" className="font-medium">
                    {isApplying ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {t("ingredientes_merma_applying_label")}
                      </span>
                    ) : (
                      t("ingredientes_merma_system_label")
                    )}
                  </Label>
                </div>
                <Badge variant={mermaSystemActive ? "default" : "secondary"}>
                  {mermaSystemActive ? t("ingredientes_merma_active_badge") : t("ingredientes_merma_inactive_badge")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <Table data-journey="merma-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("ingredientes_merma_col_ingredient")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_col_category")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_category_merma")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_type")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_config")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_original_content")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_current_content")}</TableHead>
                      <TableHead className="text-center">{t("ingredientes_merma_col_price_unit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ingredient, rowIndex) => {
                      const originalContent =
                        ingredient.originalNetContent ||
                        originalValues[ingredient.id]?.netContent ||
                        ingredient.pricing.netContent
                      const currentContent = ingredient.pricing.netContent
                      const isAdjusted = Math.abs(currentContent - originalContent) > 0.001
                      const categoryMerma = getCategoryMermaPercentage(ingredient.category)
                      const mermaLevel = getMermaLevel(categoryMerma)

                      return (
                        <TableRow key={ingredient.id} className={isAdjusted ? "bg-success-soft" : ""}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-medium">{ingredient.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {getUnitLabel(ingredient.unit, language)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{getCategoryLabel(ingredient.category, language)}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant={categoryMerma > 0 ? "default" : "secondary"}
                                className={`text-xs ${
                                  categoryMerma === 0
                                    ? "bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-300"
                                    : categoryMerma <= 10
                                      ? "bg-success-soft text-success"
                                      : categoryMerma <= 25
                                        ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300"
                                        : categoryMerma <= 40
                                          ? "bg-warning-soft text-warning"
                                          : "bg-danger-soft text-destructive"
                                }`}
                              >
                                {categoryMerma}%
                              </Badge>
                              <span className="text-xs text-muted-foreground">{getMermaLevelLabel(mermaLevel, language)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              data-journey={rowIndex === 0 ? "merma-custom" : undefined}
                              variant={ingredient.merma?.useGlobal === false ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleCustomization(ingredient.id)}
                              disabled={!mermaSystemActive}
                              className={
                                ingredient.merma?.useGlobal === false
                                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                  : "bg-success-soft hover:bg-success-soft text-success"
                              }
                            >
                              {!canCustom && ingredient.merma?.useGlobal !== false && <Lock className="h-3.5 w-3.5 mr-1 opacity-70" />}
                              {ingredient.merma?.useGlobal === false
                                ? t("ingredientes_merma_custom_button")
                                : t("ingredientes_merma_global_button")}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            {ingredient.merma?.useGlobal === false ? (
                              <div className="flex items-center justify-center gap-2" data-journey={rowIndex === 0 ? "merma-value" : undefined}>
                                <Select
                                  value={ingredient.merma?.customType || "percentage"}
                                  onValueChange={(value) =>
                                    updateMermaType(ingredient.id, value as "quantity" | "percentage")
                                  }
                                  disabled={!mermaSystemActive || !canCustom}
                                >
                                  <SelectTrigger className="w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="percentage">%</SelectItem>
                                    <SelectItem value="quantity">{t("ingredientes_merma_type_quantity")}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={
                                    ingredient.merma?.customType === "percentage"
                                      ? (ingredient.merma?.customPercentage || 0).toString()
                                      : (ingredient.merma?.customValue || 0).toString()
                                  }
                                  onChange={(e) =>
                                    updateMermaValue(ingredient.id, Number.parseFloat(e.target.value) || 0)
                                  }
                                  disabled={!mermaSystemActive || !canCustom}
                                  className="w-20"
                                  min="0"
                                  step={ingredient.merma?.customType === "percentage" ? "0.1" : "1"}
                                />
                              </div>
                            ) : (
                              <Badge variant="secondary">{t("ingredientes_merma_auto_badge")}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">
                              {Number(originalContent.toFixed(2))} {getUnitLabelFor(ingredient.unit, language, originalContent)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={`font-medium ${isAdjusted ? "text-success" : ""}`}>
                              {Number(currentContent.toFixed(2))} {getUnitLabelFor(ingredient.unit, language, currentContent)}
                            </div>
                            {isAdjusted && (
                              <div className="text-xs text-success">
                                {t("ingredientes_merma_adjusted_label")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">{formatUnitPrice(ingredient.pricing.pricePerUnit)}</div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          <div className="flex-shrink-0 p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {t("ingredientes_merma_footer_summary")
                    .replace("{custom}", String(ingredients.filter((ing) => ing.merma?.useGlobal === false).length))
                    .replace("{global}", String(ingredients.filter((ing) => ing.merma?.useGlobal !== false).length))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={isApplying}>
                  {t("common_cancel")}
                </Button>
                <Button onClick={saveChanges} disabled={isApplying} data-journey="merma-save">
                  {isApplying ? t("ingredientes_merma_saving_label") : t("ingredientes_merma_save_button")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MermaInfoDialog open={showInfoDialog} onOpenChange={setShowInfoDialog} />

      <AlertDialog open={recalcPreview !== null} onOpenChange={(o) => !o && setRecalcPreview(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("merma_recalc_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(recalcPreview?.affectedRecipes.length ?? 0) === 1
                ? t(mermaSystemActive ? "merma_recalc_desc_on_one" : "merma_recalc_desc_off_one")
                : t(mermaSystemActive ? "merma_recalc_desc_on" : "merma_recalc_desc_off").replace(
                    "{count}",
                    String(recalcPreview?.affectedRecipes.length ?? 0),
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm" data-testid="merma-recalc-list">
            {recalcPreview?.affectedRecipes.map((r) => {
              const price = recalcPreview.priceChanges.find((c) => c.recipeId === r.recipeId)
              const ask = recalcPreview.pendingSubRecipePrices.some((p) => p.recipeId === r.recipeId)
              return (
                <li key={r.recipeId} className="rounded-md border px-3 py-2">
                  <div className="font-medium">{r.recipeName}</div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {t("merma_recalc_cost").replace("{old}", formatCurrency(r.oldCost)).replace("{new}", formatCurrency(r.newCost))}
                  </div>
                  {price?.kind === "raised" && (
                    <div className="text-xs tabular-nums">
                      {t("merma_recalc_price_raised")
                        .replace("{old}", formatCurrency(price.oldPrice))
                        .replace("{new}", formatCurrency(price.newPrice))}
                    </div>
                  )}
                  {price?.kind === "kept" && (
                    <div className="text-xs">{t("merma_recalc_price_kept").replace("{price}", formatCurrency(price.price))}</div>
                  )}
                  {ask && <div className="text-xs">{t("merma_recalc_price_ask")}</div>}
                </li>
              )
            })}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyChanges()} data-testid="merma-recalc-confirm">
              {t("merma_recalc_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
