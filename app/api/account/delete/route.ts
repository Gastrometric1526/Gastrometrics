/**
 * Desactiva la cuenta del usuario que hace la petición (self-service, ver Configuración
 * → "Eliminar cuenta").
 *
 * BUG CORREGIDO (ver docs/118, Términos de Uso §5 / Política de Privacidad §6: "30 días
 * de gracia para reactivar... tras la solicitud"): antes esta ruta borraba la cuenta de
 * inmediato y sin vuelta atrás (admin.auth.admin.deleteUser(), cascada total en el mismo
 * request) — contradecía la promesa explícita de los nuevos documentos legales. Ahora es
 * un borrado suave: cancela Stripe de inmediato (deja de cobrar) y marca
 * profiles.deletion_requested_at, pero NO llama a deleteUser(). El purgado real
 * (deleteUser(), que dispara la cascada de negocios/recetas/etc.) lo hace el cron diario
 * existente (app/api/cron/activation-emails/route.ts, ver lib/services/purge-deleted-
 * accounts.ts) cuando deletion_requested_at ya tiene 30+ días. Reactivar dentro de esos
 * 30 días es una acción manual desde /admin → Cuentas (limpiar el campo), tal como dice
 * el texto legal ("contactando al soporte").
 *
 * El borrado INMEDIATO de /admin (app/api/admin/accounts/route.ts DELETE, ver docs/71)
 * se deja intacto a propósito — es una herramienta operativa del dueño del proyecto, no
 * el flujo de autoservicio que describen los 30 días de gracia.
 *
 * Esta ruta autentica contra la sesión real del que llama
 * (getSupabaseServerClient().auth.getUser()), nunca contra el passcode de /admin, y
 * jamás acepta un userId del cliente — solo se puede desactivar a sí mismo.
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

    const { error: deletionRequestError } = await admin
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("id", userId)
    if (deletionRequestError) {
      console.error("[api/account/delete] Error marcando deletion_requested_at:", deletionRequestError)
      return NextResponse.json({ error: "No se pudo eliminar la cuenta. Intenta de nuevo." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/account/delete] Error eliminando la cuenta:", error)
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 })
  }
}
