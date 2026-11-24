"use client"

/**
 * «Regala un mes, gana un mes» para el INVITADO (pedido del dueño, docs/346: «las personas
 * que invitan y las invitadas deben saber qué hacer para ganar sus respectivos meses»).
 *
 * Antes, quien llegaba por un enlace recibía su mes de Chef Ejecutivo pero nadie le decía que
 * su colega gana el suyo cuando él guarda su primera receta con costo. Esta tarjeta del
 * Dashboard se lo dice mientras corre su mes:
 * - sin receta con costo: qué hacer y cuántos días le quedan, con el botón para hacerlo;
 * - con receta con costo (el servidor lo revisa una vez al día): que su colega ya gana su mes;
 * - cuando su colega ya lo ganó: una sola vez, gracias, y que él también puede invitar.
 * «Ahora no» la esconde un día en este aparato; la de «ya lo ganó» se cierra para siempre.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gift, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { ensureRecipesLoaded, getRecipes } from "@/lib/storage/recipes"

type InvitedBy = { name: string | null; status: "registered" | "active" | "rewarded" | "expired" | string; daysLeft: number }

const DAY_MS = 86_400_000

export function ReferralInviteeCard() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [info, setInfo] = useState<InvitedBy | null>(null)
  const [hasCostedRecipe, setHasCostedRecipe] = useState(false)
  const [hidden, setHidden] = useState(true)
  const key = (suffix: string) => `gm_referral_invitee:${user?.id ?? "-"}:${suffix}`

  useEffect(() => {
    if (!user) return
    let alive = true
    fetch("/api/referral/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const invitedBy = (data?.invitedBy ?? null) as InvitedBy | null
        // «active» = empezó, pero quien invitó ya llegó a su tope del año: no ganó mes, no se dice (docs/353).
        if (!alive || !invitedBy || invitedBy.status === "expired" || invitedBy.status === "active") return
        let snoozed = false
        let thanked = false
        try {
          snoozed = Date.now() - Number(localStorage.getItem(key("snooze")) || 0) < DAY_MS
          thanked = localStorage.getItem(key("thanked")) === "1"
        } catch {}
        const done = invitedBy.status === "rewarded"
        if (done ? thanked : snoozed || invitedBy.daysLeft <= 0) return
        await ensureRecipesLoaded(null)
        if (!alive) return
        setHasCostedRecipe((getRecipes(null) || []).some((r) => (r.totalCost || 0) > 0))
        setInfo(invitedBy)
        setHidden(false)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (hidden || !info) return null
  const name = info.name || t("referral_invitee_colleague")
  const done = info.status === "rewarded"
  const close = () => {
    try {
      if (done) localStorage.setItem(key("thanked"), "1")
      else localStorage.setItem(key("snooze"), String(Date.now()))
    } catch {}
    setHidden(true)
  }

  const title = done
    ? t("referral_invitee_done_title").replace("{name}", name)
    : t("referral_invitee_title").replace("{name}", name).replace("{days}", String(info.daysLeft))
  const body = done
    ? t("referral_invitee_done_desc")
    : hasCostedRecipe
      ? t("referral_invitee_pending_desc").replace("{name}", name)
      : t("referral_invitee_desc").replace("{name}", name)

  return (
    <section role="note" className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 pr-10" data-testid="referral-invitee-card">
      <button
        type="button"
        onClick={close}
        aria-label={done ? t("common_close") : t("referral_invitee_later")}
        className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {done ? (
              <Button asChild size="sm">
                <Link href="/mi-plan?tour=mi-plan&desde=invita#invita" onClick={close}>
                  {t("referral_invitee_invite_cta")}
                </Link>
              </Button>
            ) : hasCostedRecipe ? null : (
              <Button asChild size="sm">
                <Link href="/ficha-tecnica">{t("referral_invitee_cta")}</Link>
              </Button>
            )}
            {!done && (
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                {t("referral_invitee_later")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
