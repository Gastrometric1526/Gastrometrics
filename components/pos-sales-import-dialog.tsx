"use client"

import { useMemo, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UploadCloud, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { parseExcelFile } from "@/lib/excel-utils"
import { formatCurrency } from "@/lib/currency"
import { findBestNameMatch, normalizeName } from "@/lib/utils/name-match"
import {
  getPOSColumnMapping,
  savePOSColumnMapping,
  getDishNameMappings,
  saveDishNameMapping,
  addSalesImport,
} from "@/lib/storage/sales-imports"
import type { Recipe } from "@/types/recipe"
import type { SalesImport, SalesImportLine } from "@/types/sales-import"
import { useLanguage } from "@/contexts/language-context"

interface POSSalesImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  recipes: Recipe[]
  onImported: (salesImport: SalesImport) => void
}

type Step = "upload" | "mapping" | "review"

const NONE_VALUE = "__none__"

// BUG CORREGIDO: antes se hacia `.replace(",", ".")` a secas, que solo reemplaza
// la PRIMERA coma — un numero con separador de miles ("1,234.56" o "1.234,56")
// quedaba mal interpretado y podia inflar o truncar la cifra por un factor de
// ~1000. Esta funcion detecta cual separador es el decimal (el que aparece al
// final) y elimina el resto como separador de miles.
function parseLocaleNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0
  if (typeof raw === "number") return raw
  let s = String(raw).trim().replace(/[^0-9.,-]/g, "")
  if (!s) return 0

  const hasComma = s.includes(",")
  const hasDot = s.includes(".")

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
  } else if (hasComma) {
    const parts = s.split(",")
    s = parts.length === 2 && parts[1].length <= 2 ? parts.join(".") : s.replace(/,/g, "")
  }

  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// BUG CORREGIDO: no habia ningun filtro para filas en blanco o filas resumen
// ("TOTAL", "SUBTOTAL", etc.) que muchos POS agregan al final del reporte — una
// fila asi se colaba como un "plato" mas con toda la venta del periodo, doblando
// (o mas) los ingresos totales sin ningun aviso al usuario.
const SUMMARY_ROW_PATTERN = /^(total|subtotal|gran\s*total|grand\s*total|resumen|suma)s?\s*:?$/i

function isSummaryOrBlankRow(rawDishName: string): boolean {
  const trimmed = rawDishName.trim()
  if (!trimmed) return true
  return SUMMARY_ROW_PATTERN.test(trimmed)
}

export function POSSalesImportDialog({ open, onOpenChange, businessId, recipes, onImported }: POSSalesImportDialogProps) {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>("upload")
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [isParsing, setIsParsing] = useState(false)

  const [dateColumn, setDateColumn] = useState<string>(NONE_VALUE)
  const [dishColumn, setDishColumn] = useState<string>(NONE_VALUE)
  const [quantityColumn, setQuantityColumn] = useState<string>(NONE_VALUE)
  const [priceColumn, setPriceColumn] = useState<string>(NONE_VALUE)

  // recipeId elegido manualmente por fila no emparejada automaticamente, por nombre crudo normalizado
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({})

  const reset = () => {
    setStep("upload")
    setFileName("")
    setRawRows([])
    setHeaders([])
    setDateColumn(NONE_VALUE)
    setDishColumn(NONE_VALUE)
    setQuantityColumn(NONE_VALUE)
    setPriceColumn(NONE_VALUE)
    setManualMatches({})
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const processFile = async (file: File) => {
    const validExt = /\.(xlsx|xls|csv)$/i.test(file.name)
    if (!validExt) {
      toast({ title: t("posi_toast_invalid_file_title"), description: t("posi_toast_invalid_file_desc"), variant: "destructive" })
      return
    }

    setIsParsing(true)
    try {
      const rows = await parseExcelFile(file)
      if (!rows || rows.length === 0) {
        toast({ title: t("posi_toast_empty_file_title"), description: t("posi_toast_empty_file_desc"), variant: "destructive" })
        setIsParsing(false)
        return
      }

      const detectedHeaders = Object.keys(rows[0])
      setHeaders(detectedHeaders)
      setRawRows(rows)
      setFileName(file.name)

      // Intenta reusar el mapeo guardado de una importacion anterior; si los
      // encabezados coinciden, salta directo a la revision (casi de un solo clic).
      const savedMapping = getPOSColumnMapping(businessId)
      const savedHeadersMatch =
        savedMapping &&
        savedMapping.dishColumn &&
        detectedHeaders.includes(savedMapping.dishColumn) &&
        detectedHeaders.includes(savedMapping.quantityColumn)

      if (savedHeadersMatch && savedMapping) {
        setDateColumn(savedMapping.dateColumn && detectedHeaders.includes(savedMapping.dateColumn) ? savedMapping.dateColumn : NONE_VALUE)
        setDishColumn(savedMapping.dishColumn)
        setQuantityColumn(savedMapping.quantityColumn)
        setPriceColumn(savedMapping.priceColumn && detectedHeaders.includes(savedMapping.priceColumn) ? savedMapping.priceColumn : NONE_VALUE)
        setStep("review")
      } else {
        // Adivina columnas por nombre, como primer intento (el usuario puede corregir)
        const guess = (candidates: string[]) =>
          detectedHeaders.find((h) => candidates.some((c) => h.toLowerCase().includes(c))) || NONE_VALUE
        setDateColumn(guess(["fecha", "date"]))
        setDishColumn(guess(["plato", "producto", "item", "articulo", "dish", "product"]))
        setQuantityColumn(guess(["cantidad", "cant", "qty", "unidades"]))
        setPriceColumn(guess(["precio", "price", "monto", "total"]))
        setStep("mapping")
      }
    } catch (error: any) {
      console.error("Error parsing POS sales file:", error)
      toast({
        title: t("posi_toast_parse_error_title"),
        description: t("posi_toast_parse_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ============== EMPAREJAMIENTO PLATO -> RECETA ==============
  const dishMappings = useMemo(() => getDishNameMappings(businessId), [businessId, step])

  const parsedLines = useMemo(() => {
    if (dishColumn === NONE_VALUE || quantityColumn === NONE_VALUE) return []

    return rawRows
      .filter((row) => !isSummaryOrBlankRow(String(row[dishColumn] ?? "")))
      .map((row, index) => {
      const rawDishName = String(row[dishColumn] ?? "").trim()
      const quantity = parseLocaleNumber(row[quantityColumn])
      const priceRaw = priceColumn !== NONE_VALUE ? row[priceColumn] : undefined
      const unitPrice = priceRaw !== undefined && priceRaw !== "" ? parseLocaleNumber(priceRaw) : null
      const dateRaw = dateColumn !== NONE_VALUE ? row[dateColumn] : undefined

      const normalized = normalizeName(rawDishName)
      const learnedMatch = dishMappings.find((m) => m.normalizedPosName === normalized)
      const manualRecipeId = manualMatches[normalized]
      const autoMatch = !learnedMatch && !manualRecipeId ? findBestNameMatch(rawDishName, recipes) : null

      const matchedRecipeId = manualRecipeId || learnedMatch?.recipeId || autoMatch?.id || null
      const recipe = matchedRecipeId ? recipes.find((r) => r.id === matchedRecipeId) : undefined

      const effectiveUnitPrice = unitPrice ?? recipe?.unitPrice ?? 0
      const revenue = quantity * effectiveUnitPrice
      const theoreticalCost = recipe ? quantity * (recipe.costPerServing || 0) : 0

      return {
        rowIndex: index,
        rawDishName,
        normalized,
        quantity,
        unitPrice,
        dateRaw: dateRaw ? String(dateRaw) : null,
        recipeId: matchedRecipeId,
        recipeName: recipe?.name,
        revenue,
        theoreticalCost,
      }
    })
  }, [rawRows, dishColumn, quantityColumn, priceColumn, dateColumn, recipes, dishMappings, manualMatches])

  const unmatchedCount = parsedLines.filter((l) => !l.recipeId).length
  const matchedCount = parsedLines.length - unmatchedCount

  const canGoToReview = dishColumn !== NONE_VALUE && quantityColumn !== NONE_VALUE

  const handleManualMatch = (normalized: string, recipeId: string) => {
    setManualMatches((prev) => ({ ...prev, [normalized]: recipeId === NONE_VALUE ? "" : recipeId }))
  }

  const handleConfirm = () => {
    if (parsedLines.length === 0) return

    savePOSColumnMapping(
      {
        businessId,
        dateColumn: dateColumn !== NONE_VALUE ? dateColumn : null,
        dishColumn,
        quantityColumn,
        priceColumn: priceColumn !== NONE_VALUE ? priceColumn : null,
        updatedAt: new Date().toISOString(),
      },
      businessId,
    )

    // Aprende las vinculaciones nuevas (manuales o automaticas exactas) para la proxima vez
    parsedLines.forEach((line) => {
      if (line.recipeId && line.normalized) {
        saveDishNameMapping(
          { businessId, normalizedPosName: line.normalized, recipeId: line.recipeId, updatedAt: new Date().toISOString() },
          businessId,
        )
      }
    })

    const lines: SalesImportLine[] = parsedLines.map((l) => ({
      id: uuidv4(),
      rawDishName: l.rawDishName,
      recipeId: l.recipeId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      revenue: l.revenue,
      theoreticalCost: l.theoreticalCost,
    }))

    const dates = parsedLines.map((l) => l.dateRaw).filter(Boolean) as string[]
    const parsedDates = dates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()))
    const periodStart = parsedDates.length > 0 ? new Date(Math.min(...parsedDates.map((d) => d.getTime()))).toISOString() : null
    const periodEnd = parsedDates.length > 0 ? new Date(Math.max(...parsedDates.map((d) => d.getTime()))).toISOString() : null

    const salesImport: SalesImport = {
      id: uuidv4(),
      businessId,
      fileName,
      importedAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      totalRevenue: lines.reduce((sum, l) => sum + l.revenue, 0),
      totalTheoreticalCost: lines.reduce((sum, l) => sum + l.theoreticalCost, 0),
      lineCount: lines.length,
      unmatchedDishNames: Array.from(new Set(parsedLines.filter((l) => !l.recipeId).map((l) => l.rawDishName))),
      lines,
    }

    addSalesImport(salesImport, businessId)
    onImported(salesImport)

    toast({
      title: t("posi_toast_imported_title"),
      description: t("posi_toast_imported_desc")
        .replace("{lines}", String(lines.length))
        .replace("{matched}", String(matchedCount)),
    })

    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t("posi_title")}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && t("posi_desc_upload")}
            {step === "mapping" && t("posi_desc_mapping")}
            {step === "review" && t("posi_desc_review")}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-center transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{t("posi_drop_text")}</p>
            <p className="text-sm text-muted-foreground">{t("posi_drop_subtext")}</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="pos-sales-file-input"
              onChange={handleFileInput}
            />
            <Button asChild variant="outline" disabled={isParsing}>
              <label htmlFor="pos-sales-file-input" className="cursor-pointer">
                {isParsing ? t("posi_processing") : t("posi_select_file")}
              </label>
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("posi_file_prefix")} <span className="font-medium text-foreground">{fileName}</span> ·{" "}
              {t("posi_rows_detected").replace("{count}", String(rawRows.length))}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("posi_col_dish_label")}</label>
                <Select value={dishColumn} onValueChange={setDishColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("posi_choose_column_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("posi_col_quantity_label")}</label>
                <Select value={quantityColumn} onValueChange={setQuantityColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("posi_choose_column_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("posi_col_date_label")}</label>
                <Select value={dateColumn} onValueChange={setDateColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("posi_no_date")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("posi_no_date")}</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("posi_col_price_label")}</label>
                <Select value={priceColumn} onValueChange={setPriceColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("posi_use_recipe_price")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("posi_use_recipe_price")}</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md">
              <ScrollArea className="h-40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawRows.slice(0, 8).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-xs">
                            {String(row[h])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                {t("posi_matched_badge").replace("{count}", String(matchedCount))}
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="gap-1.5 py-1.5 text-amber-700 border-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t("posi_unmatched_badge").replace("{count}", String(unmatchedCount))}
                </Badge>
              )}
            </div>

            <div className="border rounded-md">
              <ScrollArea className="h-80">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>{t("posi_table_dish_pos")}</TableHead>
                      <TableHead>{t("posi_table_linked_recipe")}</TableHead>
                      <TableHead className="text-right">{t("posi_table_qty")}</TableHead>
                      <TableHead className="text-right">{t("posi_table_revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedLines.map((line) => (
                      <TableRow key={line.rowIndex}>
                        <TableCell className="text-sm">{line.rawDishName}</TableCell>
                        <TableCell>
                          {line.recipeId ? (
                            <span className="text-sm text-foreground">{line.recipeName}</span>
                          ) : (
                            <Select
                              value={manualMatches[line.normalized] || NONE_VALUE}
                              onValueChange={(v) => handleManualMatch(line.normalized, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={t("posi_unlinked_placeholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>{t("posi_unlinked_placeholder")}</SelectItem>
                                {recipes.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(line.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {step === "mapping" && (
              <Button variant="ghost" onClick={() => setStep("upload")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("posi_back_button")}
              </Button>
            )}
            {step === "review" && (
              <Button variant="ghost" onClick={() => setStep("mapping")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("posi_back_button")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              {t("posi_cancel_button")}
            </Button>
            {step === "mapping" && (
              <Button onClick={() => setStep("review")} disabled={!canGoToReview} className="gap-2">
                {t("posi_continue_button")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === "review" && (
              <Button onClick={handleConfirm} disabled={parsedLines.length === 0}>
                {t("posi_confirm_button")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
