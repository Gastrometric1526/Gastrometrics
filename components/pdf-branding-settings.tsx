"use client"

// Configuración → Apariencia → «Tus PDF» (docs/229). En Chef Ejecutivo los PDF no llevan
// GastroMetrics: aquí se escribe el nombre del encabezado y una línea al pie para el
// espacio actual (negocio o espacio principal). En los demás planes se explica qué incluye.
// Datos del negocio y tipografía de la carta (docs/251): en todos los planes.

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { useActiveMembership, useCurrentPlanSlug } from "@/lib/plan-access"
import { useAllBusinesses } from "@/lib/storage/businesses"
import { WHITE_LABEL_PLAN, getPdfBranding, normalizePdfBranding, savePdfBranding, type PdfBranding, type PdfFiscal } from "@/lib/pdf/pdf-branding"
import type { TranslationKey } from "@/lib/i18n/translations"

const FISCAL_FIELDS: { key: keyof PdfFiscal; label: TranslationKey; max: number; placeholder?: TranslationKey }[] = [
  { key: "legalName", label: "pdf_docs_legal_name", max: 80 },
  { key: "taxId", label: "pdf_docs_tax_id", max: 40, placeholder: "pdf_docs_tax_id_placeholder" },
  { key: "address", label: "pdf_docs_address", max: 120 },
  { key: "phone", label: "pdf_docs_phone", max: 40 },
  { key: "email", label: "pdf_docs_email", max: 80 },
]

export function PdfBrandingSettings({ businessId }: { businessId?: string | null }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const planSlug = useCurrentPlanSlug()
  const { active: isMember } = useActiveMembership()
  const businesses = useAllBusinesses()
  const business = businessId && businessId !== "main" ? businesses.find((b) => b.id === businessId) : undefined
  const [name, setName] = useState("")
  const [footer, setFooter] = useState("")
  const [fiscal, setFiscal] = useState<PdfFiscal>({})
  const [menuFont, setMenuFont] = useState<NonNullable<PdfBranding["menuFont"]>>("clasica")
  // Se guarda solo al salir de un campo (como un formulario normal, sin un segundo botón
  // «Guardar» dentro de Configuración, que ya tiene el suyo).
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [savedValue, setSavedValue] = useState("")

  useEffect(() => {
    const current = getPdfBranding(businessId)
    setName(current.name ?? "")
    setFooter(current.footer ?? "")
    setFiscal(current.fiscal ?? {})
    setMenuFont(current.menuFont ?? "clasica")
    setSavedValue(JSON.stringify(current))
    setStatus("idle")
  }, [businessId, business?.pdfBranding])

  const unlocked = planSlug === WHITE_LABEL_PLAN && !isMember

  const save = async (font = menuFont) => {
    const value = normalizePdfBranding({ name, footer, fiscal, ...(font === "moderna" ? { menuFont: font } : {}) })
    if (JSON.stringify(value) === savedValue) return
    setStatus("saving")
    const ok = await savePdfBranding(businessId, value)
    if (ok) {
      setSavedValue(JSON.stringify(value))
      setStatus("saved")
    } else {
      setStatus("error")
      toast({ title: t("pdf_branding_error"), variant: "destructive" })
    }
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
                onBlur={() => save()}
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
                onBlur={() => save()}
              />
              <p className="text-xs text-muted-foreground">{t("pdf_branding_footer_hint")}</p>
            </div>
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
        {!isMember && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">{t("pdf_docs_title")}</p>
              <p className="text-xs text-muted-foreground">{t("pdf_docs_desc")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FISCAL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`pdf-fiscal-${field.key}`}>{t(field.label)}</Label>
                  <Input
                    id={`pdf-fiscal-${field.key}`}
                    value={fiscal[field.key] ?? ""}
                    maxLength={field.max}
                    placeholder={field.placeholder ? t(field.placeholder) : undefined}
                    onChange={(e) => setFiscal((current) => ({ ...current, [field.key]: e.target.value }))}
                    onBlur={() => save()}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="pdf-menu-font">{t("pdf_docs_menu_font")}</Label>
                <Select
                  value={menuFont}
                  onValueChange={(value) => {
                    const font = value as NonNullable<PdfBranding["menuFont"]>
                    setMenuFont(font)
                    void save(font)
                  }}
                >
                  <SelectTrigger id="pdf-menu-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clasica">{t("pdf_docs_font_classic")}</SelectItem>
                    <SelectItem value="moderna">{t("pdf_docs_font_modern")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" ? t("pdf_branding_saving") : status === "saved" ? t("pdf_branding_saved") : ""}
        </p>
      </CardContent>
    </Card>
  )
}
