export interface PurchaseOrderItem {
  id?: string
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
