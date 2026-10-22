"use client"

/**
 * Aviso del registro cuando la persona llega por el enlace de un colega (docs/179):
 * «Fulano te regala un mes de Chef Ejecutivo». El código viene de ?ref= o de la cookie
 * que dejó /r/<código>.
 */

import { useEffect, useState } from "react"
import { Gift } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { REFERRAL, normalizeReferralCode } from "@/lib/referrals"

export function readReferralCode(fromUrl: string | null): string | null {
  const direct = normalizeReferralCode(fromUrl)
  if (direct) return direct
  if (typeof document === "undefined") return null
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL.cookieName}=`))
  return normalizeReferralCode(cookie?.slice(REFERRAL.cookieName.length + 1))
}

export function ReferralSignupBanner({ code }: { code: string | null }) {
  const { t } = useLanguage()
  const [name, setName] = useState<string | null>(null)
  const [valid, setValid] = useState(false)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    fetch(`/api/referral/lookup?code=${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.valid) return
        setValid(true)
        setName(data.firstName || null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [code])

  if (!code || !valid) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4" role="status">
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="space-y-0.5">
        <p className="font-semibold text-foreground">
          {name ? t("referral_signup_title").replace("{name}", name) : t("referral_signup_title_noname")}
        </p>
        <p className="text-sm text-muted-foreground">{t("referral_signup_desc")}</p>
      </div>
    </div>
  )
}
