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
      admin_subscription_plans: {
        Row: {
          billing_type: string
          created_at: string | null
          duration_days: number | null
          features: Json | null
          funnel_limit: number | null
          id: string
          is_active: boolean | null
          label: string
          landing_page_limit: number | null
          live_session_limit: number | null
          multi_step_funnel_enabled: boolean
          plan_key: string
          price_inr: number
          tier: string
          video_limit: number | null
          video_max_size_mb: number | null
        }
        Insert: {
          billing_type: string
          created_at?: string | null
          duration_days?: number | null
          features?: Json | null
          funnel_limit?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          landing_page_limit?: number | null
          live_session_limit?: number | null
          multi_step_funnel_enabled?: boolean
          plan_key: string
          price_inr: number
          tier: string
          video_limit?: number | null
          video_max_size_mb?: number | null
        }
        Update: {
          billing_type?: string
          created_at?: string | null
          duration_days?: number | null
          features?: Json | null
          funnel_limit?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          landing_page_limit?: number | null
          live_session_limit?: number | null
          multi_step_funnel_enabled?: boolean
          plan_key?: string
          price_inr?: number
          tier?: string
          video_limit?: number | null
          video_max_size_mb?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      funnel_access_logs: {
        Row: {
          attempted_at: string | null
          code_attempted: string | null
          funnel_id: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string | null
          code_attempted?: string | null
          funnel_id: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string | null
          code_attempted?: string | null
          funnel_id?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "funnel_access_logs_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_lead_form_config: {
        Row: {
          capture_enabled: boolean | null
          capture_timing: string | null
          city_required: boolean | null
          custom_field_label: string | null
          custom_required: boolean | null
          email_required: boolean | null
          funnel_id: string
          id: string
          name_required: boolean | null
          phone_required: boolean | null
          show_city: boolean | null
          show_custom: boolean | null
          show_email: boolean | null
          show_name: boolean | null
          show_phone: boolean | null
        }
        Insert: {
          capture_enabled?: boolean | null
          capture_timing?: string | null
          city_required?: boolean | null
          custom_field_label?: string | null
          custom_required?: boolean | null
          email_required?: boolean | null
          funnel_id: string
          id?: string
          name_required?: boolean | null
          phone_required?: boolean | null
          show_city?: boolean | null
          show_custom?: boolean | null
          show_email?: boolean | null
          show_name?: boolean | null
          show_phone?: boolean | null
        }
        Update: {
          capture_enabled?: boolean | null
          capture_timing?: string | null
          city_required?: boolean | null
          custom_field_label?: string | null
          custom_required?: boolean | null
          email_required?: boolean | null
          funnel_id?: string
          id?: string
          name_required?: boolean | null
          phone_required?: boolean | null
          show_city?: boolean | null
          show_custom?: boolean | null
          show_email?: boolean | null
          show_name?: boolean | null
          show_phone?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_lead_form_config_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: true
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_leads: {
        Row: {
          city: string | null
          custom_value: string | null
          device_type: string | null
          email: string | null
          funnel_id: string
          id: string
          ip_address: string | null
          name: string | null
          notes: string | null
          phone: string | null
          status: string | null
          submitted_at: string | null
          tagged_at: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          watch_progress_at_submit: number | null
        }
        Insert: {
          city?: string | null
          custom_value?: string | null
          device_type?: string | null
          email?: string | null
          funnel_id: string
          id?: string
          ip_address?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          submitted_at?: string | null
          tagged_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          watch_progress_at_submit?: number | null
        }
        Update: {
          city?: string | null
          custom_value?: string | null
          device_type?: string | null
          email?: string | null
          funnel_id?: string
          id?: string
          ip_address?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          submitted_at?: string | null
          tagged_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          watch_progress_at_submit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_leads_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_payments: {
        Row: {
          amount: number
          funnel_id: string
          id: string
          lead_id: string | null
          payment_type: string | null
          rejection_note: string | null
          screenshot_url: string | null
          selected_price_option_id: string | null
          status: string | null
          submitted_at: string | null
          upi_transaction_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          funnel_id: string
          id?: string
          lead_id?: string | null
          payment_type?: string | null
          rejection_note?: string | null
          screenshot_url?: string | null
          selected_price_option_id?: string | null
          status?: string | null
          submitted_at?: string | null
          upi_transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          funnel_id?: string
          id?: string
          lead_id?: string | null
          payment_type?: string | null
          rejection_note?: string | null
          screenshot_url?: string | null
          selected_price_option_id?: string | null
          status?: string | null
          submitted_at?: string | null
          upi_transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_payments_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_payments_selected_price_option_id_fkey"
            columns: ["selected_price_option_id"]
            isOneToOne: false
            referencedRelation: "funnel_price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_price_options: {
        Row: {
          amount: number
          description: string | null
          funnel_id: string
          id: string
          label: string
          position: number | null
        }
        Insert: {
          amount: number
          description?: string | null
          funnel_id: string
          id?: string
          label: string
          position?: number | null
        }
        Update: {
          amount?: number
          description?: string | null
          funnel_id?: string
          id?: string
          label?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_price_options_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_step_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          funnel_id: string
          funnel_step_id: string
          id: string
          last_position_seconds: number | null
          lead_id: string | null
          manually_unlocked: boolean | null
          max_watched_seconds: number | null
          session_id: string | null
          status: string
          unlock_scheduled_at: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
          watched_percentage: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          funnel_id: string
          funnel_step_id: string
          id?: string
          last_position_seconds?: number | null
          lead_id?: string | null
          manually_unlocked?: boolean | null
          max_watched_seconds?: number | null
          session_id?: string | null
          status?: string
          unlock_scheduled_at?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          watched_percentage?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          funnel_id?: string
          funnel_step_id?: string
          id?: string
          last_position_seconds?: number | null
          lead_id?: string | null
          manually_unlocked?: boolean | null
          max_watched_seconds?: number | null
          session_id?: string | null
          status?: string
          unlock_scheduled_at?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          watched_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_step_progress_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_step_progress_funnel_step_id_fkey"
            columns: ["funnel_step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_step_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_steps: {
        Row: {
          between_step_audio_enabled: boolean | null
          between_step_audio_url: string | null
          between_step_message: string | null
          between_step_message_enabled: boolean | null
          booking_url: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          description: string | null
          funnel_id: string
          id: string
          is_active: boolean
          step_order: number
          step_type: string
          title: string
          unlock_after_percent: number | null
          unlock_rule_type: string
          unlock_rule_value: string | null
          unlock_timer_minutes: number | null
          updated_at: string
          video_asset_id: string | null
        }
        Insert: {
          between_step_audio_enabled?: boolean | null
          between_step_audio_url?: string | null
          between_step_message?: string | null
          between_step_message_enabled?: boolean | null
          booking_url?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          funnel_id: string
          id?: string
          is_active?: boolean
          step_order?: number
          step_type?: string
          title?: string
          unlock_after_percent?: number | null
          unlock_rule_type?: string
          unlock_rule_value?: string | null
          unlock_timer_minutes?: number | null
          updated_at?: string
          video_asset_id?: string | null
        }
        Update: {
          between_step_audio_enabled?: boolean | null
          between_step_audio_url?: string | null
          between_step_message?: string | null
          between_step_message_enabled?: boolean | null
          booking_url?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          funnel_id?: string
          id?: string
          is_active?: boolean
          step_order?: number
          step_type?: string
          title?: string
          unlock_after_percent?: number | null
          unlock_rule_type?: string
          unlock_rule_value?: string | null
          unlock_timer_minutes?: number | null
          updated_at?: string
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_steps_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_video_analytics: {
        Row: {
          device_type: string | null
          event_type: string
          funnel_id: string
          id: string
          lead_id: string | null
          progress_percent: number | null
          recorded_at: string | null
          session_id: string
          watch_seconds: number | null
        }
        Insert: {
          device_type?: string | null
          event_type: string
          funnel_id: string
          id?: string
          lead_id?: string | null
          progress_percent?: number | null
          recorded_at?: string | null
          session_id: string
          watch_seconds?: number | null
        }
        Update: {
          device_type?: string | null
          event_type?: string
          funnel_id?: string
          id?: string
          lead_id?: string | null
          progress_percent?: number | null
          recorded_at?: string | null
          session_id?: string
          watch_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_video_analytics_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_video_analytics_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          access_code_plain: string | null
          allow_seek: boolean | null
          allow_speed_change: boolean | null
          audio_lock_video: boolean | null
          audio_note_autoplay: boolean | null
          audio_note_timing: string | null
          audio_note_url: string | null
          broadcast_password: string | null
          broadcast_replay_enabled: boolean | null
          broadcast_scheduled_at: string | null
          broadcast_status: string | null
          contact_instagram: string | null
          contact_phone: string | null
          contact_whatsapp: string | null
          created_at: string | null
          cta_enabled: boolean | null
          cta_text: string | null
          cta_timing_seconds: number | null
          cta_url: string | null
          description: string | null
          funnel_mode: string
          id: string
          intent_type: string | null
          is_live_broadcast: boolean | null
          is_published: boolean | null
          lock_cta: boolean | null
          owner_id: string
          password_hash: string | null
          payment_enabled: boolean | null
          payment_instructions: string | null
          qr_code_url: string | null
          required_fields: Json | null
          show_contact_after_cta: boolean | null
          show_contact_buttons: boolean | null
          slug: string
          speaker_about: string | null
          speaker_mode: string
          speaker_name: string | null
          speaker_photo_url: string | null
          thumbnail_url: string | null
          title: string
          total_leads: number | null
          total_payments: number | null
          total_play_time_seconds: number | null
          total_views: number | null
          updated_at: string | null
          upi_id: string | null
          video_access_minutes: number | null
          video_asset_id: string | null
          video_topics: Json | null
          video_topics_enabled: boolean
          visibility: string | null
          whatsapp_auto_message: boolean | null
          whatsapp_message_template: string | null
        }
        Insert: {
          access_code_plain?: string | null
          allow_seek?: boolean | null
          allow_speed_change?: boolean | null
          audio_lock_video?: boolean | null
          audio_note_autoplay?: boolean | null
          audio_note_timing?: string | null
          audio_note_url?: string | null
          broadcast_password?: string | null
          broadcast_replay_enabled?: boolean | null
          broadcast_scheduled_at?: string | null
          broadcast_status?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          cta_enabled?: boolean | null
          cta_text?: string | null
          cta_timing_seconds?: number | null
          cta_url?: string | null
          description?: string | null
          funnel_mode?: string
          id?: string
          intent_type?: string | null
          is_live_broadcast?: boolean | null
          is_published?: boolean | null
          lock_cta?: boolean | null
          owner_id: string
          password_hash?: string | null
          payment_enabled?: boolean | null
          payment_instructions?: string | null
          qr_code_url?: string | null
          required_fields?: Json | null
          show_contact_after_cta?: boolean | null
          show_contact_buttons?: boolean | null
          slug: string
          speaker_about?: string | null
          speaker_mode?: string
          speaker_name?: string | null
          speaker_photo_url?: string | null
          thumbnail_url?: string | null
          title: string
          total_leads?: number | null
          total_payments?: number | null
          total_play_time_seconds?: number | null
          total_views?: number | null
          updated_at?: string | null
          upi_id?: string | null
          video_access_minutes?: number | null
          video_asset_id?: string | null
          video_topics?: Json | null
          video_topics_enabled?: boolean
          visibility?: string | null
          whatsapp_auto_message?: boolean | null
          whatsapp_message_template?: string | null
        }
        Update: {
          access_code_plain?: string | null
          allow_seek?: boolean | null
          allow_speed_change?: boolean | null
          audio_lock_video?: boolean | null
          audio_note_autoplay?: boolean | null
          audio_note_timing?: string | null
          audio_note_url?: string | null
          broadcast_password?: string | null
          broadcast_replay_enabled?: boolean | null
          broadcast_scheduled_at?: string | null
          broadcast_status?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          cta_enabled?: boolean | null
          cta_text?: string | null
          cta_timing_seconds?: number | null
          cta_url?: string | null
          description?: string | null
          funnel_mode?: string
          id?: string
          intent_type?: string | null
          is_live_broadcast?: boolean | null
          is_published?: boolean | null
          lock_cta?: boolean | null
          owner_id?: string
          password_hash?: string | null
          payment_enabled?: boolean | null
          payment_instructions?: string | null
          qr_code_url?: string | null
          required_fields?: Json | null
          show_contact_after_cta?: boolean | null
          show_contact_buttons?: boolean | null
          slug?: string
          speaker_about?: string | null
          speaker_mode?: string
          speaker_name?: string | null
          speaker_photo_url?: string | null
          thumbnail_url?: string | null
          title?: string
          total_leads?: number | null
          total_payments?: number | null
          total_play_time_seconds?: number | null
          total_views?: number | null
          updated_at?: string | null
          upi_id?: string | null
          video_access_minutes?: number | null
          video_asset_id?: string | null
          video_topics?: Json | null
          video_topics_enabled?: boolean
          visibility?: string | null
          whatsapp_auto_message?: boolean | null
          whatsapp_message_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnels_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_code_uses: {
        Row: {
          code: string
          id: string
          invite_code_id: string
          used_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          id?: string
          invite_code_id: string
          used_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          invite_code_id?: string
          used_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_uses_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          max_uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_registrations: {
        Row: {
          age: string | null
          city: string | null
          confirmation_email_sent: boolean | null
          confirmation_email_sent_at: string | null
          custom_1_value: string | null
          custom_2_value: string | null
          device_type: string | null
          email: string | null
          honeypot_triggered: boolean | null
          id: string
          ip_address: string | null
          landing_page_id: string
          name: string | null
          occupation: string | null
          owner_id: string
          phone: string | null
          referrer_url: string | null
          state: string | null
          submitted_at: string | null
          user_agent: string | null
          user_id: string | null
          video_completed: boolean | null
          video_started: boolean | null
          video_watch_percentage: number | null
        }
        Insert: {
          age?: string | null
          city?: string | null
          confirmation_email_sent?: boolean | null
          confirmation_email_sent_at?: string | null
          custom_1_value?: string | null
          custom_2_value?: string | null
          device_type?: string | null
          email?: string | null
          honeypot_triggered?: boolean | null
          id?: string
          ip_address?: string | null
          landing_page_id: string
          name?: string | null
          occupation?: string | null
          owner_id: string
          phone?: string | null
          referrer_url?: string | null
          state?: string | null
          submitted_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          video_completed?: boolean | null
          video_started?: boolean | null
          video_watch_percentage?: number | null
        }
        Update: {
          age?: string | null
          city?: string | null
          confirmation_email_sent?: boolean | null
          confirmation_email_sent_at?: string | null
          custom_1_value?: string | null
          custom_2_value?: string | null
          device_type?: string | null
          email?: string | null
          honeypot_triggered?: boolean | null
          id?: string
          ip_address?: string | null
          landing_page_id?: string
          name?: string | null
          occupation?: string | null
          owner_id?: string
          phone?: string | null
          referrer_url?: string | null
          state?: string | null
          submitted_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          video_completed?: boolean | null
          video_started?: boolean | null
          video_watch_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_registrations_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_registrations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_testimonials: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          landing_page_id: string
          owner_id: string
          placement: string
          rating: number
          review_text: string | null
          student_location: string | null
          student_name: string
          student_photo_url: string | null
          thumbnail_url: string | null
          type: string
          updated_at: string | null
          video_duration_seconds: number | null
          video_height: number | null
          video_orientation: string | null
          video_url: string | null
          video_width: number | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          landing_page_id: string
          owner_id: string
          placement?: string
          rating?: number
          review_text?: string | null
          student_location?: string | null
          student_name: string
          student_photo_url?: string | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_height?: number | null
          video_orientation?: string | null
          video_url?: string | null
          video_width?: number | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          landing_page_id?: string
          owner_id?: string
          placement?: string
          rating?: number
          review_text?: string | null
          student_location?: string | null
          student_name?: string
          student_photo_url?: string | null
          thumbnail_url?: string | null
          type?: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_height?: number | null
          video_orientation?: string | null
          video_url?: string | null
          video_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_testimonials_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_testimonials_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_view_logs: {
        Row: {
          id: string
          ip_address: string | null
          landing_page_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          landing_page_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          landing_page_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_view_logs_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          allow_login: boolean | null
          allow_signup: boolean | null
          background_style: string | null
          created_at: string | null
          description: string | null
          email_body: string | null
          email_footer_text: string | null
          email_heading: string | null
          email_subject: string | null
          field_age_enabled: boolean | null
          field_age_required: boolean | null
          field_city_enabled: boolean | null
          field_city_required: boolean | null
          field_custom_1_enabled: boolean | null
          field_custom_1_label: string | null
          field_custom_1_required: boolean | null
          field_custom_2_enabled: boolean | null
          field_custom_2_label: string | null
          field_custom_2_required: boolean | null
          field_email_enabled: boolean | null
          field_email_required: boolean | null
          field_name_enabled: boolean | null
          field_name_required: boolean | null
          field_occupation_enabled: boolean | null
          field_occupation_required: boolean | null
          field_phone_enabled: boolean | null
          field_phone_required: boolean | null
          field_state_enabled: boolean | null
          field_state_required: boolean | null
          form_button_text: string | null
          form_subtitle: string | null
          form_title: string | null
          id: string
          invite_code: string | null
          invite_code_required: boolean | null
          linked_funnel_id: string | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          owner_id: string
          post_submit_video_asset_id: string | null
          post_submit_video_description: string | null
          post_submit_video_title: string | null
          sections: Json | null
          send_confirmation_email: boolean | null
          sender_display_name: string | null
          slug: string
          speaker_bio: string | null
          speaker_name: string | null
          speaker_photo_url: string | null
          speaker_role: string | null
          status: string
          testimonials_display_position: string
          testimonials_enabled: boolean | null
          testimonials_section_title: string | null
          theme_color: string | null
          title: string
          total_registrations: number | null
          total_views: number | null
          updated_at: string | null
        }
        Insert: {
          allow_login?: boolean | null
          allow_signup?: boolean | null
          background_style?: string | null
          created_at?: string | null
          description?: string | null
          email_body?: string | null
          email_footer_text?: string | null
          email_heading?: string | null
          email_subject?: string | null
          field_age_enabled?: boolean | null
          field_age_required?: boolean | null
          field_city_enabled?: boolean | null
          field_city_required?: boolean | null
          field_custom_1_enabled?: boolean | null
          field_custom_1_label?: string | null
          field_custom_1_required?: boolean | null
          field_custom_2_enabled?: boolean | null
          field_custom_2_label?: string | null
          field_custom_2_required?: boolean | null
          field_email_enabled?: boolean | null
          field_email_required?: boolean | null
          field_name_enabled?: boolean | null
          field_name_required?: boolean | null
          field_occupation_enabled?: boolean | null
          field_occupation_required?: boolean | null
          field_phone_enabled?: boolean | null
          field_phone_required?: boolean | null
          field_state_enabled?: boolean | null
          field_state_required?: boolean | null
          form_button_text?: string | null
          form_subtitle?: string | null
          form_title?: string | null
          id?: string
          invite_code?: string | null
          invite_code_required?: boolean | null
          linked_funnel_id?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          owner_id: string
          post_submit_video_asset_id?: string | null
          post_submit_video_description?: string | null
          post_submit_video_title?: string | null
          sections?: Json | null
          send_confirmation_email?: boolean | null
          sender_display_name?: string | null
          slug: string
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          speaker_role?: string | null
          status?: string
          testimonials_display_position?: string
          testimonials_enabled?: boolean | null
          testimonials_section_title?: string | null
          theme_color?: string | null
          title: string
          total_registrations?: number | null
          total_views?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_login?: boolean | null
          allow_signup?: boolean | null
          background_style?: string | null
          created_at?: string | null
          description?: string | null
          email_body?: string | null
          email_footer_text?: string | null
          email_heading?: string | null
          email_subject?: string | null
          field_age_enabled?: boolean | null
          field_age_required?: boolean | null
          field_city_enabled?: boolean | null
          field_city_required?: boolean | null
          field_custom_1_enabled?: boolean | null
          field_custom_1_label?: string | null
          field_custom_1_required?: boolean | null
          field_custom_2_enabled?: boolean | null
          field_custom_2_label?: string | null
          field_custom_2_required?: boolean | null
          field_email_enabled?: boolean | null
          field_email_required?: boolean | null
          field_name_enabled?: boolean | null
          field_name_required?: boolean | null
          field_occupation_enabled?: boolean | null
          field_occupation_required?: boolean | null
          field_phone_enabled?: boolean | null
          field_phone_required?: boolean | null
          field_state_enabled?: boolean | null
          field_state_required?: boolean | null
          form_button_text?: string | null
          form_subtitle?: string | null
          form_title?: string | null
          id?: string
          invite_code?: string | null
          invite_code_required?: boolean | null
          linked_funnel_id?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          owner_id?: string
          post_submit_video_asset_id?: string | null
          post_submit_video_description?: string | null
          post_submit_video_title?: string | null
          sections?: Json | null
          send_confirmation_email?: boolean | null
          sender_display_name?: string | null
          slug?: string
          speaker_bio?: string | null
          speaker_name?: string | null
          speaker_photo_url?: string | null
          speaker_role?: string | null
          status?: string
          testimonials_display_position?: string
          testimonials_enabled?: boolean | null
          testimonials_section_title?: string | null
          theme_color?: string | null
          title?: string
          total_registrations?: number | null
          total_views?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_linked_funnel_id_fkey"
            columns: ["linked_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_post_submit_video_asset_id_fkey"
            columns: ["post_submit_video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      live_registrations: {
        Row: {
          attended: boolean | null
          attended_at: string | null
          city: string | null
          email: string | null
          id: string
          name: string | null
          payment_screenshot_url: string | null
          payment_status: string | null
          phone: string | null
          registered_at: string | null
          session_id: string
          status: string
          upi_transaction_id: string | null
        }
        Insert: {
          attended?: boolean | null
          attended_at?: string | null
          city?: string | null
          email?: string | null
          id?: string
          name?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          phone?: string | null
          registered_at?: string | null
          session_id: string
          status?: string
          upi_transaction_id?: string | null
        }
        Update: {
          attended?: boolean | null
          attended_at?: string | null
          city?: string | null
          email?: string | null
          id?: string
          name?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          phone?: string | null
          registered_at?: string | null
          session_id?: string
          status?: string
          upi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          access_type: string
          attendee_count: number | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          lead_form_enabled: boolean | null
          max_attendees: number | null
          meeting_url: string | null
          owner_id: string
          payment_amount: number | null
          payment_instructions: string | null
          qr_code_url: string | null
          registration_count: number | null
          replay_enabled: boolean | null
          replay_expires_at: string | null
          replay_url: string | null
          scheduled_at: string | null
          session_type: string
          show_city: boolean | null
          show_email: boolean | null
          show_name: boolean | null
          show_phone: boolean | null
          slug: string
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          upi_id: string | null
        }
        Insert: {
          access_type?: string
          attendee_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_form_enabled?: boolean | null
          max_attendees?: number | null
          meeting_url?: string | null
          owner_id: string
          payment_amount?: number | null
          payment_instructions?: string | null
          qr_code_url?: string | null
          registration_count?: number | null
          replay_enabled?: boolean | null
          replay_expires_at?: string | null
          replay_url?: string | null
          scheduled_at?: string | null
          session_type?: string
          show_city?: boolean | null
          show_email?: boolean | null
          show_name?: boolean | null
          show_phone?: boolean | null
          slug: string
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          upi_id?: string | null
        }
        Update: {
          access_type?: string
          attendee_count?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          lead_form_enabled?: boolean | null
          max_attendees?: number | null
          meeting_url?: string | null
          owner_id?: string
          payment_amount?: number | null
          payment_instructions?: string | null
          qr_code_url?: string | null
          registration_count?: number | null
          replay_enabled?: boolean | null
          replay_expires_at?: string | null
          replay_url?: string | null
          scheduled_at?: string | null
          session_type?: string
          show_city?: boolean | null
          show_email?: boolean | null
          show_name?: boolean | null
          show_phone?: boolean | null
          slug?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_activity_log: {
        Row: {
          activity_date: string
          id: string
          member_id: string
          videos_watched: number | null
        }
        Insert: {
          activity_date?: string
          id?: string
          member_id: string
          videos_watched?: number | null
        }
        Update: {
          activity_date?: string
          id?: string
          member_id?: string
          videos_watched?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_activity_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_certificates: {
        Row: {
          funnel_id: string
          id: string
          issued_at: string | null
          member_id: string
          member_name: string
          program_name: string
          signatory: string | null
        }
        Insert: {
          funnel_id: string
          id?: string
          issued_at?: string | null
          member_id: string
          member_name: string
          program_name: string
          signatory?: string | null
        }
        Update: {
          funnel_id?: string
          id?: string
          issued_at?: string | null
          member_id?: string
          member_name?: string
          program_name?: string
          signatory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_certificates_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_certificates_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          payload: Json | null
          razorpay_event_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          payload?: Json | null
          razorpay_event_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json | null
          razorpay_event_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_config: {
        Row: {
          feature_advanced_analytics: boolean
          feature_analytics: boolean
          feature_go_live: boolean
          feature_landing_pages: boolean
          feature_lead_capture: boolean
          feature_priority_support: boolean
          feature_team_analytics: boolean
          feature_video_sharing: boolean
          feature_whatsapp_automation: boolean
          id: string
          is_enabled: boolean
          max_funnels: number
          max_landing_pages: number
          max_live_sessions: number
          max_team_members: number
          monthly_price: number
          multilevel_funnel_enabled: boolean
          plan_badge_text: string | null
          plan_name: string
          updated_at: string | null
          yearly_price: number
          yearly_validity_days: number
        }
        Insert: {
          feature_advanced_analytics?: boolean
          feature_analytics?: boolean
          feature_go_live?: boolean
          feature_landing_pages?: boolean
          feature_lead_capture?: boolean
          feature_priority_support?: boolean
          feature_team_analytics?: boolean
          feature_video_sharing?: boolean
          feature_whatsapp_automation?: boolean
          id?: string
          is_enabled?: boolean
          max_funnels?: number
          max_landing_pages?: number
          max_live_sessions?: number
          max_team_members?: number
          monthly_price?: number
          multilevel_funnel_enabled?: boolean
          plan_badge_text?: string | null
          plan_name: string
          updated_at?: string | null
          yearly_price?: number
          yearly_validity_days?: number
        }
        Update: {
          feature_advanced_analytics?: boolean
          feature_analytics?: boolean
          feature_go_live?: boolean
          feature_landing_pages?: boolean
          feature_lead_capture?: boolean
          feature_priority_support?: boolean
          feature_team_analytics?: boolean
          feature_video_sharing?: boolean
          feature_whatsapp_automation?: boolean
          id?: string
          is_enabled?: boolean
          max_funnels?: number
          max_landing_pages?: number
          max_live_sessions?: number
          max_team_members?: number
          monthly_price?: number
          multilevel_funnel_enabled?: boolean
          plan_badge_text?: string | null
          plan_name?: string
          updated_at?: string | null
          yearly_price?: number
          yearly_validity_days?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          company: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          instagram_url: string | null
          is_active: boolean | null
          kyc_status: string | null
          kyc_verified_at: string | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          phone: string | null
          team_owner_id: string | null
          team_size: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          instagram_url?: string | null
          is_active?: boolean | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          phone?: string | null
          team_owner_id?: string | null
          team_size?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          phone?: string | null
          team_owner_id?: string | null
          team_size?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_owner_id_fkey"
            columns: ["team_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      program_settings: {
        Row: {
          about_content: string | null
          about_overview_text: string | null
          about_paragraphs: Json | null
          about_section_title: string | null
          about_title: string | null
          active_courses_funnel_id: string | null
          active_member_funnel_id: string | null
          active_register_landing_page_id: string | null
          benefits: Json | null
          certificate_signatory: string | null
          completion_message: string | null
          courses_tab_title: string | null
          faq_items: Json | null
          favicon_url: string | null
          feature_badges: Json | null
          feature_cards: Json | null
          hero_headline_line1: string | null
          hero_headline_line2: string | null
          hero_pill_text: string | null
          hero_subtext: string | null
          id: string
          intro_video_url: string | null
          logo_url: string | null
          mentor_bio: string | null
          mentor_name: string | null
          mentor_photo_url: string | null
          mentor_title: string | null
          primary_color: string | null
          program_name: string
          program_tab_title: string | null
          program_tagline: string | null
          show_intro_video_button: boolean | null
          updated_at: string | null
          welcome_message: string | null
          welcome_tagline: string | null
        }
        Insert: {
          about_content?: string | null
          about_overview_text?: string | null
          about_paragraphs?: Json | null
          about_section_title?: string | null
          about_title?: string | null
          active_courses_funnel_id?: string | null
          active_member_funnel_id?: string | null
          active_register_landing_page_id?: string | null
          benefits?: Json | null
          certificate_signatory?: string | null
          completion_message?: string | null
          courses_tab_title?: string | null
          faq_items?: Json | null
          favicon_url?: string | null
          feature_badges?: Json | null
          feature_cards?: Json | null
          hero_headline_line1?: string | null
          hero_headline_line2?: string | null
          hero_pill_text?: string | null
          hero_subtext?: string | null
          id?: string
          intro_video_url?: string | null
          logo_url?: string | null
          mentor_bio?: string | null
          mentor_name?: string | null
          mentor_photo_url?: string | null
          mentor_title?: string | null
          primary_color?: string | null
          program_name?: string
          program_tab_title?: string | null
          program_tagline?: string | null
          show_intro_video_button?: boolean | null
          updated_at?: string | null
          welcome_message?: string | null
          welcome_tagline?: string | null
        }
        Update: {
          about_content?: string | null
          about_overview_text?: string | null
          about_paragraphs?: Json | null
          about_section_title?: string | null
          about_title?: string | null
          active_courses_funnel_id?: string | null
          active_member_funnel_id?: string | null
          active_register_landing_page_id?: string | null
          benefits?: Json | null
          certificate_signatory?: string | null
          completion_message?: string | null
          courses_tab_title?: string | null
          faq_items?: Json | null
          favicon_url?: string | null
          feature_badges?: Json | null
          feature_cards?: Json | null
          hero_headline_line1?: string | null
          hero_headline_line2?: string | null
          hero_pill_text?: string | null
          hero_subtext?: string | null
          id?: string
          intro_video_url?: string | null
          logo_url?: string | null
          mentor_bio?: string | null
          mentor_name?: string | null
          mentor_photo_url?: string | null
          mentor_title?: string | null
          primary_color?: string | null
          program_name?: string
          program_tab_title?: string | null
          program_tagline?: string | null
          show_intro_video_button?: boolean | null
          updated_at?: string | null
          welcome_message?: string | null
          welcome_tagline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_settings_active_courses_funnel_id_fkey"
            columns: ["active_courses_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_settings_active_member_funnel_id_fkey"
            columns: ["active_member_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_settings_active_register_landing_page_id_fkey"
            columns: ["active_register_landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_faq_items: {
        Row: {
          answer: string
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
        }
        Insert: {
          answer: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
        }
        Update: {
          answer?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
        }
        Relationships: []
      }
      sip_journey_steps: {
        Row: {
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          step_number: number
          title: string
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          step_number: number
          title: string
        }
        Update: {
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          step_number?: number
          title?: string
        }
        Relationships: []
      }
      sip_landing_page_config: {
        Row: {
          display_order: number | null
          id: string
          is_active: boolean | null
          key: string
          section: string
          updated_at: string | null
          value_boolean: boolean | null
          value_image_url: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key: string
          section: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_image_url?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          key?: string
          section?: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_image_url?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      sip_speakers: {
        Row: {
          achievements: string[] | null
          bio: string | null
          created_at: string | null
          display_order: number | null
          id: string
          instagram_url: string | null
          is_active: boolean | null
          name: string
          photo_url: string | null
          title: string
          youtube_url: string | null
        }
        Insert: {
          achievements?: string[] | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          title: string
          youtube_url?: string | null
        }
        Update: {
          achievements?: string[] | null
          bio?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          title?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      sip_testimonials: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          photo_url: string | null
          quote: string
          rating: number | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          photo_url?: string | null
          quote: string
          rating?: number | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          photo_url?: string | null
          quote?: string
          rating?: number | null
          role?: string | null
        }
        Relationships: []
      }
      subscription_logs: {
        Row: {
          amount: number | null
          created_at: string | null
          event_type: string
          id: string
          plan_billing: string | null
          plan_tier: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          plan_billing?: string | null
          plan_tier?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          plan_billing?: string | null
          plan_tier?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_email: string
          joined_at: string | null
          member_id: string
          owner_id: string
          status: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_email: string
          joined_at?: string | null
          member_id: string
          owner_id: string
          status?: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_email?: string
          joined_at?: string | null
          member_id?: string
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_kyc_submissions: {
        Row: {
          aadhar_back_url: string | null
          aadhar_front_url: string | null
          aadhar_number: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          doc_image_url: string | null
          doc_type: string | null
          full_name: string
          id: string
          pan_doc_url: string | null
          pan_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          state: string | null
          status: string | null
          submitted_at: string | null
          user_id: string
        }
        Insert: {
          aadhar_back_url?: string | null
          aadhar_front_url?: string | null
          aadhar_number?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          doc_image_url?: string | null
          doc_type?: string | null
          full_name: string
          id?: string
          pan_doc_url?: string | null
          pan_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id: string
        }
        Update: {
          aadhar_back_url?: string | null
          aadhar_front_url?: string | null
          aadhar_number?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          doc_image_url?: string | null
          doc_type?: string | null
          full_name?: string
          id?: string
          pan_doc_url?: string | null
          pan_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_kyc_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_kyc_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount_paid: number | null
          billing_type: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          plan_key: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          started_at: string | null
          status: string | null
          tier: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          billing_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_key: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          started_at?: string | null
          status?: string | null
          tier: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          billing_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_key?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          started_at?: string | null
          status?: string | null
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_asset_access: {
        Row: {
          granted_at: string | null
          granted_by: string
          granted_to: string
          id: string
          video_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by: string
          granted_to: string
          id?: string
          video_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string
          granted_to?: string
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_asset_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_asset_access_granted_to_fkey"
            columns: ["granted_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_asset_access_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      video_assets: {
        Row: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          file_size_bytes: number | null
          folder_id: string | null
          id: string
          is_shared: boolean | null
          original_filename: string | null
          owner_id: string
          public_url: string | null
          r2_key: string | null
          r2_thumbnail_key: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          upload_percent: number | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          is_shared?: boolean | null
          original_filename?: string | null
          owner_id: string
          public_url?: string | null
          r2_key?: string | null
          r2_thumbnail_key?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          upload_percent?: number | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size_bytes?: number | null
          folder_id?: string | null
          id?: string
          is_shared?: boolean | null
          original_filename?: string | null
          owner_id?: string
          public_url?: string | null
          r2_key?: string | null
          r2_thumbnail_key?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          upload_percent?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "video_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_folders: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          owner_id: string
          position: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          position?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_funnel_views: {
        Args: { _funnel_id: string }
        Returns: undefined
      }
      increment_landing_page_views: {
        Args: { _landing_page_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "member"
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
      app_role: ["admin", "moderator", "user", "member"],
    },
  },
} as const
