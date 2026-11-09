"use client"

/**
 * Pantalla de cocina (docs/268): una tarjeta por mesa con lo que hay que preparar, la más
 * antigua primero. «Listo» avisa al salón (la mesa se pone verde); se puede deshacer.
 */

import { Check, ChefHat, Clock, Undo2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { kitchenQueue, minutesSince } from "@/lib/pos"
import type { PosOrder } from "@/types/pos"

export function KitchenBoard({ orders, onStatus }: { orders: PosOrder[]; onStatus: (orderId: string, itemId: string, status: "sent" | "ready") => void }) {
  const { t } = useLanguage()
  const queue = kitchenQueue(orders)
  const seatName = (s: number | null) => (!s ? t("pos_seat_table") : t("pos_seat_n").replace("{n}", String(s)))

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <ChefHat className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">{t("pos_kitchen_empty_title")}</p>
          <p className="text-sm text-muted-foreground">{t("pos_kitchen_empty_desc")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tour="salon-kitchen">
      {queue.map(({ order, items, since }) => {
        const mins = minutesSince(since)
        const late = mins >= 15
        return (
          <Card key={order.id} className={cn(late && "border-warning")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{order.tableLabel}</span>
                <span className={cn("inline-flex items-center gap-1 text-sm font-normal", late ? "text-warning" : "text-muted-foreground")}>
                  <Clock className="h-3.5 w-3.5" />
                  {t("pos_kitchen_minutes").replace("{n}", String(mins))}
                </span>
              </CardTitle>
              {order.waiter && <p className="text-xs text-muted-foreground">{order.waiter}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((i) => {
                const ready = i.status === "ready"
                return (
                  <div key={i.id} className={cn("flex items-start gap-2 rounded-lg border p-2.5", ready ? "border-success bg-success-soft/50" : "border-border")}>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", ready && "line-through text-muted-foreground")}>
                        {i.quantity} × {i.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{seatName(i.seat)}</p>
                      {i.extras.map((e) => (
                        <p key={e.extraId} className="text-xs font-medium text-foreground">
                          + {e.quantity > 1 ? `${e.quantity} × ` : ""}
                          {e.name}
                        </p>
                      ))}
                      {i.note && <p className="text-xs font-medium text-warning">«{i.note}»</p>}
                    </div>
                    {ready ? (
                      <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => onStatus(order.id, i.id, "sent")}>
                        <Undo2 className="h-3.5 w-3.5" />
                        {t("pos_kitchen_undo")}
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 gap-1" onClick={() => onStatus(order.id, i.id, "ready")}>
                        <Check className="h-3.5 w-3.5" />
                        {t("pos_kitchen_ready")}
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
