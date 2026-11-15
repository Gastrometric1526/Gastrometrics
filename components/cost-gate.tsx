"use client"

/**
 * Quién ve costos (pedido del dueño, docs/304): «qué información» puede ver cada persona del
 * equipo. Con la parte «info.costs» de Equipo (lib/team-parts.ts) se ven costos, márgenes,
 * food cost y precios de compra; sin ella, solo los precios de venta (los de la carta, que ve
 * cualquier cliente). El dueño los ve siempre. Mientras se sabe quién es (primer render), no
 * se muestran: mejor un parpadeo que mostrar un costo a quien no debe.
 */

import type { ReactNode } from "react"
import { usePart } from "@/lib/plan-access"

export function useCanSeeCosts(): boolean {
  return usePart("info.costs") === true
}

/** Muestra su contenido solo a quien puede ver costos; si no, `fallback` (nada por defecto). */
export function CostOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{useCanSeeCosts() ? children : fallback}</>
}
