/**
 * POS propio de GastroMetrics (pedido del dueño, docs/268): mapa del salón con mesas y
 * sillas, pedidos por silla con la foto de cada plato, extras con precio, pantalla de
 * cocina y cobro. Al cobrar, la cuenta se suma al registro manual de ventas del día
 * (types/sales-import.ts), así Finanzas, el cuadre de caja, Menu Engineering y el
 * inventario teórico la leen sin cambios. No emite facturas fiscales.
 *
 * Todo vive en la tabla `pos_data` (migración 0039), un blob `data` por fila:
 * - `<negocio>::floor`  → FloorPlan
 * - `<negocio>::config` → PosConfig
 * - `<id del pedido>`   → PosOrder (solo mientras la cuenta está abierta)
 */

import type { PaymentMethod, SalesChannel } from "@/types/sales-import"

export type TableShape = "square" | "round" | "rect"

export interface FloorArea {
  id: string
  name: string
}

/** Mesa en el plano. Coordenadas en unidades del lienzo (FLOOR_W × FLOOR_H, lib/pos.ts). */
export interface FloorTable {
  id: string
  areaId: string
  /** «5», «T2», «Barra 1». */
  label: string
  shape: TableShape
  seats: number
  x: number
  y: number
  w: number
  h: number
}

export interface FloorPlan {
  areas: FloorArea[]
  tables: FloorTable[]
  updatedAt: string
}

/**
 * Extra que se puede agregar a un plato: «Extra queso +L 20». Si se une a una receta, su
 * costo por porción se suma al costo del plato y sus ingredientes al inventario teórico
 * (mismo cálculo que los modificadores importados, lib/pos-modifiers.ts). En el POS propio,
 * a diferencia de lo importado, el precio del extra SÍ suma a la venta (decisión del dueño).
 */
export interface PosExtra {
  id: string
  name: string
  price: number
  recipeId: string | null
  /** Clasificaciones de receta donde se ofrece; vacío = en todos los platos. */
  classifications: string[]
}

export interface PosConfig {
  extras: PosExtra[]
  /** Recetas o menús que no se muestran en el POS (`recipe:<id>` o `menu:<id>`). */
  hidden: string[]
  updatedAt: string
}

export interface PosOrderExtra {
  extraId: string
  name: string
  price: number
  recipeId: string | null
  quantity: number
}

/** new = anotado, sent = en cocina, ready = listo para servir, served = en la mesa. */
export type PosItemStatus = "new" | "sent" | "ready" | "served"

export interface PosOrderItem {
  id: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  /** Número de silla (1…N); null = para la mesa (compartido). */
  seat: number | null
  quantity: number
  /** Precio del plato sin extras. */
  unitPrice: number
  /** Costo del plato sin extras. */
  unitCost: number
  extras: PosOrderExtra[]
  note: string | null
  status: PosItemStatus
  sentAt: string | null
  readyAt: string | null
}

export interface PosOrder {
  id: string
  /** Mesa del plano; null en para llevar o domicilio. */
  tableId: string | null
  /** Nombre visible: «Mesa 5», «Para llevar 3». */
  tableLabel: string
  areaName: string | null
  channel: SalesChannel
  guests: number | null
  waiter: string | null
  openedAt: string
  /** open = atendiendo; bill = pidió la cuenta. */
  status: "open" | "bill"
  items: PosOrderItem[]
  updatedAt: string
  /**
   * Versión del pedido guardado (docs/275). Cada guardado la sube en 1 y solo se acepta si
   * nadie más guardó en el medio; si otro aparato ya cambió la mesa, se juntan los cambios
   * (`mergeOrderEdit`, lib/pos.ts). Ausente en pedidos de antes de docs/275.
   */
  rev?: number
  /** Platos ya mandados a cocina que se anularon, con su motivo (docs/275). */
  voids?: PosVoid[]
}

/**
 * Por qué se anuló un plato ya mandado a cocina (docs/275):
 * - not_made: no se llegó a preparar (no gasta ingredientes);
 * - waste: se preparó y se perdió (se quemó, se cayó, salió mal): gasta ingredientes y cuesta;
 * - courtesy: se sirvió sin cobrar: gasta ingredientes y cuesta.
 */
export type PosVoidReason = "not_made" | "waste" | "courtesy"

export interface PosVoid {
  id: string
  itemId: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  seat: number | null
  quantity: number
  /** Precio que tenía (con extras): lo que se dejó de cobrar. */
  unitPrice: number
  /** Costo por unidad con extras. */
  unitCost: number
  extras: PosOrderExtra[]
  reason: PosVoidReason
  at: string
}

/** Lo que se cobra: toda la cuenta o las sillas elegidas. */
export interface PosPayment {
  /** null = toda la cuenta; lista = solo esas sillas (0 = lo de la mesa). */
  seats: number[] | null
  payment: PaymentMethod
  discount: number
  tip: number
}
