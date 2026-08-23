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

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()
  const { t } = useLanguage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await login(email, password)
      // Cuentas legacy/demo nunca pasan por /signup, así que no tienen una contraseña
      // guardada todavía para el chequeo de "confirma tu contraseña" al cambiar el
      // correo en Configuración — la primera contraseña real que alguien escriba aquí
      // se convierte en esa contraseña. Si ya existe una (cuenta creada por /signup),
      // esto no la toca — login no valida contra ella, así que sobrescribirla en cada
      // inicio de sesión volvería inútil el chequeo posterior.
      await bootstrapPasswordHashIfMissing(password)

      // Cuenta de prueba del dueño del proyecto — pedido explícito: entrar con este
      // correo debe verse como si tuviera el plan Chef Ejecutivo, sin pasar por Stripe.
      // Se identifica SOLO por el correo (no por contraseña): el login de hoy no
      // verifica contraseñas contra nada real para NINGUNA cuenta (ver login() en
      // contexts/auth-context.tsx), así que comparar una contraseña aquí sería
      // seguridad falsa — y además obligaría a dejar la contraseña real en texto
      // plano en el código fuente, que ahora es público en GitHub.
      if (email.trim().toLowerCase() === "josedanielromero.cr@outlook.com") {
        setCurrentPlanSlug("chef-ejecutivo")
      }
      router.push("/dashboard")
    } catch (error) {
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
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
            Volver al inicio
          </Link>
          {/* Lockup vertical, 64px: primer punto de contacto con la marca (ver docs/36). */}
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
            <h1 className="text-2xl font-bold text-foreground">Gastrometrics</h1>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-border shadow-xl bg-card">
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
                    placeholder="tu@email.com"
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

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    Iniciando sesión...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    {t("login_submit")}
                  </div>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <div className="text-center">
              {/* BUG CORREGIDO: apuntaba a /forgot-password, una ruta que nunca existió (404).
                  La app no tiene backend real de recuperación de contraseña por correo (ver
                  docs/12-guia-backend.md) — /contacto es el único canal de ayuda real hoy. */}
              <Link href="/contacto" className="text-sm text-primary hover:text-primary/80 transition-colors">
                ¿Olvidaste tu contraseña?
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
          <p>Al iniciar sesión, aceptas nuestros términos de servicio y política de privacidad.</p>
        </div>
      </div>
    </div>
  )
}
