/**
 * Ingredientes desde un ticket o factura de supermercado (docs/151). Pedido del dueño:
 * probar con tickets reales de internet — el OCR los leía bien, pero no había nada que
 * convirtiera ese texto en ingredientes con precio. Puro (cubierto por pruebas con el
 * texto real que devolvió el OCR de tickets de Italia, Polonia, Alemania y Francia).
 *
 * Cómo lee cada línea:
 *  1. Busca el precio AL FINAL de la línea, con 2 decimales ("1,37", "2.05", "4,99C",
 *     "2,99 B" — la letra final suele ser el código de impuesto).
 *  2. Lo de antes es el nombre, sin el % de IVA, sin "1 x4,99" (cantidad × precio; si
 *     está, el precio que vale es el unitario) y sin letras sueltas de impuesto.
 *  3. Descarta lo que no es producto: totales, impuestos, pagos, descuentos, datos del
 *     comercio (palabras clave en los 6 idiomas de la app y en los de tickets comunes).
 *  4. El tamaño en el nombre ("550g", "25CL", "6x330ml") da contenido y unidad; sin
 *     tamaño, el producto es 1 unidad.
 *  5. Productos pesados: "0,5484kg x 2,79/kg" antes del producto, o "0,738 kg 1,99 €/kg
 *     1,47" después de una línea con solo el nombre — en ambos casos, contenido en kg.
 *  6. Un producto repetido (dos líneas iguales) cuenta una vez.
 * Lo que no se puede leer con seguridad se deja fuera: la persona revisa la vista previa.
 */

import type { ImportedIngredientRow } from "./ingredient-import"
import { parseLocaleNumber } from "./ingredient-import"

const SKIP_WORDS = [
  // es / pt
  "total", "subtotal", "suma", "iva", "impuesto", "impuestos", "descuento", "cambio", "efectivo", "tarjeta", "pago", "pagado", "propina",
  "factura", "ticket", "nif", "cif", "rfc", "redondeo", "saldo", "recibido", "vuelto", "troco", "desconto", "dinheiro", "cartao", "imposto",
  // en
  "subtotal", "tax", "vat", "change", "cash", "card", "visa", "mastercard", "debit", "credit", "payment", "paid", "tip", "discount", "balance", "tel", "fax", "phone",
  // fr / it / de / nl / pl / da
  "tva", "tua", "ht", "ttc", "remise", "rendu", "montant", "especes", "carte", "siret", "somme",
  "totale", "importo", "pagato", "pagamento", "sconto", "contanti", "resto", "documento", "commerciale", "descrizione", "prezzo",
  "summe", "gesamt", "mwst", "ust", "rabatt", "entspricht", "rech", "uid", "kasse", "beleg",
  "totaal", "subtotaal", "btw", "korting", "betaald", "wisselgeld",
  "suma", "ptu", "rabat", "sprzedaz", "opodatkowana", "karta", "kasjer", "nip", "paragon", "reszta", "gotowka",
  "moms", "i alt", "kontant", "byttepenge",
  "nr", "numer", "iban",
]
const SKIP_CJK = ["合计", "总计", "小计", "找零", "实收", "应收", "税", "现金", "优惠", "折扣", "支付", "收款", "电话"]

const PRICE_AT_END = /(-?\d{1,4}(?:[.,]\d{3})*[.,]\d{2})\s*(?:[A-Za-z0-9*#€$]{1,2})?\s*$/
const QTY_TIMES_PRICE = /(\d+(?:[.,]\d+)?)\s*[x×X%*]\s*(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})/
const WEIGHT = /(\d+[.,]\d{1,4})\s*kg\b/i
const SIZE = /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|l|lt|ltr|ml|cl|dl|oz|lb|lbs)(?![a-z])/gi

const UNIT_OF: Record<string, [string, number]> = {
  kg: ["kilogramos", 1], kgs: ["kilogramos", 1], g: ["gramos", 1], gr: ["gramos", 1], grs: ["gramos", 1],
  l: ["litros", 1], lt: ["litros", 1], ltr: ["litros", 1], ml: ["mililitros", 1], cl: ["mililitros", 10], dl: ["mililitros", 100],
  oz: ["onzas", 1], lb: ["libras", 1], lbs: ["libras", 1],
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")

function isSkipLine(text: string): boolean {
  if (SKIP_CJK.some((w) => text.includes(w))) return true
  const words = new Set(norm(text).split(/[^a-z]+/).filter(Boolean))
  // Palabra exacta; las de 5+ letras también como inicio ("rabatou", "totale", "totaal").
  return SKIP_WORDS.some((w) =>
    w.includes(" ") ? norm(text).includes(w) : words.has(w) || (w.length >= 5 && [...words].some((x) => x.startsWith(w))),
  )
}

/** "ACQUA S.ANGELO NATUR" → "Acqua S.angelo Natur"; deja igual lo que ya trae minúsculas. */
function tidyName(name: string): string {
  const clean = name
    .replace(/\d{1,2}[.,]\d{1,2}\s*%/g, " ") // % de IVA
    .replace(/[€$|\[\]{}_()]+/g, " ")
    .replace(/\s[A-Z]\s*$/, " ") // letra suelta de impuesto al final ("C", "B")
    .replace(/^\s*\d+\s*[x×]\s+/i, "") // "2 x " al principio
    .replace(/[\s—–\-+*.,:;]+$/, "") // rayas y signos sueltos al final ("Latt ——")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (clean !== clean.toUpperCase()) return clean
  return clean.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
}

function sizeOf(name: string): { unit: string; content: number } | null {
  let last: RegExpExecArray | null = null
  for (const m of name.matchAll(SIZE)) last = m
  if (!last) return null
  const [, pack, amount, unitRaw] = last
  const def = UNIT_OF[unitRaw.toLowerCase()]
  if (!def) return null
  const content = parseLocaleNumber(amount) * def[1] * (pack ? Number(pack) : 1)
  return Number.isFinite(content) && content > 0 ? { unit: def[0], content } : null
}

function hasLetters(s: string): boolean {
  return (s.match(/\p{L}/gu) ?? []).length >= 3
}

export function parseReceiptText(text: string, options: { currency?: string } = {}): ImportedIngredientRow[] {
  const rows: ImportedIngredientRow[] = []
  const seen = new Set<string>()
  let pendingWeight: number | null = null
  let nameOnly: string | null = null

  const push = (rawName: string, price: number, weightKg: number | null) => {
    const name = tidyName(rawName)
    if (!name || !hasLetters(name) || !(price > 0)) return
    const key = norm(name)
    if (seen.has(key)) return
    seen.add(key)
    const size = weightKg ? { unit: "kilogramos", content: weightKg } : sizeOf(name)
    rows.push({ name, unit: size?.unit ?? "unidad", content: size?.content ?? 1, price, category: "", supplier: "" })
  }

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const priceMatch = line.match(PRICE_AT_END)
    const weight = line.match(WEIGHT)
    // Línea de peso: "0,5484kg x 2,79/kg" (el OCR también la lee "0,5484kg Xx E 2,7900")
    const isPerKg = /\/\s*k/i.test(line) || /\bx\b/i.test(line) || /^\s*\d+[.,]\d+\s*kg\b/i.test(line)

    if (weight && isPerKg) {
      // Línea de peso: con total al final (y un nombre justo antes) es el producto anterior;
      // sin total, es el peso del producto que viene en la línea siguiente.
      const perKgAt = line.toLowerCase().lastIndexOf("/k")
      const total = perKgAt >= 0 ? line.slice(perKgAt + 2).match(PRICE_AT_END) : null
      if (total && nameOnly) {
        push(nameOnly, parseLocaleNumber(total[1], options.currency), parseLocaleNumber(weight[1]))
        nameOnly = null
      } else {
        pendingWeight = parseLocaleNumber(weight[1])
      }
      continue
    }

    if (!priceMatch) {
      // Posible nombre de un producto pesado cuyo precio viene en la línea siguiente.
      nameOnly = hasLetters(line) && !isSkipLine(line) && !/\d{3,}/.test(line) ? line : null
      continue
    }
    nameOnly = null
    if (isSkipLine(line)) {
      pendingWeight = null
      continue
    }
    let price = parseLocaleNumber(priceMatch[1], options.currency)
    let name = line.slice(0, priceMatch.index).trim()
    const qty = name.match(QTY_TIMES_PRICE) ?? line.match(QTY_TIMES_PRICE)
    if (qty) {
      price = parseLocaleNumber(qty[2], options.currency) // precio unitario
      name = name.slice(0, name.indexOf(qty[0]) >= 0 ? name.indexOf(qty[0]) : name.length)
    }
    if (price <= 0) continue // descuentos y devoluciones
    push(name, price, pendingWeight)
    pendingWeight = null
  }
  return rows
}
