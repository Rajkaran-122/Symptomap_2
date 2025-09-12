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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_cache: {
        Row: {
          ai_response: Json
          cluster_probability: number | null
          created_at: string
          expires_at: string
          icd10_codes: string[] | null
          id: string
          input_hash: string
          medical_terms: string[] | null
          model_used: string
          risk_score: number | null
          symptoms_text: string
        }
        Insert: {
          ai_response: Json
          cluster_probability?: number | null
          created_at?: string
          expires_at?: string
          icd10_codes?: string[] | null
          id?: string
          input_hash: string
          medical_terms?: string[] | null
          model_used: string
          risk_score?: number | null
          symptoms_text: string
        }
        Update: {
          ai_response?: Json
          cluster_probability?: number | null
          created_at?: string
          expires_at?: string
          icd10_codes?: string[] | null
          id?: string
          input_hash?: string
          medical_terms?: string[] | null
          model_used?: string
          risk_score?: number | null
          symptoms_text?: string
        }
        Relationships: []
      }
      health_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          affected_regions: string[]
          alert_level: string
          cluster_id: string | null
          created_at: string
          description: string
          estimated_impact: string | null
          expires_at: string | null
          id: string
          is_acknowledged: boolean | null
          recommended_actions: string[] | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_regions: string[]
          alert_level: string
          cluster_id?: string | null
          created_at?: string
          description: string
          estimated_impact?: string | null
          expires_at?: string | null
          id?: string
          is_acknowledged?: boolean | null
          recommended_actions?: string[] | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_regions?: string[]
          alert_level?: string
          cluster_id?: string | null
          created_at?: string
          description?: string
          estimated_impact?: string | null
          expires_at?: string | null
          id?: string
          is_acknowledged?: boolean | null
          recommended_actions?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_alerts_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "outbreak_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      outbreak_clusters: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          dominant_symptoms: string[]
          first_detected: string
          growth_rate: number
          id: string
          is_active: boolean
          last_updated: string
          location_name: string
          radius: number
          report_count: number
          risk_score: number
          severity: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          dominant_symptoms: string[]
          first_detected?: string
          growth_rate?: number
          id?: string
          is_active?: boolean
          last_updated?: string
          location_name: string
          radius: number
          report_count?: number
          risk_score: number
          severity: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          dominant_symptoms?: string[]
          first_detected?: string
          growth_rate?: number
          id?: string
          is_active?: boolean
          last_updated?: string
          location_name?: string
          radius?: number
          report_count?: number
          risk_score?: number
          severity?: string
        }
        Relationships: []
      }
      symptom_reports: {
        Row: {
          age_range: string | null
          created_at: string
          description: string
          has_recent_travel: boolean | null
          id: string
          location_city: string
          location_country: string
          location_lat: number
          location_lng: number
          severity: number
          symptoms: string[]
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          description: string
          has_recent_travel?: boolean | null
          id?: string
          location_city: string
          location_country: string
          location_lat: number
          location_lng: number
          severity: number
          symptoms: string[]
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          created_at?: string
          description?: string
          has_recent_travel?: boolean | null
          id?: string
          location_city?: string
          location_country?: string
          location_lat?: number
          location_lng?: number
          severity?: number
          symptoms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
