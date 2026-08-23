/**
 * Tipos de la base de datos de Supabase — reflejan 1 a 1 el esquema de
 * supabase/migrations/0001_init.sql (que a su vez viene de los `interface`
 * ya existentes en types/*.ts, ver docs/12-guia-backend.md).
 *
 * Escritos a mano en vez de generados con `supabase gen types` porque este
 * entorno no tiene un proyecto de Supabase real todavía contra el cual
 * generar — cuando exista, correr:
 *   npx supabase gen types typescript --project-id <id> > types/database.ts
 * y este archivo se reemplaza automáticamente, sin tocar el resto del código
 * (todo lo que lo usa importa el alias `Database`, no estas filas directo).
 */

import type { BusinessExpenses, PricingMethod } from "./business"
import type { PricingConfig, RecipeIngredient, RecipeMetadata } from "./recipe"
import type { IngredientPrice } from "./ingredient"

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          type: string | null
          has_customized_costs: boolean
          expenses: BusinessExpenses | null
          estimated_monthly_plates: number | null
          net_profit_percentage: number
          pricing_method: PricingMethod | null
          target_food_cost_percent: number | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["businesses"]["Row"], "id" | "created_at"> & {
          id?: string
          created_at?: string
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
        Insert: Omit<Database["public"]["Tables"]["business_invites"]["Row"], "created_at"> & {
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
          unit: string
          pricing: IngredientPrice
          presentation: string | null
          supplier: string | null
          merma_customized: boolean | null
          merma_tipo: "unidad" | "porcentaje" | null
          merma_value: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["ingredients"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string
          created_at?: string
          updated_at?: string
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
          plate: string | null
          step: string | null
          servings: number
          yield_amount: number
          yield_unit: string
          ingredients: RecipeIngredient[]
          procedure: string[]
          observations: string[] | null
          total_cost: number
          cost_per_serving: number
          unit_price: number | null
          custom_unit_price: number | null
          custom_unit_profit: number | null
          pricing_config: PricingConfig | null
          pricing_method: PricingMethod | null
          target_food_cost_percent: number | null
          is_sub_recipe: boolean
          metadata: RecipeMetadata
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["recipes"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string
          created_at?: string
          updated_at?: string
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
          recipe_data: Record<string, unknown>
          deleted_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["recipes_trash"]["Row"], "id" | "deleted_at"> & {
          id?: string
          deleted_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["recipes_trash"]["Row"]>
        Relationships: never[]
      }
      inventory_items: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          name: string
          category: string
          current_stock: number | null
          min_stock: number
          unit: string
          price: number
          status: "normal" | "low" | "critical"
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["inventory_items"]["Row"], "id" | "updated_at"> & {
          id?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]>
        Relationships: never[]
      }
      inventory_snapshots: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          type: "initial" | "final" | "purchase"
          periodicity: string | null
          division: string | null
          notes: string | null
          inventory_mode: string | null
          modified_items: number | null
          total_value: number | null
          items: Record<string, unknown>[]
          date: string
        }
        Insert: Omit<Database["public"]["Tables"]["inventory_snapshots"]["Row"], "id" | "date"> & {
          id?: string
          date?: string
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
          items: Record<string, unknown>[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["menus"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["menus"]["Row"]>
        Relationships: never[]
      }
      purchase_orders: {
        Row: {
          id: string
          business_id: string | null
          owner_id: string
          name: string
          number: number | null
          provider: string | null
          status: string | null
          recipes: { id: string; name: string; yield: number }[]
          items: Record<string, unknown>[]
          total: number
          date: string
        }
        Insert: Omit<Database["public"]["Tables"]["purchase_orders"]["Row"], "id" | "date"> & {
          id?: string
          date?: string
        }
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]>
        Relationships: never[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
