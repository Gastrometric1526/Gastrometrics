/**
 * Alérgenos sugeridos (pedido del dueño, docs/324): según la categoría y el nombre del
 * ingrediente. La app SUGIERE, nunca marca sola: la persona confirma cada uno (un alérgeno mal
 * puesto es un riesgo para el cliente). Marcar alérgenos no es obligatorio, pero se recomienda.
 *
 * Tres reglas, en este orden:
 * 1. Excepciones por nombre: «harina de arroz», «sin gluten», «leche de coco»… quitan lo que la
 *    categoría sugeriría (y pueden sugerir otro: harina de almendra → frutos secos).
 * 2. Por categoría: Harina, Masa, Fideos, Repostería, Levadura → gluten; Lácteos → leche;
 *    Huevo → huevo; Pescado → pescado; Mariscos → crustáceos y moluscos; Nueces → frutos secos.
 * 3. Por palabras del nombre, en los 6 idiomas: trigo, cebada, maní, soya, ajonjolí, mostaza…
 * Las palabras se comparan sin acentos ni mayúsculas y como palabra entera (o raíz en chino).
 */

import type { AllergenKey } from "@/lib/allergens"

export type SuggestionReason = { kind: "category"; category: string } | { kind: "name"; word: string }

export interface AllergenSuggestion {
  key: AllergenKey
  reason: SuggestionReason
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()

const CATEGORY_RULES: Record<string, AllergenKey[]> = {
  HARINA: ["gluten"],
  MASA: ["gluten"],
  FIDEOS: ["gluten"],
  "REPOSTERÍA": ["gluten"],
  LEVADURA: ["gluten"],
  "LÁCTEOS Y DERIVADOS": ["milk"],
  HUEVO: ["eggs"],
  PESCADO: ["fish"],
  MARISCOS: ["crustaceans", "molluscs"],
  NUECES: ["tree_nuts"],
}

/** Palabras (ya sin acentos) que sugieren cada alérgeno, en es, en, pt, fr, da y zh. */
const NAME_RULES: [AllergenKey, string[]][] = [
  ["gluten", ["trigo", "cebada", "centeno", "avena", "espelta", "semola", "seitan", "pan", "galleta", "wheat", "barley", "rye", "oat", "oats", "spelt", "semolina", "bread", "flour", "farinha", "cevada", "centeio", "aveia", "ble", "orge", "seigle", "avoine", "farine", "hvede", "byg", "rug", "havre", "brod", "小麦", "大麦", "黑麦", "燕麦", "面粉", "面包"]],
  ["milk", ["leche", "queso", "mantequilla", "crema", "nata", "yogur", "yogurt", "suero", "milk", "cheese", "butter", "cream", "leite", "queijo", "manteiga", "creme", "lait", "fromage", "beurre", "maelk", "ost", "smor", "flode", "牛奶", "奶酪", "黄油", "奶油"]],
  ["eggs", ["huevo", "huevos", "clara", "yema", "mayonesa", "egg", "eggs", "mayonnaise", "ovo", "ovos", "oeuf", "oeufs", "aeg", "鸡蛋", "蛋"]],
  ["fish", ["atun", "salmon", "bacalao", "anchoa", "sardina", "tilapia", "pescado", "tuna", "cod", "anchovy", "sardine", "fish", "peixe", "atum", "poisson", "thon", "fisk", "鱼"]],
  ["crustaceans", ["camaron", "camarones", "langosta", "langostino", "cangrejo", "jaiba", "shrimp", "prawn", "lobster", "crab", "camarao", "lagosta", "caranguejo", "crevette", "homard", "crabe", "rejer", "hummer", "krabbe", "虾", "蟹", "龙虾"]],
  ["molluscs", ["pulpo", "calamar", "almeja", "mejillon", "ostra", "caracol", "octopus", "squid", "clam", "mussel", "oyster", "polvo", "lula", "marisco", "poulpe", "calmar", "moule", "huitre", "blaeksprutte", "musling", "鱿鱼", "章鱼", "蛤", "贝"]],
  ["peanuts", ["mani", "cacahuate", "cacahuete", "peanut", "peanuts", "amendoim", "arachide", "cacahuete", "jordnod", "花生"]],
  ["tree_nuts", ["almendra", "nuez", "nueces", "avellana", "pistacho", "maranon", "anacardo", "pecana", "almond", "walnut", "hazelnut", "pistachio", "cashew", "pecan", "amendoa", "noz", "avela", "castanha", "amande", "noix", "noisette", "mandel", "valnod", "hasselnod", "杏仁", "核桃", "榛子", "腰果", "开心果"]],
  ["soy", ["soya", "soja", "tofu", "miso", "soy", "edamame", "sojabonne", "大豆", "酱油", "豆腐"]],
  ["sesame", ["ajonjoli", "sesamo", "tahini", "sesame", "gergelim", "sesam", "芝麻"]],
  ["mustard", ["mostaza", "mustard", "mostarda", "moutarde", "sennep", "芥末"]],
  ["celery", ["apio", "celery", "aipo", "celeri", "selleri", "芹菜"]],
  ["sulphites", ["vino", "vinagre de vino", "wine", "vinho", "vin", "葡萄酒"]],
  ["lupin", ["altramuz", "lupino", "lupin", "tremoco", "lupine", "羽扇豆"]],
]

/** Nombres que quitan lo que sugeriría la categoría (y, a veces, sugieren otro). */
const EXCEPTIONS: { words: string[]; removes: AllergenKey[]; adds?: AllergenKey[] }[] = [
  {
    words: ["arroz", "maiz", "yuca", "mandioca", "tapioca", "garbanzo", "papa", "patata", "coco", "sin gluten", "gluten free", "glutenfri", "sem gluten", "sans gluten", "rice", "corn", "cassava", "chickpea", "potato", "coconut", "riz", "milho", "farine de mais", "pois chiche", "ris", "majs", "kikaerter", "米粉", "玉米", "无麸质"],
    removes: ["gluten"],
  },
  { words: ["almendra", "almond", "amendoa", "amande", "mandel", "杏仁"], removes: ["gluten"], adds: ["tree_nuts"] },
  { words: ["leche de coco", "leche de almendra", "leche de avena", "leche de soya", "coconut milk", "almond milk", "oat milk", "soy milk", "leite de coco", "lait de coco", "kokosmaelk", "椰奶"], removes: ["milk"] },
  { words: ["sin lactosa", "lactose free", "sem lactose", "sans lactose", "laktosefri"], removes: [] },
  { words: ["mantequilla de mani", "peanut butter", "manteiga de amendoim", "beurre de cacahuete"], removes: ["milk"], adds: ["peanuts"] },
]

const hasWord = (name: string, word: string) => {
  if (/[一-鿿]/.test(word)) return name.includes(word)
  return new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(name)
}

/** Alérgenos sugeridos para un ingrediente, con el porqué de cada uno. Sin repetir. */
export function suggestAllergens(ingredient: { name: string; category?: string }): AllergenSuggestion[] {
  const name = norm(ingredient.name || "")
  const category = ingredient.category || ""
  const removed = new Set<AllergenKey>()
  const out = new Map<AllergenKey, AllergenSuggestion>()
  for (const ex of EXCEPTIONS) {
    const word = ex.words.find((w) => hasWord(name, norm(w)))
    if (!word) continue
    for (const k of ex.removes) removed.add(k)
    for (const k of ex.adds ?? []) out.set(k, { key: k, reason: { kind: "name", word } })
  }
  for (const k of CATEGORY_RULES[category] ?? []) if (!removed.has(k) && !out.has(k)) out.set(k, { key: k, reason: { kind: "category", category } })
  for (const [k, words] of NAME_RULES) {
    if (removed.has(k) || out.has(k)) continue
    const word = words.find((w) => hasWord(name, norm(w)))
    if (word) out.set(k, { key: k, reason: { kind: "name", word } })
  }
  return [...out.values()]
}

/** Lo sugerido que el ingrediente todavía no tiene marcado. */
export function pendingSuggestions(ingredient: { name: string; category?: string; allergens?: string[] }): AllergenSuggestion[] {
  const have = new Set(ingredient.allergens ?? [])
  return suggestAllergens(ingredient).filter((s) => !have.has(s.key))
}
