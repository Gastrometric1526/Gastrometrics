"use client"

// Configuración → Apariencia → «Tus PDF» (docs/229). En Chef Ejecutivo los PDF no llevan
// GastroMetrics: aquí se escribe el nombre del encabezado y una línea al pie para el
// espacio actual (negocio o espacio principal). En los demás planes se explica qué incluye.

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useActiveMembership, useCurrentPlanSlug } from "@/lib/plan-access"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { WHITE_LABEL_PLAN, getPdfBranding, savePdfBranding } from "@/lib/pdf/pdf-branding"

export function PdfBrandingSettings({ businessId }: { businessId?: string | null }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const planSlug = useCurrentPlanSlug()
  const { active: isMember } = useActiveMembership()
  const businesses = useAllBusinesses()
  const business = businessId && businessId !== "main" ? businesses.find((b) => b.id === businessId) : undefined
  const [name, setName] = useState("")
  const [footer, setFooter] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const current = getPdfBranding(businessId)
    setName(current.name ?? "")
    setFooter(current.footer ?? "")
  }, [businessId, business?.pdfBranding])

  const unlocked = planSlug === WHITE_LABEL_PLAN && !isMember

  const save = async () => {
    setSaving(true)
    const ok = await savePdfBranding(businessId, { name, footer })
    setSaving(false)
    toast(ok ? { title: t("pdf_branding_saved") } : { title: t("pdf_branding_error"), variant: "destructive" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("pdf_branding_title")}
        </CardTitle>
        <CardDescription>{unlocked ? t("pdf_branding_desc") : t("pdf_branding_locked_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unlocked ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("pdf_branding_applies_to").replace("{name}", business?.name || t("pdf_branding_main_space"))}
            </p>
            <div className="space-y-2">
              <Label htmlFor="pdf-branding-name">{t("pdf_branding_name_label")}</Label>
              <Input
                id="pdf-branding-name"
                value={name}
                maxLength={60}
                placeholder={business?.name || t("pdf_branding_name_placeholder")}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("pdf_branding_name_hint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf-branding-footer">{t("pdf_branding_footer_label")}</Label>
              <Input
                id="pdf-branding-footer"
                value={footer}
                maxLength={120}
                placeholder={t("pdf_branding_footer_placeholder")}
                onChange={(e) => setFooter(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("pdf_branding_footer_hint")}</p>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? t("pdf_branding_saving") : t("pdf_branding_save")}
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-2 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{isMember ? t("pdf_branding_member_note") : t("pdf_branding_locked_note")}</span>
            </p>
            {!isMember && (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/mi-plan">{t("pdf_branding_see_plans")}</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
