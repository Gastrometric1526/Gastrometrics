"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Palette, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { CURATED_THEMES, DEFAULT_THEME_SLUG, resolveThemeSlug, applyThemeAttribute } from "@/lib/theme-colors"

interface ThemeSwitcherProps {
  businessId?: string
  showLightDark?: boolean
  className?: string
}

export function ThemeSwitcher({ businessId, showLightDark = true, className }: ThemeSwitcherProps) {
  const { theme: systemTheme, setTheme: setSystemTheme } = useTheme()
  const [currentColorTheme, setCurrentColorTheme] = useState(DEFAULT_THEME_SLUG)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Load theme for specific business or main dashboard
    const themeKey = businessId ? `business_${businessId}_color_theme` : "main_color_theme"
    const savedTheme = localStorage.getItem(themeKey)
    // Un valor guardado antes de la migración a los 7 temas curados (ver docs/36) sigue
    // pintando su color correcto vía globals.css, pero aquí en el selector se muestra
    // resaltada la tarjeta del equivalente curado, no una tarjeta vacía/sin selección.
    setCurrentColorTheme(resolveThemeSlug(savedTheme))

    // Apply theme to document
    applyThemeAttribute(savedTheme || DEFAULT_THEME_SLUG)
  }, [businessId])

  const handleColorThemeChange = (themeSlug: string) => {
    setCurrentColorTheme(themeSlug)

    // Save theme for specific business or main dashboard
    const themeKey = businessId ? `business_${businessId}_color_theme` : "main_color_theme"
    localStorage.setItem(themeKey, themeSlug)

    // Apply theme to document (ya dispara "gm:theme-changed" — ver lib/theme-colors.ts)
    applyThemeAttribute(themeSlug)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showLightDark && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Modo de visualización
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={systemTheme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("light")}
              className="justify-start"
            >
              <Sun className="h-4 w-4 mr-2" />
              Claro
            </Button>
            <Button
              variant={systemTheme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("dark")}
              className="justify-start"
            >
              <Moon className="h-4 w-4 mr-2" />
              Oscuro
            </Button>
            <Button
              variant={systemTheme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("system")}
              className="justify-start"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Sistema
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Colores del tema {businessId ? "(Este negocio)" : "(Dashboard principal)"}
        </h4>

        <div className="grid grid-cols-2 gap-2">
          {CURATED_THEMES.map((theme) => (
            <Card
              key={theme.slug}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md border-2",
                currentColorTheme === theme.slug
                  ? "border-primary shadow-md"
                  : "border-border hover:border-primary/50",
              )}
              onClick={() => handleColorThemeChange(theme.slug)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                    style={{ backgroundColor: `hsl(${theme.primary})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{theme.label}</p>
                  </div>
                  {currentColorTheme === theme.slug && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {businessId && (
        <div className="pt-2 border-t border-border">
          <Badge variant="secondary" className="text-xs">
            Tema independiente para este negocio
          </Badge>
        </div>
      )}
    </div>
  )
}
