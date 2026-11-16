"use client"

/**
 * /admin → Crecimiento y uso → «Toda la app» → «Tipo de plato» (pedido del dueño, docs/325):
 * qué platos tienen las cuentas (con qué carne, vegetarianos, veganos, sin gluten), qué
 * alérgenos llevan y cuánto se usa la función de alérgenos. Cálculo en lib/admin/dish-overview.ts.
 */

import { useLanguage } from "@/contexts/language-context"
import { AdminCard, BarList, ErrorState, KpiCard, KpiGrid, LoadingBlock, useAdminData } from "@/components/admin/ui"
import { DietIcon } from "@/components/icons/diet-icon"
import { allergenLabelKey } from "@/lib/allergens"
import { proteinLabelKey } from "@/lib/dish-tags"
import type { DietIconKey } from "@/lib/diet-icons"
import type { DishOverview } from "@/lib/admin/dish-overview"

const icon = (k: DietIconKey) =>
  function Icon({ className }: { className?: string }) {
    return <DietIcon k={k} className={className} />
  }
const PlateIcon = icon("allergen_free")
const VegIcon = icon("vegetarian")
const WarnIcon = icon("may_contain")
const WheatIcon = icon("gluten")
const BeefIcon = icon("beef")

export function DishOverviewPanel() {
  const { t } = useLanguage()
  const { data, loading, error, reload } = useAdminData<DishOverview & { readAt: string }>("/api/admin/dish-types")
  if (loading && !data) return <LoadingBlock rows={4} />
  if (error && !data) return <ErrorState onRetry={() => reload(true)} />
  if (!data || !Array.isArray(data.proteins)) return null
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)} %` : "0 %")
  const label = (k: DietIconKey, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <DietIcon k={k} className="h-4 w-4 text-primary" />
      {text}
    </span>
  )

  return (
    <section className="space-y-4" data-admin-dish-overview>
      <div>
        <h3 className="text-base font-semibold">{t("admin_dish_title")}</h3>
        <p className="text-xs text-muted-foreground">{t("admin_dish_desc")}</p>
      </div>
      <KpiGrid cols={4}>
        <KpiCard
          label={t("admin_dish_kpi_dishes")}
          icon={PlateIcon}
          value={data.dishes}
          sub={t("admin_dish_kpi_dishes_sub").replace("{count}", String(data.accountsWithDishes))}
        />
        <KpiCard
          label={t("admin_dish_kpi_vegetarian")}
          icon={VegIcon}
          value={data.vegetarian}
          sub={t("admin_dish_kpi_vegetarian_sub").replace("{pct}", pct(data.vegetarian, data.dishes)).replace("{vegan}", String(data.vegan))}
        />
        <KpiCard
          label={t("admin_dish_kpi_meat")}
          icon={BeefIcon}
          value={data.withMeat}
          sub={t("admin_dish_kpi_share").replace("{pct}", pct(data.withMeat, data.dishes))}
        />
        <KpiCard
          label={t("admin_dish_kpi_allergens")}
          icon={WarnIcon}
          value={data.withAllergens}
          sub={t("admin_dish_kpi_share").replace("{pct}", pct(data.withAllergens, data.dishes))}
        />
      </KpiGrid>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <AdminCard title={t("admin_dish_proteins")} icon={BeefIcon} description={t("admin_dish_proteins_desc")}>
          <BarList
            showShare={false}
            max={Math.max(1, data.dishes)}
            empty={t("admin_dish_empty")}
            rows={data.proteins
              .filter((p) => p.dishes > 0)
              .map((p) => ({
                key: p.key,
                label: label(p.key, t(proteinLabelKey(p.key))),
                value: p.dishes,
                sub: t("admin_dish_row_accounts").replace("{pct}", pct(p.dishes, data.dishes)).replace("{count}", String(p.accounts)),
              }))}
          />
        </AdminCard>

        <AdminCard title={t("admin_dish_allergens")} icon={WheatIcon} description={t("admin_dish_allergens_desc")}>
          <BarList
            showShare={false}
            max={Math.max(1, data.dishes)}
            empty={t("admin_dish_empty")}
            rows={data.allergens.map((a) => ({
              key: a.key,
              label: label(a.key, t(allergenLabelKey(a.key))),
              value: a.dishes,
              sub: t("admin_dish_kpi_share").replace("{pct}", pct(a.dishes, data.dishes)),
            }))}
          />
        </AdminCard>

        <AdminCard title={t("admin_dish_usage")} icon={VegIcon} description={t("admin_dish_usage_desc")}>
          <BarList
            showShare={false}
            max={Math.max(1, data.dishes, data.ingredients)}
            rows={[
              { key: "vegan", label: label("vegan", t("diet_vegan")), value: data.confirmed.vegan },
              { key: "vegetarian", label: label("vegetarian", t("diet_vegetarian")), value: data.confirmed.vegetarian },
              { key: "gluten_free", label: label("gluten_free", t("diet_gluten_free")), value: data.confirmed.glutenFree },
              { key: "allergen_free", label: label("allergen_free", t("diet_allergen_free")), value: data.confirmed.allergenFree },
              { key: "traces", label: label("may_contain", t("admin_dish_traces")), value: data.confirmed.traces },
              {
                key: "marked",
                label: t("admin_dish_ing_marked"),
                value: data.ingredientsWithAllergens,
                sub: t("admin_dish_ing_marked_sub")
                  .replace("{total}", String(data.ingredients))
                  .replace("{accounts}", String(data.accountsMarkingAllergens))
                  .replace("{pending}", String(data.ingredientsPending)),
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("admin_dish_usage_accounts").replace("{count}", String(data.accountsConfirming)).replace("{override}", String(data.ingredientsOverride))}
          </p>
        </AdminCard>
      </div>
    </section>
  )
}
