/**
 * Opiniones que se muestran en el sitio (docs/173): solo las que la persona permitió
 * mostrar Y el dueño publicó en /admin. Pública, sin datos de contacto: nombre corto
 * («Daniel R.»), país, tipo de negocio, nota y comentario.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { parseReviewMessage, reviewerDisplayName, type PublicReview } from "@/lib/reviews"

export const dynamic = "force-dynamic"


export async function GET() {
  try {
    const admin = getSupabaseAdminClient()
    const { data: published } = await admin.from("product_events").select("business_id").eq("event_name", "review_published")
    const ids = ((published ?? []) as unknown as { business_id: string | null }[]) // product_events no está en types/database.ts
      .map((r) => r.business_id)
      .filter((x): x is string => Boolean(x))
    if (!ids.length) return json([])

    const { data: rows } = await admin.from("feedback").select("id, message, user_name, user_email, created_at").in("id", ids)
    const emails = [...new Set((rows ?? []).map((r) => r.user_email).filter((e): e is string => Boolean(e)))]
    const profileByEmail = new Map<string, { nationality: string | null; business_type: string | null; full_name: string | null }>()
    if (emails.length) {
      // El correo vive en Auth, no en profiles: se cruza por id.
      for (let page = 1; page <= 10; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        const matches = data.users.filter((u) => u.email && emails.includes(u.email))
        if (matches.length) {
          const { data: profiles } = await admin
            .from("profiles")
            .select("id, nationality, business_type, full_name")
            .in("id", matches.map((u) => u.id))
          for (const u of matches) {
            const p = profiles?.find((x) => x.id === u.id)
            profileByEmail.set(u.email!, { nationality: p?.nationality || null, business_type: p?.business_type || null, full_name: p?.full_name || null })
          }
        }
        if (data.users.length < 200) break
      }
    }

    const reviews: PublicReview[] = []
    for (const r of rows ?? []) {
      const parsed = parseReviewMessage(r.message)
      if (!parsed.publishable || !parsed.comment) continue
      const profile = r.user_email ? profileByEmail.get(r.user_email) : undefined
      reviews.push({
        id: r.id,
        name: reviewerDisplayName(profile?.full_name || r.user_name) || "Chef",
        country: profile?.nationality || null,
        businessType: profile?.business_type || null,
        score: parsed.score,
        comment: parsed.comment,
        at: r.created_at,
      })
    }
    reviews.sort((a, b) => b.at.localeCompare(a.at))
    return json(reviews)
  } catch (error) {
    console.error("[api/reviews] Error:", error)
    return json([])
  }
}

function json(reviews: PublicReview[]) {
  return NextResponse.json({ reviews }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } })
}
