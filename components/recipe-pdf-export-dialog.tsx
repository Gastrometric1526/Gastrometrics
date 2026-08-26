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

interface RecipePDFExportDialogProps {
  recipe: Recipe
  open: boolean
  onOpenChange: (open: boolean) => void
  businessName?: string
  businessLogo?: string
}

export function RecipePDFExportDialog({
  recipe,
  open,
  onOpenChange,
  businessName,
  businessLogo,
}: RecipePDFExportDialogProps) {
  const canExportAdministrative = useFeatureAccess("pdf_admin")
  const canExportAtAll = useFeatureAccess("pdf_export")
  const { member: previewMember } = useActiveMembership()
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
      alert("Error al exportar PDF. Por favor intenta de nuevo.")
    } finally {
      setIsExporting(false)
    }
  }

  const pdfTypes = [
    {
      value: "administrative" as PDFExportType,
      icon: FileText,
      title: "PDF Administrativo",
      description:
        "Todos los datos completos: costos, rendimientos, porcentajes, observaciones, ingredientes, clasificaciones, pasos, precios y cálculos. Ideal para gestión interna.",
    },
    {
      value: "employee" as PDFExportType,
      icon: Users,
      title: "PDF de Empleado",
      description:
        "Solo información para preparación: nombre, clasificación, paso, rendimiento, foto, ingredientes (nombre, cantidad, unidad), procedimiento y observaciones. Sin costos ni precios.",
    },
    {
      value: "normal" as PDFExportType,
      icon: File,
      title: "PDF Normal",
      description:
        "Para presentaciones: nombre, clasificación, paso, rendimiento, foto, ingredientes, procedimiento breve, alérgenos y precio final con ISV. Sin costos administrativos.",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileDown className="h-5 w-5" />
            Exportar Receta a PDF
          </DialogTitle>
          <DialogDescription>Selecciona el tipo de documento que deseas generar para "{recipe.name}"</DialogDescription>
        </DialogHeader>

        {canExportAtAll === false ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">Exportar a PDF fue deshabilitado por el administrador</p>
              <p className="text-sm text-muted-foreground mt-1">
                El administrador de esta cuenta no te dio acceso a exportar PDF de recetas. Contacta al administrador
                de la cuenta para solicitar acceso.
              </p>
              {previewMember && (
                <p className="text-xs text-muted-foreground mt-3">
                  Estás viendo la app como {previewMember.name || previewMember.email}
                </p>
              )}
            </div>
          </div>
        ) : (
        <div className="space-y-4 py-4">
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
                          <Lock className="h-3 w-3" /> Requiere plan Home Cook o superior
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
              <strong>Formato del archivo:</strong> [Tipo][NombreReceta]v[Versión][AAAA-MM-DD][HHmm].pdf
              <br />
              <strong>Formato de página:</strong> A4 vertical
              <br />
              <strong>Incluye:</strong> Encabezado con logo y fecha, pie de página con numeración
            </AlertDescription>
          </Alert>
        </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {canExportAtAll === false ? "Cerrar" : "Cancelar"}
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
                  Generando PDF...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
