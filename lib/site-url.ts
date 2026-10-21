// Dirección pública "oficial" del sitio para buscadores (docs/176): sitemap, robots.txt,
// canonical, hreflang y datos estructurados. Vercel sirve el sitio en www y redirige
// gastrometrics.org → www (308); si estas direcciones dijeran gastrometrics.org, Google las
// marcaría como «página con redirección». NEXT_PUBLIC_SITE_URL se deja como está porque
// la usan los enlaces de los correos y de Supabase Auth (que sí siguen la redirección).
// Si algún día el principal en Vercel pasa a ser gastrometrics.org, basta con poner
// NEXT_PUBLIC_CANONICAL_URL=https://gastrometrics.org en Vercel.

const APEX = "https://gastrometrics.org"
const WWW = "https://www.gastrometrics.org"

export function resolveCanonicalSiteUrl(canonicalEnv: string | undefined, siteEnv: string | undefined): string {
  const explicit = canonicalEnv?.trim()
  if (explicit) return explicit.replace(/\/+$/, "")
  const base = (siteEnv?.trim() || WWW).replace(/\/+$/, "")
  return base === APEX ? WWW : base
}

export function canonicalSiteUrl(): string {
  return resolveCanonicalSiteUrl(process.env.NEXT_PUBLIC_CANONICAL_URL, process.env.NEXT_PUBLIC_SITE_URL)
}
