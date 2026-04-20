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
      access_attempts: {
        Row: {
          attempted_at: string
          event_code: string
          id: string
          ip_address: string
        }
        Insert: {
          attempted_at?: string
          event_code: string
          id?: string
          ip_address: string
        }
        Update: {
          attempted_at?: string
          event_code?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      activity_quiz_answers: {
        Row: {
          correct_answer: string
          created_at: string
          quiz_id: string
          updated_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          quiz_id: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          quiz_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_quiz_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: true
            referencedRelation: "activity_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_quizzes: {
        Row: {
          activity_id: string
          created_at: string | null
          display_order: number | null
          id: string
          options: Json | null
          question_text: string
          question_type: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          options?: Json | null
          question_text: string
          question_type?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_quizzes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          event_id: string
          id: string
          last_edited_at: string | null
          last_resent_at: string | null
          reach: string | null
          reach_count: number
          scheduled_for: string | null
          sent_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          event_id: string
          id?: string
          last_edited_at?: string | null
          last_resent_at?: string | null
          reach?: string | null
          reach_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          event_id?: string
          id?: string
          last_edited_at?: string | null
          last_resent_at?: string | null
          reach?: string | null
          reach_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_checkins: {
        Row: {
          activity_id: string
          attendee_id: string
          certificate_generated: boolean | null
          certificate_url: string | null
          checked_in_at: string | null
          id: string
          quiz_responses: Json | null
          quiz_score: number | null
        }
        Insert: {
          activity_id: string
          attendee_id: string
          certificate_generated?: boolean | null
          certificate_url?: string | null
          checked_in_at?: string | null
          id?: string
          quiz_responses?: Json | null
          quiz_score?: number | null
        }
        Update: {
          activity_id?: string
          attendee_id?: string
          certificate_generated?: boolean | null
          certificate_url?: string | null
          checked_in_at?: string | null
          id?: string
          quiz_responses?: Json | null
          quiz_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendee_checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_checkins_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_checkins_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_notes: {
        Row: {
          content: string | null
          event_id: string
          id: string
          session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          event_id: string
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          event_id?: string
          id?: string
          session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_services: {
        Row: {
          attendee_id: string
          created_at: string | null
          id: string
          notes: string | null
          provider_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          service_catalog_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          provider_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_catalog_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          provider_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_catalog_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendee_services_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_services_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_service_catalog"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_service_catalog"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      attendees: {
        Row: {
          access_code_hash: string | null
          check_in_date: string | null
          created_at: string | null
          credential_code: string
          deleted_at: string | null
          document_number: string | null
          document_type: string | null
          email: string
          event_id: string
          external_credential_code: string | null
          full_name: string
          id: string
          institution: string | null
          invitation_sent_at: string | null
          last_session_id: string | null
          notes: string | null
          phone: string | null
          registration_date: string | null
          registration_status: string | null
          selected_package_id: string | null
          specialty: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_code_hash?: string | null
          check_in_date?: string | null
          created_at?: string | null
          credential_code: string
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email: string
          event_id: string
          external_credential_code?: string | null
          full_name: string
          id?: string
          institution?: string | null
          invitation_sent_at?: string | null
          last_session_id?: string | null
          notes?: string | null
          phone?: string | null
          registration_date?: string | null
          registration_status?: string | null
          selected_package_id?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_code_hash?: string | null
          check_in_date?: string | null
          created_at?: string | null
          credential_code?: string
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string
          event_id?: string
          external_credential_code?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          invitation_sent_at?: string | null
          last_session_id?: string | null
          notes?: string | null
          phone?: string | null
          registration_date?: string | null
          registration_status?: string | null
          selected_package_id?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendees_selected_package_id_fkey"
            columns: ["selected_package_id"]
            isOneToOne: false
            referencedRelation: "event_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          message_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          message_id: string
          storage_path: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          message_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          conversation_type: string | null
          created_at: string | null
          created_by: string | null
          deleted_by_initiator: boolean | null
          deleted_by_participant: boolean | null
          event_id: string | null
          id: string
          initiated_by: string | null
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          organization_id: string
          participant_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          conversation_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_by_initiator?: boolean | null
          deleted_by_participant?: boolean | null
          event_id?: string | null
          id?: string
          initiated_by?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          organization_id: string
          participant_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          conversation_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_by_initiator?: boolean | null
          deleted_by_participant?: boolean | null
          event_id?: string | null
          id?: string
          initiated_by?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          organization_id?: string
          participant_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          connected_at: string | null
          contact_id: string
          created_at: string | null
          event_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          contact_id: string
          created_at?: string | null
          event_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          contact_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          description: string | null
          download_count: number
          event_id: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          session_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          download_count?: number
          event_id: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          session_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          download_count?: number
          event_id?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          session_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_activities: {
        Row: {
          activity_type: string | null
          archived_at: string | null
          capacity: number | null
          checkin_code: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          event_id: string
          id: string
          location: string | null
          requires_checkin: boolean | null
          scheduled_date: string
          sort_order: number
          speaker_bio: string | null
          speaker_name: string | null
          speaker_photo_url: string | null
          start_time: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          archived_at?: string | null
          capacity?: number | null
          checkin_code?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          location?: string | null
          requires_checkin?: boolean | null
          scheduled_date: string
          sort_order?: number
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          archived_at?: string | null
          capacity?: number | null
          checkin_code?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          location?: string | null
          requires_checkin?: boolean | null
          scheduled_date?: string
          sort_order?: number
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_packages: {
        Row: {
          base_price: number
          created_at: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          event_id: string
          id: string
          included_services: Json | null
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          event_id: string
          id?: string
          included_services?: Json | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          event_id?: string
          id?: string
          included_services?: Json | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_packages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          event_id: string
          id: string
          is_active: boolean | null
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          role: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          end_date: string
          event_code: string
          id: string
          max_attendees: number | null
          name: string
          organization_id: string
          settings: Json | null
          start_date: string
          status: string | null
          updated_at: string | null
          venue_address: string | null
          venue_coordinates: Json | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date: string
          event_code: string
          id?: string
          max_attendees?: number | null
          name: string
          organization_id: string
          settings?: Json | null
          start_date: string
          status?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_coordinates?: Json | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string
          event_code?: string
          id?: string
          max_attendees?: number | null
          name?: string
          organization_id?: string
          settings?: Json | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_coordinates?: Json | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          conversation_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string
          organization_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type: string
          organization_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          conversation_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          organization_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          is_active: boolean
          option_text: string
          order_index: number
          poll_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          option_text: string
          order_index?: number
          poll_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          option_text?: string
          order_index?: number
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          attendee_id: string
          created_at: string | null
          id: string
          option_id: string | null
          poll_id: string
          text_response: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          id?: string
          option_id?: string | null
          poll_id: string
          text_response?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          id?: string
          option_id?: string | null
          poll_id?: string
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          created_at: string | null
          created_by: string | null
          event_id: string
          id: string
          opens_at: string | null
          poll_type: string
          question: string
          results_visibility: string
          session_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id: string
          id?: string
          opens_at?: string | null
          poll_type?: string
          question: string
          results_visibility?: string
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string | null
          created_by?: string | null
          event_id?: string
          id?: string
          opens_at?: string | null
          poll_type?: string
          question?: string
          results_visibility?: string
          session_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          preferred_language: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          event_id: string
          id: string
          metadata: Json | null
          provider_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json | null
          provider_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json | null
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_activity_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          created_at: string | null
          id: string
          provider_id: string
          service_catalog_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider_id: string
          service_catalog_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          provider_id?: string
          service_catalog_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_service_catalog_id_fkey"
            columns: ["service_catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          access_code: string
          access_expires_at: string | null
          category: string
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          event_id: string
          id: string
          is_active: boolean | null
          last_login: string | null
          login_count: number
          password_changed: boolean
          user_id: string | null
        }
        Insert: {
          access_code: string
          access_expires_at?: string | null
          category: string
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          login_count?: number
          password_changed?: boolean
          user_id?: string | null
        }
        Update: {
          access_code?: string
          access_expires_at?: string | null
          category?: string
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          login_count?: number
          password_changed?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          subscription_json: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          subscription_json: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          subscription_json?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          event_id: string
          id: string
          session_id: string
          stars: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          session_id: string
          stars: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          session_id?: string
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit: {
        Row: {
          action: string
          details: Json | null
          id: string
          organization_id: string | null
          performed_at: string | null
          performed_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          action: string
          details?: Json | null
          id?: string
          organization_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          action?: string
          details?: Json | null
          id?: string
          organization_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          location: string | null
          name: string
          service_type: string
          status: string
          valid_day: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          location?: string | null
          name: string
          service_type: string
          status?: string
          valid_day?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          location?: string | null
          name?: string
          service_type?: string
          status?: string
          valid_day?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      service_tickets: {
        Row: {
          attendee_service_id: string
          created_at: string | null
          id: string
          is_used: boolean | null
          qr_data: string
          ticket_code: string
          used_at: string | null
          validated_by: string | null
        }
        Insert: {
          attendee_service_id: string
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          qr_data: string
          ticket_code: string
          used_at?: string | null
          validated_by?: string | null
        }
        Update: {
          attendee_service_id?: string
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          qr_data?: string
          ticket_code?: string
          used_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_attendee_service_id_fkey"
            columns: ["attendee_service_id"]
            isOneToOne: false
            referencedRelation: "attendee_services"
            referencedColumns: ["id"]
          },
        ]
      }
      session_interests: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_interests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_leads: {
        Row: {
          attendee_id: string
          contacted_at: string | null
          created_at: string
          event_id: string
          id: string
          note: string | null
          sponsor_id: string
        }
        Insert: {
          attendee_id: string
          contacted_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          sponsor_id: string
        }
        Update: {
          attendee_id?: string
          contacted_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_leads_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_leads_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "public_attendee_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_leads_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          category: string
          contact_email: string | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          level: string
          logo_url: string | null
          materials_downloads: number
          materials_url: string | null
          name: string
          profile_views: number
          social_instagram: string | null
          social_linkedin: string | null
          social_twitter: string | null
          stand_location: string | null
          video_url: string | null
          website_clicks: number
          website_url: string | null
          whatsapp: string | null
          whatsapp_clicks: number
          whatsapp_message: string | null
        }
        Insert: {
          category: string
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          level: string
          logo_url?: string | null
          materials_downloads?: number
          materials_url?: string | null
          name: string
          profile_views?: number
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          stand_location?: string | null
          video_url?: string | null
          website_clicks?: number
          website_url?: string | null
          whatsapp?: string | null
          whatsapp_clicks?: number
          whatsapp_message?: string | null
        }
        Update: {
          category?: string
          contact_email?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          level?: string
          logo_url?: string | null
          materials_downloads?: number
          materials_url?: string | null
          name?: string
          profile_views?: number
          social_instagram?: string | null
          social_linkedin?: string | null
          social_twitter?: string | null
          stand_location?: string | null
          video_url?: string | null
          website_clicks?: number
          website_url?: string | null
          whatsapp?: string | null
          whatsapp_clicks?: number
          whatsapp_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          access_expires_at: string | null
          assigned_room: string | null
          contact_email: string
          created_at: string | null
          event_id: string
          full_name: string
          id: string
          invitation_status: string | null
          is_active: boolean
          last_login: string | null
          user_id: string | null
        }
        Insert: {
          access_expires_at?: string | null
          assigned_room?: string | null
          contact_email: string
          created_at?: string | null
          event_id: string
          full_name: string
          id?: string
          invitation_status?: string | null
          is_active?: boolean
          last_login?: string | null
          user_id?: string | null
        }
        Update: {
          access_expires_at?: string | null
          assigned_room?: string | null
          contact_email?: string
          created_at?: string | null
          event_id?: string
          full_name?: string
          id?: string
          invitation_status?: string | null
          is_active?: boolean
          last_login?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_attendee_directory: {
        Row: {
          event_id: string | null
          full_name: string | null
          id: string | null
          institution: string | null
          registration_status: string | null
          specialty: string | null
        }
        Insert: {
          event_id?: string | null
          full_name?: string | null
          id?: string | null
          institution?: string | null
          registration_status?: string | null
          specialty?: string | null
        }
        Update: {
          event_id?: string | null
          full_name?: string | null
          id?: string | null
          institution?: string | null
          registration_status?: string | null
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_with_status: {
        Row: {
          created_at: string | null
          description: string | null
          effective_status: string | null
          event_id: string | null
          id: string | null
          location: string | null
          name: string | null
          service_type: string | null
          status: string | null
          valid_day: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          effective_status?: never
          event_id?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
          service_type?: string | null
          status?: string | null
          valid_day?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          effective_status?: never
          event_id?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
          service_type?: string | null
          status?: string | null
          valid_day?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_or_create_contact: {
        Args: { _event_id: string; _target_attendee_id: string }
        Returns: Json
      }
      cleanup_old_attempts: { Args: never; Returns: undefined }
      create_attendee_credential: {
        Args: { _attendee_id: string }
        Returns: string
      }
      get_attendee_itinerary: { Args: { _attendee_id: string }; Returns: Json }
      get_event_statistics: { Args: { _event_id: string }; Returns: Json }
      get_my_attendee_ids: { Args: never; Returns: string[] }
      get_my_event_ids: { Args: never; Returns: string[] }
      get_or_create_conversation: {
        Args: {
          _conversation_type?: string
          _event_id?: string
          _organization_id: string
          _participant_ids: string[]
        }
        Returns: string
      }
      get_poll_aggregate: {
        Args: { _poll_id: string }
        Returns: {
          option_id: string
          option_text: string
          response_count: number
        }[]
      }
      get_provider_assigned_services: {
        Args: { _provider_id: string }
        Returns: Json
      }
      get_provider_attendee_ids: { Args: never; Returns: string[] }
      get_provider_service_attendees: {
        Args: { _provider_id: string; _service_catalog_id: string }
        Returns: Json
      }
      get_session_interest_counts: {
        Args: { _event_id: string }
        Returns: {
          interest_count: number
          session_id: string
        }[]
      }
      get_unread_count: { Args: { _user_id: string }; Returns: number }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          organization_id: string
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_roles: { Args: { _user_id: string }; Returns: string[] }
      get_user_roles_with_metadata: {
        Args: { _language?: string; _user_id: string }
        Returns: {
          description: string
          display_name: string
          icon: string
          organization_id: string
          organization_name: string
          redirect_path: string
          requires_organization: boolean
          role: string
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_staff: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      log_provider_activity: {
        Args: { _activity_type: string; _metadata?: Json }
        Returns: undefined
      }
      mark_activity_complete: {
        Args: { _checkin_id: string }
        Returns: boolean
      }
      mark_lead_contacted: { Args: { _lead_id: string }; Returns: undefined }
      mark_messages_as_read: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: undefined
      }
      process_checkin: {
        Args: {
          _activity_id: string
          _attendee_id: string
          _quiz_responses: Json
        }
        Returns: Json
      }
      provider_validate_ticket: {
        Args: { _attendee_service_id: string; _provider_id: string }
        Returns: Json
      }
      purge_old_provider_activity_logs: { Args: never; Returns: number }
      validate_service_ticket: {
        Args: { _ticket_code: string; _validator_user_id: string }
        Returns: Json
      }
      verify_provider_access: {
        Args: { _access_code: string; _event_code: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "superuser"
        | "admin"
        | "coordinator"
        | "field_manager"
        | "provider"
        | "attendee"
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
    Enums: {
      app_role: [
        "superuser",
        "admin",
        "coordinator",
        "field_manager",
        "provider",
        "attendee",
      ],
    },
  },
} as const
