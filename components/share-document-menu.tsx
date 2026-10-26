"use client"

/**
 * Botón «Enviar / Descargar» para documentos (docs/202): la lista MEP y las órdenes de compra.
 * Pedido del dueño: mandar por WhatsApp o por correo y que el PDF se pueda descargar siempre.
 *
 * - «Compartir…» (solo donde el aparato lo permite, sobre todo celulares): abre el menú del
 *   sistema con el PDF adjunto — sirve para mandarlo directo por WhatsApp, correo, etc.
 * - «Descargar PDF» e «Imprimir».
 * - «WhatsApp»: abre WhatsApp con la lista en texto; la persona elige el chat.
 * - «Correo»: descarga el PDF y abre la app de correo con asunto y mensaje listos; la persona
 *   elige a quién mandarlo y adjunta el PDF.
 */

import { useEffect, useState } from "react"
import type { jsPDF } from "jspdf"
import { ChevronDown, Download, Mail, MessageCircle, Printer, Send, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { mailtoUrl, whatsappUrl } from "@/lib/share-text"

interface Props {
  /** Arma el PDF al momento (con los datos de ese instante). */
  buildPdf: () => jsPDF | Promise<jsPDF>
  filename: string
  /** Texto para WhatsApp / cuerpo del correo. */
  shareText: () => string
  subject: string
  /** Sin permiso de PDF (miembro de equipo sin PDF): solo WhatsApp. */
  pdfAllowed?: boolean
  label?: string
  size?: "sm" | "default"
  variant?: "default" | "outline"
  className?: string
  disabled?: boolean
  /** data-tour del botón (tutoriales). */
  tourId?: string
}

function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || !navigator.canShare) return false
    const probe = new File([new Blob(["%PDF"], { type: "application/pdf" })], "x.pdf", { type: "application/pdf" })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export function ShareDocumentMenu({
  buildPdf,
  filename,
  shareText,
  subject,
  pdfAllowed = true,
  label,
  size = "sm",
  variant = "default",
  className = "",
  disabled = false,
  tourId,
}: Props) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [nativeShare, setNativeShare] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => setNativeShare(canShareFiles()), [])

  const makeBlob = async (): Promise<Blob | null> => {
    try {
      const doc = await buildPdf()
      return doc.output("blob") as Blob
    } catch (error) {
      console.error("[share-document-menu] No se pudo generar el PDF:", error)
      toast({ title: t("share_error_title"), description: t("share_error_desc"), variant: "destructive" })
      return null
    }
  }

  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const onNativeShare = () =>
    run(async () => {
      const blob = await makeBlob()
      if (!blob) return
      const file = new File([blob], filename, { type: "application/pdf" })
      try {
        await navigator.share({ files: [file], title: subject, text: subject })
      } catch (error) {
        // Cancelar el menú del sistema no es un error.
        if ((error as DOMException)?.name !== "AbortError") download(blob)
      }
    })

  const onDownload = () =>
    run(async () => {
      const blob = await makeBlob()
      if (!blob) return
      download(blob)
      toast({ title: t("share_toast_downloaded") })
    })

  const onPrint = () =>
    run(async () => {
      const blob = await makeBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const frame = document.createElement("iframe")
      frame.style.position = "fixed"
      frame.style.width = "0"
      frame.style.height = "0"
      frame.style.border = "0"
      frame.src = url
      frame.onload = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
        } catch {
          window.open(url, "_blank")
        }
        setTimeout(() => {
          frame.remove()
          URL.revokeObjectURL(url)
        }, 60_000)
      }
      document.body.appendChild(frame)
    })

  const onWhatsApp = () => {
    window.open(whatsappUrl(shareText()), "_blank", "noopener,noreferrer")
  }

  const onEmail = () =>
    run(async () => {
      if (pdfAllowed) {
        const blob = await makeBlob()
        if (blob) download(blob)
      }
      window.location.href = mailtoUrl(subject, `${shareText()}${pdfAllowed ? `\n\n${t("share_email_attach_note")}` : ""}`)
      if (pdfAllowed) toast({ title: t("share_toast_email_title"), description: t("share_toast_email_desc") })
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className={`gap-2 ${className}`} disabled={disabled || busy} data-tour={tourId}>
          <Send className="h-4 w-4" />
          {label ?? t("share_button")}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("share_menu_label")}</DropdownMenuLabel>
        {pdfAllowed && nativeShare && (
          <DropdownMenuItem onClick={onNativeShare} className="gap-2 py-2.5">
            <Share2 className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">{t("share_native")}</p>
              <p className="text-xs text-muted-foreground">{t("share_native_hint")}</p>
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onWhatsApp} className="gap-2 py-2.5">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          <div>
            <p className="font-medium">{t("share_whatsapp")}</p>
            <p className="text-xs text-muted-foreground">{t("share_whatsapp_hint")}</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEmail} className="gap-2 py-2.5">
          <Mail className="h-4 w-4" />
          <div>
            <p className="font-medium">{t("share_email")}</p>
            <p className="text-xs text-muted-foreground">{pdfAllowed ? t("share_email_hint") : t("share_email_hint_text")}</p>
          </div>
        </DropdownMenuItem>
        {pdfAllowed && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" />
              {t("share_download_pdf")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" />
              {t("share_print")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
