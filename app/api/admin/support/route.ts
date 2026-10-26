/** /admin → Chat de soporte: lista de conversaciones por persona, con su lugar en la fila (docs/204). */
import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { adminListConversations, supportAvailable } from "@/lib/services/support"

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  if (!(await supportAvailable())) return NextResponse.json({ available: false, conversations: [] })
  try {
    return NextResponse.json({ available: true, conversations: await adminListConversations() })
  } catch (e) {
    console.error("[admin/support] GET", e)
    return NextResponse.json({ error: "No se pudo cargar el chat." }, { status: 500 })
  }
}
