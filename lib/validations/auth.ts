import * as z from "zod"

export const userAuthSchema = z.object({
  email: z.string().email({ message: "Correo electrónico inválido" }),
  password: z.string().min(8, { message: "La contraseña debe tener al menos 8 caracteres" }),
})

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")

export const registrationStep1BaseSchema = z.object({
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: passwordSchema,
  confirmPassword: z.string(),
})

export const registrationStep1Schema = registrationStep1BaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  },
)

export const registrationStep2Schema = z.object({
  nationality: z.string().min(1, "Selecciona tu país"),
  currency: z.string().min(1, "Selecciona tu moneda"),
})

export const registrationStep3Schema = z.object({
  businessType: z.string().min(1, "Selecciona el tipo de negocio"),
  businessSize: z.string().min(1, "Selecciona el tamaño de tu negocio"),
  industryExperience: z.string().min(1, "Selecciona tu nivel de experiencia"),
})

export const fullRegistrationSchema = registrationStep1BaseSchema
  .merge(registrationStep2Schema)
  .merge(registrationStep3Schema)
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
