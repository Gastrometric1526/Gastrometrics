"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

// Recuperación de contraseña real — antes de esto, "¿Olvidaste tu contraseña?" en
// /login apuntaba a /contacto porque no había backend real de recuperación (ver
// docs/50). Ahora sí: supabase.auth.resetPasswordForEmail manda un correo real con
// un link a /reset-password (ver esa página para el resto del flujo).
//
// A propósito no se distingue en la UI entre "correo no existe" y "correo enviado" —
// siempre se muestra el mismo mensaje de éxito, para no confirmarle a quien sea que
// un correo específico SÍ tiene cuenta en la app (mismo criterio que usan la mayoría
// de apps reales para esta pantalla).
export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage("")

    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setSent(true)
    } catch (error) {
      console.error("Error requesting password reset:", error)
      setErrorMessage(t("forgot_password_error"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("forgot_password_back_to_login")}
          </Link>
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
            <h1 className="text-2xl font-bold text-foreground">Gastrometrics</h1>
          </div>
        </div>

        <Card className="border-border shadow-xl bg-card">
          {sent ? (
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">{t("forgot_password_sent_title")}</h2>
              <p className="text-muted-foreground text-sm">{t("forgot_password_sent_desc")}</p>
              <Link href="/login">
                <Button className="w-full">{t("forgot_password_back_to_login")}</Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold text-foreground">{t("forgot_password_title")}</CardTitle>
                <CardDescription className="text-muted-foreground">{t("forgot_password_subtitle")}</CardDescription>
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

                  {errorMessage && (
                    <p className="text-sm text-destructive text-center" role="alert">
                      {errorMessage}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? t("forgot_password_sending") : t("forgot_password_submit")}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
