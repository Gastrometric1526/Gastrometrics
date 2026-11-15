"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Check, Palette, Sun, Moon, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { CURATED_THEMES, FOLLOW_USER_THEME, businessOwnThemeSlug, userThemeSlug } from "@/lib/theme-colors"
import { saveBusinessTheme, saveUserTheme } from "@/lib/theme-sync"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

interface ThemeSwitcherProps {
  businessId?: string
  showLightDark?: boolean
  className?: string
}

export function ThemeSwitcher({ businessId, showLightDark = true, className }: ThemeSwitcherProps) {
  const { t } = useLanguage()
  const { theme: systemTheme, setTheme: setSystemTheme } = useTheme()
  const { toast } = useToast()
  const isBusiness = Boolean(businessId && businessId !== "main")
  // Selección actual: un slug, o FOLLOW_USER_THEME en un negocio que usa el color de la persona.
  const [currentColorTheme, setCurrentColorTheme] = useState<string>(FOLLOW_USER_THEME)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentColorTheme(isBusiness ? businessOwnThemeSlug(businessId) ?? FOLLOW_USER_THEME : userThemeSlug())
  }, [businessId, isBusiness])

  // Se aplica al instante (ThemeInitializer escucha el cambio) y se guarda en la cuenta o en
  // el negocio, para que sea el mismo en la computadora y en el teléfono (docs/309).
  const handleColorThemeChange = async (themeSlug: string) => {
    setCurrentColorTheme(themeSlug)
    const ok = isBusiness ? await saveBusinessTheme(businessId as string, themeSlug) : await saveUserTheme(themeSlug)
    if (!ok) toast({ title: t("themeswitch_save_error"), variant: "destructive" })
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
            {t("themeswitch_display_mode")}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={systemTheme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("light")}
              className="justify-start"
            >
              <Sun className="h-4 w-4 mr-2" />
              {t("business_menu_theme_light")}
            </Button>
            <Button
              variant={systemTheme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("dark")}
              className="justify-start"
            >
              <Moon className="h-4 w-4 mr-2" />
              {t("business_menu_theme_dark")}
            </Button>
            <Button
              variant={systemTheme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setSystemTheme("system")}
              className="justify-start"
            >
              <Monitor className="h-4 w-4 mr-2" />
              {t("business_menu_theme_system")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="h-4 w-4" />
          {businessId ? t("themeswitch_theme_colors_business") : t("themeswitch_theme_colors_main")}
        </h4>

        {isBusiness && (
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 border-2",
              currentColorTheme === FOLLOW_USER_THEME ? "border-primary" : "border-border hover:border-primary/50",
            )}
            onClick={() => handleColorThemeChange(FOLLOW_USER_THEME)}
            data-testid="theme-follow-user"
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                  style={{ backgroundColor: `hsl(${(CURATED_THEMES.find((x) => x.slug === userThemeSlug()) || CURATED_THEMES[0]).primary})` }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t("themeswitch_follow_user")}</p>
                  <p className="text-xs text-muted-foreground">{t("themeswitch_follow_user_desc")}</p>
                </div>
                {currentColorTheme === FOLLOW_USER_THEME && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          {CURATED_THEMES.map((theme) => (
            <Card
              key={theme.slug}
              className={cn(
                "cursor-pointer transition-all duration-200 border-2",
                currentColorTheme === theme.slug ? "border-primary" : "border-border hover:border-primary/50",
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

      <p className="text-xs text-muted-foreground">{t("themeswitch_synced_hint")}</p>

      {isBusiness && (
        <div className="pt-2 border-t border-border">
          <Badge variant="secondary" className="text-xs">
            {t("themeswitch_independent_theme_badge")}
          </Badge>
        </div>
      )}
    </div>
  )
}
