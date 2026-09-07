export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          actor: string
          created_at: string
          detail: string | null
          event: string
          id: string
          negotiation_id: string
        }
        Insert: {
          actor: string
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          negotiation_id: string
        }
        Update: {
          actor?: string
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          negotiation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          agent: string | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          agent?: string | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          agent?: string | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "negotiation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_offers: {
        Row: {
          active: boolean
          created_at: string
          discount_pct: number
          expires_at: string
          id: string
          label: string
          product_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_pct: number
          expires_at: string
          id?: string
          label?: string
          product_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_pct?: number
          expires_at?: string
          id?: string
          label?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_messages: {
        Row: {
          amount: number | null
          conditions: Json
          created_at: string
          currency: string
          id: string
          negotiation_id: string
          reasoning: string | null
          round: number
          sender: Database["public"]["Enums"]["negotiation_sender"]
          type: Database["public"]["Enums"]["negotiation_msg_type"]
        }
        Insert: {
          amount?: number | null
          conditions?: Json
          created_at?: string
          currency?: string
          id?: string
          negotiation_id: string
          reasoning?: string | null
          round?: number
          sender: Database["public"]["Enums"]["negotiation_sender"]
          type: Database["public"]["Enums"]["negotiation_msg_type"]
        }
        Update: {
          amount?: number | null
          conditions?: Json
          created_at?: string
          currency?: string
          id?: string
          negotiation_id?: string
          reasoning?: string | null
          round?: number
          sender?: Database["public"]["Enums"]["negotiation_sender"]
          type?: Database["public"]["Enums"]["negotiation_msg_type"]
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_messages_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_sessions: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category: string | null
          created_at: string
          final_price: number | null
          id: string
          preferences: string[]
          product_id: string | null
          stage: Database["public"]["Enums"]["shop_stage"]
          user_id: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          preferences?: string[]
          product_id?: string | null
          stage?: Database["public"]["Enums"]["shop_stage"]
          user_id: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          preferences?: string[]
          product_id?: string | null
          stage?: Database["public"]["Enums"]["shop_stage"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          auto_accept_at: number | null
          buyer_budget: number
          completed_at: string | null
          current_buyer_offer: number | null
          current_seller_offer: number | null
          final_price: number | null
          id: string
          listed_price: number
          max_rounds: number
          product_id: string
          quantity: number
          round: number
          savings: number | null
          savings_pct: number | null
          seller_id: string
          session_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["negotiation_status"]
          target_price: number
          user_id: string
        }
        Insert: {
          auto_accept_at?: number | null
          buyer_budget: number
          completed_at?: string | null
          current_buyer_offer?: number | null
          current_seller_offer?: number | null
          final_price?: number | null
          id?: string
          listed_price: number
          max_rounds?: number
          product_id: string
          quantity?: number
          round?: number
          savings?: number | null
          savings_pct?: number | null
          seller_id: string
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["negotiation_status"]
          target_price: number
          user_id: string
        }
        Update: {
          auto_accept_at?: number | null
          buyer_budget?: number
          completed_at?: string | null
          current_buyer_offer?: number | null
          current_seller_offer?: number | null
          final_price?: number | null
          id?: string
          listed_price?: number
          max_rounds?: number
          product_id?: string
          quantity?: number
          round?: number
          savings?: number | null
          savings_pct?: number | null
          seller_id?: string
          session_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["negotiation_status"]
          target_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "negotiation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_address: string
          id: string
          negotiated_price: number
          negotiation_id: string | null
          order_ref: string
          product_id: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_address: string
          id?: string
          negotiated_price: number
          negotiation_id?: string | null
          order_ref?: string
          product_id: string
          quantity: number
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_address?: string
          id?: string
          negotiated_price?: number
          negotiation_id?: string | null
          order_ref?: string
          product_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          name: string
          price: number
          stock_count: number
          tags: string[]
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          name: string
          price: number
          stock_count?: number
          tags?: string[]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          name?: string
          price?: number
          stock_count?: number
          tags?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      seller_listings: {
        Row: {
          created_at: string
          demand_level: Database["public"]["Enums"]["demand_level"]
          id: string
          inventory_level: number
          listed_price: number
          max_discount_pct: number
          max_rounds: number
          minimum_price: number
          preferred_price: number
          product_id: string
          seller_id: string
          shipping_fee: number
          urgency: Database["public"]["Enums"]["demand_level"]
        }
        Insert: {
          created_at?: string
          demand_level?: Database["public"]["Enums"]["demand_level"]
          id?: string
          inventory_level?: number
          listed_price: number
          max_discount_pct?: number
          max_rounds?: number
          minimum_price: number
          preferred_price: number
          product_id: string
          seller_id: string
          shipping_fee?: number
          urgency?: Database["public"]["Enums"]["demand_level"]
        }
        Update: {
          created_at?: string
          demand_level?: Database["public"]["Enums"]["demand_level"]
          id?: string
          inventory_level?: number
          listed_price?: number
          max_discount_pct?: number
          max_rounds?: number
          minimum_price?: number
          preferred_price?: number
          product_id?: string
          seller_id?: string
          shipping_fee?: number
          urgency?: Database["public"]["Enums"]["demand_level"]
        }
        Relationships: [
          {
            foreignKeyName: "seller_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          agent_kind: string
          created_at: string
          endpoint_url: string | null
          id: string
          name: string
          verified: boolean
        }
        Insert: {
          agent_kind?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          name: string
          verified?: boolean
        }
        Update: {
          agent_kind?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          name?: string
          verified?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      seller_listings_public: {
        Row: {
          agent_kind: string | null
          id: string | null
          listed_price: number | null
          product_id: string | null
          seller_id: string | null
          seller_name: string | null
          shipping_fee: number | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          p_address: string
          p_negotiated_price: number
          p_negotiation_id?: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          created_at: string
          delivery_address: string
          id: string
          negotiated_price: number
          negotiation_id: string | null
          order_ref: string
          product_id: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
      demand_level: "low" | "medium" | "high"
      negotiation_msg_type:
        | "offer"
        | "counter_offer"
        | "accept"
        | "reject"
        | "information_request"
        | "final_offer"
        | "status"
      negotiation_sender: "buyer_agent" | "seller_agent" | "system"
      negotiation_status:
        | "initiated"
        | "negotiating"
        | "countered"
        | "accepted"
        | "rejected"
        | "walked_away"
        | "expired"
      order_status:
        | "placed"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
      shop_stage:
        | "greeting"
        | "category"
        | "budget"
        | "preferences"
        | "matching"
        | "negotiating"
        | "ordered"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      demand_level: ["low", "medium", "high"],
      negotiation_msg_type: [
        "offer",
        "counter_offer",
        "accept",
        "reject",
        "information_request",
        "final_offer",
        "status",
      ],
      negotiation_sender: ["buyer_agent", "seller_agent", "system"],
      negotiation_status: [
        "initiated",
        "negotiating",
        "countered",
        "accepted",
        "rejected",
        "walked_away",
        "expired",
      ],
      order_status: [
        "placed",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      shop_stage: [
        "greeting",
        "category",
        "budget",
        "preferences",
        "matching",
        "negotiating",
        "ordered",
      ],
    },
  },
} as const
