export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      etims_submissions: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          invoice_number: string
          response_data: Json | null
          status: string
          store_id: string
          submitted_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_number: string
          response_data?: Json | null
          status: string
          store_id: string
          submitted_at: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          invoice_number?: string
          response_data?: Json | null
          status?: string
          store_id?: string
          submitted_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etims_submissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number
          id: string
          name: string
          parent_product_id: string | null
          quantity: number
          retail_price: number | null
          selling_price: number
          sku: string | null
          store_id: string | null
          unit_of_measure: string
          units_per_pack: number
          vat_status: boolean | null
          wholesale_price: number | null
          wholesale_threshold: number | null
        }
        Insert: {
          category?: string | null
          cost_price?: number
          id?: string
          name: string
          parent_product_id?: string | null
          quantity: number
          retail_price?: number | null
          selling_price?: number
          sku?: string | null
          store_id?: string | null
          unit_of_measure?: string
          units_per_pack?: number
          vat_status?: boolean | null
          wholesale_price?: number | null
          wholesale_threshold?: number | null
        }
        Update: {
          category?: string | null
          cost_price?: number
          id?: string
          name?: string
          parent_product_id?: string | null
          quantity?: number
          retail_price?: number | null
          selling_price?: number
          sku?: string | null
          store_id?: string | null
          unit_of_measure?: string
          units_per_pack?: number
          vat_status?: boolean | null
          wholesale_price?: number | null
          wholesale_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          etims_password: string | null
          etims_username: string | null
          id: string
          kra_pin: string | null
          kra_token: string | null
          mpesa_details: Json | null
          name: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          etims_password?: string | null
          etims_username?: string | null
          id?: string
          kra_pin?: string | null
          kra_token?: string | null
          mpesa_details?: Json | null
          name: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          etims_password?: string | null
          etims_username?: string | null
          id?: string
          kra_pin?: string | null
          kra_token?: string | null
          mpesa_details?: Json | null
          name?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          payment_method: string | null
          product_id: string | null
          quantity: number
          store_id: string | null
          synced: boolean | null
          timestamp: string | null
          total: number
          vat_amount: number | null
        }
        Insert: {
          id?: string
          payment_method?: string | null
          product_id?: string | null
          quantity: number
          store_id?: string | null
          synced?: boolean | null
          timestamp?: string | null
          total: number
          vat_amount?: number | null
        }
        Update: {
          id?: string
          payment_method?: string | null
          product_id?: string | null
          quantity?: number
          store_id?: string | null
          synced?: boolean | null
          timestamp?: string | null
          total?: number
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          role: string | null
          store_id: string | null
        }
        Insert: {
          id: string
          role?: string | null
          store_id?: string | null
        }
        Update: {
          id?: string
          role?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_sale: {
        Args: {
          p_store_id: string
          p_products: Json
          p_payment_method: string
          p_total_amount: number
          p_vat_total: number
        }
        Returns: string
      }
      execute_bulk_update: {
        Args: { p_sql: string; p_store_id: string }
        Returns: undefined
      }
      get_product_history: {
        Args: { p_product_id: string }
        Returns: {
          id: string
          product_id: string
          change_type: string
          old_values: Json
          new_values: Json
          changed_at: string
          changed_by: string
        }[]
      }
      get_stock_level: {
        Args: { p_product_id: string; p_store_id: string }
        Returns: {
          quantity: number
          units_per_pack: number
          selling_price: number
          vat_status: boolean
        }[]
      }
      update_stock: {
        Args: {
          p_product_id: string
          p_quantity_change: number
          p_store_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
