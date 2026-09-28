/**
 * Vista previa de los 5 correos de recordatorio (docs/131) con datos de ejemplo, sin
 * mandar nada: /api/admin/reengagement-preview?type=inventory_count&lang=es
 * Sin `type` muestra un índice con links a los 5 tipos × 6 idiomas.
 *
 * En producción exige la sesión de /admin (hasAdminSession); en desarrollo local
 * queda abierta para poder revisar el diseño sin pasar por el passcode.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { renderReengagementEmail } from "@/lib/services/notify-reengagement"
import type { ReengagementType } from "@/lib/i18n/reengagement-email-labels"

const TYPES: ReengagementType[] = ["unfinished_recipe", "inventory_count", "review_reports", "update_prices", "we_miss_you"]
const LANGS = ["es", "en", "da", "fr", "pt", "zh"]

const SAMPLE_VARS: Record<ReengagementType, { recipe?: string; days?: number; count?: number }> = {
  unfinished_recipe: { recipe: "Pollo en salsa de tamarindo" },
  inventory_count: { days: 12 },
  review_reports: { days: 9 },
  update_prices: { count: 14 },
  we_miss_you: { days: 21, count: 8 },
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !(await hasAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get("type") as ReengagementType | null
  const lang = url.searchParams.get("lang") || "es"

  if (!type || !TYPES.includes(type)) {
    const links = TYPES.map(
      (t) =>
        `<li style="margin:6px 0"><strong>${t}</strong> — ${LANGS.map((l) => `<a href="?type=${t}&lang=${l}">${l}</a>`).join(" · ")}</li>`,
    ).join("")
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Recordatorios</title></head><body style="font-family:sans-serif;padding:24px"><h1>Recordatorios por correo (docs/131)</h1><ul>${links}</ul></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const { subject, html } = renderReengagementEmail({
    type,
    language: lang,
    vars: { ...SAMPLE_VARS[type], name: "Daniel" },
    actionUrl: `${siteUrl}/dashboard`,
    unsubscribeUrl: "#",
  })
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(subject) },
  })
}
