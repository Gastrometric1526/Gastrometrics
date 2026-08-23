"use client"

import { useState, useCallback, useRef } from "react"

export function useBatchState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState)
  const batchUpdatesRef = useRef<Partial<T>>({})
  const batchTimeoutRef = useRef<NodeJS.Timeout>()

  const batchUpdate = useCallback((updates: Partial<T>) => {
    // Acumular actualizaciones
    batchUpdatesRef.current = {
      ...batchUpdatesRef.current,
      ...updates,
    }

    // Limpiar el timeout anterior si existe
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
    }

    // Programar la actualización del estado
    batchTimeoutRef.current = setTimeout(() => {
      setState((prevState) => ({
        ...prevState,
        ...batchUpdatesRef.current,
      }))
      batchUpdatesRef.current = {}
    }, 0)
  }, [])

  return [state, batchUpdate] as const
}
