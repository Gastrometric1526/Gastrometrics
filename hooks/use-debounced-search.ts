"use client"

import { useState, useMemo } from "react"
import { useDebounce } from "@/hooks/use-debounce"

export function useDebouncedSearch<T>(items: T[], searchFields: (keyof T)[], options = { delay: 300, minLength: 3 }) {
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, options.delay)

  const filteredItems = useMemo(() => {
    if (debouncedSearchTerm.length < options.minLength) {
      return items
    }

    return items.filter((item) =>
      searchFields.some((field) => {
        const value = item[field]
        return typeof value === "string" && value.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      }),
    )
  }, [items, searchFields, debouncedSearchTerm, options.minLength])

  return {
    searchTerm,
    setSearchTerm,
    filteredItems,
  }
}
