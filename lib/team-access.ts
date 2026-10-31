/**
 * Permisos de Equipo más finos (pedido del dueño, docs/216): «asegúrate de que todos estos
 * nuevos módulos, PDFs, funciones y todo sean cosas seleccionables a que darle acceso a la
 * gente en teams».
 *
 * Dos permisos nuevos que antes iban pegados a otro:
 * - "mep": la MEP (antes la daba "menus");
 * - "sales_history": el historial de ventas y el «Detalle por mesas» (antes los daba
 *   cualquiera de "manual_sales"/"stats_finance"), para poder registrar ventas sin ver
 *   los totales, o al revés.
 *
 * Los planes NO cambian (decisión de negocio): se desbloquean con lo mismo que antes
 * (`planFeaturesFor`). Las personas ya invitadas no pierden nada: hasta que el dueño las
 * edite, conservan lo que les daba el permiso anterior (`effectiveMemberFeatures`). Al
 * guardar desde Equipo se agrega la marca `TEAM_ACCESS_V2` y desde ahí cuenta solo lo
 * marcado. Puro, probado en team-access.test.ts.
 */

import type { FeatureKey } from "@/lib/plans"

/** Marca guardada en allowed_features: la lista ya es la de docs/216 (sin equivalencias). */
export const TEAM_ACCESS_V2 = "access_v2"

const LEGACY_IMPLIED: { feature: FeatureKey; impliedBy: FeatureKey[] }[] = [
  { feature: "mep", impliedBy: ["menus"] },
  { feature: "sales_history", impliedBy: ["manual_sales", "stats_finance"] },
  // Cuadre de caja (docs/217): quien ya registraba ventas a mano lo conserva.
  { feature: "cash_up", impliedBy: ["manual_sales"] },
]

/** Permisos reales de una persona del equipo (sin la marca y con las equivalencias antiguas). */
export function effectiveMemberFeatures(stored: readonly string[]): FeatureKey[] {
  const list = stored.filter((f) => f !== TEAM_ACCESS_V2) as FeatureKey[]
  if (stored.includes(TEAM_ACCESS_V2)) return list
  const out = [...list]
  for (const { feature, impliedBy } of LEGACY_IMPLIED) {
    if (!out.includes(feature) && impliedBy.some((f) => list.includes(f))) out.push(feature)
  }
  return out
}

/**
 * Permisos que necesitan otro para funcionar: el cuadre de caja se guarda en el registro de
 * ventas del día, que la base solo deja escribir con «Registro manual de ventas» (docs/217).
 */
export const FEATURE_REQUIRES: Partial<Record<FeatureKey, FeatureKey>> = { cash_up: "manual_sales" }

/** Marca o desmarca un permiso respetando sus dependencias. */
export function toggleTeamFeature(selected: readonly FeatureKey[], key: FeatureKey, checked: boolean): FeatureKey[] {
  let next = checked ? [...new Set([...selected, key])] : selected.filter((f) => f !== key)
  if (checked && FEATURE_REQUIRES[key] && !next.includes(FEATURE_REQUIRES[key]!)) next = [...next, FEATURE_REQUIRES[key]!]
  if (!checked) {
    const dependents = (Object.keys(FEATURE_REQUIRES) as FeatureKey[]).filter((d) => FEATURE_REQUIRES[d] === key)
    next = next.filter((f) => !dependents.includes(f))
  }
  return next
}

/** Lo que se guarda desde Equipo: los permisos marcados más la marca. */
export function featuresToStore(selected: readonly FeatureKey[]): string[] {
  return [...new Set(selected.filter((f) => (f as string) !== TEAM_ACCESS_V2)), TEAM_ACCESS_V2]
}

/** Qué funciones del plan desbloquean este permiso (los planes no cambian con docs/216). */
export function planFeaturesFor(feature: FeatureKey): FeatureKey[] {
  if (feature === "mep") return ["menus"]
  if (feature === "sales_history") return ["manual_sales", "stats_finance"]
  if (feature === "cash_up") return ["manual_sales"]
  return [feature]
}
