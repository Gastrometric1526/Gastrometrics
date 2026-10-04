/**
 * Recetas en Excel (docs/149): la primera hoja se convierte en texto que entiende
 * parseRecipeText. Las filas de una sola celda quedan como líneas (título, "Ingredientes",
 * pasos) y las de varias celdas como tabla "Harina | 500 | g". Se descartan las filas de
 * títulos de columna ("Ingrediente | Cantidad | Unidad"), en los 6 idiomas. Puro.
 */

const HEADER_WORDS = new Set(
  [
    "ingrediente", "ingredientes", "insumo", "producto", "cantidad", "cant", "unidad", "medida", "precio", "costo", "nota", "notas", "observaciones",
    "ingredient", "ingredients", "item", "quantity", "qty", "amount", "unit", "units", "price", "cost", "note", "notes",
    "ingrediens", "ingredienser", "maengde", "enhed", "pris", "bemaerkning",
    "quantite", "unite", "prix", "cout", "remarque",
    "quantidade", "unidade", "preco", "custo", "observacao",
    "原料", "配料", "食材", "名称", "数量", "用量", "单位", "价格", "备注",
  ].map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "")),
)

const norm = (c: string) =>
  c
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[:.()/#]/g, "")
    .trim()

function isColumnHeaderRow(cells: string[]): boolean {
  return cells.length >= 2 && cells.every((c) => HEADER_WORDS.has(norm(c)))
}

export function spreadsheetToRecipeText(matrix: unknown[][]): string {
  const lines: string[] = []
  for (const row of matrix) {
    const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean)
    if (!cells.length) {
      lines.push("")
      continue
    }
    if (isColumnHeaderRow(cells)) continue
    lines.push(cells.length === 1 ? cells[0] : cells.join(" | "))
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}
