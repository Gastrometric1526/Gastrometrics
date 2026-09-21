"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { LogIn, Mail, Lock, ArrowLeft } from "lucide-react"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { bootstrapPasswordHashIfMissing } from "@/lib/utils/password-hash"
import { consumePendingSignupPlan } from "@/lib/pending-signup-plan"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false)
  const router = useRouter()
  const { login } = useAuth()
  const { t } = useLanguage()

  // Aplica el plan de tester si corresponde y redirige. Ver app/api/plan/dev-account/route.ts.
  const afterLogin = async () => {
    const devAccountResult = await fetch("/api/plan/dev-account", { method: "POST" })
      .then((res) => res.json())
      .catch(() => null)
    if (devAccountResult?.applied && devAccountResult.planSlug) {
      setCurrentPlanSlug(devAccountResult.planSlug)
    }
    // Pedido explícito: si eligió un plan pago al registrarse pero tuvo que confirmar
    // el correo antes de poder iniciar sesión de verdad (el caso normal), este es el
    // primer login real de la cuenta — acá es donde se retoma esa elección en vez de
    // perderla, ver lib/pending-signup-plan.ts.
    const pendingPlan = consumePendingSignupPlan()
    if (pendingPlan) {
      router.push(`/signup/payment?plan=${pendingPlan}`)
      return
    }
    router.push("/dashboard")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError("")

    try {
      await login(email, password)
      // Cuentas legacy/demo nunca pasan por /signup, así que no tienen una contraseña
      // guardada todavía para el chequeo de "confirma tu contraseña" al cambiar el
      // correo en Configuración — la primera contraseña real que alguien escriba aquí
      // se convierte en esa contraseña. Si ya existe una (cuenta creada por /signup),
      // esto no la toca — login no valida contra ella, así que sobrescribirla en cada
      // inicio de sesión volvería inútil el chequeo posterior.
      await bootstrapPasswordHashIfMissing(password)
      await afterLogin()
    } catch (error: any) {
      console.error("Login error:", error)
      const message = typeof error?.message === "string" ? error.message.toLowerCase() : ""
      // BUG CORREGIDO: alguien que se registró, nunca hizo clic en el enlace de
      // confirmación, y vuelve directo a /login (en vez de pasar por el flujo de
      // /signup, que sí reconoce este caso y muestra "Confirma tu correo" — ver
      // showCheckEmail más abajo en app/signup/page.tsx) veía el error genérico
      // "No se pudo iniciar sesión. Intenta de nuevo.", sin ninguna pista de que la
      // cuenta sí existe y solo falta confirmar el correo. Supabase Auth SÍ bloquea el
      // inicio de sesión hasta confirmar (confirmado en vivo contra el proyecto real:
      // signInWithPassword devuelve error_code "email_not_confirmed") — lo que faltaba
      // era explicarlo.
      if (message.includes("email not confirmed") || message.includes("confirm")) {
        setLoginError(t("login_error_email_not_confirmed"))
      } else if (message.includes("invalid") || message.includes("credentials")) {
        setLoginError(t("login_error_invalid_credentials"))
      } else {
        setLoginError(t("login_error_generic"))
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Login sin contraseña, SOLO en local (docs/82, reintroducido — ver
  // app/api/auth/dev-login/route.ts). El botón mismo desaparece del bundle de
  // producción porque next build reemplaza process.env.NODE_ENV en tiempo de build y
  // elimina la rama muerta — no es solo un `if` en tiempo de ejecución del lado del
  // cliente.
  const handleDevLogin = async () => {
    setIsDevLoggingIn(true)
    setLoginError("")
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setLoginError(body?.error || t("login_error_generic"))
        return
      }
      await fetch("/api/plan/dev-account", { method: "POST" }).catch(() => null)
      // BUG REAL encontrado al probar: a diferencia del login normal (que llama
      // supabase.auth.signInWithPassword del lado del CLIENTE, actualizando de una vez
      // la sesión en memoria del cliente de Supabase del navegador), este login pasa
      // enteramente por el servidor — deja la cookie de sesión bien puesta (confirmado:
      // la siguiente petición ya la lee), pero el cliente de Supabase del navegador
      // sigue con su estado en memoria de "sin sesión" hasta que se reinicializa. Un
      // router.push (transición de cliente, sin recarga) llegaba a /dashboard antes de
      // que ese cliente se enterara, y el guard de autenticación rebotaba de vuelta a
      // /login. Una navegación dura fuerza al cliente a releer la sesión real de las
      // cookies desde cero.
      window.location.href = "/dashboard"
    } catch (error) {
      console.error("Dev login error:", error)
      setLoginError(t("login_error_generic"))
    } finally {
      setIsDevLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("login_back_home")}
          </Link>
          {/* Lockup vertical, 64px: primer punto de contacto con la marca (ver docs/36). */}
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
            <h1 className="text-2xl font-bold text-foreground">Gastrometrics</h1>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-border bg-card">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-foreground">{t("login_title")}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("login_subtitle")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
                  {t("login_email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("auth_email_placeholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-border focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">
                  {t("login_password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-border focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <p className="text-sm text-destructive text-center" role="alert">
                  {loginError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    {t("login_signing_in")}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    {t("login_submit")}
                  </div>
                )}
              </Button>
            </form>

            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 pt-4 border-t border-dashed border-border">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!email || isDevLoggingIn}
                  onClick={handleDevLogin}
                >
                  {isDevLoggingIn ? t("login_signing_in") : `Entrar como ${email || "..."}`}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  Solo local (NODE_ENV=development) — correo debe estar en TESTER_ALLOWLIST_EMAILS
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center">
              {/* Antes apuntaba a /contacto — no había backend real de recuperación de
                  contraseña (ver docs/12-guia-backend.md). Con Supabase Auth ya conectado
                  (ver docs/51), /forgot-password es un flujo real de verdad. */}
              <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
                {t("login_forgot_password")}
              </Link>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {t("login_no_account")}{" "}
              <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
                {t("login_signup_link")}
              </Link>
            </div>
          </CardFooter>
        </Card>

        {/* Additional Info */}
        <div className="text-center text-xs text-muted-foreground">
          <p>{t("login_terms_notice")}</p>
        </div>
      </div>
    </div>
  )
}
