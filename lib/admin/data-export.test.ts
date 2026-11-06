import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import {
  EXPORT_SOURCES,
  EXPORT_TABLES,
  exportReadme,
  isIncomplete,
  pick,
  rowsThatFit,
  rowsToCsv,
  withoutHiddenColumns,
} from "./data-export"

describe("exportación completa de /admin", () => {
  it("incluye todas las tablas de las migraciones", () => {
    const dir = path.join(process.cwd(), "supabase/migrations")
    const sql = fs
      .readdirSync(dir)
      .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
      .join("\n")
    const tables = new Set([...sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi)].map((m) => m[1]))
    const exported = new Set(EXPORT_TABLES.map((t) => t.name))
    expect([...tables].filter((t) => !exported.has(t))).toEqual([])
  })

  it("no repite fuentes", () => {
    expect(new Set(EXPORT_SOURCES).size).toBe(EXPORT_SOURCES.length)
  })

  it("quita el token de las invitaciones", () => {
    const rows = withoutHiddenColumns("business_invites", [{ token: "secreto", business_id: "b1" }])
    expect(rows).toEqual([{ business_id: "b1" }])
    expect(withoutHiddenColumns("recipes", [{ token: "dato" }])).toEqual([{ token: "dato" }])
  })

  it("copia solo los campos pedidos", () => {
    expect(pick({ id: "1", password: "x" }, ["id", "email"])).toEqual({ id: "1" })
  })

  it("recorta la página por peso, sin dejarla vacía", () => {
    const rows = [{ a: "x".repeat(50) }, { a: "x".repeat(50) }, { a: "x".repeat(50) }]
    expect(rowsThatFit(rows, 10_000)).toBe(3)
    expect(rowsThatFit(rows, 130)).toBe(2)
    expect(rowsThatFit(rows, 5)).toBe(1)
  })

  it("el CSV junta todas las columnas y guarda los objetos como JSON", () => {
    const csv = rowsToCsv([{ a: 1 }, { b: { c: 2 } }, { a: 'di "hola", ya' }])
    expect(csv).toBe('﻿a,b\r\n1,\r\n,"{""c"":2}"\r\n"di ""hola"", ya",')
  })

  it("el CSV desactiva fórmulas en textos, no en números", () => {
    expect(rowsToCsv([{ a: "=1+1", b: -5 }])).toBe("﻿a,b\r\n'=1+1,-5")
  })

  it("marca lo incompleto en el LEEME", () => {
    const ok = { source: "recipes", rows: 3, total: 3, error: null }
    const short = { source: "menus", rows: 1, total: 2, error: null }
    const failed = { source: "stripe_invoices", rows: 0, total: null, error: "HTTP 500" }
    expect(isIncomplete(ok)).toBe(false)
    expect(isIncomplete(short)).toBe(true)
    expect(exportReadme([ok], "06/11/2026")).toContain("Estado: completa")
    const text = exportReadme([ok, short, failed], "06/11/2026")
    expect(text).toContain("Estado: INCOMPLETA. Revisa 2 fuente(s)")
    expect(text).toContain("menus | 1 | INCOMPLETA: había 2")
    expect(text).toContain("stripe_invoices | 0 | ERROR: HTTP 500")
  })
})
