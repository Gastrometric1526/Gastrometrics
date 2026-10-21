/**
 * Enlaces públicos de la marca en un solo lugar (docs/135).
 *
 * - Trustpilot: perfil real y reclamado desde septiembre 2026 (verificado en vivo). Se
 *   puede sobreescribir con NEXT_PUBLIC_TRUSTPILOT_URL sin tocar código.
 * - Redes sociales: Instagram (@gastrometrics.app) y Facebook ya tienen su URL real por
 *   defecto (docs/161); LinkedIn, TikTok y YouTube siguen vacías hasta que existan.
 *   Las variables de entorno, si se definen, mandan sobre el valor por defecto.
 * - (Histórico) Redes sociales: vacías hasta que el dueño cree cada perfil. Al pegar la URL en la
 *   variable de entorno de Vercel correspondiente (y redesplegar), el ícono aparece solo en
 *   el pie de página del sitio público y se agrega a los datos estructurados (sameAs) que
 *   lee Google — sin cambios de código.
 */

export const TRUSTPILOT_URL = process.env.NEXT_PUBLIC_TRUSTPILOT_URL || "https://www.trustpilot.com/review/gastrometrics.org"

/**
 * Reseñas de Google (docs/173): vacío hasta que el dueño cree la ficha de Google Business
 * Profile. Al pegar el enlace «Pedir reseñas» en NEXT_PUBLIC_GOOGLE_REVIEW_URL (Vercel) y
 * redesplegar, aparece junto a Trustpilot en el bloque de opiniones y al final de la
 * calificación de la app, sin tocar código.
 */
export const GOOGLE_REVIEW_URL = (process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || "").startsWith("https://") ? process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL! : ""

export const CONTACT_EMAIL = "gastrometrics@outlook.com"

export type SocialNetwork = "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube"

export const SOCIAL_LINKS: { network: SocialNetwork; label: string; url: string }[] = (
  [
    { network: "facebook", label: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://www.facebook.com/profile.php?id=61594885361553" },
    { network: "instagram", label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/gastrometrics.app/" },
    { network: "linkedin", label: "LinkedIn", url: process.env.NEXT_PUBLIC_LINKEDIN_URL || "" },
    { network: "tiktok", label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL || "" },
    { network: "youtube", label: "YouTube", url: process.env.NEXT_PUBLIC_YOUTUBE_URL || "" },
  ] as const
).filter((link) => link.url.startsWith("https://"))
