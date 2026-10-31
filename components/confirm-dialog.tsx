"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/contexts/language-context"

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
}

/**
 * Pregunta «¿Seguro?» con la ventana de la app en vez de `window.confirm` (docs/218): el
 * confirm nativo no sigue el diseño ni el idioma de los botones, se ve mal en el celular y
 * en la app instalada, y bloquea la página entera mientras está abierto.
 *
 * Uso: `const [confirm, confirmDialog] = useConfirmDialog()`; `if (await confirm(texto))`;
 * y renderizar `{confirmDialog}` una vez en la pantalla.
 */
export function useConfirmDialog(): [(message: string, options?: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const { t } = useLanguage()
  const [state, setState] = useState<{ message: string; options: ConfirmOptions } | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setState({ message, options })
    })
  }, [])

  const finish = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setState(null)
  }

  const dialog = (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && finish(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.options.title ?? t("confirm_dialog_title")}</AlertDialogTitle>
          <AlertDialogDescription>{state?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>{state?.options.cancelLabel ?? t("common_cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>{state?.options.confirmLabel ?? t("confirm_dialog_ok")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return [confirm, dialog]
}
