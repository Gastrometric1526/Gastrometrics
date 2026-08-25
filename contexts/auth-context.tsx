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

export interface SignUpOptions {
  // Idioma activo en la UI al momento de registrarse (useLanguage().language) — se
  // manda al trigger de creación de perfil (ver supabase/migrations/0007) para que el
  // correo de confirmación de registro salga en ese idioma, no siempre en español.
  preferredLanguage: string
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
  signUp: (email: string, password: string, profile: SignUpProfileData, options: SignUpOptions) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (profile: UserProfile) => Promise<void>
  // Sincroniza el idioma elegido en la UI (contexts/language-context.tsx) hacia
  // profiles.preferred_language — best-effort, sin bloquear el cambio de idioma si
  // falla o si no hay sesión (usuario anónimo en la landing, por ejemplo).
  syncPreferredLanguage: (language: string) => void
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
    preferredLanguage: row.preferred_language,
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

      const [{ data: profileRow }, planResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle(),
        supabase.from("account_plans").select("plan_slug, plan_expires_at").eq("account_id", sessionUser.id).maybeSingle(),
      ])
      // Tolera que supabase/migrations/0008_plan_expiry.sql todavía no se haya corrido
      // (columna nueva, ver docs/59) — sin esto, el sync de plan de CADA sesión se
      // rompería por completo (nunca refrescaría el plan real) hasta que alguien corra
      // esa migración a mano.
      let planRow = planResult.data
      if (planResult.error) {
        const fallback = await supabase
          .from("account_plans")
          .select("plan_slug")
          .eq("account_id", sessionUser.id)
          .maybeSingle()
        planRow = fallback.data ? { ...fallback.data, plan_expires_at: null } : null
      }

      if (cancelled) return

      const email = sessionUser.email ?? ""
      setIsLoggedIn(true)
      setUser({ id: sessionUser.id, email, name: profileRow?.full_name || email })
      setUserProfile(profileRow ? rowToProfile(profileRow, email) : null)
      // Refresca el caché local del plan (lib/plan-access.ts) desde la fuente de
      // verdad real en Supabase — cubre el caso de "el plan cambió desde otro
      // dispositivo, o desde el Portal de Cliente de Stripe" en cada login/refresh de
      // sesión, no solo justo después de pagar.
      //
      // Un plan asignado a mano desde /admin ("Cuentas y planes") puede tener
      // plan_expires_at — vencido, se trata como si la cuenta nunca hubiera tenido ese
      // plan (cae a "foodie") sin que nadie tenga que acordarse de revertirlo a mano.
      // No se reescribe la fila en Supabase acá (el cliente no puede, RLS bloquea
      // escrituras directas a account_plans) — es solo un cálculo de lectura, la fila
      // real se corrige la próxima vez que alguien la edite desde /admin.
      const isExpired = planRow?.plan_expires_at ? new Date(planRow.plan_expires_at).getTime() < Date.now() : false
      if (planRow?.plan_slug) setCurrentPlanSlug(isExpired ? "foodie" : planRow.plan_slug)
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

  const signUp = useCallback(async (email: string, password: string, profile: SignUpProfileData, options: SignUpOptions) => {
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
          preferredLanguage: options.preferredLanguage,
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

  const syncPreferredLanguage = useCallback(
    (language: string) => {
      if (!user) return
      const supabase = getSupabaseBrowserClient()
      supabase
        .from("profiles")
        .update({ preferred_language: language })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("No se pudo sincronizar el idioma preferido:", error)
        })
    },
    [user],
  )

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
      syncPreferredLanguage,
    }),
    [isLoggedIn, authChecked, user, userProfile, login, signUp, logout, updateUserProfile, syncPreferredLanguage],
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
