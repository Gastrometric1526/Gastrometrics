"use client"

/**
 * Portada de la landing (docs/196): la Ficha Técnica REAL de la app, armándose sola. Pedido del
 * dueño: «que todo lo que muestre refleje realmente cómo se ve». Por eso usa las mismas piezas
 * (Card, Table), las mismas clases y los MISMOS textos que components/technical-sheet/index.tsx
 * (ficha_tecnica_col_*, tour_ficha_pricing_title, ficha_tecnica_sale_price_formula_label…) y
 * las categorías con getCategoryLabel, así en cada idioma dice exactamente lo que dice la app.
 *
 * Los platos son los del restaurante de ejemplo de las capturas (manual/scripts/landing-demo-
 * data.mjs): la hamburguesa da L 70.32 → L 235.00 y 70.08 % de margen, igual que en «Mira por
 * dentro». El precio sale de suggestedUnitPrice (Food Cost 30 %). Lempiras en español, dólares
 * en los demás idiomas (÷ 25), como en las capturas. Con «reducir movimiento» se ve completo.
 */

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calculator, Settings, Info } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import type { LanguageCode } from "@/lib/i18n/translations"
import type { Recipe } from "@/types/recipe"
import { suggestedUnitPrice } from "@/lib/recipe-pricing"
import { getCategoryLabel } from "@/lib/ingredient-labels"

type L6 = Record<LanguageCode, string>
const n = (es: string, en: string, da: string, fr: string, pt: string, zh: string): L6 => ({ es, en, da, fr, pt, zh })

// [categoría, nombre, cantidad, medida, costo por medida en L]
type Line = { category: string; name: L6; qty: number; measure: string; unitCost: number }
const DISHES: { name: L6; lines: Line[] }[] = [
  {
    name: n("Hamburguesa clásica con papas", "Classic burger with fries", "Klassisk burger med pommes frites", "Burger classique et frites", "Hambúrguer clássico com fritas", "经典汉堡配薯条"),
    lines: [
      { category: "RES", name: n("Carne molida de res", "Ground beef", "Hakket oksekød", "Bœuf haché", "Carne moída", "牛肉末"), qty: 0.16, measure: "kg", unitCost: 260 },
      { category: "HARINA", name: n("Pan de hamburguesa", "Burger bun", "Burgerbolle", "Pain burger", "Pão de hambúrguer", "汉堡面包"), qty: 1, measure: "un", unitCost: 9 },
      { category: "LÁCTEOS Y DERIVADOS", name: n("Queso cheddar en lonchas", "Sliced cheddar", "Cheddar i skiver", "Cheddar en tranches", "Cheddar fatiado", "切达芝士片"), qty: 1, measure: "un", unitCost: 95 / 12 },
      { category: "VEGETAL", name: n("Tomate", "Tomato", "Tomat", "Tomate", "Tomate", "番茄"), qty: 0.04, measure: "kg", unitCost: 32 },
      { category: "VEGETAL", name: n("Lechuga romana", "Romaine lettuce", "Romainesalat", "Laitue romaine", "Alface romana", "罗马生菜"), qty: 0.08, measure: "un", unitCost: 28 },
      { category: "VEGETAL", name: n("Cebolla", "Onion", "Løg", "Oignon", "Cebola", "洋葱"), qty: 0.02, measure: "kg", unitCost: 26 },
      { category: "VEGETAL", name: n("Papa", "Potato", "Kartoffel", "Pomme de terre", "Batata", "土豆"), qty: 0.2, measure: "kg", unitCost: 28 },
      { category: "ACEITES", name: n("Aceite de oliva", "Olive oil", "Olivenolie", "Huile d'olive", "Azeite", "橄榄油"), qty: 0.03, measure: "L", unitCost: 72 },
    ],
  },
  {
    name: n("Fettuccine Alfredo", "Fettuccine Alfredo", "Fettuccine Alfredo", "Fettuccine Alfredo", "Fettuccine Alfredo", "阿尔弗雷多宽面"),
    lines: [
      { category: "FIDEOS", name: n("Pasta fettuccine", "Fettuccine pasta", "Fettuccine", "Fettuccine", "Massa fettuccine", "意大利宽面"), qty: 0.12, measure: "kg", unitCost: 58 },
      { category: "LÁCTEOS Y DERIVADOS", name: n("Crema de leche", "Heavy cream", "Piskefløde", "Crème liquide", "Creme de leite", "淡奶油"), qty: 0.12, measure: "L", unitCost: 96 },
      { category: "LÁCTEOS Y DERIVADOS", name: n("Queso parmesano", "Parmesan cheese", "Parmesan", "Parmesan", "Queijo parmesão", "帕玛森芝士"), qty: 0.03, measure: "kg", unitCost: 620 },
      { category: "LÁCTEOS Y DERIVADOS", name: n("Mantequilla", "Butter", "Smør", "Beurre", "Manteiga", "黄油"), qty: 0.02, measure: "kg", unitCost: 210 },
      { category: "VEGETAL", name: n("Ajo", "Garlic", "Hvidløg", "Ail", "Alho", "大蒜"), qty: 0.004, measure: "kg", unitCost: 120 },
      { category: "SAL", name: n("Sal", "Salt", "Salt", "Sel", "Sal", "盐"), qty: 0.002, measure: "kg", unitCost: 12 },
    ],
  },
  {
    name: n("Limonada con hierbabuena", "Mint limeade", "Limonade med mynte", "Citronnade à la menthe", "Limonada com hortelã", "薄荷青柠水"),
    lines: [
      { category: "FRUTA", name: n("Limón", "Lime", "Lime", "Citron vert", "Limão", "青柠"), qty: 0.08, measure: "kg", unitCost: 30 },
      { category: "HIERBAS", name: n("Hierbabuena (manojo)", "Mint (bunch)", "Mynte (bundt)", "Menthe (botte)", "Hortelã (maço)", "薄荷（一把）"), qty: 0.15, measure: "un", unitCost: 15 },
      { category: "DULCE", name: n("Azúcar", "Sugar", "Sukker", "Sucre", "Açúcar", "白糖"), qty: 0.03, measure: "kg", unitCost: 24 },
    ],
  },
]

const STEP_MS = 520
const HOLD_MS = 3600
const LANGS: LanguageCode[] = ["es", "en", "da", "fr", "pt", "zh"]

export function LandingHeroDemo() {
  const { t, language } = useLanguage()
  const lang = LANGS.includes(language) ? language : "es"
  const usd = lang !== "es"
  const conv = (lempiras: number) => (usd ? lempiras / 25 : lempiras)
  const money = (lempiras: number) => (usd ? `$${conv(lempiras).toFixed(2)}` : `L ${lempiras.toFixed(2)}`)

  const [dish, setDish] = useState(0)
  const [shown, setShown] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    if (mq.matches) setShown(99)
    // Se pausa solo cuando salió por completo de la pantalla, y sigue donde iba.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  const d = DISHES[dish]
  const extension = (l: Line) => l.qty * l.unitCost
  const total = d.lines.reduce((s, l) => s + extension(l), 0)
  const last = d.lines.length + 2 // + precio + resumen

  useEffect(() => {
    if (reduced || !visible) return
    const id = window.setTimeout(
      () => {
        if (shown < last) setShown((s) => s + 1)
        else {
          setDish((x) => (x + 1) % DISHES.length)
          setShown(0)
        }
      },
      shown === 0 ? 600 : shown < last ? STEP_MS : HOLD_MS,
    )
    return () => window.clearTimeout(id)
  }, [shown, last, reduced, visible])

  const recipe = { pricingMethod: "food_cost", targetFoodCostPercent: 30, isv: 0, yieldAmount: 1 } as unknown as Recipe
  const priceConv = suggestedUnitPrice(recipe, conv(total), { currencyCode: usd ? "USD" : "HNL" })
  const totalConv = conv(total)
  const partial = d.lines.slice(0, Math.min(shown, d.lines.length)).reduce((s, l) => s + extension(l), 0)
  const showPrice = shown > d.lines.length
  const showSummary = shown > d.lines.length + 1
  const margin = priceConv > 0 ? ((priceConv - totalConv) / priceConv) * 100 : 0
  const costPct = priceConv > 0 ? (totalConv / priceConv) * 100 : 0
  const fmtConv = (v: number) => (usd ? `$${v.toFixed(2)}` : `L ${v.toFixed(2)}`)

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[1100px]">
      <div aria-hidden="true" className="absolute -inset-x-10 -inset-y-8 rounded-[3rem] bg-[radial-gradient(55%_60%_at_50%_30%,hsl(var(--primary)/0.14),transparent_70%)]" />

      {/* Ventana de la app: barra del navegador + encabezado real de «Ver receta» */}
      <div className="relative rounded-[18px] border border-hairline bg-background shadow-[0_40px_100px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-hairline bg-canvas-alt">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex-1 max-w-sm h-5 rounded-md bg-card border border-hairline text-[11px] text-text-4 flex items-center px-2 truncate">gastrometrics.org/ficha-tecnica</div>
        </div>

        <div className="p-3 sm:p-5 space-y-4">
          <div>
            <h3 key={dish} className="gm-anim gm-fade-up text-lg sm:text-2xl font-bold text-foreground truncate">
              {t("ficha_tecnica_view_recipe_title")}: {d.name[lang]}
            </h3>
            <p className="text-xs text-muted-foreground">{t("nav_ficha_tecnica")}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr] items-start">
            <div className="space-y-4 min-w-0">
              {/* Igual que la tarjeta «Ingredientes» de la Ficha Técnica */}
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <CardTitle>{t("nav_ingredientes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-hidden">
                    <Table className="text-[13px]">
                      <TableHeader className="bg-background">
                        <TableRow>
                          <TableHead className="text-center w-10 hidden sm:table-cell">#</TableHead>
                          <TableHead className="text-center hidden xl:table-cell">{t("ficha_tecnica_col_category")}</TableHead>
                          <TableHead className="text-center">{t("nav_ingredientes")}</TableHead>
                          <TableHead className="text-center">{t("ficha_tecnica_col_quantity")}</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">{t("ficha_tecnica_col_measure")}</TableHead>
                          <TableHead className="text-center hidden md:table-cell">{t("ficha_tecnica_col_cost_per_measure")}</TableHead>
                          <TableHead className="text-center">
                            <span className="inline-flex items-center gap-1">
                              {t("ficha_tecnica_col_extension")}
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.lines.map((l, i) => (
                          <TableRow
                            key={`${dish}-${i}`}
                            className={"gm-anim transition-all duration-500 " + (i < shown ? "opacity-100" : "opacity-0")}
                          >
                            <TableCell className="text-center py-2 hidden sm:table-cell">{i + 1}</TableCell>
                            <TableCell className="text-center py-2 text-xs hidden xl:table-cell">{getCategoryLabel(l.category, lang)}</TableCell>
                            <TableCell className="py-2">{l.name[lang]}</TableCell>
                            <TableCell className="text-center py-2 tabular-nums">{l.qty.toFixed(3)}</TableCell>
                            <TableCell className="text-center py-2 hidden sm:table-cell">{l.measure}</TableCell>
                            <TableCell className="text-center font-mono py-2 hidden md:table-cell">{money(l.unitCost)}</TableCell>
                            <TableCell className="text-center font-mono py-2">{money(extension(l))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Igual que la tarjeta «Costo total de producción» */}
              <Card className="w-full border-2">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-1">
                    <h4 className="text-base font-semibold">{t("ficha_tecnica_total_production_cost")}</h4>
                    <p className="text-3xl font-bold tabular-nums">{money(showPrice ? total : partial)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 min-w-0">
              {/* Igual que «Cálculo de Precio de Venta» con el método Food Cost % */}
              <Card className="w-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>{t("tour_ficha_pricing_title")}</CardTitle>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calculator className="h-5 w-5" />
                      <Settings className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span>{t("ficha_tecnica_unit_production_cost_label")}</span>
                      <span className="font-mono">{shown > 0 ? money(showPrice ? total : partial) : ""}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span>{t("ficha_tecnica_field_target_food_cost")}</span>
                      <span className="font-mono">30.00%</span>
                    </div>
                    <div className={"gm-anim flex justify-between items-center gap-3 pt-1 font-bold transition-opacity duration-500 " + (showPrice ? "opacity-100" : "opacity-0")}>
                      <span>{t("ficha_tecnica_sale_price_formula_label")}</span>
                      <span className={"gm-anim font-mono text-primary text-lg transition-transform duration-500 " + (showPrice ? "scale-100" : "scale-90")}>{fmtConv(priceConv)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Igual que el final de «Resumen de Costos» */}
              <Card className={"gm-anim w-full transition-all duration-500 " + (showSummary ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
                <CardHeader className="pb-2">
                  <CardTitle>{t("tour_ficha_summary_title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-bold py-2">{t("ficha_tecnica_field_contribution_margin")}</TableCell>
                        <TableCell className="font-mono text-primary font-semibold text-right py-2">{margin.toFixed(2)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold py-2">{t("ficha_tecnica_food_cost_percent_label")}</TableCell>
                        <TableCell className="font-mono text-muted-foreground text-right py-2">{costPct.toFixed(2)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-1.5" aria-hidden="true">
        {DISHES.map((_, i) => (
          <span key={i} className={"gm-anim h-1.5 rounded-full transition-all duration-500 " + (i === dish ? "w-6 bg-primary" : "w-1.5 bg-hairline")} />
        ))}
      </div>
    </div>
  )
}
