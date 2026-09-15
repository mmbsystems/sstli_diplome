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
      activity_logs: {
        Row: {
          action: string
          actor_label: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          branch_id: string | null
          created_at: string
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_label: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id: string
          entity_label: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_label?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string
          entity_label?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_branch_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          role: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          archived_at: string | null
          city: string
          created_at: string
          directory_listed: boolean
          id: string
          is_active: boolean
          legacy_key: string | null
          name: string
          source_region_label: string | null
          updated_at: string
          version: number
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          city: string
          created_at?: string
          directory_listed?: boolean
          id?: string
          is_active?: boolean
          legacy_key?: string | null
          name: string
          source_region_label?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          city?: string
          created_at?: string
          directory_listed?: boolean
          id?: string
          is_active?: boolean
          legacy_key?: string | null
          name?: string
          source_region_label?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      career_paths: {
        Row: {
          created_at: string
          id: string
          program_id: string
          sort_order: number
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          sort_order: number
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "career_paths_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_items: {
        Row: {
          created_at: string
          id: string
          program_id: string
          sort_order: number
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          sort_order: number
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_offerings: {
        Row: {
          accredited_hours_override: number | null
          archived_at: string | null
          branch_id: string
          created_at: string
          gender: string
          id: string
          installment_months: number | null
          is_active: boolean
          legacy_id: string | null
          min_down_payment: number | null
          price: number | null
          program_id: string
          registration_state: string
          sort_order: number
          study_mode: string
          updated_at: string
          version: number
        }
        Insert: {
          accredited_hours_override?: number | null
          archived_at?: string | null
          branch_id: string
          created_at?: string
          gender?: string
          id?: string
          installment_months?: number | null
          is_active?: boolean
          legacy_id?: string | null
          min_down_payment?: number | null
          price?: number | null
          program_id: string
          registration_state?: string
          sort_order?: number
          study_mode: string
          updated_at?: string
          version?: number
        }
        Update: {
          accredited_hours_override?: number | null
          archived_at?: string | null
          branch_id?: string
          created_at?: string
          gender?: string
          id?: string
          installment_months?: number | null
          is_active?: boolean
          legacy_id?: string | null
          min_down_payment?: number | null
          price?: number | null
          program_id?: string
          registration_state?: string
          sort_order?: number
          study_mode?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_offerings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_offerings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          accreditation_text: string | null
          accredited_hours: number | null
          archived_at: string | null
          catalog_visibility: boolean
          classification_pending: boolean
          content_pending: boolean
          created_at: string
          description: string
          duration_display: string
          duration_standard: string | null
          duration_summer: string | null
          id: string
          image_path: string | null
          image_position: string | null
          is_active: boolean
          is_featured: boolean
          legacy_id: string | null
          name_ar: string
          name_en: string | null
          program_type: string
          publication_status: string
          searchable_keywords: string[]
          slug: string
          specialization: string | null
          updated_at: string
          version: number
        }
        Insert: {
          accreditation_text?: string | null
          accredited_hours?: number | null
          archived_at?: string | null
          catalog_visibility?: boolean
          classification_pending?: boolean
          content_pending?: boolean
          created_at?: string
          description?: string
          duration_display?: string
          duration_standard?: string | null
          duration_summer?: string | null
          id?: string
          image_path?: string | null
          image_position?: string | null
          is_active?: boolean
          is_featured?: boolean
          legacy_id?: string | null
          name_ar: string
          name_en?: string | null
          program_type: string
          publication_status?: string
          searchable_keywords?: string[]
          slug: string
          specialization?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          accreditation_text?: string | null
          accredited_hours?: number | null
          archived_at?: string | null
          catalog_visibility?: boolean
          classification_pending?: boolean
          content_pending?: boolean
          created_at?: string
          description?: string
          duration_display?: string
          duration_standard?: string | null
          duration_summer?: string | null
          id?: string
          image_path?: string | null
          image_position?: string | null
          is_active?: boolean
          is_featured?: boolean
          legacy_id?: string | null
          name_ar?: string
          name_en?: string | null
          program_type?: string
          publication_status?: string
          searchable_keywords?: string[]
          slug?: string
          specialization?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      legacy_admin_set_program_image: {
        Args: { p_id: string; p_expected_version: number; p_image_path: string | null; p_actor_username: string; p_actor_name: string; p_request_id: string }
        Returns: Json
      }
      legacy_admin_probe: {
        Args: {
          p_action: string
          p_actor_name?: string
          p_actor_username?: string
          p_expected_version: number
          p_id: string
          p_request_id?: string
          p_value?: string
        }
        Returns: Json
      }
      legacy_admin_save_branch: {
        Args: {
          p_actor_name: string
          p_actor_username: string
          p_archive: string
          p_branch: Json
          p_expected_version: number
          p_id: string
          p_request_id: string
        }
        Returns: Json
      }
      legacy_admin_save_offering: {
        Args: {
          p_actor_name: string
          p_actor_username: string
          p_archive: string
          p_expected_version: number
          p_id: string
          p_offering: Json
          p_request_id: string
        }
        Returns: Json
      }
      legacy_admin_save_program: {
        Args: {
          p_actor_name: string
          p_actor_username: string
          p_archive: string
          p_careers: Json
          p_curriculum: Json
          p_expected_version: number
          p_id: string
          p_program: Json
          p_request_id: string
        }
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

