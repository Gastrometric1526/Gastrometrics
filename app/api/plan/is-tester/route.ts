/**
 * Le dice al cliente si la sesión actual es una cuenta de tester (ver
 * app/api/plan/dev-account/route.ts para dónde se aplica el plan real) — solo
 * lectura, no cambia nada. Usado por components/plans-grid.tsx para mostrar un
 * mensaje distinto en /planes y /mi-plan cuando un tester intenta "cambiar" a otro
 * plan: ya tiene acceso completo, no hace falta que pague ni que elija nada.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { isTesterEmail } from "@/lib/tester-allowlist"

export async function GET() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return NextResponse.json({ isTester: isTesterEmail(user?.email) })
}
