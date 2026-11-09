/**
 * Modificadores del POS (docs/261): «Extra queso», «2x Tocino», «Sin cebolla».
 *
 * El POS ya cobra los extras dentro del precio del plato, así que no suman venta. Sí suman
 * costo: cada modificador se une a una receta pequeña (p. ej. «Extra queso», 30 g de queso)
 * y su costo por porción se suma al costo teórico del plato, y sus ingredientes al consumo
 * del inventario teórico. Los que quitan algo («Sin cebolla») no se cuentan: el ahorro es
 * mínimo y casi nunca está costeado. Puro, probado en pos-modifiers.test.ts.
 */

export interface SaleModifier {
  /** Nombre tal como vino del POS, sin la cantidad. */
  name: string
  /** Receta vinculada, o null si todavía no se unió a ninguna. */
  recipeId: string | null
  /** Cuántas veces va el modificador en cada unidad del plato (casi siempre 1). */
  quantity: number
  /**
   * Precio de una unidad del extra, solo en las ventas del POS propio (docs/268), donde el
   * extra SÍ suma venta (ya está dentro del revenue de la línea). Sirve para Reportes.
   */
  price?: number
}

/** Palabras que indican que el modificador quita algo, en los 6 idiomas. */
const REMOVAL = /^(sin|no|without|uden|ingen|sans|pas de|sem|不要|去|无)\b/i

/**
 * Separa la celda de modificadores en una lista. Acepta comas, punto y coma, barras,
 * saltos de línea o «+», y cantidades como «2x Tocino», «Tocino x2» o «Tocino (2)».
 */
export function splitModifiers(raw: string | null | undefined): { name: string; quantity: number }[] {
  if (!raw) return []
  const out: { name: string; quantity: number }[] = []
  for (const part of String(raw).split(/[,;|\n\r]+|\s\+\s|^\+|\s\+(?=\S)/)) {
    let name = part.replace(/^[\s+•·\-–]+|[\s.]+$/g, "").trim()
    if (!name) continue
    let quantity = 1
    const lead = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(.+)$/i.exec(name)
    const trail = /^(.+?)\s*(?:[x×*]\s*(\d+(?:[.,]\d+)?)|\((\d+(?:[.,]\d+)?)\))$/i.exec(name)
    if (lead) {
      quantity = Number(lead[1].replace(",", "."))
      name = lead[2].trim()
    } else if (trail) {
      quantity = Number((trail[2] ?? trail[3]).replace(",", "."))
      name = trail[1].trim()
    }
    if (!name || REMOVAL.test(name) || !(quantity > 0)) continue
    out.push({ name, quantity })
  }
  return out
}

/** Costo de los modificadores por cada unidad del plato. Puro. */
export function modifiersUnitCost(
  modifiers: SaleModifier[] | undefined,
  recipes: { id: string; costPerServing?: number }[],
): number {
  if (!modifiers?.length) return 0
  let total = 0
  for (const m of modifiers) {
    if (!m.recipeId) continue
    const recipe = recipes.find((r) => r.id === m.recipeId)
    total += (recipe?.costPerServing || 0) * m.quantity
  }
  return total
}
