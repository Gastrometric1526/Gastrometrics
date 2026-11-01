/**
 * A qué ingrediente corresponde una línea de un ticket o de una lista importada (docs/222).
 *
 * Pedido del dueño: una cocina puede tener varios «Tomate» (de distintos proveedores o tipos)
 * y el ticket nunca dice cuál. Regla: una línea cambia como mucho UN ingrediente, y si hay
 * duda no cambia ninguno hasta que la persona elige. Se busca por nombre (o por un alias que
 * la persona ya confirmó para ese proveedor) y por el proveedor del ticket.
 */

import type { Ingredient } from "@/types/ingredient"

/** Nombre de un ticket ya confirmado para un ingrediente, ligado a su proveedor. */
export interface ReceiptAlias {
  text: string // normalizado con matchKey
  supplier: string // normalizado con supplierKey ("" = cualquier proveedor)
}

export type MatchStatus =
  | "alias" // la persona ya lo había confirmado para este proveedor
  | "exact" // mismo nombre y un solo candidato posible
  | "choose" // mismo nombre, varios posibles: hay que elegir
  | "other-supplier" // mismo nombre pero de otro proveedor: hay que elegir
  | "suggest" // nombre parecido: hay que confirmar
  | "none" // nada parecido: es nuevo

export interface MatchResult {
  status: MatchStatus
  match: Ingredient | null // solo cuando no hay duda
  candidates: Ingredient[] // opciones a mostrar primero, la más probable antes
}

// Palabras de ticket que no dicen qué producto es: unidades, empaques, abreviaturas.
const NOISE = new Set([
  "kg", "kgs", "g", "gr", "grs", "gramos", "kilo", "kilos", "lb", "lbs", "libra", "libras", "oz", "ml", "l", "lt", "lts", "litro", "litros",
  "und", "unid", "unidad", "unidades", "u", "un", "pz", "pza", "pzas", "pieza", "piezas", "x", "c", "u.", "paq", "pqt", "bolsa", "caja", "pack", "unit", "units", "pcs", "ea",
  "de", "del", "la", "el", "los", "las", "y", "con", "en", "of", "the", "and",
])

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Palabras que identifican el producto (sin tildes, números, unidades ni empaques). */
export function matchTokens(name: string): string[] {
  return strip(name)
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE.has(w))
}

export function matchKey(name: string): string {
  return matchTokens(name).join(" ")
}

/** Proveedor comparable; los nombres por defecto («Proveedor General», …) cuentan como ninguno. */
export function supplierKey(supplier: string | null | undefined, defaults: string[] = []): string {
  const key = strip(supplier ?? "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  if (!key) return ""
  return defaults.some((d) => strip(d).replace(/[^\p{L}\p{N}]+/gu, " ").trim() === key) ? "" : key
}

// Dos palabras se parecen si son iguales o una es abreviatura de la otra («tom» ↔ «tomate»).
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 3 && long.startsWith(short)
}

/** 0–1: qué tanto se parecen dos nombres por sus palabras. */
export function nameSimilarity(a: string, b: string): number {
  const ta = matchTokens(a)
  const tb = matchTokens(b)
  if (!ta.length || !tb.length) return 0
  const hits = ta.filter((w) => tb.some((v) => wordsMatch(w, v))).length
  const back = tb.filter((w) => ta.some((v) => wordsMatch(w, v))).length
  return (hits + back) / (ta.length + tb.length)
}

export function receiptAliases(ingredient: Ingredient): ReceiptAlias[] {
  const list = (ingredient as Ingredient & { receiptAliases?: unknown }).receiptAliases
  return Array.isArray(list) ? list.filter((a): a is ReceiptAlias => !!a && typeof a.text === "string" && typeof a.supplier === "string") : []
}

/** Guarda «este nombre del ticket es este ingrediente» para la próxima vez. */
export function withReceiptAlias(ingredient: Ingredient, rowName: string, supplier: string): Ingredient {
  const text = matchKey(rowName)
  if (!text || text === matchKey(ingredient.name)) return ingredient
  const current = receiptAliases(ingredient)
  if (current.some((a) => a.text === text && a.supplier === supplier)) return ingredient
  return { ...ingredient, receiptAliases: [...current, { text, supplier }] } as Ingredient
}

const SUGGEST_MIN = 0.5

/**
 * @param supplier proveedor del ticket ya normalizado con supplierKey ("" = no se sabe)
 */
export function matchImportRow(
  rowName: string,
  ingredients: Ingredient[],
  options: { supplier?: string; defaults?: string[] } = {},
): MatchResult {
  const supplier = options.supplier ?? ""
  const defaults = options.defaults ?? []
  const key = matchKey(rowName)
  const lower = rowName.trim().toLowerCase()
  if (!key && !lower) return { status: "none", match: null, candidates: [] }
  const supplierOf = (ing: Ingredient) => supplierKey(ing.supplier, defaults)

  // 1. Alias confirmado antes: para este proveedor, o sin proveedor si el ticket no lo dice.
  const aliased = ingredients.filter((ing) => receiptAliases(ing).some((a) => a.text === key && (a.supplier === supplier || !supplier || !a.supplier)))
  if (aliased.length === 1) return { status: "alias", match: aliased[0], candidates: aliased }

  // 2. Mismo nombre.
  const same = ingredients.filter((ing) => ing.name.trim().toLowerCase() === lower || (key && matchKey(ing.name) === key))
  if (same.length > 0) {
    const pool = supplier ? same.filter((ing) => supplierOf(ing) === supplier) : same
    if (pool.length === 1) return { status: "exact", match: pool[0], candidates: same }
    if (pool.length > 1) return { status: "choose", match: null, candidates: pool }
    // Un solo ingrediente con ese nombre y sin proveedor propio: no hay con qué confundirlo.
    if (same.length === 1 && !supplierOf(same[0])) return { status: "exact", match: same[0], candidates: same }
    return { status: "other-supplier", match: null, candidates: same }
  }

  // 3. Nombre parecido: se propone, nunca se decide solo.
  const scored = ingredients
    .map((ing) => ({ ing, score: nameSimilarity(rowName, ing.name) + (supplier && supplierOf(ing) === supplier ? 0.05 : 0) }))
    .filter((s) => s.score >= SUGGEST_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.ing)
  if (aliased.length > 1) return { status: "choose", match: null, candidates: aliased }
  return scored.length ? { status: "suggest", match: null, candidates: scored } : { status: "none", match: null, candidates: [] }
}

/**
 * Proveedor del ticket: el nombre del negocio suele estar en las primeras líneas. Primero
 * se busca uno de los proveedores que la persona ya tiene; si no, la primera línea con
 * letras que no parezca dirección, teléfono ni fecha.
 */
export function detectReceiptSupplier(text: string, known: string[]): string {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
  const knownClean = known.filter((k) => matchKey(k).length >= 3)
  for (const line of lines) {
    const lk = matchKey(line)
    if (!lk) continue
    const hit = knownClean.find((k) => {
      const kk = matchKey(k)
      return lk === kk || ` ${lk} `.includes(` ${kk} `) || nameSimilarity(line, k) >= 0.8
    })
    if (hit) return hit
  }
  const header = lines.find((l) => {
    if (/\d{3,}|@|www\.|https?:|tel|rtn|nit|ruc|cif|nif|fecha|date|factura|invoice|ticket|recibo|cliente|caja|cajero/i.test(l)) return false
    return (l.match(/\p{L}/gu) ?? []).length >= 3
  })
  return header ? header.replace(/\s+/g, " ").slice(0, 60) : ""
}

/**
 * Nombres que se repiten en una lista: en los selectores (Ficha Técnica, órdenes de compra)
 * esos ingredientes muestran su proveedor y nota para saber cuál es cuál.
 */
export function repeatedNames(list: { name: string }[]): Set<string> {
  const count = new Map<string, number>()
  for (const item of list) {
    const key = item.name.trim().toLowerCase()
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  return new Set(Array.from(count).filter(([, n]) => n > 1).map(([k]) => k))
}

/** «Proveedor · nota» de un ingrediente cuyo nombre se repite, o "" si no hace falta. */
export function distinguishLabel(ing: { name: string; supplier?: string; notes?: string }, repeated: Set<string>): string {
  if (!repeated.has(ing.name.trim().toLowerCase())) return ""
  return [ing.supplier, ing.notes].map((v) => (v || "").trim().slice(0, 40)).filter(Boolean).join(" · ")
}
