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
      ai_insights: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          generated_at: string
          id: string
          kind: Database["public"]["Enums"]["ai_insight_kind"]
          payload: Json
          related_entity_id: string | null
          related_entity_type: string | null
          retailer_id: string
          score: number | null
          status: Database["public"]["Enums"]["ai_insight_status"]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ai_insight_kind"]
          payload?: Json
          related_entity_id?: string | null
          related_entity_type?: string | null
          retailer_id: string
          score?: number | null
          status?: Database["public"]["Enums"]["ai_insight_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ai_insight_kind"]
          payload?: Json
          related_entity_id?: string | null
          related_entity_type?: string | null
          retailer_id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["ai_insight_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "ai_insights_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          accepted_at: string | null
          action_type: string
          confidence: number
          created_at: string
          currency: string
          description: string | null
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          generated_at: string
          id: string
          projected_value_cents: number | null
          retailer_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          action_type: string
          confidence?: number
          created_at?: string
          currency?: string
          description?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          projected_value_cents?: number | null
          retailer_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          action_type?: string
          confidence?: number
          created_at?: string
          currency?: string
          description?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          projected_value_cents?: number | null
          retailer_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "ai_recommendations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          retailer_id: string | null
          status: Database["public"]["Enums"]["audit_status"]
          updated_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          retailer_id?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          updated_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          retailer_id?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "audit_logs_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          provider: string
          retailer_id: string | null
          signature_ok: boolean
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          provider: string
          retailer_id?: string | null
          signature_ok?: boolean
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          provider?: string
          retailer_id?: string | null
          signature_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "billing_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          author_user_id: string | null
          body: string | null
          conversation_id: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          is_internal: boolean
          media_url: string | null
          retailer_id: string
          sent_at: string
          status: Database["public"]["Enums"]["message_status"]
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_internal?: boolean
          media_url?: string | null
          retailer_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["message_status"]
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          is_internal?: boolean
          media_url?: string | null
          retailer_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["message_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "conversation_messages_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          is_resolved: boolean
          last_message_at: string | null
          retailer_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          store_id: string | null
          subject: string | null
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          is_resolved?: boolean
          last_message_at?: string | null
          retailer_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          store_id?: string | null
          subject?: string | null
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          is_resolved?: boolean
          last_message_at?: string | null
          retailer_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          store_id?: string | null
          subject?: string | null
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "conversations_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interests: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          product_id: string
          qr_tag_id: string | null
          retailer_id: string
          source: string
          status: Database["public"]["Enums"]["interest_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          product_id: string
          qr_tag_id?: string | null
          retailer_id: string
          source?: string
          status?: Database["public"]["Enums"]["interest_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          product_id?: string
          qr_tag_id?: string | null
          retailer_id?: string
          source?: string
          status?: Database["public"]["Enums"]["interest_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "customer_interests_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["qr_tag_id"]
          },
          {
            foreignKeyName: "customer_interests_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "qr_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interests_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "customer_interests_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string | null
          id: string
          locale: string
          marketing_consent_at: string | null
          notify_consent_at: string | null
          opted_in_at: string
          privacy_accepted_at: string | null
          retailer_id: string
          source: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          whatsapp_e164: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          marketing_consent_at?: string | null
          notify_consent_at?: string | null
          opted_in_at?: string
          privacy_accepted_at?: string | null
          retailer_id: string
          source?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp_e164: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          marketing_consent_at?: string | null
          notify_consent_at?: string | null
          opted_in_at?: string
          privacy_accepted_at?: string | null
          retailer_id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "customers_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_recompute_queue: {
        Row: {
          enqueued_at: string
          product_id: string
        }
        Insert: {
          enqueued_at?: string
          product_id: string
        }
        Update: {
          enqueued_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_recompute_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intent_recompute_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
        ]
      }
      intent_score_weights: {
        Row: {
          forecast_sensitivity: string
          forecasting_enabled: boolean
          retailer_id: string
          update_frequency_minutes: number
          updated_at: string
          w_cart: number
          w_conversion: number
          w_notif: number
          w_price: number
          w_repeat: number
          w_scans: number
          w_time: number
          w_viewers: number
          w_watchlist: number
        }
        Insert: {
          forecast_sensitivity?: string
          forecasting_enabled?: boolean
          retailer_id: string
          update_frequency_minutes?: number
          updated_at?: string
          w_cart?: number
          w_conversion?: number
          w_notif?: number
          w_price?: number
          w_repeat?: number
          w_scans?: number
          w_time?: number
          w_viewers?: number
          w_watchlist?: number
        }
        Update: {
          forecast_sensitivity?: string
          forecasting_enabled?: boolean
          retailer_id?: string
          update_frequency_minutes?: number
          updated_at?: string
          w_cart?: number
          w_conversion?: number
          w_notif?: number
          w_price?: number
          w_repeat?: number
          w_scans?: number
          w_time?: number
          w_viewers?: number
          w_watchlist?: number
        }
        Relationships: [
          {
            foreignKeyName: "intent_score_weights_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "intent_score_weights_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          audience_filter: Json
          audience_size: number
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          funnel: Json
          headline: string | null
          id: string
          image_url: string | null
          message_template: string
          product_id: string | null
          redemption_code: string | null
          retailer_id: string
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at: string
        }
        Insert: {
          audience_filter?: Json
          audience_size?: number
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          funnel?: Json
          headline?: string | null
          id?: string
          image_url?: string | null
          message_template: string
          product_id?: string | null
          redemption_code?: string | null
          retailer_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          type: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Update: {
          audience_filter?: Json
          audience_size?: number
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          funnel?: Json
          headline?: string | null
          id?: string
          image_url?: string | null
          message_template?: string
          product_id?: string | null
          redemption_code?: string | null
          retailer_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          type?: Database["public"]["Enums"]["campaign_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "notification_campaigns_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "notification_campaigns_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          campaign_id: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivered_at: string | null
          error: string | null
          id: string
          payload: Json
          provider_message_sid: string | null
          queued_at: string
          read_at: string | null
          redeemed_at: string | null
          retailer_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          payload?: Json
          provider_message_sid?: string | null
          queued_at?: string
          read_at?: string | null
          redeemed_at?: string | null
          retailer_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          payload?: Json
          provider_message_sid?: string | null
          queued_at?: string
          read_at?: string | null
          redeemed_at?: string | null
          retailer_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_history_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "notification_history_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_purchases: {
        Row: {
          amount_cents: number
          billing_cycle: string
          created_at: string
          currency: string
          id: string
          plan: string
          provider: string
          provider_order_id: string
          raw: Json
          retailer_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          plan: string
          provider: string
          provider_order_id: string
          raw?: Json
          retailer_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          plan?: string
          provider?: string
          provider_order_id?: string
          raw?: Json
          retailer_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_purchases_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "payment_purchases_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          retailer_id: string
          status: Database["public"]["Enums"]["category_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          retailer_id: string
          status?: Database["public"]["Enums"]["category_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          retailer_id?: string
          status?: Database["public"]["Enums"]["category_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "product_categories_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intent_forecast: {
        Row: {
          computed_at: string
          forecast_confidence: number
          predicted_score_14d: number
          predicted_score_7d: number
          predicted_trend: string
          product_id: string
          retailer_id: string
        }
        Insert: {
          computed_at?: string
          forecast_confidence?: number
          predicted_score_14d: number
          predicted_score_7d: number
          predicted_trend: string
          product_id: string
          retailer_id: string
        }
        Update: {
          computed_at?: string
          forecast_confidence?: number
          predicted_score_14d?: number
          predicted_score_7d?: number
          predicted_trend?: string
          product_id?: string
          retailer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_intent_forecast_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intent_forecast_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_intent_forecast_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "product_intent_forecast_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intent_history: {
        Row: {
          created_at: string
          id: string
          intent_score: number
          product_id: string
          retailer_id: string
          sample_size: number
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent_score: number
          product_id: string
          retailer_id: string
          sample_size?: number
          snapshot_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          intent_score?: number
          product_id?: string
          retailer_id?: string
          sample_size?: number
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_intent_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intent_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_intent_history_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "product_intent_history_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intent_signals: {
        Row: {
          add_to_cart_rate: number
          avg_time_on_page_seconds: number
          conversion_rate: number
          notif_engagement: number
          price_impact: number
          product_id: string
          repeat_scans: number
          retailer_id: string
          sample_size: number
          scans_total: number
          scans_unique: number
          updated_at: string
          viewers: number
          watchlist_adds: number
        }
        Insert: {
          add_to_cart_rate?: number
          avg_time_on_page_seconds?: number
          conversion_rate?: number
          notif_engagement?: number
          price_impact?: number
          product_id: string
          repeat_scans?: number
          retailer_id: string
          sample_size?: number
          scans_total?: number
          scans_unique?: number
          updated_at?: string
          viewers?: number
          watchlist_adds?: number
        }
        Update: {
          add_to_cart_rate?: number
          avg_time_on_page_seconds?: number
          conversion_rate?: number
          notif_engagement?: number
          price_impact?: number
          product_id?: string
          repeat_scans?: number
          retailer_id?: string
          sample_size?: number
          scans_total?: number
          scans_unique?: number
          updated_at?: string
          viewers?: number
          watchlist_adds?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_intent_signals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intent_signals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_intent_signals_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "product_intent_signals_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          image_url: string | null
          images: Json
          intent_score: number
          intent_score_confidence: number
          intent_score_trend: string
          intent_score_updated_at: string
          low_stock_threshold: number
          name: string
          price_cents: number
          promotion_end_date: string | null
          promotion_start_date: string | null
          retailer_id: string
          sale_price_cents: number | null
          search_blob: string | null
          size: string | null
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          stock_qty: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json
          intent_score?: number
          intent_score_confidence?: number
          intent_score_trend?: string
          intent_score_updated_at?: string
          low_stock_threshold?: number
          name: string
          price_cents?: number
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          retailer_id: string
          sale_price_cents?: number | null
          search_blob?: string | null
          size?: string | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_qty?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: Json
          intent_score?: number
          intent_score_confidence?: number
          intent_score_trend?: string
          intent_score_updated_at?: string
          low_stock_threshold?: number
          name?: string
          price_cents?: number
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          retailer_id?: string
          sale_price_cents?: number | null
          search_blob?: string | null
          size?: string | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_qty?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "products_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          whatsapp_e164: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
      promotion_events: {
        Row: {
          created_at: string
          created_by: string | null
          discount_pct: number
          ends_at: string | null
          id: string
          name: string
          product_id: string | null
          retailer_id: string
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          ends_at?: string | null
          id?: string
          name: string
          product_id?: string | null
          retailer_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          ends_at?: string | null
          id?: string
          name?: string
          product_id?: string | null
          retailer_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "promotion_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "promotion_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          created_at: string
          customer_id: string | null
          device_type: string | null
          dwell_ms: number | null
          id: string
          ip_hash: string | null
          product_id: string
          qr_tag_id: string
          qr_version: number | null
          referrer: string | null
          retailer_id: string
          scanned_at: string
          store_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          dwell_ms?: number | null
          id?: string
          ip_hash?: string | null
          product_id: string
          qr_tag_id: string
          qr_version?: number | null
          referrer?: string | null
          retailer_id: string
          scanned_at?: string
          store_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          dwell_ms?: number | null
          id?: string
          ip_hash?: string | null
          product_id?: string
          qr_tag_id?: string
          qr_version?: number | null
          referrer?: string | null
          retailer_id?: string
          scanned_at?: string
          store_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "qr_scans_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["qr_tag_id"]
          },
          {
            foreignKeyName: "qr_scans_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "qr_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "qr_scans_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tags: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          last_scanned_at: string | null
          product_id: string
          regenerated_from: string | null
          retailer_id: string
          scan_count: number
          short_code: string
          status: Database["public"]["Enums"]["qr_status"]
          store_id: string | null
          template: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_scanned_at?: string | null
          product_id: string
          regenerated_from?: string | null
          retailer_id: string
          scan_count?: number
          short_code: string
          status?: Database["public"]["Enums"]["qr_status"]
          store_id?: string | null
          template?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_scanned_at?: string | null
          product_id?: string
          regenerated_from?: string | null
          retailer_id?: string
          scan_count?: number
          short_code?: string
          status?: Database["public"]["Enums"]["qr_status"]
          store_id?: string | null
          template?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "qr_tags_regenerated_from_fkey"
            columns: ["regenerated_from"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["qr_tag_id"]
          },
          {
            foreignKeyName: "qr_tags_regenerated_from_fkey"
            columns: ["regenerated_from"]
            isOneToOne: false
            referencedRelation: "qr_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tags_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "qr_tags_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          expires_at: string | null
          id: string
          promotion_id: string | null
          redeemed_at: string | null
          retailer_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          promotion_id?: string | null
          redeemed_at?: string | null
          retailer_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          promotion_id?: string | null
          redeemed_at?: string | null
          retailer_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_codes_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotion_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_codes_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "redemption_codes_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      retailers: {
        Row: {
          billing_country: string
          billing_email: string | null
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string
          slug: string
          status: Database["public"]["Enums"]["retailer_status"]
          tier: Database["public"]["Enums"]["tag_tier"]
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          billing_country?: string
          billing_email?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string
          slug: string
          status?: Database["public"]["Enums"]["retailer_status"]
          tier?: Database["public"]["Enums"]["tag_tier"]
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          billing_country?: string
          billing_email?: string | null
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string
          slug?: string
          status?: Database["public"]["Enums"]["retailer_status"]
          tier?: Database["public"]["Enums"]["tag_tier"]
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      roi_attributions: {
        Row: {
          attributed_at: string
          attributed_revenue_cents: number
          campaign_id: string | null
          cost_cents: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          margin_cents: number
          model: Database["public"]["Enums"]["roi_attribution_model"]
          notification_id: string | null
          product_id: string | null
          qr_tag_id: string | null
          retailer_id: string
          sales_recovery_id: string
          status: string
          touchpoint: Database["public"]["Enums"]["roi_touchpoint"]
          updated_at: string
          watchlist_id: string | null
        }
        Insert: {
          attributed_at?: string
          attributed_revenue_cents?: number
          campaign_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          margin_cents?: number
          model?: Database["public"]["Enums"]["roi_attribution_model"]
          notification_id?: string | null
          product_id?: string | null
          qr_tag_id?: string | null
          retailer_id: string
          sales_recovery_id: string
          status?: string
          touchpoint: Database["public"]["Enums"]["roi_touchpoint"]
          updated_at?: string
          watchlist_id?: string | null
        }
        Update: {
          attributed_at?: string
          attributed_revenue_cents?: number
          campaign_id?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          margin_cents?: number
          model?: Database["public"]["Enums"]["roi_attribution_model"]
          notification_id?: string | null
          product_id?: string | null
          qr_tag_id?: string | null
          retailer_id?: string
          sales_recovery_id?: string
          status?: string
          touchpoint?: Database["public"]["Enums"]["roi_touchpoint"]
          updated_at?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roi_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "roi_attributions_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["qr_tag_id"]
          },
          {
            foreignKeyName: "roi_attributions_qr_tag_id_fkey"
            columns: ["qr_tag_id"]
            isOneToOne: false
            referencedRelation: "qr_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "roi_attributions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_sales_recovery_id_fkey"
            columns: ["sales_recovery_id"]
            isOneToOne: true
            referencedRelation: "sales_recoveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_attributions_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_settings: {
        Row: {
          attribution_window_hours: number
          cost_per_message_cents: number
          created_at: string
          created_by: string | null
          currency: string
          default_margin_pct: number
          model: Database["public"]["Enums"]["roi_attribution_model"]
          retailer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attribution_window_hours?: number
          cost_per_message_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_margin_pct?: number
          model?: Database["public"]["Enums"]["roi_attribution_model"]
          retailer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attribution_window_hours?: number
          cost_per_message_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          default_margin_pct?: number
          model?: Database["public"]["Enums"]["roi_attribution_model"]
          retailer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roi_settings_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "roi_settings_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_recoveries: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          id: string
          notification_id: string | null
          product_id: string | null
          recovered_at: string
          retailer_id: string
          status: Database["public"]["Enums"]["recovery_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          id?: string
          notification_id?: string | null
          product_id?: string | null
          recovered_at?: string
          retailer_id: string
          status?: Database["public"]["Enums"]["recovery_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          id?: string
          notification_id?: string | null
          product_id?: string | null
          recovered_at?: string
          retailer_id?: string
          status?: Database["public"]["Enums"]["recovery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_recoveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_recoveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_recoveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_recoveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_recoveries_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "sales_recoveries_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string | null
          id: string
          invite_email: string | null
          retailer_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["staff_status"]
          store_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          invite_email?: string | null
          retailer_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          store_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string | null
          id?: string
          invite_email?: string | null
          retailer_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          store_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "staff_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          manager_name: string | null
          name: string
          retailer_id: string
          status: Database["public"]["Enums"]["store_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manager_name?: string | null
          name: string
          retailer_id: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          retailer_id?: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "stores_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string
          id: string
          plan: string
          provider: string | null
          provider_ref: string | null
          provider_subscription_id: string | null
          retailer_id: string
          seats: number
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          retailer_id: string
          seats?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan?: string
          provider?: string | null
          provider_ref?: string | null
          provider_subscription_id?: string | null
          retailer_id?: string
          seats?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "subscriptions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: true
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          retailer_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          retailer_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          retailer_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist_events: {
        Row: {
          created_at: string
          id: string
          notification_id: string | null
          payload: Json
          retailer_id: string
          status: string
          trigger: Database["public"]["Enums"]["watchlist_trigger"]
          watchlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id?: string | null
          payload?: Json
          retailer_id: string
          status?: string
          trigger: Database["public"]["Enums"]["watchlist_trigger"]
          watchlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string | null
          payload?: Json
          retailer_id?: string
          status?: string
          trigger?: Database["public"]["Enums"]["watchlist_trigger"]
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_events_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "watchlist_events_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_events_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          fired_count: number
          id: string
          last_fired_at: string | null
          product_id: string
          retailer_id: string
          status: Database["public"]["Enums"]["watchlist_status"]
          target_price_cents: number | null
          trigger: Database["public"]["Enums"]["watchlist_trigger"]
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at?: string | null
          fired_count?: number
          id?: string
          last_fired_at?: string | null
          product_id: string
          retailer_id: string
          status?: Database["public"]["Enums"]["watchlist_status"]
          target_price_cents?: number | null
          trigger?: Database["public"]["Enums"]["watchlist_trigger"]
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string | null
          fired_count?: number
          id?: string
          last_fired_at?: string | null
          product_id?: string
          retailer_id?: string
          status?: Database["public"]["Enums"]["watchlist_status"]
          target_price_cents?: number | null
          trigger?: Database["public"]["Enums"]["watchlist_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "watchlists_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "public_scan_view"
            referencedColumns: ["retailer_id"]
          },
          {
            foreignKeyName: "watchlists_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "retailers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_scan_view: {
        Row: {
          color: string | null
          currency: string | null
          image_url: string | null
          images: Json | null
          price_cents: number | null
          product_brand: string | null
          product_description: string | null
          product_id: string | null
          product_name: string | null
          product_status: Database["public"]["Enums"]["product_status"] | null
          promotion_end_date: string | null
          promotion_start_date: string | null
          qr_active: boolean | null
          qr_tag_id: string | null
          retailer_id: string | null
          retailer_logo: string | null
          retailer_name: string | null
          retailer_slug: string | null
          sale_price_cents: number | null
          short_code: string | null
          size: string | null
          store_id: string | null
          store_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_paid_tier: {
        Args: {
          _cycle: string
          _period_end: string
          _provider: string
          _provider_sub_id?: string
          _retailer_id: string
          _tier: Database["public"]["Enums"]["tag_tier"]
        }
        Returns: undefined
      }
      belongs_to_retailer: {
        Args: { _retailer_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_retailer: {
        Args: { _retailer_id: string; _user_id: string }
        Returns: boolean
      }
      enqueue_intent_recompute: {
        Args: { _product_id: string }
        Returns: undefined
      }
      forecast_product_intent: {
        Args: { _product_id: string }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
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
      recompute_product_intent: {
        Args: { _product_id: string }
        Returns: undefined
      }
      run_roi_attribution_sweep: {
        Args: { _retailer_id?: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      ai_insight_kind:
        | "opportunity"
        | "executive_summary"
        | "weekly_report"
        | "conversation_summary"
        | "merchandising"
      ai_insight_status: "active" | "dismissed" | "expired" | "accepted"
      app_role:
        | "super_admin"
        | "retail_admin"
        | "store_manager"
        | "sales_assistant"
      audit_status: "success" | "warning" | "failure"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "cancelled"
        | "completed"
      campaign_type:
        | "sale"
        | "low_stock"
        | "back_in_stock"
        | "promotion"
        | "custom"
      category_status: "active" | "archived"
      conversation_status: "open" | "closed" | "archived"
      customer_status: "subscribed" | "unsubscribed" | "blocked"
      interest_status: "active" | "notified" | "converted" | "expired"
      message_direction: "inbound" | "outbound"
      message_status: "sent" | "delivered" | "read" | "failed"
      notification_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "clicked"
        | "redeemed"
      product_status: "active" | "draft" | "archived"
      promotion_status: "scheduled" | "active" | "ended" | "cancelled"
      qr_status: "active" | "inactive" | "retired"
      recovery_status: "attributed" | "pending" | "rejected"
      redemption_status: "issued" | "redeemed" | "expired" | "void"
      retailer_status: "active" | "suspended" | "cancelled"
      roi_attribution_model: "last_touch" | "first_touch" | "linear"
      roi_touchpoint: "scan" | "notification" | "watchlist" | "manual"
      staff_status: "active" | "invited" | "disabled"
      store_status: "active" | "closed" | "pending"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      tag_tier: "starter" | "pro" | "enterprise"
      watchlist_status: "active" | "paused" | "fired" | "expired" | "cancelled"
      watchlist_trigger:
        | "on_sale"
        | "back_in_stock"
        | "low_stock"
        | "price_drop_below"
        | "any_update"
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
      ai_insight_kind: [
        "opportunity",
        "executive_summary",
        "weekly_report",
        "conversation_summary",
        "merchandising",
      ],
      ai_insight_status: ["active", "dismissed", "expired", "accepted"],
      app_role: [
        "super_admin",
        "retail_admin",
        "store_manager",
        "sales_assistant",
      ],
      audit_status: ["success", "warning", "failure"],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "cancelled",
        "completed",
      ],
      campaign_type: [
        "sale",
        "low_stock",
        "back_in_stock",
        "promotion",
        "custom",
      ],
      category_status: ["active", "archived"],
      conversation_status: ["open", "closed", "archived"],
      customer_status: ["subscribed", "unsubscribed", "blocked"],
      interest_status: ["active", "notified", "converted", "expired"],
      message_direction: ["inbound", "outbound"],
      message_status: ["sent", "delivered", "read", "failed"],
      notification_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "clicked",
        "redeemed",
      ],
      product_status: ["active", "draft", "archived"],
      promotion_status: ["scheduled", "active", "ended", "cancelled"],
      qr_status: ["active", "inactive", "retired"],
      recovery_status: ["attributed", "pending", "rejected"],
      redemption_status: ["issued", "redeemed", "expired", "void"],
      retailer_status: ["active", "suspended", "cancelled"],
      roi_attribution_model: ["last_touch", "first_touch", "linear"],
      roi_touchpoint: ["scan", "notification", "watchlist", "manual"],
      staff_status: ["active", "invited", "disabled"],
      store_status: ["active", "closed", "pending"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      tag_tier: ["starter", "pro", "enterprise"],
      watchlist_status: ["active", "paused", "fired", "expired", "cancelled"],
      watchlist_trigger: [
        "on_sale",
        "back_in_stock",
        "low_stock",
        "price_drop_below",
        "any_update",
      ],
    },
  },
} as const
