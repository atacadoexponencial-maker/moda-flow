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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          created_at: string | null
          funil: string
          id: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          created_at?: string | null
          funil: string
          id?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          created_at?: string | null
          funil?: string
          id?: string
        }
        Relationships: []
      }
      lead_field_definitions: {
        Row: {
          created_at: string | null
          field_type: string
          id: string
          is_system: boolean
          key: string
          label: string
          options: string[] | null
          sort_order: number
          visible: boolean
        }
        Insert: {
          created_at?: string | null
          field_type?: string
          id?: string
          is_system?: boolean
          key: string
          label: string
          options?: string[] | null
          sort_order?: number
          visible?: boolean
        }
        Update: {
          created_at?: string | null
          field_type?: string
          id?: string
          is_system?: boolean
          key?: string
          label?: string
          options?: string[] | null
          sort_order?: number
          visible?: boolean
        }
        Relationships: []
      }
      lead_touches: {
        Row: {
          created_at: string
          external_id: string | null
          fbc: string | null
          funil: string | null
          gclid: string | null
          id: string
          is_aquisicao: boolean
          lead_id: string
          meta_ad_id: string | null
          meta_campaign_id: string | null
          meta_lead_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_posicion: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          fbc?: string | null
          funil?: string | null
          gclid?: string | null
          id?: string
          is_aquisicao?: boolean
          lead_id: string
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_posicion?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          fbc?: string | null
          funil?: string | null
          gclid?: string | null
          id?: string
          is_aquisicao?: boolean
          lead_id?: string
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_posicion?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_touches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          arrecadado: number | null
          created_at: string
          custom_data: Json | null
          data_criada: string | null
          data_proximo_contato: string | null
          data_ra: string | null
          data_ultimo_contato: string | null
          email: string | null
          email_norm: string | null
          external_id: string | null
          faturamento_mensal: string | null
          fbc: string | null
          funil: string | null
          gclid: string | null
          id: string
          instagram: string | null
          justificativa: string | null
          loss_reason: string | null
          meta_ad_id: string | null
          meta_campaign_id: string | null
          meta_lead_id: string | null
          mql: boolean | null
          nome: string
          objetivo: string | null
          oportunidade: number | null
          produto: string | null
          ra_flag: boolean | null
          rr_flag: boolean | null
          sql_flag: boolean | null
          status: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_posicion: string | null
          utm_source: string | null
          utm_term: string | null
          whatsapp: string | null
          whatsapp_norm: string | null
        }
        Insert: {
          arrecadado?: number | null
          created_at?: string
          custom_data?: Json | null
          data_criada?: string | null
          data_proximo_contato?: string | null
          data_ra?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          email_norm?: string | null
          external_id?: string | null
          faturamento_mensal?: string | null
          fbc?: string | null
          funil?: string | null
          gclid?: string | null
          id?: string
          instagram?: string | null
          justificativa?: string | null
          loss_reason?: string | null
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          mql?: boolean | null
          nome: string
          objetivo?: string | null
          oportunidade?: number | null
          produto?: string | null
          ra_flag?: boolean | null
          rr_flag?: boolean | null
          sql_flag?: boolean | null
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_posicion?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp?: string | null
          whatsapp_norm?: string | null
        }
        Update: {
          arrecadado?: number | null
          created_at?: string
          custom_data?: Json | null
          data_criada?: string | null
          data_proximo_contato?: string | null
          data_ra?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          email_norm?: string | null
          external_id?: string | null
          faturamento_mensal?: string | null
          fbc?: string | null
          funil?: string | null
          gclid?: string | null
          id?: string
          instagram?: string | null
          justificativa?: string | null
          loss_reason?: string | null
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          mql?: boolean | null
          nome?: string
          objetivo?: string | null
          oportunidade?: number | null
          produto?: string | null
          ra_flag?: boolean | null
          rr_flag?: boolean | null
          sql_flag?: boolean | null
          status?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_posicion?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp?: string | null
          whatsapp_norm?: string | null
        }
        Relationships: []
      }
      meta_ads_cache: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          date_start: string | null
          date_stop: string | null
          fetched_at: string
          id: string
          impressions: number | null
          spend: number | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          date_start?: string | null
          date_stop?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          date_start?: string | null
          date_stop?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Relationships: []
      }
      meta_config: {
        Row: {
          ad_account_id: string | null
          ativo: boolean
          created_at: string
          id: string
          meta_user_name: string | null
          oauth_state: string | null
          token_expires_at: string | null
          vault_secret_id: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          meta_user_name?: string | null
          oauth_state?: string | null
          token_expires_at?: string | null
          vault_secret_id?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          meta_user_name?: string | null
          oauth_state?: string | null
          token_expires_at?: string | null
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string | null
          last_used_at: string | null
          token: string
          total_leads_received: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          last_used_at?: string | null
          token?: string
          total_leads_received?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          last_used_at?: string | null
          token?: string
          total_leads_received?: number
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          ativo: boolean
          created_at: string
          display_phone_number: string | null
          id: string
          oauth_state: string | null
          phone_number_id: string | null
          updated_at: string
          vault_secret_id: string | null
          verified_name: string | null
          waba_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          oauth_state?: string | null
          phone_number_id?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          verified_name?: string | null
          waba_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          oauth_state?: string | null
          phone_number_id?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          verified_name?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      meta_config_safe: {
        Row: {
          ad_account_id: string | null
          ativo: boolean | null
          created_at: string | null
          id: string | null
          meta_user_name: string | null
          token_configurado: boolean | null
          token_expires_at: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string | null
          meta_user_name?: string | null
          token_configurado?: never
          token_expires_at?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string | null
          meta_user_name?: string | null
          token_configurado?: never
          token_expires_at?: string | null
        }
        Relationships: []
      }
      whatsapp_config_safe: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          display_phone_number: string | null
          id: string | null
          phone_number_id: string | null
          token_configurado: boolean | null
          verified_name: string | null
          waba_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          phone_number_id?: string | null
          token_configurado?: never
          verified_name?: string | null
          waba_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          phone_number_id?: string | null
          token_configurado?: never
          verified_name?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      increment_webhook_leads: {
        Args: { config_id: string }
        Returns: undefined
      }
      normalize_email: { Args: { raw: string }; Returns: string }
      normalize_whatsapp: { Args: { raw: string }; Returns: string }
      vault_create_secret: {
        Args: { new_name: string; new_secret: string }
        Returns: string
      }
      vault_delete_secret: { Args: { secret_id: string }; Returns: undefined }
      vault_read_secret: { Args: { secret_id: string }; Returns: string }
      vault_read_secret_by_name: {
        Args: { secret_name: string }
        Returns: string
      }
      vault_update_secret: {
        Args: { new_name: string; new_secret: string; secret_id: string }
        Returns: undefined
      }
      vault_upsert_secret: {
        Args: { p_name: string; p_secret: string }
        Returns: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
