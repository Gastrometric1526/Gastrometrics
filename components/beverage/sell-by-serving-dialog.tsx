"use client"

// "Vender por copa / botella" (docs/136): crea desde Ingredientes una mini-ficha técnica
// de una sola línea (ej. "Malbec · Copa 150 ml") con el costo por servicio ya calculado.
// Es una receta normal — con clasificación de barra y método pour cost — así que entra
// sola en ventas, menús, stock teórico, órdenes de compra y Menu Engineering, sin que el
// usuario tenga que "receptar" un vino en la ficha técnica completa.

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency, getCurrentCurrencyCode } from "@/lib/currency"
import { roundSalePrice } from "@/lib/price-rounding"
import { saveRecipe } from "@/lib/storage/recipes"
import { getPresentationLabel, getUnitLabel } from "@/lib/ingredient-labels"
import {
  BAR_CLASSIFICATIONS,
  BAR_KIND_MENU_STEP,
  DEFAULT_BEVERAGE_COST_TARGET,
  computeServingCost,
  getBarKindForIngredientCategory,
  getServingPresets,
  mlPerIngredientUnit,
  priceForTargetCost,
  type ServingPresetKey,
} from "@/lib/beverage"
import type { Ingredient } from "@/types/ingredient"
import { unitAbbreviations } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

type Props = {
  ingredient: Ingredient | null
  businessId?: string | null
  onOpenChange: (open: boolean) => void
}

type ServingChoice = ServingPresetKey | "custom"

// Mismos valores por defecto de rubros que la ficha técnica (DEFAULT_PRICING_PERCENTAGES),
// para que al abrir la mini-ficha y cambiar de método no aparezcan ceros.
const DEFAULT_RUBROS = { contributionMargin: 30, publicServices: 10, marketing: 10, operationalCosts: 30, laborCosts: 25, isv: 0 }

export function SellByServingDialog({ ingredient: openIngredient, businessId, onOpenChange }: Props) {
  const { t, language } = useLanguage()
  // Se conserva el último ingrediente mientras corre la animación de cierre del diálogo;
  // si no, el título y el contenido quedaban en blanco durante la salida.
  const [ingredient, setIngredient] = useState<Ingredient | null>(openIngredient)
  useEffect(() => {
    if (openIngredient) setIngredient(openIngredient)
  }, [openIngredient])
  const { toast } = useToast()
  const router = useRouter()

  const isVolume = ingredient ? mlPerIngredientUnit(ingredient.unit) !== null : false
  const presets = useMemo(() => {
    if (!ingredient) return []
    const all = getServingPresets(ingredient.category)
    return isVolume ? all : all.filter((preset) => preset.ml === null)
  }, [ingredient, isVolume])

  const barKind = ingredient ? getBarKindForIngredientCategory(ingredient.category) : "cocktails"
  const [choice, setChoice] = useState<ServingChoice>("package")
  const [customMl, setCustomMl] = useState<number>(60)
  const [target, setTarget] = useState<number>(DEFAULT_BEVERAGE_COST_TARGET[barKind])
  const [name, setName] = useState("")
  const [nameEdited, setNameEdited] = useState(false)
  const [priceInput, setPriceInput] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Reinicia el formulario cada vez que se abre con otro ingrediente.
  useEffect(() => {
    if (!ingredient) return
    setChoice(presets[0]?.key ?? "package")
    setCustomMl(60)
    setTarget(DEFAULT_BEVERAGE_COST_TARGET[getBarKindForIngredientCategory(ingredient.category)])
    setNameEdited(false)
    setPriceInput(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient?.id])

  const servingMl = choice === "custom" ? customMl : (presets.find((preset) => preset.key === choice)?.ml ?? null)
  const serving = ingredient ? computeServingCost(ingredient, servingMl) : null

  const packageLabel = ingredient?.presentation
    ? getPresentationLabel(ingredient.presentation, language)
    : t("bebidas_serving_package")
  const choiceLabel =
    choice === "custom"
      ? `${customMl} ml`
      : choice === "package"
        ? packageLabel
        : t(`bebidas_serving_${choice}` as Parameters<typeof t>[0])

  useEffect(() => {
    if (ingredient && !nameEdited) setName(`${ingredient.name} · ${choiceLabel}`)
  }, [ingredient, choiceLabel, nameEdited])

  const suggestedPrice = serving ? roundSalePrice(priceForTargetCost(serving.cost, target), getCurrentCurrencyCode()) : 0
  const finalPrice = priceInput && priceInput > 0 ? priceInput : suggestedPrice
  const resultingCostPercent = serving && finalPrice > 0 ? (serving.cost / finalPrice) * 100 : 0

  const mermaPercent =
    ingredient?.originalNetContent && ingredient.pricing?.netContent && ingredient.originalNetContent > ingredient.pricing.netContent
      ? (1 - ingredient.pricing.netContent / ingredient.originalNetContent) * 100
      : 0

  const handleCreate = async () => {
    if (!ingredient || !serving || !name.trim() || finalPrice <= 0) return
    setSaving(true)
    const now = new Date().toISOString()
    const customPrice = priceInput && priceInput > 0 && priceInput !== suggestedPrice ? priceInput : undefined
    const recipe: Recipe = {
      id: `recipe-${Date.now()}`,
      name: name.trim(),
      classification: BAR_CLASSIFICATIONS[barKind],
      plate: BAR_KIND_MENU_STEP[barKind],
      servings: 1,
      yieldAmount: 1,
      yieldUnit: "porciones",
      ingredients: [
        {
          id: `ing-${Date.now()}`,
          ingredientId: ingredient.id,
          name: ingredient.name,
          category: ingredient.category,
          quantity: serving.quantity,
          unit: ingredient.unit,
          measure: unitAbbreviations[ingredient.unit] || ingredient.unit,
          cost: 0,
          unitCost: ingredient.pricing.pricePerUnit,
          costPerMeasure: ingredient.pricing.pricePerUnit,
          extension: serving.cost,
        },
      ],
      procedure: [
        servingMl === null
          ? t("bebidas_sell_procedure_package")
          : t("bebidas_sell_procedure_serving").replace("{amount}", `${servingMl} ml`),
      ],
      totalCost: serving.cost,
      costPerServing: serving.cost,
      unitPrice: finalPrice,
      totalPrice: finalPrice,
      netProfit: finalPrice - serving.cost,
      customUnitPrice: customPrice,
      ...DEFAULT_RUBROS,
      pricingConfig: {
        publicServices: DEFAULT_RUBROS.publicServices,
        marketing: DEFAULT_RUBROS.marketing,
        operationalCosts: DEFAULT_RUBROS.operationalCosts,
        laborCosts: DEFAULT_RUBROS.laborCosts,
        netProfit: DEFAULT_RUBROS.contributionMargin,
        isv: DEFAULT_RUBROS.isv,
        isDefault: false,
      },
      pricingMethod: "food_cost",
      targetFoodCostPercent: target,
      businessId: businessId || "main",
      metadata: { createdAt: now, updatedAt: now, version: 1 },
    }
    try {
      const saved = await saveRecipe(recipe, businessId)
      onOpenChange(false)
      toast({
        title: t("bebidas_sell_toast_title"),
        description: t("bebidas_sell_toast_desc").replace("{name}", saved.name),
        action: (
          <ToastAction altText={t("recipecard_view")} onClick={() => router.push(`/ficha-tecnica/${saved.id}`)}>
            {t("recipecard_view")}
          </ToastAction>
        ),
      })
    } catch {
      toast({ title: t("bebidas_sell_error"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const unitLabel = ingredient ? getUnitLabel(ingredient.unit, language) : ""

  return (
    <Dialog open={!!openIngredient} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("bebidas_sell_title").replace("{name}", ingredient?.name ?? "")}</DialogTitle>
          <DialogDescription>{t("bebidas_sell_desc")}</DialogDescription>
        </DialogHeader>

        {ingredient && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sell-serving">{t("bebidas_sell_serving_label")}</Label>
                <Select value={choice} onValueChange={(value) => setChoice(value as ServingChoice)}>
                  <SelectTrigger id="sell-serving">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {preset.key === "package"
                          ? `${packageLabel} · ${ingredient.originalNetContent || ingredient.pricing.netContent} ${unitLabel}`
                          : t(`bebidas_serving_${preset.key}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                    {isVolume && <SelectItem value="custom">{t("bebidas_serving_custom")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {choice === "custom" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sell-custom-ml">{t("bebidas_sell_custom_ml_label")}</Label>
                  <NumericInput id="sell-custom-ml" value={customMl} onChange={setCustomMl} decimalPlaces={0} min={1} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="sell-target">{t("bebidas_sell_target_label")}</Label>
                  <NumericInput id="sell-target" value={target} onChange={setTarget} decimalPlaces={1} min={1} max={99} />
                </div>
              )}
            </div>

            {choice === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="sell-target">{t("bebidas_sell_target_label")}</Label>
                <NumericInput id="sell-target" value={target} onChange={setTarget} decimalPlaces={1} min={1} max={99} className="sm:w-1/2" />
              </div>
            )}

            {!isVolume && <p className="text-xs text-muted-foreground">{t("bebidas_sell_unit_not_volume")}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="sell-name">{t("bebidas_sell_name_label")}</Label>
              <Input
                id="sell-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameEdited(true)
                }}
              />
            </div>

            <div className="divide-y rounded-xl border text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("bebidas_sell_cost_per_serving")}</span>
                <span className="tabular-nums font-medium">{serving ? formatCurrency(serving.cost) : "—"}</span>
              </div>
              {serving?.servingsPerPackage && servingMl !== null && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">{t("bebidas_sell_servings_per_package")}</span>
                  <span className="tabular-nums font-medium">{serving.servingsPerPackage.toFixed(1)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("bebidas_sell_suggested_price")}</span>
                <span className="tabular-nums font-medium">{suggestedPrice > 0 ? formatCurrency(suggestedPrice) : "—"}</span>
              </div>
            </div>
            {servingMl !== null && (
              <p className="text-xs text-muted-foreground">
                {mermaPercent > 0
                  ? t("bebidas_sell_includes_merma").replace("{percent}", mermaPercent.toFixed(1))
                  : t("bebidas_sell_no_merma_hint")}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sell-price">{t("bebidas_sell_price_label")}</Label>
              <NumericInput
                id="sell-price"
                value={priceInput ?? suggestedPrice}
                onChange={(value) => setPriceInput(value)}
                decimalPlaces={2}
                min={0}
              />
              {resultingCostPercent > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("bebidas_sell_resulting_cost").replace("{percent}", resultingCostPercent.toFixed(1))}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("bebidas_sell_cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={!serving || !name.trim() || finalPrice <= 0 || saving}>
            {t("bebidas_sell_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
