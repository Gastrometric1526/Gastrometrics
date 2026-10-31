/**
 * Cuadre de caja (pedido del dueño, docs/217): conectar las ventas con el lector de
 * tarjetas sin depender del banco. Al cerrar el día se compara lo anotado en las cuentas
 * (por forma de pago, docs/215) con lo que de verdad hay: efectivo contado, cierre de lote
 * del datáfono y transferencias recibidas.
 *
 * Fórmulas:
 *   Efectivo esperado      = Fondo inicial + Ventas en efectivo (+ propinas en efectivo, si
 *                            se quedan en la caja) − Salidas de caja
 *   Datáfono esperado      = Ventas con tarjeta (+ propinas con tarjeta, si se cobraron ahí)
 *   Transferencias esperadas = Ventas por transferencia + sus propinas
 *   Diferencia             = Real − Esperado   (positiva: sobra; negativa: falta)
 *
 * Puro, probado en cash-up.test.ts.
 */

import type { CashUp, PaymentMethod, SalesImport } from "@/types/sales-import"
import { localDayOf } from "@/lib/date-format"

const round2 = (n: number) => Math.round(n * 100) / 100
/** Menos de un centavo se considera cuadrado. */
export const CASH_UP_TOLERANCE = 0.005

export type CashUpMethod = "cash" | "card" | "transfer"

export interface CashUpRow {
  method: CashUpMethod
  /** Ventas de las cuentas con esa forma de pago (ya con descuento). */
  sales: number
  tips: number
  /** Lo que debería haber. */
  expected: number
  /** Lo que se contó o anotó; null si no se anotó. */
  actual: number | null
  /** actual − expected; null si no se anotó. */
  difference: number | null
}

export interface CashUpResult {
  rows: CashUpRow[]
  payouts: number
  openingFloat: number
  /** Cuentas sin forma de pago: pueden explicar una diferencia. */
  unassigned: { tickets: number; amount: number }
  /** Cuentas con «Otro» como forma de pago (no se cuadran contra nada). */
  other: { tickets: number; amount: number }
  /** Suma de las diferencias anotadas. */
  totalDifference: number
  status: "balanced" | "over" | "short" | "mixed" | "incomplete"
}

export function emptyCashUp(now: string, closedBy: string | null = null): CashUp {
  return {
    openingFloat: 0,
    countedCash: null,
    payouts: [],
    terminalTotal: null,
    transferTotal: null,
    cashTipsInDrawer: true,
    cardTipsInTerminal: true,
    note: null,
    closedAt: now,
    closedBy,
  }
}

/** Ventas y propinas por forma de pago de un registro con cuentas. */
export function salesByPayment(imp: SalesImport): Record<PaymentMethod | "none", { tickets: number; sales: number; tips: number }> {
  const out = {
    cash: { tickets: 0, sales: 0, tips: 0 },
    card: { tickets: 0, sales: 0, tips: 0 },
    transfer: { tickets: 0, sales: 0, tips: 0 },
    other: { tickets: 0, sales: 0, tips: 0 },
    none: { tickets: 0, sales: 0, tips: 0 },
  }
  const tickets = imp.tickets ?? []
  if (tickets.length === 0) {
    // Registro anterior a las cuentas (docs/215): todo sin forma de pago.
    const sales = imp.lines.reduce((s, l) => s + l.revenue, 0)
    if (sales > 0) out.none = { tickets: 1, sales: round2(sales), tips: 0 }
    return out
  }
  for (const tk of tickets) {
    const sales = imp.lines.filter((l) => l.ticketId === tk.id).reduce((s, l) => s + l.revenue, 0)
    const key = tk.payment ?? "none"
    out[key].tickets += 1
    out[key].sales = round2(out[key].sales + sales)
    out[key].tips = round2(out[key].tips + (tk.tip || 0))
  }
  return out
}

export function computeCashUp(imp: SalesImport, cashUp: CashUp): CashUpResult {
  const by = salesByPayment(imp)
  const payouts = round2(cashUp.payouts.reduce((s, p) => s + (p.amount || 0), 0))
  const row = (method: CashUpMethod, expected: number, actual: number | null, sales: number, tips: number): CashUpRow => ({
    method,
    sales,
    tips,
    expected: round2(expected),
    actual,
    difference: actual === null ? null : round2(actual - expected),
  })
  const cashExpected = cashUp.openingFloat + by.cash.sales + (cashUp.cashTipsInDrawer ? by.cash.tips : 0) - payouts
  const cardExpected = by.card.sales + (cashUp.cardTipsInTerminal ? by.card.tips : 0)
  const transferExpected = by.transfer.sales + by.transfer.tips
  const rows = [
    row("cash", cashExpected, cashUp.countedCash, by.cash.sales, by.cash.tips),
    row("card", cardExpected, cashUp.terminalTotal, by.card.sales, by.card.tips),
    row("transfer", transferExpected, cashUp.transferTotal, by.transfer.sales, by.transfer.tips),
  ]
  const noted = rows.filter((r) => r.difference !== null)
  const totalDifference = round2(noted.reduce((s, r) => s + (r.difference as number), 0))
  // Incompleto: falta anotar algo que según las cuentas debería existir.
  const missing = rows.some((r) => r.actual === null && Math.abs(r.expected) > CASH_UP_TOLERANCE)
  // «mixed»: el total cuadra, pero una forma de pago tiene de más y otra de menos (una
  // cuenta anotada con la forma de pago equivocada).
  const status: CashUpResult["status"] =
    noted.length === 0 || missing
      ? "incomplete"
      : totalDifference < -CASH_UP_TOLERANCE
        ? "short"
        : totalDifference > CASH_UP_TOLERANCE
          ? "over"
          : noted.some((r) => Math.abs(r.difference as number) > CASH_UP_TOLERANCE)
            ? "mixed"
            : "balanced"
  return {
    rows,
    payouts,
    openingFloat: cashUp.openingFloat,
    unassigned: { tickets: by.none.tickets, amount: by.none.sales },
    other: { tickets: by.other.tickets, amount: by.other.sales },
    totalDifference,
    status,
  }
}

// ─── Leer el total del cierre de lote del datáfono ────────────────────────────

const TOTAL_WORDS = /\b(total(es)?(\s+(general|ventas?|neto|venta|lote))?|gran\s+total|ventas?|sales?|grand\s+total|totalt|salg|montant|vendas?)\b|合计|总计|总额/i
const NEGATIVE_WORDS = /\b(anulaci[oó]n(es)?|void|devoluci[oó]n(es)?|refund|reembolso|annul|retour)\b|退款|撤销/i

/** Número de un texto de voucher: «1,234.50», «1.234,50», «L 950.00», «$12». */
export function parseAmount(raw: string): number | null {
  const m = raw.replace(/\s/g, "").match(/-?\d[\d.,]*/)
  if (!m) return null
  let s = m[0]
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma > lastDot) {
    // Coma decimal si quedan 1 o 2 dígitos después; si no, es separador de miles.
    s = s.length - lastComma - 1 <= 2 ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else {
    s = s.replace(/,/g, "")
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Total de ventas de un cierre de lote leído con OCR. Busca la línea de total (en los 6
 * idiomas) y se queda con el monto más grande de esas líneas, sin contar anulaciones ni
 * devoluciones. Si no hay línea de total, devuelve el monto más grande del texto.
 */
export function parseTerminalTotal(text: string): number | null {
  // Montos de una línea. Si alguno trae centavos, los enteros sueltos son cantidades de
  // transacciones («VENTAS 12   1,250.00») y se descartan.
  const amountsIn = (line: string) => {
    const raw = line.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g) ?? []
    const withCents = raw.filter((r) => /[.,]\d{1,2}$/.test(r))
    return (withCents.length ? withCents : raw)
      .map(parseAmount)
      .filter((n): n is number => n !== null && n > 0 && n < 10_000_000)
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const totals: number[] = []
  for (const line of lines) {
    if (!TOTAL_WORDS.test(line) || NEGATIVE_WORDS.test(line)) continue
    totals.push(...amountsIn(line))
  }
  if (totals.length) return round2(Math.max(...totals))
  const all = lines.filter((l) => !NEGATIVE_WORDS.test(l)).flatMap(amountsIn)
  return all.length ? round2(Math.max(...all)) : null
}

// ─── Resumen de cuadres ──────────────────────────────────────────────────────

export interface CashUpDay {
  importId: string
  day: string
  result: CashUpResult
}

export interface CashUpSummary {
  /** Días con cuentas en el período. */
  daysWithSales: number
  /** Días con cuadre guardado. */
  closed: number
  balanced: number
  /** Suma de faltantes (negativa) y de sobrantes (positiva). */
  shortTotal: number
  overTotal: number
  /** Días con cuentas y sin cuadre. */
  pendingDays: string[]
  /** Días cuadrados con diferencia, del más reciente al más antiguo. */
  withDifference: CashUpDay[]
}

export function summarizeCashUps(imports: SalesImport[], opts: { from?: string } = {}): CashUpSummary {
  const manual = imports.filter((imp) => imp.source === "manual" && imp.lines.length > 0)
  let daysWithSales = 0
  let closed = 0
  let balanced = 0
  let shortTotal = 0
  let overTotal = 0
  const pendingDays: string[] = []
  const withDifference: CashUpDay[] = []
  for (const imp of manual) {
    const day = localDayOf(imp.periodStart || imp.importedAt)
    if (opts.from && day < opts.from) continue
    daysWithSales += 1
    if (!imp.cashUp) {
      pendingDays.push(day)
      continue
    }
    closed += 1
    const result = computeCashUp(imp, imp.cashUp)
    if (result.status === "balanced") balanced += 1
    for (const r of result.rows) {
      if (r.difference === null) continue
      if (r.difference < -CASH_UP_TOLERANCE) shortTotal += r.difference
      if (r.difference > CASH_UP_TOLERANCE) overTotal += r.difference
    }
    if (result.status === "short" || result.status === "over" || result.status === "mixed") withDifference.push({ importId: imp.id, day, result })
  }
  return {
    daysWithSales,
    closed,
    balanced,
    shortTotal: round2(shortTotal),
    overTotal: round2(overTotal),
    pendingDays: pendingDays.sort().reverse(),
    withDifference: withDifference.sort((a, b) => b.day.localeCompare(a.day)),
  }
}
