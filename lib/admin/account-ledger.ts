/**
 * Registro de cuentas borradas para /admin → Cuentas → Historial (docs/197). Pedido del dueño:
 * ver cuándo se borraron las cuentas. Al purgarse, la cuenta y su actividad desaparecen
 * (borrado en cascada), así que justo antes se anota una fila que sobrevive.
 *
 * Privacidad (Política §6 / Términos §5): los Datos del Usuario se eliminan, así que el
 * registro NO guarda correo, nombre ni contenido: solo fechas, plan y país, para contar y
 * fechar las bajas. Sin migración: una fila en product_events con event_name
 * «account_purged» y los datos en business_id como JSON corto.
 */

export const ACCOUNT_PURGED_EVENT = "account_purged"

export interface PurgedAccountRecord {
  createdAt: string | null // alta de la cuenta
  requestedAt: string | null // cuándo pidió borrarse
  purgedAt: string // cuándo se borró de verdad
  plan: string | null
  country: string | null
}

export function encodePurgedRecord(r: PurgedAccountRecord): string {
  return JSON.stringify({ c: r.createdAt, r: r.requestedAt, p: r.plan, n: r.country })
}

export function decodePurgedRecord(payload: string | null, purgedAt: string): PurgedAccountRecord {
  try {
    const j = JSON.parse(payload || "{}") as { c?: string | null; r?: string | null; p?: string | null; n?: string | null }
    return { createdAt: j.c ?? null, requestedAt: j.r ?? null, purgedAt, plan: j.p ?? null, country: j.n ?? null }
  } catch {
    return { createdAt: null, requestedAt: null, purgedAt, plan: null, country: null }
  }
}
