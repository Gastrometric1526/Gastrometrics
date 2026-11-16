"use client"

/**
 * Devolver al proveedor (docs/322): eliges cuánto devuelves de cada producto recibido y por qué.
 * Se ve cuánto te tiene que descontar o devolver el proveedor, con su «¿Cómo se calcula?».
 * Al confirmar, sale del inventario y se resta de las compras del mes en Finanzas.
 */

import { useEffect, useMemo, useState } from "react"
import { Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalcHelp } from "@/components/calc-help"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/utils"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { RETURN_REASONS, buildReturn, orderTaxRate, receiptLines, returnValue, returnableQuantities } from "@/lib/purchase-receipt"
import type { PurchaseOrder, PurchaseReturn, PurchaseReturnReason } from "@/types/purchase-order"

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000)

export function PurchaseReturnDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
}: {
  order: PurchaseOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (ret: PurchaseReturn) => void | Promise<void>
}) {
  const { t, language } = useLanguage()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<PurchaseReturnReason>("damaged")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQty({})
      setReason("damaged")
      setNote("")
    }
  }, [open])

  const lines = useMemo(() => (order ? receiptLines(order) : []), [order])
  const left = useMemo(() => (order ? returnableQuantities(order) : new Map<string, number>()), [order])
  const draft = useMemo(() => (order ? buildReturn(order, { quantities: qty, reason, note }) : null), [order, qty, reason, note])

  if (!order) return null
  const value = draft ? returnValue(order, draft) : { subtotal: 0, tax: 0, total: 0 }
  const taxPct = Math.round(orderTaxRate(order) * 10000) / 100
  const unit = (u: string) => getUnitLabel(u, language)
  const byKey = new Map(lines.map((l) => [l.key, l]))

  const confirm = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await onConfirm(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="return-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-primary" />
            {t("return_title").replace("{name}", order.name)}
          </DialogTitle>
          <DialogDescription>{t("return_desc")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {lines.map((l) => {
            const max = left.get(l.key) || 0
            return (
              <div key={l.key} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("return_can_return").replace("{qty}", `${fmtQty(max)} ${unit(l.unit)}`).replace("{price}", formatCurrency(l.invoicedUnitCost))}
                  </p>
                </div>
                <div className="mt-2 max-w-[12rem]">
                  <Label className="text-xs">{t("return_quantity").replace("{unit}", unit(l.unit))}</Label>
                  <NumericInput
                    value={qty[l.key] ?? ""}
                    onChange={(v) => setQty((p) => ({ ...p, [l.key]: Math.min(max, Math.max(0, Number(v) || 0)) }))}
                    decimalPlaces={3}
                    min={0}
                    max={max}
                    disabled={max <= 0}
                    aria-label={`${l.name}: ${t("return_quantity").replace("{unit}", unit(l.unit))}`}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">{t("return_reason")}</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as PurchaseReturnReason)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`return_reason_${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="return-note" className="text-xs">
              {t("return_note")}
            </Label>
            <Input id="return-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("return_credit")}</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(value.total)}</p>
          </div>
          <CalcHelp
            title={t("return_calc_title")}
            intro={t("return_calc_intro")}
            steps={[
              ...(draft?.lines ?? []).map((l) => ({
                label: byKey.get(l.key)?.name || l.key,
                formula: `${fmtQty(l.quantity)} × ${formatCurrency(l.unitCost)} = ${formatCurrency(Math.round(l.quantity * l.unitCost * 100) / 100)}`,
              })),
              { label: t("return_calc_tax"), formula: `${formatCurrency(value.subtotal)} × ${taxPct} % = ${formatCurrency(value.tax)}` },
              { label: t("return_credit"), formula: `${formatCurrency(value.subtotal)} + ${formatCurrency(value.tax)} = ${formatCurrency(value.total)}`, note: t("return_calc_finance_note") },
            ]}
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={confirm} disabled={!draft || saving} data-testid="return-confirm">
            {t("return_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
