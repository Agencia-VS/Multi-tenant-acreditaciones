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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          error: string | null
          id: string
          registration_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          tenant_id: string | null
          tipo: string | null
          to_email: string
        }
        Insert: {
          error?: string | null
          id?: string
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id?: string | null
          tipo?: string | null
          to_email: string
        }
        Update: {
          error?: string | null
          id?: string
          registration_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_id?: string | null
          tipo?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "v_registration_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string | null
          created_at: string | null
          id: string
          info_general: string | null
          subject: string | null
          tenant_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          created_at?: string | null
          id?: string
          info_general?: string | null
          subject?: string | null
          tenant_id?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          created_at?: string | null
          id?: string
          info_general?: string | null
          subject?: string | null
          tenant_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      email_zone_content: {
        Row: {
          created_at: string | null
          id: string
          info_especifica: string | null
          instrucciones_acceso: string | null
          notas_importantes: string | null
          tenant_id: string
          tipo: string
          titulo: string | null
          updated_at: string | null
          zona: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          info_especifica?: string | null
          instrucciones_acceso?: string | null
          notas_importantes?: string | null
          tenant_id: string
          tipo: string
          titulo?: string | null
          updated_at?: string | null
          zona: string
        }
        Update: {
          created_at?: string | null
          id?: string
          info_especifica?: string | null
          instrucciones_acceso?: string | null
          notas_importantes?: string | null
          tenant_id?: string
          tipo?: string
          titulo?: string | null
          updated_at?: string | null
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_zone_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_zone_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      event_quota_rules: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          max_global: number | null
          max_per_organization: number
          tipo_medio: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          max_global?: number | null
          max_per_organization?: number
          tipo_medio: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          max_global?: number | null
          max_per_organization?: number
          tipo_medio?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_quota_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_quota_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_full"
            referencedColumns: ["id"]
          },
        ]
      }
      event_zone_rules: {
        Row: {
          cargo: string
          created_at: string | null
          event_id: string
          id: string
          match_field: string
          zona: string
        }
        Insert: {
          cargo: string
          created_at?: string | null
          event_id: string
          id?: string
          match_field?: string
          zona: string
        }
        Update: {
          cargo?: string
          created_at?: string | null
          event_id?: string
          id?: string
          match_field?: string
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_zone_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_zone_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_full"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          config: Json | null
          created_at: string | null
          descripcion: string | null
          fecha: string | null
          fecha_limite_acreditacion: string | null
          form_fields: Json | null
          hora: string | null
          id: string
          is_active: boolean | null
          league: string | null
          nombre: string
          opponent_logo_url: string | null
          opponent_name: string | null
          qr_enabled: boolean | null
          tenant_id: string
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          fecha_limite_acreditacion?: string | null
          form_fields?: Json | null
          hora?: string | null
          id?: string
          is_active?: boolean | null
          league?: string | null
          nombre: string
          opponent_logo_url?: string | null
          opponent_name?: string | null
          qr_enabled?: boolean | null
          tenant_id: string
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          fecha_limite_acreditacion?: string | null
          form_fields?: Json | null
          hora?: string | null
          id?: string
          is_active?: boolean | null
          league?: string | null
          nombre?: string
          opponent_logo_url?: string | null
          opponent_name?: string | null
          qr_enabled?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_reglas_cupo: {
        Row: {
          activo: boolean
          area: string
          created_at: string | null
          cupo_maximo: number
          empresa: string
          evento_id: number | null
          id: string
          prioridad: number
          tenant_id: string
          tipo_medio: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          area: string
          created_at?: string | null
          cupo_maximo: number
          empresa: string
          evento_id?: number | null
          id?: string
          prioridad?: number
          tenant_id: string
          tipo_medio: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          area?: string
          created_at?: string | null
          cupo_maximo?: number
          empresa?: string
          evento_id?: number | null
          id?: string
          prioridad?: number
          tenant_id?: string
          tipo_medio?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellido: string
          cargo: string | null
          created_at: string | null
          datos_base: Json | null
          email: string | null
          foto_url: string | null
          id: string
          medio: string | null
          nacionalidad: string | null
          nombre: string
          rut: string
          telefono: string | null
          tipo_medio: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apellido: string
          cargo?: string | null
          created_at?: string | null
          datos_base?: Json | null
          email?: string | null
          foto_url?: string | null
          id?: string
          medio?: string | null
          nacionalidad?: string | null
          nombre: string
          rut: string
          telefono?: string | null
          tipo_medio?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apellido?: string
          cargo?: string | null
          created_at?: string | null
          datos_base?: Json | null
          email?: string | null
          foto_url?: string | null
          id?: string
          medio?: string | null
          nacionalidad?: string | null
          nombre?: string
          rut?: string
          telefono?: string | null
          tipo_medio?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          cargo: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string | null
          datos_extra: Json | null
          event_id: string
          id: string
          motivo_rechazo: string | null
          organizacion: string | null
          processed_at: string | null
          processed_by: string | null
          profile_id: string
          qr_generated_at: string | null
          qr_token: string | null
          status: string | null
          submitted_by: string | null
          tipo_medio: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          event_id: string
          id?: string
          motivo_rechazo?: string | null
          organizacion?: string | null
          processed_at?: string | null
          processed_by?: string | null
          profile_id: string
          qr_generated_at?: string | null
          qr_token?: string | null
          status?: string | null
          submitted_by?: string | null
          tipo_medio?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          checked_in?: boolean | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string | null
          datos_extra?: Json | null
          event_id?: string
          id?: string
          motivo_rechazo?: string | null
          organizacion?: string | null
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string
          qr_generated_at?: string | null
          qr_token?: string | null
          status?: string | null
          submitted_by?: string | null
          tipo_medio?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nombre: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          nombre?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nombre?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          alias: string | null
          created_at: string | null
          id: string
          manager_id: string
          member_profile_id: string
          notas: string | null
        }
        Insert: {
          alias?: string | null
          created_at?: string | null
          id?: string
          manager_id: string
          member_profile_id: string
          notas?: string | null
        }
        Update: {
          alias?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string
          member_profile_id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_admins: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nombre: string | null
          rol: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          nombre?: string | null
          rol?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nombre?: string | null
          rol?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_admins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean | null
          background_url: string | null
          color_dark: string | null
          color_light: string | null
          color_primario: string | null
          color_secundario: string | null
          config: Json | null
          created_at: string | null
          id: string
          logo_url: string | null
          nombre: string
          shield_url: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          background_url?: string | null
          color_dark?: string | null
          color_light?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          shield_url?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          background_url?: string | null
          color_dark?: string | null
          color_light?: string | null
          color_primario?: string | null
          color_secundario?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          shield_url?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_event_full: {
        Row: {
          config: Json | null
          created_at: string | null
          descripcion: string | null
          fecha: string | null
          fecha_limite_acreditacion: string | null
          form_fields: Json | null
          hora: string | null
          id: string | null
          is_active: boolean | null
          league: string | null
          nombre: string | null
          opponent_logo_url: string | null
          opponent_name: string | null
          qr_enabled: boolean | null
          tenant_background: string | null
          tenant_color_dark: string | null
          tenant_color_light: string | null
          tenant_color_primario: string | null
          tenant_color_secundario: string | null
          tenant_config: Json | null
          tenant_id: string | null
          tenant_logo: string | null
          tenant_nombre: string | null
          tenant_shield: string | null
          tenant_slug: string | null
          updated_at: string | null
          venue: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      v_registration_full: {
        Row: {
          cargo: string | null
          checked_in: boolean | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string | null
          datos_extra: Json | null
          event_fecha: string | null
          event_id: string | null
          event_nombre: string | null
          event_qr_enabled: boolean | null
          event_venue: string | null
          id: string | null
          motivo_rechazo: string | null
          organizacion: string | null
          processed_at: string | null
          processed_by: string | null
          profile_apellido: string | null
          profile_datos_base: Json | null
          profile_email: string | null
          profile_foto: string | null
          profile_id: string | null
          profile_medio: string | null
          profile_nombre: string | null
          profile_telefono: string | null
          qr_generated_at: string | null
          qr_token: string | null
          rut: string | null
          status: string | null
          submitted_by: string | null
          tenant_color_primario: string | null
          tenant_id: string | null
          tenant_logo: string | null
          tenant_nombre: string | null
          tenant_slug: string | null
          tipo_medio: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tenant_stats: {
        Row: {
          activo: boolean | null
          background_url: string | null
          color_dark: string | null
          color_light: string | null
          color_primario: string | null
          color_secundario: string | null
          config: Json | null
          created_at: string | null
          id: string | null
          logo_url: string | null
          nombre: string | null
          shield_url: string | null
          slug: string | null
          total_admins: number | null
          total_events: number | null
          total_registrations: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_edit_tenant: { Args: { p_tenant_id: string }; Returns: boolean }
      check_and_create_registration: {
        Args: {
          p_event_id: string
          p_profile_id: string
          p_organizacion?: string
          p_tipo_medio?: string
          p_cargo?: string
          p_submitted_by?: string
          p_datos_extra?: Json
        }
        Returns: string
      }
      check_quota: {
        Args: {
          p_event_id: string
          p_organizacion: string
          p_tipo_medio: string
        }
        Returns: Json
      }
      generate_qr_token: {
        Args: { p_registration_id: string }
        Returns: string
      }
      get_active_form_config: {
        Args: {
          p_evento_id?: number
          p_form_slug?: string
          p_tenant_slug: string
        }
        Returns: Json
      }
      get_or_create_perfil: {
        Args: {
          p_apellido: string
          p_cargo?: string
          p_email: string
          p_empresa?: string
          p_nacionalidad?: string
          p_nombre: string
          p_rut: string
          p_telefono?: string
          p_user_id: string
        }
        Returns: string
      }
      get_or_create_profile: {
        Args: {
          p_apellido: string
          p_email?: string
          p_nombre: string
          p_rut: string
          p_telefono?: string
          p_user_id?: string
        }
        Returns: string
      }
      get_tenant_role: { Args: { p_tenant_id: string }; Returns: string }
      has_tenant_access: { Args: { p_tenant_id: string }; Returns: boolean }
      is_admin_of_tenant: { Args: { tenant_uuid: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      validate_qr_checkin: {
        Args: { p_qr_token: string; p_scanner_user_id?: string }
        Returns: Json
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
