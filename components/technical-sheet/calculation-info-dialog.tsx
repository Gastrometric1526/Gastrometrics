"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Calculator, Info, Percent, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import type { PricingMethod } from "@/types/business"
import { useLanguage } from "@/contexts/language-context"

// Explica, con los numeros reales de ESTA receta ya sustituidos en cada formula (no un
// ejemplo generico), todo el recorrido de calculo: extension por ingrediente -> costo de
// produccion -> costo unitario -> precio de venta (segun el metodo elegido, con el
// redondeo) -> precio de venta total -> margen de contribucion -> costo % (food cost).
// Mismo patron visual que components/merma-info-dialog.tsx, pero dinamico en vez de
// estatico: cada seccion muestra la formula Y el resultado con los valores de la receta.

interface CalculationInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productionCost: number
  yieldAmount: number
  unitCost: number
  paxModifier: number
  paxMultiplier: number
  pricingMethod: PricingMethod
  targetFoodCostPercent: number
  percentages: {
    publicServices: number
    marketing: number
    operationalCosts: number
    laborCosts: number
    isv: number
    contributionMargin: number
  }
  amounts: {
    publicServicesAmount: number
    marketingAmount: number
    operationalCostsAmount: number
    laborCostsAmount: number
    isvAmount: number
    netProfitAmount: number
  }
  unitProfit: number
  gastrometricsPrice: number
  foodCostPrice: number
  finalPrice: number
  totalSales: number
  netProfit: number
  calculatedContributionMargin: number
  foodCostPercent: number
}

export function CalculationInfoDialog({
  open,
  onOpenChange,
  productionCost,
  yieldAmount,
  unitCost,
  paxModifier,
  paxMultiplier,
  pricingMethod,
  targetFoodCostPercent,
  percentages,
  amounts,
  unitProfit,
  gastrometricsPrice,
  foodCostPrice,
  finalPrice,
  totalSales,
  netProfit,
  calculatedContributionMargin,
  foodCostPercent,
}: CalculationInfoDialogProps) {
  const { t } = useLanguage()
  const paxIsActive = paxModifier > 0 && paxMultiplier !== 1
  const rawPrice = pricingMethod === "food_cost" ? unitCost / (targetFoodCostPercent / 100) : unitCost + unitProfit
  const roundedPrice = pricingMethod === "food_cost" ? foodCostPrice : gastrometricsPrice

  const rubros = [
    { label: t("ficha_tecnica_item_public_services"), pct: percentages.publicServices, amount: amounts.publicServicesAmount },
    { label: t("ficha_tecnica_item_marketing"), pct: percentages.marketing, amount: amounts.marketingAmount },
    { label: t("ficha_tecnica_item_operational_costs"), pct: percentages.operationalCosts, amount: amounts.operationalCostsAmount },
    { label: t("ficha_tecnica_item_labor_costs"), pct: percentages.laborCosts, amount: amounts.laborCostsAmount },
    { label: t("ficha_tecnica_item_isv"), pct: percentages.isv, amount: amounts.isvAmount },
    { label: t("ficha_tecnica_item_net_profit"), pct: percentages.contributionMargin, amount: amounts.netProfitAmount },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {t("ficha_tecnica_calc_info_title")}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-1 text-sm">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                {t("ficha_tecnica_calc_info_intro_title")}
              </h3>
              <p className="text-muted-foreground">{t("ficha_tecnica_calc_info_intro_desc")}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">{t("ficha_tecnica_calc_info_step1_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("ficha_tecnica_calc_info_step1_desc")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {t("ficha_tecnica_calc_info_step1_formula")} = {formatCurrency(productionCost)}
              </div>
            </div>

            {paxIsActive && (
              <div>
                <h4 className="font-semibold mb-1">{t("ficha_tecnica_calc_info_pax_title")}</h4>
                <p className="text-muted-foreground mb-2">{t("ficha_tecnica_calc_info_pax_desc")}</p>
                <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                  {paxModifier} ÷ {yieldAmount > 0 ? (yieldAmount / paxMultiplier).toFixed(0) : "0"} = ×
                  {paxMultiplier.toFixed(2)}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-semibold mb-1">{t("ficha_tecnica_calc_info_step2_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("ficha_tecnica_calc_info_step2_desc")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(productionCost)} ÷ {yieldAmount.toFixed(0)} = {formatCurrency(unitCost)}
              </div>
            </div>

            <Separator />

            {pricingMethod === "food_cost" ? (
              <div>
                <h4 className="font-semibold mb-1 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  {t("ficha_tecnica_calc_info_foodcost_title")}
                </h4>
                <p className="text-muted-foreground mb-2">{t("ficha_tecnica_calc_info_foodcost_desc")}</p>
                <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                  {formatCurrency(unitCost)} ÷ {targetFoodCostPercent}% = {formatCurrency(rawPrice)}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-semibold mb-1 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  {t("ficha_tecnica_calc_info_rubros_title")}
                </h4>
                <p className="text-muted-foreground mb-2">{t("ficha_tecnica_calc_info_rubros_desc")}</p>
                <div className="space-y-1">
                  {rubros.map((r) => (
                    <div key={r.label} className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                      <span>
                        {r.label} ({r.pct.toFixed(2)}% × {formatCurrency(productionCost)})
                      </span>
                      <span className="font-mono font-medium">{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                  {t("ficha_tecnica_calc_info_rubros_sum_label")}: {formatCurrency(amounts.publicServicesAmount + amounts.marketingAmount + amounts.operationalCostsAmount + amounts.laborCostsAmount + amounts.isvAmount + amounts.netProfitAmount)}
                  {" ÷ "}
                  {yieldAmount.toFixed(0)} = {formatCurrency(unitProfit)} ({t("ficha_tecnica_col_unit_profit")})
                </div>
                <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                  {formatCurrency(unitCost)} + {formatCurrency(unitProfit)} = {formatCurrency(rawPrice)}
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
              <p className="text-amber-900 dark:text-amber-300">
                {t("ficha_tecnica_calc_info_rounding_desc")}
              </p>
              <div className="mt-2 font-mono text-xs sm:text-sm text-amber-900 dark:text-amber-300">
                {formatCurrency(rawPrice)} → <span className="font-bold">{formatCurrency(roundedPrice)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-300" />
                {t("ficha_tecnica_calc_info_totals_title")}
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                  <span>{t("ficha_tecnica_col_total_sale_price")}</span>
                  <span className="font-mono">
                    {formatCurrency(finalPrice)} × {yieldAmount.toFixed(0)} = {formatCurrency(totalSales)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                  <span>{t("ficha_tecnica_net_profit_total_sales_label")}</span>
                  <span className="font-mono">
                    {formatCurrency(totalSales)} − {formatCurrency(productionCost)} = {formatCurrency(netProfit)}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                  <span>{t("ficha_tecnica_field_contribution_margin")}</span>
                  <span className="font-mono">{calculatedContributionMargin.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                  <span>{t("ficha_tecnica_food_cost_percent_label")}</span>
                  <span className="font-mono">{foodCostPercent.toFixed(2)}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t("ficha_tecnica_calc_info_foodcost_percent_note")}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
