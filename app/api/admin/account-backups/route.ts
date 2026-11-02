/**
 * Respaldos automáticos de una cuenta, desde /admin (docs/229). El dueño ve solo la lista
 * (fecha, motivo y conteos), nunca el contenido; puede crear uno ahora o restaurar uno.
 * Restaurar respalda antes el estado actual (se puede deshacer). Ver
 * lib/services/account-snapshots.ts.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { listAccountSnapshots, restoreAccountSnapshot, takeAccountSnapshot } from "@/lib/services/account-snapshots"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const userId = new URL(request.url).searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "Falta userId." }, { status: 400 })
  try {
    return NextResponse.json({ snapshots: await listAccountSnapshots(userId) })
  } catch (error) {
    console.error("[api/admin/account-backups] Error listando respaldos:", error)
    return NextResponse.json({ error: "No se pudieron leer los respaldos." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { userId?: string; action?: string; path?: string } | null
  if (!body?.userId) return NextResponse.json({ error: "Falta userId." }, { status: 400 })
  try {
    if (body.action === "snapshot") {
      const snapshot = await takeAccountSnapshot(body.userId, "manual")
      return NextResponse.json({ snapshot })
    }
    if (body.action === "restore" && typeof body.path === "string") {
      const result = await restoreAccountSnapshot(body.userId, body.path)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 })
  } catch (error) {
    console.error("[api/admin/account-backups] Error:", error)
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 })
  }
}
