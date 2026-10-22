/** Aviso de cobro en la app (docs/183): GET el último cobro sin ver; POST lo marca visto. */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { markPaymentSeen, unseenPayment } from "@/lib/services/payment-notice"

export const dynamic = "force-dynamic"

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  return NextResponse.json({ payment: await unseenPayment(userId) })
}

export async function POST() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  await markPaymentSeen(userId)
  return NextResponse.json({ ok: true })
}
