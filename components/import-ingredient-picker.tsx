"use client"

/**
 * Lista plegable con buscador para cada línea de Importar receta (pedido del dueño, docs/348):
 * «que muestre los ingredientes y los que asume el sistema, como lista plegable, para que el
 * usuario seleccione de los ingredientes que tiene en su base y lo haga más rápido; si en la
 * foto dice tomate, que lo pueda corregir, seleccionar o atar a un ingrediente».
 *
 * - Arriba, «Sugeridos»: los de la base más parecidos a lo leído (`rankMatches`), con el que
 *   la app eligió marcado como «elegido por la app».
 * - Se puede buscar entre todos los ingredientes de la base (nombre o proveedor).
 * - Abajo: crear uno nuevo con ese nombre, o no usar esta línea.
 */

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus, Ban, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { useLanguage } from "@/contexts/language-context"
import { rankMatches } from "@/lib/recipe-import/match-ingredients"
import type { Ingredient } from "@/types/ingredient"

export function ImportIngredientPicker({
  value,
  readName,
  autoId,
  ingredients,
  language,
  createValue,
  skipValue,
  onChange,
  ariaLabel,
}: {
  /** id de ingrediente, `createValue` o `skipValue`. */
  value: string
  /** El nombre leído (y corregido) de la línea: guía los sugeridos. */
  readName: string
  /** El que la app eligió sola al leer (para marcarlo). */
  autoId: string | null
  ingredients: Ingredient[]
  language: string
  createValue: string
  skipValue: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const suggested = useMemo(() => rankMatches(readName, ingredients, language, 5).map((m) => m.ingredient), [readName, ingredients, language])
  const suggestedIds = new Set(suggested.map((i) => i.id))
  const rest = useMemo(() => [...ingredients].sort((a, b) => a.name.localeCompare(b.name)), [ingredients])
  const chosen = ingredients.find((i) => i.id === value)

  const label =
    value === createValue
      ? t("recipe_import_create_named").replace("{name}", readName.trim() || "…")
      : value === skipValue
        ? t("recipe_import_skip")
        : (chosen?.name ?? t("recipe_import_pick_placeholder"))

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  const item = (ing: Ingredient) => (
    <CommandItem key={ing.id} value={`${ing.name} ${ing.supplier ?? ""} ${ing.id}`} onSelect={() => pick(ing.id)}>
      <Check className={`mr-2 h-4 w-4 shrink-0 ${value === ing.id ? "opacity-100" : "opacity-0"}`} />
      <span className="min-w-0 flex-1 truncate">{ing.name}</span>
      {ing.supplier ? <span className="ml-2 max-w-[40%] truncate text-xs text-muted-foreground">{ing.supplier}</span> : null}
      {ing.id === autoId ? (
        <span className="ml-2 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{t("recipe_import_auto_badge")}</span>
      ) : null}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={`w-full justify-between bg-transparent font-normal ${value === skipValue ? "text-muted-foreground" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {value === createValue ? <Plus className="h-3.5 w-3.5 shrink-0" /> : value === skipValue ? <Ban className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("recipe_import_pick_search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("recipe_import_pick_empty")}</CommandEmpty>
            {suggested.length > 0 && (
              <CommandGroup heading={t("recipe_import_pick_suggested")}>
                {suggested.map(item)}
              </CommandGroup>
            )}
            <CommandGroup heading={t("recipe_import_pick_all")}>{rest.filter((i) => !suggestedIds.has(i.id)).map(item)}</CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value={`__create ${readName}`} onSelect={() => pick(createValue)}>
                <Plus className="mr-2 h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{t("recipe_import_create_named").replace("{name}", readName.trim() || "…")}</span>
              </CommandItem>
              <CommandItem value="__skip" onSelect={() => pick(skipValue)}>
                <Ban className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                {t("recipe_import_skip")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        {autoId === null && value === createValue ? (
          <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {t("recipe_import_pick_no_auto")}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
