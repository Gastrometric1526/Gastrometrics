// Importación de ventas del POS (ver docs/32). Un archivo importado se guarda como
// un SalesImport con sus líneas ya resueltas (vinculadas a una receta o no). El
// mapeo de columnas y de nombres de plato se guardan aparte, por negocio, para que
// la siguiente importación del mismo POS sea casi de un solo clic.

export interface SalesImportLine {
  id: string
  rawDishName: string // el nombre tal como vino del archivo del POS (o el nombre de la receta/menú, en un registro manual)
  recipeId: string | null // receta vinculada, o null si no se pudo/quiso vincular
  // Menú vendido como una sola unidad (docs/90, registro manual sin POS) — nunca lo
  // pone la importación de POS (esa solo conoce recetas). Mutuamente excluyente con
  // recipeId en la práctica, pero no se fuerza a nivel de tipo para no complicar el
  // resto del código que ya asume recipeId como el único vínculo posible.
  menuId?: string | null
  quantity: number
  unitPrice: number | null // precio de venta si el archivo lo trae; si no, se usa el de la receta
  revenue: number // quantity * (unitPrice ?? recipe.unitPrice ?? 0)
  theoreticalCost: number // quantity * recipe.costPerServing (0 si no hay receta vinculada)
}

export interface SalesImport {
  id: string
  businessId: string
  fileName: string
  importedAt: string
  periodStart: string | null
  periodEnd: string | null
  totalRevenue: number
  totalTheoreticalCost: number
  lineCount: number
  unmatchedDishNames: string[]
  lines: SalesImportLine[]
  // "manual" = registrado a mano desde /estadisticas → Ventas (docs/90, sin POS).
  // "invoice" = generado solo al guardar una Factura (app/facturas/page.tsx,
  // docs/123) — una factura a un cliente ES una venta, y por eso también aparece acá:
  // sin esto, facturar catering/mayoreo quedaría invisible para Finanzas/Menu
  // Engineering/food cost real vs. teórico. Ausente/"pos_import" en todo lo
  // importado antes de esto — se trata como "pos_import" en cualquier lugar que lo
  // lea, para no romper datos ya guardados.
  source?: "pos_import" | "manual" | "invoice"
  // Presente solo cuando source === "invoice" — id de la factura de origen, para
  // poder llevar de vuelta a su PDF desde Estadísticas → Ventas sin tener que
  // adivinar el vínculo por nombre.
  invoiceId?: string
}

// Formato de fecha del archivo del POS — necesario porque "03/04/2026" es ambiguo
// (3 de abril o 4 de marzo) y antes se le pasaba tal cual a `new Date(...)`, que en
// el navegador interpreta MM/DD/AAAA sin avisar, dando fechas silenciosamente mal
// para cualquier POS que exporte DD/MM/AAAA (la norma en Centroamérica). "auto"
// detecta el formato mirando los valores reales de la columna (ver detectDateFormat
// en components/pos-sales-import-dialog.tsx); YMD (ISO) nunca es ambiguo así que no
// hace falta elegirlo a mano, pero se guarda igual para que una plantilla con fechas
// ISO no vuelva a preguntar.
export type DateFormatHint = "auto" | "DMY" | "MDY" | "YMD"

// Mapeo de columnas del archivo del POS -> campos que necesitamos. Antes existía una
// sola plantilla por negocio (se sobrescribía en cada importación); ahora puede haber
// varias con nombre ("Toast", "SoftRestaurant") para negocios que usan más de un POS
// o que cambiaron de sistema — ver spec del dueño del proyecto ("las siguientes
// importaciones son casi de un solo clic", ahora por plantilla en vez de por negocio).
export interface POSColumnMapping {
  id: string // id de la plantilla (uuid) — antes no existía, había una sola por negocio
  name: string // nombre elegido por el usuario, p.ej. "Toast" — antes no existía
  businessId: string
  dateColumn: string | null
  dishColumn: string
  quantityColumn: string
  priceColumn: string | null
  dateFormat?: DateFormatHint
  updatedAt: string
}

// Vínculo aprendido entre un nombre de plato tal como aparece en el POS (normalizado)
// y una receta real — así una vez que el usuario vincula "Hamburguesa Clasica" con
// la receta "Hamburguesa Clásica", las próximas importaciones lo hacen solas.
export interface DishNameMapping {
  businessId: string
  normalizedPosName: string
  recipeId: string
  updatedAt: string
}
