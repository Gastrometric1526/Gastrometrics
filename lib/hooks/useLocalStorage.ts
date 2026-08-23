"use client"

import { useState, useEffect, useCallback } from "react"

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  businessId?: string,
): [T, (value: T | ((val: T) => T)) => void] {
  // Crear una clave compuesta si hay businessId
  const storageKey = businessId ? `${key}_${businessId}` : key

  // Función para obtener el valor del localStorage
  const readValue = useCallback((): T => {
    try {
      const item = window.localStorage.getItem(storageKey)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error)
      return initialValue
    }
  }, [storageKey, initialValue])

  // Estado para almacenar el valor actual
  const [storedValue, setStoredValue] = useState<T>(readValue)

  // Función para actualizar el valor en localStorage y estado
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Permitir que el valor sea una función (como en setState)
        const valueToStore = value instanceof Function ? value(storedValue) : value

        // Guardar en estado
        setStoredValue(valueToStore)

        // Guardar en localStorage
        window.localStorage.setItem(storageKey, JSON.stringify(valueToStore))

        // Disparar evento para sincronizar entre pestañas
        window.dispatchEvent(new Event("local-storage-update"))
      } catch (error) {
        console.warn(`Error setting localStorage key "${storageKey}":`, error)
      }
    },
    [storageKey, storedValue],
  )

  // Escuchar cambios en otras pestañas
  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue())
    }

    // Escuchar eventos de storage y nuestro evento personalizado
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("local-storage-update", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("local-storage-update", handleStorageChange)
    }
  }, [readValue])

  return [storedValue, setValue]
}
