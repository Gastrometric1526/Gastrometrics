/**
 * Conteo de inventario desde una foto, PDF o Excel (docs/152). Pedido del dueño: "lo de
 * OCR también es para inventarios". Cada línea de la hoja de conteo ("Harina 25 kg",
 * "Harina | 25 | kg", "25 kg harina", "Aceite de oliva ..... 3") se empareja con un
 * ingrediente de la base y la cantidad se convierte a la unidad de ese ingrediente. Puro.
 */

import type { Ingredient } from "@/types/ingredient"
import { parseIngredientLine } from "@/lib/recipe-import/parse-recipe"
import { convertToUnit, findBestMatch } from "@/lib/recipe-import/match-ingredients"

export interface CountMatch {
  ingredientId: string
  ingredientName: string
  line: string
  quantity: number // en la unidad del ingrediente
}

export interface CountResult {
  matched: CountMatch[]
  unmatched: string[] // líneas con cantidad que no se pudieron emparejar
}

const SKIP = /^(total|subtotal|fecha|date|dato|responsable|firma|signature|hoja|page|inventario|inventory|conteo|count|lager|estoque|库存)\b/i

export function matchCountLines(text: string, ingredients: Ingredient[], language = "es"): CountResult {
  const matched: CountMatch[] = []
  const unmatched: string[] = []
  const seen = new Set<string>()
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim()
    if (!line || !/\d/.test(line) || !/\p{L}{2}/u.test(line) || SKIP.test(line)) continue
    const parsed = parseIngredientLine(line)
    if (!parsed || !parsed.name || !(parsed.quantity > 0)) continue
    const ing = findBestMatch(parsed.name, ingredients, language)
    if (!ing) {
      unmatched.push(line)
      continue
    }
    if (seen.has(ing.id)) continue
    seen.add(ing.id)
    // Con unidad ("25 kg") se convierte; sin unidad ("Harina 25") se toma en la unidad del ingrediente.
    const converted = parsed.unitLabel ? convertToUnit({ dimension: parsed.dimension, baseAmount: parsed.baseAmount }, ing.unit) : null
    matched.push({ ingredientId: ing.id, ingredientName: ing.name, line, quantity: converted ?? parsed.quantity })
  }
  return { matched, unmatched }
}

/** Filas de una hoja de cálculo → líneas "Harina | 25 | kg" para matchCountLines. */
export function sheetRowsToLines(rows: unknown[][]): string {
  return rows
    .map((r) => r.map((c) => String(c ?? "").trim()).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n")
}
