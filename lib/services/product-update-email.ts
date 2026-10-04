/**
 * Cuerpo del correo de novedades (docs/142) — puro, lo usa
 * app/api/admin/product-update-email/route.ts y lo cubre product-update-email.test.ts.
 *
 * Todo sale en el idioma de quien lo recibe (profiles.preferred_language): los textos
 * fijos de la plantilla (getEmailLabels) y cada entrada del changelog (su `content[lang]`,
 * con español como respaldo si una entrada no tuviera ese idioma).
 */

import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getEmailLabels, type EmailLang } from "@/lib/i18n/email-labels"
import type { ChangelogEntry } from "@/lib/changelog"
import { withEmailTracking } from "@/lib/email-tracking"

const FONT = "font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"

export function buildChangelogItemsHtml(entries: ChangelogEntry[], language: EmailLang): string {
  const withTitles = entries.length > 1
  return entries
    .map((entry) => {
      const content = entry.content[language] || entry.content.es
      const title = withTitles
        ? `<tr><td style="${FONT};font-size:15px;line-height:1.4;font-weight:700;color:#1A1512;padding:8px 0 10px">${escapeHtml(content.title)}</td></tr>`
        : ""
      const items = content.items
        .map(
          (item) =>
            `<tr><td style="${FONT};font-size:14.5px;line-height:1.55;color:#3A332E;padding:0 0 12px 22px">&bull;&nbsp; ${escapeHtml(item)}</td></tr>`,
        )
        .join("")
      return title + items
    })
    .join("")
}

export function renderProductUpdateEmail(input: {
  entries: ChangelogEntry[]
  language: EmailLang
  siteUrl: string
}): { subject: string; html: string } {
  const labels = getEmailLabels(input.language)
  const html = renderEmailTemplate("08-novedades.html", {
    htmlLang: input.language,
    title: labels.e08_title,
    preheader: labels.e08_preheader,
    heading: labels.e08_heading,
    itemsHtml: buildChangelogItemsHtml(input.entries, input.language),
    cta: labels.e08_cta,
    ctaUrl: withEmailTracking(`${input.siteUrl}/dashboard`, "product_update"),
    footnote: labels.e08_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e08_footer2,
  })
  return { subject: labels.e08_subject, html }
}
