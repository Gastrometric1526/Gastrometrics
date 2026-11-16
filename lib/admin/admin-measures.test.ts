/**
 * Medidas de /admin (docs/317, revisadas otra vez en docs/325 por pedido del dueño): texto que
 * se lee ≥ 12 px (solo burbujas de números y gráficos a 11 px), sin mayúsculas forzadas,
 * botones tocables de al menos 36 px de alto y selectores a todo el ancho en el celular.
 * Revisa el código de todo components/admin y app/admin para que no vuelva a pasar.
 */

import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"

const ROOTS = ["components/admin", "app/admin"]
const files: string[] = []
const walk = (dir: string) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full)
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) files.push(full)
  }
}
ROOTS.forEach((r) => walk(path.resolve(r)))

/** Archivos donde los 11 px son burbujas de números o etiquetas de gráficos. */
const ELEVEN_PX_OK = ["space-nav.tsx", "support-inbox.tsx", "space-view.tsx", "notifications-bell.tsx", "account-insights.tsx"]

const offenders = (test: (line: string, file: string) => boolean) =>
  files.flatMap((f) =>
    fs
      .readFileSync(f, "utf8")
      .split(/\r?\n/)
      .map((line, i) => ({ f: path.relative(process.cwd(), f), n: i + 1, line }))
      .filter(({ line }) => test(line, f))
      .map(({ f, n }) => `${f}:${n}`),
  )

describe("medidas de /admin (docs/317, docs/325)", () => {
  it("encuentra los archivos", () => expect(files.length).toBeGreaterThan(30))

  it("sin texto de menos de 11 px, y 11 px solo en burbujas y gráficos", () => {
    expect(offenders((l) => /text-\[(8|9|10)px\]/.test(l))).toEqual([])
    expect(offenders((l, f) => /text-\[11px\]/.test(l) && !ELEVEN_PX_OK.includes(path.basename(f)))).toEqual([])
  })

  it("sin mayúsculas forzadas", () => {
    expect(offenders((l) => /\buppercase\b/.test(l))).toEqual([])
  })

  it("botones de al menos 36 px de alto", () => {
    // El className puede ir en otra línea: se mira cada <Button …> completo.
    const small = files.flatMap((f) =>
      [...fs.readFileSync(f, "utf8").matchAll(/<Button\b[^>]*?className="([^"]*)"/g)]
        .filter((m) => /\bh-(5|6|7|8)\b/.test(m[1]))
        .map((m) => `${path.basename(f)}: ${m[1]}`),
    )
    expect(small).toEqual([])
  })

  it("selectores de ancho fijo ocupan todo el ancho en el celular", () => {
    expect(offenders((l) => /<SelectTrigger\b/.test(l) && /className="[^"]*\bw-\[/.test(l) && !/\bw-full\b/.test(l))).toEqual([])
  })
})
