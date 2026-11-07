"use client"

/**
 * Completar el perfil después de entrar con Google (docs/254): nombre, país, moneda,
 * aceptación de los Términos y novedades por correo, como en el registro con correo.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AuthShell } from "@/components/auth-shell"
import { readReferralCode } from "@/components/referral-signup-banner"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { COUNTRIES } from "@/lib/types/user"

export default function CompleteProfilePage() {
  const { user, userProfile, authChecked } = useAuth()
  const { t, language } = useLanguage()
  const [fullName, setFullName] = useState("")
  const [nationality, setNationality] = useState("")
  const [currency, setCurrency] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [productUpdatesOptIn, setProductUpdatesOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const meta = (user?.user_metadata || {}) as { full_name?: string; name?: string }
    setFullName((current) => current || userProfile?.fullName || meta.full_name || meta.name || "")
  }, [user, userProfile])

  useEffect(() => {
    if (authChecked && !user) window.location.replace("/login")
  }, [authChecked, user])

  const chooseCountry = (code: string) => {
    setNationality(code)
    const country = COUNTRIES.find((c) => c.code === code)
    if (country) setCurrency(country.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!acceptedTerms) {
      setError(t("signup_error_terms_required"))
      return
    }
    if (!fullName.trim() || !nationality || !currency) {
      setError(t("complete_profile_error"))
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          nationality,
          currency,
          preferredLanguage: language,
          productUpdatesOptIn,
          acceptedTerms,
          referralCode: readReferralCode(null) || undefined,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      // Recarga completa: el perfil de la sesión se vuelve a leer con los Términos aceptados.
      window.location.assign("/dashboard")
    } catch {
      setError(t("complete_profile_error"))
      setSaving(false)
    }
  }

  const currencies = COUNTRIES.filter((c, i, all) => i === all.findIndex((o) => o.currency === c.currency))

  return (
    <AuthShell>
      <Card className="border-border bg-card w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-foreground">{t("complete_profile_title")}</CardTitle>
          <CardDescription className="text-muted-foreground">{t("complete_profile_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-foreground font-medium">
                {t("signup_field_full_name")}
              </Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings_country")}
              </Label>
              <Select value={nationality} onValueChange={chooseCountry}>
                <SelectTrigger>
                  <SelectValue placeholder={t("signup_placeholder_country")} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {t(country.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium">{t("signup_field_currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder={t("signup_placeholder_currency")} />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((country) => (
                    <SelectItem key={country.currency} value={country.currency}>
                      {country.currency} ({country.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("signup_currency_hint")}</p>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} />
              <div className="space-y-1">
                <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
                  {t("signup_accept_terms_label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("signup_terms_intro")}{" "}
                  <Link href="/terminos-de-uso" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {t("signup_terms_link")}
                  </Link>
                  {", "}
                  <Link href="/politica-privacidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {t("signup_privacy_link")}
                  </Link>{" "}
                  {t("signup_terms_and")}{" "}
                  <Link href="/aviso-de-responsabilidad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {t("signup_liability_link")}
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="updates" checked={productUpdatesOptIn} onCheckedChange={(v) => setProductUpdatesOptIn(v === true)} />
              <div className="space-y-1">
                <Label htmlFor="updates" className="text-sm font-medium leading-none cursor-pointer">
                  {t("signup_product_updates_label")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("signup_product_updates_desc")}</p>
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {t("complete_profile_submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
