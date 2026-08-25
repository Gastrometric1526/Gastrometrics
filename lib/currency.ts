// Módulo centralizado de moneda. Ver documento de continuidad.
//
// Antes de este archivo, existían DOS copias de `formatCurrency` (en
// lib/utils/calculations.ts y lib/utils/consolidated-utils.ts), ambas hardcodeadas a
// "HNL" (Lempira hondureña) sin importar qué moneda eligiera el usuario en
// Configuración → el selector de país/moneda guardaba la elección en localStorage,
// pero nada la leía de vuelta. Ahora ambas delegan aquí.

export interface CurrencyOption {
  code: string
  name: string
  symbol: string
  locale: string
}

// Monedas centroamericanas + China + Dinamarca, dólar y euro — deben cubrir los 6
// idiomas soportados (lib/i18n/translations.ts), no solo la región centroamericana.
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "HNL", name: "Lempira hondureña", symbol: "L", locale: "es-HN" },
  { code: "GTQ", name: "Quetzal guatemalteco", symbol: "Q", locale: "es-GT" },
  { code: "CRC", name: "Colón costarricense", symbol: "₡", locale: "es-CR" },
  { code: "NIO", name: "Córdoba nicaragüense", symbol: "C$", locale: "es-NI" },
  { code: "PAB", name: "Balboa panameño", symbol: "B/.", locale: "es-PA" },
  { code: "BZD", name: "Dólar beliceño", symbol: "BZ$", locale: "en-BZ" },
  { code: "USD", name: "Dólar estadounidense", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "es-ES" },
  { code: "CNY", name: "Yuan chino", symbol: "¥", locale: "zh-CN" },
  { code: "DKK", name: "Corona danesa", symbol: "kr", locale: "da-DK" },
]

const CURRENCY_STORAGE_KEY = "currency_code"
const CURRENCY_CHANGE_EVENT = "currencyChanged"

export function getCurrentCurrencyCode(): string {
  if (typeof window === "undefined") return "HNL"
  return localStorage.getItem(CURRENCY_STORAGE_KEY) || "HNL"
}

export function setCurrentCurrencyCode(code: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CURRENCY_STORAGE_KEY, code)
  window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: code }))
}

export function getCurrentCurrencyOption(): CurrencyOption {
  const code = getCurrentCurrencyCode()
  return CURRENCY_OPTIONS.find((c) => c.code === code) || CURRENCY_OPTIONS[0]
}

export function formatCurrency(amount: number): string {
  const option = getCurrentCurrencyOption()
  try {
    return new Intl.NumberFormat(option.locale, {
      style: "currency",
      currency: option.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Respaldo si Intl no reconoce la combinación locale/moneda en el navegador del usuario.
    return `${option.symbol}${amount.toFixed(2)}`
  }
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}
