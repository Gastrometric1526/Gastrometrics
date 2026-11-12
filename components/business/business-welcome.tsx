"use client"

/**
 * Pedido del dueño (docs/284): al crear un negocio, la persona tiene que saber que puede
 * traer ahí todo lo que ya tiene en su dashboard principal.
 *
 * - `BusinessWelcomeDialog`: sale al crear el negocio. Explica que el negocio empieza vacío
 *   (sus datos no se mezclan) y ofrece «Traer de mi espacio principal», con cuántas recetas e
 *   ingredientes tiene allá.
 * - `BringFromMainDialog`: elige recetas (todas o algunas) y, si quiere, los ingredientes que
 *   ninguna receta usa; las copia con sus ingredientes y subrecetas
 *   (lib/subrecipe/bulk-migration.ts). El espacio principal no cambia.
 * También se abre desde la página del negocio (botón para el dueño).
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Building2, CheckCircle2, Download, Layers } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useLanguage } from "@/contexts/language-context"
import { useRecipes, isSubRecipe, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { useIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { looseIngredientsToCopy, planBulkMigration, runBulkMigration, type BulkMigrationResult } from "@/lib/subrecipe/bulk-migration"
import { normalizeSearch } from "@/lib/manual-sales"
import { cn } from "@/lib/utils"

/** Cuántas recetas propias (sin subrecetas) e ingredientes hay en el espacio principal. */
function useMainCounts() {
  const recipes = useRecipes(null)
  const ingredients = useIngredients(null)
  useEffect(() => {
    ensureRecipesLoaded(null).catch(() => {})
    ensureIngredientsLoaded(null).catch(() => {})
  }, [])
  return { recipes: recipes.filter((r) => !isSubRecipe(r)).length, subrecipes: recipes.filter((r) => isSubRecipe(r)).length, ingredients: ingredients.filter((i) => !i.recipeId).length }
}

export function BusinessWelcomeDialog({
  business,
  onClose,
}: {
  business: { id: string; name: string } | null
  onClose: () => void
}) {
  const { t } = useLanguage()
  const router = useRouter()
  const counts = useMainCounts()
  const [bringOpen, setBringOpen] = useState(false)
  const hasSomething = counts.recipes + counts.subrecipes + counts.ingredients > 0
  const open = business !== null && !bringOpen
  const enter = () => {
    if (!business) return
    const id = business.id
    onClose()
    router.push(`/business/${id}`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <DialogTitle>{t("bizwelcome_title").replace("{name}", business?.name ?? "")}</DialogTitle>
            <DialogDescription>{t("bizwelcome_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="font-medium text-foreground">{t("bizwelcome_bring_title")}</p>
              <p className="mt-1 text-muted-foreground">
                {hasSomething
                  ? t("bizwelcome_bring_desc").replace("{recipes}", String(counts.recipes + counts.subrecipes)).replace("{ingredients}", String(counts.ingredients))
                  : t("bizwelcome_bring_empty")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{t("bizwelcome_later")}</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onClose}>
              {t("bizwelcome_not_now")}
            </Button>
            <Button variant="outline" onClick={enter} className="gap-1.5">
              {t("bizwelcome_enter")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {hasSomething && (
              <Button onClick={() => setBringOpen(true)} className="gap-1.5" data-bizwelcome="bring">
                <Download className="h-4 w-4" />
                {t("bizbring_button")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BringFromMainDialog
        business={bringOpen ? business : null}
        onClose={() => {
          setBringOpen(false)
          onClose()
        }}
        onEnter={enter}
      />
    </>
  )
}

export function BringFromMainDialog({
  business,
  onClose,
  onEnter,
}: {
  business: { id: string; name: string } | null
  onClose: () => void
  /** Botón «Entrar al negocio» al terminar (no se muestra si ya se está dentro). */
  onEnter?: () => void
}) {
  const { t } = useLanguage()
  const mainRecipes = useRecipes(null)
  const mainIngredients = useIngredients(null)
  const targetRecipes = useRecipes(business?.id ?? null)
  const targetIngredients = useIngredients(business?.id ?? null)
  const [selected, setSelected] = useState<string[]>([])
  const [includeLoose, setIncludeLoose] = useState(true)
  const [query, setQuery] = useState("")
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [result, setResult] = useState<BulkMigrationResult | null>(null)

  useEffect(() => {
    if (!business) return
    ensureRecipesLoaded(null).catch(() => {})
    ensureIngredientsLoaded(null).catch(() => {})
    ensureRecipesLoaded(business.id).catch(() => {})
    ensureIngredientsLoaded(business.id).catch(() => {})
    setResult(null)
    setProgress(null)
    setQuery("")
    setIncludeLoose(true)
  }, [business?.id])

  const sorted = useMemo(() => [...mainRecipes].sort((a, b) => Number(isSubRecipe(b)) - Number(isSubRecipe(a)) || a.name.localeCompare(b.name)), [mainRecipes])
  const plan = useMemo(() => planBulkMigration(mainRecipes, sorted.map((r) => r.id), targetRecipes), [mainRecipes, sorted, targetRecipes])
  const alreadyIds = useMemo(() => new Set(plan.alreadyThere.map((r) => r.id)), [plan])
  const available = sorted.filter((r) => !alreadyIds.has(r.id))
  // Por defecto, todo lo que todavía no está en el negocio.
  useEffect(() => {
    if (business) setSelected(available.map((r) => r.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id, available.length])
  const loose = useMemo(() => looseIngredientsToCopy(mainIngredients, targetIngredients), [mainIngredients, targetIngredients])
  const visible = sorted.filter((r) => !query.trim() || normalizeSearch(r.name).includes(normalizeSearch(query)))
  const allSelected = available.length > 0 && available.every((r) => selected.includes(r.id))
  const running = progress !== null && result === null
  const nothing = selected.length === 0 && !(includeLoose && loose.length > 0)

  const start = async () => {
    if (!business || nothing) return
    setProgress({ done: 0, total: selected.length + (includeLoose ? 1 : 0), current: "" })
    const res = await runBulkMigration({
      sourceBusinessId: "main",
      targetBusinessId: business.id,
      recipeIds: selected,
      includeLooseIngredients: includeLoose && loose.length > 0,
      onProgress: (done, total, current) => setProgress({ done, total, current }),
    })
    setResult(res)
  }

  return (
    <Dialog open={business !== null} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bizbring_title").replace("{name}", business?.name ?? "")}</DialogTitle>
          <DialogDescription>{t("bizbring_desc").replace("{name}", business?.name ?? "")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 font-medium text-foreground">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              {t("bizbring_done").replace("{recipes}", String(result.migrated)).replace("{ingredients}", String(result.ingredientsCopied))}
            </p>
            {result.skipped > 0 && <p className="text-muted-foreground">{t("bizbring_done_skipped").replace("{count}", String(result.skipped))}</p>}
            {result.failed.length > 0 && <p className="text-destructive">{t("bizbring_done_failed").replace("{names}", result.failed.join(", "))}</p>}
            <p className="text-xs text-muted-foreground">{t("bizbring_done_hint")}</p>
          </div>
        ) : running ? (
          <div className="space-y-3 py-2">
            <Progress value={progress!.total ? (progress!.done / progress!.total) * 100 : 0} />
            <p className="text-sm text-muted-foreground">
              {progress!.current
                ? t("bizbring_progress").replace("{done}", String(progress!.done + 1)).replace("{total}", String(progress!.total)).replace("{name}", progress!.current)
                : t("bizbring_progress_ingredients")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? available.map((r) => r.id) : [])} disabled={available.length === 0} />
                    {t("bizbring_select_all").replace("{count}", String(available.length))}
                  </label>
                  <span className="text-xs text-muted-foreground">{t("bizbring_selected").replace("{count}", String(selected.length))}</span>
                </div>
                {sorted.length > 8 && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("bizbring_search")} maxLength={60} className="h-9" />}
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {visible.map((r) => {
                    const there = alreadyIds.has(r.id)
                    return (
                      <li key={r.id}>
                        <label className={cn("flex items-center gap-3 px-3 py-2 text-sm", there ? "opacity-60" : "cursor-pointer hover:bg-muted/50")}>
                          <Checkbox
                            checked={!there && selected.includes(r.id)}
                            disabled={there}
                            onCheckedChange={(v) => setSelected((prev) => (v ? [...prev, r.id] : prev.filter((id) => id !== r.id)))}
                          />
                          <span className="min-w-0 flex-1 truncate">{r.name}</span>
                          {isSubRecipe(r) && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                              <Layers className="h-3 w-3" />
                              {t("bizbring_subrecipe")}
                            </span>
                          )}
                          {there && <span className="shrink-0 rounded-full bg-success/10 px-2 text-[11px] text-success">{t("bizbring_already")}</span>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("bizbring_no_recipes")}</p>
            )}
            {loose.length > 0 && (
              <label className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <Checkbox checked={includeLoose} onCheckedChange={(v) => setIncludeLoose(!!v)} className="mt-0.5" />
                <span>{t("bizbring_loose").replace("{count}", String(loose.length))}</span>
              </label>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result ? (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("common_close")}
              </Button>
              {onEnter && (
                <Button onClick={onEnter} className="gap-1.5">
                  {t("bizwelcome_enter")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={running}>
                {t("common_cancel")}
              </Button>
              <Button onClick={start} disabled={running || nothing} className="gap-1.5" data-bizbring="start">
                <Download className="h-4 w-4" />
                {running ? t("bizbring_running") : t("bizbring_start").replace("{count}", String(selected.length))}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
