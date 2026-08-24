// Control de acceso por plan de suscripcion. La fuente de verdad real es la tabla
// account_plans en Supabase (ver supabase/migrations/0004_account_plans.sql) — el
// cliente NO puede escribirla directo (RLS solo permite leer la propia fila), así
// que el slug que devuelve getCurrentPlanSlug() de aquí abajo es un CACHÉ local
// (localStorage) que contexts/auth-context.tsx sincroniza desde account_plans justo
// después de resolver la sesión, para que las ~20 pantallas que ya llaman a
// hasFeatureAccess()/getCurrentPlan() de forma síncrona durante el render (patrón
// usado en toda la app, ver useFeatureAccess más abajo) no tuvieran que reescribirse
// a async. setCurrentPlanSlug() sigue existiendo para actualizar ESE caché al
// instante después de que el servidor ya confirmó el cambio real (ver
// app/api/plan/set-free/route.ts, app/api/plan/dev-account/route.ts,
// app/api/checkout/session/route.ts) — nunca es, por sí sola, lo que otorga el plan.
//
// Un solo plan por cuenta (no por negocio): la tabla de precios del dueno del
// proyecto gatea "hasta N negocios" y "hasta N usuarios" a nivel de cuenta, no
// por negocio individual.

import { useEffect, useState } from "react"
import { plans, getPlanBySlug, type Plan, type FeatureKey } from "./plans"
import { getActivePreviewMember, TEAM_PREVIEW_EVENT } from "./storage/team-preview"

const PLAN_STORAGE_KEY = "current_plan_slug"
const PLAN_CHANGE_EVENT = "planChanged"
const DEFAULT_PLAN_SLUG = "foodie"

// Ficha Técnica, Mis Recetas e Ingredientes están disponibles en todos los planes
// (incluido Foodie gratis) — nunca aparecen en Plan.unlockedFeatures. Solo se vuelven
// restringibles de verdad durante una vista previa de Equipo (ver abajo), donde el
// dueño de la cuenta sí puede desmarcarlas para una persona específica.
const DEFAULT_ALWAYS_ON_FEATURES: FeatureKey[] = ["recipes", "ingredients", "pdf_export"]

export function getCurrentPlanSlug(): string {
  if (typeof window === "undefined") return DEFAULT_PLAN_SLUG
  return localStorage.getItem(PLAN_STORAGE_KEY) || DEFAULT_PLAN_SLUG
}

export function getCurrentPlan(): Plan {
  return getPlanBySlug(getCurrentPlanSlug())
}

export function setCurrentPlanSlug(slug: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PLAN_STORAGE_KEY, slug)
  window.dispatchEvent(new CustomEvent(PLAN_CHANGE_EVENT, { detail: slug }))
}

// BUG CORREGIDO / feature nueva: el panel de Equipo (/equipo) guardaba a qué
// herramientas tenía acceso cada persona invitada, pero nada en la app leía nunca ese
// permiso — sin backend real no existe una sesión separada para cada invitado que
// pudiera aplicarlo. Este chequeo central ahora consulta primero si hay una "vista
// previa" activa (ver lib/storage/team-preview.ts, activada desde una tarjeta de
// /equipo) y, si la hay, la respuesta depende ÚNICAMENTE de lo que esa persona tiene
// permitido — ignora el plan real de la cuenta. Sin vista previa activa (el caso de
// todos los días, el dueño de la cuenta usando su propia sesión), el comportamiento es
// exactamente el de antes: byte a byte el mismo resultado que ya devolvía esta función.
export function hasFeatureAccess(feature: FeatureKey): boolean {
  const preview = getActivePreviewMember()
  if (preview) {
    // El acceso a PDF administrativo (costos y márgenes) de una persona invitada se
    // configura aparte, en su propio control de 3 niveles (pdfAccess), no en la lista
    // de herramientas — se traduce acá al mismo FeatureKey que ya usan los puntos
    // reales de exportación (ver components/recipe-pdf-export-dialog.tsx, app/menus).
    if (feature === "pdf_admin") return preview.pdfAccess === "administrativo"
    // "cliente" y "administrativo" pueden exportar algo (empleado/normal, o los tres
    // tipos respectivamente); "ninguno" no puede exportar ningún PDF de receta.
    if (feature === "pdf_export") return preview.pdfAccess !== "ninguno"
    return preview.allowedFeatures.includes(feature)
  }
  if (DEFAULT_ALWAYS_ON_FEATURES.includes(feature)) return true
  return getCurrentPlan().unlockedFeatures.includes(feature)
}

// Para que cada pantalla bloqueada muestre el mensaje correcto: "tu plan no lo
// incluye" (FeatureLockedPage, con CTA a planes) vs. "el administrador de tu cuenta lo
// desactivó para ti" (AdminRestrictedPage, con instrucción de contactarlo) — son
// causas distintas y confundirlas sería un mensaje falso en cualquiera de los dos
// casos. Devuelve null cuando sí hay acceso (nada que explicar).
export function getAccessBlockReason(feature: FeatureKey): "plan" | "admin" | null {
  const preview = getActivePreviewMember()
  if (preview) {
    const allowed =
      feature === "pdf_admin"
        ? preview.pdfAccess === "administrativo"
        : feature === "pdf_export"
          ? preview.pdfAccess !== "ninguno"
          : preview.allowedFeatures.includes(feature)
    return allowed ? null : "admin"
  }
  if (DEFAULT_ALWAYS_ON_FEATURES.includes(feature)) return null
  return getCurrentPlan().unlockedFeatures.includes(feature) ? null : "plan"
}

export function getMaxBusinesses(): number {
  return getCurrentPlan().maxBusinesses
}

export function getMaxUsers(): number {
  return getCurrentPlan().maxUsers
}

// Primer plan (en el orden de lib/plans.ts) que desbloquea una funcion dada —
// usado para armar el CTA "Actualiza a {plan}" en las pantallas bloqueadas.
export function getMinimumPlanForFeature(feature: FeatureKey): Plan | null {
  return plans.find((p) => p.unlockedFeatures.includes(feature) && !p.comingSoon) || null
}

// BUG CORREGIDO (ver docs/33): las paginas gateadas llamaban hasFeatureAccess()
// directo durante el render. En el servidor (SSR/build estatico) no existe
// localStorage, asi que getCurrentPlanSlug() ahi siempre devuelve "foodie" — pero
// en el navegador, apenas hidrata, lee el plan REAL guardado. Si esos dos
// resultados no coinciden (cualquier plan pago), el HTML que React hidrata no
// coincide con lo que el servidor mando, y React tira "Hydration failed"
// (confirmado en vivo: /menus con plan Sous Chef reventaba al cargar). Este hook
// devuelve `null` mientras el componente todavia no termino de montar en el
// cliente — exactamente el mismo patron que `authChecked` en contexts/auth-context.tsx
// — para que el primer render del cliente coincida con el del servidor, y solo
// despues de eso se revele el resultado real.
export function useFeatureAccess(feature: FeatureKey): boolean | null {
  const [mounted, setMounted] = useState(false)
  // Re-renderiza cuando se activa/desactiva una vista previa de Equipo (ver
  // lib/storage/team-preview.ts) para que el resultado cambie al instante en toda la
  // app sin necesitar recargar la página — mismo patrón que "planChanged" más abajo.
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    setMounted(true)
    const onPreviewChange = () => forceUpdate((n) => n + 1)
    window.addEventListener(TEAM_PREVIEW_EVENT, onPreviewChange)
    return () => window.removeEventListener(TEAM_PREVIEW_EVENT, onPreviewChange)
  }, [])
  if (!mounted) return null
  return hasFeatureAccess(feature)
}

// Mismo patron de hidratacion que useFeatureAccess de arriba, para /planes: necesita
// saber el slug real del plan actual (para mostrar "Plan actual" y decidir el CTA de
// cada tarjeta) sin volver a caer en el mismo bug de hidratacion.
export function useCurrentPlanSlug(): string | null {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return getCurrentPlanSlug()
}

// Estado de la vista previa de Equipo, con el mismo patrón de hidratación — usado por
// el banner permanente (components/team-preview-banner.tsx), el sidebar (para filtrar
// navegación) y las pantallas de Dashboard/negocio (para exigir el alcance correcto).
export function useTeamPreview() {
  const [mounted, setMounted] = useState(false)
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    setMounted(true)
    const onPreviewChange = () => forceUpdate((n) => n + 1)
    window.addEventListener(TEAM_PREVIEW_EVENT, onPreviewChange)
    return () => window.removeEventListener(TEAM_PREVIEW_EVENT, onPreviewChange)
  }, [])
  if (!mounted) return { active: false, member: null } as const
  const member = getActivePreviewMember()
  return { active: !!member, member } as const
}
