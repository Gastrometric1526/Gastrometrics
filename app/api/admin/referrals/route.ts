/** Referidos para /admin (docs/179): quién invitó a quién y en qué va cada invitación. */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { adminReferralList } from "@/lib/services/referrals"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    return NextResponse.json({ referrals: await adminReferralList() })
  } catch (error) {
    console.error("[api/admin/referrals] Error:", error)
    return NextResponse.json({ error: "No se pudo cargar." }, { status: 500 })
  }
}
