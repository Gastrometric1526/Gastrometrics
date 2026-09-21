"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { setCurrentPlanSlug } from "@/lib/plan-access"
import { getLocalizedPlans } from "@/lib/plans"
import { setPendingSignupPlan, consumePendingSignupPlan } from "@/lib/pending-signup-plan"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  User,
  Globe,
  DollarSign,
  Briefcase,
  Users,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { storePasswordHash } from "@/lib/utils/password-hash"
import {
  COUNTRIES,
  BUSINESS_TYPES,
  BUSINESS_SIZES,
  EXPERIENCE_LEVELS,
  type UserRegistrationData,
} from "@/lib/types/user"
import { registrationStep1Schema, registrationStep2Schema, registrationStep3Schema } from "@/lib/validations/auth"

// BUG CORREGIDO: useSearchParams() (para leer ?plan=) exige un límite de Suspense
// por encima para poder pre-renderizarse estáticamente — sin él, `next build` fallaba
// en esta página (ver misma corrección en components/sidebar.tsx).
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  )
}

function SignupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, signUp } = useAuth()
  const { t, language } = useLanguage()
  // Planes que se pueden elegir en el registro — "chef-ejecutivo" queda afuera a
  // propósito, mismo criterio que /planes (components/plans-grid.tsx): tiene
  // comingSoon=true, no es autoservicio, su único CTA en toda la app es "hablar con
  // ventas". Si llegan con ?plan=chef-ejecutivo (o cualquier slug que no exista) desde
  // afuera, cae a "foodie" en vez de dejar seleccionado algo no comprable.
  const selectablePlans = getLocalizedPlans(language).filter((plan) => !plan.comingSoon)
  const planFromUrl = searchParams.get("plan")
  const initialPlanSlug = selectablePlans.some((plan) => plan.slug === planFromUrl) ? planFromUrl! : "foodie"
  const [currentStep, setCurrentStep] = useState(1)
  // Pedido explícito del dueño del proyecto: "el cuestionario de crear cuenta debería
  // preguntar a que plan quiere crear la cuenta" — antes esto solo se decidía por un
  // ?plan= en la URL (llegando desde /planes), invisible para cualquiera que entrara
  // directo a /signup; ahora siempre es una elección explícita y visible, con "foodie"
  // como default sensato si no vienen de ningún lado con un plan ya elegido.
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(initialPlanSlug)
  const [isLoading, setIsLoading] = useState(false)
  const [showCheckEmail, setShowCheckEmail] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [productUpdatesOptIn, setProductUpdatesOptIn] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form data
  const [formData, setFormData] = useState<Partial<UserRegistrationData>>({
    fullName: "",
    email: "",
    password: "",
    nationality: "",
    currency: "",
    businessType: "",
    businessSize: "",
    industryExperience: "",
  })
  const [confirmPassword, setConfirmPassword] = useState("")

  const totalSteps = 5
  const progress = (currentStep / totalSteps) * 100

  const updateFormData = (field: keyof UserRegistrationData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validateStep = (step: number): boolean => {
    setErrors({})

    try {
      if (step === 1) {
        registrationStep1Schema.parse({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          confirmPassword,
        })
      } else if (step === 2) {
        registrationStep2Schema.parse({
          nationality: formData.nationality,
          currency: formData.currency,
        })
      } else if (step === 3) {
        registrationStep3Schema.parse({
          businessType: formData.businessType,
          businessSize: formData.businessSize,
          industryExperience: formData.industryExperience,
        })
      }
      return true
    } catch (error: any) {
      const newErrors: Record<string, string> = {}
      error.errors?.forEach((err: any) => {
        newErrors[err.path[0]] = err.message
      })
      setErrors(newErrors)
      return false
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!acceptedTerms) {
      setErrors({ terms: t("signup_error_terms_required") })
      return
    }

    if (!validateStep(3)) return

    setIsLoading(true)

    // Se guarda ANTES de intentar el login — si la cuenta exige confirmar el correo
    // (el caso normal, ver comentario de cabecera de lib/pending-signup-plan.ts), el
    // intento de abajo va a fallar y la persona recién vuelve a tener sesión real más
    // tarde desde /login, que también sabe leer esto (ver app/login/page.tsx).
    if (selectedPlanSlug !== "foodie") {
      setPendingSignupPlan(selectedPlanSlug)
    }

    try {
      await signUp(
        formData.email!,
        formData.password!,
        {
          fullName: formData.fullName!,
          nationality: formData.nationality!,
          currency: formData.currency!,
          businessType: formData.businessType!,
          businessSize: formData.businessSize!,
          industryExperience: formData.industryExperience!,
        },
        { preferredLanguage: language, productUpdatesOptIn, acceptedTerms },
      )

      // Contraseña local (ver lib/utils/password-hash.ts) para el chequeo de "confirma
      // tu contraseña" al cambiar el correo en Configuración — independiente de la
      // contraseña real que ahora vive en Supabase Auth.
      await storePasswordHash(formData.password!)
      // El correo de "confirma tu cuenta" (plantilla de marca, no el genérico de
      // Supabase) ya lo mandó app/api/auth/signup/route.ts, llamado dentro de
      // signUp() de arriba — no hace falta un segundo correo de bienvenida acá
      // encima, llegarían casi al mismo tiempo y uno pisaría al otro en la bandeja.

      // Intenta loguear de inmediato. Si el proyecto de Supabase exige confirmar el
      // correo antes de poder iniciar sesión, esto falla con un error específico — en
      // ese caso la cuenta sí se creó, solo falta que confirmen el correo primero.
      try {
        await login(formData.email!, formData.password!)
      } catch (loginError: any) {
        const message = typeof loginError?.message === "string" ? loginError.message.toLowerCase() : ""
        if (message.includes("confirm")) {
          setShowCheckEmail(true)
          return
        }
        throw loginError
      }

      // Los planes pagos pasan por un paso de método de pago antes del dashboard; el
      // plan gratuito va directo. consumePendingSignupPlan() (no selectedPlanSlug
      // directo) porque este login inmediato es el único punto donde SÍ hace falta
      // consumirlo ahora — si en cambio la cuenta exigió confirmar el correo primero,
      // este bloque nunca se ejecuta y queda pendiente para cuando entren por /login.
      const pendingPlan = consumePendingSignupPlan()
      if (pendingPlan) {
        router.push(`/signup/payment?plan=${pendingPlan}`)
      } else {
        setCurrentPlanSlug("foodie")
        router.push("/dashboard")
      }
    } catch (error: any) {
      console.error("Registration error:", error)
      const rawMessage = typeof error?.message === "string" ? error.message : ""
      const message = rawMessage.toLowerCase()
      // "EMAIL_ALREADY_REGISTERED" es el código exacto que devuelve nuestra propia ruta
      // (app/api/auth/signup/route.ts) cuando YA verificó, contra la base real, que el
      // correo existe — ver docs/75. Las otras dos frases quedan como respaldo por si
      // Supabase llega a rechazar el alta con su propio mensaje en algún otro caso.
      if (
        rawMessage === "EMAIL_ALREADY_REGISTERED" ||
        message.includes("already registered") ||
        message.includes("already exists")
      ) {
        setErrors({ submit: t("signup_error_email_taken") })
      } else {
        setErrors({ submit: t("signup_error_generic") })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find((c) => c.code === countryCode)
    if (country) {
      updateFormData("nationality", countryCode)
      updateFormData("currency", country.currency)
    }
  }

  if (showCheckEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
          </div>
          <Card className="border-border bg-card/95 backdrop-blur">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">{t("signup_check_email_title")}</h2>
              <p className="text-muted-foreground">{t("signup_check_email_desc")}</p>
              <p className="text-sm text-muted-foreground">{t("signup_check_email_spam_note")}</p>
              <Button onClick={() => router.push("/login")} className="w-full">
                {t("signup_login_link")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("signup_login_link")}
          </Link>
          {/* Lockup vertical, 64px: primer punto de contacto con la marca (ver docs/36). */}
          <div className="flex flex-col items-center justify-center gap-2">
            <GastrometricsLogo className="h-16 w-16" variant="brand" />
            <h1 className="text-3xl font-bold text-foreground">Gastrometrics</h1>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {t("tour_step")} {currentStep} {t("tour_of")} {totalSteps}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Card */}
        <Card className="border-border bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-2 pb-6">
            <CardTitle className="text-2xl font-bold text-foreground">
              {currentStep === 1 && t("signup_step1_title")}
              {currentStep === 2 && t("signup_step2_title")}
              {currentStep === 3 && t("signup_step3_title")}
              {currentStep === 4 && t("signup_step4_title")}
              {currentStep === 5 && t("signup_step5_title")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {currentStep === 1 && t("signup_step1_desc")}
              {currentStep === 2 && t("signup_step2_desc")}
              {currentStep === 3 && t("signup_step3_desc")}
              {currentStep === 4 && t("signup_step4_desc")}
              {currentStep === 5 && t("signup_step5_desc")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t("signup_field_full_name")}
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder={t("signup_placeholder_full_name")}
                    value={formData.fullName}
                    onChange={(e) => updateFormData("fullName", e.target.value)}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("login_email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("signup_placeholder_email")}
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {t("login_password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      className={errors.password ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  <p className="text-xs text-muted-foreground">{t("signup_password_hint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {t("signup_field_confirm_password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setErrors((prev) => ({ ...prev, confirmPassword: "" }))
                      }}
                      className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>
              </div>
            )}

            {/* Step 2: Regional Preferences */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="nationality" className="text-foreground font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t("settings_country")}
                  </Label>
                  <Select value={formData.nationality} onValueChange={handleCountryChange}>
                    <SelectTrigger className={errors.nationality ? "border-destructive" : ""}>
                      <SelectValue placeholder={t("signup_placeholder_country")} />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {t(country.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.nationality && <p className="text-sm text-destructive">{errors.nationality}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-foreground font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t("signup_field_currency")}
                  </Label>
                  <Select value={formData.currency} onValueChange={(value) => updateFormData("currency", value)}>
                    <SelectTrigger className={errors.currency ? "border-destructive" : ""}>
                      <SelectValue placeholder={t("signup_placeholder_currency")} />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.filter(
                        (country, index, self) => index === self.findIndex((c) => c.currency === country.currency),
                      ).map((country) => (
                        <SelectItem key={country.currency} value={country.currency}>
                          {country.currency} ({country.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currency && <p className="text-sm text-destructive">{errors.currency}</p>}
                  <p className="text-xs text-muted-foreground">{t("signup_currency_hint")}</p>
                </div>

                {formData.nationality && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-sm text-foreground">{t("signup_regional_summary_title")}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("settings_country")}:</span>
                        <span className="ml-2 font-medium">
                          {(() => {
                            const selected = COUNTRIES.find((c) => c.code === formData.nationality)
                            return selected ? t(selected.labelKey) : null
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("settings_currency")}:</span>
                        <span className="ml-2 font-medium">
                          {COUNTRIES.find((c) => c.code === formData.nationality)?.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Professional Information */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="space-y-3">
                  <Label className="text-foreground font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {t("signup_field_business_type")}
                  </Label>
                  <RadioGroup
                    value={formData.businessType}
                    onValueChange={(value) => updateFormData("businessType", value)}
                    className="grid grid-cols-2 gap-3"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <div key={type.value}>
                        <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" />
                        <Label
                          htmlFor={type.value}
                          className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <span className="text-2xl mb-2">{type.icon}</span>
                          <span className="text-sm font-medium text-center">{t(type.labelKey)}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {errors.businessType && <p className="text-sm text-destructive">{errors.businessType}</p>}
                </div>

                <div className="space-y-3">
                  <Label className="text-foreground font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t("signup_field_business_size")}
                  </Label>
                  <RadioGroup
                    value={formData.businessSize}
                    onValueChange={(value) => updateFormData("businessSize", value)}
                    className="space-y-2"
                  >
                    {BUSINESS_SIZES.map((size) => (
                      <div key={size.value}>
                        <RadioGroupItem value={size.value} id={size.value} className="peer sr-only" />
                        <Label
                          htmlFor={size.value}
                          className="flex items-start justify-between rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{t(size.labelKey)}</div>
                            <div className="text-sm text-muted-foreground">{t(size.descriptionKey)}</div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {errors.businessSize && <p className="text-sm text-destructive">{errors.businessSize}</p>}
                </div>

                <div className="space-y-3">
                  <Label className="text-foreground font-medium flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t("signup_field_experience")}
                  </Label>
                  <RadioGroup
                    value={formData.industryExperience}
                    onValueChange={(value) => updateFormData("industryExperience", value)}
                    className="grid grid-cols-2 gap-3"
                  >
                    {EXPERIENCE_LEVELS.map((level) => (
                      <div key={level.value}>
                        <RadioGroupItem value={level.value} id={level.value} className="peer sr-only" />
                        <Label
                          htmlFor={level.value}
                          className="flex flex-col items-start justify-center rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <span className="font-medium mb-1">{t(level.labelKey)}</span>
                          <span className="text-xs text-muted-foreground">{t(level.descriptionKey)}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {errors.industryExperience && <p className="text-sm text-destructive">{errors.industryExperience}</p>}
                </div>
              </div>
            )}

            {/* Step 4: Plan selection */}
            {currentStep === 4 && (
              <div className="space-y-3 animate-in fade-in-50 duration-300">
                {selectablePlans.map((plan) => {
                  const isSelected = selectedPlanSlug === plan.slug
                  return (
                    <button
                      key={plan.slug}
                      type="button"
                      onClick={() => setSelectedPlanSlug(plan.slug)}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-muted bg-background hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{plan.name}</span>
                            {plan.highlighted && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                {t("planes_most_chosen_badge")}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-foreground">{plan.price}</p>
                          {isSelected && (
                            <p className="text-xs text-primary font-medium">{t("signup_plan_selected_label")}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 5: Confirmation */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-in fade-in-50 duration-300">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{t("signup_almost_done_title")}</h3>
                    <p className="text-muted-foreground">{t("signup_review_subtitle")}</p>
                  </div>
                </div>

                <div className="space-y-4 bg-muted/30 rounded-lg p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("signup_review_name_label")}</p>
                      <p className="font-medium">{formData.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("signup_review_email_label")}</p>
                      <p className="font-medium text-sm">{formData.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("settings_country")}</p>
                      <p className="font-medium">
                        {(() => {
                          const selected = COUNTRIES.find((c) => c.code === formData.nationality)
                          return selected ? t(selected.labelKey) : null
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("settings_currency")}</p>
                      <p className="font-medium">{formData.currency}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("signup_field_business_type")}</p>
                      <p className="font-medium">
                        {(() => {
                          const selectedType = BUSINESS_TYPES.find((bt) => bt.value === formData.businessType)
                          return selectedType ? t(selectedType.labelKey) : ""
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("signup_review_size_label")}</p>
                      <p className="font-medium">
                        {(() => {
                          const selectedSize = BUSINESS_SIZES.find((bs) => bs.value === formData.businessSize)
                          return selectedSize ? t(selectedSize.labelKey) : ""
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("signup_review_plan_label")}</p>
                      <p className="font-medium">
                        {selectablePlans.find((p) => p.slug === selectedPlanSlug)?.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => {
                      setAcceptedTerms(checked as boolean)
                      setErrors((prev) => ({ ...prev, terms: "" }))
                    }}
                    className={errors.terms ? "border-destructive" : ""}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {t("signup_accept_terms_label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("signup_terms_intro")}{" "}
                      <Link
                        href="/terminos-de-uso"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("signup_terms_link")}
                      </Link>
                      {", "}
                      <Link
                        href="/politica-privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("signup_privacy_link")}
                      </Link>{" "}
                      {t("signup_terms_and")}{" "}
                      <Link
                        href="/aviso-de-responsabilidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("signup_liability_link")}
                      </Link>
                      .
                    </p>
                  </div>
                </div>
                {errors.terms && <p className="text-sm text-destructive">{errors.terms}</p>}

                {/* Opcional a propósito (nunca bloquea el submit, a diferencia de
                    "terms" arriba) — pedido explícito: "para que no sea tan molesto".
                    Default sin marcar; ver supabase/migrations/0022_product_updates_optin.sql. */}
                <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="productUpdates"
                    checked={productUpdatesOptIn}
                    onCheckedChange={(checked) => setProductUpdatesOptIn(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="productUpdates"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {t("signup_product_updates_label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t("signup_product_updates_desc")}</p>
                  </div>
                </div>

                {errors.submit && <p className="text-sm text-destructive text-center">{errors.submit}</p>}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1 bg-transparent">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("tour_back")}
                </Button>
              )}

              {currentStep < totalSteps ? (
                <Button type="button" onClick={handleNext} className="flex-1">
                  {t("tour_next")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !acceptedTerms}
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                      {t("signup_creating_account")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {t("signup_submit")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            {t("signup_need_help")}{" "}
            {/* BUG CORREGIDO: apuntaba a /support, una ruta que nunca existió (404) — /contacto
                es la página de soporte real de la app. */}
            <Link href="/contacto" className="text-primary hover:underline">
              {t("signup_contact_support")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
