"use client"

// Contar una bebida por peso (docs/136, Fase 4). Pesar es el método más preciso de
// inventario de barra (10–12 % más que estimar a ojo en décimos) y cualquier cocina ya
// tiene báscula. Con el peso de una botella llena y una vacía del mismo producto (se
// guardan en el ingrediente la primera vez) la fracción que queda es
// (peso − vacía) ÷ (llena − vacía), sin necesitar la densidad del líquido.

import { useEffect, useState } from "react"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/contexts/language-context"
import { bottleFractionFromWeight, type BottleWeights } from "@/lib/beverage"
import { getUnitLabel } from "@/lib/ingredient-labels"
import type { Ingredient } from "@/types/ingredient"

type Props = {
  ingredient: Pick<Ingredient, "name" | "unit" | "bottleWeights">
  packageContent: number
  onApply: (packages: number, weights: BottleWeights) => void
}

export function WeighCountPopover({ ingredient, packageContent, onApply }: Props) {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(0)
  const [openWeight, setOpenWeight] = useState(0)
  const [fullG, setFullG] = useState(ingredient.bottleWeights?.fullG ?? 0)
  const [emptyG, setEmptyG] = useState(ingredient.bottleWeights?.emptyG ?? 0)

  useEffect(() => {
    if (!open) return
    setFullG(ingredient.bottleWeights?.fullG ?? 0)
    setEmptyG(ingredient.bottleWeights?.emptyG ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const weights: BottleWeights = { fullG, emptyG }
  const calibrationValid = fullG > emptyG && emptyG >= 0
  const fraction = openWeight > 0 ? bottleFractionFromWeight(openWeight, weights) : 0
  const packages = calibrationValid && fraction !== null ? closed + fraction : null
  const amount = packages !== null ? Math.round(packages * packageContent * 100) / 100 : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={t("inventario_weigh_button")}
          title={t("inventario_weigh_button")}
        >
          <Scale className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{t("inventario_weigh_title")}</p>
            <p className="text-xs text-muted-foreground">{ingredient.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="weigh-closed" className="text-xs">
                {t("inventario_weigh_closed_label")}
              </Label>
              <NumericInput id="weigh-closed" value={closed} onChange={setClosed} decimalPlaces={0} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weigh-open" className="text-xs">
                {t("inventario_weigh_open_label")}
              </Label>
              <NumericInput id="weigh-open" value={openWeight} onChange={setOpenWeight} decimalPlaces={0} className="h-8" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">{t("inventario_weigh_calibration_hint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="weigh-full" className="text-xs">
                  {t("inventario_weigh_full_label")}
                </Label>
                <NumericInput id="weigh-full" value={fullG} onChange={setFullG} decimalPlaces={0} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="weigh-empty" className="text-xs">
                  {t("inventario_weigh_empty_label")}
                </Label>
                <NumericInput id="weigh-empty" value={emptyG} onChange={setEmptyG} decimalPlaces={0} className="h-8" />
              </div>
            </div>
            {fullG > 0 && !calibrationValid && (
              <p className="text-[11px] text-destructive">{t("inventario_weigh_invalid")}</p>
            )}
          </div>
          {packages !== null && amount !== null && (
            <p className="text-sm tabular-nums">
              {t("inventario_weigh_result")
                .replace("{bottles}", (Math.round(packages * 100) / 100).toString())
                .replace("{amount}", `${amount} ${getUnitLabel(ingredient.unit, language)}`)}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={packages === null}
            onClick={() => {
              if (packages === null) return
              onApply(Math.round(packages * 1000) / 1000, weights)
              setOpen(false)
            }}
          >
            {t("inventario_weigh_apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
