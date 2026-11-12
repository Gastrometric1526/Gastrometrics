import { describe, expect, it } from "vitest"
import translations, { type LanguageCode, type TranslationKey } from "@/lib/i18n/translations"
import { ADMIN_SECTIONS, ADMIN_TABS, ADMIN_TASKS, HOME_AREAS, QUICK_TASKS, howToSteps, isAdminTab, resolveAdminTab, searchAdmin, taskSteps } from "@/lib/admin/nav"
import { NOTICE_TARGET } from "@/lib/admin/notifications"

const LANGS = Object.keys(translations) as LanguageCode[]
const tFor = (lang: LanguageCode) => (key: TranslationKey) => (translations[lang] as Record<string, string>)[key] ?? `MISSING:${key}`

describe("mapa de /admin (docs/279, docs/281)", () => {
  it("el Inicio tiene una tarjeta por área (todas menos el Inicio y la Guía), sin repetir", () => {
    expect(new Set(HOME_AREAS).size).toBe(HOME_AREAS.length)
    expect([...HOME_AREAS].sort()).toEqual(ADMIN_TABS.filter((t) => t !== "resumen" && t !== "guia").sort())
    for (const id of HOME_AREAS) expect(ADMIN_SECTIONS[id].short, id).toBeTruthy()
  })

  it("las direcciones viejas siguen abriendo su lugar (?tab=uso → Crecimiento y uso)", () => {
    expect(resolveAdminTab("uso")).toBe("crecimiento")
    expect(resolveAdminTab("buzon")).toBe("buzon")
    expect(resolveAdminTab("nada")).toBeNull()
    expect(resolveAdminTab(null)).toBeNull()
    // Los bloques que antes estaban en «Uso de la app» siguen existiendo dentro del área.
    for (const sub of ["embudo", "correos", "importaciones"]) expect(ADMIN_SECTIONS.crecimiento.subs?.some((s) => s.id === sub)).toBe(true)
  })

  it("los avisos (NOTICE_TARGET) llevan a áreas y bloques que existen", () => {
    for (const target of Object.values(NOTICE_TARGET)) {
      expect(isAdminTab(target.tab)).toBe(true)
      if (target.sub) expect(ADMIN_SECTIONS[target.tab as keyof typeof ADMIN_SECTIONS].subs?.some((s) => s.id === target.sub)).toBe(true)
    }
  })

  it("cada tarea lleva a un bloque que existe y los accesos rápidos son tareas reales", () => {
    for (const task of ADMIN_TASKS) {
      if (task.sub) expect(ADMIN_SECTIONS[task.tab].subs?.some((s) => s.id === task.sub)).toBe(true)
    }
    for (const id of QUICK_TASKS) expect(ADMIN_TASKS.some((x) => x.id === id)).toBe(true)
  })

  it.each(LANGS)("en %s todos los textos existen y no quedan marcas {…} sin cambiar", (lang) => {
    const t = tFor(lang)
    const texts: string[] = []
    for (const tab of ADMIN_TABS) {
      const s = ADMIN_SECTIONS[tab]
      texts.push(t(s.label), t(s.desc), ...howToSteps(s, t))
      if (s.short) texts.push(t(s.short))
      for (const sub of s.subs ?? []) texts.push(t(sub.label), t(sub.desc))
    }
    for (const task of ADMIN_TASKS) texts.push(t(task.title), ...taskSteps(task, t))
    for (const text of texts) {
      expect(text).not.toMatch(/MISSING:/)
      expect(text).not.toMatch(/\{[a-z]+\}/)
      expect(text.trim().length).toBeGreaterThan(0)
    }
  })

  it("los pasos nombran las áreas nuevas (Personas → Todas las cuentas)", () => {
    const t = tFor("es")
    const plan = ADMIN_TASKS.find((x) => x.id === "plan")!
    expect(taskSteps(plan, t)[0]).toContain("Personas → Todas las cuentas")
  })

  it("el buscador encuentra la tarea y el área por palabras sueltas y sin tildes", () => {
    const t = tFor("es")
    const backup = searchAdmin("restaurar respaldo", t)
    expect(backup[0]).toMatchObject({ kind: "task", tab: "cuentas" })
    const chat = searchAdmin("chat", t)
    expect(chat.some((r) => r.kind === "task" && r.task.id === "chat")).toBe(true)
    expect(searchAdmin("guia", t).some((r) => r.kind === "section" && r.tab === "guia")).toBe(true)
    expect(searchAdmin("dinero", t).some((r) => r.kind === "section" && r.tab === "ingresos")).toBe(true)
    expect(searchAdmin("x", t)).toEqual([])
    expect(searchAdmin("zzzz palabra inexistente", t)).toEqual([])
  })
})
