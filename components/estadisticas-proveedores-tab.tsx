"use client"

/**
 * Estadísticas → Proveedores (docs/202): historial de precios por ingrediente, comparación de
 * proveedores, oportunidades de ahorro y resumen por proveedor. Reemplaza la tarjeta
 * «Historial de precios» que vivía en Panorama (ahora con proveedor y más fuentes de precio).
 * Cálculo en lib/supplier-insights.ts.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { BadgePercent, History, PiggyBank, Store, TrendingDown, TrendingUp, Truck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import { useInventoryHistory, ensureInventoryHistoryLoaded } from "@/lib/storage/inventory"
import { collectPriceObservations, summarizeIngredients, summarizeSuppliers, type PriceChangeLike } from "@/lib/supplier-insights"
import { formatCurrency, formatUnitPrice } from "@/lib/currency"
import { formatDate } from "@/lib/date-format"
import { shortUnit } from "@/lib/share-text"
import type { Ingredient } from "@/types/ingredient"
import type { PurchaseOrder } from "@/types/purchase-order"

function Kpi({ icon: Icon, label, value, sub, tone = "default" }: { icon: typeof Store; label: string; value: string; sub?: string; tone?: "default" | "good" | "bad" }) {
  const toneCls = tone === "good" ? "text-chart-2" : tone === "bad" ? "text-destructive" : "text-foreground"
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`

export function EstadisticasProveedoresTab({
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
  const summaries = useMemo(() => summarizeIngredients(observations), [observations])
  const suppliers = useMemo(() => summarizeSuppliers(observations, orders, summaries), [observations, orders, summaries])

  // Con historial: el precio cambió al menos una vez (precios distintos). Los que más cambian,
  // primero. Si ninguno cambió todavía, el selector muestra igual los que tienen registros.
  const distinct = (h: { price: number }[]) => new Set(h.map((x) => x.price.toFixed(4))).size
  const changed = useMemo(() => summaries.filter((s) => distinct(s.history) > 1).sort((a, b) => distinct(b.history) - distinct(a.history) || a.name.localeCompare(b.name)), [summaries])
  const withHistory = useMemo(() => (changed.length ? changed : summaries.filter((s) => s.history.length > 1 || s.suppliers.length > 0).sort((a, b) => a.name.localeCompare(b.name))), [changed, summaries])
  const opportunities = useMemo(() => summaries.filter((s) => s.savingPercent > 0).sort((a, b) => b.monthlySaving - a.monthlySaving || b.savingPercent - a.savingPercent), [summaries])
  const risers = useMemo(() => summaries.filter((s) => (s.change30Percent ?? 0) > 0.05).sort((a, b) => (b.change30Percent ?? 0) - (a.change30Percent ?? 0)).slice(0, 6), [summaries])

  const [selectedKey, setSelectedKey] = useState("")
  const selected = withHistory.find((s) => s.key === selectedKey) || withHistory[0]
  const chartData = useMemo(() => (selected ? selected.history.map((h) => ({ date: formatDate(h.date), price: h.price, supplier: h.supplier || "—" })) : []), [selected])
  const totalSaving = opportunities.reduce((s, o) => s + o.monthlySaving, 0)
  const unit = (u: string) => shortUnit(u, language)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour="stats-suppliers">
        <Kpi icon={Truck} label={t("prov_kpi_suppliers")} value={String(suppliers.length)} sub={t("prov_kpi_suppliers_sub")} />
        <Kpi icon={History} label={t("prov_kpi_tracked")} value={String(changed.length)} sub={t("prov_kpi_tracked_sub")} />
        <Kpi icon={TrendingUp} label={t("prov_kpi_rising")} value={String(risers.length)} sub={t("prov_kpi_rising_sub")} tone={risers.length ? "bad" : "default"} />
        <Kpi icon={PiggyBank} label={t("prov_kpi_saving")} value={formatCurrency(totalSaving)} sub={t("prov_kpi_saving_sub").replace("{count}", String(opportunities.length))} tone={totalSaving > 0 ? "good" : "default"} />
      </div>

      {/* Historial de precios + comparación del ingrediente elegido */}
      <Card className="border-border bg-card" data-tour="stats-price-history">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-chart-1" />
            {t("estadisticas_price_history_title")}
          </CardTitle>
          <CardDescription>{t("prov_history_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">{t("prov_history_empty")}</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Select value={selected.key} onValueChange={setSelectedKey}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder={t("estadisticas_price_history_select_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {withHistory.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.name} · {pct(s.changePercent)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selected.changePercent > 0 ? "destructive" : "outline"} className={`gap-1 ${selected.changePercent < 0 ? "text-chart-2 border-chart-2/40" : ""}`}>
                    {selected.changePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {pct(selected.changePercent)} {t("estadisticas_since_first_record_suffix")}
                  </Badge>
                  <Badge variant="outline">
                    {t("prov_range")}: {formatUnitPrice(selected.minPrice)} – {formatUnitPrice(selected.maxPrice)} / {unit(selected.unit)}
                  </Badge>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatUnitPrice(v)} width={80} />
                  <Tooltip
                    formatter={(v: unknown, _n: unknown, item: { payload?: { supplier?: string } }) => [`${formatUnitPrice(Number(v))} / ${unit(selected.unit)}`, item?.payload?.supplier || ""]}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Line type="monotone" dataKey="price" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("prov_compare_title")}</p>
                {selected.suppliers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("prov_compare_none")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">{t("prov_col_supplier")}</th>
                          <th className="text-right font-medium px-3 py-2">{t("prov_col_last_price")}</th>
                          <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("prov_col_lowest")}</th>
                          <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("prov_col_times")}</th>
                          <th className="text-right font-medium px-3 py-2">{t("prov_col_last_date")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selected.suppliers.map((s, i) => (
                          <tr key={s.supplier}>
                            <td className="px-3 py-2">
                              <span className="font-medium text-foreground">{s.supplier}</span>
                              <span className="ml-2 inline-flex gap-1">
                                {i === 0 && selected.suppliers.length > 1 && <Badge className="h-5 px-1.5 text-[10px] bg-chart-2 hover:bg-chart-2">{t("prov_badge_cheapest")}</Badge>}
                                {s.supplier === selected.currentSupplier && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{t("prov_badge_current")}</Badge>}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatUnitPrice(s.lastPrice)}</td>
                            <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{formatUnitPrice(s.minPrice)}</td>
                            <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{s.count}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{formatDate(s.lastDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Oportunidades de ahorro */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BadgePercent className="h-4 w-4 text-chart-2" />
              {t("prov_saving_title")}
            </CardTitle>
            <CardDescription>{t("prov_saving_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("prov_saving_empty")}</p>
            ) : (
              <ul className="space-y-2">
                {opportunities.slice(0, 8).map((o) => (
                  <li key={o.key}>
                    <button type="button" onClick={() => setSelectedKey(o.key)} className="w-full text-left rounded-lg bg-muted/20 hover:bg-muted/40 px-3 py-2.5 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">{o.name}</span>
                        <Badge className="bg-chart-2 hover:bg-chart-2 shrink-0">−{o.savingPercent.toFixed(0)}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("prov_saving_line")
                          .replace("{cheap}", o.cheapest?.supplier || "")
                          .replace("{price}", `${formatUnitPrice(o.cheapest?.lastPrice || 0)}/${unit(o.unit)}`)
                          .replace("{current}", o.currentSupplier || "—")}
                        {o.monthlySaving > 0 ? ` · ${t("prov_saving_month").replace("{amount}", formatCurrency(o.monthlySaving))}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Mayores alzas en 30 días */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-destructive" />
              {t("prov_risers_title")}
            </CardTitle>
            <CardDescription>{t("prov_risers_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {risers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("prov_risers_empty")}</p>
            ) : (
              <ul className="space-y-2">
                {risers.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => setSelectedKey(r.key)} className="w-full flex items-center justify-between gap-2 rounded-lg bg-muted/20 hover:bg-muted/40 px-3 py-2.5 text-sm transition-colors">
                      <span className="truncate text-foreground">{r.name}</span>
                      <span className="shrink-0 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatUnitPrice(r.lastPrice)}/{unit(r.unit)}
                        </span>
                        <span className="font-semibold tabular-nums text-destructive">{pct(r.change30Percent ?? 0)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Proveedores */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-chart-3" />
            {t("prov_suppliers_title")}
          </CardTitle>
          <CardDescription>{t("prov_suppliers_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("prov_suppliers_empty")}{" "}
              <Link href={businessId !== "main" ? `/ingredientes?business=${businessId}` : "/ingredientes"} className="text-primary hover:underline">
                {t("nav_ingredientes")}
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">{t("prov_col_supplier")}</th>
                    <th className="text-right font-medium px-3 py-2">{t("prov_col_ingredients")}</th>
                    <th className="text-right font-medium px-3 py-2">{t("prov_col_spend")}</th>
                    <th className="text-right font-medium px-3 py-2 hidden md:table-cell">{t("prov_col_cheapest_for")}</th>
                    <th className="text-right font-medium px-3 py-2 hidden md:table-cell">{t("prov_col_avg_change")}</th>
                    <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">{t("prov_col_last_purchase")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppliers.map((s) => (
                    <tr key={s.supplier}>
                      <td className="px-3 py-2 font-medium text-foreground">{s.supplier}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.ingredients}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(s.spend)}
                        {s.orders > 0 && <span className="block text-[11px] text-muted-foreground">{t("prov_orders_count").replace("{count}", String(s.orders))}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{s.cheapestFor}</td>
                      <td className={`px-3 py-2 text-right tabular-nums hidden md:table-cell ${s.avgChangePercent > 0.05 ? "text-destructive" : s.avgChangePercent < -0.05 ? "text-chart-2" : ""}`}>{pct(s.avgChangePercent)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground hidden sm:table-cell">{s.lastDate ? formatDate(s.lastDate) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t("prov_sources_note")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
