"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { openAdminAccount } from "@/lib/admin/open-account"

/**
 * Una cuenta mencionada en cualquier panel de /admin: al hacer clic abre su ficha completa en
 * Cuentas (docs/214). Sin correo ni id (anónimo, cuenta eliminada) se muestra como texto.
 */
export function AccountLink({
  email,
  userId,
  children,
  className,
}: {
  email?: string | null
  userId?: string | null
  children?: ReactNode
  className?: string
}) {
  const label = children ?? email ?? "—"
  if (!email && !userId) return <span className={className}>{label}</span>
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openAdminAccount({ email, userId })
      }}
      className={cn(
        "max-w-full truncate text-left underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:underline",
        className,
      )}
    >
      {label}
    </button>
  )
}
