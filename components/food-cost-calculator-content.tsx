"use client"

/**
 * Calculadora pública de food cost y precio de venta (docs/178): gratis y sin registro.
 * Mismas fórmulas que la Ficha Técnica (lib/public-calculator.ts) y llamada a crear cuenta.
 */

import { useState } from "react"
import Link from "next/link"
import { Calculator, Scale } from "lucide-react"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import { CURRENCY_OPTIONS } from "@/lib/currency"
import { publicSalePrice, realCostWithWaste } from "@/lib/public-calculator"

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function NumberField({ id, label, help, value, onChange }: { id: string; label: string; help?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

export function FoodCostCalculatorContent() {
  const { t } = useLanguage()
  const [currency, setCurrency] = useState("HNL")
  const [cost, setCost] = useState("")
  const [target, setTarget] = useState("30")
  const [isv, setIsv] = useState("0")
  const [commission, setCommission] = useState("0")
  const [purchase, setPurchase] = useState("")
  const [waste, setWaste] = useState("10")

  const symbol = CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol ?? ""
  const money = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const result = publicSalePrice({
    unitCost: num(cost),
    targetFoodCostPercent: num(target),
    isvPercent: num(isv),
    commissionPercent: num(commission),
    currencyCode: currency,
  })
  const realCost = realCostWithWaste(num(purchase), num(waste))

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
          <header className="space-y-2 text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">{t("calc_title")}</h1>
            <p className="text-muted-foreground">{t("calc_subtitle")}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-primary" />
                  {t("calc_price_heading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("calc_currency_label")}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} · {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <NumberField id="calc-cost" label={t("calc_cost_label")} value={cost} onChange={setCost} />
                <NumberField id="calc-target" label={t("calc_target_label")} help={t("calc_target_help")} value={target} onChange={setTarget} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField id="calc-isv" label={t("calc_isv_label")} help={t("calc_isv_help")} value={isv} onChange={setIsv} />
                  <NumberField id="calc-commission" label={t("calc_commission_label")} help={t("calc_commission_help")} value={commission} onChange={setCommission} />
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3" aria-live="polite">
                  {result ? (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("calc_result_price")}</p>
                        <p className="text-3xl font-semibold tabular-nums text-foreground">{money(result.price)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("calc_result_rounded_note").replace("{step}", `${symbol} ${result.step}`).replace("{raw}", money(result.beforeRounding))}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">{t("calc_result_profit")}</p>
                          <p className="font-semibold tabular-nums">{money(result.profit)}</p>
                          <p className="text-xs text-muted-foreground">{t("calc_result_profit_help")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("calc_result_foodcost")}</p>
                          <p className="font-semibold tabular-nums">{result.realFoodCostPercent.toFixed(1)} %</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("calc_empty")}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("calc_formula")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scale className="h-5 w-5 text-primary" />
                  {t("calc_waste_heading")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("calc_waste_intro")}</p>
                <NumberField id="calc-purchase" label={t("calc_purchase_label")} value={purchase} onChange={setPurchase} />
                <NumberField id="calc-waste" label={t("calc_waste_label")} help={t("calc_waste_help")} value={waste} onChange={setWaste} />
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-live="polite">
                  <p className="text-sm text-muted-foreground">{t("calc_waste_result")}</p>
                  <p className="text-3xl font-semibold tabular-nums text-foreground">{realCost ? money(realCost) : "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t("calc_waste_formula")}</p>
              </CardContent>
            </Card>
          </div>

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">{t("calc_cta_title")}</h2>
            <p className="max-w-2xl mx-auto text-muted-foreground">{t("calc_cta_body")}</p>
            <Button asChild size="lg">
              <Link href="/signup">{t("calc_cta_button")}</Link>
            </Button>
            <p className="text-xs text-muted-foreground">{t("calc_cta_note")}</p>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
