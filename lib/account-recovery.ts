/**
 * Recuperar una cuenta (pedido del dueño, docs/285). Parte pura: valida una solicitud y
 * calcula el plazo de una cuenta que pidió eliminarse.
 *
 * Tipos de solicitud:
 * - «forgot_email»: no recuerda con qué correo se registró;
 * - «lost_email»: ya no tiene acceso a su correo (quiere cambiarlo por otro);
 * - «restore_content»: borró su contenido por error y pide un respaldo (con la sesión abierta).
 * El dueño las resuelve desde /admin (cambiar correo, enlace de contraseña o Respaldos).
 */

export type RecoveryKind = "forgot_email" | "lost_email" | "restore_content"
export const RECOVERY_KINDS: RecoveryKind[] = ["forgot_email", "lost_email", "restore_content"]

/** Días de gracia antes de que una cuenta que pidió eliminarse se borre (Términos §5). */
export const DELETION_GRACE_DAYS = 30

export type RecoveryRow = {
  kind: RecoveryKind
  full_name: string | null
  business_name: string | null
  contact: string
  possible_emails: string | null
  details: string | null
  language: string | null
}

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null
  const v = value.replace(/\s+/g, " ").trim()
  return v ? v.slice(0, max) : null
}

/**
 * Valida lo que manda el formulario. Sin sesión, pide nombre y un contacto para
 * contestarle; con «restore_content» el contacto puede ser el correo de la sesión.
 */
export function normalizeRecoveryRequest(
  body: unknown,
  session: { email: string | null } = { email: null },
): { ok: true; row: RecoveryRow } | { ok: false; error: "invalid_kind" | "missing_name" | "missing_contact" | "missing_details" } {
  const b = (body ?? {}) as Record<string, unknown>
  const kind = b.kind
  if (typeof kind !== "string" || !(RECOVERY_KINDS as string[]).includes(kind)) return { ok: false, error: "invalid_kind" }
  const full_name = clean(b.fullName, 120)
  const contact = clean(b.contact, 200) ?? (kind === "restore_content" ? session.email : null)
  const details = clean(b.details, 1000)
  if (kind !== "restore_content" && !full_name) return { ok: false, error: "missing_name" }
  if (!contact) return { ok: false, error: "missing_contact" }
  if (kind === "restore_content" && !details) return { ok: false, error: "missing_details" }
  return {
    ok: true,
    row: {
      kind: kind as RecoveryKind,
      full_name,
      business_name: clean(b.businessName, 120),
      contact,
      possible_emails: clean(b.possibleEmails, 300),
      details,
      language: clean(b.language, 8),
    },
  }
}

/** Día en que se borra una cuenta que pidió eliminarse, y cuántos días le quedan. */
export function deletionDeadline(requestedAt: string | null | undefined, now = Date.now()): { purgeAt: string; daysLeft: number } | null {
  if (!requestedAt) return null
  const start = Date.parse(requestedAt)
  if (!Number.isFinite(start)) return null
  const purge = start + DELETION_GRACE_DAYS * 86_400_000
  return { purgeAt: new Date(purge).toISOString(), daysLeft: Math.max(0, Math.ceil((purge - now) / 86_400_000)) }
}
