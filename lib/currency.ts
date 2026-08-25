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
//
// BUG REAL CORREGIDO: esta lista era la única fuente de verdad que lee formatCurrency()
// (vía getCurrentCurrencyOption() más abajo, que hace CURRENCY_OPTIONS.find(...) y cae a
// CURRENCY_OPTIONS[0] — o sea HNL — si no encuentra el código guardado). Pero hay OTRAS
// dos listas de países/moneda en el código que sí pueden GUARDAR un código de moneda que
// esta lista no tenía: el selector de país de Configuración (components/settings-dialog.tsx,
// su propio array `countries`) y el de nacionalidad en el registro (lib/types/user.ts,
// `COUNTRIES`) — ambas incluyen México, Argentina, Colombia, Perú, Chile, y la segunda
// además Venezuela, Brasil, Uruguay, Paraguay, Bolivia y República Dominicana. Elegir
// cualquiera de esos países guardaba su código de moneda real en localStorage (Configuración
// incluso lo mostraba bien: "moneda seleccionada: MXN ($)"), pero CADA formatCurrency() en
// el resto de la app (ingredientes, dashboard, recetas, etc.) caía en silencio a HNL, porque
// esta lista no tenía ese código. Se completa acá para que sea un superconjunto de las otras
// dos — un usuario que ya había elegido uno de estos países ve el símbolo correcto de
// inmediato en cuanto se despliegue esto, sin tener que volver a elegir nada.
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
  { code: "MXN", name: "Peso mexicano", symbol: "$", locale: "es-MX" },
  { code: "ARS", name: "Peso argentino", symbol: "$", locale: "es-AR" },
  { code: "COP", name: "Peso colombiano", symbol: "$", locale: "es-CO" },
  { code: "PEN", name: "Sol peruano", symbol: "S/", locale: "es-PE" },
  { code: "CLP", name: "Peso chileno", symbol: "$", locale: "es-CL" },
  { code: "VES", name: "Bolívar venezolano", symbol: "Bs", locale: "es-VE" },
  { code: "BRL", name: "Real brasileño", symbol: "R$", locale: "pt-BR" },
  { code: "UYU", name: "Peso uruguayo", symbol: "$", locale: "es-UY" },
  { code: "PYG", name: "Guaraní paraguayo", symbol: "₲", locale: "es-PY" },
  { code: "BOB", name: "Boliviano", symbol: "Bs", locale: "es-BO" },
  { code: "DOP", name: "Peso dominicano", symbol: "RD$", locale: "es-DO" },
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
