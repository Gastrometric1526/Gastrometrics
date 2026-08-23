"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  allowSpecialChars?: boolean
  allowNumbers?: boolean
}

/**
 * Enhanced text input component
 * - Allows letters, symbols, spaces, punctuation
 * - Configurable to allow/disallow numbers and special characters
 */
const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ allowSpecialChars = true, allowNumbers = true, className, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow control keys
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Tab" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return
      }

      // Check if numbers are allowed
      if (!allowNumbers && /[0-9]/.test(e.key)) {
        e.preventDefault()
        return
      }

      // Check if special characters are allowed
      if (!allowSpecialChars && /[^a-zA-Z0-9\s]/.test(e.key)) {
        e.preventDefault()
        return
      }

      props.onKeyDown?.(e)
    }

    return <Input ref={ref} type="text" onKeyDown={handleKeyDown} className={cn(className)} {...props} />
  },
)

TextInput.displayName = "TextInput"

export { TextInput }
