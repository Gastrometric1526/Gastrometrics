"use client"

/**
 * Fila de íconos propios de un plato (docs/324): lo confirmado, proteínas y alérgenos, con su
 * nombre al pasar el mouse y para lectores de pantalla. Se usa en Mis Recetas.
 */

import { DietIcon } from "@/components/icons/diet-icon"
import type { DishTag } from "@/lib/dish-tags"
import { cn } from "@/lib/utils"

export function DishTagIcons({ tags, max = 8, className }: { tags?: DishTag[]; max?: number; className?: string }) {
  if (!tags || tags.length === 0) return null
  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label={tags.map((x) => x.text).join(", ")} role="img">
      {shown.map((tag) => (
        <span
          key={`${tag.kind}-${tag.key}`}
          title={tag.text}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full",
            tag.kind === "allergen" || tag.kind === "trace" ? "bg-warning-soft text-warning" : "bg-primary/10 text-primary",
          )}
        >
          <DietIcon k={tag.key} className="h-4 w-4" />
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-muted-foreground">+{rest}</span>}
    </div>
  )
}
