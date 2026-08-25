"use client"

import type React from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n/translations"
import type { UserProfile } from "@/lib/types/user"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Switch } from "@/components/ui/switch"
import {
  Settings,
  User,
  Palette,
  Globe,
  DollarSign,
  Save,
  Bell,
  Code2,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  Database,
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react"
import {
  resetAllData,
  getDataSummary,
  exportAllData,
  importAllData,
  logDevToolAction,
  type ResetOptions,
} from "@/lib/utils/reset-data"
import { useRouter } from "next/navigation"
import { setCurrentCurrencyCode } from "@/lib/currency"
import { SettingsTour } from "@/components/page-tours"
import { hasStoredPassword, verifyPassword } from "@/lib/utils/password-hash"

interface UserSettings {
  name: string
  email: string
  country: string
  currency: string
  timezone: string
  language: string
  businessType: string
  phone: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
}

// Debe cubrir, como mínimo, las 6 monedas de los 6 idiomas soportados (lib/i18n/
// translations.ts) y ser un subconjunto válido de CURRENCY_OPTIONS (lib/currency.ts) —
// ver la nota de deuda técnica ahí mismo y en referencia-arquitectura-tecnica.md
// sección 13: esta lista, la de lib/types/user.ts (COUNTRIES) y CURRENCY_OPTIONS
// divergieron una vez (faltaba Dinamarca acá, entre otros) y causaron un bug real de
// moneda — cualquier país que se agregue a una de las tres debe agregarse a las otras.
const countries = [
  { code: "HN", name: "Honduras", currency: "HNL", symbol: "L" },
  { code: "US", name: "Estados Unidos", currency: "USD", symbol: "$" },
  { code: "MX", name: "México", currency: "MXN", symbol: "$" },
  { code: "GT", name: "Guatemala", currency: "GTQ", symbol: "Q" },
  { code: "CR", name: "Costa Rica", currency: "CRC", symbol: "₡" },
  { code: "PA", name: "Panamá", currency: "PAB", symbol: "B/." },
  { code: "NI", name: "Nicaragua", currency: "NIO", symbol: "C$" },
  { code: "SV", name: "El Salvador", currency: "USD", symbol: "$" },
  { code: "BZ", name: "Belice", currency: "BZD", symbol: "BZ$" },
  { code: "ES", name: "España", currency: "EUR", symbol: "€" },
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "$" },
  { code: "CO", name: "Colombia", currency: "COP", symbol: "$" },
  { code: "PE", name: "Perú", currency: "PEN", symbol: "S/" },
  { code: "CL", name: "Chile", currency: "CLP", symbol: "$" },
  { code: "EC", name: "Ecuador", currency: "USD", symbol: "$" },
  { code: "VE", name: "Venezuela", currency: "VES", symbol: "Bs" },
  { code: "BR", name: "Brasil", currency: "BRL", symbol: "R$" },
  { code: "UY", name: "Uruguay", currency: "UYU", symbol: "$" },
  { code: "PY", name: "Paraguay", currency: "PYG", symbol: "₲" },
  { code: "BO", name: "Bolivia", currency: "BOB", symbol: "Bs" },
  { code: "DO", name: "República Dominicana", currency: "DOP", symbol: "RD$" },
  { code: "DK", name: "Dinamarca", currency: "DKK", symbol: "kr" },
  { code: "CN", name: "China", currency: "CNY", symbol: "¥" },
]

const businessTypes = [
  "Restaurante",
  "Cafetería",
  "Panadería",
  "Pastelería",
  "Food Truck",
  "Catering",
  "Bar/Pub",
  "Hotel",
  "Otro",
]

interface SettingsDialogProps {
  trigger?: React.ReactNode
  businessId?: string
}

export function SettingsDialog({ trigger, businessId }: SettingsDialogProps) {
  const router = useRouter()
  const { updateUserProfile } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState({ email: true, push: true, sms: false })
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  // Correo tal como estaba guardado antes de que el usuario tocara el campo — se
  // compara contra `email` al guardar para saber si hace falta pedir confirmación +
  // contraseña (ver handleSave más abajo). Se revierte `email` a este valor si el
  // usuario cancela la confirmación.
  const [originalEmail, setOriginalEmail] = useState("")
  const [country, setCountry] = useState("HN")
  const [currency, setCurrency] = useState("HNL")
  const [businessType, setBusinessType] = useState("Restaurante")
  const [businessSize, setBusinessSize] = useState("")
  const [experience, setExperience] = useState("")
  const [resetOptions, setResetOptions] = useState<ResetOptions>({
    keepTheme: true,
    keepSettings: true,
    keepAuth: false,
  })
  const [showConfirm, setShowConfirm] = useState(false)
  const [dataSummary, setDataSummary] = useState(getDataSummary())

  // Confirmación + contraseña actual antes de aplicar un cambio de correo (pedido
  // explícito del dueño del proyecto). showEmailConfirm reemplaza TODO el contenido
  // del diálogo (no solo una pestaña, a diferencia de showConfirm/reset) porque el
  // usuario puede tocar Guardar estando en cualquier pestaña, no solo en Perfil.
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("")
  const [showEmailConfirmPassword, setShowEmailConfirmPassword] = useState(false)
  const [emailConfirmError, setEmailConfirmError] = useState("")
  const [isVerifyingEmailChange, setIsVerifyingEmailChange] = useState(false)

  const { toast } = useToast()

  // BUG CORREGIDO (ver docs/33): este efecto tenía `[]` como dependencias, así que
  // solo corría UNA vez en toda la sesión — SettingsDialog vive montado de forma
  // permanente dentro del Sidebar (nunca se desmonta al cerrar el diálogo), así que
  // si el perfil cambiaba en otro lado (ej. al importar datos), reabrir el diálogo
  // seguía mostrando los valores viejos. Ahora se re-lee cada vez que `open` pasa a
  // true, no solo al montar el componente.
  useEffect(() => {
    if (!open) return
    setShowEmailConfirm(false)
    setEmailConfirmPassword("")
    setEmailConfirmError("")
    const userProfile = localStorage.getItem("userProfile")
    if (userProfile) {
      const profile: UserProfile = JSON.parse(userProfile)
      setFullName(profile.fullName || "")
      setEmail(profile.email || "")
      setOriginalEmail(profile.email || "")
      setCountry(profile.nationality || "HN")
      setCurrency(profile.currency || "HNL")
      setBusinessType(profile.businessType || "Restaurante")
      setBusinessSize(profile.businessSize || "")
      setExperience(profile.industryExperience || "")
    }
    const savedNotifPrefs = localStorage.getItem("notification_prefs")
    if (savedNotifPrefs) {
      try {
        setNotificationPrefs(JSON.parse(savedNotifPrefs))
      } catch {
        // valores por defecto si el JSON guardado está corrupto
      }
    }
  }, [open])

  // BUG CORREGIDO: antes solo se guardaba el perfil `if (userProfile)` ya existía
  // en localStorage — un usuario que entró en "modo demo" (login("demo","demo") en
  // app/login/page.tsx) nunca tiene un userProfile real, así que editar Nombre/
  // Correo aquí se descartaba en silencio, mientras el toast de abajo seguía
  // diciendo "guardado correctamente" sin importar el resultado. Ahora siempre se
  // construye un perfil completo (creando uno nuevo la primera vez si hace falta)
  // y se guarda de verdad — updateUserProfile no exige que ya exista uno previo.
  const performSave = (emailChanged: boolean) => {
    const existingProfileRaw = localStorage.getItem("userProfile")
    const existingProfile: Partial<UserProfile> = existingProfileRaw ? JSON.parse(existingProfileRaw) : {}

    const updatedProfile: UserProfile = {
      id: existingProfile.id || `user_${Date.now()}`,
      createdAt: existingProfile.createdAt || new Date().toISOString(),
      emailVerified: existingProfile.emailVerified ?? false,
      onboardingCompleted: existingProfile.onboardingCompleted ?? true,
      preferredLanguage: existingProfile.preferredLanguage || language,
      ...existingProfile,
      fullName,
      email,
      nationality: country,
      currency,
      businessType,
      businessSize,
      industryExperience: experience,
      // Un correo nuevo no hereda la verificación del anterior — nadie ha probado
      // todavía que esta dirección nueva sea suya.
      ...(emailChanged ? { emailVerified: false } : {}),
    }

    updateUserProfile(updatedProfile)

    const selectedCountry = countries.find((c) => c.code === country)
    localStorage.setItem("currency_symbol", selectedCountry?.symbol || "L")
    setCurrentCurrencyCode(selectedCountry?.currency || currency || "HNL")
    localStorage.setItem("notification_prefs", JSON.stringify(notificationPrefs))

    setOriginalEmail(email)
    setShowEmailConfirm(false)
    setEmailConfirmPassword("")
    setEmailConfirmError("")

    toast({
      title: "Configuraciones guardadas",
      description: "Tus preferencias han sido actualizadas correctamente.",
    })
    setOpen(false)
  }

  const handleSave = () => {
    const emailChanged = email.trim() !== originalEmail.trim()
    if (emailChanged) {
      // No se guarda todavía — primero hay que confirmar el cambio (ver
      // handleConfirmEmailChange). Pedido explícito del dueño del proyecto: cambiar
      // el correo necesita confirmación + contraseña actual, no solo tocar Guardar.
      setEmailConfirmError("")
      setShowEmailConfirm(true)
      return
    }
    performSave(false)
  }

  const handleConfirmEmailChange = async () => {
    if (hasStoredPassword()) {
      if (!emailConfirmPassword) {
        setEmailConfirmError(t("settings_email_confirm_password_required"))
        return
      }
      setIsVerifyingEmailChange(true)
      const isValid = await verifyPassword(emailConfirmPassword)
      setIsVerifyingEmailChange(false)
      if (!isValid) {
        setEmailConfirmError(t("settings_email_confirm_password_incorrect"))
        return
      }
    }
    performSave(true)
  }

  const handleCancelEmailChange = () => {
    setEmail(originalEmail)
    setShowEmailConfirm(false)
    setEmailConfirmPassword("")
    setEmailConfirmError("")
  }

  const handleReset = () => {
    const summary = getDataSummary()
    resetAllData(resetOptions)

    logDevToolAction(
      `Datos restablecidos: ${summary.businesses} negocios, ${summary.recipes} recetas, ${summary.ingredients} ingredientes eliminados`,
      {
        resetOptions,
        dataSummary: summary,
      },
    )

    setShowConfirm(false)
    setOpen(false)

    toast({
      title: "Datos restablecidos",
      description: "Todos los datos de usuario han sido eliminados. Redirigiendo...",
    })

    setTimeout(() => {
      router.push("/")
      router.refresh()
    }, 1000)
  }

  const handleExport = () => {
    const data = exportAllData()
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const filename = `gastrometrics-backup-${new Date().toISOString().split("T")[0]}.json`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logDevToolAction(`Datos exportados a ${filename}`, {
      filename,
      dataSummary: getDataSummary(),
    })

    toast({
      title: "Datos exportados",
      description: "El respaldo se ha descargado correctamente.",
    })
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const jsonData = event.target?.result as string
            importAllData(jsonData)
            setDataSummary(getDataSummary())

            logDevToolAction(`Datos importados desde ${file.name}`, {
              filename: file.name,
              dataSummary: getDataSummary(),
            })

            toast({
              title: "Datos importados",
              description: "Los datos se han restaurado correctamente.",
            })

            setTimeout(() => {
              router.refresh()
            }, 1000)
          } catch (error) {
            toast({
              title: "Error",
              description: "No se pudo importar el archivo. Verifica que sea un respaldo válido.",
              variant: "destructive",
            })
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleRefreshSummary = () => {
    setDataSummary(getDataSummary())
    toast({
      title: "Actualizado",
      description: "El resumen de datos se ha actualizado.",
    })
  }

  const getSelectedCountry = () => {
    return countries.find((c) => c.code === country)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
            <Settings className="h-4 w-4" />
            {t("nav_ajustes")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        // BUG CORREGIDO: SettingsTour vive en su propio portal a document.body (ver
        // components/page-tour.tsx), un HERMANO del portal de este Dialog, no un
        // descendiente — el "dismissable layer" de Radix cierra el diálogo ante
        // cualquier pointerdown que no esté DENTRO de su propio DialogContent, así que
        // cualquier clic en el tour (incluso ya con pointer-events arreglado) se
        // interpretaba como "clic afuera" y cerraba Configuración entera en vez de
        // avanzar el tour. data-gm-page-tour marca el portal del tour para que Radix lo
        // ignore como si fuera parte del diálogo.
        onPointerDownOutside={(event) => {
          if ((event.target as HTMLElement | null)?.closest("[data-gm-page-tour]")) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t("settings_dialog_title")}
            </span>
            {/* BUG CORREGIDO: "Reiniciar tutorial" en el sidebar no podía reiniciar el
                tour de este diálogo — el botón queda bloqueado detrás del overlay del
                modal mientras el diálogo está abierto (la única vez que su propio
                SettingsTour está montado y escuchando el evento), así que el clic
                terminaba reiniciando el tour de la página de ATRÁS en vez de este. Este
                botón vive dentro del diálogo, donde SettingsTour sí está montado. */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground shrink-0"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("gm:tour:restart", { detail: { storageKey: "tour_completed_settings-dialog" } }),
                )
              }
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">{t("sidebar_restart_tour")}</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        {showEmailConfirm ? (
          <div className="flex-1 flex flex-col justify-center space-y-4 px-1">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <h4 className="font-semibold text-foreground">{t("settings_email_confirm_title")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("settings_email_confirm_body")
                      .replace("{oldEmail}", originalEmail || t("settings_not_specified"))
                      .replace("{newEmail}", email)}
                  </p>
                </div>
              </div>
            </div>

            {hasStoredPassword() && (
              <div className="space-y-2">
                <Label htmlFor="email-confirm-password">{t("settings_email_confirm_password_label")}</Label>
                <div className="relative">
                  <Input
                    id="email-confirm-password"
                    type={showEmailConfirmPassword ? "text" : "password"}
                    value={emailConfirmPassword}
                    onChange={(e) => {
                      setEmailConfirmPassword(e.target.value)
                      setEmailConfirmError("")
                    }}
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showEmailConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {emailConfirmError && <p className="text-sm text-destructive">{emailConfirmError}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancelEmailChange} disabled={isVerifyingEmailChange}>
                {t("common_cancel")}
              </Button>
              <Button onClick={handleConfirmEmailChange} disabled={isVerifyingEmailChange}>
                {isVerifyingEmailChange ? t("settings_email_confirm_verifying") : t("settings_email_confirm_button")}
              </Button>
            </div>
          </div>
        ) : (
          <>
        <Tabs defaultValue="profile" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList data-tour="settings-tabs" className="grid w-full grid-cols-5 shrink-0">
            <TabsTrigger id="settings-tab-profile" value="profile" className="flex items-center gap-2" title={t("settings_profile")}>
              <User className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t("settings_profile")}</span>
            </TabsTrigger>
            <TabsTrigger id="settings-tab-appearance" value="appearance" className="flex items-center gap-2" title={t("settings_appearance")}>
              <Palette className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t("settings_appearance")}</span>
            </TabsTrigger>
            <TabsTrigger id="settings-tab-regional" value="regional" className="flex items-center gap-2" title={t("settings_regional")}>
              <Globe className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t("settings_regional")}</span>
            </TabsTrigger>
            <TabsTrigger id="settings-tab-notifications" value="notifications" className="flex items-center gap-2" title={t("settings_notifications")}>
              <Bell className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t("settings_notifications")}</span>
            </TabsTrigger>
            <TabsTrigger id="settings-tab-developer" value="developer" className="flex items-center gap-2" title={t("settings_tab_developer")}>
              <Code2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline truncate">{t("settings_tab_developer")}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <TabsContent value="profile" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t("settings_personal_info")}
                  </CardTitle>
                  <CardDescription>{t("settings_personal_info_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Badge variant="secondary">{t("settings_registration_data")}</Badge>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("settings_created_at")}</p>
                        <p className="font-medium">
                          {(() => {
                            if (typeof window === "undefined") return t("settings_not_available")
                            const profile = JSON.parse(localStorage.getItem("userProfile") || "{}")
                            // BUG CORREGIDO: hardcodeaba locale "es-HN" sin importar el
                            // idioma elegido en esta misma pestaña — un usuario en inglés/
                            // francés/etc. seguía viendo nombres de mes en español.
                            return profile.createdAt
                              ? new Date(profile.createdAt).toLocaleDateString(language, {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                })
                              : t("settings_not_available")
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("settings_business_size")}</p>
                        <p className="font-medium">{businessSize || t("settings_not_specified")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("settings_experience")}</p>
                        <p className="font-medium">{experience || t("settings_not_specified")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("settings_email_verified")}</p>
                        <p className="font-medium">
                          {(() => {
                            if (typeof window === "undefined") return t("settings_pending")
                            const profile = JSON.parse(localStorage.getItem("userProfile") || "{}")
                            return profile.emailVerified ? t("settings_yes") : t("settings_pending")
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div data-tour="settings-profile-fields" className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("settings_full_name")}</Label>
                      <Input
                        id="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t("settings_full_name")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("settings_email_label")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">{t("settings_country")}</Label>
                      <Select
                        value={country}
                        onValueChange={(value) => {
                          const selectedCountry = countries.find((c) => c.code === value)
                          if (selectedCountry) {
                            setCountry(value)
                            setCurrency(selectedCountry.currency)
                            setCurrentCurrencyCode(selectedCountry.currency)
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {countries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <div className="flex items-center gap-2">
                                <span>{c.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {c.symbol}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessType">{t("settings_business_type")}</Label>
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {businessTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    {t("settings_themes_colors")}
                  </CardTitle>
                  <CardDescription>{t("settings_themes_colors_desc")}</CardDescription>
                </CardHeader>
                <CardContent data-tour="settings-appearance-theme">
                  <ThemeSwitcher businessId={businessId} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="regional" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {t("settings_regional_config")}
                  </CardTitle>
                  <CardDescription>{t("settings_regional_config_desc")}</CardDescription>
                </CardHeader>
                <CardContent data-tour="settings-regional-fields" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="country-regional">{t("settings_country")}</Label>
                    <Select
                      value={country}
                      onValueChange={(value) => {
                        const selectedCountry = countries.find((c) => c.code === value)
                        if (selectedCountry) {
                          setCountry(value)
                          setCurrency(selectedCountry.currency)
                          setCurrentCurrencyCode(selectedCountry.currency)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {c.symbol}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {getSelectedCountry() && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-medium">{t("settings_selected_currency")}</span>
                        <Badge variant="outline">
                          {getSelectedCountry()?.currency} ({getSelectedCountry()?.symbol})
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Este símbolo se usará en toda la aplicación para mostrar precios
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="app-language">{t("settings_language")}</Label>
                    <Select
                      value={language}
                      onValueChange={(value: LanguageCode) => {
                        setLanguage(value)
                      }}
                    >
                      <SelectTrigger id="app-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Traduce los textos de la interfaz. El contenido que escribas tú (nombres de
                      recetas, ingredientes, negocios) no se traduce.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t("settings_notification_prefs")}
                  </CardTitle>
                  <CardDescription>{t("settings_notification_prefs_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div data-tour="settings-notifications-toggles" className="space-y-3">
                    {/* BUG CORREGIDO: estos 3 toggles usaban <input type="checkbox"> crudo
                        (sin id/htmlFor emparejados, así que hacer clic en el texto no
                        marcaba el checkbox) mientras la pestaña Developer, unas pantallas
                        más abajo, usa el componente Switch de la app para el mismo tipo de
                        control. Ahora los tres son Switch, consistentes entre sí. */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="notif-email">{t("settings_email_notifications")}</Label>
                        <p className="text-sm text-muted-foreground">{t("settings_email_notifications_desc")}</p>
                      </div>
                      <Switch
                        id="notif-email"
                        checked={notificationPrefs.email}
                        onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, email: checked }))}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="notif-push">{t("settings_push_notifications")}</Label>
                        <p className="text-sm text-muted-foreground">{t("settings_push_notifications_desc")}</p>
                      </div>
                      <Switch
                        id="notif-push"
                        checked={notificationPrefs.push}
                        onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, push: checked }))}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="notif-sms">{t("settings_sms_notifications")}</Label>
                        <p className="text-sm text-muted-foreground">{t("settings_sms_notifications_desc")}</p>
                      </div>
                      <Switch
                        id="notif-sms"
                        checked={notificationPrefs.sms}
                        onCheckedChange={(checked) => setNotificationPrefs((prev) => ({ ...prev, sms: checked }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="developer" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {t("settings_dev_tools")}
                  </CardTitle>
                  <CardDescription>
                    Gestiona los datos de la aplicación para pruebas y desarrollo. Las acciones realizadas aquí se
                    registrarán en Actividad Reciente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{t("settings_data_summary")}</h3>
                      <Button variant="ghost" size="sm" onClick={handleRefreshSummary} className="h-8 gap-2">
                        <RefreshCw className="h-3 w-3" />
                        {t("settings_refresh")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("settings_total_keys")}</p>
                        <p className="text-2xl font-bold">{dataSummary.totalKeys}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("nav_negocios")}</p>
                        <p className="text-2xl font-bold">{dataSummary.businesses}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("settings_recipes_label")}</p>
                        <p className="text-2xl font-bold">{dataSummary.recipes}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("nav_ingredientes")}</p>
                        <p className="text-2xl font-bold">{dataSummary.ingredients}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("settings_orders")}</p>
                        <p className="text-2xl font-bold">{dataSummary.purchaseOrders}</p>
                      </div>
                      <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("nav_menus")}</p>
                        <p className="text-2xl font-bold">{dataSummary.menus}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div data-tour="settings-developer-backup" className="space-y-3">
                    <h3 className="text-sm font-semibold">{t("settings_backup_restore")}</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExport} className="flex-1 gap-2 bg-transparent">
                        <Download className="h-4 w-4" />
                        {t("settings_export_data")}
                      </Button>
                      <Button variant="outline" onClick={handleImport} className="flex-1 gap-2 bg-transparent">
                        <Upload className="h-4 w-4" />
                        {t("settings_import_data")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Exporta todos los datos para crear un respaldo o importa datos desde un archivo de respaldo.
                    </p>
                  </div>

                  <Separator />

                  {!showConfirm ? (
                    <div data-tour="settings-developer-reset" className="space-y-3">
                      <h3 className="text-sm font-semibold">{t("settings_reset_data")}</h3>
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="keep-theme" className="text-sm">
                            {t("settings_keep_theme")}
                          </Label>
                          <Switch
                            id="keep-theme"
                            checked={resetOptions.keepTheme}
                            onCheckedChange={(checked) => setResetOptions({ ...resetOptions, keepTheme: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="keep-settings" className="text-sm">
                            {t("settings_keep_settings")}
                          </Label>
                          <Switch
                            id="keep-settings"
                            checked={resetOptions.keepSettings}
                            onCheckedChange={(checked) => setResetOptions({ ...resetOptions, keepSettings: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="keep-auth" className="text-sm">
                            {t("settings_keep_auth")}
                          </Label>
                          <Switch
                            id="keep-auth"
                            checked={resetOptions.keepAuth}
                            onCheckedChange={(checked) => setResetOptions({ ...resetOptions, keepAuth: checked })}
                          />
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            ℹ️ Las actividades recientes y notificaciones siempre se mantienen para registrar las
                            acciones de desarrollo.
                          </p>
                        </div>
                      </div>
                      <Button variant="destructive" onClick={() => setShowConfirm(true)} className="w-full gap-2">
                        <Trash2 className="h-4 w-4" />
                        {t("settings_reset_all")}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Esta acción eliminará todos los datos de usuario de la aplicación.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <h4 className="font-semibold text-destructive">{t("settings_confirm_title")}</h4>
                            <p className="text-sm text-muted-foreground">Esta acción eliminará permanentemente:</p>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                              <li>{dataSummary.businesses} negocios</li>
                              <li>{dataSummary.recipes} recetas</li>
                              <li>{dataSummary.ingredients} ingredientes</li>
                              <li>{dataSummary.purchaseOrders} órdenes de compra</li>
                              <li>{dataSummary.menus} menús</li>
                              <li>Y todos los demás datos de usuario</li>
                            </ul>
                            <Badge variant="destructive" className="mt-2">
                              Esta acción no se puede deshacer
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
                          {t("common_cancel")}
                        </Button>
                        <Button variant="destructive" onClick={handleReset} className="flex-1">
                          {t("settings_yes_reset")}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex items-center justify-between gap-2 pt-4 border-t shrink-0">
          <Link href="/contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t("settings_feedback_link")}
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button data-tour="settings-save" onClick={handleSave} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {t("settings_save_button")}
            </Button>
          </div>
        </div>
          </>
        )}
      </DialogContent>
      {open && <SettingsTour />}
    </Dialog>
  )
}
