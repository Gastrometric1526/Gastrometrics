/**
 * Resumen de importaciones masivas por tipo para /admin (docs/211): ingredientes y recetas
 * por separado, como pidió el dueño («la importación masiva de ingredientes vía Excel y así
 * igual para recetas»). Puro, probado en lib/admin/import-summary.test.ts.
 */

export interface ImportEvent {
  email: string
  kind: string // módulo de activity_log: ingredientes, recetas, inventario, estadisticas
  format: string | null // excel, csv, pdf, foto, texto
  count: number | null // filas importadas (ingredientes nuevos, recetas, productos, ventas)
  updated?: number | null // ingredientes: precios actualizados desde un ticket
  newIngredients?: number | null // recetas: ingredientes creados al importarla
}

export interface KindSummary {
  imports: number // veces que se importó
  excel: number // de esas, desde un Excel (.xlsx/.xlsm/.xls) o CSV
  rows: number // filas creadas en total
  updated: number // precios actualizados
  newIngredients: number // ingredientes creados al importar recetas
  accounts: number // cuentas distintas
}

const empty = (): KindSummary => ({ imports: 0, excel: 0, rows: 0, updated: 0, newIngredients: 0, accounts: 0 })

/** Agrupa en ingredientes, recetas y «otras» (conteos de inventario y ventas). */
export function summarizeImports(events: ImportEvent[]): { ingredientes: KindSummary; recetas: KindSummary; otras: KindSummary } {
  const out = { ingredientes: empty(), recetas: empty(), otras: empty() }
  const accounts = { ingredientes: new Set<string>(), recetas: new Set<string>(), otras: new Set<string>() }
  for (const e of events) {
    const key = e.kind === "ingredientes" || e.kind === "recetas" ? e.kind : "otras"
    const s = out[key]
    s.imports++
    if (e.format === "excel" || e.format === "csv") s.excel++
    s.rows += e.count || 0
    s.updated += e.updated || 0
    s.newIngredients += e.newIngredients || 0
    accounts[key].add(e.email)
  }
  out.ingredientes.accounts = accounts.ingredientes.size
  out.recetas.accounts = accounts.recetas.size
  out.otras.accounts = accounts.otras.size
  return out
}
