/**
 * Formato de fechas de TODO el proyecto (docs/170). Decisión del dueño: siempre
 * día/mes/año, en la app, /admin, los PDF y los correos, sin importar el idioma
 * (antes cada pantalla usaba el formato del idioma: en inglés salía mes/día/año y en
 * chino año/mes/día).
 *
 * - formatDate      → 20/10/2026
 * - formatDateTime  → 20/10/2026 14:05
 * - formatDayMonth  → 20/10        (ejes de gráficos y rangos cortos)
 * - formatMonthYear → 10/2026      (agrupación por mes)
 * - formatWeekdayDate → «viernes 23/10/2026» (día de la semana en el idioma de la persona)
 *
 * Una fecha sola "YYYY-MM-DD" (fecha de factura, de servicio, de venta) se toma como día
 * local, no como medianoche UTC: así no se corre un día en el continente americano.
 * `timeZone` opcional (los correos y avisos del servidor usan America/Tegucigalpa).
 */

export type DateInput = Date | string | number | null | undefined

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === "string") {
    const m = DATE_ONLY.exec(value)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

interface Parts {
  day: string
  month: string
  year: string
  hour: string
  minute: string
}

const pad = (n: number) => String(n).padStart(2, "0")

function partsOf(d: Date, timeZone?: string): Parts {
  if (!timeZone) {
    return {
      day: pad(d.getDate()),
      month: pad(d.getMonth() + 1),
      year: String(d.getFullYear()),
      hour: pad(d.getHours()),
      minute: pad(d.getMinutes()),
    }
  }
  const map: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) {
    map[p.type] = p.value
  }
  return { day: map.day, month: map.month, year: map.year, hour: map.hour === "24" ? "00" : map.hour, minute: map.minute }
}

export interface DateFormatOptions {
  timeZone?: string
  /** Texto si la fecha falta o no es válida. */
  fallback?: string
}

export function formatDate(value: DateInput, opts: DateFormatOptions = {}): string {
  const d = toDate(value)
  if (!d) return opts.fallback ?? ""
  const p = partsOf(d, opts.timeZone)
  return `${p.day}/${p.month}/${p.year}`
}

export function formatDateTime(value: DateInput, opts: DateFormatOptions = {}): string {
  const d = toDate(value)
  if (!d) return opts.fallback ?? ""
  const p = partsOf(d, opts.timeZone)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

export function formatDayMonth(value: DateInput, opts: DateFormatOptions = {}): string {
  const d = toDate(value)
  if (!d) return opts.fallback ?? ""
  const p = partsOf(d, opts.timeZone)
  return `${p.day}/${p.month}`
}

export function formatMonthYear(value: DateInput, opts: DateFormatOptions = {}): string {
  const d = toDate(value)
  if (!d) return opts.fallback ?? ""
  const p = partsOf(d, opts.timeZone)
  return `${p.month}/${p.year}`
}

export function formatDateRange(from: DateInput, to: DateInput, opts: DateFormatOptions = {}): string {
  return `${formatDate(from, opts)} – ${formatDate(to, opts)}`
}

/** «viernes 23/10/2026»: el día de la semana en el idioma de la persona, la fecha siempre día/mes/año. */
export function formatWeekdayDate(value: DateInput, locale: string, opts: DateFormatOptions & { short?: boolean } = {}): string {
  const d = toDate(value)
  if (!d) return opts.fallback ?? ""
  const weekday = new Intl.DateTimeFormat(locale, { weekday: opts.short ? "short" : "long", timeZone: opts.timeZone }).format(d)
  return `${weekday} ${formatDate(d, opts)}`
}

/** "YYYY-MM-DD" de una fecha local (para guardar fechas solas y para los campos de fecha). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Lee "dd/mm/aaaa" (o d/m/aaaa) escrito por la persona. Devuelve "YYYY-MM-DD" o null. */
export function parseDayMonthYear(text: string): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return toIsoDate(d)
}

/** Fecha para nombres de archivo (PDF, CSV): "20-10-2026". Los archivos no admiten "/". */
export function fileDate(value: DateInput = new Date()): string {
  return formatDate(value).replace(/\//g, "-")
}
