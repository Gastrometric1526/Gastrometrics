"use client"

/**
 * Ícono propio de un alérgeno o tipo de plato (docs/324), con su nombre al pasar el mouse y
 * para lectores de pantalla. Dibujos en lib/diet-icons.ts (mismo estilo que gm-icons).
 */

import { iconPath, type DietIconKey } from "@/lib/diet-icons"
import { cn } from "@/lib/utils"

export function DietIcon({ k, label, className }: { k: DietIconKey; label?: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      <path d={iconPath(k)} />
    </svg>
  )
}
