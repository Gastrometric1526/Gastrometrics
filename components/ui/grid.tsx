import type React from "react"
import { cn } from "@/lib/utils"

type GridProps = {
  children: React.ReactNode
  numItems?: number
  numItemsSm?: number
  numItemsMd?: number
  numItemsLg?: number
  className?: string
}

export function Grid({ children, numItems = 1, numItemsSm, numItemsMd, numItemsLg, className }: GridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        numItems === 1 && "grid-cols-1",
        numItems === 2 && "grid-cols-2",
        numItems === 3 && "grid-cols-3",
        numItems === 4 && "grid-cols-4",
        numItemsSm === 1 && "sm:grid-cols-1",
        numItemsSm === 2 && "sm:grid-cols-2",
        numItemsSm === 3 && "sm:grid-cols-3",
        numItemsSm === 4 && "sm:grid-cols-4",
        numItemsMd === 1 && "md:grid-cols-1",
        numItemsMd === 2 && "md:grid-cols-2",
        numItemsMd === 3 && "md:grid-cols-3",
        numItemsMd === 4 && "md:grid-cols-4",
        numItemsLg === 1 && "lg:grid-cols-1",
        numItemsLg === 2 && "lg:grid-cols-2",
        numItemsLg === 3 && "lg:grid-cols-3",
        numItemsLg === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}
