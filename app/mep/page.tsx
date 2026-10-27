"use client"

/**
 * MEP — Mise en place (docs/202). Pedido del dueño: un documento alineado con el menú que
 * diga qué producir. Arriba se elige el menú; abajo, por paso del menú, cada plato con sus
 * sub-recetas debajo como checklist (docs/207: la cantidad es la de ese plato y cada una se abre
 * con su receta completa), y al final el total por sub-receta, plegado, para prepararlas juntas. Cada fila
 * muestra solo el nombre y para cuánto; al tocarla se abre con sus ingredientes y cantidades
 * ya escalados, el procedimiento y las observaciones. Se marcan «Listo» (se recuerda en este
 * aparato) y se mandan o descargan como PDF (página 1: la MEP; después, una receta por página).
 * El cálculo vive en lib/mep.ts.
 */

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Layers,
  ListChecks,
  RotateCcw,
  ShoppingCart,
  Users,
  UtensilsCrossed,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { ShareDocumentMenu } from "@/components/share-document-menu"
import { MepTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useFeatureAccess, getAccessBlockReason, hasFeatureAccess } from "@/lib/plan-access"
import { useMenus, ensureMenusLoaded } from "@/lib/menus"
import { useRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { useIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getBusinessById } from "@/lib/storage/businesses"
import { buildMep, flattenDish, formatMepAmount, groupByArea, groupDishesByStep, type MepEntry } from "@/lib/mep"
import { getClassificationLabel } from "@/lib/classification-labels"
import type { Classification } from "@/types/recipe"
import { amountWithUnit, mepShareText, shortUnit } from "@/lib/share-text"
import { generateMepPDF, mepPdfFilename } from "@/lib/pdf/mep-pdf-generator"
import { getRecipeStepLabel } from "@/lib/recipe-step-labels"
import { formatDate, toIsoDate } from "@/lib/date-format"
import type { Menu } from "@/lib/types/menus"

function readDone(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]") as string[])
  } catch {
    return new Set()
  }
}

function writeDone(key: string, done: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(done)))
  } catch {
    /* sin almacenamiento: se marca solo en esta sesión */
  }
}

/** Menús con fecha de hoy en adelante primero (el más cercano arriba); luego el resto, recientes primero. */
function sortMenus(menus: Menu[]): Menu[] {
  const today = toIsoDate(new Date())
  return [...menus].sort((a, b) => {
    const au = a.serviceDate && a.serviceDate >= today
    const bu = b.serviceDate && b.serviceDate >= today
    if (au && bu) return (a.serviceDate as string).localeCompare(b.serviceDate as string)
    if (au) return -1
    if (bu) return 1
    return (b.updatedAt || "").localeCompare(a.updatedAt || "")
  })
}

function MepRow({
  entry,
  done,
  open,
  onToggleDone,
  onToggleOpen,
  businessId,
  tag,
  level = 0,
}: {
  entry: MepEntry
  done: boolean
  open: boolean
  onToggleDone: () => void
  onToggleOpen: () => void
  businessId: string
  /** Agrupado por área: «Preparación base» o el paso del menú. */
  tag?: string | null
  /** 0 = plato o total; 1+ = sub-receta dentro de un plato (más compacta). */
  level?: number
}) {
  const { t, language } = useLanguage()
  const amount = amountWithUnit(entry.amount, entry.yieldUnit, language, formatMepAmount)
  const scaled = Math.abs(entry.multiplier - 1) > 0.0005
  const isSub = level > 0
  return (
    <div className={`rounded-xl border bg-card transition-colors ${done ? "border-primary/30 bg-primary/[0.03]" : "border-border"}`}>
      <div className={`flex items-center gap-3 ${isSub ? "px-3 py-2" : "p-3 sm:p-4"}`}>
        <Checkbox
          checked={done}
          onCheckedChange={onToggleDone}
          aria-label={t("mep_mark_done")}
          data-mep-check={entry.key}
          className={`${isSub ? "h-5 w-5" : "h-6 w-6"} rounded-md shrink-0`}
        />
        <button type="button" onClick={onToggleOpen} className="flex-1 min-w-0 text-left" aria-expanded={open} data-mep-toggle={entry.key}>
          <p className={`${isSub ? "text-sm font-medium" : "font-semibold"} text-foreground leading-snug line-clamp-2 break-words ${done ? "line-through text-muted-foreground" : ""}`}>{entry.name}</p>
          {tag && <p className="text-[11px] font-medium uppercase tracking-wide text-primary/80 truncate">{tag}</p>}
          {entry.kind === "prep" && entry.usedBy.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {t("mep_used_in")}: {entry.usedBy.join(", ")}
            </p>
          )}
          {entry.kind === "sub" && entry.usedBy.length > 0 && (
            <p className="text-xs text-muted-foreground line-clamp-2">{t("mep_also_in").replace("{dishes}", entry.usedBy.join(", "))}</p>
          )}
          {entry.kind === "dish" && (entry.subs?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground truncate">{entry.subs?.length === 1 ? t("mep_subs_count_one") : t("mep_subs_count").replace("{count}", String(entry.subs?.length ?? 0))}</p>
          )}
        </button>
        <Badge variant="secondary" className={`shrink-0 tabular-nums font-semibold ${isSub ? "text-xs px-2 py-0.5" : "text-xs sm:text-sm px-2 sm:px-2.5 py-1"}`}>
          {amount}
        </Badge>
        <button
          type="button"
          onClick={onToggleOpen}
          className="shrink-0 h-9 w-9 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
          aria-label={entry.name}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-3 sm:px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {scaled
                ? t("mep_times_recipe")
                    .replace("{factor}", formatMepAmount(entry.multiplier))
                    .replace("{yield}", amountWithUnit(entry.baseYield, entry.yieldUnit, language, formatMepAmount))
                : t("mep_same_as_recipe")}
            </span>
            <Link
              href={`/ficha-tecnica/${entry.recipeId}?business=${encodeURIComponent(businessId)}&mode=view`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t("mep_open_recipe")} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("mep_ingredients")}</p>
              {entry.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("mep_no_ingredients")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {entry.lines.map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="text-foreground">{l.name}</span>
                        {l.notes ? <span className="block text-xs text-muted-foreground">{l.notes}</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatMepAmount(l.quantity)} {shortUnit(l.unit, language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("mep_procedure")}</p>
                {entry.procedure.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("mep_no_procedure")}</p>
                ) : (
                  <ol className="space-y-2">
                    {entry.procedure.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm text-foreground">
                        <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                        <span className="pt-0.5 leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {entry.observations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("mep_observations")}</p>
                  <ul className="space-y-1.5 text-sm text-foreground list-disc pl-5">
                    {entry.observations.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Un plato y, debajo, sus sub-recetas como checklist (en árbol), cada una con su receta completa al abrirla. */
function MepDishTree({
  dish,
  done,
  openKeys,
  onToggleDone,
  onToggleOpen,
  businessId,
}: {
  dish: MepEntry
  done: Set<string>
  openKeys: Set<string>
  onToggleDone: (key: string) => void
  onToggleOpen: (key: string) => void
  businessId: string
}) {
  const renderSubs = (list: MepEntry[] | undefined, level: number) =>
    list && list.length > 0 ? (
      <div className="ml-4 sm:ml-7 space-y-1.5 border-l-2 border-border pl-3 pt-1.5">
        {list.map((sub) => (
          <div key={sub.key} className="space-y-1.5">
            <MepRow
              entry={sub}
              level={level}
              done={done.has(sub.key)}
              open={openKeys.has(sub.key)}
              onToggleDone={() => onToggleDone(sub.key)}
              onToggleOpen={() => onToggleOpen(sub.key)}
              businessId={businessId}
            />
            {renderSubs(sub.subs, level + 1)}
          </div>
        ))}
      </div>
    ) : null
  return (
    <div>
      <MepRow
        entry={dish}
        done={done.has(dish.key)}
        open={openKeys.has(dish.key)}
        onToggleDone={() => onToggleDone(dish.key)}
        onToggleOpen={() => onToggleOpen(dish.key)}
        businessId={businessId}
      />
      {renderSubs(dish.subs, 1)}
    </div>
  )
}

function MepContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { isLoggedIn } = useAuth()
  const { t, language } = useLanguage()
  const canAccessMenus = useFeatureAccess("menus")

  const menus = useMenus(businessId)
  const recipes = useRecipes(businessId)
  const ingredients = useIngredients(businessId)
  const [loaded, setLoaded] = useState(false)
  const [pdfAllowed, setPdfAllowed] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([ensureMenusLoaded(businessId), ensureRecipesLoaded(businessId), ensureIngredientsLoaded(businessId)])
      .catch((error) => console.error("[mep] Error cargando datos:", error))
      .finally(() => !cancelled && setLoaded(true))
    setPdfAllowed(hasFeatureAccess("pdf_export"))
    return () => {
      cancelled = true
    }
  }, [businessId])

  const sortedMenus = useMemo(() => sortMenus(menus), [menus])
  const requestedMenu = searchParams.get("menu")
  const menu = sortedMenus.find((m) => m.id === requestedMenu) || sortedMenus[0] || null

  const mep = useMemo(() => (menu ? buildMep(menu, recipes, ingredients) : null), [menu, recipes, ingredients])
  const all = useMemo(() => (mep ? [...mep.preps, ...mep.dishes] : []), [mep])

  // Agrupar por paso del menú o por área de la cocina (clasificación de la Ficha Técnica), y
  // filtrar un área para imprimir solo su hoja. La agrupación se recuerda en este aparato.
  const [groupBy, setGroupBy] = useState<"step" | "area">("step")
  const [area, setArea] = useState<string>("all")
  useEffect(() => {
    try {
      if (localStorage.getItem("gm_mep_group") === "area") setGroupBy("area")
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  const changeGroupBy = (value: "step" | "area") => {
    setGroupBy(value)
    try {
      localStorage.setItem("gm_mep_group", value)
    } catch {
      /* sin almacenamiento */
    }
  }
  const areas = useMemo(() => groupByArea(all), [all])
  useEffect(() => setArea("all"), [menu?.id])
  const visiblePreps = useMemo(() => (mep ? mep.preps.filter((e) => area === "all" || e.classification === area) : []), [mep, area])
  const visibleDishes = useMemo(() => (mep ? mep.dishes.filter((e) => area === "all" || e.classification === area) : []), [mep, area])
  const areaEntries = useMemo(() => [...visiblePreps, ...visibleDishes], [visiblePreps, visibleDishes])
  const visibleAreas = useMemo(() => groupByArea(areaEntries), [areaEntries])
  // Lo que cuenta en el progreso: por área, totales y platos; por paso, cada plato con sus sub-recetas (docs/207).
  const visible = useMemo(
    () => (groupBy === "area" ? areaEntries : visibleDishes.flatMap((d) => flattenDish(d).map((x) => x.entry))),
    [groupBy, areaEntries, visibleDishes],
  )
  const [showTotals, setShowTotals] = useState(false)

  const storageKey = menu ? `gm_mep_done:${businessId}:${menu.id}` : ""
  const [done, setDone] = useState<Set<string>>(new Set())
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  useEffect(() => {
    setDone(storageKey ? readDone(storageKey) : new Set())
    setOpenKeys(new Set())
  }, [storageKey])

  const toggleDone = (key: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      writeDone(storageKey, next)
      return next
    })
  }
  const toggleOpen = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const resetDone = () => {
    setDone(new Set())
    writeDone(storageKey, new Set())
  }

  const selectMenu = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("menu", id)
    router.replace(`/mep?${params.toString()}`)
  }

  if (!isLoggedIn || canAccessMenus === null) return null
  if (!canAccessMenus) {
    return getAccessBlockReason("menus") === "admin" ? (
      <AdminRestrictedPage sectionName={t("mep_page_title")} />
    ) : (
      <FeatureLockedPage feature="menus" title={t("mep_locked_title")} description={t("mep_locked_desc")} />
    )
  }

  const doneCount = visible.filter((e) => done.has(e.key)).length
  const percent = visible.length ? Math.round((doneCount / visible.length) * 100) : 0
  const allOpen = visible.length > 0 && visible.every((e) => openKeys.has(e.key))
  const stepLabel = (name: string) => getRecipeStepLabel(name, language)
  const areaLabel = (c: string) => (c ? getClassificationLabel(c as Classification, language) : t("mep_no_area"))
  const areaShort = (c: string) => areaLabel(c).split(" (")[0]
  const business = getBusinessById(businessId)
  const dateLabel = menu?.serviceDate ? formatDate(menu.serviceDate) : null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-28 md:pb-8 space-y-6">
            <MepTour />
            {/* Encabezado */}
            <div className="flex items-center gap-2 md:gap-4 pr-12 md:pr-0" data-tour="mep-header">
              <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
                <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                  <span className="sm:hidden">{t("common_back")}</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-12 h-12 bg-primary/10 rounded-lg items-center justify-center shrink-0">
                  <ListChecks className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-tight">{t("mep_page_title")}</h1>
                  <p className="hidden sm:block text-sm md:text-base text-muted-foreground">{t("mep_page_subtitle")}</p>
                </div>
              </div>
            </div>

            {!loaded ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : !menu ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-4">
                  <UtensilsCrossed className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">{t("mep_no_menus_title")}</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("mep_no_menus_desc")}</p>
                  </div>
                  <Link href={businessId !== "main" ? `/menus?business=${businessId}` : "/menus"}>
                    <Button className="gap-2">
                      <UtensilsCrossed className="h-4 w-4" />
                      {t("mep_no_menus_cta")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Menú, datos y acciones */}
                <Card>
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                      <div className="flex-1 space-y-1.5" data-tour="mep-menu">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("mep_select_menu")}</p>
                        <Select value={menu.id} onValueChange={selectMenu}>
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue placeholder={t("mep_select_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedMenus.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                                {m.serviceDate ? ` · ${formatDate(m.serviceDate)}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2" data-tour="mep-share">
                        <ShareDocumentMenu
                          size="default"
                          className="flex-1 sm:flex-none"
                          pdfAllowed={pdfAllowed}
                          disabled={visible.length === 0}
                          filename={mepPdfFilename(area === "all" ? menu.name : `${menu.name} ${areaShort(area)}`)}
                          subject={t("mep_share_subject").replace("{menu}", menu.name)}
                          buildPdf={() =>
                            generateMepPDF({
                              menuName: menu.name,
                              serviceDate: menu.serviceDate,
                              servings: menu.plannedServings,
                              preps: visiblePreps,
                              dishes: visibleDishes,
                              businessName: business?.name,
                              businessLogo: business?.logo,
                              businessId,
                              doneKeys: done,
                              groupBy,
                              areaLabel: areaShort,
                            })
                          }
                          shareText={() =>
                            mepShareText({
                              menuName: menu.name,
                              dateLabel,
                              servings: menu.plannedServings,
                              preps: visiblePreps,
                              dishes: visibleDishes,
                              language,
                              stepLabel,
                              areas: groupBy === "area" ? visibleAreas.map((g) => ({ label: areaShort(g.area), entries: g.entries })) : undefined,
                              prepLabel: t("mep_prep_tag"),
                              labels: {
                                title: "MEP",
                                people: t("mep_share_people"),
                                preps: t("mep_subs_total_title"),
                                dishes: t("mep_dishes_title"),
                                usedIn: t("mep_used_in").toLowerCase(),
                                sentWith: t("share_sent_with"),
                              },
                            })
                          }
                        />
                        <Link href={`/business/${businessId}/ordenes-compra?fromMenu=${menu.id}`} className="flex-1 sm:flex-none">
                          <Button variant="outline" className="w-full gap-2 bg-transparent">
                            <ShoppingCart className="h-4 w-4" />
                            {t("mep_purchase_order")}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        {dateLabel || t("mep_no_date")}
                      </span>
                      {menu.plannedServings ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {t("mep_people").replace("{count}", String(menu.plannedServings))}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("mep_counts").replace("{preps}", String(mep?.preps.length ?? 0)).replace("{dishes}", String(mep?.dishes.length ?? 0))}
                      </span>
                      <Link
                        href={businessId !== "main" ? `/menus?business=${businessId}` : "/menus"}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-primary hover:underline"
                      >
                        {t("mep_edit_menu")}
                      </Link>
                    </div>

                    {all.length > 0 && (
                      <div className="space-y-3 border-t border-border pt-4" data-tour="mep-areas">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">{t("mep_group_by")}</span>
                          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
                            {(["step", "area"] as const).map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => changeGroupBy(g)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                {g === "step" ? t("mep_group_step") : t("mep_group_area")}
                              </button>
                            ))}
                          </div>
                        </div>
                        {areas.length > 1 && (
                          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                              type="button"
                              onClick={() => setArea("all")}
                              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${area === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
                            >
                              {t("mep_area_all")} · {all.length}
                            </button>
                            {areas.map((g) => (
                              <button
                                key={g.area || "none"}
                                type="button"
                                onClick={() => setArea(g.area)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${area === g.area ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
                              >
                                {areaShort(g.area)} · {g.entries.length}
                              </button>
                            ))}
                          </div>
                        )}
                        {area !== "all" && <p className="text-xs text-muted-foreground">{t("mep_area_print_hint")}</p>}
                      </div>
                    )}

                    {all.length > 0 && (
                      <div className="space-y-2" data-tour="mep-progress">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">
                            {t("mep_progress").replace("{done}", String(doneCount)).replace("{total}", String(visible.length))}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setOpenKeys(allOpen ? new Set() : new Set(visible.map((e) => e.key)))}>
                              {allOpen ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
                              <span className="hidden sm:inline">{allOpen ? t("mep_collapse_all") : t("mep_expand_all")}</span>
                            </Button>
                            {doneCount > 0 && (
                              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={resetDone}>
                                <RotateCcw className="h-4 w-4" />
                                <span className="hidden sm:inline">{t("mep_reset")}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                        <Progress value={percent} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {mep && mep.missingRecipeIds.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    {t("mep_missing_recipes").replace("{count}", String(mep.missingRecipeIds.length))}
                  </div>
                )}

                {visible.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("mep_empty_menu")}</CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {groupBy === "area" ? (
                      visibleAreas.map((g, gi) => (
                        <section key={g.area || "none"} className="space-y-3" data-tour={gi === 0 ? "mep-dishes" : undefined}>
                          <h2 className="text-lg font-semibold text-foreground flex items-baseline gap-2">
                            <span className="text-primary">{gi + 1}</span>
                            {areaShort(g.area)}
                            <span className="text-sm font-normal text-muted-foreground">· {g.entries.length}</span>
                          </h2>
                          <div className="space-y-2">
                            {g.entries.map((entry) => (
                              <MepRow
                                key={entry.key}
                                entry={entry}
                                done={done.has(entry.key)}
                                open={openKeys.has(entry.key)}
                                onToggleDone={() => toggleDone(entry.key)}
                                onToggleOpen={() => toggleOpen(entry.key)}
                                businessId={businessId}
                                tag={entry.kind === "prep" ? t("mep_prep_tag") : entry.stepName ? stepLabel(entry.stepName) : null}
                              />
                            ))}
                          </div>
                        </section>
                      ))
                    ) : (
                      <>
                    {visibleDishes.length > 0 && (
                      <section className="space-y-3" data-tour="mep-dishes">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <h2 className="text-lg font-semibold text-foreground">{t("mep_dishes_title")}</h2>
                          <p className="text-xs text-muted-foreground">{t("mep_dishes_tree_hint")}</p>
                        </div>
                        <div className="space-y-6">
                          {groupDishesByStep(visibleDishes).map((group, gi) => (
                            <div key={`${group.stepName}-${gi}`} className="space-y-3">
                              {group.stepName && (
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{stepLabel(group.stepName)}</p>
                              )}
                              {group.dishes.map((entry) => (
                                <MepDishTree
                                  key={entry.key}
                                  dish={entry}
                                  done={done}
                                  openKeys={openKeys}
                                  onToggleDone={toggleDone}
                                  onToggleOpen={toggleOpen}
                                  businessId={businessId}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {visiblePreps.length > 0 && (
                      <section className="space-y-3 rounded-xl border border-dashed border-border p-3 sm:p-4" data-tour="mep-preps">
                        <button type="button" onClick={() => setShowTotals((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={showTotals}>
                          <span className="min-w-0">
                            <span className="block font-semibold text-foreground">
                              {t("mep_subs_total_title")} <span className="text-sm font-normal text-muted-foreground">· {visiblePreps.length}</span>
                            </span>
                            <span className="block text-xs text-muted-foreground">{t("mep_subs_total_hint")}</span>
                          </span>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showTotals ? "rotate-180" : ""}`} />
                        </button>
                        {showTotals && (
                          <div className="space-y-2">
                            {visiblePreps.map((entry) => (
                              <MepRow
                                key={entry.key}
                                entry={entry}
                                done={done.has(entry.key)}
                                open={openKeys.has(entry.key)}
                                onToggleDone={() => toggleDone(entry.key)}
                                onToggleOpen={() => toggleOpen(entry.key)}
                                businessId={businessId}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MepPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <MepContent />
      </Suspense>
    </AuthGuard>
  )
}
