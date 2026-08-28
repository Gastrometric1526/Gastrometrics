export interface InventoryItem {
  id: string
  name: string
  category: string
  currentStock: number | null
  minStock: number
  unit: string
  price: number
  netContent?: number
  presentation?: string
  location?: string
  supplier?: string
  lastUpdated: string
  status: "normal" | "low" | "critical"
}

export interface InventorySnapshotItem {
  id: string
  name: string
  category: string
  quantity: number
  displayQuantity?: number
  unit: string
  price: number
  totalPrice: number
  presentation?: string
  netContent?: number
  priceAtDate?: number
  previousPrice?: number
  supplier?: string
}

export interface InventorySnapshot {
  id: string
  date: string
  type: "initial" | "final" | "purchase"
  // En español porque así los escriben y comparan register-inventory-modal.tsx (al
  // guardar) y history-view.tsx (al filtrar) — a diferencia de `type` arriba, acá
  // escritor y lectores ya coincidían entre sí, solo el tipo declarado estaba desfasado.
  periodicity?: "diario" | "semanal" | "mensual"
  period?: "daily" | "weekly" | "monthly" // alias legado, ver register-inventory-modal.tsx
  division?: string
  notes?: string
  inventoryMode?: "metric" | "presentation"
  modifiedItems: number
  totalValue: number
  items?: InventorySnapshotItem[]
  dateRange?: { start: string; end: string }
  createdBy?: string
  createdAt?: string
}

export interface InventorySession {
  id: string
  date: string
  type: "initial" | "final" | "purchase"
  periodicity?: "daily" | "weekly" | "monthly"
  division: string
  items: InventorySessionItem[]
  totalValue: number
}

export interface InventorySessionItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  price: number
  totalPrice: number
}

export const categories = [
  "ACEITES",
  "ALCOHOL",
  "AVES",
  "BEBIDAS",
  "CAFÉ",
  "CERDO",
  "CHOCOLATE",
  "GAME",
  "DESECHABLES",
  "DULCE",
  "EMBUTIDO",
  "ESENCIA",
  "ESPECIAS",
  "FIDEOS",
  "FLORES",
  "FRUTA",
  "GRANOS",
  "GRASAS",
  "GUARNICIÓN",
  "HARINA",
  "HIERBAS",
  "LÁCTEOS Y DERIVADOS",
  "LEVADURA",
  "MARISCOS",
  "MASA",
  "MOLECULAR",
  "NUECES",
  "OTROS",
  "PESCADO",
  "REPOSTERÍA",
  "RES",
  "SAL",
  "SECOS Y ABARROTES",
  "SIROPES",
  "VEGETAL",
] as const

export type Category = (typeof categories)[number]

export const units = ["KILOGRAMO", "LITRO", "UNIDAD"] as const

export type Unit = (typeof units)[number]
