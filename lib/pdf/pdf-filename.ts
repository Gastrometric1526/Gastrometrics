/**
 * Parte del nombre de archivo de un PDF a partir de un texto del usuario (docs/208).
 * Antes cada generador dejaba solo a-z/0-9: «午餐菜单» quedaba «____» y «Déjeuner» «D_jeuner».
 * Ahora se conservan las letras y números de cualquier idioma; lo demás pasa a «_».
 */
export function safeFilePart(text: string | null | undefined, fallback = "documento"): string {
  const clean = (text ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
  return clean || fallback
}
