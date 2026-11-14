"use client"

/**
 * Cobro de una mesa (docs/268): toda la cuenta o solo algunas sillas (cuenta dividida),
 * forma de pago, descuento y propina. Lo cobrado se suma al registro manual de ventas del
 * día; lo que no se cobró queda en la mesa.
 *
 * Para el mesero (docs/302): propina con un toque (10 %, 15 %) y, en efectivo, cuánto
 * entregó el cliente (billetes rápidos) y el vuelto.
 */

const TIP_PERCENTS = [10, 15]

import { useEffect, useState } from "react"
import { Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { NumericInput } from "@/components/ui/numeric-input"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { PAYMENT_METHODS } from "@/lib/manual-sales"
import { orderTotal, seatsInOrder } from "@/lib/pos"
import { cashChange, quickCashAmounts, tipFromPercent } from "@/lib/pos-waiter"
import { cn } from "@/lib/utils"
import type { PosOrder, PosPayment } from "@/types/pos"
import type { PaymentMethod } from "@/types/sales-import"

export function CheckoutDialog({
  open,
  onOpenChange,
  order,
  saving,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: PosOrder | null
  saving: boolean
  onConfirm: (pay: PosPayment & { received: number | null }) => void
}) {
  const { t } = useLanguage()
  const [split, setSplit] = useState<number[] | null>(null)
  const [payment, setPayment] = useState<PaymentMethod>("cash")
  const [discount, setDiscount] = useState(0)
  const [tip, setTip] = useState(0)
  const [received, setReceived] = useState(0)

  useEffect(() => {
    if (open) {
      setSplit(null)
      setPayment("cash")
      setDiscount(0)
      setTip(0)
      setReceived(0)
    }
  }, [open])

  if (!order) return null
  const seats = seatsInOrder(order)
  const subtotal = orderTotal(order, split)
  const disc = Math.min(Math.max(discount, 0), subtotal)
  const total = Math.round((subtotal - disc + Math.max(tip, 0)) * 100) / 100
  const change = payment === "cash" ? cashChange(total, received) : null
  const short = payment === "cash" && received > 0 && change === null
  const seatName = (s: number) => (s === 0 ? t("pos_seat_table") : t("pos_seat_n").replace("{n}", String(s)))
  const toggleSeat = (s: number) => {
    const cur = split ?? []
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s].sort((a, b) => a - b)
    setSplit(next.length ? next : null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("pos_checkout_title").replace("{table}", order.tableLabel)}</DialogTitle>
          <DialogDescription>{t("pos_checkout_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {seats.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("pos_checkout_what")}</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant={split === null ? "default" : "outline"} className="h-10" onClick={() => setSplit(null)}>
                  {t("pos_checkout_all")}
                </Button>
                {seats.map((s) => (
                  <Button key={s} size="sm" variant={split?.includes(s) ? "default" : "outline"} className="h-10" onClick={() => toggleSeat(s)}>
                    {seatName(s)} · {formatCurrency(orderTotal(order, [s]))}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("ventas_payment_label")}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <Button key={m} variant={payment === m ? "default" : "outline"} className="h-11" onClick={() => setPayment(m)}>
                  {t(`ventas_payment_${m}` as "ventas_payment_cash")}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("ventas_discount_label")}</span>
              <NumericInput value={discount || ""} onChange={(v) => setDiscount(v)} placeholder="0" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("ventas_tip_label")}</span>
              <NumericInput value={tip || ""} onChange={(v) => setTip(v)} placeholder="0" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIP_PERCENTS.map((p) => {
              const value = tipFromPercent(subtotal - disc, p)
              return (
                <Button key={p} size="sm" variant={tip > 0 && tip === value ? "default" : "outline"} className="h-9" onClick={() => setTip(tip === value ? 0 : value)}>
                  {t("pos_tip_percent").replace("{p}", String(p))}
                </Button>
              )
            })}
          </div>

          {payment === "cash" && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t("pos_cash_received")}</p>
              <div className="flex flex-wrap gap-1.5">
                {quickCashAmounts(total).map((amount, i) => (
                  <Button key={amount} size="sm" variant={received === amount ? "default" : "outline"} className="h-10 tabular-nums" onClick={() => setReceived(amount)}>
                    {i === 0 ? t("pos_cash_exact") : formatCurrency(amount)}
                  </Button>
                ))}
              </div>
              <NumericInput value={received || ""} onChange={(v) => setReceived(v)} placeholder={t("pos_cash_other")} aria-label={t("pos_cash_received")} />
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ventas_subtotal")}</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {disc > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventas_discount_label")}</span>
                <span className="tabular-nums">− {formatCurrency(disc)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("ventas_tip_label")}</span>
                <span className="tabular-nums">{formatCurrency(tip)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1">
              <span>{t("pos_checkout_charge")}</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
            {change !== null && (
              <div className="flex justify-between pt-1 text-base font-semibold text-success" role="status">
                <span>{t("pos_change_label")}</span>
                <span className="tabular-nums">{formatCurrency(change)}</span>
              </div>
            )}
            {short && <p className={cn("pt-1 text-sm text-warning")}>{t("pos_cash_short").replace("{n}", formatCurrency(total - received))}</p>}
          </div>
          <p className="text-xs text-muted-foreground">{t("pos_checkout_note")}</p>
        </div>

        <DialogFooter>
          <Button
            size="lg"
            disabled={saving || subtotal <= 0 || short}
            onClick={() => onConfirm({ seats: split, payment, discount: disc, tip: Math.max(tip, 0), received: payment === "cash" && received > 0 ? received : null })}
            className="w-full gap-2"
          >
            <Wallet className="h-4 w-4" />
            {t("pos_checkout_confirm").replace("{total}", formatCurrency(total))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
