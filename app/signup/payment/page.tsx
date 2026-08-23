"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CreditCard, Lock, ShieldCheck, CheckCircle2 } from "lucide-react"
import { plans } from "@/lib/plans"
import { setCurrentPlanSlug } from "@/lib/plan-access"

// Paso de pago después de crear la cuenta, solo para planes pagos (el plan Foodie/gratis
// va directo al dashboard desde signup). Todavía no hay backend de cobros conectado
// (ver docs/12-guia-backend.md) — este formulario no guarda ni transmite el número de
// tarjeta ni el CVC a ningún lado, solo simula el paso para que el flujo esté listo cuando
// se conecte un procesador real (recomendado: Stripe, que además soporta PayPal como método
// de pago dentro de la misma integración).

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

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
  const planSlug = searchParams.get("plan")
  const plan = plans.find((p) => p.slug === planSlug) ?? plans[1]
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

  const [cardName, setCardName] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvc, setCvc] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const isValid = cardName.trim().length > 1 && cardNumber.replace(/\D/g, "").length === 16 && expiry.length === 5 && cvc.length >= 3

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setIsProcessing(true)
    // No hay backend de pagos todavía — se simula el paso y nunca se guarda ni envía
    // el número de tarjeta o el CVC a ningún lado, ni siquiera a localStorage. Lo único
    // que sí se guarda es el plan elegido (lib/plan-access.ts), para que el bloqueo de
    // funciones por plan sea consistente con lo que el usuario "compró" aquí.
    setTimeout(() => {
      setCurrentPlanSlug(plan.slug)
      setIsProcessing(false)
      setIsDone(true)
      setTimeout(() => router.push(fromAccount ? "/mi-plan" : "/dashboard"), 1400)
    }, 900)
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">¡Listo! Bienvenido a {plan.name}</h1>
          <p className="text-muted-foreground">Te llevamos a tu panel principal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
          <Card className="border-border shadow-2xl bg-card/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                Método de Pago
              </CardTitle>
              <CardDescription>Completa los datos de tu tarjeta para activar el plan {plan.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardName">Nombre en la tarjeta</Label>
                  <Input
                    id="cardName"
                    placeholder="Juan Pérez García"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    autoComplete="cc-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número de tarjeta</Label>
                  <Input
                    id="cardNumber"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Vencimiento</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/AA"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="123"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={!isValid || isProcessing}>
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Confirmar y Comenzar
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPlanSlug("foodie")
                    router.push(fromAccount ? "/mi-plan" : "/dashboard")
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Omitir por ahora y empezar con el plan gratuito
                </button>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Gastrometrics todavía no tiene un procesador de pagos conectado, esta pantalla es una vista
                    previa del flujo y no guarda ni cobra nada. Cuando se conecte (Stripe, con PayPal disponible
                    como método dentro de la misma integración), tu tarjeta se manejará directamente por ese
                    proveedor, nunca por nuestros servidores.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border shadow-lg bg-card/95 backdrop-blur h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Resumen del Plan</CardTitle>
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
                Cambiar de plan
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
