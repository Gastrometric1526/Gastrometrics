"use client"

/**
 * Entrada a /admin. Desde docs/298 (pedido del dueño: «no creo que sea necesario que abra
 * sesión en mi cuenta de GastroMetrics para poder ingresar a la cuenta de admin») el panel
 * tiene su propia entrada, separada de la app:
 * - Correo y contraseña de la cuenta, escritos aquí (`/api/admin/password-login`). Solo se
 *   abre la sesión del panel; la de la app no se toca.
 * - «Enviarme un enlace al correo» (`/api/admin/email-link`), sin contraseña: sirve también
 *   a quien entra a la app con Google. El enlace abre /admin?entrar=… y pide un toque.
 * - Si ya hay una cuenta con acceso abierta en la app, sigue el atajo «Entrar como …».
 * - Abajo, plegado, el código de emergencia (docs/282). La primera vez (sin dueño todavía),
 *   entrar con el código estando con la cuenta abierta deja esa cuenta como dueña.
 * La contraseña nunca se guarda: va directo al servidor, que la comprueba y la olvida.
 */

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, KeyRound, Lock, Mail, UserRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import type { AdminSessionInfo } from "@/lib/admin/session-info"
import { cn } from "@/lib/utils"

const LINK_PARAM = "entrar"

function readLinkToken(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get(LINK_PARAM)
}

function dropLinkToken() {
  const params = new URLSearchParams(window.location.search)
  if (!params.has(LINK_PARAM)) return
  params.delete(LINK_PARAM)
  const query = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

/** Cuenta regresiva de un bloqueo por intentos fallidos. */
function useCountdown() {
  const [until, setUntil] = useState<number | null>(null)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!until) {
      setLeft(0)
      return
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setLeft(s)
      if (s === 0) setUntil(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [until])
  return { left, lockFor: (seconds: number) => setUntil(Date.now() + seconds * 1000) }
}

export function AdminLogin({ info, onUnlocked }: { info: AdminSessionInfo | null; onUnlocked: () => void }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState<null | "account" | "password" | "link" | "token">(null)
  const [accountError, setAccountError] = useState<string | null>(null)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)
  const formLock = useCountdown()

  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [linkError, setLinkError] = useState(false)

  const [showCode, setShowCode] = useState(false)
  const [passcode, setPasscode] = useState("")
  const [codeError, setCodeError] = useState(false)
  const codeLock = useCountdown()

  const account = info?.account ?? null
  const accountsReady = info?.membersReady ?? false
  const needsOwner = info?.needsOwner ?? false

  useEffect(() => setLinkToken(readLinkToken()), [])

  // Sin dueño todavía o sin la migración, el código es el único camino: se muestra abierto.
  useEffect(() => {
    if (info && (!info.membersReady || info.needsOwner)) setShowCode(true)
  }, [info])

  const post = async (url: string, body?: unknown) => {
    const res = await fetch(url, { method: "POST", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok && data.ok === true, data }
  }

  const enterWithAccount = async () => {
    setBusy("account")
    setAccountError(null)
    try {
      const { ok, data } = await post("/api/admin/account-login")
      if (ok) onUnlocked()
      else setAccountError(data.error === "not_ready" ? t("admin_login_not_ready") : t("admin_login_error_generic"))
    } catch {
      setAccountError(t("admin_login_error_generic"))
    } finally {
      setBusy(null)
    }
  }

  const enterWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formLock.left > 0) return
    setBusy("password")
    setFormError(null)
    setLinkSentTo(null)
    try {
      const { ok, data } = await post("/api/admin/password-login", { email, password })
      if (ok) {
        onUnlocked()
        return
      }
      setPassword("")
      if (data.lockedForSeconds) formLock.lockFor(data.lockedForSeconds)
      setFormError(
        data.error === "locked"
          ? null
          : data.error === "not_allowed"
            ? t("admin_login_not_allowed").replace("{email}", email.trim().toLowerCase())
            : data.error === "not_ready"
              ? t("admin_login_not_ready")
              : data.error === "invalid"
                ? t("admin_login_bad_credentials")
                : t("admin_login_error_generic"),
      )
    } catch {
      setFormError(t("admin_login_error_generic"))
    } finally {
      setBusy(null)
    }
  }

  const sendLink = async () => {
    const to = email.trim().toLowerCase()
    setFormError(null)
    setLinkSentTo(null)
    if (!to.includes("@")) {
      setFormError(t("admin_login_link_need_email"))
      return
    }
    setBusy("link")
    try {
      const { ok, data } = await post("/api/admin/email-link", { email: to })
      if (ok) setLinkSentTo(to)
      else setFormError(data.error === "locked" ? t("admin_login_link_wait") : t("admin_login_error_generic"))
    } catch {
      setFormError(t("admin_login_error_generic"))
    } finally {
      setBusy(null)
    }
  }

  const enterWithToken = async () => {
    if (!linkToken) return
    setBusy("token")
    setLinkError(false)
    try {
      const { ok } = await post("/api/admin/email-link", { token: linkToken })
      dropLinkToken()
      if (ok) {
        onUnlocked()
        return
      }
      setLinkToken(null)
      setLinkError(true)
    } catch {
      setLinkError(true)
    } finally {
      setBusy(null)
    }
  }

  const enterWithCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (codeLock.left > 0) return
    try {
      const { ok, data } = await post("/api/admin/verify", { passcode })
      if (ok) {
        setCodeError(false)
        onUnlocked()
      } else {
        if (data.lockedForSeconds) codeLock.lockFor(data.lockedForSeconds)
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
          <CardDescription>{linkToken ? t("admin_login_link_title") : t("admin_login_account_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {linkToken ? (
            <Button className="h-12 w-full gap-2 text-base" onClick={enterWithToken} disabled={busy !== null} data-admin-login="token">
              <Mail className="h-5 w-5" />
              {busy === "token" ? t("admin_login_entering") : t("admin_login_submit")}
            </Button>
          ) : (
            <>
              {linkError && <p className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive">{t("admin_login_link_invalid")}</p>}

              {accountsReady && account && info?.accountAllowed && (
                <Button className="h-12 w-full gap-2 text-base" onClick={enterWithAccount} disabled={busy !== null} data-admin-login="account">
                  <UserRound className="h-5 w-5" />
                  {busy === "account" ? t("admin_login_entering") : t("admin_login_as").replace("{email}", account.email)}
                </Button>
              )}
              {accountError && <p className="text-sm text-destructive">{accountError}</p>}

              {accountsReady && (
                <form onSubmit={enterWithPassword} className="space-y-3" data-admin-login="form">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">{t("admin_login_email_label")}</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="username"
                      maxLength={200}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setFormError(null)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="admin-password">{t("admin_login_password_label")}</Label>
                      <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                        {t("admin_login_forgot")}
                      </Link>
                    </div>
                    <Input
                      id="admin-password"
                      type="password"
                      autoComplete="current-password"
                      maxLength={200}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setFormError(null)
                      }}
                      disabled={formLock.left > 0}
                    />
                  </div>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                  {formLock.left > 0 && <p className="text-sm text-destructive">{t("admin_login_locked").replace("{seconds}", String(formLock.left))}</p>}
                  {linkSentTo && <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{t("admin_login_link_sent").replace("{email}", linkSentTo)}</p>}
                  <Button type="submit" className="h-11 w-full" disabled={busy !== null || formLock.left > 0 || !email || !password}>
                    {busy === "password" ? t("admin_login_entering") : t("admin_login_submit")}
                  </Button>
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={sendLink} disabled={busy !== null} data-admin-login="send-link">
                    <Mail className="h-4 w-4" />
                    {busy === "link" ? t("admin_login_entering") : t("admin_login_send_link")}
                  </Button>
                </form>
              )}

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
                        disabled={codeLock.left > 0}
                      />
                      {codeError && codeLock.left === 0 && <p className="text-sm text-destructive">{t("admin_login_error")}</p>}
                      {codeLock.left > 0 && <p className="text-sm text-destructive">{t("admin_login_locked").replace("{seconds}", String(codeLock.left))}</p>}
                    </div>
                    <Button type="submit" variant="outline" className="w-full" disabled={codeLock.left > 0 || !passcode}>
                      {t("admin_login_submit")}
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}

          <Link href="/" className="block">
            <Button type="button" variant="ghost" className="w-full">
              {t("common_back")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
