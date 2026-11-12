"use client"

import type React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

/**
 * Sub-pestañas en forma de píldoras: un panel a la vez en vez de todo apilado (docs/191).
 * Desde docs/279 cada una puede llevar una línea que dice qué hay ahí (`description`), y en
 * las secciones de /admin las píldoras se ocultan en computadora (`pillsOnDesktop={false}`)
 * porque la barra lateral ya muestra las sub-secciones.
 */
export function AdminSubTabs({
  value,
  onChange,
  items,
  pillsOnDesktop = true,
}: {
  value: string
  onChange: (value: string) => void
  items: { value: string; label: React.ReactNode; content: React.ReactNode; description?: React.ReactNode }[]
  pillsOnDesktop?: boolean
}) {
  const current = items.some((i) => i.value === value) ? value : items[0].value
  const active = items.find((i) => i.value === current)
  return (
    <Tabs value={current} onValueChange={onChange}>
      <TabsList className={cn("h-auto flex-wrap justify-start bg-transparent p-0 gap-2", !pillsOnDesktop && "lg:hidden")}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="rounded-full border border-border px-3 py-1.5 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {active?.description && (
        <div className={cn("mt-3", !pillsOnDesktop && "lg:mt-0")}>
          {!pillsOnDesktop && <h3 className="hidden text-lg font-semibold text-foreground lg:block">{active.label}</h3>}
          <p className="text-sm text-muted-foreground">{active.description}</p>
        </div>
      )}
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-4 space-y-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
