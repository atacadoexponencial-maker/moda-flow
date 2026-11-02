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
      activity_attachments: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          lead_id: string
          mime: string
          name: string
          path: string
          size: number
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          lead_id: string
          mime: string
          name: string
          path: string
          size: number
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          mime?: string
          name?: string
          path?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_attachments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_attachments_lead_id_fkey"
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
          assigned_to: string | null
          created_at: string
          custom_data: Json | null
          data_criada: string | null
          data_proximo_contato: string | null
          data_ra: string | null
          data_rr: string | null
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
          last_return_at: string | null
          loss_reason: string | null
          meta_ad_id: string | null
          meta_campaign_id: string | null
          meta_lead_id: string | null
          mql: boolean | null
          no_show: boolean | null
          no_show_motivo: string | null
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
          assigned_to?: string | null
          created_at?: string
          custom_data?: Json | null
          data_criada?: string | null
          data_proximo_contato?: string | null
          data_ra?: string | null
          data_rr?: string | null
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
          last_return_at?: string | null
          loss_reason?: string | null
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          mql?: boolean | null
          no_show?: boolean | null
          no_show_motivo?: string | null
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
          assigned_to?: string | null
          created_at?: string
          custom_data?: Json | null
          data_criada?: string | null
          data_proximo_contato?: string | null
          data_ra?: string | null
          data_rr?: string | null
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
          last_return_at?: string | null
          loss_reason?: string | null
          meta_ad_id?: string | null
          meta_campaign_id?: string | null
          meta_lead_id?: string | null
          mql?: boolean | null
          no_show?: boolean | null
          no_show_motivo?: string | null
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
      meta_ads_insights: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
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
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
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
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
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
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          page: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          page: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          page?: string
          updated_at?: string
          user_id?: string
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
          quality_rating: string | null
          updated_at: string
          vault_secret_id: string | null
          verified_name: string | null
          waba_id: string | null
          webhook_subscribed_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          oauth_state?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          display_phone_number?: string | null
          id?: string
          oauth_state?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          updated_at?: string
          vault_secret_id?: string | null
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed_at?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_text: string | null
          lead_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          lead_id: string
          media_filename: string | null
          media_meta_id: string | null
          media_mime: string | null
          media_path: string | null
          media_size: number | null
          media_status: string | null
          phone_number_id: string | null
          reaction_emoji: string | null
          read_at: string | null
          reply_to_wamid: string | null
          sent_by: string | null
          sent_by_email: string | null
          status: string | null
          status_error: string | null
          type: string
          wamid: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          lead_id: string
          media_filename?: string | null
          media_meta_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size?: number | null
          media_status?: string | null
          phone_number_id?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          reply_to_wamid?: string | null
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string | null
          status_error?: string | null
          type: string
          wamid?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          media_filename?: string | null
          media_meta_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          media_size?: number | null
          media_status?: string | null
          phone_number_id?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          reply_to_wamid?: string | null
          sent_by?: string | null
          sent_by_email?: string | null
          status?: string | null
          status_error?: string | null
          type?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          components: Json
          id: string
          language: string
          meta_id: string
          name: string
          rejected_reason: string | null
          status: string
          synced_at: string
        }
        Insert: {
          category?: string | null
          components?: Json
          id?: string
          language: string
          meta_id: string
          name: string
          rejected_reason?: string | null
          status: string
          synced_at?: string
        }
        Update: {
          category?: string | null
          components?: Json
          id?: string
          language?: string
          meta_id?: string
          name?: string
          rejected_reason?: string | null
          status?: string
          synced_at?: string
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
          quality_rating: string | null
          token_configurado: boolean | null
          updated_at: string | null
          verified_name: string | null
          waba_id: string | null
          webhook_subscribed_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          token_configurado?: never
          updated_at?: string | null
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          display_phone_number?: string | null
          id?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          token_configurado?: never
          updated_at?: string | null
          verified_name?: string | null
          waba_id?: string | null
          webhook_subscribed_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      increment_webhook_leads: {
        Args: { config_id: string }
        Returns: undefined
      }
      lead_return_reopens: { Args: { p_status: string }; Returns: boolean }
      normalize_email: { Args: { raw: string }; Returns: string }
      normalize_whatsapp: { Args: { raw: string }; Returns: string }
      team_members: {
        Args: never
        Returns: {
          email: string
          role: string
          user_id: string
        }[]
      }
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
      whatsapp_apply_status: {
        Args: { p_error: string; p_status: string; p_wamid: string }
        Returns: boolean
      }
      whatsapp_ingest_message: {
        Args: {
          p_content: string
          p_from: string
          p_media: Json
          p_phone_number_id: string
          p_preview: string
          p_profile_name: string
          p_reply_to_wamid: string
          p_ts: string
          p_type: string
          p_wamid: string
        }
        Returns: Json
      }
      whatsapp_status_rank: { Args: { p_status: string }; Returns: number }
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
    Enums: {},
  },
} as const
