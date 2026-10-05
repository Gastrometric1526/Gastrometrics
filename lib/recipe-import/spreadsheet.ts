/**
 * Recetas en Excel (docs/149, docs/152) → texto que entiende parseRecipeText. Puro.
 *
 * Dos casos:
 *  1. Ficha técnica con tabla (docs/152, con un libro real .xlsm de una escuela de
 *     gastronomía): se busca la fila de encabezados con una columna de nombre del
 *     ingrediente y otra de cantidad ("Nombre | Cantidad | Medida | Costo / Medida…").
 *     Solo se usan esas columnas — una ficha real trae al lado listas de opciones,
 *     costos de producción, ganancias, etc. Antes de la tabla se leen los campos
 *     "Nombre: …" y "Rendimiento: …"; después, los pasos numerados.
 *  2. Sin tabla reconocible: filas de una celda = líneas (título, "Ingredientes", pasos) y
 *     de varias celdas = "Harina | 500 | g", descartando filas de títulos de columna.
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
    .replace(/[:.()/#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

function isColumnHeaderRow(cells: string[]): boolean {
  return cells.length >= 2 && cells.every((c) => HEADER_WORDS.has(norm(c)))
}

// Encabezados de la tabla de una ficha técnica, en los 6 idiomas
const COL_NAME = /^(nombre|ingrediente|ingredientes|insumo|producto|descripcion|articulo|name|ingredient|item|product|navn|ingrediens|vare|nom|ingredient|produit|nome|produto|原料|名称|食材|品名)$/
const COL_QTY = /^(cantidad|cant|cantidad neta|cantidad bruta|peso neto|peso|quantity|qty|amount|net weight|maengde|quantite|quantidade|数量|用量|重量)$/
const COL_UNIT = /^(medida|unidad|unidad de medida|um|u m|unit|uom|measure|enhed|unite|mesure|unidade|medida caseira|单位)$/
const COL_COST = /^(costo medida|costo unitario|costo|precio unitario|precio|unit cost|cost|price|kostpris|pris|cout unitaire|cout|prix|custo unitario|custo|preco|单价|成本|价格)$/
const LABEL_NAME = /^(nombre|nombre de la receta|nombre del plato|receta|plato|name|recipe|recipe name|navn|opskrift|nom|recette|nome|receita|nome da preparacao|菜名|名称)$/
const LABEL_YIELD = /^(rendimiento|porciones|raciones|pax|yield|servings|portions|udbytte|portioner|rendement|rendimento|porcoes|份数|人份)$/
const END_OF_TABLE = /^(total|subtotal|comentario|comentarios|preparacion|procedimiento|elaboracion|metodo|method|instructions|directions|notas|notes|fremgangsmade|preparation|modo de preparo|做法|步骤)/

function findHeader(rows: string[][]): { row: number; name: number; qty: number; unit: number; cost: number } | null {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = rows[r].map(norm)
    const name = cells.findIndex((c) => COL_NAME.test(c))
    const qty = cells.findIndex((c) => COL_QTY.test(c))
    if (name >= 0 && qty >= 0 && name !== qty) {
      return { row: r, name, qty, unit: cells.findIndex((c) => COL_UNIT.test(c)), cost: cells.findIndex((c) => COL_COST.test(c)) }
    }
  }
  return null
}

const firstNumber = (s: string) => s.match(/\d+(?:[.,]\d+)*/)?.[0] ?? ""
const money = (s: string) => {
  const raw = s.replace(/[^\d.,-]/g, "")
  if (!/\d/.test(raw)) return null
  // "L1,575.00" / "1.575,00" / "0.28"
  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  const n = Number(lastComma > lastDot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

function structuredRecipe(rows: string[][], h: NonNullable<ReturnType<typeof findHeader>>): string {
  const out: string[] = []
  // Campos antes de la tabla: "Nombre | Eggless Chocolate Chips Cookies", "Rendimiento | 45"
  let title = ""
  let servings = ""
  for (const row of rows.slice(0, h.row)) {
    row.forEach((cell, i) => {
      const label = norm(cell)
      const next = row.slice(i + 1).find((c) => c.trim()) ?? ""
      if (!title && LABEL_NAME.test(label) && next && !/^\d+([.,]\d+)?$/.test(next)) title = next.trim()
      if (!servings && LABEL_YIELD.test(label) && firstNumber(next)) servings = firstNumber(next)
    })
  }
  // Sin campo "Nombre": la primera fila de una sola celda con texto antes de la tabla
  if (!title) {
    const single = rows.slice(0, h.row).find((row) => {
      const cells = row.filter((c) => c.trim())
      return cells.length === 1 && /\p{L}{3}/u.test(cells[0]) && !LABEL_YIELD.test(norm(cells[0]))
    })
    if (single) title = single.find((c) => c.trim())!.trim()
  }
  if (title) out.push(`Nombre: ${title}`)
  if (servings) out.push(`Porciones: ${servings}`)
  out.push("Ingredientes:")
  let r = h.row + 1
  for (; r < rows.length; r++) {
    const row = rows[r]
    const first = norm(row.find((c) => c.trim()) ?? "")
    if (END_OF_TABLE.test(first)) break
    const name = (row[h.name] ?? "").trim()
    if (!name || /^[-–—.]+$/.test(name)) continue
    const qty = (row[h.qty] ?? "").trim()
    const unit = h.unit >= 0 ? (row[h.unit] ?? "").trim() : ""
    const cost = h.cost >= 0 ? money(row[h.cost] ?? "") : null
    out.push([name, `${qty} ${unit}`.trim(), cost ? `$${cost}` : ""].filter(Boolean).join(" | "))
  }
  // Pasos: filas con un texto largo (con o sin número delante), después de la tabla
  const steps: string[] = []
  for (; r < rows.length; r++) {
    const text = rows[r].map((c) => c.trim()).filter((c) => c.length >= 15).sort((a, b) => b.length - a.length)[0]
    if (text && !/^(total|comentario)/i.test(norm(text))) steps.push(text.replace(/^\s*\d+\s*[.)-]\s*/, ""))
  }
  if (steps.length) out.push("", "Preparación:", ...steps.map((s, i) => `${i + 1}. ${s}`))
  return out.join("\n")
}

export function spreadsheetToRecipeText(matrix: unknown[][]): string {
  const rows = matrix.map((row) => row.map((c) => String(c ?? "").trim()))
  const header = findHeader(rows)
  if (header) return structuredRecipe(rows, header)

  const lines: string[] = []
  for (const row of rows) {
    const cells = row.filter(Boolean)
    if (!cells.length) {
      lines.push("")
      continue
    }
    if (isColumnHeaderRow(cells)) continue
    lines.push(cells.length === 1 ? cells[0] : cells.join(" | "))
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/** true si la hoja tiene una tabla de ficha técnica reconocible (para elegir la hoja). */
export function hasRecipeTable(matrix: unknown[][]): boolean {
  return findHeader(matrix.map((row) => row.map((c) => String(c ?? "").trim()))) !== null
}
