"use client"

/**
 * Estadísticas → Merma (docs/202): información a partir de la merma configurada en
 * Ingredientes (global por categoría o personalizada). Cálculo en lib/merma-insights.ts.
 */

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Lightbulb, Percent, Scale, TrendingDown, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import { useInventoryHistory, ensureInventoryHistoryLoaded } from "@/lib/storage/inventory"
import { collectPriceObservations, type PriceChangeLike } from "@/lib/supplier-insights"
import { mermaInsights } from "@/lib/merma-insights"
import { formatCurrency, formatUnitPrice } from "@/lib/currency"
import { getCategoryLabel } from "@/lib/ingredient-labels"
import { formatMepAmount } from "@/lib/mep"
import { shortUnit } from "@/lib/share-text"
import type { Ingredient } from "@/types/ingredient"
import type { PurchaseOrder } from "@/types/purchase-order"

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Scale; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function EstadisticasMermaTab({
  businessId,
  ingredients,
  orders,
  changes,
}: {
  businessId: string
  ingredients: Ingredient[]
  orders: PurchaseOrder[]
  changes: PriceChangeLike[]
}) {
  const { t, language } = useLanguage()
  const snapshots = useInventoryHistory(businessId)
  useEffect(() => {
    ensureInventoryHistoryLoaded(businessId).catch(() => {})
  }, [businessId])

  const observations = useMemo(() => collectPriceObservations({ ingredients, orders, snapshots, changes }), [ingredients, orders, snapshots, changes])
  const m = useMemo(() => mermaInsights(ingredients, observations), [ingredients, observations])
  const unit = (u: string) => shortUnit(u, language)
  const ingredientsHref = businessId !== "main" ? `/ingredientes?business=${businessId}` : "/ingredientes"
  const top = m.rows[0]
  const chart = useMemo(() => [...m.rows].sort((a, b) => b.lostPerPurchase - a.lostPerPurchase).slice(0, 8).map((r) => ({ name: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name, lost: Number(r.lostPerPurchase.toFixed(2)), percent: r.percent })), [m.rows])

  return (
    <div className="space-y-6" data-tour="stats-merma">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Scale} label={t("merma_kpi_with")} value={String(m.withMerma)} sub={t("merma_kpi_with_sub")} />
        <Kpi icon={Percent} label={t("merma_kpi_avg")} value={`${m.averagePercent.toFixed(1)}%`} sub={t("merma_kpi_avg_sub")} />
        <Kpi icon={Wallet} label={t("merma_kpi_month")} value={formatCurrency(m.monthlyCost)} sub={t("merma_kpi_month_sub")} />
        <Kpi icon={TrendingDown} label={t("merma_kpi_top")} value={top ? `${top.percent.toFixed(0)}%` : "—"} sub={top ? top.name : t("merma_kpi_top_none")} />
      </div>

      <p className="text-sm text-muted-foreground">
        {t("merma_intro")}{" "}
        <Link href={ingredientsHref} className="text-primary hover:underline">
          {t("merma_intro_link")}
        </Link>
      </p>

      {m.rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Scale className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-semibold text-foreground">{t("merma_empty_title")}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("merma_empty_desc")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {chart.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base">{t("merma_chart_title")}</CardTitle>
                <CardDescription>{t("merma_chart_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} width={80} />
                    <Tooltip
                      formatter={(v: unknown) => [formatCurrency(Number(v)), t("merma_col_lost")]}
                      contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="lost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t("merma_table_title")}</CardTitle>
              <CardDescription>{t("merma_table_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">{t("merma_col_ingredient")}</th>
                      <th className="text-right font-medium px-3 py-2">{t("merma_col_percent")}</th>
                      <th className="text-right font-medium px-3 py-2 hidden md:table-cell">{t("merma_col_usable")}</th>
                      <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("merma_col_price")}</th>
                      <th className="text-right font-medium px-3 py-2">{t("merma_col_lost")}</th>
                      <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("merma_col_month")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {m.rows.map((r) => (
                      <tr key={r.ingredientId}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-foreground">{r.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {getCategoryLabel(r.category, language)} · <Badge variant="outline" className="h-4 px-1 text-[10px] align-middle">{r.mode === "custom" ? t("merma_mode_custom") : t("merma_mode_global")}</Badge>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.percent.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                          {formatMepAmount(r.originalContent)} → {formatMepAmount(r.usableContent)} {unit(r.unit)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                          {formatUnitPrice(r.pricePerBoughtUnit)} → <span className="font-semibold">{formatUnitPrice(r.pricePerUsableUnit)}</span>
                          <span className="block text-[11px] text-muted-foreground">/ {unit(r.unit)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatCurrency(r.lostPerPurchase)}</td>
                        <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{r.monthlyQuantity > 0 ? formatCurrency(r.monthlyCost) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("merma_month_note")}</p>
            </CardContent>
          </Card>
        </>
      )}

      {m.suggestions.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              {t("merma_suggest_title")}
            </CardTitle>
            <CardDescription>{t("merma_suggest_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {m.suggestions.slice(0, 16).map((s) => (
                <li key={s.ingredientId}>
                  <Link href={ingredientsHref} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/20 hover:bg-muted/40 px-3 py-1 text-sm">
                    {s.name}
                    <span className="text-xs text-muted-foreground">~{s.typicalPercent}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
