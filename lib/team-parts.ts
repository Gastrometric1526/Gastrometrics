/**
 * Partes de cada módulo y PDF por tipo para el equipo (pedido del dueño, docs/303): «qué
 * partes del POS y qué partes de cada módulo puede realmente acceder las personas invitadas,
 * al igual que qué PDFs, qué información».
 *
 * Se guardan en la misma lista `allowed_features` de `team_members` (texto), junto a los
 * módulos: «pos.charge», «pdf.recipe»… La base solo mira los módulos (`has_feature_access`),
 * así que estas claves no cambian lo que la persona puede leer o escribir en la base: deciden
 * qué botones y pantallas ve dentro del módulo.
 *
 * Personas invitadas antes de docs/303 (sin la marca `PARTS_V1`): conservan todo lo que ya
 * podían hacer (todas las partes y todos los PDF de su nivel), salvo Ajustes del POS, que
 * desde docs/302 es de quien gestiona el equipo. Puro, probado en team-parts.test.ts.
 */

/** Marca: la lista ya trae las partes elegidas una por una. */
export const PARTS_V1 = "parts_v1"

export const POS_PARTS = ["pos.orders", "pos.kitchen", "pos.charge", "pos.discount", "pos.void", "pos.receipts", "pos.floor_day", "pos.settings"] as const
export type PosPart = (typeof POS_PARTS)[number]

/** PDF que se pueden dar por tipo (además del nivel: para el cliente o administrativos). */
export const TEAM_PDF_KINDS = ["recipe", "menu", "mep", "inventory", "purchase_order", "invoice", "cash_up", "sales_history"] as const
export type TeamPdfKind = (typeof TEAM_PDF_KINDS)[number]

/**
 * Qué información ve (docs/304): «info.costs» = costos, márgenes, food cost, precios de compra,
 * valor del inventario y gastos del negocio. Sin ella, solo los precios de venta.
 */
export const INFO_PARTS = ["info.costs"] as const
export type InfoPart = (typeof INFO_PARTS)[number]

export type TeamPart = PosPart | InfoPart | `pdf.${TeamPdfKind}`

export const ALL_PARTS: TeamPart[] = [...POS_PARTS, ...INFO_PARTS, ...TEAM_PDF_KINDS.map((k) => `pdf.${k}` as TeamPart)]

const isPart = (s: string) => s === PARTS_V1 || s.startsWith("pos.") || s.startsWith("pdf.") || s.startsWith("info.")

/** Solo los módulos (sin partes ni marcas de partes). */
export function withoutParts(stored: readonly string[]): string[] {
  return stored.filter((s) => !isPart(s))
}

/** Partes elegidas, o null si la persona es de antes de docs/303 (lo de siempre). */
export function storedParts(stored: readonly string[]): TeamPart[] | null {
  if (!stored.includes(PARTS_V1)) return null
  return stored.filter((s) => s !== PARTS_V1 && isPart(s)) as TeamPart[]
}

/** Lo de siempre para quien no tiene partes elegidas: todo, menos Ajustes del POS sin «team». */
export function defaultParts(modules: readonly string[]): TeamPart[] {
  return ALL_PARTS.filter((p) => p !== "pos.settings" || modules.includes("team"))
}

/** ¿Esta persona tiene esta parte? */
export function memberHasPart(stored: readonly string[], part: TeamPart): boolean {
  const parts = storedParts(stored)
  return (parts ?? defaultParts(withoutParts(stored))).includes(part)
}

/** Lo que se guarda: módulos + marca + partes (sin repetir). */
export function partsToStore(modules: readonly string[], parts: readonly TeamPart[]): string[] {
  return [...new Set([...withoutParts(modules), PARTS_V1, ...parts])]
}

// ─── Plantillas de un toque ───────────────────────────────────────────────────

export type TeamRolePreset = "waiter" | "kitchen" | "cashier" | "manager"

export interface PresetResult {
  modules: string[]
  parts: TeamPart[]
  pdfAccess: "ninguno" | "cliente" | "administrativo"
}

/**
 * Plantillas para invitar rápido (se pueden cambiar después, una por una). Solo módulos que
 * incluye el plan del dueño (`planHas`), para no marcar lo que no puede dar.
 */
export function rolePreset(role: TeamRolePreset, planHas: (module: string) => boolean): PresetResult {
  const keep = (list: string[]) => list.filter(planHas)
  const allPdf = TEAM_PDF_KINDS.map((k) => `pdf.${k}` as TeamPart)
  switch (role) {
    case "waiter":
      return { modules: keep(["pos", "manual_sales"]), parts: ["pos.orders", "pos.charge", "pos.receipts"], pdfAccess: "ninguno" }
    case "kitchen":
      return { modules: keep(["recipes", "mep", "pos", "manual_sales"]), parts: ["pos.kitchen", "pdf.recipe", "pdf.mep"], pdfAccess: "cliente" }
    case "cashier":
      return {
        modules: keep(["pos", "manual_sales", "cash_up", "sales_history", "invoices"]),
        parts: ["pos.orders", "pos.charge", "pos.discount", "pos.void", "pos.receipts", "pdf.invoice", "pdf.cash_up"],
        pdfAccess: "cliente",
      }
    case "manager":
      return {
        modules: keep(["recipes", "ingredients", "merma", "menus", "mep", "inventory", "purchase_orders_manual", "purchase_orders_auto", "manual_sales", "sales_history", "cash_up", "invoices", "pos", "stats_panorama", "stats_finance"]),
        parts: [...POS_PARTS, ...INFO_PARTS, ...allPdf],
        pdfAccess: "administrativo",
      }
  }
}
