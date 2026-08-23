"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Calculator, Info, Percent, TrendingUp, Scale, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import type { COGSResult, SimplifiedPnL, SupplierPriceVarianceEntry } from "@/lib/sales-analytics"

// Explica, con los numeros reales de ESTE negocio y este periodo ya sustituidos en cada
// formula (no un ejemplo generico), cada uno de los calculos de la pestaña Finanzas de
// Estadisticas: Food Cost Real/Teorico, Varianza, Prime Cost, Margen de Contribucion,
// Rotacion de Inventario, P&L simplificado, Varianza de Precios de Proveedores y Menu
// Engineering. Mismo patron que components/technical-sheet/calculation-info-dialog.tsx.

interface FinanzasCalculationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalRevenue: number
  totalTheoreticalCost: number
  theoreticalCostPercent: number
  cogsResult: COGSResult
  realCostPercent: number
  variance: number
  periodStart: string | null
  periodEnd: string | null
  laborCostMonthly: number
  laborCostForPeriod: number
  primeCostResult: { primeCost: number; primeCostPercent: number }
  totalContributionMargin: number
  inventoryTurnover: number
  pnl: SimplifiedPnL
  supplierVarianceExample: SupplierPriceVarianceEntry | null
  dishCount: number
  avgPopularity: number
  avgMargin: number
}

export function FinanzasCalculationDialog({
  open,
  onOpenChange,
  totalRevenue,
  totalTheoreticalCost,
  theoreticalCostPercent,
  cogsResult,
  realCostPercent,
  variance,
  periodStart,
  periodEnd,
  laborCostMonthly,
  laborCostForPeriod,
  primeCostResult,
  totalContributionMargin,
  inventoryTurnover,
  pnl,
  supplierVarianceExample,
  dishCount,
  avgPopularity,
  avgMargin,
}: FinanzasCalculationDialogProps) {
  const { t, language } = useLanguage()

  const periodDays =
    periodStart && periodEnd
      ? Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1)
      : 30

  const pnlLines = [
    { label: "COGS", amount: pnl.cogs },
    { label: t("fcd_pnl_line_labor"), amount: pnl.laborCost },
    { label: t("fcd_pnl_line_rent"), amount: pnl.rent },
    { label: t("fcd_pnl_line_utilities"), amount: pnl.utilities },
    { label: t("fcd_pnl_line_operational"), amount: pnl.operationalCosts },
    { label: "Marketing", amount: pnl.marketing },
    { label: t("fcd_pnl_line_other"), amount: pnl.otherExpenses },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {t("fcd_title")}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 p-1 text-sm">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                {t("fcd_intro_title")}
              </h3>
              <p className="text-muted-foreground">
                {t("fcd_intro_body").replace(
                  "{period}",
                  periodStart && periodEnd
                    ? `${new Date(periodStart).toLocaleDateString(getDateLocale(language))} – ${new Date(periodEnd).toLocaleDateString(getDateLocale(language))}`
                    : t("fcd_period_fallback"),
                )}
              </p>
            </div>

            {/* COGS */}
            <div>
              <h4 className="font-semibold mb-1">{t("fcd_cogs_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("fcd_cogs_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(cogsResult.initialInventoryValue)} + {formatCurrency(cogsResult.purchasesValue)} −{" "}
                {formatCurrency(cogsResult.finalInventoryValue)} = {formatCurrency(cogsResult.cogs)}
              </div>
              {!cogsResult.hasFullData && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t("fcd_cogs_no_data")}</p>
              )}
            </div>

            <Separator />

            {/* Food Cost Real vs Teorico */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                {t("fcd_realcost_title")}
              </h4>
              <p className="text-muted-foreground mb-2">{t("fcd_realcost_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(cogsResult.cogs)} ÷ {formatCurrency(totalRevenue)} × 100 = {realCostPercent.toFixed(2)}%
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-1">{t("fcd_theoretical_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("fcd_theoretical_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(totalTheoreticalCost)} ({t("fcd_theoretical_formula_note")}) ÷{" "}
                {formatCurrency(totalRevenue)} × 100 = {theoreticalCostPercent.toFixed(2)}%
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-1">{t("fcd_variance_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("fcd_variance_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {realCostPercent.toFixed(2)}% − {theoreticalCostPercent.toFixed(2)}% = {variance >= 0 ? "+" : ""}
                {variance.toFixed(2)}%
              </div>
            </div>

            <Separator />

            {/* Prime Cost */}
            <div>
              <h4 className="font-semibold mb-1">{t("fcd_primecost_title")}</h4>
              <p className="text-muted-foreground mb-2">
                {t("fcd_primecost_body").replace("{days}", String(periodDays))}
              </p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                ({formatCurrency(laborCostMonthly)} ÷ 30) × {periodDays} = {formatCurrency(laborCostForPeriod)}
              </div>
              <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(cogsResult.cogs)} + {formatCurrency(laborCostForPeriod)} ={" "}
                {formatCurrency(primeCostResult.primeCost)}
              </div>
              <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(primeCostResult.primeCost)} ÷ {formatCurrency(totalRevenue)} × 100 ={" "}
                {primeCostResult.primeCostPercent.toFixed(2)}%
              </div>
            </div>

            <Separator />

            {/* Margen de contribucion */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-300" />
                {t("fcd_margin_title")}
              </h4>
              <p className="text-muted-foreground mb-2">{t("fcd_margin_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(totalRevenue)} − {formatCurrency(totalTheoreticalCost)} ={" "}
                {formatCurrency(totalContributionMargin)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("fcd_margin_note")}</p>
            </div>

            <Separator />

            {/* Rotacion de inventario */}
            <div>
              <h4 className="font-semibold mb-1">{t("fcd_turnover_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("fcd_turnover_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                ({formatCurrency(cogsResult.initialInventoryValue)} + {formatCurrency(cogsResult.finalInventoryValue)}
                ) ÷ 2 = {formatCurrency((cogsResult.initialInventoryValue + cogsResult.finalInventoryValue) / 2)}
              </div>
              <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(cogsResult.cogs)} ÷{" "}
                {formatCurrency((cogsResult.initialInventoryValue + cogsResult.finalInventoryValue) / 2)} ={" "}
                {inventoryTurnover.toFixed(2)}x
              </div>
            </div>

            <Separator />

            {/* P&L */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Scale className="h-4 w-4 text-chart-5" />
                {t("fcd_pnl_title")}
              </h4>
              <p className="text-muted-foreground mb-2">
                {t("fcd_pnl_body").replace("{days}", String(periodDays))}
              </p>
              <div className="space-y-1">
                {pnlLines.map((line) => (
                  <div key={line.label} className="flex justify-between p-2 bg-muted/50 rounded border text-xs sm:text-sm">
                    <span>{line.label}</span>
                    <span className="font-mono">−{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                {formatCurrency(pnl.revenue)} − {formatCurrency(pnl.totalExpenses)} = {formatCurrency(pnl.netProfit)}
                {" "}({pnl.netProfitPercent.toFixed(2)}%)
              </div>
            </div>

            <Separator />

            {/* Varianza de proveedores */}
            <div>
              <h4 className="font-semibold mb-1">{t("fcd_suppliervar_title")}</h4>
              <p className="text-muted-foreground mb-2">{t("fcd_suppliervar_body")}</p>
              {supplierVarianceExample ? (
                <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm">
                  {supplierVarianceExample.ingredientName}: ({formatCurrency(supplierVarianceExample.currentPrice)} −{" "}
                  {formatCurrency(supplierVarianceExample.weightedAverageCost)}) ÷{" "}
                  {formatCurrency(supplierVarianceExample.weightedAverageCost)} × 100 ={" "}
                  {supplierVarianceExample.variancePercent >= 0 ? "+" : ""}
                  {supplierVarianceExample.variancePercent.toFixed(2)}%
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">{t("fcd_suppliervar_empty")}</p>
              )}
            </div>

            <Separator />

            {/* Menu Engineering */}
            <div>
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-chart-1" />
                {t("fcd_menueng_title")}
              </h4>
              <p className="text-muted-foreground mb-2">{t("fcd_menueng_body")}</p>
              <div className="p-3 bg-muted/50 rounded border font-mono text-xs sm:text-sm space-y-1">
                <div>
                  {t("fcd_menueng_avg_popularity")
                    .replace("{count}", String(dishCount))
                    .replace("{value}", avgPopularity.toFixed(1))}
                </div>
                <div>{t("fcd_menueng_avg_margin").replace("{value}", formatCurrency(avgMargin))}</div>
              </div>
              <div className="mt-2 space-y-1 text-xs sm:text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded border">
                  <span>{t("fcd_menueng_star")}</span>
                  <span className="text-muted-foreground">{t("fcd_menueng_star_desc")}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border">
                  <span>{t("fcd_menueng_cow")}</span>
                  <span className="text-muted-foreground">{t("fcd_menueng_cow_desc")}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border">
                  <span>{t("fcd_menueng_puzzle")}</span>
                  <span className="text-muted-foreground">{t("fcd_menueng_puzzle_desc")}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded border">
                  <span>{t("fcd_menueng_dog")}</span>
                  <span className="text-muted-foreground">{t("fcd_menueng_dog_desc")}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
