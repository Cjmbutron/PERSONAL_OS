import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresa un correo válido" }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Ingresa tu contraseña" }),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, { error: "Ingresa tu nombre" })
      .max(100, { error: "Máximo 100 caracteres" }),
    email,
    // 72 es el límite práctico de bcrypt que usa Supabase Auth.
    password: z
      .string()
      .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
      .max(72, { error: "La contraseña no puede superar 72 caracteres" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Las contraseñas no coinciden",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
