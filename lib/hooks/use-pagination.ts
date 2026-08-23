"use client"

import { useState, useMemo, useCallback } from "react"

interface PaginationOptions {
  itemsPerPage?: number
  initialPage?: number
}

export function usePagination<T>(items: T[], options: PaginationOptions = {}) {
  const { itemsPerPage = 10, initialPage = 1 } = options
  const [currentPage, setCurrentPage] = useState(initialPage)

  const totalPages = Math.ceil(items.length / itemsPerPage)

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return items.slice(start, end)
  }, [items, currentPage, itemsPerPage])

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    },
    [totalPages],
  )

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  const previousPage = useCallback(() => {
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  return {
    items: paginatedItems,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}
