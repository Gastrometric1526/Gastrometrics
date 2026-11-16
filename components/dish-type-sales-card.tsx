"use client"

/**
 * Reportes → Finanzas → «Ventas por tipo de plato» (pedido del dueño, docs/325): cuánto se
 * vende de platos con res, cerdo, pollo, pescado…, vegetarianos, veganos y sin gluten, con los
 * mismos platos y la misma venta neta que el Menu Engineering. Cálculo en lib/dish-type-sales.ts.
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalcHelp } from "@/components/calc-help"
import { useCanSeeCosts } from "@/components/cost-gate"
import { DietIcon } from "@/components/icons/diet-icon"
import { dishLabels, type DishLabels } from "@/lib/diet"
import { proteinLabelKey } from "@/lib/dish-tags"
import { salesByDishType, type DishTypeKey } from "@/lib/dish-type-sales"
import { formatCurrency } from "@/lib/currency"
import type { DishPerformance } from "@/lib/sales-analytics"
import { useLanguage } from "@/contexts/language-context"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

export function DishTypeSalesCard({ dishes, recipes, ingredients }: { dishes: DishPerformance[]; recipes: Recipe[]; ingredients: Ingredient[] }) {
  const { t } = useLanguage()
  const seeCosts = useCanSeeCosts()
  const result = useMemo(() => {
    const labels = new Map<string, DishLabels>()
    for (const d of dishes) {
      if (!d.recipeId || labels.has(d.recipeId)) continue
      const r = recipes.find((x) => x.id === d.recipeId)
      if (r) labels.set(r.id, dishLabels(r, ingredients, recipes))
    }
    return salesByDishType(dishes, labels)
  }, [dishes, recipes, ingredients])

  const name = (k: DishTypeKey): string =>
    k === "vegetarian" ? t("diet_vegetarian") : k === "vegan" ? t("diet_vegan") : k === "gluten_free" ? t("diet_gluten_free") : t(proteinLabelKey(k) as TranslationKey)
  const pct = (n: number) => `${n.toFixed(1)} %`
  const top = result.rows[0]

  return (
    <Card className="border-border bg-card" data-tour="finanzas-dish-types">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{t("dish_sales_title")}</CardTitle>
            <CardDescription>{t("dish_sales_desc")}</CardDescription>
          </div>
          {top && (
            <CalcHelp
              title={t("dish_sales_title")}
              intro={t("dish_sales_help_intro")}
              steps={[
                { label: t("dish_sales_help_base"), formula: formatCurrency(result.recipeNet), note: t("dish_sales_help_base_note") },
                {
                  label: t("dish_sales_help_share").replace("{type}", name(top.key)),
                  formula: `${formatCurrency(top.net)} ÷ ${formatCurrency(result.recipeNet)} × 100 = ${pct(top.share)}`,
                },
                ...(result.menuNet > 0 ? [{ label: t("dish_sales_help_menus"), formula: formatCurrency(result.menuNet) }] : []),
              ]}
              footer={t("dish_sales_help_footer")}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {result.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dish_sales_empty")}</p>
        ) : (
          <ul className="space-y-3">
            {result.rows.map((r) => (
              <li key={r.key} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <DietIcon k={r.key} className="h-4 w-4 text-primary" />
                    {name(r.key)}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(r.net)} · {pct(r.share)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.share)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dish_sales_row").replace("{dishes}", String(r.dishes)).replace("{units}", String(Number(r.units.toFixed(2))))}
                  {seeCosts && ` · ${t("dish_sales_row_margin").replace("{margin}", formatCurrency(r.margin))}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
