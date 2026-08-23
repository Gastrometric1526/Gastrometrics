/**
 * Numeric validation utilities for form inputs
 * Handles validation for positive numbers, decimals, and zero values
 */

/**
 * Validates if a number is positive (greater than 0) or a valid decimal starting with 0
 * @param value - The number to validate
 * @returns true if valid, false otherwise
 */
export function isPositiveOrDecimal(value: number | string): boolean {
  const num = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(num)) return false

  // Allow 0 followed by decimal (0.5, 0.25, etc.)
  if (typeof value === "string" && value.startsWith("0.")) {
    return num >= 0
  }

  // Otherwise, must be greater than or equal to 0
  return num >= 0
}

export function validatePositiveNumber(value: string): boolean {
  // Empty string is valid (will be treated as 0)
  if (value === "") return true

  const numberRegex = /^[0-9]*\.?[0-9]*$/
  if (!numberRegex.test(value)) return false

  if (value.startsWith("-")) return false

  const num = Number.parseFloat(value)

  // If it's just "0" or "0.", allow it (user might be typing 0.5)
  if (value === "0" || value === "0.") return true

  // Otherwise validate as positive or decimal (including exact zero)
  return num >= 0 && !isNaN(num)
}

/**
 * Formats a number for display, handling zero values specially
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @param showZeroAsBlank - If true, returns empty string for zero (default: true)
 * @returns Formatted string
 */
export function formatNumericValue(value: number | string, decimals = 2, showZeroAsBlank = true): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(num)) return ""

  if (showZeroAsBlank && num === 0) return ""

  return num.toFixed(decimals)
}

/**
 * Sanitizes numeric input, removing invalid characters including negative signs
 * @param value - The input value to sanitize
 * @returns Sanitized string
 */
export function sanitizeNumericInput(value: string): string {
  return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") // Also prevent multiple decimals
}

/**
 * Checks if a value should be displayed with placeholder styling
 * @param value - The value to check
 * @returns true if should use placeholder style
 */
export function shouldUsePlaceholderStyle(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true

  const num = typeof value === "string" ? Number.parseFloat(value) : value

  return isNaN(num) || num === 0
}

export function parseNumericInput(value: string | number | null | undefined, defaultValue = 0): number {
  if (value === "" || value === null || value === undefined) return defaultValue

  const num = typeof value === "string" ? Number.parseFloat(value) : value

  return isNaN(num) ? defaultValue : Math.max(0, num)
}

/**
 * Validates text input (allows letters, symbols, spaces, etc.)
 * @param value - The text to validate
 * @returns true if valid
 */
export function validateTextInput(value: string): boolean {
  // Text inputs allow any characters
  return true
}

/**
 * Constrains a number to a minimum value
 * @param value - The number to constrain
 * @param min - Minimum value (default: 0)
 * @returns Constrained number
 */
export function constrainToMin(value: number, min = 0): number {
  return Math.max(value, min)
}

/**
 * Constrains a number to a range
 * @param value - The number to constrain
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Constrained number
 */
export function constrainToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Converts a value to display format - shows blank for zero, otherwise formatted number
export function toDisplayValue(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === "") return ""

  const num = typeof value === "string" ? Number.parseFloat(value) : value

  if (isNaN(num) || num === 0) return ""

  return num.toFixed(decimals)
}

// Converts a display value (possibly blank) back to a number
export function fromDisplayValue(value: string): number {
  if (value === "" || value === null || value === undefined) return 0

  const num = Number.parseFloat(value)

  return isNaN(num) ? 0 : Math.max(0, num)
}
