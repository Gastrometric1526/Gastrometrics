"use client"

/**
 * «Faltantes y pérdidas» (docs/283): la diferencia entre lo que debería haber y lo que se
 * contó, en dinero, separada de las pérdidas que sí tienen motivo. Con productos de bar,
 * «Solo barra» muestra únicamente bebidas (etapa 6 de la propuesta de barra del dueño).
 * Se ve en Inventario (pestaña) y en Reportes → Merma. Cálculo en lib/stock-control.ts.
 */

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, PackageMinus, Wine } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { computeStockControl } from "@/lib/stock-control"
import { STOCK_LOSS_REASONS } from "@/lib/stock-losses"
import { computeTheoreticalStock } from "@/lib/theoretical-stock"
import { buildPackageContentLookup, type PackageContentLookup } from "@/lib/inventory-value"
import { toPackages } from "@/lib/beverage"
import { useInventory, useInventoryHistory, ensureInventoryLoaded, ensureInventoryHistoryLoaded } from "@/lib/storage/inventory"
import { ensureSalesImportsLoaded, getSalesImports } from "@/lib/storage/sales-imports"
import { useIngredients } from "@/lib/storage/ingredients"
import { useRecipes } from "@/lib/storage/recipes"
import { useMenus } from "@/lib/menus"
import type { InventoryItem } from "@/types/inventory"
import type { TheoreticalStockEntry } from "@/lib/theoretical-stock"
import type { SalesImport } from "@/types/sales-import"
import { cn } from "@/lib/utils"

export function StockControlCard({
  items,
  theoretical,
  packageLookup,
}: {
  items: InventoryItem[]
  theoretical: Map<string, TheoreticalStockEntry>
  packageLookup?: PackageContentLookup
}) {
  const { t, language } = useLanguage()
  const [onlyBar, setOnlyBar] = useState(false)
  const summary = useMemo(() => computeStockControl(items, theoretical, packageLookup, { onlyBar }), [items, theoretical, packageLookup, onlyBar])
  const unit = (u: string) => getUnitLabel(u, language)
  const qty = (n: number, u: string, content?: number) => {
    const base = `${Number(Math.abs(n).toFixed(2))} ${unit(u)}`
    const packages = content ? toPackages(Math.abs(n), content) : null
    return packages && packages >= 0.05 ? `${base} (${t("stock_control_packages").replace("{n}", String(Number(packages.toFixed(2))))})` : base
  }
  const reasons = STOCK_LOSS_REASONS.filter((r) => summary.lostByReason[r] > 0)

  return (
    <Card data-tour="stock-control">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageMinus className="h-5 w-5 text-primary" />
              {t("stock_control_title")}
            </CardTitle>
            <CardDescription>{t("stock_control_desc")}</CardDescription>
          </div>
          {summary.hasBar && (
            <div className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
              <Button size="sm" variant={onlyBar ? "ghost" : "default"} className="h-8" onClick={() => setOnlyBar(false)}>
                {t("stock_control_all")}
              </Button>
              <Button size="sm" variant={onlyBar ? "default" : "ghost"} className="h-8 gap-1.5" onClick={() => setOnlyBar(true)}>
                <Wine className="h-4 w-4" />
                {t("stock_control_only_bar")}
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{t("stock_control_shortage")}</p>
            <p className={cn("text-2xl font-semibold tabular-nums", summary.shortageValue > 0 ? "text-destructive" : "text-foreground")}>{formatCurrency(summary.shortageValue)}</p>
            <p className="text-xs text-muted-foreground">{t("stock_control_shortage_sub")}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{t("stock_control_lost")}</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(summary.lostValue)}</p>
            <p className="text-xs text-muted-foreground">{reasons.length ? reasons.map((r) => `${t(`stock_loss_reason_${r}` as never)} ${formatCurrency(summary.lostByReason[r])}`).join(" · ") : t("stock_control_lost_sub")}</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{t("stock_control_surplus")}</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(summary.surplusValue)}</p>
            <p className="text-xs text-muted-foreground">{t("stock_control_surplus_sub")}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.rows.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t("stock_control_empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {summary.rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {r.bar && <Wine className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />}
                  {r.name}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:justify-end">
                  {r.variance === null ? (
                    <span className="text-muted-foreground">{t("stock_control_no_two_counts")}</span>
                  ) : r.shortageValue > 0 ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("stock_control_row_short").replace("{qty}", qty(r.variance, r.unit, r.packageContent)).replace("{value}", formatCurrency(r.shortageValue))}
                    </span>
                  ) : r.surplusValue > 0 ? (
                    <span className="text-muted-foreground">{t("stock_control_row_surplus").replace("{qty}", qty(r.variance, r.unit, r.packageContent))}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("stock_control_row_ok")}
                    </span>
                  )}
                  {r.lost > 0 && (
                    <span className="text-muted-foreground">{t("stock_control_row_lost").replace("{qty}", qty(r.lost, r.unit, r.packageContent)).replace("{value}", formatCurrency(r.lostValue))}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("stock_control_how")}</p>
      </CardContent>
    </Card>
  )
}

/** Para Reportes → Merma: carga lo que necesita el cálculo del stock teórico. */
export function StockControlReport({ businessId }: { businessId: string }) {
  const scope = businessId === "main" ? null : businessId
  const items = useInventory(scope)
  const snapshots = useInventoryHistory(scope)
  const ingredients = useIngredients(scope)
  const recipes = useRecipes(scope)
  const menus = useMenus(businessId || "main")
  const [sales, setSales] = useState<SalesImport[]>([])
  useEffect(() => {
    let cancelled = false
    ensureInventoryLoaded(scope).catch(() => {})
    ensureInventoryHistoryLoaded(scope).catch(() => {})
    ensureSalesImportsLoaded(scope).then(() => {
      if (!cancelled) setSales(getSalesImports(scope))
    })
    return () => {
      cancelled = true
    }
  }, [scope])
  const lookup = useMemo(() => buildPackageContentLookup(ingredients), [ingredients])
  const theoretical = useMemo(
    () => computeTheoreticalStock({ items, snapshots, salesImports: sales, recipes, ingredients, menus }),
    [items, snapshots, sales, recipes, ingredients, menus],
  )
  if (items.length === 0) return null
  return <StockControlCard items={items} theoretical={theoretical} packageLookup={lookup} />
}
