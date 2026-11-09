"use client"

/**
 * Plano del salón (docs/268). Se dibuja en un SVG con el lienzo de lib/pos.ts (FLOOR_W ×
 * FLOOR_H) y se ajusta al ancho de la pantalla. En servicio, tocar una mesa abre su pedido;
 * en edición, las mesas se arrastran y se ajustan a la cuadrícula al soltarlas.
 */

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { FLOOR_GRID, FLOOR_H, FLOOR_W, orderTotal, seatPositions, seatsInOrder, snapTable, tableStatus, type TableStatus } from "@/lib/pos"
import type { FloorTable, PosOrder } from "@/types/pos"

const FILL: Record<TableStatus, string> = {
  free: "fill-card stroke-muted-foreground/40",
  busy: "fill-primary/15 stroke-primary",
  ready: "fill-success/20 stroke-success",
  bill: "fill-warning/20 stroke-warning",
}

export function FloorMap({
  tables,
  orders,
  mode,
  selectedId,
  onSelect,
  onMove,
  showLegend = true,
}: {
  tables: FloorTable[]
  /** Pedido abierto de cada mesa. */
  orders: Map<string, PosOrder>
  mode: "service" | "edit"
  selectedId?: string | null
  onSelect: (tableId: string) => void
  onMove?: (table: FloorTable) => void
  /** En servicio, la página ya muestra el resumen con los mismos colores (docs/273). */
  showLegend?: boolean
}) {
  const { t } = useLanguage()
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; table: FloorTable; moved: boolean } | null>(null)

  const toCanvas = (e: React.PointerEvent) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const start = (e: React.PointerEvent, table: FloorTable) => {
    if (mode !== "edit") return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toCanvas(e)
    setDrag({ id: table.id, dx: p.x - table.x, dy: p.y - table.y, table, moved: false })
    onSelect(table.id)
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toCanvas(e)
    setDrag({ ...drag, moved: true, table: { ...drag.table, x: p.x - drag.dx, y: p.y - drag.dy } })
  }
  const end = () => {
    if (!drag) return
    if (drag.moved) onMove?.(snapTable(drag.table))
    setDrag(null)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${FLOOR_W} ${FLOOR_H}`}
          className={cn("w-full h-auto select-none touch-none", mode === "edit" && "cursor-grab")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          role="img"
          aria-label={t("pos_map_aria")}
        >
          {mode === "edit" && (
            <>
              <defs>
                <pattern id="pos-grid" width={FLOOR_GRID} height={FLOOR_GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${FLOOR_GRID} 0 L 0 0 0 ${FLOOR_GRID}`} className="fill-none stroke-border" strokeWidth={0.6} />
                </pattern>
              </defs>
              <rect width={FLOOR_W} height={FLOOR_H} fill="url(#pos-grid)" />
            </>
          )}
          {tables.map((base) => {
            const table = drag?.id === base.id ? drag.table : base
            const order = orders.get(base.id)
            const status = tableStatus(order)
            const used = new Set(order ? seatsInOrder(order) : [])
            const selected = selectedId === base.id
            const cx = table.x + table.w / 2
            const cy = table.y + table.h / 2
            return (
              <g
                key={base.id}
                onPointerDown={(e) => start(e, base)}
                onClick={() => mode === "service" && onSelect(base.id)}
                className={cn("cursor-pointer", mode === "service" && "hover:opacity-90")}
                role="button"
                aria-label={t("pos_table_aria").replace("{label}", base.label)}
                data-tour={base === tables[0] ? "salon-table" : undefined}
              >
                {seatPositions(table).map((s) => (
                  <circle key={s.seat} cx={s.x} cy={s.y} r={11} className={cn(used.has(s.seat) ? "fill-primary stroke-primary" : "fill-card stroke-muted-foreground/40")} strokeWidth={2} />
                ))}
                {table.shape === "round" ? (
                  <ellipse cx={cx} cy={cy} rx={table.w / 2} ry={table.h / 2} className={FILL[status]} strokeWidth={selected ? 5 : 2.5} />
                ) : (
                  <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={14} className={FILL[status]} strokeWidth={selected ? 5 : 2.5} />
                )}
                <text x={cx} y={cy - (order ? 6 : -2)} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-semibold" fontSize={30}>
                  {table.label}
                </text>
                <text x={cx} y={cy + 24} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize={15}>
                  {order && order.items.length ? formatCurrency(orderTotal(order)) : t("pos_seats_short").replace("{n}", String(table.seats))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {mode === "service" && showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["free", "busy", "ready", "bill"] as TableStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded-sm border", s === "free" && "bg-card border-border", s === "busy" && "bg-primary/15 border-primary", s === "ready" && "bg-success/20 border-success", s === "bill" && "bg-warning/20 border-warning")} />
              {t(`pos_status_${s}` as "pos_status_free")}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
