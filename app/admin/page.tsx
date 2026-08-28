"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/contexts/language-context"
import { ArrowLeft, Lock } from "lucide-react"
import { StatsPanel } from "@/components/admin/stats-panel"
import { AccountsPanel } from "@/components/admin/accounts-panel"
import { FeedbackPanel } from "@/components/admin/feedback-panel"
import { AnalyticsPanel } from "@/components/admin/analytics-panel"

// Candado de acceso — pedido explícito: agregar algún control de acceso a /admin,
// que hoy cualquiera con el link puede ver. SIN backend no existe un sistema de roles
// real (el login actual acepta cualquier usuario/contraseña, ver contexts/auth-context.tsx),
// así que esto sigue sin ser control de acceso multiusuario real — es un candado de
// código de acceso, no una cuenta con permisos.
//
// BUG CORREGIDO (ver docs/33): antes el código se comparaba en el cliente contra
// NEXT_PUBLIC_ADMIN_PASSCODE, una variable que Next.js embebe tal cual en el bundle
// del navegador — cualquiera podía extraer el código real leyendo el JS compilado,
// sin necesidad de adivinar nada. Ahora la verificación ocurre en el servidor
// (app/api/admin/verify/route.ts), contra una variable sin el prefijo NEXT_PUBLIC_
// que nunca llega al cliente, y el resultado es una cookie httpOnly que el navegador
// no puede leer ni falsificar. El bloqueo tras varios intentos fallidos también se
// mueve al servidor (por IP), no solo a un contador en sessionStorage.
const ADMIN_SESSION_STORAGE_KEY = "gm_admin_unlocked"

// Panel administrativo — pedido explícito: "ahi debo poder manejar TODO" (ver docs/63).
// Reestructurado en pestañas (Resumen/Cuentas/Feedback) — la lógica de cada una vive en
// components/admin/*-panel.tsx, este archivo solo mantiene el candado de acceso y el
// layout de pestañas.

export default function AdminPage() {
  const { t } = useLanguage()

  const [unlocked, setUnlocked] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [passcodeInput, setPasscodeInput] = useState("")
  const [passcodeError, setPasscodeError] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0)
  const [feedbackCounts, setFeedbackCounts] = useState({ total: 0, nuevo: 0, bug: 0 })

  useEffect(() => {
    // La cookie httpOnly no se puede leer desde JS — se le pregunta al servidor si
    // hay una sesión admin válida. sessionStorage solo se usa como caché optimista
    // para no parpadear la pantalla de candado en cada navegación dentro de /admin.
    const cached = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "true"
    if (cached) setUnlocked(true)

    fetch("/api/admin/verify")
      .then((res) => res.json())
      .then((data) => {
        setUnlocked(!!data.unlocked)
        if (data.unlocked) sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
        else sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
      })
      .catch(() => {})
      .finally(() => setCheckedSession(true))
  }, [])

  // Cuenta regresiva visible mientras dura el bloqueo, para que el mensaje de espera
  // no quede pegado con el mismo número.
  useEffect(() => {
    if (!lockedUntil) {
      setLockoutSecondsLeft(0)
      return
    }
    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockoutSecondsLeft(secondsLeft)
      if (secondsLeft === 0) setLockedUntil(null)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockedUntil && lockedUntil > Date.now()) return

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcodeInput }),
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "true")
        setUnlocked(true)
        setPasscodeError(false)
      } else {
        if (data.lockedForSeconds) setLockedUntil(Date.now() + data.lockedForSeconds * 1000)
        setPasscodeError(true)
        setPasscodeInput("")
      }
    } catch {
      setPasscodeError(true)
    }
  }

  if (!checkedSession) {
    return null
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>{t("admin_login_title")}</CardTitle>
            <CardDescription>{t("admin_login_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-passcode">{t("admin_login_passcode_label")}</Label>
                <Input
                  id="admin-passcode"
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value)
                    setPasscodeError(false)
                  }}
                  disabled={lockoutSecondsLeft > 0}
                  autoFocus
                />
                {passcodeError && lockoutSecondsLeft === 0 && (
                  <p className="text-sm text-destructive">{t("admin_login_error")}</p>
                )}
                {lockoutSecondsLeft > 0 && (
                  <p className="text-sm text-destructive">
                    {t("admin_login_locked").replace("{seconds}", String(lockoutSecondsLeft))}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={lockoutSecondsLeft > 0}>
                {t("admin_login_submit")}
              </Button>
              <Link href="/dashboard">
                <Button type="button" variant="ghost" className="w-full">
                  {t("common_back")}
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-4">
                <ArrowLeft className="h-4 w-4" />
                {t("common_back")}
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-foreground">{t("admin_page_title")}</h1>
            <p className="text-muted-foreground">{t("admin_page_subtitle")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await fetch("/api/admin/verify", { method: "DELETE" })
              sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
              setUnlocked(false)
            }}
          >
            {t("admin_logout")}
          </Button>
        </div>

        <Tabs defaultValue="resumen">
          <TabsList>
            <TabsTrigger value="resumen">{t("admin_tab_resumen")}</TabsTrigger>
            <TabsTrigger value="cuentas">{t("admin_tab_accounts")}</TabsTrigger>
            <TabsTrigger value="feedback">
              {t("admin_tab_feedback")} ({feedbackCounts.total})
            </TabsTrigger>
            <TabsTrigger value="analiticas">{t("admin_tab_analytics")}</TabsTrigger>
          </TabsList>
          <TabsContent value="resumen" className="mt-6">
            <StatsPanel feedbackCounts={feedbackCounts} />
          </TabsContent>
          <TabsContent value="cuentas" className="mt-6">
            <AccountsPanel />
          </TabsContent>
          <TabsContent value="feedback" className="mt-6">
            <FeedbackPanel onCountsChange={setFeedbackCounts} />
          </TabsContent>
          <TabsContent value="analiticas" className="mt-6">
            <AnalyticsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
