/**
 * Avisos al dueño sobre el acceso a /admin (docs/318, pedido del dueño: «lo que no quiero es
 * que alguien llegue a admin por accidente… debería haber una notificación si se le dio acceso
 * a un nuevo correo»). Van por `sendOwnerNotification`: correo al dueño y aviso en los aparatos
 * con los avisos de /admin encendidos. Nunca frenan la acción: si el aviso falla, se registra.
 */

import { hondurasTime, sendOwnerNotification } from "@/lib/services/notify-owner"
import { namesForEmails } from "@/lib/admin/admin-names"

export type AdminAccessEvent =
  | { kind: "granted"; email: string; by: string }
  | { kind: "removed"; email: string; by: string }
  | { kind: "first_login"; email: string; method: string }
  | { kind: "code"; email: string | null; ip: string }

const SUBJECT: Record<AdminAccessEvent["kind"], string> = {
  granted: "Acceso nuevo al panel",
  removed: "Se quitó un acceso al panel",
  first_login: "Primera entrada al panel",
  code: "Entraron al panel con el código de emergencia",
}

/** Asunto y filas del aviso. Puro (cubierto por pruebas). */
export function describeAdminAccess(event: AdminAccessEvent, name: string | null, at: Date = new Date()): { subject: string; rows: [string, string | null][] } {
  const who = event.email ? (name ? `${name} (${event.email})` : event.email) : null
  const rows: [string, string | null][] = [["Persona", who]]
  if (event.kind === "granted" || event.kind === "removed") rows.push(["Lo hizo", event.by])
  if (event.kind === "first_login") rows.push(["Cómo entró", event.method])
  if (event.kind === "code") {
    rows[0] = ["Cuenta abierta en ese aparato", who ?? "ninguna"]
    rows.push(["IP", event.ip])
  }
  rows.push(["Cuándo (hora de Honduras)", hondurasTime(at)])
  const subject = event.email && event.kind !== "code" ? `${SUBJECT[event.kind]}: ${name ?? event.email}` : SUBJECT[event.kind]
  return { subject, rows }
}

export async function notifyAdminAccess(event: AdminAccessEvent): Promise<void> {
  try {
    const name = event.email ? ((await namesForEmails([event.email])).get(event.email.toLowerCase()) ?? null) : null
    const { subject, rows } = describeAdminAccess(event, name)
    await sendOwnerNotification({
      subject,
      rows,
      footnote:
        event.kind === "code"
          ? "Si no fuiste tú, cambia ADMIN_PASSCODE en Vercel."
          : event.kind === "removed"
            ? "Esa persona ya no puede entrar."
            : "Si no lo esperabas, quita el acceso en Sistema → Quién entra al panel.",
      label: `admin-access-${event.kind}`,
      url: "/admin?tab=sistema&sub=acceso",
    })
  } catch (error) {
    console.error("[admin-access-notify]", error)
  }
}
