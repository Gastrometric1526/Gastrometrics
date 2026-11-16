"use client"

/**
 * Prueba de rendimiento por cortes (docs/322). Pesas la pieza que compraste y cada parte que
 * sale de ella; la app te dice cuánto rinde, cuánto te cuesta de verdad cada unidad útil y qué
 * merma poner en el ingrediente para que tus recetas usen ese costo. Todo con su «¿Cómo se
 * calcula?». Vive dentro de la ventana de Merma, en la merma personalizada.
 */

import { useEffect, useMemo, useState } from "react"
import { Plus, Scissors, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalcHelp } from "@/components/calc-help"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/utils"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { computeYieldTest, type YieldPart, type YieldPartKind } from "@/lib/yield-test"
import type { Ingredient } from "@/types/ingredient"

const KINDS: YieldPartKind[] = ["usable", "byproduct", "waste"]
const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

export function YieldTestDialog({
  ingredient,
  open,
  onOpenChange,
  onApply,
}: {
  ingredient: Ingredient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (mermaPercent: number, test: NonNullable<Ingredient["yieldTest"]>) => void
}) {
  const { t, language } = useLanguage()
  const [gross, setGross] = useState(0)
  const [price, setPrice] = useState(0)
  const [parts, setParts] = useState<YieldPart[]>([])

  useEffect(() => {
    if (!ingredient || !open) return
    const saved = ingredient.yieldTest
    setGross(saved?.grossWeight ?? (ingredient.originalNetContent || ingredient.pricing.netContent || 0))
    setPrice(saved?.pricePaid ?? (ingredient.pricing.purchasePrice || 0))
    setParts(
      saved?.parts?.length
        ? saved.parts
        : [
            { name: t("yield_test_default_usable"), weight: 0, kind: "usable" },
            { name: t("yield_test_default_waste"), weight: 0, kind: "waste" },
          ],
    )
  }, [ingredient, open, t])

  const result = useMemo(() => computeYieldTest({ grossWeight: gross, pricePaid: price, parts }), [gross, price, parts])
  if (!ingredient) return null
  const unit = getUnitLabel(ingredient.unit, language)
  const update = (i: number, patch: Partial<YieldPart>) => setParts((p) => p.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const usableParts = parts.filter((p) => p.kind === "usable")
  const byParts = parts.filter((p) => p.kind === "byproduct" && (p.valuePerUnit || 0) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="yield-test-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            {t("yield_test_title").replace("{name}", ingredient.name)}
          </DialogTitle>
          <DialogDescription>{t("yield_test_desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{t("yield_test_gross").replace("{unit}", unit)}</Label>
            <NumericInput value={gross} onChange={(v) => setGross(Math.max(0, Number(v) || 0))} decimalPlaces={3} min={0} />
          </div>
          <div>
            <Label className="text-xs">{t("yield_test_price")}</Label>
            <NumericInput value={price} onChange={(v) => setPrice(Math.max(0, Number(v) || 0))} decimalPlaces={2} min={0} />
          </div>
        </div>

        <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
          <p className="text-sm font-medium">{t("yield_test_parts")}</p>
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border p-2">
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs">{t("yield_test_part_name")}</Label>
                <Input value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">{t("yield_test_part_kind")}</Label>
                <Select value={p.kind} onValueChange={(v) => update(i, { kind: v as YieldPartKind })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`yield_test_kind_${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label className="text-xs">{t("yield_test_part_weight").replace("{unit}", unit)}</Label>
                <NumericInput value={p.weight} onChange={(v) => update(i, { weight: Math.max(0, Number(v) || 0) })} decimalPlaces={3} min={0} />
              </div>
              <div className="col-span-10 sm:col-span-2">
                {p.kind === "byproduct" && (
                  <>
                    <Label className="text-xs">{t("yield_test_part_value").replace("{unit}", unit)}</Label>
                    <NumericInput value={p.valuePerUnit || 0} onChange={(v) => update(i, { valuePerUnit: Math.max(0, Number(v) || 0) })} decimalPlaces={2} min={0} />
                  </>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setParts((x) => x.filter((_, k) => k !== i))} aria-label={t("yield_test_remove_part")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setParts((x) => [...x, { name: "", weight: 0, kind: "usable" }])}>
            <Plus className="h-4 w-4" />
            {t("yield_test_add_part")}
          </Button>
          {result.partsExceedGross && <p className="text-xs text-destructive">{t("yield_test_exceeds")}</p>}
          {result.unweighed > 0 && !result.partsExceedGross && (
            <p className="text-xs text-muted-foreground">{t("yield_test_unweighed").replace("{qty}", `${fmt(result.unweighed)} ${unit}`)}</p>
          )}
        </div>

        <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("yield_test_result_yield")}</p>
              <p className="text-lg font-semibold tabular-nums">{result.yieldPercent} %</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("yield_test_result_cost").replace("{unit}", unit)}</p>
              <p className="text-lg font-semibold tabular-nums">{result.costPerUsableUnit === null ? "—" : formatCurrency(result.costPerUsableUnit)}</p>
              <p className="text-xs text-muted-foreground">{t("yield_test_result_was").replace("{price}", formatCurrency(result.pricePerGrossUnit))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("yield_test_result_merma")}</p>
              <p className="text-lg font-semibold tabular-nums text-primary">{result.mermaPercent === null ? "—" : `${result.mermaPercent} %`}</p>
            </div>
          </div>
          <CalcHelp
            title={t("yield_test_calc_title")}
            intro={t("yield_test_calc_intro")}
            steps={[
              { label: t("yield_test_calc_usable"), formula: `${usableParts.map((p) => fmt(p.weight)).join(" + ") || "0"} = ${fmt(result.usableWeight)} ${unit}` },
              { label: t("yield_test_result_yield"), formula: `${fmt(result.usableWeight)} ÷ ${fmt(gross)} × 100 = ${result.yieldPercent} %` },
              ...(byParts.length
                ? [{ label: t("yield_test_calc_byproducts"), formula: `${byParts.map((p) => `${fmt(p.weight)} × ${formatCurrency(p.valuePerUnit || 0)}`).join(" + ")} = ${formatCurrency(result.byproductValue)}` }]
                : []),
              {
                label: t("yield_test_result_cost").replace("{unit}", unit),
                formula: `(${formatCurrency(price)} − ${formatCurrency(result.byproductValue)}) ÷ ${fmt(result.usableWeight)} = ${result.costPerUsableUnit === null ? "—" : formatCurrency(result.costPerUsableUnit)}`,
              },
              {
                label: t("yield_test_result_merma"),
                formula: result.costPerUsableUnit
                  ? `1 − ${formatCurrency(price)} ÷ (${formatCurrency(result.costPerUsableUnit)} × ${fmt(gross)}) = ${result.mermaPercent} %`
                  : "—",
                note: t("yield_test_calc_merma_note"),
              },
            ]}
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button
            disabled={result.mermaPercent === null || result.partsExceedGross}
            onClick={() =>
              result.mermaPercent !== null &&
              onApply(result.mermaPercent, { at: new Date().toISOString(), grossWeight: gross, pricePaid: price, parts: parts.filter((p) => p.weight > 0) })
            }
            data-testid="yield-test-apply"
          >
            {t("yield_test_apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
