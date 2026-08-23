"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Ingredient } from "@/types/ingredient"
import { memo } from "react"
import { useDebouncedCallback } from "@/lib/hooks/useDebounce"

interface VirtualizedIngredientSelectProps {
  ingredients: Ingredient[]
  selectedIngredient: Ingredient | null
  onSelect: (ingredient: Ingredient) => void
  placeholder?: string
}

// Create a memoized version of the component to prevent unnecessary re-renders
export const VirtualizedIngredientSelect = memo(function VirtualizedIngredientSelect({
  ingredients,
  selectedIngredient,
  onSelect,
  placeholder = "Seleccionar ingrediente...",
}: VirtualizedIngredientSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filteredIngredients, setFilteredIngredients] = React.useState(ingredients)

  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  // Create an index for faster filtering
  const ingredientsIndex = React.useMemo(() => {
    const index = new Map<string, Ingredient[]>()

    // Group ingredients by first letter for faster filtering
    ingredients.forEach((ingredient) => {
      const firstChar = ingredient.name.charAt(0).toLowerCase()
      if (!index.has(firstChar)) {
        index.set(firstChar, [])
      }
      index.get(firstChar)!.push(ingredient)
    })

    return index
  }, [ingredients])

  // Debounced search with optimized filtering
  const debouncedSearch = useDebouncedCallback((query: string) => {
    if (!query) {
      setFilteredIngredients(ingredients)
      return
    }

    const lowerQuery = query.toLowerCase()

    // If query is just one character, use the index for faster filtering
    if (lowerQuery.length === 1 && ingredientsIndex.has(lowerQuery)) {
      setFilteredIngredients(ingredientsIndex.get(lowerQuery)!)
      return
    }

    // For longer queries, filter all ingredients
    // Start with exact matches in name
    let results: Ingredient[] = ingredients.filter((ingredient) => ingredient.name.toLowerCase() === lowerQuery)

    // If no exact matches, look for partial matches in name
    if (results.length === 0) {
      results = ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(lowerQuery))
    }

    // If still no matches, try category
    if (results.length === 0) {
      results = ingredients.filter((ingredient) => ingredient.category.toLowerCase().includes(lowerQuery))
    }

    setFilteredIngredients(results)
  }, 150)

  // Update filtered ingredients when search query changes
  React.useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery, ingredients, debouncedSearch])

  // Virtualized list
  const rowVirtualizer = useVirtualizer({
    count: filteredIngredients.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 35,
    overscan: 5,
  })

  // Memoize the render function to prevent unnecessary re-renders
  const renderVirtualItems = React.useCallback(() => {
    return rowVirtualizer.getVirtualItems().map((virtualRow) => {
      const ingredient = filteredIngredients[virtualRow.index]
      return (
        <CommandItem
          key={ingredient.id}
          value={ingredient.id}
          onSelect={() => {
            onSelect(ingredient)
            setOpen(false)
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <Check
            className={cn("mr-2 h-4 w-4", selectedIngredient?.id === ingredient.id ? "opacity-100" : "opacity-0")}
          />
          {ingredient.category} - {ingredient.name}
        </CommandItem>
      )
    })
  }, [filteredIngredients, onSelect, rowVirtualizer, selectedIngredient?.id])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selectedIngredient?.name || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ingrediente..." value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList>
            <CommandEmpty>No se encontraron ingredientes.</CommandEmpty>
            <CommandGroup>
              <div ref={scrollContainerRef} className="max-h-[200px] overflow-auto">
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {renderVirtualItems()}
                </div>
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})
