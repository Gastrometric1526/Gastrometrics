// Factura — pedido explícito del dueño del proyecto tras el mensaje de un usuario
// real: "figuring out how to make an invoice, is that external?". Documento simple de
// cara al CLIENTE del negocio (a diferencia de Orden de Compra, que es hacia un
// proveedor) — reusa el nombre y el logo del negocio (types/business.ts#logo) igual
// que ya hacen los demás PDF (ver lib/pdf/pdf-logo.ts).

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  // amount = quantity * unitPrice, guardado (no recalculado al leer) para que una
  // factura ya emitida no cambie de total si el precio de la receta/menú de origen
  // se actualiza después — mismo criterio que Orden de Compra.
  amount: number
  // Referencia opcional a la receta/menú de donde se tomó el precio sugerido — solo
  // para poder re-seleccionarla al editar, nunca se relee el precio actual desde acá.
  sourceId?: string | null
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "void"

export interface Invoice {
  id: string
  businessId?: string
  number: string
  status: InvoiceStatus
  issueDate: string
  clientName: string
  clientTaxId?: string
  clientEmail?: string
  clientAddress?: string
  items: InvoiceLineItem[]
  taxPercent: number
  notes?: string
  subtotal: number
  taxAmount: number
  total: number
  metadata: {
    createdAt: string
    updatedAt: string
    version: number
  }
}
