"use client"

import { useState, useCallback, useMemo } from "react"
import { useDebounceCallback } from "./use-debounce-callback"

interface SearchOptions<T> {
  items: T[]
  searchFields: (keyof T)[]
  minLength?: number
  debounceMs?: number
}

export function useSearch<T>({ items, searchFields, minLength = 3, debounceMs = 300 }: SearchOptions<T>) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  const handleSearch = useDebounceCallback((value: string) => {
    setDebouncedQuery(value)
  }, debounceMs)

  const updateQuery = useCallback(
    (value: string) => {
      setQuery(value)
      handleSearch(value)
    },
    [handleSearch],
  )

  const results = useMemo(() => {
    if (debouncedQuery.length < minLength) {
      return items
    }

    return items.filter((item) => {
      return searchFields.some((field) => {
        const value = item[field]
        if (typeof value === "string") {
          return value.toLowerCase().includes(debouncedQuery.toLowerCase())
        }
        return false
      })
    })
  }, [items, searchFields, debouncedQuery, minLength])

  return {
    query,
    results,
    updateQuery,
  }
}
