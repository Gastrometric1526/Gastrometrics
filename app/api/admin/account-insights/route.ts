/**
 * Radiografía completa de una cuenta para /admin (docs/166). Los datos los arma
 * lib/admin/account-insights-server.ts. Solo con sesión de admin.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getAccountInsights } from "@/lib/admin/account-insights-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const userId = new URL(request.url).searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "Falta el userId." }, { status: 400 })
  try {
    const insights = await getAccountInsights(userId)
    if (!insights) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 })
    return NextResponse.json(insights)
  } catch (error) {
    console.error("[api/admin/account-insights] Error:", error)
    return NextResponse.json({ error: "No se pudo leer la cuenta." }, { status: 500 })
  }
}
