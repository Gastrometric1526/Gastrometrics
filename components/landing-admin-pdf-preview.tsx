"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { getCategoryLabel } from "@/lib/ingredient-labels"
import { getClassificationLabel } from "@/lib/classification-labels"

// Réplica del PDF Administrativo real (lib/pdf/recipe-pdf-generator.ts,
// generateAdministrativePDF, líneas ~272-816) adaptada de A4 horizontal a una tarjeta
// vertical de landing — pedido explícito del dueño del proyecto: mostrar en el hero lo
// mismo que trae ese PDF (ya tiene todos los datos juntos), no solo el fragmento de
// tabla que mostraba la tarjeta anterior. Mismas secciones, mismo orden, mismas
// etiquetas reales que usa el generador — cifras ilustrativas pero matemáticamente
// consistentes con la fórmula real de costeo (CLAUDE.md: "los seis rubros son % sobre
// costo de producción", y el precio final redondea hacia arriba al 5 más cercano, ver
// components/technical-sheet/index.tsx roundToNearestFive).
export function LandingAdminPdfPreview() {
  const { t, language } = useLanguage()

  const ingredients = [
    { name: "Pan de hamburguesa", category: "OTROS", qty: "1 und", cost: "L 6.50" },
    { name: "Carne de res", category: "RES", qty: "150 g", cost: "L 32.00" },
    { name: "Queso cheddar", category: "LÁCTEOS Y DERIVADOS", qty: "30 g", cost: "L 10.80" },
    { name: "Vegetales frescos", category: "VEGETAL", qty: "80 g", cost: "L 7.20" },
    { name: "Salsa de la casa", category: "OTROS", qty: "20 g", cost: "L 3.60" },
  ] as const

  // Los 6 rubros son % sobre el costo de producción (L 60.10), no sobre el precio de
  // venta — mismo criterio que usa la app real. La suma de los montos, sumada al costo
  // de producción, es lo que roundToNearestFive redondea hacia el precio final.
  const breakdown = [
    { labelKey: "ficha_tecnica_field_public_services" as const, pct: 6, amount: 3.61 },
    { labelKey: "ficha_tecnica_field_marketing" as const, pct: 4, amount: 2.4 },
    { labelKey: "ficha_tecnica_field_operational_costs" as const, pct: 12, amount: 7.21 },
    { labelKey: "ficha_tecnica_field_labor_costs" as const, pct: 28, amount: 16.83 },
    { labelKey: "ficha_tecnica_field_isv" as const, pct: 15, amount: 9.02 },
    { labelKey: "ficha_tecnica_field_net_profit" as const, pct: 135, amount: 81.14 },
  ]
  const maxAmount = Math.max(...breakdown.map((b) => b.amount))

  const productionCost = 60.1
  const unitCost = 60.1
  const unitPrice = 185.0
  const unitProfit = unitPrice - unitCost
  const costPercent = (unitCost / unitPrice) * 100
  const contributionMargin = (unitProfit / unitPrice) * 100

  return (
    <Card className="border-hairline bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Banda superior */}
        <div className="flex items-center justify-between px-5 py-3 bg-canvas-alt border-b border-hairline">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-text-4">
            {t("landing_hero_card_kicker")} · FT-0087
          </p>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive bg-danger-soft px-2 py-1 rounded">
            {t("landing_admin_preview_copy_badge")}
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Metadatos */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_name_label")}
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Hamburguesa clásica</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_classification_label")}
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {getClassificationLabel("Línea caliente (Cuisine chaude)", language)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_servings_label")}
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">1</p>
            </div>
          </div>

          {/* Barra de resumen de costos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-secondary">
            <div>
              <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_production_cost_label")}
              </p>
              <p className="text-sm font-semibold text-foreground tabular-nums">L {productionCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("ficha_tecnica_col_unit_cost")}
              </p>
              <p className="text-sm font-semibold text-foreground tabular-nums">L {unitCost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_unit_price_label")}
              </p>
              <p className="text-sm font-semibold text-foreground tabular-nums">L {unitPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("landing_admin_preview_unit_profit_label")}
              </p>
              <p className="text-sm font-semibold text-success tabular-nums">L {unitProfit.toFixed(2)}</p>
            </div>
          </div>

          {/* Ingredientes + Desglose, lado a lado como en el PDF real */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-4 mb-2">
                {t("landing_admin_preview_ingredients_title")}
              </p>
              <div className="divide-y divide-hairline border-t border-hairline text-xs">
                {ingredients.map((ing) => (
                  <div key={ing.name} className="flex items-center justify-between py-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{ing.name}</p>
                      <p className="text-text-4 text-[10.5px]">{getCategoryLabel(ing.category, language)}</p>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums text-text-3 shrink-0">
                      <span className="text-text-4">{ing.qty}</span>
                      <span>{ing.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-4 mb-2">
                {t("landing_admin_preview_breakdown_title")}
              </p>
              <div className="space-y-2">
                {breakdown.map((item) => (
                  <div key={item.labelKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{t(item.labelKey)}</span>
                      <span className="tabular-nums text-text-3">
                        {item.pct}% · L {item.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-hairline overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(item.amount / maxAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pie: estadísticas */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-hairline">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("ficha_tecnica_food_cost_percent_label")}
              </p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{costPercent.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-4">
                {t("ficha_tecnica_field_contribution_margin")}
              </p>
              <p className="text-xl font-semibold text-foreground tabular-nums">{contributionMargin.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
