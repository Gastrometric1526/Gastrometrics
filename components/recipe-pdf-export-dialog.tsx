"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileDown, FileText, Users, File, CheckCircle, Lock, ShieldAlert } from "lucide-react"
import type { Recipe, PDFExportType } from "@/types/recipe"
import { downloadRecipePDF } from "@/lib/pdf/recipe-pdf-generator"
import { useFeatureAccess, useActiveMembership } from "@/lib/plan-access"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"

interface RecipePDFExportDialogProps {
  recipe: Recipe
  open: boolean
  onOpenChange: (open: boolean) => void
  businessName?: string
  businessLogo?: string
  // true cuando `recipe` es la versión escalada por PAX en memoria (ver
  // onScaledPreviewChange en components/technical-sheet/index.tsx), no la receta
  // realmente guardada — el aviso deja claro que este PDF no afecta lo guardado.
  isScaledPreview?: boolean
}

export function RecipePDFExportDialog({
  recipe,
  open,
  onOpenChange,
  businessName,
  businessLogo,
  isScaledPreview,
}: RecipePDFExportDialogProps) {
  const canExportAdministrative = useFeatureAccess("pdf_admin")
  const canExportAtAll = useFeatureAccess("pdf_export")
  const { member: previewMember } = useActiveMembership()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<PDFExportType>(canExportAdministrative ? "administrative" : "employee")

  // El plan puede confirmarse (de null a true) recien despues del primer render en el
  // cliente (ver useFeatureAccess) — si "administrative" ya estaba seleccionado por
  // defecto en el server, no hace falta reaccionar; esto solo importa si el usuario
  // SI tiene el permiso pero el valor inicial quedo en "employee" por el arranque en null.
  useEffect(() => {
    if (canExportAdministrative && selectedType === "employee") {
      setSelectedType("administrative")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canExportAdministrative])
  const [showPreview, setShowPreview] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!canExportAtAll) return
    if (selectedType === "administrative" && !canExportAdministrative) return
    try {
      setIsExporting(true)

      const options = {
        type: selectedType,
        includeImage: !!recipe.image,
        includeCosts: selectedType === "administrative",
        includePricing: selectedType === "administrative",
        includeNotes: selectedType !== "normal",
        businessName,
        businessLogo,
      }

      downloadRecipePDF(recipe, options)

      onOpenChange(false)
    } catch (error) {
      console.error("Error exporting PDF:", error)
      toast({
        title: t("pdfexport_toast_error_title"),
        description: t("pdfexport_toast_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const pdfTypes = [
    {
      value: "administrative" as PDFExportType,
      icon: FileText,
      title: t("pdfexport_type_administrative_title"),
      description: t("pdfexport_type_administrative_desc"),
    },
    {
      value: "employee" as PDFExportType,
      icon: Users,
      title: t("pdfexport_type_employee_title"),
      description: t("pdfexport_type_employee_desc"),
    },
    {
      value: "normal" as PDFExportType,
      icon: File,
      title: t("pdfexport_type_normal_title"),
      description: t("pdfexport_type_normal_desc"),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileDown className="h-5 w-5" />
            {t("pdfexport_dialog_title")}
          </DialogTitle>
          <DialogDescription>
            {t("pdfexport_dialog_desc").replace("{name}", recipe.name)}
          </DialogDescription>
        </DialogHeader>

        {canExportAtAll === false ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">{t("pdfexport_locked_title")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("pdfexport_locked_desc")}</p>
              {previewMember && (
                <p className="text-xs text-muted-foreground mt-3">
                  {t("pdfexport_preview_member").replace("{name}", previewMember.name || previewMember.email)}
                </p>
              )}
            </div>
          </div>
        ) : (
        <div className="space-y-4 py-4">
          {isScaledPreview && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                {t("pdfexport_scaled_preview_notice").replace("{yield}", recipe.yieldAmount.toFixed(0))}
              </AlertDescription>
            </Alert>
          )}
          <RadioGroup value={selectedType} onValueChange={(value) => setSelectedType(value as PDFExportType)}>
            {pdfTypes.map((type) => {
              const Icon = type.icon
              const isLocked = type.value === "administrative" && !canExportAdministrative
              return (
                <div
                  key={type.value}
                  className={`relative flex items-start space-x-3 rounded-lg border-2 p-4 transition-all ${
                    isLocked
                      ? "border-border opacity-60 cursor-not-allowed"
                      : selectedType === type.value
                        ? "border-primary bg-primary/5 cursor-pointer"
                        : "border-border hover:border-primary/50 hover:bg-accent cursor-pointer"
                  }`}
                  onClick={() => !isLocked && setSelectedType(type.value)}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="mt-1" disabled={isLocked} />
                  <div className="flex-1">
                    <Label htmlFor={type.value} className="flex items-center gap-2 font-semibold cursor-pointer">
                      <Icon className="h-5 w-5" />
                      {type.title}
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                          <Lock className="h-3 w-3" /> {t("pdfexport_requires_plan")}
                        </span>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                  </div>
                  {!isLocked && selectedType === type.value && (
                    <CheckCircle className="h-5 w-5 text-primary absolute top-4 right-4" />
                  )}
                </div>
              )
            })}
          </RadioGroup>

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>{t("pdfexport_info_filename_label")}</strong> [Tipo][NombreReceta]v[Versión][AAAA-MM-DD][HHmm].pdf
              <br />
              <strong>{t("pdfexport_info_pagesize_label")}</strong> {t("pdfexport_info_pagesize_value")}
              <br />
              <strong>{t("pdfexport_info_includes_label")}</strong> {t("pdfexport_info_includes_value")}
            </AlertDescription>
          </Alert>
        </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {canExportAtAll === false ? t("common_close") : t("common_cancel")}
          </Button>
          {canExportAtAll !== false && (
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t("pdfexport_generating")}
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t("ficha_tecnica_export_pdf")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
