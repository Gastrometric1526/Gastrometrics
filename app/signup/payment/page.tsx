"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CreditCard, Lock, ShieldCheck, CheckCircle2, XCircle } from "lucide-react"
import { plans, getLocalizedPlan } from "@/lib/plans"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"

// Paso de pago después de crear la cuenta, solo para planes pagos (el plan Foodie/gratis
// va directo al dashboard desde signup). Conectado a Stripe Checkout real vía
// /api/checkout (ver ese archivo) — el botón redirige a la página hospedada por Stripe,
// que es quien captura los datos de la tarjeta; esta pantalla nunca los toca ni los ve.
// Si STRIPE_SECRET_KEY todavía no está configurada en este entorno, /api/checkout
// devuelve 503 y aquí se explica que los pagos no están conectados todavía, sin romper
// el flujo — sigue disponible "empezar con el plan gratuito".

// BUG CORREGIDO: useSearchParams() (para leer ?plan=) exige un límite de Suspense
// por encima para poder pre-renderizarse estáticamente — sin él, `next build` fallaba
// en esta página (ver misma corrección en components/sidebar.tsx).
export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentPageInner />
    </Suspense>
  )
}

function PaymentPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language, t } = useLanguage()
  const { toast } = useToast()
  const planSlug = searchParams.get("plan")
  const plan = getLocalizedPlan(plans.find((p) => p.slug === planSlug) ?? plans[1], language)
  // BUG CORREGIDO: "Volver" y "Cambiar de plan" mandaban siempre a /signup o /planes
  // (las páginas públicas), aunque quien estuviera acá viniera de /mi-plan (dentro del
  // dashboard, ya con sesión) — un usuario ya logueado que le daba "Volver" caía en el
  // formulario de creación de cuenta. No alcanza con mirar isLoggedIn solo: alguien
  // completando el registro por primera vez TAMBIÉN llega acá con isLoggedIn=true,
  // porque app/signup/page.tsx ya corrió login() antes de redirigir — por eso
  // components/plans-grid.tsx marca su propio link con "from=account" para el caso de
  // "ya tenía cuenta, solo sube de plan".
  const fromAccount = searchParams.get("from") === "account"
  const backHref = fromAccount ? "/mi-plan" : "/signup"
  const wasCancelled = searchParams.get("checkout") === "cancelled"

  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stripeUnavailable, setStripeUnavailable] = useState(false)

  useEffect(() => {
    if (wasCancelled) setErrorMessage(t("signup_payment_cancelled"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasCancelled])

  const handleCheckout = async () => {
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: plan.slug }),
      })
      const data = await res.json()

      if (res.status === 503) {
        setStripeUnavailable(true)
        setIsProcessing(false)
        return
      }
      // Ya tenía una suscripción paga activa (cambio de plan, no alta nueva) — el
      // servidor la actualizó directo en Stripe, sin crear una segunda en paralelo
      // (ver docs/76). No hay a dónde redirigir en Stripe; el webhook ya se encarga
      // de que account_plans quede al día en cuanto procese el evento.
      if (data.updatedInPlace) {
        setCurrentPlanSlug(plan.slug)
        router.push(fromAccount ? "/mi-plan?checkout=success" : "/dashboard?checkout=success")
        return
      }
      if (!res.ok || !data.url) {
        setErrorMessage(data.error || t("signup_payment_generic_error"))
        setIsProcessing(false)
        return
      }

      window.location.href = data.url
    } catch {
      setErrorMessage(t("signup_payment_generic_error"))
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common_back")}
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
          <Card className="border-border shadow-2xl bg-card/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                {t("signup_payment_method_title")}
              </CardTitle>
              <CardDescription>
                {t("signup_payment_redirect_desc").replace("{plan}", plan.name)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {stripeUnavailable ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{t("signup_payment_stripe_unavailable")}</p>
                </div>
              ) : (
                <Button type="button" className="w-full" disabled={isProcessing} onClick={handleCheckout}>
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                      {t("signup_payment_redirecting")}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t("signup_payment_continue")}
                    </>
                  )}
                </Button>
              )}

              <button
                type="button"
                onClick={async () => {
                  // BUG CORREGIDO (ver docs/76): mismo caso que components/plans-grid.tsx
                  // — relevante acá específicamente cuando fromAccount=true (alguien que
                  // YA tenía un plan pago activo, vino a subir de plan, y en vez de eso le
                  // da "Omitir por ahora"): si el servidor no pudo cancelar su suscripción
                  // real, no hay que avanzar como si ya estuviera en el plan gratis.
                  const res = await fetch("/api/plan/set-free", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ planSlug: "foodie" }),
                  }).catch(() => null)
                  const result = await res?.json().catch(() => null)
                  if (!res?.ok || !result?.planSlug) {
                    toast({
                      title: t("planes_downgrade_error_title"),
                      description: result?.error || t("planes_downgrade_error_desc"),
                      variant: "destructive",
                    })
                    return
                  }
                  setCurrentPlanSlug(result.planSlug)
                  router.push(fromAccount ? "/mi-plan" : "/dashboard")
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("signup_payment_skip_free")}
              </button>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{t("signup_payment_card_notice")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-lg bg-card/95 backdrop-blur h-fit">
            <CardHeader>
              <CardTitle className="text-lg">{t("signup_payment_summary_title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold text-foreground">{plan.name}</p>
                <p className="text-primary font-semibold">{plan.price}</p>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href={backHref} className="text-xs text-primary hover:underline block">
                {t("signup_payment_change_plan")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
