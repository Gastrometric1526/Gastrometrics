/**
 * Elimina la cuenta del usuario que hace la petición (self-service, ver Configuración
 * → "Eliminar cuenta" — pedido explícito: el reset de datos legado no borraba nada
 * real en Supabase y encima cerraba la sesión sin avisar; esto lo reemplaza con un
 * borrado real y una redirección esperada).
 *
 * Mismo orden obligatorio que el borrado desde /admin (app/api/admin/accounts/route.ts
 * DELETE, ver docs/71) — reutiliza exactamente esa lógica: cancelar Stripe primero,
 * limpiar team_members.invited_user_id (el único FK hacia auth.users sin "on delete
 * cascade"), y por último admin.auth.admin.deleteUser() para la cascada automática de
 * todo lo demás (negocios, recetas, ingredientes, inventario, menús, órdenes de
 * compra, importaciones de POS, equipos que esta cuenta creó, profile, presence,
 * account_plans).
 *
 * Diferencia clave con la ruta de /admin: esta autentica contra la sesión real del
 * que llama (getSupabaseServerClient().auth.getUser()), nunca contra el passcode de
 * /admin, y jamás acepta un userId del cliente — solo se puede borrar a sí mismo.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión para continuar." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  // Confirmación explícita del correo, mismo criterio que el borrado de un negocio
  // (escribir el nombre) — evita un borrado accidental por un clic de más.
  if (typeof body?.confirmEmail !== "string" || body.confirmEmail.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
    return NextResponse.json({ error: "El correo no coincide con tu cuenta." }, { status: 400 })
  }

  const userId = user.id
  const admin = getSupabaseAdminClient()

  try {
    const { data: planRow } = await admin
      .from("account_plans")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("account_id", userId)
      .maybeSingle()

    if (planRow?.stripe_subscription_id) {
      if (!isStripeConfigured()) {
        return NextResponse.json(
          { error: "No se pudo verificar tu suscripción. Intenta de nuevo en unos minutos." },
          { status: 409 },
        )
      }
      const stripe = getStripeClient()
      try {
        await stripe.subscriptions.cancel(planRow.stripe_subscription_id)
      } catch (stripeError: any) {
        // "resource_missing" = ya no existe en Stripe — no bloquea el borrado.
        if (stripeError?.code !== "resource_missing") {
          console.error("[api/account/delete] Error cancelando la suscripción de Stripe:", stripeError)
          return NextResponse.json(
            {
              error:
                "No se pudo cancelar tu suscripción activa. Intenta de nuevo o cancélala primero desde Mi Plan → Portal de Cliente.",
            },
            { status: 500 },
          )
        }
      }
      if (planRow.stripe_customer_id) {
        try {
          await stripe.customers.del(planRow.stripe_customer_id)
        } catch (stripeError) {
          // Best-effort: secundario a la suscripción ya cancelada arriba.
          console.error("[api/account/delete] Error borrando el customer de Stripe:", stripeError)
        }
      }
    }

    const { error: teamCleanupError } = await admin.from("team_members").delete().eq("invited_user_id", userId)
    if (teamCleanupError) {
      console.error("[api/account/delete] Error limpiando team_members.invited_user_id:", teamCleanupError)
      return NextResponse.json({ error: "No se pudo eliminar la cuenta. Intenta de nuevo." }, { status: 500 })
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/account/delete] Error eliminando la cuenta:", error)
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 })
  }
}
