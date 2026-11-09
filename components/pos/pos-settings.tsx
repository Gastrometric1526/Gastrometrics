"use client"

/**
 * Ajustes del POS (docs/268): el plano del salón (áreas y mesas que se arrastran), los
 * extras con precio y qué platos se muestran en la carta.
 */

import { useState } from "react"
import { Copy, Plus, Trash2 } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConfirmDialog } from "@/components/confirm-dialog"
import { useLanguage } from "@/contexts/language-context"
import { FloorMap } from "@/components/pos/floor-map"
import type { PosSellable } from "@/components/pos/dish-picker"
import { nextTableLabel, shapeSize, snapTable } from "@/lib/pos"
import type { FloorPlan, FloorTable, PosConfig, PosExtra, TableShape } from "@/types/pos"

const NONE = "__none__"

export function PosSettings({
  plan,
  config,
  recipes,
  sellables,
  areaId,
  onArea,
  onPlan,
  onConfig,
}: {
  plan: FloorPlan
  config: PosConfig
  recipes: { id: string; name: string; classification: string; isSubRecipe?: boolean }[]
  sellables: PosSellable[]
  areaId: string
  onArea: (id: string) => void
  onPlan: (plan: FloorPlan) => void
  onConfig: (config: PosConfig) => void
}) {
  const { t } = useLanguage()
  const [confirm, confirmDialog] = useConfirmDialog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const now = () => new Date().toISOString()
  const area = plan.areas.find((a) => a.id === areaId) ?? plan.areas[0]
  const tables = plan.tables.filter((tb) => tb.areaId === area?.id)
  const selected = plan.tables.find((tb) => tb.id === selectedId) ?? null
  const classifications = [...new Set(recipes.map((r) => r.classification).filter(Boolean))].sort()

  const putTable = (table: FloorTable) => onPlan({ ...plan, tables: plan.tables.map((tb) => (tb.id === table.id ? snapTable(table) : tb)), updatedAt: now() })
  const addTable = (shape: TableShape) => {
    const size = shapeSize(shape, 4)
    const table = snapTable({ id: uuidv4(), areaId: area.id, label: nextTableLabel(plan), shape, seats: 4, x: 40, y: 40, ...size })
    onPlan({ ...plan, tables: [...plan.tables, table], updatedAt: now() })
    setSelectedId(table.id)
  }
  const duplicate = (table: FloorTable) => {
    const copy = snapTable({ ...table, id: uuidv4(), label: nextTableLabel(plan), x: table.x + 40, y: table.y + 40 })
    onPlan({ ...plan, tables: [...plan.tables, copy], updatedAt: now() })
    setSelectedId(copy.id)
  }
  const removeTable = async (table: FloorTable) => {
    if (!(await confirm(t("pos_table_delete_confirm").replace("{label}", table.label)))) return
    onPlan({ ...plan, tables: plan.tables.filter((tb) => tb.id !== table.id), updatedAt: now() })
    setSelectedId(null)
  }
  const addArea = () => {
    const id = uuidv4()
    onPlan({ ...plan, areas: [...plan.areas, { id, name: t("pos_area_new_name").replace("{n}", String(plan.areas.length + 1)) }], updatedAt: now() })
    onArea(id)
  }
  const renameArea = (name: string) => onPlan({ ...plan, areas: plan.areas.map((a) => (a.id === area.id ? { ...a, name } : a)), updatedAt: now() })
  const removeArea = async () => {
    if (plan.areas.length <= 1) return
    if (!(await confirm(t("pos_area_delete_confirm").replace("{name}", area.name)))) return
    const rest = plan.areas.filter((a) => a.id !== area.id)
    onPlan({ ...plan, areas: rest, tables: plan.tables.filter((tb) => tb.areaId !== area.id), updatedAt: now() })
    onArea(rest[0].id)
  }

  const putExtra = (extra: PosExtra) => onConfig({ ...config, extras: config.extras.map((e) => (e.id === extra.id ? extra : e)), updatedAt: now() })
  const addExtra = () => onConfig({ ...config, extras: [...config.extras, { id: uuidv4(), name: "", price: 0, recipeId: null, classifications: [] }], updatedAt: now() })
  const removeExtra = async (extra: PosExtra) => {
    if (!(await confirm(t("pos_extra_delete_confirm").replace("{name}", extra.name || t("pos_extras_title"))))) return
    onConfig({ ...config, extras: config.extras.filter((e) => e.id !== extra.id), updatedAt: now() })
  }
  const toggleHidden = (key: string, visible: boolean) =>
    onConfig({ ...config, hidden: visible ? config.hidden.filter((h) => h !== key) : [...new Set([...config.hidden, key])], updatedAt: now() })

  return (
    <div className="space-y-6">
      {confirmDialog}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pos_settings_floor_title")}</CardTitle>
          <CardDescription>{t("pos_settings_floor_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {plan.areas.map((a) => (
              <Button key={a.id} size="sm" variant={a.id === area?.id ? "default" : "outline"} onClick={() => onArea(a.id)}>
                {a.name}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={addArea}>
              <Plus className="h-3.5 w-3.5" />
              {t("pos_area_add")}
            </Button>
          </div>
          {area && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("pos_area_name")}</span>
                <Input value={area.name} onChange={(e) => renameArea(e.target.value)} className="w-56" />
              </label>
              {plan.areas.length > 1 && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={removeArea}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("pos_area_delete")}
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(["square", "round", "rect"] as TableShape[]).map((s) => (
              <Button key={s} size="sm" variant="outline" className="gap-1.5" onClick={() => addTable(s)}>
                <Plus className="h-3.5 w-3.5" />
                {t(`pos_add_table_${s}` as "pos_add_table_square")}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <FloorMap tables={tables} orders={new Map()} mode="edit" selectedId={selectedId} onSelect={setSelectedId} onMove={putTable} />
            <div className="rounded-xl border border-border p-4 space-y-3 h-fit">
              {!selected ? (
                <p className="text-sm text-muted-foreground">{t("pos_settings_pick_table")}</p>
              ) : (
                <>
                  <p className="text-sm font-semibold">{t("pos_table_title").replace("{label}", selected.label)}</p>
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">{t("pos_table_label")}</span>
                    <Input value={selected.label} onChange={(e) => putTable({ ...selected, label: e.target.value.slice(0, 12) })} />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">{t("pos_table_shape")}</span>
                    <Select value={selected.shape} onValueChange={(v) => putTable({ ...selected, shape: v as TableShape, ...shapeSize(v as TableShape, selected.seats) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["square", "round", "rect"] as TableShape[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`pos_shape_${s}` as "pos_shape_square")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">{t("pos_table_seats")}</span>
                    <Input type="number" min={1} max={20} value={selected.seats} onChange={(e) => putTable({ ...selected, seats: Number(e.target.value) || 1 })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => duplicate(selected)}>
                      <Copy className="h-3.5 w-3.5" />
                      {t("pos_table_duplicate")}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => removeTable(selected)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("pos_table_delete")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-tour="salon-extras">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{t("pos_extras_title")}</CardTitle>
            <CardDescription>{t("pos_settings_extras_desc")}</CardDescription>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={addExtra}>
            <Plus className="h-3.5 w-3.5" />
            {t("pos_extra_add")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.extras.length === 0 && <p className="text-sm text-muted-foreground">{t("pos_settings_extras_empty")}</p>}
          {config.extras.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto] items-end">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("pos_extra_name")}</span>
                  <Input value={e.name} onChange={(ev) => putExtra({ ...e, name: ev.target.value })} placeholder={t("pos_extra_name_placeholder")} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("pos_extra_price")}</span>
                  <NumericInput value={e.price || ""} onChange={(v) => putExtra({ ...e, price: Math.max(0, v) })} placeholder="0" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("pos_extra_recipe")}</span>
                  <Select value={e.recipeId ?? NONE} onValueChange={(v) => putExtra({ ...e, recipeId: v === NONE ? null : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t("pos_extra_recipe_none")}</SelectItem>
                      {recipes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <Button size="icon" variant="outline" onClick={() => removeExtra(e)} aria-label={t("pos_extra_delete")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("pos_extra_where")}</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant={e.classifications.length === 0 ? "default" : "outline"} className="h-7" onClick={() => putExtra({ ...e, classifications: [] })}>
                    {t("pos_extra_where_all")}
                  </Button>
                  {classifications.map((c) => {
                    const on = e.classifications.includes(c)
                    return (
                      <Button
                        key={c}
                        size="sm"
                        variant={on ? "default" : "outline"}
                        className="h-7"
                        onClick={() => putExtra({ ...e, classifications: on ? e.classifications.filter((x) => x !== c) : [...e.classifications, c] })}
                      >
                        {c}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pos_settings_menu_title")}</CardTitle>
          <CardDescription>{t("pos_settings_menu_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {sellables.map((s) => (
            <label key={s.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm truncate">{s.name}</span>
              <Switch checked={!config.hidden.includes(s.key)} onCheckedChange={(v) => toggleHidden(s.key, v)} />
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
