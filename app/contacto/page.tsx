"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { submitFeedback } from "@/lib/storage/feedback"
import { compressImageToDataUrl } from "@/lib/utils/image-compress"
import type { FeedbackType } from "@/types/feedback"
import { CheckCircle2, Lightbulb, MessageCircleWarning, Bug, ArrowLeft, Mail, Clock, ImagePlus, X } from "lucide-react"

// Tamaño máximo del archivo ORIGINAL que se acepta antes de comprimir — un límite
// generoso (10MB) solo para descartar de una vez algo descomunal antes de gastar tiempo
// procesándolo; compressImageToDataUrl ya reduce cualquier imagen válida a un tamaño
// razonable para localStorage.
const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024

// Buzón de sugerencias, quejas y reportes de errores — pedido explícito del dueño del
// proyecto: "deberia haber un lugar donde el usuario pueda escribir quejas y o
// sugerencias al igual que reporte de bugs". Se guarda en localStorage (mismo patrón que
// el resto de la app, ver lib/storage/feedback.ts) y el panel admin (app/admin) lo lee
// desde ahí. Accesible con o sin sesión iniciada — un usuario nuevo evaluando la app
// también puede querer reportar algo antes de registrarse.
//
// CORRECCIÓN: esta página usaba siempre el header/footer públicos (MarketingHeader),
// pensados para visitantes sin sesión — un usuario YA logueado que entraba aquí desde
// Configuración perdía la barra lateral y veía botones de "Iniciar Sesión"/"Registrarse"
// en vez de su propia navegación, lo cual se sentía como si lo hubieran deslogueado.
// Ahora el layout se elige según el estado de sesión: con sesión iniciada usa el mismo
// <Sidebar/> que el resto de la app; sin sesión, sigue usando el header/footer públicos.
const typeOptionDefs: { value: FeedbackType; labelKey: "contacto_type_sugerencia_label" | "contacto_type_queja_label" | "contacto_type_bug_label"; descKey: "contacto_type_sugerencia_desc" | "contacto_type_queja_desc" | "contacto_type_bug_desc"; icon: typeof Lightbulb }[] = [
  { value: "sugerencia", labelKey: "contacto_type_sugerencia_label", descKey: "contacto_type_sugerencia_desc", icon: Lightbulb },
  { value: "queja", labelKey: "contacto_type_queja_label", descKey: "contacto_type_queja_desc", icon: MessageCircleWarning },
  { value: "bug", labelKey: "contacto_type_bug_label", descKey: "contacto_type_bug_desc", icon: Bug },
]

export default function ContactoPage() {
  const { isLoggedIn, authChecked, user } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
  const pathname = usePathname()

  const typeOptions = typeOptionDefs.map((def) => ({
    value: def.value,
    label: t(def.labelKey),
    description: t(def.descKey),
    icon: def.icon,
  }))

  const [type, setType] = useState<FeedbackType>("sugerencia")
  const [message, setMessage] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isCompressingImage, setIsCompressingImage] = useState(false)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({
        title: t("contacto_toast_invalid_file_title"),
        description: t("contacto_toast_invalid_file_desc"),
        variant: "destructive",
      })
      return
    }

    if (file.size > MAX_IMAGE_FILE_BYTES) {
      toast({
        title: t("contacto_toast_too_large_title"),
        description: t("contacto_toast_too_large_desc"),
        variant: "destructive",
      })
      return
    }

    setIsCompressingImage(true)
    try {
      const compressed = await compressImageToDataUrl(file)
      setImageDataUrl(compressed)
    } catch (error) {
      console.error("Error comprimiendo la imagen:", error)
      toast({
        title: t("contacto_toast_image_error_title"),
        description: t("contacto_toast_image_error_desc"),
        variant: "destructive",
      })
    } finally {
      setIsCompressingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      toast({
        title: t("contacto_toast_missing_message_title"),
        description: t("contacto_toast_missing_message_desc"),
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const submittedType = type
      const submittedMessage = message
      const submittedUserName = isLoggedIn ? user?.name : name
      const submittedUserEmail = isLoggedIn ? user?.email : email

      submitFeedback({
        type: submittedType,
        message: submittedMessage,
        userName: submittedUserName,
        userEmail: submittedUserEmail,
        page: pathname,
        imageDataUrl: imageDataUrl || undefined,
      })
      setSubmitted(true)
      setImageDataUrl(null)
      toast({
        title: t("contacto_toast_thanks_title"),
        description: t("contacto_toast_thanks_desc"),
      })

      // Best-effort: el mensaje YA quedó guardado arriba sin importar esto. Si el
      // correo de notificación no está configurado (RESEND_API_KEY) o falla, la
      // persona que escribió no ve ningún error — solo deja de llegar el aviso
      // en tiempo real, el mensaje sigue disponible en /admin.
      fetch("/api/notify-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: submittedType,
          message: submittedMessage,
          userName: submittedUserName,
          userEmail: submittedUserEmail,
          page: pathname,
        }),
      }).catch(() => {})
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authChecked) {
    return null
  }

  const content = (
    <div className="max-w-2xl mx-auto">
      {!isLoggedIn && (
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-4xl font-bold text-foreground">{t("contacto_page_title")}</h1>
          <p className="text-lg text-muted-foreground">{t("contacto_page_subtitle")}</p>
        </div>
      )}
      {isLoggedIn && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{t("contacto_page_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("contacto_page_subtitle")}</p>
        </div>
      )}

      {submitted ? (
        <Card>
          <CardContent className="flex flex-col items-center text-center gap-4 py-12">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">{t("contacto_sent_title")}</h2>
              <p className="text-muted-foreground">{t("contacto_sent_body")}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setMessage("")
              }}
            >
              {t("contacto_send_another")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("contacto_form_title")}</CardTitle>
            <CardDescription>{t("contacto_form_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>{t("contacto_type_label")}</Label>
                <RadioGroup
                  value={type}
                  onValueChange={(v) => setType(v as FeedbackType)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {typeOptions.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`type-${option.value}`}
                      className={`flex flex-col gap-2 rounded-lg border p-4 cursor-pointer transition-colors ${
                        type === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={option.value} id={`type-${option.value}`} />
                        <option.icon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">{option.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {!isLoggedIn && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">{t("contacto_name_label")}</Label>
                    <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("contacto_name_placeholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">{t("contacto_email_label")}</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("contacto_email_placeholder")}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contact-message">{t("contacto_message_label")}</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("contacto_message_placeholder")}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-image">{t("contacto_image_label")}</Label>
                {imageDataUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={imageDataUrl || "/placeholder.svg"}
                      alt={t("contacto_image_alt")}
                      className="max-h-40 rounded-lg border border-border object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setImageDataUrl(null)}
                      aria-label={t("contacto_image_remove_aria")}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Label
                    htmlFor="contact-image"
                    className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {isCompressingImage ? t("contacto_image_processing") : t("contacto_image_attach")}
                  </Label>
                )}
                <input
                  id="contact-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isCompressingImage}
                  className="sr-only"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || isCompressingImage}>
                {isSubmitting ? t("contacto_submit_sending") : t("contacto_submit_send")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary shrink-0" />
          <span>
            {t("contacto_prefer_direct")}{" "}
            <a href="mailto:GastroMetrics@outlook.com" className="text-primary hover:underline">
              GastroMetrics@outlook.com
            </a>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span>{t("contacto_response_time")}</span>
        </div>
      </div>
    </div>
  )

  if (isLoggedIn) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-4">
                  <ArrowLeft className="h-4 w-4" />
                  {t("common_back")}
                </Button>
              </Link>
              {content}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />
      <main className="container mx-auto px-4 py-16 flex-1">{content}</main>
      <MarketingFooter />
    </div>
  )
}
