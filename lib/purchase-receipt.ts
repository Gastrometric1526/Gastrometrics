/**
 * Recepción con revisión y devoluciones al proveedor (docs/322).
 *
 * Al recibir una orden se anota, por línea, cuánto llegó de verdad y a qué precio lo cobró el
 * proveedor (la factura). Se compara contra lo pedido: faltantes, sobrantes y precios distintos,
 * cada uno con su efecto en dinero. Una devolución saca del inventario lo devuelto y lo resta de
 * las compras del período en que se devolvió.
 *
 * Reglas (una sola fuente para la pantalla, el PDF y Finanzas):
 * - Valor de una línea = cantidad × precio unitario (sin impuesto).
 * - El impuesto de la orden se reparte en proporción: tasa = impuesto ÷ subtotal de la orden.
 *   Lo recibido y lo devuelto llevan esa misma tasa. Sin subtotal, la tasa es 0.
 * - Compra de una orden recibida = lo recibido × (1 + tasa). Una orden recibida sin revisión
 *   (de antes, o marcada «Recibida» en el formulario) cuenta su total, como siempre.
 * - Una devolución nunca puede pasar de lo recibido menos lo ya devuelto.
 */

import type { PurchaseOrder, PurchaseOrderItem, PurchaseReturn, PurchaseReturnReason } from "@/types/purchase-order"

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Clave estable de una línea: su id, o su posición si es de una orden vieja sin id. */
export function lineKey(item: PurchaseOrderItem, index: number): string {
  return item.id ? String(item.id) : `#${index}`
}

/** Tasa de impuesto de la orden (impuesto ÷ subtotal), 0 si no hay datos. */
export function orderTaxRate(order: Pick<PurchaseOrder, "tax" | "subtotal">): number {
  const tax = order.tax || 0
  const subtotal = order.subtotal || 0
  return subtotal > 0 && tax > 0 ? tax / subtotal : 0
}

export interface ReceiptLineView {
  key: string
  name: string
  unit: string
  ingredientId?: string
  orderedQuantity: number
  orderedUnitCost: number
  receivedQuantity: number
  invoicedUnitCost: number
  /** recibido − pedido (negativo = faltó). */
  quantityDiff: number
  /** precio de factura − precio pedido (positivo = te cobraron más). */
  priceDiff: number
  orderedValue: number
  receivedValue: number
  /** receivedValue − orderedValue, sin impuesto. */
  valueDiff: number
  /** Efecto de la cantidad: (recibido − pedido) × precio pedido. */
  quantityEffect: number
  /** Efecto del precio: (precio factura − precio pedido) × recibido. */
  priceEffect: number
  /** Lo que ya se devolvió de esta línea. */
  returnedQuantity: number
}

/** Líneas de la orden con lo pedido, lo recibido y lo devuelto, lado a lado. */
export function receiptLines(order: PurchaseOrder): ReceiptLineView[] {
  const received = new Map((order.receipt?.lines ?? []).map((l) => [l.key, l]))
  const returned = new Map<string, number>()
  for (const r of order.returns ?? []) for (const l of r.lines) returned.set(l.key, (returned.get(l.key) || 0) + l.quantity)
  return (order.items ?? []).map((item, index) => {
    const key = lineKey(item, index)
    const orderedQuantity = item.totalQuantity || 0
    const orderedUnitCost = item.costPerUnit || 0
    const r = received.get(key)
    const receivedQuantity = r ? r.quantity : order.receipt ? 0 : orderedQuantity
    const invoicedUnitCost = r ? r.unitCost : orderedUnitCost
    const orderedValue = round2(orderedQuantity * orderedUnitCost)
    const receivedValue = round2(receivedQuantity * invoicedUnitCost)
    return {
      key,
      name: item.name,
      unit: item.unit,
      ingredientId: item.ingredientId,
      orderedQuantity,
      orderedUnitCost,
      receivedQuantity,
      invoicedUnitCost,
      quantityDiff: round2(receivedQuantity - orderedQuantity),
      priceDiff: round2(invoicedUnitCost - orderedUnitCost),
      orderedValue,
      receivedValue,
      valueDiff: round2(receivedValue - orderedValue),
      quantityEffect: round2((receivedQuantity - orderedQuantity) * orderedUnitCost),
      priceEffect: round2((invoicedUnitCost - orderedUnitCost) * receivedQuantity),
      returnedQuantity: round2(returned.get(key) || 0),
    }
  })
}

export interface ReceiptSummary {
  /** Subtotal pedido (sin impuesto). */
  orderedSubtotal: number
  /** Subtotal recibido a precio de factura (sin impuesto). */
  receivedSubtotal: number
  taxRate: number
  /** Lo que se compró de verdad: recibido × (1 + tasa). Es lo que entra a Finanzas. */
  receivedTotal: number
  /** receivedTotal − total de la orden. */
  differenceTotal: number
  /** Suma de los efectos por cantidad y por precio (sin impuesto). */
  quantityEffect: number
  priceEffect: number
  /** Líneas con alguna diferencia (cantidad o precio). */
  linesWithDifference: number
}

export function receiptSummary(order: PurchaseOrder): ReceiptSummary {
  const lines = receiptLines(order)
  const taxRate = orderTaxRate(order)
  const orderedSubtotal = round2(lines.reduce((s, l) => s + l.orderedValue, 0))
  const receivedSubtotal = round2(lines.reduce((s, l) => s + l.receivedValue, 0))
  const receivedTotal = order.receipt ? round2(receivedSubtotal * (1 + taxRate)) : round2(order.total || 0)
  return {
    orderedSubtotal,
    receivedSubtotal,
    taxRate,
    receivedTotal,
    differenceTotal: round2(receivedTotal - (order.total || 0)),
    quantityEffect: round2(lines.reduce((s, l) => s + l.quantityEffect, 0)),
    priceEffect: round2(lines.reduce((s, l) => s + l.priceEffect, 0)),
    linesWithDifference: lines.filter((l) => l.quantityDiff !== 0 || l.priceDiff !== 0).length,
  }
}

/** Valor de una devolución con el impuesto de su orden. */
export function returnValue(order: PurchaseOrder, ret: PurchaseReturn): { subtotal: number; tax: number; total: number } {
  const subtotal = round2(ret.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0))
  const tax = round2(subtotal * orderTaxRate(order))
  return { subtotal, tax, total: round2(subtotal + tax) }
}

/** Cuánto se puede devolver todavía de cada línea: recibido − ya devuelto. */
export function returnableQuantities(order: PurchaseOrder): Map<string, number> {
  return new Map(receiptLines(order).map((l) => [l.key, Math.max(0, round2(l.receivedQuantity - l.returnedQuantity))]))
}

/**
 * Valida y arma una devolución. Recorta cada cantidad a lo que se puede devolver; descarta
 * líneas en 0. Devuelve null si no queda nada que devolver.
 */
export function buildReturn(
  order: PurchaseOrder,
  input: { quantities: Record<string, number>; reason: PurchaseReturnReason; note?: string; at?: string; id?: string },
): PurchaseReturn | null {
  const lines = receiptLines(order)
  const left = returnableQuantities(order)
  const out: PurchaseReturn["lines"] = []
  for (const l of lines) {
    const want = Number(input.quantities[l.key]) || 0
    const q = round2(Math.min(Math.max(0, want), left.get(l.key) || 0))
    if (q > 0) out.push({ key: l.key, quantity: q, unitCost: l.invoicedUnitCost })
  }
  if (out.length === 0) return null
  return {
    id: input.id || `DEV-${Date.now()}`,
    at: input.at || new Date().toISOString(),
    reason: input.reason,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    lines: out,
  }
}

/** Compra que cuenta en Finanzas por una orden recibida: lo recibido (o el total si no se revisó). */
export function orderPurchaseValue(order: PurchaseOrder): number {
  return receiptSummary(order).receivedTotal
}

/** Devoluciones (con impuesto) de todas las órdenes cuya fecha cae en el período. */
export function returnsInPeriod(orders: PurchaseOrder[], inRange: (iso: string) => boolean): { total: number; count: number } {
  let total = 0
  let count = 0
  for (const o of orders) {
    for (const r of o.returns ?? []) {
      if (!inRange(r.at)) continue
      total += returnValue(o, r).total
      count++
    }
  }
  return { total: round2(total), count }
}

export const RETURN_REASONS: PurchaseReturnReason[] = ["damaged", "expired", "wrong_item", "excess", "quality", "other"]
