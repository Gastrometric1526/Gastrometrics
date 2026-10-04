/**
 * Importar recetas desde texto (docs/145) — pedido del dueño: que el usuario pueda pegar
 * (o subir, o fotografiar con OCR) una receta tal como la tiene escrita, en los formatos
 * comunes en que la gente escribe recetas, y que se convierta en una ficha técnica.
 *
 * Formatos que reconoce (cada uno cubierto en parse-recipe.test.ts):
 *  1. Título + "Ingredientes:" + lista + "Preparación:" + pasos numerados
 *  2. Cantidad primero: "200 g de harina", "2 tazas de leche"
 *  3. Nombre primero con dos puntos: "Harina: 200 g"
 *  4. Nombre primero con guion o puntos: "Harina - 200 g", "Harina ....... 200 g"
 *  5. Nombre y cantidad al final: "Harina 200 g"
 *  6. Unidad pegada al número: "200g", "1kg", "250ml"
 *  7. Fracciones: "1/2 taza", "1 1/2 tazas", "½ taza", "¾ kg"
 *  8. Decimales con coma o punto: "0,5 kg", "1.5 l"
 *  9. Rangos: "2-3 dientes de ajo", "2 a 3" (se toma el mayor: las cantidades redondean hacia arriba)
 * 10. Números en palabras: "una taza", "dos huevos", "media cebolla", "a pinch", "one cup"
 * 11. "Al gusto", "c/n", "cantidad necesaria", "pizca", "to taste" (cantidad 0, queda la nota)
 * 12. Paréntesis: "1 lata (400 g) de tomate" (el paréntesis queda como nota)
 * 13. Tabla con | o tabulaciones: "Harina | 200 | g"
 * 14. CSV: "Harina,200,g" / "Harina;200;g"
 * 15. Viñetas: "-", "*", "•", "·", "–", "▪", "✓"
 * 16. Pasos "1.", "1)", "Paso 1:", "Step 1:", o párrafos sin número
 * 17. Sub-secciones de ingredientes: "Para la salsa:", "For the dough:"
 * 18. Rendimiento: "Rinde: 4 porciones", "Porciones: 6", "Serves 4", "Yield: 12", "Para 8 personas"
 * 19. Encabezados en los 6 idiomas (es, en, pt, fr, da, zh) y abreviaturas de unidad comunes
 *     (cda, cdta, tz, tbsp, tsp, oz, lb, cc, und, pza…)
 * 20. Sin encabezados: las líneas con cantidad son ingredientes y las frases largas, pasos
 * 21. Notas/consejos: "Notas:", "Tips:", "Observaciones:"
 *
 * Es puro (sin red ni almacenamiento). La conversión a la unidad de cada ingrediente de la
 * base y la coincidencia de nombres están en match-ingredients.ts.
 */

export type Dimension = "mass" | "volume" | "count"

export interface ParsedIngredient {
  raw: string
  name: string
  quantity: number // 0 = "al gusto"/sin cantidad
  unitLabel: string // como venía escrita ("tazas", "g"…), vacío si no había
  dimension: Dimension | null // null: no se reconoció la unidad
  baseAmount: number | null // en g, ml o unidades; null si no se puede convertir
  note: string
  section: string // sub-sección ("Para la salsa"), vacío si no hay
}

export interface ParsedRecipe {
  name: string
  servings: number | null
  yieldAmount: number | null
  yieldUnitHint: "porciones" | "unidades" | null
  ingredients: ParsedIngredient[]
  procedure: string[]
  notes: string[]
}

// ─── Unidades ───

interface UnitDef {
  dimension: Dimension
  factor: number // a g, ml o unidades
}

const U = (dimension: Dimension, factor: number): UnitDef => ({ dimension, factor })

// Claves en minúsculas y sin tildes. Las de varias palabras se buscan primero.
const UNIT_ALIASES: Record<string, UnitDef> = {
  // masa
  mg: U("mass", 0.001),
  g: U("mass", 1), gr: U("mass", 1), grs: U("mass", 1), gramo: U("mass", 1), gramos: U("mass", 1), gram: U("mass", 1), grams: U("mass", 1),
  gramme: U("mass", 1), grammes: U("mass", 1), grama: U("mass", 1), gramas: U("mass", 1),
  kg: U("mass", 1000), kgs: U("mass", 1000), kilo: U("mass", 1000), kilos: U("mass", 1000), kilogramo: U("mass", 1000), kilogramos: U("mass", 1000),
  kilogram: U("mass", 1000), kilograms: U("mass", 1000), kilogramme: U("mass", 1000), quilo: U("mass", 1000), quilos: U("mass", 1000),
  oz: U("mass", 28.3495), onza: U("mass", 28.3495), onzas: U("mass", 28.3495), ounce: U("mass", 28.3495), ounces: U("mass", 28.3495),
  lb: U("mass", 453.592), lbs: U("mass", 453.592), libra: U("mass", 453.592), libras: U("mass", 453.592), pound: U("mass", 453.592), pounds: U("mass", 453.592),
  // volumen
  ml: U("volume", 1), mililitro: U("volume", 1), mililitros: U("volume", 1), milliliter: U("volume", 1), milliliters: U("volume", 1),
  millilitre: U("volume", 1), millilitres: U("volume", 1), cc: U("volume", 1), cm3: U("volume", 1),
  cl: U("volume", 10), dl: U("volume", 100),
  l: U("volume", 1000), lt: U("volume", 1000), lts: U("volume", 1000), litro: U("volume", 1000), litros: U("volume", 1000),
  liter: U("volume", 1000), liters: U("volume", 1000), litre: U("volume", 1000), litres: U("volume", 1000),
  taza: U("volume", 240), tazas: U("volume", 240), tz: U("volume", 240), cup: U("volume", 240), cups: U("volume", 240),
  tasse: U("volume", 240), tasses: U("volume", 240), xicara: U("volume", 240), xicaras: U("volume", 240), kop: U("volume", 240), kopper: U("volume", 240),
  cda: U("volume", 15), cdas: U("volume", 15), cucharada: U("volume", 15), cucharadas: U("volume", 15), tbsp: U("volume", 15), tbs: U("volume", 15),
  tablespoon: U("volume", 15), tablespoons: U("volume", 15), spsk: U("volume", 15), cs: U("volume", 15),
  cdta: U("volume", 5), cdtas: U("volume", 5), cdita: U("volume", 5), cditas: U("volume", 5), cucharadita: U("volume", 5), cucharaditas: U("volume", 5),
  tsp: U("volume", 5), teaspoon: U("volume", 5), teaspoons: U("volume", 5), tsk: U("volume", 5),
  gal: U("volume", 3785.41), galon: U("volume", 3785.41), galones: U("volume", 3785.41), gallon: U("volume", 3785.41), gallons: U("volume", 3785.41),
  // unidades contables
  unidad: U("count", 1), unidades: U("count", 1), und: U("count", 1), unds: U("count", 1), u: U("count", 1), ud: U("count", 1), uds: U("count", 1),
  pza: U("count", 1), pzas: U("count", 1), pieza: U("count", 1), piezas: U("count", 1), pc: U("count", 1), pcs: U("count", 1),
  piece: U("count", 1), pieces: U("count", 1), unit: U("count", 1), units: U("count", 1), stk: U("count", 1), unite: U("count", 1), unites: U("count", 1),
  unidade: U("count", 1),
  diente: U("count", 1), dientes: U("count", 1), clove: U("count", 1), cloves: U("count", 1), hoja: U("count", 1), hojas: U("count", 1),
  rama: U("count", 1), ramas: U("count", 1), lata: U("count", 1), latas: U("count", 1), can: U("count", 1), cans: U("count", 1),
  sobre: U("count", 1), sobres: U("count", 1), paquete: U("count", 1), paquetes: U("count", 1), atado: U("count", 1), manojo: U("count", 1),
  // chino
  "克": U("mass", 1), "千克": U("mass", 1000), "公斤": U("mass", 1000), "毫升": U("volume", 1), "升": U("volume", 1000),
  "个": U("count", 1), "汤匙": U("volume", 15), "茶匙": U("volume", 5), "杯": U("volume", 240),
}

const MULTIWORD_UNITS: [RegExp, UnitDef][] = [
  [/^onzas? liquidas?\b/, U("volume", 29.5735)],
  [/^fl\.? ?oz\b/, U("volume", 29.5735)],
  [/^fluid ounces?\b/, U("volume", 29.5735)],
  [/^c\.? ?(de )?sopa\b/, U("volume", 15)],
  [/^c\.? ?(de )?cafe\b/, U("volume", 5)],
  [/^colher(es)? de sopa\b/, U("volume", 15)],
  [/^colher(es)? de cha\b/, U("volume", 5)],
  [/^cuilleres? a soupe\b/, U("volume", 15)],
  [/^cuilleres? a cafe\b/, U("volume", 5)],
]

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, docena: 12,
  media: 0.5, medio: 0.5, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, half: 0.5, a: 1, an: 1,
  um: 1, uma: 1, dois: 2, duas: 2, une: 1, deux: 2, trois: 3, quatre: 4, en: 1, et: 1, to: 2,
}

const TO_TASTE = /\b(al gusto|a gusto|c\/n|cn|cantidad necesaria|lo necesario|pizca|una pizca|to taste|as needed|a pinch|pinch|q\.?b\.?|a gosto|selon le gout|une pincee|efter smag|适量|少许)\b/i

const FRACTIONS: Record<string, string> = { "½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8", "⅕": " 1/5" }

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function normalizeLine(line: string): string {
  let out = line
  for (const [f, rep] of Object.entries(FRACTIONS)) out = out.split(f).join(rep)
  return out.replace(/ /g, " ").replace(/\s+/g, " ").trim()
}

// Incluye las viñetas que el OCR suele leer como letra suelta ("e 800 g", "o 2 tazas",
// "« 1 cebolla"): solo si justo después viene una cantidad, para no comerse palabras.
const BULLET = /^\s*(?:[-*•·–—▪●○✓□✔➤>]+|\(?[a-z]\)|\d+[.)](?=\s)|[eoc°«»+®©¢](?=\s+(?:\d|½|¼|¾)))\s*/i

function stripBullet(line: string): string {
  return line.replace(BULLET, "").trim()
}

// ─── Cantidad y unidad ───

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)`
const RANGE = String.raw`${NUM}(?:\s*(?:-|–|a|to|ou|eller|à)\s*${NUM})?`

function parseNumber(token: string): number {
  const t = token.trim()
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = t.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  return Number(t.replace(",", "."))
}

function parseQuantity(token: string): number {
  const parts = token.split(/\s*(?:-|–|\ba\b|\bto\b|\bou\b|\beller\b|à)\s*/).filter(Boolean)
  const values = parts.map(parseNumber).filter((n) => Number.isFinite(n))
  return values.length ? Math.max(...values) : NaN
}

/** Intenta leer una unidad al inicio de `rest`. Devuelve la unidad y lo que sigue. */
function readUnit(rest: string): { unit: UnitDef | null; label: string; rest: string } {
  const plain = stripAccents(rest.toLowerCase())
  for (const [re, def] of MULTIWORD_UNITS) {
    const m = plain.match(re)
    if (m) return { unit: def, label: rest.slice(0, m[0].length), rest: rest.slice(m[0].length).trim() }
  }
  // Chino: la unidad va pegada sin espacio
  for (const zh of ["千克", "公斤", "毫升", "汤匙", "茶匙", "克", "升", "个", "杯"]) {
    if (rest.startsWith(zh)) return { unit: UNIT_ALIASES[zh], label: zh, rest: rest.slice(zh.length).trim() }
  }
  const m = plain.match(/^([a-z0-9]+)\.?(?=[\s,(]|$)/)
  if (m) {
    const key = m[1]
    const def = UNIT_ALIASES[key]
    // "a"/"to" son palabras, no unidades; "u" solo vale si va sola.
    if (def) return { unit: def, label: rest.slice(0, m[0].length), rest: rest.slice(m[0].length).trim() }
  }
  return { unit: null, label: "", rest }
}

const LINKING = /^(?:de la|de los|de las|de l'|d'|del|de|of|du|des|da|do|das|dos|af)\s+/i

function cleanName(name: string): string {
  return name.replace(LINKING, "").replace(/^[,;:\s]+|[,;:\s]+$/g, "").trim()
}

function extractParens(text: string): { text: string; note: string } {
  const notes: string[] = []
  const out = text.replace(/\(([^)]*)\)/g, (_, inner) => {
    notes.push(String(inner).trim())
    return " "
  })
  return { text: out.replace(/\s+/g, " ").trim(), note: notes.join("; ") }
}

function build(raw: string, name: string, quantity: number, unit: UnitDef | null, unitLabel: string, note: string, section: string): ParsedIngredient {
  const q = Number.isFinite(quantity) ? quantity : 0
  const dimension = unit?.dimension ?? (unitLabel ? null : q > 0 ? "count" : null)
  const factor = unit?.factor ?? (dimension === "count" ? 1 : null)
  return {
    raw,
    name: cleanName(name),
    quantity: q,
    unitLabel: unitLabel.trim(),
    dimension,
    baseAmount: factor !== null && q > 0 ? q * factor : null,
    note: note.trim(),
    section,
  }
}

/** Una línea de ingrediente → cantidad, unidad y nombre. null si no parece un ingrediente. */
export function parseIngredientLine(rawLine: string, section = ""): ParsedIngredient | null {
  const line = normalizeLine(stripBullet(rawLine))
  if (!line) return null
  const toTaste = TO_TASTE.test(line)

  // Tabla (|, tabulaciones) o CSV (, ;) con una celda numérica
  const cells = line.includes("|") || rawLine.includes("\t") ? line.split(/\s*[|\t]\s*/) : /^[^\d,;][^,;]*[,;]\s*\d/.test(line) ? line.split(/\s*[,;]\s*/) : null
  if (cells && cells.filter(Boolean).length >= 2) {
    const clean = cells.map((c) => c.trim()).filter(Boolean)
    const qIdx = clean.findIndex((c) => new RegExp(`^${RANGE}$`).test(c) || new RegExp(`^${NUM}\\s*[^\\d\\s]\\S*$`).test(c))
    if (qIdx >= 0) {
      let qtyText = clean[qIdx]
      let unitText = ""
      const attached = qtyText.match(new RegExp(`^(${RANGE})\\s*([^\\d\\s].*)$`))
      if (attached) {
        qtyText = attached[1]
        unitText = attached[2]
      } else if (clean[qIdx + 1] && readUnit(clean[qIdx + 1]).unit) {
        unitText = clean[qIdx + 1]
      }
      const nameCell = clean.find((c, i) => i !== qIdx && c !== unitText && !/^\d/.test(c)) ?? ""
      const u = readUnit(unitText)
      return build(rawLine, nameCell, parseQuantity(qtyText), u.unit, u.unit ? u.label : unitText, "", section)
    }
  }

  const { text, note: parenNote } = extractParens(line)

  // Nombre primero con separador: "Harina: 200 g", "Harina - 200 g", "Harina ..... 200 g"
  const sep = text.match(new RegExp(`^(.+?)\\s*(?::|\\.{2,}|\\s[-–]\\s)\\s*(${RANGE}.*)$`))
  if (sep && !new RegExp(`^${NUM}`).test(sep[1])) {
    const after = sep[2]
    const q = after.match(new RegExp(`^(${RANGE})\\s*(.*)$`))
    if (q) {
      const u = readUnit(q[2])
      return build(rawLine, sep[1], parseQuantity(q[1]), u.unit, u.label, [u.rest, parenNote].filter(Boolean).join("; "), section)
    }
  }

  // Cantidad primero (número o palabra)
  const lead = text.match(new RegExp(`^(${RANGE})\\s*(.*)$`))
  if (lead) {
    const u = readUnit(lead[2])
    return build(rawLine, u.rest, parseQuantity(lead[1]), u.unit, u.label, parenNote, section)
  }
  const word = stripAccents(text.toLowerCase()).match(/^([a-z]+)\s+(.*)$/)
  if (word && WORD_NUMBERS[word[1]] !== undefined && !toTaste) {
    const rest = text.slice(word[1].length).trim()
    const u = readUnit(rest)
    // "a" / "an" solo cuentan como 1 si de verdad hay algo después
    if (u.rest || u.unit) return build(rawLine, u.rest, WORD_NUMBERS[word[1]], u.unit, u.label, parenNote, section)
  }

  // Nombre y cantidad al final: "Harina 200 g"
  const tail = text.match(new RegExp(`^(.+?)\\s+(${RANGE})\\s*([^\\d\\s]*)$`))
  if (tail) {
    const u = readUnit(tail[3])
    if (u.unit || !tail[3]) return build(rawLine, tail[1], parseQuantity(tail[2]), u.unit, u.label, parenNote, section)
  }

  // Sin cantidad: "Sal al gusto", "Perejil picado"
  if (toTaste || text.split(" ").length <= 6) {
    const name = text.replace(TO_TASTE, "").replace(/\s+/g, " ").trim()
    return build(rawLine, name, 0, null, "", [toTaste ? (line.match(TO_TASTE)?.[0] ?? "") : "", parenNote].filter(Boolean).join("; "), section)
  }
  return null
}

// ─── Receta completa ───

const H_INGREDIENTS = /^(ingredientes?|ingredients?|ingr[eé]dients?|ingredienser|配料|原料|食材|用料)\b/i
const H_STEPS = /^(preparaci[oó]n|procedimiento|elaboraci[oó]n|instrucciones|pasos|modo de (preparo|fazer|preparaci[oó]n)|preparo|m[eé]todo|method|directions|instructions|steps|preparation|pr[eé]paration|[ée]tapes|fremgangsm[aå]de|tilberedning|做法|步骤|制作方法|制作)\b/i
const H_NOTES = /^(notas?|tips?|consejos|observaciones|notes?|astuces|dicas|observa[cç][oõ]es|bem[æa]rk|noter|备注|小贴士)\b/i
const YIELD = /(rinde|rendimiento|porciones|raciones|sirve|serves|servings|yield|makes|portions?|personas|pax|udbytte|portioner|rendement|rende|por[cç][oõ]es|pessoas|份|人份)/i
const TITLE_PREFIX = /^(receta|nombre|t[ií]tulo|recipe|title|recette|receita|opskrift|菜名|名称)\s*:\s*/i

function headerOf(line: string): "ingredients" | "steps" | "notes" | null {
  const plain = line.replace(/[:：\-–=#*_]+\s*$/, "").replace(/^[#*_\s]+/, "").trim()
  if (plain.length > 40) return null
  if (H_INGREDIENTS.test(plain)) return "ingredients"
  if (H_STEPS.test(plain)) return "steps"
  if (H_NOTES.test(plain)) return "notes"
  return null
}

function parseYield(line: string): { amount: number; hint: "porciones" | "unidades" } | null {
  if (!YIELD.test(line) || line.length > 60) return null
  const n = line.match(/(\d+(?:[.,]\d+)?)/)
  if (!n) return null
  const amount = Number(n[1].replace(",", "."))
  const hint = /(unidades|units|pieces|piezas|galletas|cookies|pcs)/i.test(line) ? "unidades" : "porciones"
  return { amount, hint }
}

function looksLikeIngredient(line: string): boolean {
  const l = normalizeLine(stripBullet(line))
  if (!l || l.length > 90) return false
  if (new RegExp(`^${RANGE}`).test(l)) return true
  if (TO_TASTE.test(l)) return true
  if (/[|\t]/.test(line) || /^[^\d,;][^,;]*[,;]\s*\d/.test(l)) return true
  if (new RegExp(`^.+?\\s*(?::|\\.{2,}|\\s[-–]\\s)\\s*${NUM}`).test(l)) return true
  const word = stripAccents(l.toLowerCase()).match(/^([a-z]+)\s/)
  return !!word && WORD_NUMBERS[word[1]] !== undefined && word[1].length > 2 && l.split(" ").length <= 8
}

function stepText(line: string): string {
  return line
    .replace(/^\s*(?:paso|step|etapa|[ée]tape|trin|步骤)\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\s*\d+\s*[.)-]\s+/, "")
    .replace(BULLET, "")
    .trim()
}

export function parseRecipeText(input: string): ParsedRecipe {
  const lines = input.replace(/\r/g, "").split("\n")
  const recipe: ParsedRecipe = { name: "", servings: null, yieldAmount: null, yieldUnitHint: null, ingredients: [], procedure: [], notes: [] }
  let mode: "start" | "ingredients" | "steps" | "notes" = "start"
  let section = ""
  let sawHeaders = false

  for (const original of lines) {
    const line = normalizeLine(original)
    if (!line) continue

    const titled = line.match(TITLE_PREFIX)
    if (titled && !recipe.name) {
      recipe.name = line.slice(titled[0].length).trim()
      continue
    }

    // Encabezado, con o sin contenido en la misma línea ("Ingredientes: harina, …")
    const head = headerOf(line.split(/[:：]/)[0] + (line.includes(":") || line.includes("：") ? ":" : ""))
    if (head) {
      sawHeaders = true
      mode = head
      section = ""
      const inline = line.split(/[:：]/).slice(1).join(":").trim()
      if (inline && head === "steps") recipe.procedure.push(stepText(inline))
      if (inline && head === "notes") recipe.notes.push(inline)
      if (inline && head === "ingredients") {
        for (const part of inline.split(/\s*[,;]\s*(?=\D)/)) {
          const ing = parseIngredientLine(part, section)
          if (ing?.name) recipe.ingredients.push(ing)
        }
      }
      continue
    }

    const y = parseYield(line)
    if (y && recipe.yieldAmount === null) {
      recipe.yieldAmount = y.amount
      recipe.yieldUnitHint = y.hint
      if (y.hint === "porciones") recipe.servings = y.amount
      continue
    }

    if (mode === "start") {
      if (!recipe.name && !looksLikeIngredient(line) && line.length <= 80) {
        recipe.name = line.replace(/^[#*_\s]+|[#*_\s]+$/g, "")
        continue
      }
      mode = looksLikeIngredient(line) ? "ingredients" : "steps"
    }

    if (mode === "ingredients") {
      // Sub-sección: "Para la salsa:" / "For the dough:"
      if (/[:：]$/.test(line) && line.length <= 50 && !new RegExp(NUM).test(line)) {
        section = line.replace(/[:：]$/, "").trim()
        continue
      }
      // Sin encabezados: una frase larga después de los ingredientes ya es un paso
      if (!sawHeaders && !looksLikeIngredient(line) && line.split(" ").length > 6) {
        mode = "steps"
      } else {
        const ing = parseIngredientLine(original, section)
        if (ing?.name) recipe.ingredients.push(ing)
        else if (ing === null) recipe.procedure.push(stepText(line))
        continue
      }
    }

    if (mode === "steps") {
      const text = stepText(line)
      if (text) recipe.procedure.push(text)
      continue
    }

    if (mode === "notes") recipe.notes.push(stripBullet(line))
  }

  if (!recipe.name) recipe.name = recipe.ingredients[0] ? "" : ""
  return recipe
}
