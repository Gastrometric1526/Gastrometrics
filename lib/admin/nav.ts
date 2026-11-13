/**
 * Desde docs/292 (rediseño desde cero, pedido del dueño): 5 espacios siempre a la vista
 * —Hoy, Mensajes, Personas, Números y Sistema— (`ADMIN_SPACES`, al final del archivo); cada
 * espacio muestra todas sus partes en botones agrupados y la parte elegida debajo. Las áreas
 * y bloques de abajo (`ADMIN_SECTIONS`) siguen siendo las piezas y los id de la URL.
 *
 * Mapa de /admin (docs/279, rediseñado en docs/281): un Inicio con 6 tarjetas grandes
 * (áreas); cada área abre un índice de sus partes y
 * cada parte se ve sola (docs/287) —sin barra lateral ni submenús—. Una sola fuente para el Inicio, el buscador «¿Qué quieres hacer?», la Guía y
 * el «Cómo se usa». Los id de área y bloque son los de la URL (`?tab=…&sub=…`), los mismos
 * que usan los avisos push y NOTICE_TARGET: no cambiarlos. `?tab=uso` (antes una sección
 * aparte) abre «Crecimiento y uso».
 */

import type { TranslationKey } from "@/lib/i18n/translations"

export const ADMIN_TABS = ["resumen", "buzon", "cuentas", "ingresos", "crecimiento", "comunicacion", "sistema", "guia"] as const
export type AdminTab = (typeof ADMIN_TABS)[number]

/**
 * Una parte de un área. En el índice del área se muestra como tarjeta; al tocarla queda sola
 * en pantalla (docs/287). `group`: título que agrupa partes seguidas en el índice.
 */
export type AdminSub = { id: string; label: TranslationKey; desc: TranslationKey; group?: TranslationKey }
export type AdminSection = {
  id: AdminTab
  label: TranslationKey
  desc: TranslationKey
  /** Una línea corta para la tarjeta del Inicio. */
  short?: TranslationKey
  /** Pasos de «Cómo se usa», separados por salto de línea (uno o varios textos). */
  howTo?: TranslationKey[]
  /** Bloques del área, en el orden en que se muestran. */
  subs?: AdminSub[]
}

export const ADMIN_SECTIONS: Record<AdminTab, AdminSection> = {
  resumen: { id: "resumen", label: "admin_home_title", desc: "admin_tabdesc_resumen", howTo: ["admin_howto_resumen"] },
  buzon: {
    id: "buzon",
    label: "admin_area_buzon",
    desc: "admin_tabdesc_inbox",
    short: "admin_area_buzon_short",
    howTo: ["admin_howto_buzon"],
    subs: [
      { id: "chat", label: "admin_tab_support_chat", desc: "admin_subdesc_chat" },
      { id: "mensajes", label: "admin_block_mensajes", desc: "admin_subdesc_mensajes" },
      // Solicitudes para recuperar una cuenta (docs/285).
      { id: "recuperar", label: "admin_recovery_title", desc: "admin_subdesc_recuperar" },
      { id: "encuestas", label: "admin_tab_surveys", desc: "admin_subdesc_encuestas" },
      { id: "resenas", label: "admin_tab_reviews", desc: "admin_subdesc_resenas" },
    ],
  },
  cuentas: {
    id: "cuentas",
    label: "admin_area_cuentas",
    desc: "admin_tabdesc_accounts",
    short: "admin_area_cuentas_short",
    howTo: ["admin_howto_cuentas"],
    subs: [
      { id: "lista", label: "admin_block_lista", desc: "admin_subdesc_lista" },
      { id: "cifras", label: "admin_block_cifras", desc: "admin_subdesc_cifras" },
      { id: "historial", label: "admin_block_historial", desc: "admin_subdesc_historial" },
    ],
  },
  ingresos: { id: "ingresos", label: "admin_area_ingresos", desc: "admin_tabdesc_revenue", short: "admin_area_ingresos_short", howTo: ["admin_howto_ingresos"] },
  crecimiento: {
    id: "crecimiento",
    label: "admin_area_crecimiento",
    desc: "admin_area_crecimiento_desc",
    short: "admin_area_crecimiento_short",
    howTo: ["admin_howto_crecimiento", "admin_howto_uso"],
    subs: [
      { id: "numeros", label: "admin_block_numeros", desc: "admin_subdesc_numeros", group: "admin_group_overview" },
      // Toda la app: totales, uso por módulo, actividad y reparto de las cuentas (docs/286).
      { id: "app", label: "admin_block_app", desc: "admin_subdesc_app", group: "admin_group_overview" },
      { id: "etapas", label: "admin_sub_account_funnel", desc: "admin_subdesc_etapas", group: "admin_group_accounts" },
      { id: "retencion", label: "admin_sub_retention", desc: "admin_subdesc_retencion", group: "admin_group_accounts" },
      { id: "activacion", label: "admin_tab_activation", desc: "admin_subdesc_activacion", group: "admin_group_accounts" },
      { id: "usuarios", label: "admin_sub_top_users", desc: "admin_subdesc_usuarios", group: "admin_group_accounts" },
      // Qué PDF descargó cada cuenta y cuándo (docs/291).
      { id: "pdf", label: "admin_block_pdf", desc: "admin_subdesc_pdf", group: "admin_group_accounts" },
      { id: "inactivos", label: "admin_sub_inactive", desc: "admin_subdesc_inactivos", group: "admin_group_accounts" },
      { id: "referidos", label: "admin_sub_referrals", desc: "admin_subdesc_referidos", group: "admin_group_growth" },
      { id: "embudo", label: "admin_sub_funnel", desc: "admin_subdesc_embudo", group: "admin_group_growth" },
      { id: "correos", label: "admin_sub_email_clicks", desc: "admin_subdesc_correos", group: "admin_group_growth" },
      { id: "importaciones", label: "admin_sub_imports", desc: "admin_subdesc_importaciones", group: "admin_group_growth" },
    ],
  },
  comunicacion: {
    id: "comunicacion",
    label: "admin_area_comunicacion",
    desc: "admin_tabdesc_comms",
    short: "admin_area_comunicacion_short",
    howTo: ["admin_howto_comunicacion"],
    subs: [
      { id: "novedades", label: "admin_tab_product_updates", desc: "admin_subdesc_novedades" },
      { id: "legal", label: "admin_sub_legal", desc: "admin_subdesc_legal" },
    ],
  },
  sistema: {
    id: "sistema",
    label: "admin_tab_system",
    desc: "admin_tabdesc_system",
    short: "admin_area_sistema_short",
    howTo: ["admin_howto_sistema"],
    // Partes con nombre (docs/287): antes eran 3 tarjetas sueltas una debajo de la otra.
    subs: [
      { id: "salud", label: "admin_block_health", desc: "admin_subdesc_health" },
      { id: "acceso", label: "admin_block_access", desc: "admin_subdesc_access" },
      { id: "herramientas", label: "admin_block_tools", desc: "admin_subdesc_tools" },
    ],
  },
  guia: { id: "guia", label: "admin_tab_guide", desc: "admin_tabdesc_guide" },
}

/** Las 6 tarjetas del Inicio, en este orden: lo de cada día primero. */
export const HOME_AREAS: AdminTab[] = ["buzon", "cuentas", "ingresos", "crecimiento", "comunicacion", "sistema"]

/** Direcciones viejas que siguen funcionando (`?tab=uso` → Crecimiento y uso). */
const TAB_ALIASES: Record<string, AdminTab> = { uso: "crecimiento" }

/** Lee el área de la dirección (con los alias viejos); null si no es un área. */
export function resolveAdminTab(value: string | null | undefined): AdminTab | null {
  if (!value) return null
  if ((ADMIN_TABS as readonly string[]).includes(value)) return value as AdminTab
  return TAB_ALIASES[value] ?? null
}

export function isAdminTab(value: string | null | undefined): value is AdminTab {
  return !!value && (ADMIN_TABS as readonly string[]).includes(value)
}

/**
 * Tareas de la Guía. Los pasos llevan marcas `{clave}` que se cambian por el texto real del
 * botón o pestaña (`vars`), para que la guía diga siempre lo mismo que la pantalla.
 */
export type AdminTask = {
  id: string
  title: TranslationKey
  steps: TranslationKey
  tab: AdminTab
  sub?: string
  /** Algo que preparar antes de ir (p. ej. ordenar Cuentas por vencimiento). */
  prepare?: "sortExpiring"
  vars?: Record<string, TranslationKey>
}

export const ADMIN_TASKS: AdminTask[] = [
  { id: "plan", title: "admin_task_plan", steps: "admin_task_plan_steps", tab: "cuentas", sub: "lista", vars: { plan: "admin_acc_sub_plan", apply: "admin_accounts_apply_button" } },
  { id: "recovery", title: "admin_task_recovery", steps: "admin_task_recovery_steps", tab: "buzon", sub: "recuperar", vars: { recovery: "admin_recovery_title", open: "admin_recovery_open_account", resolved: "admin_recovery_mark_resolved" } },
  {
    id: "access",
    title: "admin_task_access",
    steps: "admin_task_access_steps",
    tab: "cuentas",
    sub: "lista",
    vars: { access: "admin_acc_sub_access", resend: "admin_resend_confirmation", reset: "admin_accounts_send_reset_button", temp: "admin_accounts_set_temp_password_button", email: "admin_accounts_change_email_button" },
  },
  { id: "restore", title: "admin_task_restore", steps: "admin_task_restore_steps", tab: "cuentas", sub: "lista", vars: { backups: "admin_backups_tab", create: "admin_backups_create", restore: "admin_backups_restore" } },
  { id: "deleted", title: "admin_task_deleted", steps: "admin_task_deleted_steps", tab: "cuentas", sub: "lista", vars: { backups: "admin_backups_tab", bring: "admin_backups_deleted_title", restore: "admin_backups_deleted_restore" } },
  { id: "chat", title: "admin_task_chat", steps: "admin_task_chat_steps", tab: "buzon", sub: "chat", vars: { reply: "admin_support_reply", close: "admin_support_close" } },
  { id: "messages", title: "admin_task_messages", steps: "admin_task_messages_steps", tab: "buzon", sub: "mensajes", vars: { reply: "admin_reply_button", archive: "admin_archive" } },
  { id: "reviews", title: "admin_task_reviews", steps: "admin_task_reviews_steps", tab: "buzon", sub: "resenas", vars: { publish: "admin_reviews_publish" } },
  { id: "expiring", title: "admin_task_expiring", steps: "admin_task_expiring_steps", tab: "cuentas", sub: "lista", prepare: "sortExpiring", vars: { expiring: "admin_accounts_sort_expiring" } },
  { id: "revenue", title: "admin_task_revenue", steps: "admin_task_revenue_steps", tab: "ingresos" },
  { id: "stuck", title: "admin_task_stuck", steps: "admin_task_stuck_steps", tab: "crecimiento", sub: "etapas" },
  { id: "news", title: "admin_task_news", steps: "admin_task_news_steps", tab: "comunicacion", sub: "novedades", vars: { send: "admin_product_updates_send_button" } },
  { id: "legal", title: "admin_task_legal", steps: "admin_task_legal_steps", tab: "comunicacion", sub: "legal", vars: { send: "admin_legal_update_send_button" } },
  { id: "system", title: "admin_task_system", steps: "admin_task_system_steps", tab: "sistema", sub: "salud" },
  { id: "export", title: "admin_task_export", steps: "admin_task_export_steps", tab: "sistema", sub: "herramientas", vars: { export: "admin_export_all_button" } },
  { id: "admin-access", title: "admin_task_access_panel", steps: "admin_task_access_panel_steps", tab: "sistema", sub: "acceso", vars: { accesstitle: "admin_access_title", send: "admin_access_add_send", save: "admin_access_add_save", sendlater: "admin_access_send" } },
  { id: "push", title: "admin_task_push", steps: "admin_task_push_steps", tab: "sistema", sub: "herramientas", vars: { push: "admin_push_enable" } },
]

/** Las tareas que salen como accesos rápidos en el Resumen. */
export const QUICK_TASKS = ["chat", "plan", "access", "restore", "expiring", "news"]

/**
 * Nombres de secciones que cualquier texto de la guía puede usar (`{accounts} → {list}`),
 * para que en cada idioma digan exactamente lo que dice la barra lateral.
 */
export const COMMON_VARS: Record<string, TranslationKey> = {
  overview: "admin_space_hoy",
  today: "admin_todo_title",
  inbox: "admin_space_mensajes",
  chat: "admin_tab_support_chat",
  feedback: "admin_block_mensajes",
  surveys: "admin_tab_surveys",
  reviews: "admin_tab_reviews",
  accounts: "admin_space_personas",
  list: "admin_block_lista",
  history: "admin_block_historial",
  revenue: "admin_area_ingresos",
  growth: "admin_space_numeros",
  stages: "admin_sub_account_funnel",
  retention: "admin_sub_retention",
  activation: "admin_tab_activation",
  referrals: "admin_sub_referrals",
  topusers: "admin_sub_top_users",
  inactive: "admin_sub_inactive",
  usage: "admin_space_numeros",
  funnel: "admin_sub_funnel",
  emails: "admin_sub_email_clicks",
  imports: "admin_sub_imports",
  comms: "admin_space_mensajes",
  news: "admin_tab_product_updates",
  legal: "admin_sub_legal",
  system: "admin_space_sistema",
  health: "admin_block_health",
  access: "admin_block_access",
  tools: "admin_block_tools",
  guide: "admin_tab_guide",
  go: "admin_guide_go",
}

/** Cambia las marcas `{clave}` de un texto por el texto real de cada botón o sección. */
export function fillVars(text: string, vars: Record<string, TranslationKey> | undefined, t: (key: TranslationKey) => string): string {
  const all = { ...COMMON_VARS, ...(vars ?? {}) }
  return text.replace(/\{([a-z]+)\}/g, (whole, name: string) => (all[name] ? t(all[name]) : whole))
}

/** Pasos de «Cómo se usa» de una sección, ya con los nombres reales. */
export function howToSteps(section: AdminSection, t: (key: TranslationKey) => string): string[] {
  if (!section.howTo) return []
  return section.howTo
    .map((key) => fillVars(t(key), undefined, t))
    .join("\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function taskSteps(task: AdminTask, t: (key: TranslationKey) => string): string[] {
  return fillVars(t(task.steps), task.vars, t)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export type AdminSearchResult =
  | { kind: "section"; tab: AdminTab; sub?: string; title: string; detail: string }
  | { kind: "task"; tab: AdminTab; sub?: string; task: AdminTask; title: string; detail: string }

/**
 * Buscador «¿Qué quieres hacer?»: busca en los nombres y descripciones de secciones y
 * sub-secciones y en las tareas de la Guía (título y pasos), en el idioma de la app.
 * Todas las palabras tienen que aparecer; las tareas van primero porque responden «cómo».
 */
export function searchAdmin(query: string, t: (key: TranslationKey) => string, limit = 8): AdminSearchResult[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const matches = (hay: string) => {
    const h = norm(hay)
    return words.every((w) => h.includes(w))
  }
  const tasks: AdminSearchResult[] = []
  for (const task of ADMIN_TASKS) {
    const title = t(task.title)
    const steps = taskSteps(task, t)
    if (matches(`${title} ${steps.join(" ")}`)) tasks.push({ kind: "task", tab: task.tab, sub: task.sub, task, title, detail: steps[0] ?? "" })
  }
  const sections: AdminSearchResult[] = []
  for (const space of ADMIN_SPACES) {
    const spaceTitle = t(space.label)
    for (const part of spaceParts(space)) {
      const info = partInfo(part.tab, part.sub)
      if (!info) continue
      const title = space.id === "hoy" ? spaceTitle : `${spaceTitle} › ${t(info.label)}`
      if (matches(`${spaceTitle} ${t(space.desc)} ${t(info.label)} ${t(info.desc)}`)) sections.push({ kind: "section", tab: part.tab, sub: part.sub, title, detail: t(info.desc) })
    }
  }
  return [...tasks, ...sections].slice(0, limit)
}

// ─── Espacios (docs/292) ─────────────────────────────────────────────────────

export type AdminSpaceId = "hoy" | "mensajes" | "personas" | "numeros" | "sistema"
export type AdminPartRef = { tab: AdminTab; sub: string }
export type AdminSpace = {
  id: AdminSpaceId
  label: TranslationKey
  desc: TranslationKey
  howTo?: TranslationKey[]
  /** Partes del espacio, en grupos con título (o un grupo sin título). */
  groups: { label?: TranslationKey; parts: AdminPartRef[] }[]
}

/**
 * Partes que no son bloques de un área: Dinero (el área `ingresos` entera), Hoy y la Guía.
 * Se nombran con un `sub` propio para que todo se elija igual.
 */
const SINGLE_PARTS: Record<string, { label: TranslationKey; desc: TranslationKey }> = {
  "resumen:hoy": { label: "admin_space_hoy", desc: "admin_space_hoy_desc" },
  "ingresos:dinero": { label: "admin_area_ingresos", desc: "admin_tabdesc_revenue" },
  "guia:guia": { label: "admin_tab_guide", desc: "admin_tabdesc_guide" },
}

const parts = (tab: AdminTab, subs: string[]): AdminPartRef[] => subs.map((sub) => ({ tab, sub }))

export const ADMIN_SPACES: AdminSpace[] = [
  { id: "hoy", label: "admin_space_hoy", desc: "admin_space_hoy_desc", howTo: ["admin_howto_resumen"], groups: [{ parts: parts("resumen", ["hoy"]) }] },
  {
    id: "mensajes",
    label: "admin_space_mensajes",
    desc: "admin_space_mensajes_desc",
    howTo: ["admin_howto_buzon", "admin_howto_comunicacion"],
    groups: [
      { label: "admin_group_inbox", parts: parts("buzon", ["chat", "mensajes", "recuperar"]) },
      { label: "admin_group_opinions", parts: parts("buzon", ["encuestas", "resenas"]) },
      { label: "admin_group_broadcast", parts: parts("comunicacion", ["novedades", "legal"]) },
    ],
  },
  { id: "personas", label: "admin_space_personas", desc: "admin_space_personas_desc", howTo: ["admin_howto_cuentas"], groups: [{ parts: parts("cuentas", ["lista", "cifras", "historial"]) }] },
  {
    id: "numeros",
    label: "admin_space_numeros",
    desc: "admin_space_numeros_desc",
    howTo: ["admin_howto_ingresos", "admin_howto_crecimiento", "admin_howto_uso"],
    groups: [
      { label: "admin_group_money", parts: [{ tab: "ingresos", sub: "dinero" }] },
      { label: "admin_group_overview", parts: parts("crecimiento", ["numeros", "app"]) },
      { label: "admin_group_accounts", parts: parts("crecimiento", ["etapas", "retencion", "activacion", "usuarios", "pdf", "inactivos"]) },
      { label: "admin_group_growth", parts: parts("crecimiento", ["referidos", "embudo", "correos", "importaciones"]) },
    ],
  },
  {
    id: "sistema",
    label: "admin_space_sistema",
    desc: "admin_space_sistema_desc",
    howTo: ["admin_howto_sistema"],
    groups: [{ parts: [...parts("sistema", ["salud", "acceso", "herramientas"]), { tab: "guia", sub: "guia" }] }],
  },
]

export function spaceParts(space: AdminSpace): AdminPartRef[] {
  return space.groups.flatMap((g) => g.parts)
}

/** Nombre y descripción de una parte. */
export function partInfo(tab: AdminTab, sub: string): { label: TranslationKey; desc: TranslationKey } | null {
  const single = SINGLE_PARTS[`${tab}:${sub}`]
  if (single) return single
  const found = ADMIN_SECTIONS[tab]?.subs?.find((s) => s.id === sub)
  return found ? { label: found.label, desc: found.desc } : null
}

/**
 * Dónde cae una dirección (`?tab=…&sub=…`, también las de avisos y tareas viejas): el espacio
 * y la parte. Sin `sub` (o uno que no existe), la primera parte del espacio.
 */
export function locate(tab: AdminTab, sub?: string | null): { space: AdminSpace; part: AdminPartRef } {
  const normalizedSub = tab === "ingresos" ? "dinero" : tab === "guia" ? "guia" : tab === "resumen" ? "hoy" : sub
  for (const space of ADMIN_SPACES) {
    const all = spaceParts(space)
    const exact = all.find((p) => p.tab === tab && p.sub === normalizedSub)
    if (exact) return { space, part: exact }
  }
  for (const space of ADMIN_SPACES) {
    const first = spaceParts(space).find((p) => p.tab === tab)
    if (first) return { space, part: first }
  }
  return { space: ADMIN_SPACES[0], part: spaceParts(ADMIN_SPACES[0])[0] }
}

/** Pasos de «Cómo se usa» de un espacio. */
export function spaceHowTo(space: AdminSpace, t: (key: TranslationKey) => string): string[] {
  return howToSteps({ id: "resumen", label: space.label, desc: space.desc, howTo: space.howTo }, t)
}
