import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const dateFormatter = new Intl.DateTimeFormat("es-HN", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

const percentFormatter = new Intl.NumberFormat("es-HN", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const numberFormatterCache = new Map<number, Intl.NumberFormat>()

function getNumberFormatter(decimals: number): Intl.NumberFormat {
  if (!numberFormatterCache.has(decimals)) {
    numberFormatterCache.set(
      decimals,
      new Intl.NumberFormat("es-HN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    )
  }
  return numberFormatterCache.get(decimals)!
}

export { formatCurrency } from "@/lib/currency"

export function formatDate(date: string | Date, locale?: string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  if (!locale || locale === "es-HN") return dateFormatter.format(dateObj)
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(dateObj)
}

export function formatNumber(num: number, decimals = 2): string {
  if (num === 0) return ""
  return getNumberFormatter(decimals).format(num)
}

export function formatPercentage(value: number): string {
  if (value === 0) return ""
  return percentFormatter.format(value / 100)
}

export function formatWeight(grams: number): string {
  if (grams === 0) return ""
  if (grams >= 1000) {
    return `${formatNumber(grams / 1000)} kg`
  }
  return `${formatNumber(grams)} g`
}

export function formatVolume(ml: number): string {
  if (ml === 0) return ""
  if (ml >= 1000) {
    return `${formatNumber(ml / 1000)} L`
  }
  return `${formatNumber(ml)} ml`
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }

  debouncedFn.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debouncedFn
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

export function shallowEqual<T extends Record<string, any>>(objA: T, objB: T): boolean {
  if (objA === objB) return true
  if (!objA || !objB) return false

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false
  }

  return true
}

export function createSelector<T, R>(
  selector: (state: T) => R,
  equalityFn: (a: R, b: R) => boolean = Object.is,
): (state: T) => R {
  let lastState: T | undefined
  let lastResult: R | undefined

  return (state: T): R => {
    if (lastState === state) {
      return lastResult as R
    }

    const result = selector(state)

    if (lastResult !== undefined && equalityFn(lastResult, result)) {
      return lastResult
    }

    lastState = state
    lastResult = result
    return result
  }
}
