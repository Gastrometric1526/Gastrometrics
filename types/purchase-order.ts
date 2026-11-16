export interface PurchaseOrderItem {
  id?: string
  // Ingrediente de origen (docs/190): permite sumar al inventario aunque el ingrediente se
  // haya renombrado después de hacer la orden. Las órdenes viejas no lo tienen.
  ingredientId?: string
  name: string
  totalQuantity: number
  unit: string
  costPerUnit: number
  purchaseCost: number
  quantityToBuy: number
  supplier: string
  manuallySet?: boolean
  // Presentación de compra (Saco, Caja, Botella...) — ver lib/utils/presentation-quantity.ts.
  // null cuando el ingrediente no tenía presentación configurada al generar la orden.
  presentation?: string | null
  presentationQuantity?: number | null
}

export interface PurchaseOrder {
  id: string
  name: string
  number: number
  date: string
  recipes: {
    id: string
    name: string
    yield: number
  }[]
  items: PurchaseOrderItem[]
  total: number
  // Campos usados por la orden creada/editada a mano desde components/purchase-order-page.tsx
  // (a diferencia de las que arma menu-y-compras a partir de recetas, que no los necesitan).
  status?: "pending" | "approved" | "ordered" | "received" | "cancelled"
  supplier?: string
  createdAt?: string
  // Guardados desde docs/190: antes el formulario los mostraba pero no se guardaban, y al
  // editar una orden con impuesto el impuesto se perdía (subtotal = total, impuesto 0).
  subtotal?: number
  tax?: number
  expectedDeliveryDate?: string
  notes?: string
  /**
   * Cuándo pasó a «Recibida» (docs/305). Es la fecha en que la compra entra al inventario y
   * al costo real (COGS) de Finanzas. Las órdenes recibidas antes de este campo usan `date`.
   */
  receivedAt?: string
  /**
   * Recepción con revisión (docs/322): lo que llegó de verdad y a qué precio lo cobró el
   * proveedor, por línea (`key` = `lineKey`, lib/purchase-receipt.ts). Sin este campo, una orden
   * recibida cuenta tal como se pidió (órdenes de antes o marcadas «Recibida» en el formulario).
   */
  receipt?: PurchaseReceipt
  /** Devoluciones al proveedor (docs/322), la más reciente al final. */
  returns?: PurchaseReturn[]
}

export interface PurchaseReceipt {
  at: string
  invoiceNumber?: string
  lines: { key: string; quantity: number; unitCost: number }[]
}

export type PurchaseReturnReason = "damaged" | "expired" | "wrong_item" | "excess" | "quality" | "other"

export interface PurchaseReturn {
  id: string
  at: string
  reason: PurchaseReturnReason
  note?: string
  /** Precio unitario = el de la factura de esa línea (lo que se pagó). */
  lines: { key: string; quantity: number; unitCost: number }[]
}

// New types for PDF processing

export interface ValidationResult {
  isValid: boolean
  message: string
}

export interface ProcessedOrderItem {
  name: string
  quantity: number
  unit: string
  unitPrice?: number
  totalPrice?: number
  supplier?: string
  validation: ValidationResult
}

export interface ProcessedOrder {
  orderName?: string
  orderNumber: number
  date?: string
  items: ProcessedOrderItem[]
}
