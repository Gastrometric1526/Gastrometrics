/**
 * Lectura tolerante de listas de ingredientes para la importación masiva (docs/148).
 * Pedido del dueño: que migrar sus cosas sea lo más rápido y cómodo posible. Antes
 * una fila con "$1,50", "₡1.500" o "1.250,75" se descartaba (Number() da NaN), un
 * encabezado vacío o la columna "u" emparejaban con cualquier cosa, y una lista
 * pegada sin encabezados no se reconocía. Todo esto es puro (cubierto por pruebas).
 */

import { matchUnitLabel } from "@/lib/ingredient-labels"
import { units } from "@/types/ingredient"

/** Alias de encabezado por campo, en los 6 idiomas de la app. */
export const INGREDIENT_COLUMN_ALIASES = {
  name: ["nombre", "ingrediente", "insumo", "producto", "articulo", "descripcion", "name", "ingredient", "item", "product", "description", "navn", "ingrediens", "produkt", "vare", "nom", "produit", "ingredient", "article", "nome", "produto", "insumo", "名称", "产品", "食材", "原料", "品名"],
  unit: ["unidad", "medida", "um", "unit", "uom", "measure", "enhed", "unite", "mesure", "unidade", "单位"],
  price: ["precio", "costo", "valor", "importe", "price", "cost", "value", "pris", "kostpris", "prix", "cout", "preco", "custo", "价格", "价钱", "单价", "成本"],
  content: ["contenido", "cantidad", "peso", "volumen", "neto", "presentacion", "content", "quantity", "qty", "weight", "volume", "net", "size", "indhold", "maengde", "vaegt", "contenu", "quantite", "poids", "conteudo", "quantidade", "净含量", "数量", "重量", "规格"],
  category: ["categoria", "rubro", "clasificacion", "familia", "category", "classification", "group", "kategori", "gruppe", "categorie", "famille", "classificacao", "类别", "分类"],
  supplier: ["proveedor", "supplier", "vendor", "leverandor", "fournisseur", "fornecedor", "供应商"],
} as const

export type IngredientField = keyof typeof INGREDIENT_COLUMN_ALIASES

export interface ImportedIngredientRow {
  name: string
  unit: string // unidad canónica de types/ingredient.ts
  price: number // NaN si no se pudo leer
  content: number // contenido neto en esa unidad (1 por defecto)
  category: string
  supplier: string
}

const norm = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .trim()

/**
 * Número escrito como lo escribe la gente: "1,50", "1.250,75", "1,250.75", "$ 12",
 * "₡1.500", "12 kr", "1 500". Devuelve NaN si no hay número.
 */
/**
 * Monedas de valor unitario pequeño, donde los precios se escriben sin decimales y con
 * punto de miles ("1.500" = mil quinientos): con ellas un "x.xxx" sin otro separador se
 * lee como miles. Con las demás (USD, EUR, HNL…) "1.500" sigue siendo 1.5.
 */
export const DOT_THOUSANDS_CURRENCIES = new Set(["CRC", "COP", "CLP", "PYG", "ARS"])

export function parseLocaleNumber(value: unknown, currency?: string): number {
  if (typeof value === "number") return value
  let s = String(value ?? "").replace(/[\s  ']/g, "")
  s = s.replace(/[^\d.,-]/g, "")
  if (!/\d/.test(s)) return NaN
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma >= 0 && lastDot >= 0) {
    // El último separador es el decimal; el otro, de miles.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma >= 0) {
    // Solo comas: "1,50" decimal; "1,500" o "1,500,000" miles.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".")
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "") // "1.500.000"
  } else if (lastDot >= 0 && /^-?[1-9]\d{0,2}\.\d{3}$/.test(s) && (/[₡₲₩]|CRC|COP|CLP|PYG|ARS/i.test(String(value)) || DOT_THOUSANDS_CURRENCIES.has(currency ?? ""))) {
    s = s.replace(".", "") // "₡1.500": monedas sin decimales
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Encabezado que corresponde a un campo: primero igualdad exacta, luego contiene (≥ 3 letras). */
export function findColumn(headers: string[], field: IngredientField, taken: Set<string> = new Set()): string | null {
  const aliases = INGREDIENT_COLUMN_ALIASES[field].map(norm)
  const candidates = headers.filter((h) => norm(h) && !taken.has(h))
  const exact = candidates.find((h) => aliases.includes(norm(h)))
  if (exact) return exact
  for (const alias of aliases) {
    if (alias.length < 3 && !/[一-鿿]/.test(alias)) continue
    const found = candidates.find((h) => norm(h).includes(alias))
    if (found) return found
  }
  return null
}

/** "5 kg", "saco 25 kg", "kg" → unidad canónica y contenido. */
export function readUnitCell(raw: unknown): { unit: string | null; content: number | null } {
  const text = String(raw ?? "").trim()
  if (!text) return { unit: null, content: null }
  const direct = units.includes(text.toLowerCase() as (typeof units)[number]) ? text.toLowerCase() : matchUnitLabel(text)
  if (direct) return { unit: direct, content: null }
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*([^\d\s][^\d]*)$/)
  if (m) {
    const unit = matchUnitLabel(m[2].trim())
    if (unit) return { unit, content: parseLocaleNumber(m[1]) }
  }
  return { unit: null, content: null }
}

/**
 * Lista pegada (de Excel/Google Sheets, un correo o WhatsApp) → filas. Separador: tabulador
 * (copiar celdas), punto y coma, o coma seguida de espacio — así "Tomate, 2 kg, 3,50"
 * no parte el precio decimal en dos.
 */
export function splitPastedList(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim()).filter(Boolean)
  const all = lines.join("\n")
  const sep = all.includes("\t") ? /\t/ : all.includes(";") ? /;/ : /,\s+|\s+[-–|]\s+|\s{2,}/.test(all) ? /,\s+|\s+[-–|]\s+|\s{2,}/ : /,/
  // Sin separadores sobrantes al final de la celda ("Cilantro, 1 unidad, " → "1 unidad").
  return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/[,;]+$/, "").trim()))
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const taken = new Set<string>()
  const name = findColumn(cells, "name", taken)
  const price = findColumn(cells, "price", taken)
  return Boolean(name || price)
}

/**
 * Filas crudas (primera fila = encabezados o datos) → ingredientes. Si la primera fila
 * no parece de encabezados (lista pegada sin títulos), se deduce: la primera columna
 * con texto es el nombre, la primera con números el precio, la que tenga unidades la
 * unidad, y una segunda numérica el contenido.
 */
export function mapIngredientRows(matrix: unknown[][], options: { currency?: string } = {}): ImportedIngredientRow[] {
  const rows = matrix.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean))
  if (!rows.length) return []
  let headers: string[]
  let data: string[][]
  if (looksLikeHeaderRow(rows[0])) {
    headers = rows[0]
    data = rows.slice(1)
  } else {
    headers = guessHeaders(rows)
    data = rows
  }
  const taken = new Set<string>()
  const col = {} as Record<IngredientField, number>
  for (const field of ["name", "price", "unit", "content", "category", "supplier"] as IngredientField[]) {
    const h = findColumn(headers, field, taken)
    if (h) taken.add(h)
    col[field] = h ? headers.indexOf(h) : -1
  }
  const at = (row: string[], field: IngredientField) => (col[field] >= 0 ? row[col[field]] ?? "" : "")

  const out: ImportedIngredientRow[] = []
  for (const row of data) {
    const name = at(row, "name")
    const priceRaw = at(row, "price")
    if (!name && !priceRaw) continue
    const unitCell = readUnitCell(at(row, "unit"))
    const contentRaw = at(row, "content")
    // "Contenido" puede traer la unidad pegada ("5 kg") si no hay columna de unidad.
    const contentCell = readUnitCell(contentRaw)
    const contentNum = contentRaw ? parseLocaleNumber(contentRaw) : NaN
    out.push({
      name,
      unit: unitCell.unit ?? contentCell.unit ?? "gramos",
      price: parseLocaleNumber(priceRaw, options.currency),
      content: Number.isFinite(contentNum) && contentNum > 0 ? contentNum : unitCell.content ?? 1,
      category: at(row, "category"),
      supplier: at(row, "supplier"),
    })
  }
  return out
}

function guessHeaders(rows: string[][]): string[] {
  const width = Math.max(...rows.map((r) => r.length))
  const sample = rows.slice(0, 20)
  // Número o precio: sin letras salvo un símbolo/código de moneda ("$12", "₡1.500", "12 kr").
  const isNum = (c: string) =>
    /\d/.test(c) && !/\p{L}/u.test(c.replace(/\b(?:kr|dkk|usd|eur|crc|cop|mxn|brl|rmb|cny|lps?|q)\b|r\$|元/gi, ""))
  const isUnit = (c: string) => readUnitCell(c).unit !== null && !isNum(c)
  const share = (i: number, test: (c: string) => boolean) => sample.filter((r) => r[i] && test(r[i])).length / sample.length
  const headers = Array.from({ length: width }, () => "")
  const free = new Set(Array.from({ length: width }, (_, i) => i))
  const pick = (label: string, test: (c: string) => boolean) => {
    for (const i of free) {
      if (share(i, test) >= 0.5) {
        headers[i] = label
        free.delete(i)
        return
      }
    }
  }
  pick("unidad", isUnit)
  pick("precio", isNum)
  pick("contenido", isNum)
  pick("nombre", (c) => !isNum(c) && !isUnit(c))
  return headers
}
