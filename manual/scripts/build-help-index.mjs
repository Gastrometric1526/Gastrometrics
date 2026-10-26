/**
 * Índice de ayuda para el chat de soporte (docs/204): convierte el manual de usuario
 * (content/<idioma>.mjs) en public/help/manual-<idioma>.json, una entrada por sección
 * (capítulo + subtítulo + texto plano). El bot del chat busca ahí (lib/support/core.ts,
 * searchHelp) para sugerir la parte del manual que responde la duda, antes de pasarla al dueño.
 *
 * Uso: cd manual && node scripts/build-help-index.mjs   (correr después de cambiar el manual).
 */
import { mkdirSync, writeFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "..", "public", "help")
const LANGS = ["es", "en", "da", "fr", "pt", "zh"]

const strip = (s) => String(s ?? "").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

function blockText(b) {
  const [type, ...rest] = b
  switch (type) {
    case "p":
      return strip(rest[0])
    case "list":
    case "steps":
    case "chips":
      return (rest[0] || []).map(strip).join(" · ")
    case "tip":
    case "warn":
    case "info":
      return `${strip(rest[0])}: ${strip(rest[1])}`
    case "formula":
      return `${strip(rest[0])}: ${(rest[1] || []).map(strip).join(" ; ")}. ${strip(rest[2])}`
    case "example":
      return (rest[1] || []).map((r) => r.slice(0, 2).map(strip).join(" ")).join(" · ")
    case "table":
      return (rest[1] || []).map((r) => r.map(strip).join(" — ")).join(" · ")
    case "cards":
      return (rest[0] || []).map((c) => c.map(strip).join(" ")).join(" · ")
    default:
      return ""
  }
}

mkdirSync(OUT, { recursive: true })
for (const lang of LANGS) {
  const { default: m } = await import(`../content/${lang}.mjs`)
  const entries = []
  for (const ch of m.chapters) {
    let section = ch.title
    let text = [strip(ch.intro)]
    const flush = () => {
      const t = text.filter(Boolean).join(" ").trim()
      if (t) entries.push({ chapterId: ch.id, chapter: strip(ch.title), section: strip(section), text: t.slice(0, 1400) })
    }
    for (const b of ch.blocks || []) {
      if (b[0] === "h3") {
        flush()
        section = b[1]
        text = []
      } else if (b[0] !== "figure" && b[0] !== "flow") {
        text.push(blockText(b))
      }
    }
    flush()
  }
  writeFileSync(path.join(OUT, `manual-${lang}.json`), JSON.stringify(entries))
  console.log(`[${lang}] ${entries.length} secciones`)
}
