"use client"

// «Configuración de porcentajes» de la Ficha Técnica (docs/226). Antes eran seis campos
// sueltos sin explicación; ahora cada rubro dice qué cubre y cuánto suma por porción, se
// ve en vivo el precio sugerido y el costo % que resultan, y los valores se pueden
// guardar como predeterminados del negocio (lib/pricing-percentages.ts) o volver a ellos.

import type { ReactNode } from "react"
import { RotateCcw, Info, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { totalMarkupPercent, type PricingPercentageKey, type PricingPercentages } from "@/lib/pricing-percentages"
import type { PricingMethod } from "@/types/business"

// Por encima de este costo % se avisa: el estándar de cocina es 28-35 %.
const HIGH_COST_PERCENT = 40

type TKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]

const GROUPS: { titleKey: TKey; rows: { key: PricingPercentageKey; labelKey: TKey; hintKey: TKey }[] }[] = [
  {
    titleKey: "ficha_tecnica_pct_group_expenses",
    rows: [
      { key: "publicServices", labelKey: "ficha_tecnica_item_public_services", hintKey: "ficha_tecnica_pct_hint_public_services" },
      { key: "marketing", labelKey: "ficha_tecnica_item_marketing", hintKey: "ficha_tecnica_pct_hint_marketing" },
      { key: "operationalCosts", labelKey: "ficha_tecnica_item_operational_costs", hintKey: "ficha_tecnica_pct_hint_operational" },
      { key: "laborCosts", labelKey: "ficha_tecnica_item_labor_costs", hintKey: "ficha_tecnica_pct_hint_labor" },
    ],
  },
  {
    titleKey: "ficha_tecnica_pct_group_tax",
    rows: [{ key: "isv", labelKey: "ficha_tecnica_item_isv", hintKey: "ficha_tecnica_pct_hint_isv" }],
  },
  {
    titleKey: "ficha_tecnica_pct_group_profit",
    rows: [{ key: "contributionMargin", labelKey: "ficha_tecnica_item_net_profit", hintKey: "ficha_tecnica_pct_hint_profit" }],
  },
]

const fmtPct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)} %`

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  values: PricingPercentages
  onChange: (key: PricingPercentageKey, value: number) => void
  editable: boolean
  pricingMethod: PricingMethod
  unitCost: number
  suggestedPrice: number
  fixedCostPercent: number
  hasCustomPrice: boolean
  isDefault: boolean
  onUseDefaults: () => void
  onSaveDefault: () => void
}

export function PercentageSettingsDialog({
  open,
  onOpenChange,
  trigger,
  values,
  onChange,
  editable,
  pricingMethod,
  unitCost,
  suggestedPrice,
  fixedCostPercent,
  hasCustomPrice,
  isDefault,
  onUseDefaults,
  onSaveDefault,
}: Props) {
  const { t } = useLanguage()
  const isFoodCost = pricingMethod === "food_cost"
  const total = totalMarkupPercent(values)
  const costPercent = suggestedPrice > 0 ? (unitCost / suggestedPrice) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-xl grid-cols-1 gap-5 overflow-y-auto overflow-x-hidden p-5 sm:w-[calc(100%-4rem)] sm:p-7 md:w-full [&>*]:min-w-0">
        <DialogHeader className="px-0 pr-10 text-left sm:pr-10">
          <DialogTitle>{t("ficha_tecnica_percentage_settings_title")}</DialogTitle>
          <DialogDescription>{t("ficha_tecnica_pct_dialog_desc")}</DialogDescription>
        </DialogHeader>

        {isFoodCost && (
          <p className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="pct-food-cost-notice">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t("ficha_tecnica_pct_food_cost_notice")}</span>
          </p>
        )}

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.titleKey} className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground">{t(group.titleKey)}</h3>
              {group.rows.map((row) => {
                const value = values[row.key]
                const dimmed = isFoodCost && row.key !== "isv"
                return (
                  <div key={row.key} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 ${dimmed ? "opacity-60" : ""}`}>
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor={`${row.key}-setting`} className="text-sm">
                        {t(row.labelKey)}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t(row.hintKey)}</p>
                      {!isFoodCost && unitCost > 0 && (
                        <p id={`${row.key}-amount`} className="text-xs font-medium tabular-nums">
                          {t("ficha_tecnica_pct_per_portion").replace("{amount}", formatCurrency((unitCost * value) / 100))}
                        </p>
                      )}
                    </div>
                    <div className="relative w-24">
                        <NumericInput
                          id={`${row.key}-setting`}
                          value={value}
                          onChange={(v) => onChange(row.key, Math.min(Math.max(v || 0, 0), 100))}
                          placeholder="0"
                          decimalPlaces={2}
                          min={0}
                          max={100}
                          disabled={!editable}
                          className="pr-7 text-right"
                          aria-describedby={`${row.key}-amount`}
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>

        {!isFoodCost && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm sm:p-4" aria-live="polite">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("ficha_tecnica_pct_summary_total")}</span>
              <span className="shrink-0 whitespace-nowrap font-mono">{fmtPct(total)}</span>
            </div>
            {fixedCostPercent > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("ficha_tecnica_pct_summary_fixed")}</span>
                <span className="shrink-0 whitespace-nowrap font-mono">+ {fmtPct(Math.round(fixedCostPercent * 100) / 100)}</span>
              </div>
            )}
            {unitCost > 0 ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t("ficha_tecnica_pct_summary_unit_cost")}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono">{formatCurrency(unitCost)}</span>
                </div>
                <div className="flex justify-between gap-3 font-semibold">
                  <span>{t("ficha_tecnica_pct_summary_price")}</span>
                  <span className="shrink-0 whitespace-nowrap font-mono">{formatCurrency(suggestedPrice)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t("ficha_tecnica_pct_summary_cost_percent")}</span>
                  <span className={`shrink-0 whitespace-nowrap font-mono ${costPercent > HIGH_COST_PERCENT ? "text-warning" : ""}`}>
                    {costPercent.toFixed(1)} %
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("ficha_tecnica_pct_empty_preview")}</p>
            )}
            {unitCost > 0 && costPercent > HIGH_COST_PERCENT && (
              <p className="flex gap-1.5 pt-1 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("ficha_tecnica_pct_warn_high_cost").replace("{percent}", String(HIGH_COST_PERCENT))}
              </p>
            )}
            {values.contributionMargin === 0 && (
              <p className="flex gap-1.5 pt-1 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("ficha_tecnica_pct_warn_no_profit")}
              </p>
            )}
            {hasCustomPrice && <p className="pt-1 text-xs text-muted-foreground">{t("ficha_tecnica_pct_custom_price_note")}</p>}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {editable
            ? isDefault
              ? t("ficha_tecnica_pct_status_default")
              : t("ficha_tecnica_pct_status_custom")
            : t("ficha_tecnica_pct_view_only")}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {editable ? (
            <Button type="button" variant="ghost" size="sm" onClick={onUseDefaults} disabled={isDefault} className="sm:-ml-2">
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
              {t("ficha_tecnica_pct_reset")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            {editable && (
              <Button type="button" variant="outline" onClick={onSaveDefault} disabled={isDefault} data-testid="pct-save-default">
                {t("ficha_tecnica_pct_save_default")}
              </Button>
            )}
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("ficha_tecnica_pct_done")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
