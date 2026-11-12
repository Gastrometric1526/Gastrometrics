"use client"

/**
 * Entrada a /admin (pedido del dueño, docs/282): cada persona entra con su propia cuenta
 * de la app, sin código compartido.
 * - Con la cuenta abierta y con acceso: «Entrar como …» (un toque).
 * - Con la cuenta abierta y sin acceso: lo dice y ofrece usar otra cuenta.
 * - Sin cuenta abierta: «Iniciar sesión», que vuelve aquí (/login?next=/admin).
 * - Abajo, plegado, el código de emergencia. La primera vez (sin dueño todavía), entrar con
 *   el código estando con la cuenta abierta deja esa cuenta como dueña del panel.
 * Nunca se escribe ni se guarda una contraseña aquí: la de la cuenta se pone en /login.
 */

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, KeyRound, Lock, LogIn, UserRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import type { AdminSessionInfo } from "@/lib/admin/session-info"
import { cn } from "@/lib/utils"

export function AdminLogin({ info, onUnlocked }: { info: AdminSessionInfo | null; onUnlocked: () => void }) {
  const { t } = useLanguage()
  const [entering, setEntering] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [codeError, setCodeError] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const account = info?.account ?? null
  const accountsReady = info?.membersReady ?? false
  const needsOwner = info?.needsOwner ?? false

  // Cuenta regresiva del bloqueo por intentos fallidos del código.
  useEffect(() => {
    if (!lockedUntil) {
      setSecondsLeft(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) setLockedUntil(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  // Sin dueño todavía o sin la migración, el código es el único camino: se muestra abierto.
  useEffect(() => {
    if (info && (!info.membersReady || info.needsOwner)) setShowCode(true)
  }, [info])

  const enterWithAccount = async () => {
    setEntering(true)
    setAccountError(null)
    try {
      const res = await fetch("/api/admin/account-login", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) onUnlocked()
      else setAccountError(data.error === "not_allowed" ? t("admin_login_not_allowed").replace("{email}", account?.email ?? "") : data.error === "not_ready" ? t("admin_login_not_ready") : t("admin_login_error_generic"))
    } catch {
      setAccountError(t("admin_login_error_generic"))
    } finally {
      setEntering(false)
    }
  }

  const enterWithCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockedUntil && lockedUntil > Date.now()) return
    try {
      const res = await fetch("/api/admin/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setCodeError(false)
        onUnlocked()
      } else {
        if (data.lockedForSeconds) setLockedUntil(Date.now() + data.lockedForSeconds * 1000)
        setCodeError(true)
        setPasscode("")
      }
    } catch {
      setCodeError(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="space-y-3 pb-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{t("admin_login_title")}</CardTitle>
          <CardDescription>{t("admin_login_account_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {accountsReady && account && info?.accountAllowed && (
            <Button className="h-12 w-full gap-2 text-base" onClick={enterWithAccount} disabled={entering} data-admin-login="account">
              <UserRound className="h-5 w-5" />
              {entering ? t("admin_login_entering") : t("admin_login_as").replace("{email}", account.email)}
            </Button>
          )}

          {accountsReady && account && !info?.accountAllowed && !needsOwner && (
            <div className="space-y-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
              <p>{t("admin_login_not_allowed").replace("{email}", account.email)}</p>
              <Link href="/login?next=/admin" className="inline-flex items-center gap-1.5 font-medium text-primary">
                <LogIn className="h-4 w-4" />
                {t("admin_login_other_account")}
              </Link>
            </div>
          )}

          {accountsReady && !account && (
            <Link href="/login?next=/admin" className="block">
              <Button className="h-12 w-full gap-2 text-base" data-admin-login="signin">
                <LogIn className="h-5 w-5" />
                {t("admin_login_signin")}
              </Button>
            </Link>
          )}

          {accountError && <p className="text-sm text-destructive">{accountError}</p>}
          {!accountsReady && info && <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{t("admin_login_not_ready")}</p>}
          {needsOwner && account && <p className="rounded-xl bg-primary/5 p-4 text-sm text-foreground">{t("admin_login_claim_hint").replace("{email}", account.email)}</p>}

          <div className="border-t border-border pt-4">
            <button type="button" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode} className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <KeyRound className="h-4 w-4" />
              {t("admin_login_code_toggle")}
              <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", showCode && "rotate-180")} />
            </button>
            {showCode && (
              <form onSubmit={enterWithCode} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-passcode">{t("admin_login_passcode_label")}</Label>
                  <Input
                    id="admin-passcode"
                    type="password"
                    autoComplete="off"
                    maxLength={200}
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value)
                      setCodeError(false)
                    }}
                    disabled={secondsLeft > 0}
                  />
                  {codeError && secondsLeft === 0 && <p className="text-sm text-destructive">{t("admin_login_error")}</p>}
                  {secondsLeft > 0 && <p className="text-sm text-destructive">{t("admin_login_locked").replace("{seconds}", String(secondsLeft))}</p>}
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={secondsLeft > 0 || !passcode}>
                  {t("admin_login_submit")}
                </Button>
              </form>
            )}
          </div>

          <Link href="/dashboard" className="block">
            <Button type="button" variant="ghost" className="w-full">
              {t("common_back")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
