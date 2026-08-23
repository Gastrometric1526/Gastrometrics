"use client"

import React from "react"

/**
 * Utilidades para manejar elementos desplegables en toda la aplicación
 * Estas funciones reemplazan las implementaciones anteriores que no funcionaban correctamente
 */

import type { RefObject } from "react"
/**
 * Utility functions for handling collapsible elements
 */

// Function to check if a click is outside an element
export function isClickOutside(element: HTMLElement | null, event: MouseEvent): boolean {
  return element ? !element.contains(event.target as Node) : true
}

/**
 * Alterna el estado de un elemento desplegable
 */
export function toggleCollapsible(
  id: string,
  isOpen: Record<string, boolean>,
  setIsOpen: (state: Record<string, boolean>) => void,
): void {
  setIsOpen({ ...isOpen, [id]: !isOpen[id] })
}

/**
 * Cierra todos los elementos desplegables
 */
export function closeAllCollapsibles(setIsOpen: (state: Record<string, boolean>) => void): void {
  setIsOpen({})
}

/**
 * Cierra un elemento desplegable específico
 */
export function closeCollapsible(
  id: string,
  isOpen: Record<string, boolean>,
  setIsOpen: (state: Record<string, boolean>) => void,
): void {
  if (isOpen[id]) {
    const newState = { ...isOpen }
    delete newState[id]
    setIsOpen(newState)
  }
}

/**
 * Abre un elemento desplegable específico
 */
export function openCollapsible(
  id: string,
  isOpen: Record<string, boolean>,
  setIsOpen: (state: Record<string, boolean>) => void,
): void {
  if (!isOpen[id]) {
    setIsOpen({ ...isOpen, [id]: true })
  }
}

/**
 * Configura un manejador de clics fuera de un elemento desplegable
 * Retorna una función de limpieza para useEffect
 */
export function setupClickOutsideHandler(
  refs: RefObject<HTMLElement>[],
  isOpen: Record<string, boolean>,
  setIsOpen: (state: Record<string, boolean>) => void,
): () => void {
  const handleClickOutside = (event: MouseEvent) => {
    // Si no hay elementos abiertos, no hacer nada
    if (Object.keys(isOpen).length === 0) return

    // Verificar si el clic fue fuera de todos los elementos referenciados
    const clickedOutside = refs.every((ref) => isClickOutside(ref.current, event))

    if (clickedOutside) {
      closeAllCollapsibles(setIsOpen)
    }
  }

  // Agregar el manejador de eventos
  document.addEventListener("mousedown", handleClickOutside)

  // Retornar función de limpieza
  return () => {
    document.removeEventListener("mousedown", handleClickOutside)
  }
}

/**
 * Maneja la accesibilidad por teclado para elementos desplegables
 */
export function handleKeyboardAccessibility(
  event: React.KeyboardEvent,
  id: string,
  isOpen: Record<string, boolean>,
  setIsOpen: (state: Record<string, boolean>) => void,
): void {
  // Cerrar con Escape
  if (event.key === "Escape") {
    closeAllCollapsibles(setIsOpen)
    return
  }

  // Alternar con Espacio o Enter
  if ((event.key === " " || event.key === "Enter") && event.target === event.currentTarget) {
    event.preventDefault()
    toggleCollapsible(id, isOpen, setIsOpen)
  }
}

/**
 * Hook personalizado para manejar el estado de elementos desplegables
 */
export function useCollapsibleState(initialState: Record<string, boolean> = {}) {
  const [isOpen, setIsOpen] = React.useState<Record<string, boolean>>(initialState)

  const handlers = {
    toggle: (id: string) => toggleCollapsible(id, isOpen, setIsOpen),
    open: (id: string) => openCollapsible(id, isOpen, setIsOpen),
    close: (id: string) => closeCollapsible(id, isOpen, setIsOpen),
    closeAll: () => closeAllCollapsibles(setIsOpen),
    isOpen: (id: string) => !!isOpen[id],
  }

  return [isOpen, setIsOpen, handlers] as const
}
