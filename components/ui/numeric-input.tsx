"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { validatePositiveNumber, sanitizeNumericInput, parseNumericInput } from "@/lib/utils/numeric-validation"

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value?: number | string
  onChange?: (value: number) => void
  onValueChange?: (value: string) => void
  allowDecimals?: boolean
  allowZero?: boolean
  min?: number
  max?: number
  decimalPlaces?: number
}

/**
 * Enhanced numeric input component with smart zero handling
 * - Shows blank instead of 0 (zero appears as empty field)
 * - Prevents negative number input completely
 * - Allows typing decimal notation like "0." or "1.0"
 * - Auto-formats on blur
 * - Supports controlled and uncontrolled modes
 */
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      allowDecimals = true,
      allowZero = true,
      min = 0,
      max,
      decimalPlaces = 2,
      className,
      placeholder = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState<string>(() => {
      if (value === undefined || value === null || value === "" || value === 0) return ""
      return String(value)
    })

    const [isFocused, setIsFocused] = React.useState(false)

    // Update internal value when prop changes
    React.useEffect(() => {
      if (!isFocused) {
        if (value === undefined || value === null || value === "" || value === 0) {
          setInternalValue("")
        } else {
          setInternalValue(String(value))
        }
      }
    }, [value, isFocused])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value

      newValue = sanitizeNumericInput(newValue)

      // Handle decimal places
      if (!allowDecimals) {
        newValue = newValue.replace(/\./g, "")
      } else if (newValue.includes(".")) {
        const parts = newValue.split(".")
        if (parts[1] && parts[1].length > decimalPlaces) {
          newValue = `${parts[0]}.${parts[1].slice(0, decimalPlaces)}`
        }
      }

      // Validate (prevents negative numbers)
      if (newValue !== "" && !validatePositiveNumber(newValue)) {
        return
      }

      setInternalValue(newValue)

      // Call callbacks
      if (onValueChange) {
        onValueChange(newValue)
      }

      if (onChange) {
        const numValue = parseNumericInput(newValue, 0)
        onChange(numValue)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)

      const finalValue = internalValue

      // Parse the value
      const numValue = parseNumericInput(finalValue, 0)

      // Apply constraints
      let constrainedValue = numValue

      if (min !== undefined && constrainedValue < min) {
        constrainedValue = min
      }

      if (max !== undefined && constrainedValue > max) {
        constrainedValue = max
      }

      if (constrainedValue === 0) {
        setInternalValue("")
      } else if (constrainedValue !== numValue) {
        setInternalValue(String(constrainedValue))
        if (onChange) {
          onChange(constrainedValue)
        }
      }

      props.onBlur?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)

      if (internalValue === "" && value === 0) {
        setInternalValue("")
      }

      props.onFocus?.(e)
    }

    const showPlaceholderStyle = !isFocused && internalValue === ""

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(showPlaceholderStyle && "text-muted-foreground/50", className)}
        {...props}
      />
    )
  },
)

NumericInput.displayName = "NumericInput"

export { NumericInput }
