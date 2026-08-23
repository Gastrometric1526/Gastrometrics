/**
 * Autenticación real con Supabase Auth — código listo, NO conectado todavía.
 *
 * Hoy `contexts/auth-context.tsx` es un login falso: cualquier usuario/
 * contraseña entra, y "crea" un usuario armando un objeto en localStorage
 * (ver ese archivo, función `login`). Este módulo es el reemplazo real,
 * pensado para conectarse el día que exista un proyecto de Supabase:
 *
 *   1. Crear el proyecto en supabase.com, correr supabase/migrations/0001_init.sql.
 *   2. Configurar NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local).
 *   3. En contexts/auth-context.tsx, reemplazar login/logout/signup por las
 *      funciones de aquí, y el useEffect de montaje por
 *      supabase.auth.onAuthStateChange (mantiene isLoggedIn/user sincronizados
 *      con la sesión real en vez de leer localStorage a mano).
 *
 * Nada de este archivo se ejecuta hoy — no hay ningún import activo desde
 * contexts/auth-context.tsx todavía, a propósito (ver docs/12-guia-backend.md).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export interface AuthResult {
  userId: string
  email: string
}

export async function signUpWithEmail(email: string, password: string, fullName: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) throw error
  if (!data.user) throw new Error("No se pudo crear la cuenta — intenta de nuevo.")

  return { userId: data.user.id, email: data.user.email ?? email }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) throw error
  if (!data.user) throw new Error("No se pudo iniciar sesión — verifica tus credenciales.")

  return { userId: data.user.id, email: data.user.email ?? email }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
  })
  if (error) throw error
}

export async function getCurrentUser(): Promise<AuthResult | null> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return { userId: user.id, email: user.email ?? "" }
}

/**
 * Suscribirse a cambios de sesión (login/logout/token refresh) — reemplaza
 * el patrón actual de leer localStorage("isLoggedIn") una sola vez al montar.
 * Devuelve una función para cancelar la suscripción (llamar en el cleanup
 * del useEffect que la use).
 */
export function onAuthStateChange(callback: (user: AuthResult | null) => void): () => void {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({ userId: session.user.id, email: session.user.email ?? "" })
    } else {
      callback(null)
    }
  })

  return () => subscription.unsubscribe()
}

/**
 * Genera un link de invitación para compartir un negocio (plan de multiusuario
 * ya confirmado, ver CLAUDE.md y docs/12-guia-backend.md sección
 * "Plan de multiusuario"). Inserta en la tabla `business_invites` (no en
 * `business_members` directo — todavía no hay un user_id real hasta que la
 * persona invitada acepte estando logueada). `acceptBusinessInvite` de abajo
 * es el otro lado: mueve la invitación aceptada a `business_members`.
 */
export async function inviteToBusiness(businessId: string, role: string): Promise<{ inviteToken: string }> {
  const supabase = getSupabaseBrowserClient()
  const inviteToken = crypto.randomUUID()

  const { error } = await supabase.from("business_invites").insert({
    token: inviteToken,
    business_id: businessId,
    role,
  })

  if (error) throw error
  return { inviteToken }
}

/**
 * La persona invitada, ya logueada con su propia cuenta, acepta la
 * invitación con el token del link — esto la agrega de verdad a
 * business_members y borra la invitación ya usada.
 */
export async function acceptBusinessInvite(inviteToken: string): Promise<{ businessId: string }> {
  const supabase = getSupabaseBrowserClient()
  const user = await getCurrentUser()
  if (!user) throw new Error("Debes iniciar sesión antes de aceptar una invitación.")

  const { data: invite, error: fetchError } = await supabase
    .from("business_invites")
    .select("business_id, role")
    .eq("token", inviteToken)
    .single()

  if (fetchError || !invite) throw new Error("Invitación no válida o ya expiró.")

  const { error: insertError } = await supabase.from("business_members").insert({
    business_id: invite.business_id,
    user_id: user.userId,
    role: invite.role,
  })
  if (insertError) throw insertError

  await supabase.from("business_invites").delete().eq("token", inviteToken)

  return { businessId: invite.business_id }
}
