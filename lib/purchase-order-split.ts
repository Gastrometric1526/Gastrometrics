/**
 * Una orden de compra por proveedor, en lote (pedido del dueño, docs/264). Parte una orden
 * con varios proveedores en una por proveedor: cada una con sus ingredientes y su subtotal,
 * y el impuesto repartido en proporción (la última se queda con el redondeo, así la suma da
 * exactamente el impuesto original). Puro, probado en purchase-order-split.test.ts.
 */

export interface SplittableItem {
  supplier?: string
  totalPrice: number
}

export interface SplittableOrder<T extends SplittableItem> {
  orderNumber: string
  supplier: string
  items: T[]
  subtotal: number
  tax: number
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Proveedores distintos de la orden (la línea sin proveedor usa el de la orden). */
export function orderSuppliers(order: { supplier: string; items: SplittableItem[] }): string[] {
  const seen: string[] = []
  for (const item of order.items) {
    const name = (item.supplier || order.supplier || "").trim()
    if (!seen.some((s) => s.toLowerCase() === name.toLowerCase())) seen.push(name)
  }
  return seen
}

export function splitOrderBySupplier<T extends SplittableItem, O extends SplittableOrder<T>>(order: O, noSupplierLabel: string): O[] {
  const suppliers = orderSuppliers(order)
  if (suppliers.length <= 1) return [order]
  let taxGiven = 0
  return suppliers.map((supplier, index) => {
    const items = order.items.filter((item) => (item.supplier || order.supplier || "").trim().toLowerCase() === supplier.toLowerCase())
    const subtotal = round2(items.reduce((sum, item) => sum + (item.totalPrice || 0), 0))
    const isLast = index === suppliers.length - 1
    const tax = isLast ? round2(order.tax - taxGiven) : order.subtotal > 0 ? round2((order.tax * subtotal) / order.subtotal) : 0
    taxGiven = round2(taxGiven + tax)
    return {
      ...order,
      orderNumber: `${order.orderNumber}-${index + 1}`,
      supplier: supplier || noSupplierLabel,
      items,
      subtotal,
      tax,
      total: round2(subtotal + tax),
    }
  })
}
