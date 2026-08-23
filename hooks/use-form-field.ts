"use client"

import { useState, useCallback } from "react"
import { useDebounce } from "@/hooks/use-debounce"

interface UseFormFieldOptions<T> {
  initialValue: T
  onChange?: (value: T) => void
  debounceMs?: number
  validate?: (value: T) => boolean
}

export function useFormField<T>({ initialValue, onChange, debounceMs = 300, validate }: UseFormFieldOptions<T>) {
  const [value, setValue] = useState<T>(initialValue)
  const [isValid, setIsValid] = useState(true)

  // Usar debounce para el callback
  const debouncedOnChange = useDebounce((newValue: T) => {
    if (onChange) {
      onChange(newValue)
    }
  }, debounceMs)

  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue)

      // Validar el valor si se proporciona una función de validación
      if (validate) {
        const validationResult = validate(newValue)
        setIsValid(validationResult)
      }

      // Llamar al callback debounced
      debouncedOnChange(newValue)
    },
    [debouncedOnChange, validate],
  )

  return {
    value,
    setValue: updateValue,
    isValid,
  }
}
