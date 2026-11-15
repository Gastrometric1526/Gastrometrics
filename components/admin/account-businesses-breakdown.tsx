"use client"

/**
 * /admin → Cuentas → una cuenta → «Negocios» (docs/232): resumen de la cuenta (lo mismo que ve
 * en su Dashboard, más negocios creados, PDF exportados, recetas migradas e importaciones) y una
 * tarjeta por espacio —el principal y cada negocio— con su contenido, sus números y su última
 * actividad. Activar o desactivar un negocio sigue aquí, en su tarjeta.
 */

import { Building2, ChefHat, DollarSign, FileDown, Package, Repeat, Tag, TrendingUp, Upload, AlertTriangle, Receipt, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import type { TranslationKey } from "@/lib/i18n/translations"
import { formatDate, formatDateTime } from "@/lib/date-format"
import type { AccountBusinessBreakdown } from "@/lib/admin/business-breakdown-server"
import type { BusinessSettingsSummary, SpaceStats } from "@/lib/admin/business-breakdown"
import { AdminCard, EmptyState, ErrorState, KpiCard, KpiGrid, LoadingBlock, formatPercent, useAdminData } from "@/components/admin/ui"

interface Business {
  id: string
  name: string
  createdAt: string
  isActive: boolean
}

const PDF_KINDS = ["recipe", "menu", "mep", "cash_up", "inventory", "invoice", "purchase_order", "sales_history", "other"] as const

function money(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

export function AccountBusinessesBreakdown({
  userId,
  businesses,
  onToggle,
}: {
  userId: string
  businesses: Business[]
  onToggle: (business: Business) => void
}) {
  const { t } = useLanguage()
  const { data, error, loading, reload } = useAdminData<{ breakdown?: AccountBusinessBreakdown | null }>(
    `/api/admin/account-businesses?userId=${encodeURIComponent(userId)}&breakdown=1`,
  )
  const breakdown = data?.breakdown ?? null
  const currency = breakdown?.currency ?? null

  const pdfSummary = (byKind: Record<string, number>) =>
    PDF_KINDS.filter((k) => byKind[k])
      .map((k) => `${t(`admin_biz_pdf_${k}` as TranslationKey)} ${byKind[k]}`)
      .join(" · ")

  if (loading && !breakdown) return <LoadingBlock rows={6} />
  if (error || !breakdown) return <ErrorState onRetry={() => reload(true)} />

  const totals = breakdown.totals
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin_biz_summary_title")}</h3>
        <KpiGrid cols={4}>
          {/* Orden fijo (docs/316): lo que pide atención, dinero, contenido y uso. */}
          <KpiCard label={t("admin_biz_no_price")} value={totals.recipesWithoutPrice} icon={Tag} tone={totals.recipesWithoutPrice > 0 ? "warn" : "default"} />
          <KpiCard label={t("admin_biz_low_stock")} value={totals.lowStock} icon={AlertTriangle} tone={totals.lowStock > 0 ? "bad" : "default"} />
          <KpiCard label={t("admin_biz_sales_total")} value={money(totals.salesRevenue, currency)} icon={Receipt} sub={`${t("admin_biz_sales_30d")}: ${money(totals.salesRevenue30d, currency)}`} />
          <KpiCard label={t("admin_biz_food_cost")} value={formatPercent(totals.theoreticalFoodCostPercent, 1)} icon={TrendingUp} help={t("admin_biz_food_cost_help")} />
          <KpiCard label={t("admin_biz_avg_cost")} value={money(totals.averageCost, currency)} icon={DollarSign} help={t("admin_biz_avg_cost_help")} />
          <KpiCard label={t("admin_biz_avg_margin")} value={formatPercent(totals.averageMargin, 1)} icon={TrendingUp} help={t("admin_biz_avg_margin_help")} />
          <KpiCard
            label={t("admin_biz_created")}
            value={totals.businessesCreated}
            icon={Building2}
            sub={t("admin_biz_created_sub").replace("{now}", String(totals.businessesNow)).replace("{deleted}", String(totals.businessesDeleted))}
          />
          <KpiCard label={t("admin_biz_recipes")} value={totals.recipes} icon={ChefHat} sub={t("admin_biz_sub_recipes").replace("{count}", String(totals.subRecipes))} />
          <KpiCard label={t("admin_biz_ingredients")} value={totals.ingredients} icon={Package} />
          <KpiCard label={t("admin_biz_team_members")} value={totals.teamMembers} icon={Users} />
          <KpiCard label={t("admin_biz_pdfs")} value={totals.pdfExports} icon={FileDown} help={t("admin_biz_pdfs_help")} sub={pdfSummary(totals.pdfByKind) || undefined} />
          <KpiCard label={t("admin_biz_migrated")} value={totals.recipesMigrated} icon={Repeat} help={t("admin_biz_migrated_help")} />
          <KpiCard label={t("admin_biz_imports")} value={totals.imports} icon={Upload} />
        </KpiGrid>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("admin_biz_per_space_title")}</h3>
        {breakdown.spaces.length === 0 ? (
          <EmptyState text={t("admin_accounts_businesses_empty")} />
        ) : (
          breakdown.spaces.map((space) => {
            const business = space.id ? businesses.find((b) => b.id === space.id) : undefined
            return (
              <SpaceCard
                key={space.id ?? "main"}
                space={space}
                currency={currency}
                pdfSummary={pdfSummary(space.pdfByKind)}
                business={business}
                onToggle={onToggle}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function SpaceCard({
  space,
  currency,
  pdfSummary,
  business,
  onToggle,
}: {
  space: SpaceStats
  currency: string | null
  pdfSummary: string
  business?: Business
  onToggle: (business: Business) => void
}) {
  const { t } = useLanguage()
  const isActive = business ? business.isActive : space.isActive
  // Mismo orden que el resumen (docs/316): atención, dinero, contenido y uso.
  const rows: [TranslationKey, string | number][] = [
    ["admin_biz_no_price", space.recipesWithoutPrice],
    ["admin_biz_low_stock", space.lowStock],
    ["admin_biz_sales_total", money(space.salesRevenue, currency)],
    ["admin_biz_sales_30d", money(space.salesRevenue30d, currency)],
    ["admin_biz_food_cost", formatPercent(space.theoreticalFoodCostPercent, 1)],
    ["admin_biz_avg_cost", money(space.averageCost, currency)],
    ["admin_biz_avg_margin", formatPercent(space.averageMargin, 1)],
    ["admin_biz_last_sale", space.lastSaleAt ? formatDate(space.lastSaleAt) : "—"],
    ["admin_biz_recipes", space.recipes],
    ["admin_biz_sub_recipes_label", space.subRecipes],
    ["admin_biz_ingredients", space.ingredients],
    ["admin_biz_menus", space.menus],
    ["admin_biz_inventory", space.inventoryItems],
    ["admin_biz_counts", space.inventoryCounts],
    ["admin_biz_orders", space.purchaseOrders],
    ["admin_biz_invoices", space.invoices],
    ["admin_biz_sales", space.salesImports],
    ...(space.id ? ([["admin_biz_team_members", space.teamMembers]] as [TranslationKey, number][]) : []),
    ["admin_biz_pdfs", space.pdfExports],
    ["admin_biz_migrated", space.recipesMigrated],
    ["admin_biz_imports", space.imports],
  ]
  return (
    <AdminCard
      title={space.id ? space.name : t("admin_biz_personal_dashboard")}
      icon={Building2}
      description={
        <>
          {space.createdAt && t("admin_biz_created_on").replace("{date}", formatDate(space.createdAt))}
          {space.createdAt && " · "}
          {space.lastActivityAt ? t("admin_biz_last_activity").replace("{date}", formatDateTime(space.lastActivityAt)) : t("admin_biz_no_activity")}
        </>
      }
      actions={
        business && (
          <>
            <Badge variant={isActive ? "secondary" : "outline"}>
              {isActive ? t("admin_accounts_business_active") : t("admin_accounts_business_inactive")}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => onToggle(business)}>
              {isActive ? t("admin_accounts_business_deactivate") : t("admin_accounts_business_activate")}
            </Button>
          </>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1">
            <dt className="text-muted-foreground">{t(key)}</dt>
            <dd className="font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {pdfSummary && <p className="mt-3 text-xs text-muted-foreground">{t("admin_biz_pdfs")}: {pdfSummary}</p>}
      {space.settings && <SettingsList settings={space.settings} currency={currency} />}
    </AdminCard>
  )
}

/** Lo que la persona configuró en el negocio (docs/315). */
function SettingsList({ settings, currency }: { settings: BusinessSettingsSummary; currency: string | null }) {
  const { t } = useLanguage()
  const notSet = t("admin_biz_not_set")
  const method =
    settings.pricingMethod === "food_cost" || (!settings.pricingMethod && settings.targetFoodCostPercent !== null)
      ? t("admin_biz_setting_method_food_cost").replace("{percent}", String(settings.targetFoodCostPercent ?? 30))
      : settings.pricingMethod
        ? t("admin_biz_setting_method_six")
        : notSet
  const valuation = (settings.valuationMethod || "last_purchase") as "last_purchase" | "weighted_average" | "replacement"
  const valuationKey = `admin_biz_valuation_${valuation}` as TranslationKey
  const rows: [TranslationKey, string][] = [
    ["admin_biz_setting_type", settings.type || notSet],
    ["admin_biz_setting_method", method],
    ["admin_biz_setting_plates", settings.estimatedMonthlyPlates ? String(settings.estimatedMonthlyPlates) : notSet],
    ["admin_biz_setting_expenses", settings.monthlyFixedExpenses !== null ? money(settings.monthlyFixedExpenses, currency) : notSet],
    ["admin_biz_setting_valuation", ["last_purchase", "weighted_average", "replacement"].includes(valuation) ? t(valuationKey) : notSet],
  ]
  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">{t("admin_biz_settings_title")}</h4>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1">
            <dt className="text-muted-foreground">{t(key)}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
