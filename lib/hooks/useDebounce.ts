"use client"

import { useState, useEffect, useCallback } from "react"

// Hook para valores debounced
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook para callbacks debounced
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const id = setTimeout(() => {
        callback(...args)
      }, delay)

      setTimeoutId(id)
    },
    [callback, delay, timeoutId],
  )

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  return debouncedCallback
}
