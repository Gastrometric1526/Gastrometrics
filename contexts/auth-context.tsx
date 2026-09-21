"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import type { Session } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { consumeAuthHashFromUrl } from "@/lib/supabase/consume-auth-hash"
import type { Database } from "@/types/database"
import type { UserProfile } from "@/lib/types/user"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { setCurrentPlanOverrides } from "@/lib/plan-overrides"
import { refreshBusinesses } from "@/lib/storage/businesses"
import { ensureTeamMembersLoaded, ensureMyMembershipsLoaded } from "@/lib/storage/team"

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
  // Casilla de "quiero recibir novedades del producto por correo" del paso 4 del
  // registro (ver app/signup/page.tsx) — opcional y default false en el trigger
  // (supabase/migrations/0022_product_updates_optin.sql) si no se manda.
  productUpdatesOptIn?: boolean
  // Casilla obligatoria de "acepto los Términos de Uso, la Política de Privacidad y el
  // Aviso de Responsabilidad" del paso 4 del registro — app/api/auth/signup/route.ts
  // rechaza la creación de la cuenta si esto no llega como true (ver docs/118).
  acceptedTerms: boolean
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
  updateUserProfile: (profile: UserProfile) => Promise<{ emailUpdateFailed: boolean }>
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
    productUpdatesOptIn: row.product_updates_opt_in,
    termsVersion: row.terms_version,
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
        supabase
          .from("account_plans")
          .select("plan_slug, plan_expires_at, extra_businesses, extra_team_seats")
          .eq("account_id", sessionUser.id)
          .maybeSingle(),
      ])
      // Tolera que supabase/migrations/0008_plan_expiry.sql y/o
      // 0019_account_overrides.sql todavía no se hayan corrido (columnas nuevas, ver
      // docs/59) — sin esto, el sync de plan de CADA sesión se rompería por completo
      // (nunca refrescaría el plan real) hasta que alguien corra esas migraciones a mano.
      //
      // BUG CORREGIDO: el select de arriba pedía las columnas de AMBAS migraciones
      // juntas — si solo 0008 ya se había corrido (el caso real en producción ahora
      // mismo) pero 0019 todavía no, Postgres rechaza la consulta COMPLETA por la
      // columna que falta, no solo esa columna sola. El fallback de abajo caía
      // directo a solo "plan_slug", tirando también plan_expires_at aunque esa
      // columna sí existiera — apagando en silencio el vencimiento de planes
      // asignados a mano para TODAS las sesiones. Ahora el fallback es escalonado:
      // primero intenta sin los extras, y solo si eso también falla, sin vencimiento.
      let planRow: {
        plan_slug: string
        plan_expires_at: string | null
        extra_businesses: number
        extra_team_seats: number
      } | null = planResult.data
      if (planResult.error) {
        const expiryOnly = await supabase
          .from("account_plans")
          .select("plan_slug, plan_expires_at")
          .eq("account_id", sessionUser.id)
          .maybeSingle()
        if (!expiryOnly.error) {
          planRow = expiryOnly.data ? { ...expiryOnly.data, extra_businesses: 0, extra_team_seats: 0 } : null
        } else {
          const slugOnly = await supabase
            .from("account_plans")
            .select("plan_slug")
            .eq("account_id", sessionUser.id)
            .maybeSingle()
          planRow = slugOnly.data
            ? { ...slugOnly.data, plan_expires_at: null, extra_businesses: 0, extra_team_seats: 0 }
            : null
        }
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
      // Negocios/cupos de equipo extra cedidos a mano desde /admin (ver
      // lib/plan-overrides.ts) — independientes del vencimiento del plan, se
      // sincronizan siempre que la fila exista.
      setCurrentPlanOverrides({
        extraBusinesses: planRow?.extra_businesses || 0,
        extraTeamSeats: planRow?.extra_team_seats || 0,
      })
      // Dispara la carga real de la lista de negocios desde Supabase — ver
      // lib/storage/businesses.ts. No se espera (fire-and-forget): las pantallas que la
      // necesitan ya toleran verla vacía por un instante mientras carga, mismo patrón
      // que el resto de esta migración.
      refreshBusinesses()
      // Precalienta la caché del roster de equipo — lib/plan-access.ts la necesita
      // síncrona para "Vista previa" (getActivePreviewMember), igual que businesses.
      ensureTeamMembersLoaded()
      // Precalienta "en qué negocios ajenos me invitaron a mí" — lib/plan-access.ts la
      // necesita síncrona para aplicar el filtro real de allowedFeatures/pdfAccess en
      // la sesión real de un miembro invitado (no la Vista previa del dueño).
      ensureMyMembershipsLoaded()
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
        acceptedTerms: options.acceptedTerms === true,
        profile: {
          fullName: profile.fullName,
          nationality: profile.nationality,
          currency: profile.currency,
          businessType: profile.businessType,
          businessSize: profile.businessSize,
          industryExperience: profile.industryExperience,
          preferredLanguage: options.preferredLanguage,
          productUpdatesOptIn: options.productUpdatesOptIn ?? false,
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
    async (profile: UserProfile): Promise<{ emailUpdateFailed: boolean }> => {
      const supabase = getSupabaseBrowserClient()

      // Si el correo cambió, se pide a Supabase Auth que lo actualice de verdad (manda
      // un correo de confirmación al nuevo destino; auth.users.email no cambia hasta que
      // se confirma). No se bloquea el guardado del resto del perfil si esto falla — es
      // un paso extra sobre lo que ya hacía esta función antes de la migración.
      //
      // BUG CORREGIDO: este error solo se registraba en consola — el llamador
      // (components/settings-dialog.tsx) no tenía forma de saber que el cambio de
      // correo específicamente había fallado (correo repetido, formato inválido según
      // Supabase, etc.) y mostraba "guardado correctamente" igual. Ahora se devuelve
      // el resultado para que el llamador pueda avisar y revertir el campo.
      let emailUpdateFailed = false
      if (user && profile.email && profile.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: profile.email })
        if (emailError) {
          console.error("No se pudo actualizar el correo en Supabase Auth:", emailError)
          emailUpdateFailed = true
        }
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
          product_updates_opt_in: profile.productUpdatesOptIn,
        })
        .eq("id", profile.id)

      if (error) {
        console.error("No se pudo guardar el perfil en Supabase:", error)
        throw error
      }

      // Si el correo falló, no se refleja el correo nuevo en el perfil/usuario local —
      // el correo real de la sesión sigue siendo el anterior hasta que Supabase Auth
      // lo confirme de verdad.
      const effectiveProfile = emailUpdateFailed ? { ...profile, email: user?.email || profile.email } : profile

      setUserProfile(effectiveProfile)
      setUser((currentUser) =>
        currentUser ? { ...currentUser, name: effectiveProfile.fullName, email: effectiveProfile.email } : currentUser,
      )
      window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: effectiveProfile }))

      return { emailUpdateFailed }
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
