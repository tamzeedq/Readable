
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "book_shelves": {
                  Row: {
                    "book_id": string,"created_at": string,"deleted_at": string | null,"shelf_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"deleted_at"?: string | null,"shelf_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"shelf_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_shelves_book_id_user_id_fkey"
      columns: ["book_id","user_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "book_shelves_shelf_id_user_id_fkey"
      columns: ["shelf_id","user_id"]
isOneToOne: false
      referencedRelation: "shelves"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"bookmarks": {
                  Row: {
                    "book_id": string,"created_at": string,"deleted_at": string | null,"id": string,"updated_at": string,"user_id": string,"word_index": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string,"user_id"?: string,"word_index": number
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"updated_at"?: string,"user_id"?: string,"word_index"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookmarks_book_id_user_id_fkey"
      columns: ["book_id","user_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"books": {
                  Row: {
                    "added_at": string,"appearance": Json | null,"author": string,"chapters": NonNullable<Json>,"content_hash": string | null,"cover_hue": number,"created_at": string,"deleted_at": string | null,"description": string | null,"finished_at": string | null,"format": string,"has_cover": boolean,"id": string,"last_read_at": string | null,"progress_word_index": number,"size_bytes": number,"skip_images": boolean | null,"storage_path": string | null,"tags": (string)[],"title": string,"updated_at": string,"user_id": string,"word_count": number,"wpm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"appearance"?: Json | null,"author"?: string,"chapters"?: NonNullable<Json>,"content_hash"?: string | null,"cover_hue"?: number,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"finished_at"?: string | null,"format": string,"has_cover"?: boolean,"id"?: string,"last_read_at"?: string | null,"progress_word_index"?: number,"size_bytes"?: number,"skip_images"?: boolean | null,"storage_path"?: string | null,"tags"?: (string)[],"title": string,"updated_at"?: string,"user_id"?: string,"word_count"?: number,"wpm"?: number | null
                  }
                  Update: {
                    "added_at"?: string,"appearance"?: Json | null,"author"?: string,"chapters"?: NonNullable<Json>,"content_hash"?: string | null,"cover_hue"?: number,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"finished_at"?: string | null,"format"?: string,"has_cover"?: boolean,"id"?: string,"last_read_at"?: string | null,"progress_word_index"?: number,"size_bytes"?: number,"skip_images"?: boolean | null,"storage_path"?: string | null,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"user_id"?: string,"word_count"?: number,"wpm"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"preferences": {
                  Row: {
                    "appearance": NonNullable<Json>,"created_at": string,"extra": NonNullable<Json>,"palette": string | null,"reading": NonNullable<Json>,"theme_mode": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appearance"?: NonNullable<Json>,"created_at"?: string,"extra"?: NonNullable<Json>,"palette"?: string | null,"reading"?: NonNullable<Json>,"theme_mode"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "appearance"?: NonNullable<Json>,"created_at"?: string,"extra"?: NonNullable<Json>,"palette"?: string | null,"reading"?: NonNullable<Json>,"theme_mode"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reading_progress": {
                  Row: {
                    "book_id": string,"created_at": string,"last_read_at": string | null,"updated_at": string,"user_id": string,"word_index": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"last_read_at"?: string | null,"updated_at"?: string,"user_id"?: string,"word_index"?: number
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"last_read_at"?: string | null,"updated_at"?: string,"user_id"?: string,"word_index"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reading_progress_book_id_user_id_fkey"
      columns: ["book_id","user_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"reading_sessions": {
                  Row: {
                    "book_id": string,"created_at": string,"day": string,"ms": number,"updated_at": string,"user_id": string,"words": number
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string,"day": string,"ms"?: number,"updated_at"?: string,"user_id"?: string,"words"?: number
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"day"?: string,"ms"?: number,"updated_at"?: string,"user_id"?: string,"words"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reading_sessions_book_id_user_id_fkey"
      columns: ["book_id","user_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"shelves": {
                  Row: {
                    "color": string,"created_at": string,"deleted_at": string | null,"id": string,"name": string,"note": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"note"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"note"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
