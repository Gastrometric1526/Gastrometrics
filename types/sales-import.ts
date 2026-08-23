// Importación de ventas del POS (ver docs/32). Un archivo importado se guarda como
// un SalesImport con sus líneas ya resueltas (vinculadas a una receta o no). El
// mapeo de columnas y de nombres de plato se guardan aparte, por negocio, para que
// la siguiente importación del mismo POS sea casi de un solo clic.

export interface SalesImportLine {
  id: string
  rawDishName: string // el nombre tal como vino del archivo del POS
  recipeId: string | null // receta vinculada, o null si no se pudo/quiso vincular
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
}

// Mapeo de columnas del archivo del POS -> campos que necesitamos. Se guarda una
// vez por negocio y se reusa en la siguiente importación (ver spec del dueño del
// proyecto: "las siguientes importaciones son casi de un solo clic").
export interface POSColumnMapping {
  businessId: string
  dateColumn: string | null
  dishColumn: string
  quantityColumn: string
  priceColumn: string | null
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
