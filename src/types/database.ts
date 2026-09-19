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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      overtime_rules: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          name: string
          percentage: number
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          name: string
          percentage: number
          user_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          name?: string
          percentage?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_history: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          monthly_hours: number
          salary: number
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          monthly_hours: number
          salary: number
          user_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          monthly_hours?: number
          salary?: number
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          keep_signed_in: boolean
          locale: string
          notifications_enabled: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keep_signed_in?: boolean
          locale?: string
          notifications_enabled?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keep_signed_in?: boolean
          locale?: string
          notifications_enabled?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_record_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
          work_record_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
          work_record_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
          work_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_record_history_work_record_id_fkey"
            columns: ["work_record_id"]
            isOneToOne: false
            referencedRelation: "work_records"
            referencedColumns: ["id"]
          },
        ]
      }
      work_records: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          day_type: string
          entry_time: string | null
          exit_time: string | null
          id: string
          lunch_end: string | null
          lunch_start: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          version: number
          work_date: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          day_type?: string
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
          work_date: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          day_type?: string
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
          work_date?: string
        }
        Relationships: []
      }
      work_schedule_history: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          monthly_hours_override: number | null
          notes: string | null
          user_id: string
          weekly_hours: Json
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          monthly_hours_override?: number | null
          notes?: string | null
          user_id: string
          weekly_hours?: Json
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          monthly_hours_override?: number | null
          notes?: string | null
          user_id?: string
          weekly_hours?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
