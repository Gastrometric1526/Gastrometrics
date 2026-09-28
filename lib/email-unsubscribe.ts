/**
 * Link de "dejar de recibir estos correos" en un clic (ver docs/131) — sin tener que
 * iniciar sesión, pero sin que cualquiera pueda dar de baja a cualquier cuenta
 * adivinando un id: el link lleva el id de la cuenta + una firma HMAC-SHA256 hecha con
 * un secreto que solo conoce el servidor. Solo se importa desde rutas de servidor.
 *
 * Secreto: UNSUBSCRIBE_SECRET si existe; si no, CRON_SECRET; si no, la service role key
 * de Supabase (siempre presente en producción). Cambiar el secreto invalida los links
 * de correos ya enviados — no es grave (la persona puede desmarcar la casilla en
 * Configuración igual), pero conviene no rotarlo sin motivo.
 */

import { createHmac, timingSafeEqual } from "crypto"

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("No hay secreto configurado para firmar links de baja.")
  return secret
}

function sign(accountId: string): string {
  return createHmac("sha256", getSecret()).update(`unsubscribe:${accountId}`).digest("base64url")
}

export function buildUnsubscribeUrl(accountId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return `${siteUrl}/api/email/unsubscribe?u=${encodeURIComponent(accountId)}&s=${sign(accountId)}`
}

export function verifyUnsubscribeSignature(accountId: string, signature: string): boolean {
  if (!accountId || !signature) return false
  const expected = Buffer.from(sign(accountId))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
