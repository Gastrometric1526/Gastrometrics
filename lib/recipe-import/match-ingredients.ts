/**
 * Coincidencia de ingredientes importados con la base del usuario y conversión de
 * cantidades a la unidad de cada ingrediente (docs/145). Puro.
 *
 * El precio de un ingrediente está por su unidad (pricePerUnit por gramo, kilo, litro…),
 * así que "200 g de harina" contra una harina en kilogramos tiene que quedar 0.2.
 * Entre masa y volumen no se convierte (no sabemos la densidad): queda para revisar.
 */

import type { Ingredient, Unit } from "@/types/ingredient"
import { stripAccents, type Dimension, type ParsedIngredient } from "./parse-recipe"

const UNIT_BASE: Record<Unit, { dimension: Dimension; factor: number }> = {
  gramos: { dimension: "mass", factor: 1 },
  kilogramos: { dimension: "mass", factor: 1000 },
  onzas: { dimension: "mass", factor: 28.3495 },
  libras: { dimension: "mass", factor: 453.592 },
  mililitros: { dimension: "volume", factor: 1 },
  litros: { dimension: "volume", factor: 1000 },
  "onzas líquidas": { dimension: "volume", factor: 29.5735 },
  galones: { dimension: "volume", factor: 3785.41 },
  unidad: { dimension: "count", factor: 1 },
}

/** Cantidad en la unidad del ingrediente; null si no se puede convertir. */
export function convertToUnit(parsed: Pick<ParsedIngredient, "baseAmount" | "dimension">, unit: Unit): number | null {
  const target = UNIT_BASE[unit]
  if (!target || parsed.baseAmount === null || parsed.dimension !== target.dimension) return null
  return Math.round((parsed.baseAmount / target.factor) * 10000) / 10000
}

/** Unidad para un ingrediente nuevo creado desde la importación. */
export function defaultUnitFor(dimension: Dimension | null): Unit {
  return dimension === "mass" ? "kilogramos" : dimension === "volume" ? "litros" : "unidad"
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "y", "en", "a", "con", "of", "the", "and", "fresh", "fresco", "fresca", "picado", "picada", "rallado", "rallada", "molido", "molida", "entero", "entera", "grande", "pequeno", "mediano"])

export function normalizeName(value: string): string {
  // ø/æ/œ/ß no se descomponen con NFD: sin esto "løg" quedaba en "l g" (docs/148).
  return stripAccents(value.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ß/g, "ss"))
    .replace(/[^a-z0-9一-鿿 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .filter((w) => !STOP.has(w))
    .join(" ")
}

/**
 * El ingrediente de la base que mejor coincide con el nombre importado, o null.
 *
 * Respeta la palabra principal: en español, portugués y francés va primero ("fideo de
 * huevo" es un fideo, no un huevo); en inglés y danés va al final ("olive oil" es un
 * aceite). Una coincidencia que solo comparte una palabra secundaria no cuenta — mejor
 * proponer "crear nuevo" que costear con el ingrediente equivocado.
 */
export function findBestMatch(name: string, ingredients: Ingredient[], language: string = "es"): Ingredient | null {
  const top = rankMatches(name, ingredients, language, 1)[0]
  return top && top.score >= 0.6 ? top.ingredient : null
}

/**
 * Los ingredientes de la base más parecidos al nombre importado, de más a menos (docs/348):
 * la lista plegable de Importar receta los muestra arriba como «Sugeridos» para elegir rápido.
 * Mismo puntaje que `findBestMatch` (que toma el primero si llega a 0.6); aquí también entran
 * los parecidos más flojos (desde `minScore`) y los que contienen la palabra.
 */
export function rankMatches(
  name: string,
  ingredients: Ingredient[],
  language: string = "es",
  limit = 5,
  minScore = 0.3,
): { ingredient: Ingredient; score: number }[] {
  // «tomates» queda «tomat» y «tomate» queda igual: sin la «e» final se emparejan (docs/348).
  const stem = (v: string) => v.split(" ").map((w) => (w.length > 4 && w.endsWith("e") ? w.slice(0, -1) : w)).join(" ")
  const target = stem(normalizeName(name))
  if (!target) return []
  const headLast = language === "en" || language === "da"
  const isChinese = /[一-鿿]/.test(target)
  const targetWords = target.split(" ")
  const targetSet = new Set(targetWords)
  const startsWith = (a: string, b: string) => a === b || a.startsWith(`${b} `)
  const endsWith = (a: string, b: string) => a === b || a.endsWith(` ${b}`)
  const out: { ingredient: Ingredient; score: number }[] = []
  for (const ing of ingredients) {
    const candidate = stem(normalizeName(ing.name))
    if (!candidate) continue
    let score = 0
    if (candidate === target) score = 1
    else if (isChinese) {
      // Chino: sin espacios y el núcleo va al final ("红洋葱" es un 洋葱).
      const [short, long] = candidate.length <= target.length ? [candidate, target] : [target, candidate]
      score = short.length >= 2 && long.endsWith(short) ? 0.85 : long.includes(short) && short.length >= 2 ? 0.4 : 0
    } else if (headLast ? endsWith(candidate, target) || endsWith(target, candidate) : startsWith(candidate, target) || startsWith(target, candidate)) score = 0.85
    else {
      const words = candidate.split(" ")
      const sameHead = headLast ? words[words.length - 1] === targetWords[targetWords.length - 1] : words[0] === targetWords[0]
      const overlap = words.filter((w) => targetSet.has(w)).length / Math.max(words.length, targetSet.size)
      score = sameHead ? overlap : Math.min(overlap, 0.5)
      // Comparte el comienzo de una palabra ("tomat" / "tomate cherry"): parecido flojo.
      if (score === 0 && targetWords.some((w) => w.length >= 4 && words.some((c) => c.startsWith(w.slice(0, 4))))) score = 0.3
    }
    if (score >= minScore) out.push({ ingredient: ing, score })
  }
  return out.sort((a, b) => b.score - a.score || a.ingredient.name.localeCompare(b.ingredient.name)).slice(0, limit)
}
