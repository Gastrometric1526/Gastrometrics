"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getFeedback, updateFeedbackStatus, deleteFeedback } from "@/lib/storage/feedback"
import { getAllBusinesses } from "@/lib/storage/businesses"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import type { Feedback, FeedbackStatus, FeedbackType } from "@/types/feedback"
import { AlertTriangle, Bug, Lightbulb, MessageCircleWarning, Trash2, ArrowLeft, Lock } from "lucide-react"

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

// Panel administrativo — pedido explícito: "no se si deberias crear un perfil
// administrativo donde yo como dueno pueda ver todo esto, los usuarios cuantos hay etc
// etc, te dejo completa libertad". Lo que SÍ se puede mostrar honestamente hoy, sin
// backend conectado (ver docs/23-preparacion-backend-supabase-stripe.md): el buzón de
// sugerencias/quejas/reportes y estadísticas agregadas de ESTE dispositivo/navegador.
// Un conteo real de "cuántos usuarios hay" en total requiere el backend conectado,
// porque cada navegador solo ve su propio localStorage — no hay forma honesta de sumar
// usuarios de otros dispositivos sin un servidor real. Se deja esa sección explícita
// como pendiente en vez de inventar un número falso.

const typeConfigDefs: Record<FeedbackType, { labelKey: "admin_type_suggestion" | "admin_type_complaint" | "admin_type_bug"; icon: typeof Lightbulb; color: string }> = {
  sugerencia: { labelKey: "admin_type_suggestion", icon: Lightbulb, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  queja: { labelKey: "admin_type_complaint", icon: MessageCircleWarning, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  bug: { labelKey: "admin_type_bug", icon: Bug, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
}

const statusLabelKeys: Record<FeedbackStatus, "admin_status_new" | "admin_status_reviewed" | "admin_status_resolved"> = {
  nuevo: "admin_status_new",
  revisado: "admin_status_reviewed",
  resuelto: "admin_status_resolved",
}

export default function AdminPage() {
  const { toast } = useToast()
  const { t, language } = useLanguage()

  const typeConfig = {
    sugerencia: { ...typeConfigDefs.sugerencia, label: t(typeConfigDefs.sugerencia.labelKey) },
    queja: { ...typeConfigDefs.queja, label: t(typeConfigDefs.queja.labelKey) },
    bug: { ...typeConfigDefs.bug, label: t(typeConfigDefs.bug.labelKey) },
  }

  const statusLabels = {
    nuevo: t(statusLabelKeys.nuevo),
    revisado: t(statusLabelKeys.revisado),
    resuelto: t(statusLabelKeys.resuelto),
  }
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [businessCount, setBusinessCount] = useState(0)
  const [filter, setFilter] = useState<"todos" | FeedbackType>("todos")
  const [unlocked, setUnlocked] = useState(false)
  const [checkedSession, setCheckedSession] = useState(false)
  const [passcodeInput, setPasscodeInput] = useState("")
  const [passcodeError, setPasscodeError] = useState(false)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0)

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

  const loadData = () => {
    setFeedback(getFeedback())
    setBusinessCount(getAllBusinesses().length + 1) // +1 por "main", el workspace por defecto
  }

  useEffect(() => {
    if (unlocked) loadData()
  }, [unlocked])

  const handleStatusChange = (id: string, status: FeedbackStatus) => {
    updateFeedbackStatus(id, status)
    loadData()
  }

  const handleDelete = (id: string) => {
    deleteFeedback(id)
    loadData()
    toast({ title: t("admin_delete_toast_title"), description: t("admin_delete_toast_desc") })
  }

  const filtered = filter === "todos" ? feedback : feedback.filter((f) => f.type === filter)
  const counts = {
    total: feedback.length,
    nuevo: feedback.filter((f) => f.status === "nuevo").length,
    sugerencia: feedback.filter((f) => f.type === "sugerencia").length,
    queja: feedback.filter((f) => f.type === "queja").length,
    bug: feedback.filter((f) => f.type === "bug").length,
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

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground space-y-1">
              <p className="font-medium">{t("admin_device_warning_title")}</p>
              <p className="text-muted-foreground">{t("admin_device_warning_body")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("admin_stat_businesses")}</CardDescription>
              <CardTitle className="text-3xl">{businessCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("admin_stat_unread")}</CardDescription>
              <CardTitle className="text-3xl">{counts.nuevo}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("admin_stat_bugs")}</CardDescription>
              <CardTitle className="text-3xl">{counts.bug}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("admin_stat_total")}</CardDescription>
              <CardTitle className="text-3xl">{counts.total}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin_inbox_title")}</CardTitle>
            <CardDescription>{t("admin_inbox_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="todos">{t("admin_tab_all")} ({counts.total})</TabsTrigger>
                <TabsTrigger value="sugerencia">{t("admin_tab_suggestions")} ({counts.sugerencia})</TabsTrigger>
                <TabsTrigger value="queja">{t("admin_tab_complaints")} ({counts.queja})</TabsTrigger>
                <TabsTrigger value="bug">{t("admin_tab_bugs")} ({counts.bug})</TabsTrigger>
              </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{t("admin_empty_category")}</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const config = typeConfig[item.type]
                  return (
                    <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge className={config.color} variant="secondary">
                            <config.icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString(getDateLocale(language))}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                      <p className="text-foreground text-sm whitespace-pre-wrap">{item.message}</p>
                      {item.imageDataUrl && (
                        <a href={item.imageDataUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={item.imageDataUrl || "/placeholder.svg"}
                            alt={t("contacto_image_alt")}
                            className="max-h-48 rounded-lg border border-border object-contain hover:opacity-90 transition-opacity"
                          />
                        </a>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {item.userName || t("admin_anonymous")}
                          {item.userEmail ? ` · ${item.userEmail}` : ""}
                          {item.page ? ` · ${item.page}` : ""}
                        </span>
                        <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v as FeedbackStatus)}>
                          <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
