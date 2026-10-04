/**
 * Le avisa al dueño del proyecto por correo cada vez que alguien crea una cuenta
 * nueva (app/api/auth/signup/route.ts) — mismo patrón y mismas variables de entorno
 * que lib/services/notify-feedback.ts (FEEDBACK_NOTIFY_TO/FEEDBACK_NOTIFY_FROM), solo
 * que para un evento distinto. Reutiliza el mismo par de variables a propósito: ya
 * apuntan a la casilla real del dueño (gastrometrics@outlook.com) y ya están
 * configuradas tanto en local como en Vercel, así que no hace falta agregar nada
 * nuevo para que esto funcione. Best-effort: si Resend no está configurado o falla,
 * no debe romper el registro de la cuenta (que ya se creó antes de llamar a esto).
 *
 * docs/142 — es el correo más importante para el dueño, así que tiene dos capas:
 * 1. sendAccountCreatedNotification: inmediato, con reintentos, y la ruta de registro
 *    ahora lo espera (antes salía sin `await` y Vercel podía cortarlo).
 * 2. sendDailySignupDigest: el cron diario manda la lista de TODAS las cuentas creadas
 *    en las últimas 24 h, leída de Supabase Auth, así que una cuenta cuyo aviso
 *    inmediato falló igual aparece al día siguiente.
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { escapeHtml } from "./email-templates"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  da: "Danés",
  fr: "Francés",
  pt: "Portugués",
  zh: "Chino",
}

function adminLink(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gastrometrics.org"
  return `${siteUrl}/admin`
}

/** Devuelve true si el correo salió. Nunca lanza. */
export async function sendAccountCreatedNotification(input: {
  email: string
  fullName?: string
  businessType?: string
  nationality?: string
  language?: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.FEEDBACK_NOTIFY_TO) {
    console.error("[notify-signup] Falta RESEND_API_KEY o FEEDBACK_NOTIFY_TO: no se avisó de la cuenta nueva", input.email)
    return false
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(
    resend,
    {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [process.env.FEEDBACK_NOTIFY_TO as string],
      subject: `[GastroMetrics] Nueva cuenta creada: ${input.email}`,
      html: `
      <p><strong>Correo:</strong> ${escapeHtml(input.email)}</p>
      ${input.fullName ? `<p><strong>Nombre:</strong> ${escapeHtml(input.fullName)}</p>` : ""}
      ${input.businessType ? `<p><strong>Tipo de negocio:</strong> ${escapeHtml(input.businessType)}</p>` : ""}
      ${input.nationality ? `<p><strong>País:</strong> ${escapeHtml(input.nationality)}</p>` : ""}
      ${input.language ? `<p><strong>Idioma:</strong> ${escapeHtml(LANGUAGE_NAMES[input.language] || input.language)}</p>` : ""}
      <hr/>
      <p style="color:#888;font-size:12px">Cuenta creada el ${escapeHtml(new Date().toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" }))}. Revisa el detalle en <a href="${adminLink()}">/admin</a>.</p>
    `,
    },
    "aviso de cuenta nueva",
  )
  // El SDK de Resend no lanza en errores de la API — los devuelve en `error` (ver docs/53).
  if (error) {
    console.error("[notify-signup] Resend rechazó la notificación:", error)
    return false
  }
  return true
}

export interface SignupDigestRow {
  email: string
  createdAt: string
  fullName: string
  country: string
  language: string
  invited: boolean
}

export interface DigestBusinessRow {
  name: string
  ownerEmail: string
  createdAt: string
}

export interface DigestInviteRow {
  email: string
  ownerEmail: string
  invitedAt: string
}

const when = (iso: string) => escapeHtml(new Date(iso).toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" }))
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function table(headers: string[], rows: string[][]): string {
  const th = 'align="left" style="padding:6px 10px"'
  const td = 'style="padding:6px 10px;border-bottom:1px solid #eee"'
  return `<table style="border-collapse:collapse;font-size:13px;margin:0 0 20px"><tr>${headers.map((h) => `<th ${th}>${h}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td ${td}>${c}</td>`).join("")}</tr>`)
    .join("")}</table>`
}

/**
 * HTML del resumen diario — puro, cubierto por email-reliability.test.ts. Desde docs/143
 * incluye también los negocios creados y las invitaciones a equipos de las últimas 24 h.
 */
export function renderSignupDigest(
  rows: SignupDigestRow[],
  extra: { businesses?: DigestBusinessRow[]; invites?: DigestInviteRow[] } = {},
): { subject: string; html: string } {
  const businesses = extra.businesses ?? []
  const invites = extra.invites ?? []
  const own = rows.filter((r) => !r.invited).length
  const invited = rows.length - own
  const subject = `[GastroMetrics] Resumen de 24 h: ${plural(rows.length, "cuenta nueva", "cuentas nuevas")}, ${plural(businesses.length, "negocio", "negocios")}, ${plural(invites.length, "invitación", "invitaciones")}`

  let html = `<p><strong>Cuentas nuevas: ${rows.length}</strong> (${own} por registro propio, ${invited} invitadas a un equipo).</p>`
  if (rows.length) {
    html += table(
      ["Correo", "Nombre", "País", "Idioma", "Origen", "Creada"],
      rows.map((r) => [
        escapeHtml(r.email),
        escapeHtml(r.fullName || "—"),
        escapeHtml(r.country || "—"),
        escapeHtml(LANGUAGE_NAMES[r.language] || r.language || "—"),
        r.invited ? "Invitada a un equipo" : "Registro propio",
        when(r.createdAt),
      ]),
    )
  }
  html += `<p><strong>Negocios nuevos: ${businesses.length}</strong></p>`
  if (businesses.length) {
    html += table(["Negocio", "Cuenta", "Creado"], businesses.map((b) => [escapeHtml(b.name), escapeHtml(b.ownerEmail || "—"), when(b.createdAt)]))
  }
  html += `<p><strong>Invitaciones a equipos: ${invites.length}</strong></p>`
  if (invites.length) {
    html += table(["Persona invitada", "Invitó", "Fecha"], invites.map((v) => [escapeHtml(v.email), escapeHtml(v.ownerEmail || "—"), when(v.invitedAt)]))
  }
  html += `<hr/><p style="color:#888;font-size:12px">Resumen automático del cron diario. Es una red de seguridad: llega aunque algún aviso inmediato haya fallado. Detalle en <a href="${adminLink()}">/admin</a>.</p>`
  return { subject, html }
}

/**
 * Resumen diario (cron /api/cron/activation-emails): cuentas de Supabase Auth, negocios
 * y invitaciones a equipos de las últimas 24 h. Si no hubo nada, no manda nada.
 */
export async function sendDailySignupDigest(
  options: { dryRun?: boolean } = {},
): Promise<{ count: number; businesses: number; invites: number; sent: boolean }> {
  const admin = getSupabaseAdminClient()
  const since = Date.now() - 24 * 60 * 60 * 1000
  const sinceIso = new Date(since).toISOString()
  const emailById = new Map<string, string>()
  const users: { id: string; email: string; created_at: string; meta: Record<string, unknown>; invited: boolean }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email)
      if (u.email && new Date(u.created_at).getTime() >= since) {
        users.push({ id: u.id, email: u.email, created_at: u.created_at, meta: u.user_metadata ?? {}, invited: Boolean(u.invited_at) })
      }
    }
    if (data.users.length < 200) break
  }

  const [{ data: businessRows }, { data: inviteRows }] = await Promise.all([
    admin.from("businesses").select("name, owner_id, created_at").gte("created_at", sinceIso).order("created_at"),
    admin.from("team_members").select("email, owner_id, invited_at").gte("invited_at", sinceIso).order("invited_at"),
  ])
  const businesses: DigestBusinessRow[] = (businessRows ?? []).map((b) => ({
    name: b.name,
    ownerEmail: emailById.get(b.owner_id) ?? "",
    createdAt: b.created_at,
  }))
  const invites: DigestInviteRow[] = (inviteRows ?? []).map((v) => ({
    email: v.email,
    ownerEmail: emailById.get(v.owner_id) ?? "",
    invitedAt: v.invited_at,
  }))

  const profileBy = new Map<string, { full_name: string | null; nationality: string | null; preferred_language: string | null }>()
  if (users.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, nationality, preferred_language")
      .in("id", users.map((u) => u.id))
    for (const p of profiles ?? []) profileBy.set(p.id, p)
  }

  const rows: SignupDigestRow[] = users
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((u) => {
      const p = profileBy.get(u.id)
      const meta = u.meta as { full_name?: string; nationality?: string; preferred_language?: string }
      return {
        email: u.email,
        createdAt: u.created_at,
        fullName: p?.full_name || meta.full_name || "",
        country: p?.nationality || meta.nationality || "",
        language: p?.preferred_language || meta.preferred_language || "",
        invited: u.invited,
      }
    })

  const counts = { count: rows.length, businesses: businesses.length, invites: invites.length }
  if (rows.length + businesses.length + invites.length === 0) return { ...counts, sent: false }
  if (options.dryRun || !process.env.RESEND_API_KEY || !process.env.FEEDBACK_NOTIFY_TO) return { ...counts, sent: false }

  const { subject, html } = renderSignupDigest(rows, { businesses, invites })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await sendWithRetry(
    resend,
    {
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [process.env.FEEDBACK_NOTIFY_TO as string],
      subject,
      html,
    },
    "resumen diario al dueño",
  )
  if (error) console.error("[notify-signup] Resend rechazó el resumen diario:", error)
  return { ...counts, sent: !error }
}
