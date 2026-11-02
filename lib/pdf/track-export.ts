"use client"

/**
 * Registra cada PDF exportado (docs/232), para que /admin vea cuántos sacó cada cuenta y en
 * qué negocio. Se guarda en `activity_log` (módulo «pdf», acción «exported», el tipo en
 * `entity_label`); no sale en «Actividad reciente». Nunca bloquea ni rompe la descarga.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export type PdfKind = "recipe" | "menu" | "mep" | "cash_up" | "inventory" | "invoice" | "purchase_order" | "sales_history"

export function recordPdfExport(kind: PdfKind, businessId?: string | null): void {
  if (typeof window === "undefined") return
  try {
    const supabase = getSupabaseBrowserClient()
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user
        if (!user) return
        return supabase.from("activity_log").insert({
          business_id: businessId && businessId !== "main" ? businessId : null,
          user_id: user.id,
          user_name: (user.user_metadata?.full_name as string | undefined) || user.email || "",
          module: "pdf",
          action: "exported",
          entity_label: kind,
          metadata: null,
          is_notification: false,
        })
      })
      .then((res) => {
        if (res?.error) console.error("[pdf] No se pudo registrar la exportación:", res.error)
      })
      .catch(() => {})
  } catch {
    // nunca rompe la descarga
  }
}
