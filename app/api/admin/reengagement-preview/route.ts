/**
 * Vista previa de los 5 correos de recordatorio (docs/131) con datos de ejemplo, sin
 * mandar nada: /api/admin/reengagement-preview?type=inventory_count&lang=es&variant=1
 * Sin `type` muestra un índice con links a los 5 tipos × 6 idiomas × 3 variantes de texto (docs/139).
 *
 * En producción exige la sesión de /admin (hasAdminSession); en desarrollo local
 * queda abierta para poder revisar el diseño sin pasar por el passcode.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { renderReengagementEmail } from "@/lib/services/notify-reengagement"
import type { ReengagementType } from "@/lib/i18n/reengagement-email-labels"
import { renderEngagementEmail, type EngagementDecision } from "@/lib/services/notify-engagement"
import { ENGAGEMENT_SHARED, ENGAGEMENT_TYPES, type EngagementType } from "@/lib/i18n/engagement-email-copy"
import { normalizeEmailLang, fillLabel } from "@/lib/i18n/email-labels"

const TYPES: ReengagementType[] = ["unfinished_recipe", "inventory_count", "review_reports", "update_prices", "we_miss_you"]
const LANGS = ["es", "en", "da", "fr", "pt", "zh"]

const SAMPLE_VARS: Record<ReengagementType, { recipe?: string; days?: number; count?: number }> = {
  unfinished_recipe: { recipe: "Pollo en salsa de tamarindo" },
  inventory_count: { days: 12 },
  review_reports: { days: 9 },
  update_prices: { count: 14 },
  we_miss_you: { days: 21, count: 8 },
}

// Correos de valor (docs/144) con datos de ejemplo.
function sampleEngagement(type: EngagementType, lang: string): EngagementDecision {
  const s = ENGAGEMENT_SHARED[normalizeEmailLang(lang)]
  switch (type) {
    case "weekly_summary":
      return { type, ref: "", vars: {}, weekly: { recipes: "24", foodCost: "31.4 %", inventory: "L 17,205.00", lowStock: "3", margin: "2" }, actionPath: "/estadisticas" }
    case "low_stock":
      return {
        type,
        ref: "",
        vars: { count: "3" },
        items: [
          fillLabel(s.lowStockItem, { name: "Aceite de oliva", current: "2", min: "5", unit: "L" }),
          fillLabel(s.lowStockItem, { name: "Harina", current: "4", min: "10", unit: "kg" }),
          fillLabel(s.lowStockItem, { name: "Huevos", current: "12", min: "30", unit: "unidad" }),
        ],
        actionPath: "/inventario",
      }
    case "margin_alert":
      return {
        type,
        ref: "",
        vars: { count: "2" },
        items: [
          fillLabel(s.marginItem, { name: "Lomo a la pimienta", actual: "41.2", target: "30.0" }),
          fillLabel(s.belowCostItem, { name: "Ceviche mixto" }),
        ],
        actionPath: "/mis-recetas",
      }
    case "unused_feature":
      return { type, ref: "", vars: { feature: "Inventario", plan: "Chef de Partie" }, actionPath: "/inventario" }
    case "milestone":
      return { type, ref: "", vars: { milestone: s.milestones.recipes_25 }, actionPath: "/dashboard" }
    case "invite_pending":
      return { type, ref: "", vars: { invitee: "María López", days: "5" }, actionPath: "/equipo" }
    case "empty_business":
      return { type, ref: "", vars: { business: "Taquería El Güero", days: "7" }, actionPath: "/negocios" }
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production" && !(await hasAdminSession())) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get("type") as ReengagementType | null
  const lang = url.searchParams.get("lang") || "es"
  const variant = Math.max(0, Math.min(2, Number(url.searchParams.get("variant")) || 0))

  const siteUrlForPreview = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  if (type && (ENGAGEMENT_TYPES as string[]).includes(type)) {
    const decision = sampleEngagement(type as unknown as EngagementType, lang)
    const { subject, html } = renderEngagementEmail({
      decision,
      language: lang,
      name: "Daniel",
      actionUrl: `${siteUrlForPreview}${decision.actionPath}`,
      unsubscribeUrl: "#",
      variant,
    })
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(subject) },
    })
  }

  if (!type || !TYPES.includes(type)) {
    const linkRow = (t: string) =>
      `<li style="margin:6px 0"><strong>${t}</strong> — ${LANGS.map((l) => `${l}: ${[0, 1, 2].map((v) => `<a href="?type=${t}&lang=${l}&variant=${v}">${v + 1}</a>`).join(" ")}`).join(" · ")}</li>`
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Correos automáticos</title></head><body style="font-family:sans-serif;padding:24px"><h1>Correos de valor (docs/144)</h1><ul>${ENGAGEMENT_TYPES.map(linkRow).join("")}</ul><h1>Recordatorios (docs/131)</h1><ul>${TYPES.map(linkRow).join("")}</ul></body></html>`,
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
    variant,
  })
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Email-Subject": encodeURIComponent(subject) },
  })
}
