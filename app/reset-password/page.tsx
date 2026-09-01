"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { Lock, CheckCircle2 } from "lucide-react"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { consumeAuthHashFromUrl } from "@/lib/supabase/consume-auth-hash"
import { storePasswordHash } from "@/lib/utils/password-hash"

// Página a la que Supabase redirige desde el link del correo de recuperación (ver
// app/forgot-password/page.tsx) — el link ya trae consigo una sesión de recuperación
// temporal (Supabase la establece solo al cargar esta página, vía el hash de la URL),
// así que supabase.auth.updateUser({ password }) ya sabe a qué cuenta aplicarlo sin
// pedir la contraseña anterior.
//
// storePasswordHash() al final actualiza también el hash LOCAL usado para "confirma tu
// contraseña" al cambiar el correo en Configuración (ver docs/48/lib/utils/password-hash.ts)
// — sin esto, ese chequeo seguiría comparando contra la contraseña VIEJA después de un
// reset real, y la persona nunca podría pasarlo con su contraseña nueva.
export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [success, setSuccess] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false
    // Procesa el hash del link de recuperación (ver lib/supabase/consume-auth-hash.ts)
    // antes de preguntar por la sesión — getSession() nunca lo detecta solo.
    consumeAuthHashFromUrl().finally(() => {
      if (cancelled) return
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled) setHasRecoverySession(!!data.session)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage("")

    if (password.length < 8) {
      setErrorMessage(t("reset_password_error_too_short"))
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("reset_password_error_mismatch"))
      return
    }

    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      await storePasswordHash(password)
      setSuccess(true)
      setTimeout(() => router.push("/dashboard"), 2000)
    } catch (error) {
      console.error("Error resetting password:", error)
      setErrorMessage(t("reset_password_error_generic"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
            <h1 className="text-2xl font-bold text-foreground">Gastrometrics</h1>
          </div>
        </div>

        <Card className="border-border bg-card">
          {success ? (
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">{t("reset_password_success_title")}</h2>
              <p className="text-muted-foreground text-sm">{t("reset_password_success_desc")}</p>
            </CardContent>
          ) : hasRecoverySession === false ? (
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-foreground">{t("reset_password_invalid_link")}</p>
              <Link href="/forgot-password">
                <Button className="w-full">{t("reset_password_request_new")}</Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold text-foreground">{t("reset_password_title")}</CardTitle>
                <CardDescription className="text-muted-foreground">{t("reset_password_subtitle")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground font-medium">
                      {t("reset_password_new_password")}
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
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                      {t("reset_password_confirm_password")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    {isLoading ? t("reset_password_saving") : t("reset_password_submit")}
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
