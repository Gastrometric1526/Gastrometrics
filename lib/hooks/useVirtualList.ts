"use client"

import { useRef, useState, useLayoutEffect, useCallback } from "react"

interface VirtualItem {
  index: number
  start: number
  size: number
  measureRef: (el: HTMLElement | null) => void
}

interface VirtualListOptions {
  itemCount: number
  estimateSize?: number
  overscan?: number
  getScrollElement: () => HTMLElement | null
}

export function useVirtualList({ itemCount, estimateSize = 50, overscan = 3, getScrollElement }: VirtualListOptions) {
  // Refs para almacenar medidas
  const sizeCache = useRef<number[]>(Array(itemCount).fill(estimateSize))
  const measureRefs = useRef<((el: HTMLElement | null) => void)[]>([])

  // Estado para la posición de desplazamiento
  const [scrollTop, setScrollTop] = useState(0)

  // Calcular el tamaño total de la lista
  const totalSize = useRef(itemCount * estimateSize)

  // Actualizar el tamaño total cuando cambia el número de elementos
  useLayoutEffect(() => {
    totalSize.current = sizeCache.current.reduce((sum, size) => sum + size, 0)
  }, [itemCount])

  // Crear refs para medir elementos
  useLayoutEffect(() => {
    measureRefs.current = Array(itemCount)
      .fill(0)
      .map((_, index) => {
        return (el: HTMLElement | null) => {
          if (el && sizeCache.current[index] !== el.offsetHeight) {
            sizeCache.current[index] = el.offsetHeight
            totalSize.current = sizeCache.current.reduce((sum, size) => sum + size, 0)
          }
        }
      })
  }, [itemCount])

  // Escuchar eventos de scroll
  useLayoutEffect(() => {
    const scrollElement = getScrollElement()
    if (!scrollElement) return

    const handleScroll = () => {
      setScrollTop(scrollElement.scrollTop)
    }

    scrollElement.addEventListener("scroll", handleScroll)
    return () => scrollElement.removeEventListener("scroll", handleScroll)
  }, [getScrollElement])

  // Calcular elementos visibles
  const virtualItems = useCallback((): VirtualItem[] => {
    const scrollElement = getScrollElement()
    if (!scrollElement) return []

    const visibleHeight = scrollElement.clientHeight

    let startIndex = 0
    let endIndex = 0
    let currentOffset = 0

    // Encontrar el primer elemento visible
    for (let i = 0; i < itemCount; i++) {
      const size = sizeCache.current[i]
      if (currentOffset + size > scrollTop) {
        startIndex = i
        break
      }
      currentOffset += size
    }

    // Encontrar el último elemento visible
    for (let i = startIndex; i < itemCount; i++) {
      const size = sizeCache.current[i]
      if (currentOffset > scrollTop + visibleHeight) {
        endIndex = i
        break
      }
      currentOffset += size
      endIndex = i + 1
    }

    // Aplicar overscan
    startIndex = Math.max(0, startIndex - overscan)
    endIndex = Math.min(itemCount, endIndex + overscan)

    // Crear array de elementos virtuales
    const items: VirtualItem[] = []
    let offsetTop = 0

    for (let i = 0; i < startIndex; i++) {
      offsetTop += sizeCache.current[i]
    }

    for (let i = startIndex; i < endIndex; i++) {
      items.push({
        index: i,
        start: offsetTop,
        size: sizeCache.current[i],
        measureRef: measureRefs.current[i],
      })
      offsetTop += sizeCache.current[i]
    }

    return items
  }, [scrollTop, itemCount, overscan, getScrollElement])

  return {
    virtualItems: virtualItems(),
    totalSize: totalSize.current,
    scrollTo: (index: number) => {
      const scrollElement = getScrollElement()
      if (!scrollElement) return

      let offset = 0
      for (let i = 0; i < index; i++) {
        offset += sizeCache.current[i]
      }

      scrollElement.scrollTop = offset
    },
  }
}
