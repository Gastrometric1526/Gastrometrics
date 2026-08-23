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
  const { isLoggedIn, authChecked, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Esperar a que AuthProvider termine de leer localStorage — si se revisa antes,
    // isLoggedIn todavía está en su valor inicial (false) aunque el usuario sí tenga
    // sesión guardada, y esto expulsaría a un usuario real a /login en cada recarga.
    if (!authChecked) return

    if (!isLoggedIn) {
      // BUG CORREGIDO (ver logout() en contexts/auth-context.tsx): si el usuario acaba
      // de cerrar sesión explícitamente, no auto-loguearlo de nuevo solo porque todavía
      // tiene datos guardados — eso deshacía el logout en el acto.
      if (localStorage.getItem("gm_explicit_logout") === "true") {
        router.push(redirectTo)
        return
      }

      // Check if user has existing data (legacy users)
      const hasExistingData = localStorage.getItem("username") || localStorage.getItem("businesses")

      if (hasExistingData) {
        // Auto-authenticate existing users
        const username = localStorage.getItem("username") || "Usuario"
        login(username, "demo")
      } else {
        // Redirect new users to login
        router.push(redirectTo)
      }
    }
  }, [isLoggedIn, authChecked, login, router, redirectTo])

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
