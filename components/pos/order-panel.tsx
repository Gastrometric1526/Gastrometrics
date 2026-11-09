"use client"

/**
 * Pedido de una mesa (docs/268), en un panel lateral como el resto de la app: arriba las
 * sillas (toca una para pedir para ella), en medio lo pedido por silla con su estado, y
 * abajo las acciones apiladas (la principal primero), igual que DetailPanel (docs/219).
 */

import { BellRing, ChefHat, CheckCheck, Minus, Plus, Receipt, Trash2, Wallet } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { itemTotal, orderTotal, pendingCount } from "@/lib/pos"
import type { PosItemStatus, PosOrder } from "@/types/pos"

const STATUS_STYLE: Record<PosItemStatus, string> = {
  new: "bg-muted text-muted-foreground",
  sent: "bg-info-soft text-info",
  ready: "bg-success-soft text-success",
  served: "bg-muted text-muted-foreground",
}

export function OrderPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  seats,
  order,
  seat,
  onSeat,
  onAddDish,
  onQuantity,
  onServed,
  onPatch,
  onSend,
  onBill,
  onCheckout,
  onRelease,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string | null
  seats: number
  order: PosOrder | null
  seat: number
  onSeat: (seat: number) => void
  onAddDish: () => void
  onQuantity: (itemId: string, quantity: number) => void
  onServed: (itemId: string) => void
  onPatch: (patch: Partial<Pick<PosOrder, "guests" | "waiter">>) => void
  onSend: () => void
  onBill: () => void
  onCheckout: () => void
  onRelease: () => void
}) {
  const { t } = useLanguage()
  const items = order?.items ?? []
  const pending = order ? pendingCount(order) : 0
  const groups = [0, ...Array.from({ length: seats }, (_, i) => i + 1)]
    .map((s) => ({ seat: s, items: items.filter((i) => (i.seat ?? 0) === s) }))
    .filter((g) => g.items.length > 0)
  const seatName = (s: number) => (s === 0 ? t("pos_seat_table") : t("pos_seat_n").replace("{n}", String(s)))
  // Una sola acción principal según el momento (docs/273): pedir, mandar a cocina o cobrar.
  const primary: "add" | "send" | "checkout" = items.length === 0 ? "add" : pending > 0 ? "send" : order?.status === "bill" ? "checkout" : "add"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="space-y-1 border-b px-5 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            {title}
            {order?.status === "bill" && <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">{t("pos_status_bill")}</Badge>}
          </SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("ventas_guests_label")}</span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={order?.guests ?? ""}
                onChange={(e) => onPatch({ guests: e.target.value ? Math.max(0, Number(e.target.value)) : null })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("ventas_waiter_label")}</span>
              <Input value={order?.waiter ?? ""} onChange={(e) => onPatch({ waiter: e.target.value || null })} placeholder={t("ventas_optional")} />
            </label>
          </div>
        </SheetHeader>

        <div className="border-b px-5 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("pos_order_for")}</p>
          <div className="flex flex-wrap gap-1.5" data-tour="salon-seats">
            {[0, ...Array.from({ length: seats }, (_, i) => i + 1)].map((s) => (
              <Button key={s} size="sm" variant={seat === s ? "default" : "outline"} onClick={() => onSeat(s)} className="h-8">
                {seatName(s)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {groups.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">{t("pos_order_empty")}</p>
              <Button onClick={onAddDish} size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("pos_add_dish").replace("{seat}", seatName(seat))}
              </Button>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.seat} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{seatName(g.seat)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatCurrency(orderTotal({ items: g.items }))}</p>
                </div>
                {g.items.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border p-2.5 space-y-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {i.quantity} × {i.name}
                        </p>
                        {i.extras.map((e) => (
                          <p key={e.extraId} className="text-xs text-muted-foreground">
                            + {e.quantity > 1 ? `${e.quantity} × ` : ""}
                            {e.name}
                          </p>
                        ))}
                        {i.note && <p className="text-xs italic text-muted-foreground">«{i.note}»</p>}
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm tabular-nums">{formatCurrency(itemTotal(i))}</p>
                        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium", STATUS_STYLE[i.status])}>{t(`pos_item_${i.status}` as "pos_item_new")}</span>
                      </div>
                    </div>
                    {i.status === "new" && (
                      <div className="flex items-center gap-1.5">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQuantity(i.id, i.quantity - 1)} aria-label={t("ventas_less")}>
                          {i.quantity > 1 ? <Minus className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQuantity(i.id, i.quantity + 1)} aria-label={t("ventas_more")}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    {i.status === "ready" && (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => onServed(i.id)}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        {t("pos_mark_served")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <Separator />
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("ventas_ticket_total")}</span>
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(order ? orderTotal(order) : 0)}</span>
        </div>
        <SheetFooter className="flex-col gap-2 border-t px-5 py-4 sm:flex-col sm:space-x-0" data-tour="salon-actions">
          {primary === "send" && (
            <Button onClick={onSend} size="lg" className="w-full gap-2">
              <ChefHat className="h-4 w-4" />
              {t("pos_send_kitchen_n").replace("{n}", String(pending))}
            </Button>
          )}
          {primary === "checkout" && (
            <Button onClick={onCheckout} size="lg" className="w-full gap-2">
              <Wallet className="h-4 w-4" />
              {t("pos_checkout")} · {formatCurrency(order ? orderTotal(order) : 0)}
            </Button>
          )}
          {items.length > 0 && (
            <Button variant={primary === "add" ? "default" : "outline"} size={primary === "add" ? "lg" : "default"} onClick={onAddDish} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {t("pos_add_dish").replace("{seat}", seatName(seat))}
            </Button>
          )}
          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onBill} disabled={order?.status === "bill"} className="gap-2">
                <BellRing className="h-4 w-4" />
                {t("pos_ask_bill")}
              </Button>
              {primary !== "checkout" && (
                <Button variant="outline" onClick={onCheckout} className="gap-2">
                  <Wallet className="h-4 w-4" />
                  {t("pos_checkout")}
                </Button>
              )}
              {primary === "checkout" && (
                <Button variant="outline" onClick={onSend} disabled={pending === 0} className="gap-2">
                  <ChefHat className="h-4 w-4" />
                  {t("pos_send_kitchen")}
                </Button>
              )}
            </div>
          )}
          {order && items.length === 0 && (
            <Button variant="ghost" onClick={onRelease} className="w-full gap-2 text-muted-foreground">
              <Receipt className="h-4 w-4" />
              {t("pos_release_table")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
