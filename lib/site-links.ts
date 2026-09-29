/**
 * Enlaces públicos de la marca en un solo lugar (docs/135).
 *
 * - Trustpilot: perfil real y reclamado desde septiembre 2026 (verificado en vivo). Se
 *   puede sobreescribir con NEXT_PUBLIC_TRUSTPILOT_URL sin tocar código.
 * - Redes sociales: vacías hasta que el dueño cree cada perfil. Al pegar la URL en la
 *   variable de entorno de Vercel correspondiente (y redesplegar), el ícono aparece solo en
 *   el pie de página del sitio público y se agrega a los datos estructurados (sameAs) que
 *   lee Google — sin cambios de código.
 */

export const TRUSTPILOT_URL = process.env.NEXT_PUBLIC_TRUSTPILOT_URL || "https://www.trustpilot.com/review/gastrometrics.org"

export const CONTACT_EMAIL = "gastrometrics@outlook.com"

export type SocialNetwork = "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube"

export const SOCIAL_LINKS: { network: SocialNetwork; label: string; url: string }[] = (
  [
    { network: "facebook", label: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL || "" },
    { network: "instagram", label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "" },
    { network: "linkedin", label: "LinkedIn", url: process.env.NEXT_PUBLIC_LINKEDIN_URL || "" },
    { network: "tiktok", label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL || "" },
    { network: "youtube", label: "YouTube", url: process.env.NEXT_PUBLIC_YOUTUBE_URL || "" },
  ] as const
).filter((link) => link.url.startsWith("https://"))
