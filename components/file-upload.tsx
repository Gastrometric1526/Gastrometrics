"use client"

import type React from "react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept: string
}

export function FileUpload({ onFileSelect, accept }: FileUploadProps) {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={accept} style={{ display: "none" }} />
      <Button onClick={handleButtonClick}>{t("ingredientes_file_select_button")}</Button>
    </div>
  )
}
