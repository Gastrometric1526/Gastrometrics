"use client"

/**
 * «Registrar pérdida» (docs/283): lo que se pierde fuera de las ventas —derrames, botellas
 * rotas, cortesías servidas sin pasar por el POS, vencidos— se anota aquí, con su motivo.
 * Resta del stock, el stock teórico lo descuenta y el próximo conteo deja de contarlo como
 * faltante. Con productos en envase (botellas, latas, sacos) ofrece ¼, ½ y 1 envase.
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/language-context"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { formatCurrency } from "@/lib/currency"
import { stockValue } from "@/lib/inventory-value"
import { STOCK_LOSS_REASONS } from "@/lib/stock-losses"
import type { InventoryItem, StockLossReason } from "@/types/inventory"
import { cn } from "@/lib/utils"

export function StockLossDialog({
  item,
  packageContent,
  open,
  onOpenChange,
  onSave,
}: {
  item: InventoryItem | null
  packageContent?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { quantity: number; reason: StockLossReason; note: string }) => Promise<boolean>
}) {
  const { t, language } = useLanguage()
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<StockLossReason>("spill")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQuantity("")
      setReason("spill")
      setNote("")
    }
  }, [open, item?.id])

  if (!item) return null
  const unit = getUnitLabel(item.unit, language)
  const qty = Number(quantity.replace(",", "."))
  const available = Math.max(item.currentStock ?? 0, 0)
  const valid = Number.isFinite(qty) && qty > 0
  const tooMuch = valid && qty > available
  const value = valid ? stockValue(Math.min(qty, available), item.price, packageContent) : 0
  const content = packageContent && packageContent > 0 ? packageContent : null
  const fill = (fraction: number) => content && setQuantity(String(Number((content * fraction).toFixed(2))))

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const ok = await onSave({ quantity: qty, reason, note })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("stock_loss_title").replace("{name}", item.name)}</DialogTitle>
          <DialogDescription>{t("stock_loss_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t("stock_loss_reason_label")}</Label>
            <div className="flex flex-wrap gap-2">
              {STOCK_LOSS_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    reason === r ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
                  )}
                >
                  {t(`stock_loss_reason_${r}` as never)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-loss-qty">{t("stock_loss_qty_label").replace("{unit}", unit)}</Label>
            <Input
              id="stock-loss-qty"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
            />
            {content && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("stock_loss_package_hint").replace("{content}", `${content} ${unit}`)}</span>
                {[0.25, 0.5, 1].map((f) => (
                  <Button key={f} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => fill(f)}>
                    {f === 0.25 ? "¼" : f === 0.5 ? "½" : "1"} {t("stock_loss_package")}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("stock_loss_available").replace("{qty}", `${Number(available.toFixed(2))} ${unit}`)}</p>
            {tooMuch && <p className="text-xs text-warning">{t("stock_loss_too_much")}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock-loss-note">{t("stock_loss_note_label")}</Label>
            <Textarea id="stock-loss-note" rows={2} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("stock_loss_note_placeholder")} />
          </div>

          {valid && value > 0 && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm text-foreground">{t("stock_loss_value").replace("{value}", formatCurrency(value))}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={save} disabled={!valid || saving || available <= 0}>
            {saving ? t("stock_loss_saving") : t("stock_loss_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
