"use client"

import type React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Sub-pestañas en forma de píldoras: un panel a la vez en vez de todo apilado (docs/191). */
export function AdminSubTabs({
  value,
  onChange,
  items,
}: {
  value: string
  onChange: (value: string) => void
  items: { value: string; label: React.ReactNode; content: React.ReactNode }[]
}) {
  const current = items.some((i) => i.value === value) ? value : items[0].value
  return (
    <Tabs value={current} onValueChange={onChange}>
      <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-2">
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
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-4 space-y-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
