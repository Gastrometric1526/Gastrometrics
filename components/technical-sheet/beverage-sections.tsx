"use client"

/**
 * Ficha Técnica de Bebidas (docs/272). Tres piezas que la Ficha Técnica muestra según lo
 * que se prepara; el motor de costo, el guardado y la cascada son los de siempre:
 * - RecipeKindPicker: Comida o Bebida y, si es bebida, cómo se vende (preparada, por
 *   medida o por envase);
 * - BeverageSourceCard: por medida/envase, el producto y la medida de cada servicio. Arma
 *   la única línea de la receta con `buildServingLine` (la misma de «Vender por copa»);
 * - BeverageServiceCard: vaso o copa, hielo, decoración y método (salen en el PDF).
 */

import { useMemo, useState } from "react"
import { Beer, Check, ChevronsUpDown, CupSoda, GlassWater, Martini, UtensilsCrossed, Wine } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { getUnitLabel } from "@/lib/ingredient-labels"
import {
  BEVERAGE_METHODS,
  buildServingLine,
  getPackageContent,
  getServingPresets,
  mlPerIngredientUnit,
  sortForBeverageSource,
} from "@/lib/beverage"
import type { Ingredient } from "@/types/ingredient"
import type { BeverageMode, RecipeBeverage, RecipeIngredient } from "@/types/recipe"

export type RecipeKind = "food" | "drink"

const NO_METHOD = "__none__"

function ChoiceButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  desc,
  dataTour,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof Wine
  title: string
  desc: string
  dataTour?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      data-tour={dataTour}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/60",
        disabled && !active && "opacity-60",
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{desc}</span>
      </span>
    </button>
  )
}

export function RecipeKindPicker({
  kind,
  mode,
  disabled,
  onKind,
  onMode,
}: {
  kind: RecipeKind
  mode: BeverageMode | null
  disabled?: boolean
  onKind: (kind: RecipeKind) => void
  onMode: (mode: BeverageMode) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="space-y-3" data-tour="ficha-kind">
      <p className="text-sm font-medium text-foreground">{t("bev_kind_title")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceButton active={kind === "food"} disabled={disabled} onClick={() => onKind("food")} icon={UtensilsCrossed} title={t("bev_kind_food")} desc={t("bev_kind_food_desc")} />
        <ChoiceButton active={kind === "drink"} disabled={disabled} onClick={() => onKind("drink")} icon={Martini} title={t("bev_kind_drink")} desc={t("bev_kind_drink_desc")} />
      </div>
      {kind === "drink" && (
        <div className="space-y-2" data-tour="ficha-beverage-mode">
          <p className="text-sm font-medium text-foreground">{t("bev_mode_title")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <ChoiceButton active={mode === "prepared"} disabled={disabled} onClick={() => onMode("prepared")} icon={Martini} title={t("bev_mode_prepared")} desc={t("bev_mode_prepared_desc")} />
            <ChoiceButton active={mode === "measure"} disabled={disabled} onClick={() => onMode("measure")} icon={Wine} title={t("bev_mode_measure")} desc={t("bev_mode_measure_desc")} />
            <ChoiceButton active={mode === "package"} disabled={disabled} onClick={() => onMode("package")} icon={CupSoda} title={t("bev_mode_package")} desc={t("bev_mode_package_desc")} />
          </div>
        </div>
      )}
    </div>
  )
}

type ServingChoice = string // clave del preset, o "custom"

export function BeverageSourceCard({
  mode,
  beverage,
  ingredients,
  disabled,
  onApply,
}: {
  mode: "measure" | "package"
  beverage: RecipeBeverage | undefined
  ingredients: Ingredient[]
  disabled?: boolean
  onApply: (result: { line: RecipeIngredient; beverage: RecipeBeverage; ingredient: Ingredient } | null) => void
}) {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const options = useMemo(() => sortForBeverageSource(ingredients), [ingredients])
  const source = ingredients.find((i) => i.id === beverage?.sourceIngredientId) ?? null
  const isVolume = source ? mlPerIngredientUnit(source.unit) !== null : false
  const presets = useMemo(() => (source && isVolume ? getServingPresets(source.category).filter((p) => p.ml !== null) : []), [source, isVolume])
  const servingMl = mode === "package" ? null : beverage?.servingMl ?? null
  const choice: ServingChoice =
    servingMl === null ? "" : presets.find((p) => p.ml === servingMl)?.key ?? "custom"
  const built = source ? buildServingLine(source, servingMl, "bev-line") : null

  const apply = (ingredient: Ingredient | null, ml: number | null) => {
    if (!ingredient) return onApply(null)
    const result = buildServingLine(ingredient, mode === "package" ? null : ml, `ing-${Date.now()}`)
    if (!result) return onApply(null)
    onApply({
      line: result.line,
      ingredient,
      beverage: { ...(beverage ?? { mode }), mode, sourceIngredientId: ingredient.id, servingMl: mode === "package" ? null : ml },
    })
  }

  const pickIngredient = (ingredient: Ingredient) => {
    setOpen(false)
    if (mode === "package") return apply(ingredient, null)
    const volume = mlPerIngredientUnit(ingredient.unit) !== null
    const first = volume ? getServingPresets(ingredient.category).find((p) => p.ml !== null)?.ml ?? 150 : null
    apply(ingredient, volume ? (servingMl ?? first) : null)
  }

  const content = source ? getPackageContent(source) : 0

  return (
    <Card className="w-full mx-auto" data-tour="ficha-beverage-source">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "package" ? <Beer className="h-5 w-5 text-primary" /> : <GlassWater className="h-5 w-5 text-primary" />}
          {t("bev_source_title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{mode === "package" ? t("bev_source_desc_package") : t("bev_source_desc_measure")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("bev_source_ingredient")}</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
                  <span className={cn("truncate", !source && "text-muted-foreground")}>{source ? source.name : t("bev_source_pick")}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("bev_source_search")} />
                  <CommandList>
                    <CommandEmpty>{t("bev_source_none")}</CommandEmpty>
                    <CommandGroup>
                      {options.map((ing) => (
                        <CommandItem key={ing.id} value={`${ing.name} ${ing.id}`} onSelect={() => pickIngredient(ing)}>
                          <Check className={cn("mr-2 h-4 w-4", source?.id === ing.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{ing.name}</span>
                          <span className="ml-auto pl-2 text-xs text-muted-foreground">
                            {getPackageContent(ing)} {getUnitLabel(ing.unit, language)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {mode === "measure" && source && isVolume && (
            <div className="space-y-1.5">
              <Label>{t("bev_source_serving")}</Label>
              <div className="flex gap-2">
                <Select
                  value={choice}
                  disabled={disabled}
                  onValueChange={(v) => {
                    if (v === "custom") return apply(source, servingMl ?? 60)
                    apply(source, presets.find((p) => p.key === v)?.ml ?? null)
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {t(`bebidas_serving_${p.key}` as never)}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{t("bebidas_serving_custom")}</SelectItem>
                  </SelectContent>
                </Select>
                {choice === "custom" && (
                  <NumericInput
                    aria-label={t("bev_source_custom_ml")}
                    value={servingMl ?? 60}
                    onChange={(v) => apply(source, v > 0 ? v : 1)}
                    decimalPlaces={0}
                    min={1}
                    className="w-24"
                    disabled={disabled}
                  />
                )}
              </div>
              {choice === "custom" && <p className="text-xs text-muted-foreground">{t("bev_source_custom_ml")}</p>}
            </div>
          )}
        </div>

        {mode === "measure" && source && !isVolume && <p className="text-sm text-warning">{t("bev_source_not_volume")}</p>}

        {source && built && (
          <div className="grid grid-cols-3 divide-x rounded-xl border text-sm">
            <div className="px-3 py-2.5 sm:px-4">
              <p className="text-xs text-muted-foreground">{t("bev_source_package_content")}</p>
              <p className="font-medium tabular-nums">
                {content} {getUnitLabel(source.unit, language)}
              </p>
            </div>
            <div className="px-3 py-2.5 sm:px-4">
              <p className="text-xs text-muted-foreground">{t("bev_source_servings")}</p>
              <p className="font-medium tabular-nums">{built.serving.servingsPerPackage ? built.serving.servingsPerPackage.toFixed(1) : "—"}</p>
            </div>
            <div className="px-3 py-2.5 sm:px-4">
              <p className="text-xs text-muted-foreground">{t("bev_source_cost")}</p>
              <p className="font-semibold tabular-nums text-foreground">{formatCurrency(built.serving.cost)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BeverageServiceCard({
  beverage,
  disabled,
  onChange,
}: {
  beverage: RecipeBeverage
  disabled?: boolean
  onChange: (next: RecipeBeverage) => void
}) {
  const { t } = useLanguage()
  const set = (key: "glass" | "ice" | "garnish" | "method", value: string) => onChange({ ...beverage, [key]: value || undefined })
  return (
    <Card className="w-full mx-auto" data-tour="ficha-beverage-service">
      <CardHeader>
        <CardTitle>{t("bev_service_title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("bev_service_desc")}</p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bev-glass">{t("bev_service_glass")}</Label>
          <Input id="bev-glass" value={beverage.glass ?? ""} onChange={(e) => set("glass", e.target.value)} placeholder={t("bev_service_glass_ph")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bev-ice">{t("bev_service_ice")}</Label>
          <Input id="bev-ice" value={beverage.ice ?? ""} onChange={(e) => set("ice", e.target.value)} placeholder={t("bev_service_ice_ph")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bev-garnish">{t("bev_service_garnish")}</Label>
          <Input id="bev-garnish" value={beverage.garnish ?? ""} onChange={(e) => set("garnish", e.target.value)} placeholder={t("bev_service_garnish_ph")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("bev_service_method")}</Label>
          <Select value={beverage.method || NO_METHOD} onValueChange={(v) => set("method", v === NO_METHOD ? "" : v)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_METHOD}>{t("bev_method_none")}</SelectItem>
              {BEVERAGE_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`bev_method_${m}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
