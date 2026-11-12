"use client"

/**
 * «¿Problemas para entrar?» (pedido del dueño, docs/285). Una página para cada situación:
 * - olvidé mi contraseña → /forgot-password (el enlace llega al correo);
 * - no recuerdo con qué correo me registré, o ya no tengo acceso a mi correo → una
 *   solicitud que llega a /admin → Mensajes → «Recuperar cuentas» y al correo del dueño,
 *   que verifica y le cambia el correo o le manda el enlace.
 * Nunca dice si un correo existe (para no revelar quién tiene cuenta).
 */

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, KeyRound, MailQuestion, MailX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { AuthShell } from "@/components/auth-shell"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

type Kind = "forgot_email" | "lost_email"

export default function RecoverAccountPage() {
  const { t, language } = useLanguage()
  const [kind, setKind] = useState<Kind | null>(null)
  const [form, setForm] = useState({ fullName: "", businessName: "", contact: "", possibleEmails: "", details: "" })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kind) return
    if (!form.fullName.trim()) return setError(t("recover_error_name"))
    if (!form.contact.trim()) return setError(t("recover_error_contact"))
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/account/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...form, language }) })
      if (res.ok) setSent(true)
      else setError(res.status === 429 ? t("recover_error_rate") : t("recover_error_generic"))
    } catch {
      setError(t("recover_error_generic"))
    } finally {
      setSending(false)
    }
  }

  const Option = ({ icon: Icon, title, desc, onClick, href }: { icon: typeof KeyRound; title: string; desc: string; onClick?: () => void; href?: string }) => {
    const inner = (
      <span className="flex items-start gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-semibold text-foreground">{title}</span>
          <span className="block text-sm text-muted-foreground">{desc}</span>
        </span>
      </span>
    )
    const cls = "block w-full rounded-xl border border-border p-4 transition-colors hover:border-primary hover:bg-primary/5"
    return href ? (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    ) : (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <GastrometricsLogo className="h-14 w-14" variant="brand" />
        </div>
        <Card className="border-border bg-card">
          {sent ? (
            <CardContent className="space-y-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="text-xl font-semibold text-foreground">{t("recover_sent_title")}</h1>
              <p className="text-sm text-muted-foreground">{t("recover_sent_desc").replace("{contact}", form.contact)}</p>
              <Link href="/login">
                <Button variant="outline" className="mt-2 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {t("recover_back_login")}
                </Button>
              </Link>
            </CardContent>
          ) : !kind ? (
            <>
              <CardHeader>
                <CardTitle>{t("recover_title")}</CardTitle>
                <CardDescription>{t("recover_subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Option icon={KeyRound} title={t("recover_opt_password")} desc={t("recover_opt_password_desc")} href="/forgot-password" />
                <Option icon={MailQuestion} title={t("recover_opt_forgot_email")} desc={t("recover_opt_forgot_email_desc")} onClick={() => setKind("forgot_email")} />
                <Option icon={MailX} title={t("recover_opt_lost_email")} desc={t("recover_opt_lost_email_desc")} onClick={() => setKind("lost_email")} />
                <Link href="/login" className="flex items-center justify-center gap-1.5 pt-2 text-sm text-primary">
                  <ArrowLeft className="h-4 w-4" />
                  {t("recover_back_login")}
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{kind === "forgot_email" ? t("recover_opt_forgot_email") : t("recover_opt_lost_email")}</CardTitle>
                <CardDescription>{t("recover_form_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="rc-name">{t("recover_field_name")}</Label>
                    <Input id="rc-name" value={form.fullName} onChange={set("fullName")} maxLength={120} autoComplete="name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rc-business">{t("recover_field_business")}</Label>
                    <Input id="rc-business" value={form.businessName} onChange={set("businessName")} maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rc-emails">{kind === "forgot_email" ? t("recover_field_possible_emails") : t("recover_field_old_email")}</Label>
                    <Input id="rc-emails" value={form.possibleEmails} onChange={set("possibleEmails")} maxLength={300} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rc-contact">{kind === "lost_email" ? t("recover_field_new_contact") : t("recover_field_contact")}</Label>
                    <Input id="rc-contact" value={form.contact} onChange={set("contact")} maxLength={200} placeholder={t("recover_field_contact_placeholder")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rc-details">{t("recover_field_details")}</Label>
                    <Textarea id="rc-details" rows={3} value={form.details} onChange={set("details")} maxLength={1000} placeholder={t("recover_field_details_placeholder")} />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <p className="text-xs text-muted-foreground">{t("recover_privacy")}</p>
                  <div className={cn("flex gap-2")}>
                    <Button type="button" variant="outline" onClick={() => setKind(null)}>
                      {t("common_back")}
                    </Button>
                    <Button type="submit" className="flex-1" disabled={sending}>
                      {sending ? t("recover_sending") : t("recover_send")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </AuthShell>
  )
}
