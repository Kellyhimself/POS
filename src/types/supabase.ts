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
      app_settings: {
        Row: {
          cost_protection_admin_approval: boolean | null
          cost_protection_allow_below_cost: boolean | null
          cost_protection_auto_calculate: boolean | null
          cost_protection_enabled: boolean | null
          cost_protection_min_margin: number | null
          cost_protection_show_warnings: boolean | null
          default_vat_rate: number
          enable_vat_toggle_on_pos: boolean
          id: string
          receipt_auto_close: boolean | null
          receipt_auto_download: boolean | null
          receipt_auto_print: boolean | null
          receipt_close_delay: number | null
          receipt_download_delay: number | null
          receipt_download_format: string | null
          receipt_print_delay: number | null
          receipt_show_inline: boolean | null
          updated_at: string
          vat_pricing_model: string
        }
        Insert: {
          cost_protection_admin_approval?: boolean | null
          cost_protection_allow_below_cost?: boolean | null
          cost_protection_auto_calculate?: boolean | null
          cost_protection_enabled?: boolean | null
          cost_protection_min_margin?: number | null
          cost_protection_show_warnings?: boolean | null
          default_vat_rate?: number
          enable_vat_toggle_on_pos?: boolean
          id?: string
          receipt_auto_close?: boolean | null
          receipt_auto_download?: boolean | null
          receipt_auto_print?: boolean | null
          receipt_close_delay?: number | null
          receipt_download_delay?: number | null
          receipt_download_format?: string | null
          receipt_print_delay?: number | null
          receipt_show_inline?: boolean | null
          updated_at?: string
          vat_pricing_model?: string
        }
        Update: {
          cost_protection_admin_approval?: boolean | null
          cost_protection_allow_below_cost?: boolean | null
          cost_protection_auto_calculate?: boolean | null
          cost_protection_enabled?: boolean | null
          cost_protection_min_margin?: number | null
          cost_protection_show_warnings?: boolean | null
          default_vat_rate?: number
          enable_vat_toggle_on_pos?: boolean
          id?: string
          receipt_auto_close?: boolean | null
          receipt_auto_download?: boolean | null
          receipt_auto_print?: boolean | null
          receipt_close_delay?: number | null
          receipt_download_delay?: number | null
          receipt_download_format?: string | null
          receipt_print_delay?: number | null
          receipt_show_inline?: boolean | null
          updated_at?: string
          vat_pricing_model?: string
        }
        Relationships: []
      }
      etims_submissions: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          invoice_number: string
          response_data: Json | null
          status: string
          store_id: string
          submission_type: string
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
          submission_type?: string
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
          submission_type?: string
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
          barcode: string | null
          category: string | null
          cost_price: number
          id: string
          input_vat_amount: number | null
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
          barcode?: string | null
          category?: string | null
          cost_price?: number
          id?: string
          input_vat_amount?: number | null
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
          barcode?: string | null
          category?: string | null
          cost_price?: number
          id?: string
          input_vat_amount?: number | null
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
      purchase_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          purchase_id: string | null
          quantity: number
          unit_cost: number
          vat_amount: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_id?: string | null
          quantity: number
          unit_cost: number
          vat_amount?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_id?: string | null
          quantity?: number
          unit_cost?: number
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string | null
          date: string
          id: string
          input_vat_amount: number | null
          invoice_number: string | null
          is_vat_included: boolean | null
          notes: string | null
          store_id: string | null
          supplier_id: string | null
          supplier_vat_no: string | null
          synced: boolean | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          input_vat_amount?: number | null
          invoice_number?: string | null
          is_vat_included?: boolean | null
          notes?: string | null
          store_id?: string | null
          supplier_id?: string | null
          supplier_vat_no?: string | null
          synced?: boolean | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          input_vat_amount?: number | null
          invoice_number?: string | null
          is_vat_included?: boolean | null
          notes?: string | null
          store_id?: string | null
          supplier_id?: string | null
          supplier_vat_no?: string | null
          synced?: boolean | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      suppliers: {
        Row: {
          contact_info: string | null
          created_at: string | null
          id: string
          name: string
          vat_no: string | null
        }
        Insert: {
          contact_info?: string | null
          created_at?: string | null
          id?: string
          name: string
          vat_no?: string | null
        }
        Update: {
          contact_info?: string | null
          created_at?: string | null
          id?: string
          name?: string
          vat_no?: string | null
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
      api_get_product_by_barcode: {
        Args: { p_barcode: string; p_store_id: string }
        Returns: Json
      }
      create_product: {
        Args: {
          p_product: Database["public"]["CompositeTypes"]["product_input"]
        }
        Returns: {
          barcode: string | null
          category: string | null
          cost_price: number
          id: string
          input_vat_amount: number | null
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
      }
      create_sale: {
        Args: {
          p_store_id: string
          p_products: Json
          p_payment_method: string
          p_total_amount: number
          p_vat_total: number
          p_is_sync?: boolean
          p_timestamp?: string
        }
        Returns: string
      }
      get_product_by_barcode: {
        Args: { p_barcode: string; p_store_id: string }
        Returns: {
          id: string
          name: string
          sku: string
          category: string
          cost_price: number
          selling_price: number
          retail_price: number
          wholesale_price: number
          wholesale_threshold: number
          quantity: number
          unit_of_measure: string
          units_per_pack: number
          vat_status: boolean
          input_vat_amount: number
          barcode: string
          store_id: string
          parent_product_id: string
        }[]
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
      is_barcode_unique: {
        Args: { p_barcode: string; p_store_id: string; p_exclude_id?: string }
        Returns: boolean
      }
      update_stock: {
        Args: {
          p_product_id: string
          p_quantity_change: number
          p_store_id?: string
        }
        Returns: {
          barcode: string | null
          category: string | null
          cost_price: number
          id: string
          input_vat_amount: number | null
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
      }
      update_stock_batch: {
        Args: {
          p_updates: Database["public"]["CompositeTypes"]["stock_update_input"][]
        }
        Returns: {
          barcode: string | null
          category: string | null
          cost_price: number
          id: string
          input_vat_amount: number | null
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
        }[]
      }
      validate_barcode_format: {
        Args: { barcode_text: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      product_input: {
        id: string | null
        name: string | null
        sku: string | null
        category: string | null
        store_id: string | null
        quantity: number | null
        retail_price: number | null
        wholesale_price: number | null
        wholesale_threshold: number | null
        vat_status: boolean | null
        cost_price: number | null
        unit_of_measure: string | null
        units_per_pack: number | null
        parent_product_id: string | null
        selling_price: number | null
        input_vat_amount: number | null
        barcode: string | null
      }
      stock_update_input: {
        product_id: string | null
        quantity_change: number | null
      }
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
