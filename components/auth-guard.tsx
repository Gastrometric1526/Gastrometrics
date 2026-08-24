"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const { isLoggedIn, authChecked } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Esperar a que AuthProvider termine de consultar la sesión de Supabase — si se
    // revisa antes, isLoggedIn todavía está en su valor inicial (false) aunque el
    // usuario sí tenga sesión real, y esto expulsaría a un usuario real a /login en
    // cada recarga.
    if (!authChecked) return

    if (!isLoggedIn) {
      // BUG CORREGIDO: antes de la migración a Supabase Auth (ver docs/51), cualquier
      // localStorage con "username"/"businesses" de una cuenta legacy se auto-logueaba
      // con login(username, "demo") porque login() nunca podía fallar. Ahora login()
      // valida contraseña de verdad contra Supabase, así que ese atajo siempre fallaría
      // y dejaría a la persona congelada en el spinner de "Verificando autenticación..."
      // para siempre. Sin sesión real de Supabase, no hay más opción que ir a /login.
      router.push(redirectTo)
    }
  }, [isLoggedIn, authChecked, router, redirectTo])

  if (!authChecked || !isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
