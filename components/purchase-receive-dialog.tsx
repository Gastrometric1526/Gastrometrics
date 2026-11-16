"use client"

/**
 * Recibir una orden revisándola (docs/322): por cada producto, cuánto llegó y a qué precio lo
 * cobró el proveedor. Arriba se ve la diferencia en dinero contra lo pedido, con su «¿Cómo se
 * calcula?». Al confirmar, entra al inventario lo que llegó (no lo pedido) y a Finanzas lo
 * que se compró de verdad.
 */

import { useEffect, useMemo, useState } from "react"
import { PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { CalcHelp } from "@/components/calc-help"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/utils"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { lineKey, receiptLines, receiptSummary } from "@/lib/purchase-receipt"
import { cn } from "@/lib/utils"
import type { PurchaseOrder, PurchaseReceipt } from "@/types/purchase-order"

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000)

export function PurchaseReceiveDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
}: {
  order: PurchaseOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (receipt: PurchaseReceipt) => void | Promise<void>
}) {
  const { t, language } = useLanguage()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [cost, setCost] = useState<Record<string, number>>({})
  const [invoice, setInvoice] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!order || !open) return
    const q: Record<string, number> = {}
    const c: Record<string, number> = {}
    order.items.forEach((item, i) => {
      const k = lineKey(item, i)
      q[k] = item.totalQuantity || 0
      c[k] = item.costPerUnit || 0
    })
    setQty(q)
    setCost(c)
    setInvoice("")
  }, [order, open])

  const draft: PurchaseOrder | null = useMemo(() => {
    if (!order) return null
    return {
      ...order,
      receipt: {
        at: new Date().toISOString(),
        lines: order.items.map((item, i) => {
          const k = lineKey(item, i)
          return { key: k, quantity: qty[k] ?? 0, unitCost: cost[k] ?? 0 }
        }),
      },
    }
  }, [order, qty, cost])

  if (!order || !draft) return null
  const lines = receiptLines(draft)
  const sum = receiptSummary(draft)
  const unit = (u: string) => getUnitLabel(u, language)
  const diffTone = (n: number) => (n > 0.004 ? "text-destructive" : n < -0.004 ? "text-success" : "text-muted-foreground")

  const confirm = async () => {
    if (!draft.receipt) return
    setSaving(true)
    try {
      await onConfirm({ ...draft.receipt, at: new Date().toISOString(), ...(invoice.trim() ? { invoiceNumber: invoice.trim() } : {}) })
    } finally {
      setSaving(false)
    }
  }

  const taxPct = Math.round(sum.taxRate * 10000) / 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="receive-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            {t("receive_title").replace("{name}", order.name)}
          </DialogTitle>
          <DialogDescription>{t("receive_desc")}</DialogDescription>
        </DialogHeader>

        {/* Resumen arriba: lo pedido, lo que te cobran y la diferencia */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("receive_ordered_total")}</p>
                <p className="text-base font-semibold tabular-nums">{formatCurrency(order.total || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("receive_received_total")}</p>
                <p className="text-base font-semibold tabular-nums">{formatCurrency(sum.receivedTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("receive_difference")}</p>
                <p className={cn("text-base font-semibold tabular-nums", diffTone(sum.differenceTotal))}>
                  {sum.differenceTotal > 0 ? "+" : ""}
                  {formatCurrency(sum.differenceTotal)}
                </p>
              </div>
            </div>
            <CalcHelp
              title={t("receive_calc_title")}
              intro={t("receive_calc_intro")}
              steps={[
                ...lines
                  .filter((l) => l.quantityDiff !== 0 || l.priceDiff !== 0)
                  .slice(0, 3)
                  .map((l) => ({
                    label: l.name,
                    formula: `${fmtQty(l.receivedQuantity)} × ${formatCurrency(l.invoicedUnitCost)} − ${fmtQty(l.orderedQuantity)} × ${formatCurrency(l.orderedUnitCost)} = ${formatCurrency(l.valueDiff)}`,
                    note: t("receive_calc_line_note")
                      .replace("{qty}", formatCurrency(l.quantityEffect))
                      .replace("{price}", formatCurrency(l.priceEffect)),
                  })),
                { label: t("receive_calc_subtotal"), formula: `${lines.map((l) => formatCurrency(l.receivedValue)).join(" + ")} = ${formatCurrency(sum.receivedSubtotal)}` },
                {
                  label: t("receive_calc_total"),
                  formula: `${formatCurrency(sum.receivedSubtotal)} × (1 + ${taxPct} %) = ${formatCurrency(sum.receivedTotal)}`,
                  note: t("receive_calc_tax_note"),
                },
                { label: t("receive_difference"), formula: `${formatCurrency(sum.receivedTotal)} − ${formatCurrency(order.total || 0)} = ${formatCurrency(sum.differenceTotal)}` },
              ]}
            />
          </div>
          {sum.linesWithDifference > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("receive_lines_with_diff").replace("{count}", String(sum.linesWithDifference))}
            </p>
          )}
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {lines.map((l) => (
            <div key={l.key} className="rounded-lg border border-border p-3" data-testid="receive-line">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("receive_you_ordered")
                    .replace("{qty}", `${fmtQty(l.orderedQuantity)} ${unit(l.unit)}`)
                    .replace("{price}", formatCurrency(l.orderedUnitCost))}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("receive_arrived").replace("{unit}", unit(l.unit))}</Label>
                  <NumericInput
                    value={qty[l.key] ?? 0}
                    onChange={(v) => setQty((p) => ({ ...p, [l.key]: Math.max(0, Number(v) || 0) }))}
                    decimalPlaces={3}
                    allowZero
                    min={0}
                    aria-label={t("receive_arrived").replace("{unit}", unit(l.unit))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("receive_invoice_price")}</Label>
                  <NumericInput
                    value={cost[l.key] ?? 0}
                    onChange={(v) => setCost((p) => ({ ...p, [l.key]: Math.max(0, Number(v) || 0) }))}
                    decimalPlaces={4}
                    min={0}
                    aria-label={t("receive_invoice_price")}
                  />
                </div>
              </div>
              {(l.quantityDiff !== 0 || l.priceDiff !== 0) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {l.quantityDiff !== 0 && (
                    <span className={l.quantityDiff < 0 ? "text-warning" : "text-muted-foreground"}>
                      {(l.quantityDiff < 0 ? t("receive_missing") : t("receive_extra")).replace("{qty}", `${fmtQty(Math.abs(l.quantityDiff))} ${unit(l.unit)}`)}
                    </span>
                  )}
                  {l.priceDiff !== 0 && (
                    <span className={l.priceDiff > 0 ? "text-destructive" : "text-success"}>
                      {(l.priceDiff > 0 ? t("receive_price_up") : t("receive_price_down")).replace("{amount}", formatCurrency(Math.abs(l.priceDiff)))}
                    </span>
                  )}
                  <span className={cn("font-medium", diffTone(l.valueDiff))}>
                    {l.valueDiff > 0 ? "+" : ""}
                    {formatCurrency(l.valueDiff)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <Label htmlFor="receive-invoice" className="text-xs">
            {t("receive_invoice_number")}
          </Label>
          <Input id="receive-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder={t("receive_invoice_placeholder")} />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={confirm} disabled={saving} data-testid="receive-confirm">
            {t("receive_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
