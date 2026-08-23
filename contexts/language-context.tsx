"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { SUPPORTED_LANGUAGES, translate, type LanguageCode } from "@/lib/i18n/translations"

interface LanguageContextType {
  language: LanguageCode
  setLanguage: (lang: LanguageCode) => void
  t: (key: Parameters<typeof translate>[1]) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = "app_language"

function getBrowserDefaultLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return "es"
  const browserLang = navigator.language.slice(0, 2).toLowerCase()
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang)
  return match ? (match.code as LanguageCode) : "es"
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("es")

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode | null
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      setLanguageState(saved)
    } else {
      // BUG CORREGIDO: el idioma detectado del navegador nunca se guardaba en
      // localStorage hasta que el usuario abría Configuración y lo elegía a mano.
      // La UI (que lee este estado de React) mostraba el idioma correcto desde el
      // primer segundo, pero los PDFs (lib/i18n/pdf-labels.ts) leen localStorage
      // directo, sin pasar por este contexto — así que salían en español hasta que
      // el usuario tocara Configuración, aunque la pantalla ya estuviera en otro
      // idioma. Se persiste aquí para que ambos queden consistentes de inmediato.
      const detected = getBrowserDefaultLanguage()
      setLanguageState(detected)
      localStorage.setItem(LANGUAGE_STORAGE_KEY, detected)
    }
  }, [])

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  }, [])

  const t = useCallback((key: Parameters<typeof translate>[1]) => translate(language, key), [language])

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
