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
import { Beer, CupSoda, GlassWater, Martini, Search, UtensilsCrossed, Wine } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryLabel, getUnitLabel } from "@/lib/ingredient-labels"
import { normalizeSearch } from "@/lib/manual-sales"
import { distinguishLabel, repeatedNames } from "@/lib/ingredient-match"
import {
  BEVERAGE_METHODS,
  buildServingLine,
  getPackageContent,
  getServingOptions,
  isBeverageCategory,
  mlPerIngredientUnit,
  mlToServingUnit,
  sameServing,
  servingUnitFor,
  servingUnitToMl,
  sortForBeverageSource,
} from "@/lib/beverage"
import type { Ingredient } from "@/types/ingredient"
import { unitAbbreviations } from "@/types/ingredient"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
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

/**
 * Productos que se pueden vender por medida o por envase (docs/273): solo bebidas, es decir,
 * ingredientes con categoría de barra (Vinos, Destilados, Cervezas, Refrescos y mixers…).
 * Por medida, además, tienen que estar en volumen (ml, L, oz o galones) para poder medir el
 * servicio. «Ver también los demás ingredientes» abre el resto, por si alguien guardó una
 * bebida en otra categoría.
 */
export function beverageSourceOptions<T extends Pick<Ingredient, "name" | "category" | "unit">>(
  ingredients: T[],
  mode: "measure" | "package",
  includeAll: boolean,
): T[] {
  return sortForBeverageSource(
    ingredients.filter(
      (ing) =>
        ing.category !== SUBRECIPE_CLASSIFICATION &&
        (includeAll || isBeverageCategory(ing.category)) &&
        (mode === "package" || mlPerIngredientUnit(ing.unit) !== null),
    ),
  )
}

function ProductTile({ ingredient, selected, onPick, distinct }: { ingredient: Ingredient; selected: boolean; onPick: () => void; distinct: string }) {
  const { language } = useLanguage()
  const content = getPackageContent(ingredient)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[4.5rem] flex-col justify-between rounded-lg border p-2.5 text-left transition",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/60",
      )}
    >
      <span className="text-sm font-medium leading-tight line-clamp-2">{ingredient.name}</span>
      {/* Mismo nombre, otro proveedor (docs/222, docs/278): se distingue con distinguishLabel. */}
      {distinct && <span className="text-xs text-muted-foreground truncate">{distinct}</span>}
      <span className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>
          {content} {unitAbbreviations[ingredient.unit as keyof typeof unitAbbreviations] || getUnitLabel(ingredient.unit, language)}
        </span>
        <span>{formatCurrency(ingredient.pricing?.purchasePrice || 0)}</span>
      </span>
    </button>
  )
}

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
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [includeAll, setIncludeAll] = useState(false)
  const source = ingredients.find((i) => i.id === beverage?.sourceIngredientId) ?? null
  const isVolume = source ? mlPerIngredientUnit(source.unit) !== null : false
  // Medidas en la unidad de la base de datos (docs/273): oz si la bebida está en oz o galones.
  const servingUnit = source ? servingUnitFor(source.unit) : "ml"
  const presets = useMemo(() => (source ? getServingOptions(source.category, source.unit) : []), [source])
  const servingMl = mode === "package" ? null : beverage?.servingMl ?? null
  const choice: ServingChoice = servingMl === null ? "" : presets.find((p) => sameServing(p.ml, servingMl))?.key ?? "custom"
  const built = source ? buildServingLine(source, servingMl, "bev-line") : null

  const options = useMemo(() => beverageSourceOptions(ingredients, mode, includeAll), [ingredients, mode, includeAll])
  const repeated = useMemo(() => repeatedNames(options), [options])
  const hasOthers = useMemo(() => beverageSourceOptions(ingredients, mode, true).length > options.length, [ingredients, mode, options])
  const categories = useMemo(() => [...new Set(options.map((o) => o.category))], [options])
  const shown = useMemo(() => {
    const q = normalizeSearch(query)
    return options.filter((o) => (!category || o.category === category) && (!q || normalizeSearch(o.name).includes(q)))
  }, [options, category, query])
  const showPicker = !disabled && (picking || !source)

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
    setPicking(false)
    setQuery("")
    if (mode === "package") return apply(ingredient, null)
    const first = getServingOptions(ingredient.category, ingredient.unit)[0]?.ml ?? servingUnitToMl(servingUnitFor(ingredient.unit) === "oz" ? 5 : 150, servingUnitFor(ingredient.unit))
    apply(ingredient, servingMl ?? first)
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
        {/* Producto elegido: una fila compacta con «Cambiar». */}
        {source && !showPicker && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {mode === "package" ? <Beer className="h-5 w-5" /> : <Wine className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{source.name}</p>
              <p className="text-xs text-muted-foreground">
                {getCategoryLabel(source.category, language)} · {content} {getUnitLabel(source.unit, language)} · {formatCurrency(source.pricing?.purchasePrice || 0)}
              </p>
            </div>
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                {t("bev_source_change")}
              </Button>
            )}
          </div>
        )}

        {/* Elegir el producto: buscador, categorías de barra y tarjetas. */}
        {showPicker && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("bev_source_search")} className="pl-9" aria-label={t("bev_source_search")} />
            </div>
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Button size="sm" variant={category === null ? "default" : "outline"} className="shrink-0" onClick={() => setCategory(null)}>
                  {t("pos_picker_all")}
                </Button>
                {categories.map((c) => (
                  <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="shrink-0" onClick={() => setCategory(c)}>
                    {getCategoryLabel(c, language)}
                  </Button>
                ))}
              </div>
            )}
            {options.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{t("bev_source_empty_bar")}</p>
            ) : shown.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("bev_source_no_match")}</p>
            ) : (
              <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {shown.map((ing) => (
                  <ProductTile key={ing.id} ingredient={ing} selected={source?.id === ing.id} onPick={() => pickIngredient(ing)} distinct={distinguishLabel(ing, repeated)} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {mode === "measure" ? <p className="text-xs text-muted-foreground">{t("bev_source_measure_hint")}</p> : <span />}
              <div className="flex gap-2">
                {(hasOthers || includeAll) && (
                  <Button variant="ghost" size="sm" onClick={() => { setIncludeAll(!includeAll); setCategory(null) }}>
                    {includeAll ? t("bev_source_show_bar") : t("bev_source_show_all")}
                  </Button>
                )}
                {source && (
                  <Button variant="ghost" size="sm" onClick={() => setPicking(false)}>
                    {t("common_cancel")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === "measure" && source && isVolume && !showPicker && (
          <div className="space-y-1.5">
            <Label>{t("bev_source_serving")}</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button key={p.key} size="sm" variant={choice === p.key ? "default" : "outline"} disabled={disabled} onClick={() => apply(source, p.ml)}>
                  {t(p.labelKey as never)}
                </Button>
              ))}
              <Button size="sm" variant={choice === "custom" ? "default" : "outline"} disabled={disabled} onClick={() => apply(source, servingMl ?? servingUnitToMl(servingUnit === "oz" ? 2 : 60, servingUnit))}>
                {t("bebidas_serving_custom")}
              </Button>
              {choice === "custom" && (
                <div className="flex items-center gap-2">
                  <NumericInput
                    aria-label={servingUnit === "oz" ? t("bev_custom_oz_label") : t("bev_source_custom_ml")}
                    value={mlToServingUnit(servingMl ?? servingUnitToMl(servingUnit === "oz" ? 2 : 60, servingUnit), servingUnit)}
                    onChange={(v) => apply(source, servingUnitToMl(v > 0 ? v : 1, servingUnit))}
                    decimalPlaces={servingUnit === "oz" ? 1 : 0}
                    min={servingUnit === "oz" ? 0.1 : 1}
                    className="h-9 w-24"
                    disabled={disabled}
                  />
                  <span className="text-sm text-muted-foreground">{servingUnit}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "measure" && source && !isVolume && <p className="text-sm text-warning">{t("bev_source_not_volume")}</p>}
        {/* docs/278: una medida más grande que el envase casi siempre es un error de tipeo. */}
        {mode === "measure" && built?.serving.servingsPerPackage != null && built.serving.servingsPerPackage < 1 && !showPicker && (
          <p className="text-sm text-warning">{t("bev_source_bigger_than_package")}</p>
        )}

        {source && built && !showPicker && (
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
  volume,
}: {
  beverage: RecipeBeverage
  disabled?: boolean
  onChange: (next: RecipeBeverage) => void
  /** Bebida preparada: ml de líquido por servicio y volumen servido estimado (docs/286). */
  volume?: { liquidMl: number; servedMl: number | null } | null
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
          <Input id="bev-glass" maxLength={80} value={beverage.glass ?? ""} onChange={(e) => set("glass", e.target.value)} placeholder={t("bev_service_glass_ph")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bev-ice">{t("bev_service_ice")}</Label>
          <Input id="bev-ice" maxLength={80} value={beverage.ice ?? ""} onChange={(e) => set("ice", e.target.value)} placeholder={t("bev_service_ice_ph")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bev-garnish">{t("bev_service_garnish")}</Label>
          <Input id="bev-garnish" maxLength={80} value={beverage.garnish ?? ""} onChange={(e) => set("garnish", e.target.value)} placeholder={t("bev_service_garnish_ph")} disabled={disabled} />
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
        {volume && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm sm:col-span-2" data-beverage-volume>
            <p className="text-foreground">
              {t("bev_volume_liquid").replace("{ml}", String(volume.liquidMl))}
              {volume.servedMl !== null && <> · {t("bev_volume_served").replace("{ml}", String(volume.servedMl))}</>}
            </p>
            <p className="text-xs text-muted-foreground">{volume.servedMl !== null ? t("bev_volume_hint") : t("bev_volume_pick_method")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
