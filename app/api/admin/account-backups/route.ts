/**
 * Respaldos automáticos de una cuenta, desde /admin (docs/229). El dueño ve solo la lista
 * (fecha, motivo y conteos), nunca el contenido; puede crear uno ahora o restaurar uno.
 * Restaurar respalda antes el estado actual (se puede deshacer). Ver
 * lib/services/account-snapshots.ts.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import {
  accountRestoreState,
  findDeletedAccountByEmail,
  listAccountSnapshots,
  restoreAccountSnapshot,
  restoreAllowed,
  takeAccountSnapshot,
} from "@/lib/services/account-snapshots"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const params = new URL(request.url).searchParams
  const userId = params.get("userId")
  const deletedEmail = params.get("deletedEmail")
  try {
    // Respaldos de una cuenta eliminada, buscada por su correo (docs/252).
    if (deletedEmail) {
      const found = await findDeletedAccountByEmail(deletedEmail)
      if (!found || found.accountId === userId) return NextResponse.json({ found: null })
      const state = await accountRestoreState(found.accountId)
      if (state.exists && !state.deletionRequested) return NextResponse.json({ found: null })
      return NextResponse.json({ found: { ...found, snapshots: await listAccountSnapshots(found.accountId) } })
    }
    if (!userId) return NextResponse.json({ error: "Falta userId." }, { status: 400 })
    const [snapshots, state] = await Promise.all([listAccountSnapshots(userId), accountRestoreState(userId)])
    return NextResponse.json({ snapshots, restoreAllowed: restoreAllowed({ ...state, snapshots }) })
  } catch (error) {
    console.error("[api/admin/account-backups] Error listando respaldos:", error)
    return NextResponse.json({ error: "No se pudieron leer los respaldos." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { userId?: string; action?: string; path?: string; sourceId?: string } | null
  if (!body?.userId) return NextResponse.json({ error: "Falta userId." }, { status: 400 })
  try {
    if (body.action === "snapshot") {
      const snapshot = await takeAccountSnapshot(body.userId, "manual")
      return NextResponse.json({ snapshot })
    }
    if (body.action === "restore" && typeof body.path === "string") {
      const sourceId = typeof body.sourceId === "string" && body.sourceId ? body.sourceId : body.userId
      const result = await restoreAccountSnapshot(sourceId, body.path, body.userId)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 })
  } catch (error) {
    // Restaurar sin permiso (la cuenta no borró nada ni se eliminó) es un 409, no un fallo.
    if (error instanceof Error && /no borró|Solo se puede/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error("[api/admin/account-backups] Error:", error)
    return NextResponse.json({ error: "No se pudo completar la acción." }, { status: 500 })
  }
}
