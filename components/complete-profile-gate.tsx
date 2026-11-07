"use client"

/**
 * Quien entró con Google por primera vez completa su perfil (país, moneda y aceptación de los
 * Términos) antes de usar la app (docs/254). Las cuentas de correo no pasan por aquí.
 */

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { needsProfileCompletion } from "@/lib/google-signin"

export function CompleteProfileGate() {
  const { user, userProfile } = useAuth()
  const pathname = usePathname() || "/"
  const router = useRouter()
  const needed = needsProfileCompletion(user, userProfile, pathname)

  useEffect(() => {
    if (needed) router.replace("/completar-perfil")
  }, [needed, router])

  return null
}
