"use client"

/**
 * Mesas en tarjetas grandes (pedido del dueño, docs/302): para el mesero con el celular en la
 * mano, el plano a escala queda chico. Cada mesa es un botón grande con su número, el estado
 * (mismos colores que el plano y el resumen), el total, cuánto lleva abierta y si tiene
 * platos listos para llevar o anotados sin mandar a cocina.
 */

import { BellRing, ChefHat, Clock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { tableTile } from "@/lib/pos-waiter"
import type { TableStatus } from "@/lib/pos"
import type { FloorTable, PosOrder } from "@/types/pos"

const TILE: Record<TableStatus, string> = {
  free: "border-border bg-card",
  busy: "border-primary/50 bg-primary/5",
  ready: "border-success bg-success-soft",
  bill: "border-warning bg-warning-soft",
}

export function TableGrid({
  tables,
  orders,
  selectedId,
  onSelect,
  now,
}: {
  tables: FloorTable[]
  orders: Map<string, PosOrder>
  selectedId: string | null
  onSelect: (tableId: string) => void
  now: Date
}) {
  const { t } = useLanguage()
  const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="list">
      {sorted.map((table) => {
        const order = orders.get(table.id)
        const info = tableTile(order, now)
        return (
          <button
            key={table.id}
            type="button"
            role="listitem"
            onClick={() => onSelect(table.id)}
            aria-label={t("pos_table_aria").replace("{label}", table.label)}
            data-table-status={info.status}
            className={cn(
              "flex min-h-[112px] flex-col justify-between rounded-xl border-2 p-3 text-left transition active:scale-[0.98]",
              TILE[info.status],
              selectedId === table.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{table.label}</span>
              <span className="text-xs font-medium text-muted-foreground">{t(`pos_status_${info.status}` as "pos_status_free")}</span>
            </div>
            {order ? (
              <div className="space-y-1">
                <p className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(info.total)}</p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t("pos_tile_minutes").replace("{n}", String(info.minutes))}
                  </span>
                  {info.ready > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-success">
                      <BellRing className="h-3.5 w-3.5" />
                      {t("pos_tile_ready").replace("{n}", String(info.ready))}
                    </span>
                  )}
                  {info.pending > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      <ChefHat className="h-3.5 w-3.5" />
                      {t("pos_tile_pending").replace("{n}", String(info.pending))}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t("pos_seats_short").replace("{n}", String(table.seats))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
