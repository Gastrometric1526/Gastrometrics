"use client"

import type React from "react"

import { useRef, useCallback, useState, useEffect } from "react"

export function useSafeScroll(debounceTime = 50) {
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrolling = useRef(false)

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isScrolling.current) return

      const target = e.currentTarget

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        isScrolling.current = true
        setScrollPosition({
          x: target.scrollLeft,
          y: target.scrollTop,
        })

        // Allow scrolling again after a short delay
        setTimeout(() => {
          isScrolling.current = false
        }, 50)
      }, debounceTime)
    },
    [debounceTime],
  )

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    scrollRef,
    scrollPosition,
    handleScroll,
  }
}
