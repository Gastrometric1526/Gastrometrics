"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { consumeAuthHashFromUrl } from "@/lib/supabase/consume-auth-hash"
import type { Database } from "@/types/database"
import type { UserProfile } from "@/lib/types/user"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { refreshBusinesses } from "@/lib/storage/businesses"

interface User {
  name: string
  email: string
  id: string
}

// Datos de perfil que se mandan a signUp() — se guardan en auth.users.raw_user_meta_data
// y de ahí los toma el trigger public.handle_new_user() (ver
// supabase/migrations/0003_profile_signup_trigger.sql) para crear la fila en `profiles`.
export interface SignUpProfileData {
  fullName: string
  nationality: string
  currency: string
  businessType: string
  businessSize: string
  industryExperience: string
}

interface AuthContextType {
  isLoggedIn: boolean
  // true una vez que ya se consultó la sesión de Supabase al menos una vez. Las páginas
  // protegidas deben esperar a que esto sea true antes de redirigir a /login — si
  // redirigen mientras todavía es false, expulsan a usuarios que sí están logueados
  // (carrera con la carga inicial de la sesión).
  authChecked: boolean
  user: User | null
  userProfile: UserProfile | null
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, profile: SignUpProfileData) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (profile: UserProfile) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

function rowToProfile(row: ProfileRow, email: string): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email,
    createdAt: row.created_at,
    nationality: row.nationality,
    currency: row.currency,
    businessType: row.business_type,
    businessSize: row.business_size,
    industryExperience: row.industry_experience,
    emailVerified: row.email_verified,
    onboardingCompleted: row.onboarding_completed,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false

    const applySession = async (session: Session | null) => {
      const sessionUser = session?.user
      if (!sessionUser) {
        if (!cancelled) {
          setIsLoggedIn(false)
          setUser(null)
          setUserProfile(null)
        }
        return
      }

      const [{ data: profileRow }, { data: planRow }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle(),
        supabase.from("account_plans").select("plan_slug").eq("account_id", sessionUser.id).maybeSingle(),
      ])

      if (cancelled) return

      const email = sessionUser.email ?? ""
      setIsLoggedIn(true)
      setUser({ id: sessionUser.id, email, name: profileRow?.full_name || email })
      setUserProfile(profileRow ? rowToProfile(profileRow, email) : null)
      // Refresca el caché local del plan (lib/plan-access.ts) desde la fuente de
      // verdad real en Supabase — cubre el caso de "el plan cambió desde otro
      // dispositivo, o desde el Portal de Cliente de Stripe" en cada login/refresh de
      // sesión, no solo justo después de pagar.
      if (planRow?.plan_slug) setCurrentPlanSlug(planRow.plan_slug)
      // Dispara la carga real de la lista de negocios desde Supabase — ver
      // lib/storage/businesses.ts. No se espera (fire-and-forget): las pantallas que la
      // necesitan ya toleran verla vacía por un instante mientras carga, mismo patrón
      // que el resto de esta migración.
      refreshBusinesses()
    }

    // Antes de preguntar por la sesión, procesa un posible link de confirmación de
    // registro o recuperación de contraseña (ver lib/supabase/consume-auth-hash.ts) —
    // si no se hace esto primero, getSession() nunca ve la sesión que ese link trae.
    consumeAuthHashFromUrl().finally(() => {
      if (cancelled) return
      supabase.auth.getSession().then(({ data }) => {
        applySession(data.session).finally(() => {
          if (!cancelled) setAuthChecked(true)
        })
      })
    })

    // Cubre login/logout/refresh de token en cualquier pestaña — mantiene el estado de
    // React sincronizado con la sesión real de Supabase sin que cada página tenga que
    // volver a consultarla.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, profile: SignUpProfileData) => {
    // Antes llamaba a supabase.auth.signUp() directo desde el cliente — eso dispara
    // automáticamente el correo GENÉRICO de confirmación de Supabase, sin forma de
    // evitarlo desde acá. La ruta de servidor usa admin.generateLink en su lugar:
    // crea la cuenta igual (sin confirmar) pero sin mandar ningún correo por su
    // cuenta, y esta función manda el correo de marca real con Resend. Ver docs/53.
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        profile: {
          fullName: profile.fullName,
          nationality: profile.nationality,
          currency: profile.currency,
          businessType: profile.businessType,
          businessSize: profile.businessSize,
          industryExperience: profile.industryExperience,
        },
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || "No se pudo crear la cuenta.")
    // La fila en `profiles` la crea el trigger public.handle_new_user() del lado de
    // Supabase (ver 0003_profile_signup_trigger.sql), no este código — hacerlo aquí
    // fallaría por RLS mientras el correo no esté confirmado (sin sesión, auth.uid() es
    // null).
  }, [])

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signOut()
    if (error) console.error("Logout error:", error)
  }, [])

  const updateUserProfile = useCallback(
    async (profile: UserProfile) => {
      const supabase = getSupabaseBrowserClient()

      // Si el correo cambió, se pide a Supabase Auth que lo actualice de verdad (manda
      // un correo de confirmación al nuevo destino; auth.users.email no cambia hasta que
      // se confirma). No se bloquea el guardado del resto del perfil si esto falla — es
      // un paso extra sobre lo que ya hacía esta función antes de la migración.
      if (user && profile.email && profile.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: profile.email })
        if (emailError) console.error("No se pudo actualizar el correo en Supabase Auth:", emailError)
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.fullName,
          nationality: profile.nationality,
          currency: profile.currency,
          business_type: profile.businessType,
          business_size: profile.businessSize,
          industry_experience: profile.industryExperience,
          email_verified: profile.emailVerified,
          onboarding_completed: profile.onboardingCompleted,
        })
        .eq("id", profile.id)

      if (error) {
        console.error("No se pudo guardar el perfil en Supabase:", error)
        return
      }

      setUserProfile(profile)
      setUser((currentUser) =>
        currentUser ? { ...currentUser, name: profile.fullName, email: profile.email } : currentUser,
      )
      window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: profile }))
    },
    [user],
  )

  const value = useMemo(
    () => ({
      isLoggedIn,
      authChecked,
      user,
      userProfile,
      login,
      signUp,
      logout,
      updateUserProfile,
    }),
    [isLoggedIn, authChecked, user, userProfile, login, signUp, logout, updateUserProfile],
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
