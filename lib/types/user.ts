// Tipo-solo: usado únicamente para tipar labelKey/descriptionKey abajo contra las
// claves reales del diccionario de i18n, sin importar código en tiempo de ejecución
// ni tocar lib/i18n/translations.ts.
import type translationsDict from "@/lib/i18n/translations"
type TranslationKey = keyof (typeof translationsDict)["es"]

export interface UserProfile {
  id: string
  fullName: string
  email: string
  createdAt: string
  nationality: string
  currency: string
  businessType: string
  businessSize: string
  industryExperience: string
  emailVerified: boolean
  onboardingCompleted: boolean
}

export interface UserRegistrationData {
  fullName: string
  email: string
  password: string
  nationality: string
  currency: string
  businessType: string
  businessSize: string
  industryExperience: string
}

export const COUNTRIES = [
  { code: "MX", name: "México", currency: "MXN", symbol: "$" },
  { code: "US", name: "Estados Unidos", currency: "USD", symbol: "$" },
  { code: "ES", name: "España", currency: "EUR", symbol: "€" },
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "$" },
  { code: "CO", name: "Colombia", currency: "COP", symbol: "$" },
  { code: "CL", name: "Chile", currency: "CLP", symbol: "$" },
  { code: "PE", name: "Perú", currency: "PEN", symbol: "S/" },
  { code: "EC", name: "Ecuador", currency: "USD", symbol: "$" },
  { code: "VE", name: "Venezuela", currency: "VES", symbol: "Bs" },
  { code: "BR", name: "Brasil", currency: "BRL", symbol: "R$" },
  { code: "UY", name: "Uruguay", currency: "UYU", symbol: "$" },
  { code: "PY", name: "Paraguay", currency: "PYG", symbol: "₲" },
  { code: "BO", name: "Bolivia", currency: "BOB", symbol: "Bs" },
  { code: "CR", name: "Costa Rica", currency: "CRC", symbol: "₡" },
  { code: "PA", name: "Panamá", currency: "PAB", symbol: "B/." },
  { code: "GT", name: "Guatemala", currency: "GTQ", symbol: "Q" },
  { code: "HN", name: "Honduras", currency: "HNL", symbol: "L" },
  { code: "SV", name: "El Salvador", currency: "USD", symbol: "$" },
  { code: "NI", name: "Nicaragua", currency: "NIO", symbol: "C$" },
  { code: "DO", name: "República Dominicana", currency: "DOP", symbol: "RD$" },
]

// labelKey/descriptionKey son claves del diccionario de i18n (lib/i18n/translations.ts),
// no texto literal. El consumidor (app/signup/page.tsx) debe resolverlas con t().
export const BUSINESS_TYPES: { value: string; labelKey: TranslationKey; icon: string }[] = [
  { value: "restaurant", labelKey: "signup_business_type_restaurant_label", icon: "🍽️" },
  { value: "cafe", labelKey: "signup_business_type_cafe_label", icon: "☕" },
  { value: "bakery", labelKey: "signup_business_type_bakery_label", icon: "🥖" },
  { value: "catering", labelKey: "signup_business_type_catering_label", icon: "🎉" },
  { value: "food_truck", labelKey: "signup_business_type_food_truck_label", icon: "🚚" },
  { value: "bar", labelKey: "signup_business_type_bar_label", icon: "🍺" },
  { value: "hotel", labelKey: "signup_business_type_hotel_label", icon: "🏨" },
  { value: "cloud_kitchen", labelKey: "signup_business_type_cloud_kitchen_label", icon: "☁️" },
  { value: "personal_chef", labelKey: "signup_business_type_personal_chef_label", icon: "👨‍🍳" },
  { value: "other", labelKey: "signup_business_type_other_label", icon: "🍴" },
]

export const BUSINESS_SIZES: { value: string; labelKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { value: "solo", labelKey: "signup_business_size_solo_label", descriptionKey: "signup_business_size_solo_desc" },
  { value: "small", labelKey: "signup_business_size_small_label", descriptionKey: "signup_business_size_small_desc" },
  {
    value: "medium",
    labelKey: "signup_business_size_medium_label",
    descriptionKey: "signup_business_size_medium_desc",
  },
  { value: "large", labelKey: "signup_business_size_large_label", descriptionKey: "signup_business_size_large_desc" },
]

export const EXPERIENCE_LEVELS: { value: string; labelKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  {
    value: "beginner",
    labelKey: "signup_experience_beginner_label",
    descriptionKey: "signup_experience_beginner_desc",
  },
  {
    value: "intermediate",
    labelKey: "signup_experience_intermediate_label",
    descriptionKey: "signup_experience_intermediate_desc",
  },
  {
    value: "experienced",
    labelKey: "signup_experience_experienced_label",
    descriptionKey: "signup_experience_experienced_desc",
  },
  { value: "expert", labelKey: "signup_experience_expert_label", descriptionKey: "signup_experience_expert_desc" },
]
