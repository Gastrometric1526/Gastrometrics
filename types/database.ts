/**
 * Tipos de la base de datos de Supabase — reflejan 1 a 1 el esquema real, resultado
 * de aplicar supabase/migrations/0001_init.sql en adelante, en orden (0001 → 0005 a la
 * fecha de este archivo). Ver docs/12-guia-backend.md y docs/52.
 *
 * businesses/ingredients/recipes/recipes_trash/inventory_items/inventory_snapshots/
 * menus/purchase_orders guardan solo un puñado de columnas reales (id, business_id,
 * owner_id, nombre, fechas — lo que hace falta para RLS/índices/orden) y el resto del
 * objeto completo (tal como lo define types/ingredient.ts, types/recipe.ts, etc.) en
 * una columna `data jsonb` — ver 0005_ids_as_text.sql para el porqué. `Data` de cada
 * tabla abajo es un `Record<string, unknown>` a propósito: el mapeo real hacia/desde el
 * tipo de dominio (Ingredient, Recipe, ...) vive en lib/storage/*.ts, no aquí.
 *
 * Escrito a mano en vez de generado con `supabase gen types` — cuando se quiera
 * regenerar contra el proyecto real:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 * (había que fusionar a mano el resultado con los comentarios de este archivo).
 */

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          created_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["businesses"]["Row"], "created_at" | "data"> & {
          created_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["businesses"]["Row"]>
        Relationships: never[]
      }
      business_members: {
        Row: {
          business_id: string
          user_id: string
          role: string
          invited_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["business_members"]["Row"], "invited_at"> & {
          invited_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["business_members"]["Row"]>
        Relationships: never[]
      }
      business_invites: {
        Row: {
          token: string
          business_id: string
          role: string
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["business_invites"]["Row"], "created_at" | "token"> & {
          token?: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["business_invites"]["Row"]>
        Relationships: never[]
      }
      ingredients: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          name: string
          category: string
          created_at: string
          updated_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["ingredients"]["Row"], "created_at" | "updated_at" | "data"> & {
          created_at?: string
          updated_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["ingredients"]["Row"]>
        Relationships: never[]
      }
      recipes: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          name: string
          classification: string
          is_sub_recipe: boolean
          created_at: string
          updated_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<
          Database["public"]["Tables"]["recipes"]["Row"],
          "created_at" | "updated_at" | "data" | "is_sub_recipe"
        > & {
          created_at?: string
          updated_at?: string
          data?: Record<string, unknown>
          is_sub_recipe?: boolean
        }
        Update: Partial<Database["public"]["Tables"]["recipes"]["Row"]>
        Relationships: never[]
      }
      recipes_trash: {
        Row: {
          id: string
          recipe_id: string
          business_id: string | null
          owner_id: string
          deleted_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["recipes_trash"]["Row"], "deleted_at" | "data"> & {
          deleted_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["recipes_trash"]["Row"]>
        Relationships: never[]
      }
      inventory_items: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          updated_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["inventory_items"]["Row"], "updated_at" | "data"> & {
          updated_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]>
        Relationships: never[]
      }
      inventory_snapshots: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          date: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["inventory_snapshots"]["Row"], "date" | "data"> & {
          date?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["inventory_snapshots"]["Row"]>
        Relationships: never[]
      }
      menus: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          name: string
          created_at: string
          updated_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["menus"]["Row"], "created_at" | "updated_at" | "data"> & {
          created_at?: string
          updated_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["menus"]["Row"]>
        Relationships: never[]
      }
      purchase_orders: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          created_at: string
          data: Record<string, unknown>
        }
        Insert: Omit<Database["public"]["Tables"]["purchase_orders"]["Row"], "created_at" | "data"> & {
          created_at?: string
          data?: Record<string, unknown>
        }
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]>
        Relationships: never[]
      }
      account_plans: {
        Row: {
          account_id: string
          plan_slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: Omit<
          Database["public"]["Tables"]["account_plans"]["Row"],
          "updated_at" | "stripe_customer_id" | "stripe_subscription_id"
        > & {
          updated_at?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["account_plans"]["Row"]>
        Relationships: never[]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          nationality: string
          currency: string
          business_type: string
          business_size: string
          industry_experience: string
          email_verified: boolean
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at"> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>
        Relationships: never[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
