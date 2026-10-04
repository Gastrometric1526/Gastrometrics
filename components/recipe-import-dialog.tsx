"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useIngredients, addIngredient } from "@/lib/storage/ingredients"
import { getUnitLabel, getCategoryLabel } from "@/lib/ingredient-labels"
import { SUPPORTED_LANGUAGES } from "@/lib/i18n/translations"
import { categories, units, unitAbbreviations, type Category, type Unit } from "@/types/ingredient"
import { parseRecipeText, type ParsedRecipe } from "@/lib/recipe-import/parse-recipe"
import { convertToUnit, defaultUnitFor, findBestMatch } from "@/lib/recipe-import/match-ingredients"
import { guessCategory } from "@/lib/recipe-import/guess-category"
import { setPendingImport } from "@/lib/recipe-import/pending-import"
import {
  recognizeRecipeImage,
  recognizeWithLanguageCheck,
  detectRecipeLanguage,
  OCR_AVAILABLE,
  OCR_LANG,
  LOW_CONFIDENCE,
  type OcrLine,
} from "@/lib/recipe-import/ocr"
import { spreadsheetToRecipeText } from "@/lib/recipe-import/spreadsheet"
import { Camera, FileText, ImageIcon, Loader2, Upload, AlertTriangle, ScanText } from "lucide-react"

const CREATE = "__create__"
const SKIP = "__skip__"

interface Row {
  raw: string
  name: string
  choice: string // id de ingrediente, CREATE o SKIP
  quantity: string // en la unidad del ingrediente elegido (o de newUnit al crear)
  needsReview: boolean
  note: string
  dimension: ParsedRecipe["ingredients"][number]["dimension"]
  baseAmount: number | null
  rawQuantity: number
  // Solo al crear un ingrediente nuevo: cómo entra a la base de datos.
  newUnit: Unit
  category: Category
  price: string // precio por newUnit (opcional)
}

interface OcrState {
  imageUrl: string
  lines: OcrLine[]
  confidence: number
}

/**
 * Importar una receta escrita (docs/145, OCR en docs/146): texto pegado, archivo
 * (.txt/.csv/.md) o foto (tomada con la cámara del celular o subida). Tres pasos, todo
 * editable:
 *  1. Texto: con OCR se ve la foto al lado del texto leído, la confianza de lectura y las
 *     líneas dudosas marcadas (al tocarlas se seleccionan en el texto para corregirlas).
 *  2. Revisión: nombre, porciones, pasos e ingredientes — a cuál de la base corresponde
 *     cada uno, la cantidad convertida a su unidad y, para los nuevos, la categoría, la
 *     unidad y el precio con que entran a la base de datos.
 *  3. Se crean los ingredientes nuevos y se abre la Ficha Técnica ya rellenada (nada se
 *     guarda como receta hasta pulsar Guardar ahí).
 */
export function RecipeImportDialog({
  open,
  onOpenChange,
  businessId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId?: string | null
}) {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const router = useRouter()
  const ingredients = useIngredients(businessId)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [name, setName] = useState("")
  const [servings, setServings] = useState("1")
  const [steps, setSteps] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<null | "ocr" | "save">(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrLang, setOcrLang] = useState(OCR_LANG[language] || "spa")
  const [ocr, setOcr] = useState<OcrState | null>(null)
  // Idioma con el que se leyó la foto (puede diferir del elegido si la app lo corrigió sola)
  const [ocrLangUsed, setOcrLangUsed] = useState<string | null>(null)
  const photoRef = useRef<File | null>(null)
  const pdfRef = useRef<File | null>(null)
  // El idioma se detecta solo y por defecto se asume el de la app; el selector queda
  // escondido detrás de "Cambiar" (docs/149).
  const [showLangPicker, setShowLangPicker] = useState(false)

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])

  useEffect(() => setOcrLang(OCR_LANG[language] || "spa"), [language])
  useEffect(
    () => () => {
      if (ocr?.imageUrl) URL.revokeObjectURL(ocr.imageUrl)
    },
    [ocr],
  )

  const reset = () => {
    setText("")
    setParsed(null)
    setRows([])
    setSteps("")
    setBusy(null)
    setOcr(null)
    setOcrLangUsed(null)
    photoRef.current = null
    pdfRef.current = null
    setShowLangPicker(false)
  }

  const convert = (row: Pick<Row, "dimension" | "baseAmount" | "rawQuantity">, unit: Unit) => {
    const converted = convertToUnit(row, unit)
    return { quantity: converted === null ? String(row.rawQuantity || "") : String(converted), needsReview: converted === null && row.rawQuantity > 0 }
  }

  const latinFallback = OCR_LANG[language] && OCR_LANG[language] !== "chi_sim" ? OCR_LANG[language] : "eng"

  const analyze = (source: string) => {
    const result = parseRecipeText(source)
    // El emparejamiento con la base usa el idioma en que está escrita la receta (la
    // palabra principal va primero en español y al final en inglés); si no se nota, el de la app.
    const detected = detectRecipeLanguage(source)
    const matchLang = (detected && SUPPORTED_LANGUAGES.find((l) => OCR_LANG[l.code] === detected)?.code) || language
    setParsed(result)
    setName(result.name)
    setServings(String(result.servings ?? 1))
    setSteps(result.procedure.join("\n"))
    setRows(
      result.ingredients.map((p) => {
        const match = findBestMatch(p.name, ingredients, matchLang)
        const base = { dimension: p.dimension, baseAmount: p.baseAmount, rawQuantity: p.quantity }
        const newUnit = defaultUnitFor(p.dimension)
        return {
          raw: p.raw.trim(),
          name: p.name,
          choice: match ? match.id : CREATE,
          ...convert(base, match ? match.unit : newUnit),
          note: [p.section, p.note].filter(Boolean).join(" · "),
          ...base,
          newUnit,
          category: guessCategory(p.name),
          price: "",
        }
      }),
    )
  }

  /**
   * Lee la foto. La primera vez, si la foto está en otro idioma del elegido, la app relee
   * sola con el correcto (docs/148). "Leer de nuevo" respeta el idioma elegido.
   */
  const readPhoto = async (file: File, lang: string, checkLanguage: boolean) => {
    setBusy("ocr")
    setOcrProgress(0)
    try {
      const result = checkLanguage
        ? await recognizeWithLanguageCheck(file, lang, latinFallback, setOcrProgress)
        : { ...(await recognizeRecipeImage(file, lang, setOcrProgress)), lang }
      photoRef.current = file
      setOcrLangUsed(result.lang)
      if (result.lang !== lang) setOcrLang(result.lang)
      setOcr((prev) => {
        if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
        return { imageUrl: URL.createObjectURL(file), lines: result.lines, confidence: result.confidence }
      })
      setText(result.text)
      if (!result.text.trim()) toast({ title: t("recipe_import_ocr_empty"), variant: "destructive" })
    } catch (error) {
      console.error("[recipe-import] OCR:", error)
      toast({ title: t("recipe_import_ocr_error"), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  /**
   * PDF (docs/149): las páginas con texto se leen tal cual; las escaneadas pasan por el OCR
   * (con detección de idioma) y se muestran para revisar como una foto.
   */
  const readPdf = async (file: File, lang: string) => {
    setBusy("ocr")
    setOcrProgress(0)
    try {
      const { readRecipePdf } = await import("@/lib/recipe-import/pdf")
      const result = await readRecipePdf(file, lang, latinFallback, setOcrProgress)
      pdfRef.current = file
      if (!result.text.trim()) {
        toast({ title: t("recipe_import_ocr_empty"), variant: "destructive" })
        return
      }
      if (result.ocr) {
        const preview = result.ocr.preview
        photoRef.current = null
        setOcrLangUsed(result.ocr.lang)
        if (result.ocr.lang !== lang) setOcrLang(result.ocr.lang)
        setOcr((prev) => {
          if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
          return { imageUrl: URL.createObjectURL(preview), lines: result.ocr!.lines, confidence: result.ocr!.confidence }
        })
        setText(result.text)
      } else {
        setOcr(null)
        setText(result.text)
        analyze(result.text)
      }
    } catch (error) {
      console.error("[recipe-import] PDF:", error)
      toast({ title: t("recipe_import_pdf_error"), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const onFile = async (file: File) => {
    const name = file.name.toLowerCase()
    if (OCR_AVAILABLE && file.type.startsWith("image/")) {
      await readPhoto(file, ocrLang, true)
      return
    }
    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      await readPdf(file, ocrLang)
      return
    }
    let content: string
    if (/\.(xlsx|xls)$/.test(name)) {
      // Excel: la primera hoja como texto (docs/149, lib/recipe-import/spreadsheet.ts).
      try {
        const { parseSpreadsheetMatrix } = await import("@/lib/excel-utils")
        content = spreadsheetToRecipeText(await parseSpreadsheetMatrix(file))
      } catch (error) {
        console.error("[recipe-import] Excel:", error)
        toast({ title: t("recipe_import_excel_error"), variant: "destructive" })
        return
      }
    } else {
      content = await file.text()
    }
    setOcr(null)
    setText(content)
    analyze(content)
  }

  /** Selecciona una línea dudosa dentro del texto para corregirla. */
  const focusLine = (line: string) => {
    const area = textRef.current
    if (!area) return
    const start = area.value.indexOf(line)
    if (start < 0) return
    area.focus()
    area.setSelectionRange(start, start + line.length)
  }

  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const changeChoice = (index: number, choice: string) => {
    const row = rows[index]
    if (choice === SKIP) return updateRow(index, { choice, needsReview: false })
    const unit = choice === CREATE ? row.newUnit : byId.get(choice)?.unit
    updateRow(index, { choice, ...(unit ? convert(row, unit) : {}) })
  }

  const changeNewUnit = (index: number, unit: Unit) => updateRow(index, { newUnit: unit, ...convert(rows[index], unit) })

  const unitShown = (row: Row) => {
    if (row.choice === SKIP) return ""
    const unit = row.choice === CREATE ? row.newUnit : (byId.get(row.choice)?.unit ?? row.newUnit)
    return unitAbbreviations[unit] || getUnitLabel(unit, language)
  }

  const confirm = async () => {
    if (!parsed) return
    setBusy("save")
    try {
      const now = new Date().toISOString()
      const items = []
      for (const row of rows) {
        if (row.choice === SKIP || !row.name.trim()) continue
        let id = row.choice
        if (row.choice === CREATE) {
          const price = Math.max(0, Number(row.price.replace(",", ".")) || 0)
          const created = await addIngredient(
            {
              id: crypto.randomUUID(),
              name: row.name.charAt(0).toUpperCase() + row.name.slice(1),
              category: row.category,
              unit: row.newUnit,
              pricing: { purchasePrice: price, netContent: 1, pricePerUnit: price, lastUpdated: now },
              supplier: "",
              metadata: { createdAt: now, updatedAt: now, version: 1 },
            },
            businessId,
          )
          id = created.id
        }
        items.push({ ingredientId: id, quantity: Number(row.quantity.replace(",", ".")) || 0, note: row.note })
      }
      const portions = Math.max(1, Number(servings) || 1)
      setPendingImport(businessId, {
        name: name.trim(),
        servings: portions,
        yieldAmount: parsed.yieldAmount ?? portions,
        yieldUnit: parsed.yieldUnitHint === "unidades" ? "un" : "porciones",
        procedure: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        observations: parsed.notes,
        ingredients: items,
      })
      onOpenChange(false)
      reset()
      router.push(businessId && businessId !== "main" ? `/ficha-tecnica?business=${encodeURIComponent(businessId)}` : "/ficha-tecnica")
    } catch (error) {
      console.error("[recipe-import] Error creando ingredientes:", error)
      toast({ title: t("recipe_import_save_error"), variant: "destructive" })
      setBusy(null)
    }
  }

  const created = rows.filter((r) => r.choice === CREATE)
  const lowLines = ocr?.lines.filter((l) => l.confidence < LOW_CONFIDENCE) ?? []
  const pickFile = (input: HTMLInputElement | null) => input?.click()
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ""
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("recipe_import_title")}</DialogTitle>
          <DialogDescription>{t("recipe_import_desc")}</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={
                  ".txt,.csv,.md,.xlsx,.xls,.pdf,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" +
                  (OCR_AVAILABLE ? ",image/*" : "")
                }
                className="hidden"
                onChange={onInputChange}
              />
              {/* capture="environment": en el celular abre directo la cámara trasera
                  (en computadora abre el selector de archivos). */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} />
              {OCR_AVAILABLE && (
                <Button type="button" size="sm" onClick={() => pickFile(cameraRef.current)} disabled={busy !== null}>
                  <Camera className="h-4 w-4 mr-2" />
                  {t("recipe_import_take_photo")}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => pickFile(fileRef.current)} disabled={busy !== null}>
                <Upload className="h-4 w-4 mr-2" />
                {t("recipe_import_upload")}
              </Button>
              {OCR_AVAILABLE &&
                (showLangPicker ? (
                  <Select value={ocrLang} onValueChange={setOcrLang}>
                    <SelectTrigger className="h-9 w-full sm:w-[230px]" aria-label={t("recipe_import_ocr_language")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={OCR_LANG[l.code]}>
                          {t("recipe_import_ocr_language")}: {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("recipe_import_lang_auto").replace(
                      "{lang}",
                      SUPPORTED_LANGUAGES.find((l) => OCR_LANG[l.code] === ocrLang)?.name ?? "",
                    )}{" "}
                    <button type="button" className="text-primary hover:underline" onClick={() => setShowLangPicker(true)}>
                      {t("recipe_import_lang_change")}
                    </button>
                  </span>
                ))}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> .txt .csv .xlsx .pdf
                {OCR_AVAILABLE && (
                  <>
                    {" "}· <ImageIcon className="h-3.5 w-3.5" /> {t("recipe_import_photo_hint")}
                  </>
                )}
              </span>
            </div>

            {busy === "ocr" && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("recipe_import_ocr_running").replace("{p}", String(Math.round(ocrProgress * 100)))}
                </p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
                </div>
              </div>
            )}

            {ocr && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ScanText className="h-4 w-4 text-primary" />
                  {t("recipe_import_ocr_done").replace("{c}", String(ocr.confidence))}
                </p>
                <p className="text-xs text-muted-foreground">{t("recipe_import_ocr_review_hint")}</p>
                {ocrLangUsed && (photoRef.current || pdfRef.current) && ocrLang !== ocrLangUsed ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      photoRef.current ? readPhoto(photoRef.current, ocrLang, false) : pdfRef.current && readPdf(pdfRef.current, ocrLang)
                    }
                    disabled={busy !== null}
                  >
                    <ScanText className="h-4 w-4 mr-2" />
                    {t("recipe_import_ocr_reread").replace("{lang}", SUPPORTED_LANGUAGES.find((l) => OCR_LANG[l.code] === ocrLang)?.name ?? "")}
                  </Button>
                ) : (
                  ocrLangUsed &&
                  ocr.confidence < LOW_CONFIDENCE && (
                    <p className="text-xs text-amber-600">{t("recipe_import_ocr_wrong_lang_hint")}</p>
                  )
                )}
                {lowLines.length > 0 && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("recipe_import_ocr_low_lines").replace("{count}", String(lowLines.length))}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {lowLines.slice(0, 12).map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => focusLine(l.text)}
                          className="max-w-full truncate rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-left text-xs text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
                          title={`${l.confidence} %`}
                        >
                          {l.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={ocr ? "grid grid-cols-1 md:grid-cols-2 gap-3" : ""}>
              {ocr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ocr.imageUrl} alt={t("recipe_import_photo_alt")} className="w-full max-h-[420px] object-contain rounded-lg border bg-muted" />
              )}
              <Textarea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={ocr ? 16 : 12}
                placeholder={t("recipe_import_placeholder")}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("recipe_import_manual_hint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <Label>{t("recipe_import_name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("recipe_import_servings")}</Label>
                <Input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("recipe_import_ingredients").replace("{count}", String(rows.length))}</p>
              {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("recipe_import_no_ingredients")}</p>}
              {rows.map((row, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground truncate" title={row.raw}>
                    {row.raw}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_130px] gap-2 items-center">
                    <Input value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} aria-label={t("recipe_import_name")} />
                    <Select value={row.choice} onValueChange={(v) => changeChoice(i, v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CREATE}>{t("recipe_import_create_new")}</SelectItem>
                        <SelectItem value={SKIP}>{t("recipe_import_skip")}</SelectItem>
                        {ingredients.map((ing) => (
                          <SelectItem key={ing.id} value={ing.id}>
                            {ing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={row.quantity}
                        onChange={(e) => updateRow(i, { quantity: e.target.value, needsReview: false })}
                        disabled={row.choice === SKIP}
                        inputMode="decimal"
                        aria-label={t("recipe_import_quantity")}
                      />
                      <span className="text-xs text-muted-foreground w-8">{unitShown(row)}</span>
                    </div>
                  </div>
                  {row.choice === CREATE && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md bg-muted/40 p-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{t("recipe_import_new_category")}</Label>
                        <Select value={row.category} onValueChange={(v) => updateRow(i, { category: v as Category })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c} value={c}>
                                {getCategoryLabel(c, language)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("recipe_import_new_unit")}</Label>
                        <Select value={row.newUnit} onValueChange={(v) => changeNewUnit(i, v as Unit)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u} value={u}>
                                {getUnitLabel(u, language)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t("recipe_import_new_price").replace("{unit}", unitAbbreviations[row.newUnit] || getUnitLabel(row.newUnit, language))}
                        </Label>
                        <Input
                          className="h-8 text-xs"
                          value={row.price}
                          onChange={(e) => updateRow(i, { price: e.target.value })}
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                  {row.needsReview && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("recipe_import_review_quantity")}
                    </p>
                  )}
                  {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>{t("recipe_import_steps_edit")}</Label>
              <Textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={Math.min(10, Math.max(3, steps.split("\n").length + 1))} />
            </div>
            {created.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("recipe_import_created_hint").replace("{count}", String(created.length))}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {parsed ? (
            <>
              <Button variant="ghost" onClick={() => setParsed(null)} disabled={busy !== null}>
                {t("recipe_import_back")}
              </Button>
              <Button onClick={confirm} disabled={busy !== null || !name.trim()}>
                {busy === "save" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("recipe_import_confirm")}
              </Button>
            </>
          ) : (
            <Button onClick={() => analyze(text)} disabled={!text.trim() || busy !== null}>
              {t("recipe_import_analyze")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
