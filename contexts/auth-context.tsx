"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import type { UserProfile } from "@/lib/types/user"

interface User {
  name: string
  email: string
  id: string
}

interface AuthContextType {
  isLoggedIn: boolean
  // true una vez que ya se leyó localStorage al menos una vez. Las páginas protegidas deben
  // esperar a que esto sea true antes de redirigir a /login — si redirigen mientras todavía
  // es false, expulsan a usuarios que sí están logueados (carrera con la hidratación).
  authChecked: boolean
  user: User | null
  userProfile: UserProfile | null
  login: (username: string, password: string) => void
  logout: () => void
  updateUserProfile: (profile: UserProfile) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true"
    const userData = localStorage.getItem("userData")
    const profileData = localStorage.getItem("userProfile")

    if (loggedIn && userData) {
      setIsLoggedIn(true)
      setUser(JSON.parse(userData))

      if (profileData) {
        setUserProfile(JSON.parse(profileData))
      }
    }
    setAuthChecked(true)
  }, [])

  const login = useCallback((username: string, password: string) => {
    const userData: User = {
      name: username,
      email: `${username}@gastrometrics.com`,
      id: `user_${Date.now()}`,
    }

    setIsLoggedIn(true)
    setUser(userData)
    localStorage.setItem("isLoggedIn", "true")
    localStorage.setItem("userData", JSON.stringify(userData))
    // Cualquier login real (o el auto-login de AuthGuard para cuentas legacy) anula un
    // cierre de sesión explícito anterior — ver logout() más abajo.
    localStorage.removeItem("gm_explicit_logout")

    const profileData = localStorage.getItem("userProfile")
    if (profileData) {
      setUserProfile(JSON.parse(profileData))
    }
  }, [])

  const logout = useCallback(() => {
    setIsLoggedIn(false)
    setUser(null)
    setUserProfile(null)
    localStorage.removeItem("isLoggedIn")
    localStorage.removeItem("userData")
    // BUG CORREGIDO: ni "username" ni "businesses" se borran aquí — son datos reales del
    // usuario (localStorage es el único almacenamiento de la app), no se pueden borrar al
    // cerrar sesión. Pero AuthGuard y app/dashboard/page.tsx usan justamente esos dos
    // valores como señal de "cuenta legacy existente, auto-loguéala" — así que sin esta
    // bandera, el logout se deshacía solo: el efecto de auto-login volvía a correr login()
    // en la misma pantalla antes de que la navegación dura a "/" alcanzara a completarse,
    // y el usuario veía un parpadeo/vuelta atrás justo al cerrar sesión. Esta bandera le
    // dice a ambos que no auto-reloguen — se limpia sola en el próximo login() real.
    localStorage.setItem("gm_explicit_logout", "true")
  }, [])

  const updateUserProfile = useCallback((profile: UserProfile) => {
    setUserProfile(profile)
    localStorage.setItem("userProfile", JSON.stringify(profile))

    setUser((currentUser) => {
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          name: profile.fullName,
          email: profile.email,
        }
        localStorage.setItem("userData", JSON.stringify(updatedUser))
        return updatedUser
      }
      return currentUser
    })

    window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: profile }))
  }, [])

  const value = useMemo(
    () => ({
      isLoggedIn,
      authChecked,
      user,
      userProfile,
      login,
      logout,
      updateUserProfile,
    }),
    [isLoggedIn, authChecked, user, userProfile, login, logout, updateUserProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
