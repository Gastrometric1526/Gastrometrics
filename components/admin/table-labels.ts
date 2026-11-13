"use client"

/**
 * Etiquetas para las tablas de /admin en el celular (docs/293). Con poco ancho, cada fila se
 * muestra como tarjeta «columna: valor» (estilos `.admin-tables` en app/globals.css); para eso
 * cada celda necesita el nombre de su columna en `data-label`. Este hook lo pone leyendo el
 * encabezado de cada tabla, también en las que cargan después (paneles que traen datos), así
 * ninguna tabla tiene que repetir sus títulos.
 */

import { useEffect, type RefObject } from "react"

export function labelTableCells(root: ParentNode): void {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const headers: string[] = []
    for (const th of Array.from(table.querySelectorAll("thead tr:last-child th"))) {
      const span = Number(th.getAttribute("colspan")) || 1
      for (let i = 0; i < span; i++) headers.push((th.textContent || "").trim())
    }
    if (!headers.length) continue
    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      let col = 0
      for (const cell of Array.from(row.children)) {
        const label = headers[col] ?? ""
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label)
        col += Number(cell.getAttribute("colspan")) || 1
      }
    }
  }
}

export function useTableCardLabels(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    labelTableCells(root)
    let pending = false
    const observer = new MutationObserver(() => {
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        pending = false
        labelTableCells(root)
      })
    })
    // Solo cambios de contenido (no de atributos): poner `data-label` no vuelve a dispararlo.
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [ref])
}
