import { getCurrentCurrencyCode } from "@/lib/currency"

// Redondeo del precio de venta sugerido según la moneda (docs/136).
//
// Antes era siempre "hacia el 5 más alto" (roundToNearestFive): correcto en lempiras,
// pero en dólares o euros convertía un trago de $10.60 en $15 (+41%) y un plato de
// $12.20 en $15. Ahora cada moneda redondea hacia arriba al escalón con el que de
// verdad se escriben los precios de carta en ese país. La regla de negocio se mantiene:
// un solo redondeo, en el precio de venta unitario, siempre hacia arriba. En HNL el
// escalón sigue siendo 5, así que nada cambia para las cuentas en lempiras.
export const PRICE_ROUNDING_STEP_BY_CURRENCY: Record<string, number> = {
  HNL: 5,
  GTQ: 5,
  CRC: 100,
  NIO: 5,
  PAB: 0.5,
  BZD: 0.5,
  USD: 0.5,
  EUR: 0.5,
  CNY: 1,
  DKK: 5,
  MXN: 5,
  ARS: 100,
  COP: 500,
  PEN: 0.5,
  CLP: 100,
  VES: 1,
  BRL: 0.5,
  UYU: 5,
  PYG: 1000,
  BOB: 1,
  DOP: 5,
}

const FALLBACK_STEP = 1

export function getPriceRoundingStep(currencyCode: string): number {
  return PRICE_ROUNDING_STEP_BY_CURRENCY[currencyCode] ?? FALLBACK_STEP
}

export function roundUpToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!(step > 0)) return value
  // El épsilon evita que 10.5 / 0.5 = 21.000000000000004 suba un escalón de más.
  const rounded = Math.ceil(value / step - 1e-9) * step
  return Math.round(rounded * 100) / 100
}

export function roundSalePrice(value: number, currencyCode: string = getCurrentCurrencyCode()): number {
  return roundUpToStep(value, getPriceRoundingStep(currencyCode))
}
