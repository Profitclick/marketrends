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
      affiliate_clicks: {
        Row: {
          article_id: string | null
          click_id: string
          clicked_at: string
          id: string
          ip_address: string | null
          partner_id: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          article_id?: string | null
          click_id: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          partner_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          article_id?: string | null
          click_id?: string
          clicked_at?: string
          id?: string
          ip_address?: string | null
          partner_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_partners: {
        Row: {
          active: boolean | null
          commission_rate: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
          utm_template: string
        }
        Insert: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          utm_template: string
        }
        Update: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          utm_template?: string
        }
        Relationships: []
      }
      article_clusters: {
        Row: {
          article_id: string
          cluster_slug: string
          created_at: string
          matched_refs: Json
          reason: string
          score: number
        }
        Insert: {
          article_id: string
          cluster_slug: string
          created_at?: string
          matched_refs?: Json
          reason: string
          score?: number
        }
        Update: {
          article_id?: string
          cluster_slug?: string
          created_at?: string
          matched_refs?: Json
          reason?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_clusters_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_clusters_cluster_slug_fkey"
            columns: ["cluster_slug"]
            isOneToOne: false
            referencedRelation: "cluster_definitions"
            referencedColumns: ["slug"]
          },
        ]
      }
      article_entities: {
        Row: {
          article_id: string
          created_at: string
          entity_id: string
          is_primary: boolean
          mention_count: number
        }
        Insert: {
          article_id: string
          created_at?: string
          entity_id: string
          is_primary?: boolean
          mention_count?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          entity_id?: string
          is_primary?: boolean
          mention_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_entities_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      article_relations: {
        Row: {
          article_id: string
          created_at: string
          related_article_id: string
          relation_type: string
          similarity_score: number
        }
        Insert: {
          article_id: string
          created_at?: string
          related_article_id: string
          relation_type?: string
          similarity_score?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          related_article_id?: string
          relation_type?: string
          similarity_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_relations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_relations_related_article_id_fkey"
            columns: ["related_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_topics: {
        Row: {
          article_id: string
          created_at: string
          relevance_score: number
          topic_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          relevance_score?: number
          topic_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          relevance_score?: number
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_topics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          affiliate_disclaimer: string | null
          ai_priority_class: string | null
          ai_priority_reasons: Json | null
          ai_priority_score: number | null
          ai_quality_score: number | null
          ai_required_reason: string | null
          ai_status: string | null
          archived_sources: Json | null
          article_type: string | null
          author_slug: string | null
          authority_breakdown: Json
          category: string
          content: string
          created_at: string
          deterministic_pass_at: string | null
          editor_slug: string | null
          editorial_authority_score: number
          embedded_at: string | null
          embedding: string | null
          enrich_class: string | null
          enrich_failure_reason: string | null
          enrich_priority: number
          enrich_retry_count: number
          enrichment_status: string
          hybrid_bucket: string | null
          id: string
          image_url: string | null
          is_affiliate: boolean | null
          last_enriched_at: string | null
          last_scored_at: string | null
          meta_description: string | null
          partner_id: string | null
          processing_log: Json | null
          published: boolean | null
          risk_warning: string | null
          slug: string
          source_count: number | null
          source_name: string
          source_url: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          affiliate_disclaimer?: string | null
          ai_priority_class?: string | null
          ai_priority_reasons?: Json | null
          ai_priority_score?: number | null
          ai_quality_score?: number | null
          ai_required_reason?: string | null
          ai_status?: string | null
          archived_sources?: Json | null
          article_type?: string | null
          author_slug?: string | null
          authority_breakdown?: Json
          category: string
          content: string
          created_at?: string
          deterministic_pass_at?: string | null
          editor_slug?: string | null
          editorial_authority_score?: number
          embedded_at?: string | null
          embedding?: string | null
          enrich_class?: string | null
          enrich_failure_reason?: string | null
          enrich_priority?: number
          enrich_retry_count?: number
          enrichment_status?: string
          hybrid_bucket?: string | null
          id?: string
          image_url?: string | null
          is_affiliate?: boolean | null
          last_enriched_at?: string | null
          last_scored_at?: string | null
          meta_description?: string | null
          partner_id?: string | null
          processing_log?: Json | null
          published?: boolean | null
          risk_warning?: string | null
          slug: string
          source_count?: number | null
          source_name: string
          source_url: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          affiliate_disclaimer?: string | null
          ai_priority_class?: string | null
          ai_priority_reasons?: Json | null
          ai_priority_score?: number | null
          ai_quality_score?: number | null
          ai_required_reason?: string | null
          ai_status?: string | null
          archived_sources?: Json | null
          article_type?: string | null
          author_slug?: string | null
          authority_breakdown?: Json
          category?: string
          content?: string
          created_at?: string
          deterministic_pass_at?: string | null
          editor_slug?: string | null
          editorial_authority_score?: number
          embedded_at?: string | null
          embedding?: string | null
          enrich_class?: string | null
          enrich_failure_reason?: string | null
          enrich_priority?: number
          enrich_retry_count?: number
          enrichment_status?: string
          hybrid_bucket?: string | null
          id?: string
          image_url?: string | null
          is_affiliate?: boolean | null
          last_enriched_at?: string | null
          last_scored_at?: string | null
          meta_description?: string | null
          partner_id?: string | null
          processing_log?: Json | null
          published?: boolean | null
          risk_warning?: string | null
          slug?: string
          source_count?: number | null
          source_name?: string
          source_url?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "affiliate_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          expertise: string[] | null
          id: string
          image_url: string | null
          name: string
          role: string
          slug: string
          social: Json | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          expertise?: string[] | null
          id?: string
          image_url?: string | null
          name: string
          role?: string
          slug: string
          social?: Json | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          expertise?: string[] | null
          id?: string
          image_url?: string | null
          name?: string
          role?: string
          slug?: string
          social?: Json | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cluster_definitions: {
        Row: {
          created_at: string
          guide_categories: string[]
          name: string
          slug: string
          supporting_categories: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          guide_categories?: string[]
          name: string
          slug: string
          supporting_categories?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          guide_categories?: string[]
          name?: string
          slug?: string
          supporting_categories?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cluster_seed_nodes: {
        Row: {
          cluster_slug: string
          created_at: string
          id: string
          node_id: string
          node_name: string
          node_type: string
          strength: string
        }
        Insert: {
          cluster_slug: string
          created_at?: string
          id?: string
          node_id: string
          node_name: string
          node_type: string
          strength: string
        }
        Update: {
          cluster_slug?: string
          created_at?: string
          id?: string
          node_id?: string
          node_name?: string
          node_type?: string
          strength?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_seed_nodes_cluster_slug_fkey"
            columns: ["cluster_slug"]
            isOneToOne: false
            referencedRelation: "cluster_definitions"
            referencedColumns: ["slug"]
          },
        ]
      }
      cluster_stats: {
        Row: {
          articles: number | null
          authority_score: number | null
          comparisons: number | null
          coverage_gap: number | null
          created_at: string
          freshness_days: number | null
          guides: number | null
          internal_links: number | null
          knowledge_pages: number | null
          momentum: number | null
          name: string | null
          opportunity_score: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          articles?: number | null
          authority_score?: number | null
          comparisons?: number | null
          coverage_gap?: number | null
          created_at?: string
          freshness_days?: number | null
          guides?: number | null
          internal_links?: number | null
          knowledge_pages?: number | null
          momentum?: number | null
          name?: string | null
          opportunity_score?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          articles?: number | null
          authority_score?: number | null
          comparisons?: number | null
          coverage_gap?: number | null
          created_at?: string
          freshness_days?: number | null
          guides?: number | null
          internal_links?: number | null
          knowledge_pages?: number | null
          momentum?: number | null
          name?: string | null
          opportunity_score?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      comparison_pages: {
        Row: {
          content: string | null
          created_at: string
          embedded_at: string | null
          embedding: string | null
          entity_a: string
          entity_a_id: string | null
          entity_b: string
          entity_b_id: string | null
          faq_json: Json | null
          id: string
          meta_description: string | null
          meta_title: string | null
          pros_cons_json: Json | null
          published: boolean
          schema_json: Json | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_a: string
          entity_a_id?: string | null
          entity_b: string
          entity_b_id?: string | null
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          pros_cons_json?: Json | null
          published?: boolean
          schema_json?: Json | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_a?: string
          entity_a_id?: string | null
          entity_b?: string
          entity_b_id?: string | null
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          pros_cons_json?: Json | null
          published?: boolean
          schema_json?: Json | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparison_pages_entity_a_id_fkey"
            columns: ["entity_a_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_pages_entity_b_id_fkey"
            columns: ["entity_b_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      content_assets: {
        Row: {
          article_id: string | null
          asset_type: string
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          opportunity_id: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          article_id?: string | null
          asset_type: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          article_id?: string | null
          asset_type?: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_assets_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assets_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          active: boolean | null
          api_endpoint: string | null
          created_at: string
          data_count: number | null
          fetch_status: string | null
          id: string
          last_fetched: string | null
          source_name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          api_endpoint?: string | null
          created_at?: string
          data_count?: number | null
          fetch_status?: string | null
          id?: string
          last_fetched?: string | null
          source_name: string
          source_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          api_endpoint?: string | null
          created_at?: string
          data_count?: number | null
          fetch_status?: string | null
          id?: string
          last_fetched?: string | null
          source_name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      datasets: {
        Row: {
          category: string | null
          created_at: string
          dataset_key: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          name: string
          payload: Json | null
          provider: string | null
          resource_type: string | null
          status: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          dataset_key?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          name: string
          payload?: Json | null
          provider?: string | null
          resource_type?: string | null
          status?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          dataset_key?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          name?: string
          payload?: Json | null
          provider?: string | null
          resource_type?: string | null
          status?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      duplicate_decisions: {
        Row: {
          action_taken: string | null
          candidate_ref: string
          candidate_title: string | null
          candidate_type: string
          created_at: string
          decision: string
          id: string
          match_ref: string | null
          match_title: string | null
          match_type: string | null
          signals: Json
          similarity: number | null
        }
        Insert: {
          action_taken?: string | null
          candidate_ref: string
          candidate_title?: string | null
          candidate_type: string
          created_at?: string
          decision: string
          id?: string
          match_ref?: string | null
          match_title?: string | null
          match_type?: string | null
          signals?: Json
          similarity?: number | null
        }
        Update: {
          action_taken?: string | null
          candidate_ref?: string
          candidate_title?: string | null
          candidate_type?: string
          created_at?: string
          decision?: string
          id?: string
          match_ref?: string | null
          match_title?: string | null
          match_type?: string | null
          signals?: Json
          similarity?: number | null
        }
        Relationships: []
      }
      enrichment_telemetry: {
        Row: {
          ai_calls: number
          ai_success: boolean
          article_id: string | null
          candidates_offered: number
          canonical_entities_reused: number
          canonical_topics_reused: number
          completion_tokens: number | null
          created_at: string
          credits: number | null
          details: Json
          entity_relations_created: number
          failure_reason: string | null
          id: string
          mode: string
          model: string | null
          new_entities_created: number
          new_entities_proposed: number
          new_topics_created: number
          new_topics_proposed: number
          processing_ms: number | null
          prompt_tokens: number | null
          run_id: string | null
          singleton_nodes_created: number
          topic_relations_created: number
          total_tokens: number | null
        }
        Insert: {
          ai_calls?: number
          ai_success?: boolean
          article_id?: string | null
          candidates_offered?: number
          canonical_entities_reused?: number
          canonical_topics_reused?: number
          completion_tokens?: number | null
          created_at?: string
          credits?: number | null
          details?: Json
          entity_relations_created?: number
          failure_reason?: string | null
          id?: string
          mode?: string
          model?: string | null
          new_entities_created?: number
          new_entities_proposed?: number
          new_topics_created?: number
          new_topics_proposed?: number
          processing_ms?: number | null
          prompt_tokens?: number | null
          run_id?: string | null
          singleton_nodes_created?: number
          topic_relations_created?: number
          total_tokens?: number | null
        }
        Update: {
          ai_calls?: number
          ai_success?: boolean
          article_id?: string | null
          candidates_offered?: number
          canonical_entities_reused?: number
          canonical_topics_reused?: number
          completion_tokens?: number | null
          created_at?: string
          credits?: number | null
          details?: Json
          entity_relations_created?: number
          failure_reason?: string | null
          id?: string
          mode?: string
          model?: string | null
          new_entities_created?: number
          new_entities_proposed?: number
          new_topics_created?: number
          new_topics_proposed?: number
          processing_ms?: number | null
          prompt_tokens?: number | null
          run_id?: string | null
          singleton_nodes_created?: number
          topic_relations_created?: number
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_telemetry_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          aliases: string[]
          authority_score: number | null
          created_at: string
          description: string | null
          faqs: Json | null
          id: string
          key_facts: Json | null
          last_mention_at: string | null
          mention_count: number
          mentions_last_24h: number
          mentions_last_30d: number
          mentions_last_7d: number
          meta_description: string | null
          meta_title: string | null
          momentum_score: number
          name: string
          og_image: string | null
          slug: string
          summary: string | null
          trending_score: number
          type: string
          updated_at: string
          velocity_score: number | null
          what_happened: string | null
          why_it_matters: string | null
          wikidata_id: string | null
        }
        Insert: {
          aliases?: string[]
          authority_score?: number | null
          created_at?: string
          description?: string | null
          faqs?: Json | null
          id?: string
          key_facts?: Json | null
          last_mention_at?: string | null
          mention_count?: number
          mentions_last_24h?: number
          mentions_last_30d?: number
          mentions_last_7d?: number
          meta_description?: string | null
          meta_title?: string | null
          momentum_score?: number
          name: string
          og_image?: string | null
          slug: string
          summary?: string | null
          trending_score?: number
          type: string
          updated_at?: string
          velocity_score?: number | null
          what_happened?: string | null
          why_it_matters?: string | null
          wikidata_id?: string | null
        }
        Update: {
          aliases?: string[]
          authority_score?: number | null
          created_at?: string
          description?: string | null
          faqs?: Json | null
          id?: string
          key_facts?: Json | null
          last_mention_at?: string | null
          mention_count?: number
          mentions_last_24h?: number
          mentions_last_30d?: number
          mentions_last_7d?: number
          meta_description?: string | null
          meta_title?: string | null
          momentum_score?: number
          name?: string
          og_image?: string | null
          slug?: string
          summary?: string | null
          trending_score?: number
          type?: string
          updated_at?: string
          velocity_score?: number | null
          what_happened?: string | null
          why_it_matters?: string | null
          wikidata_id?: string | null
        }
        Relationships: []
      }
      entity_metrics: {
        Row: {
          day: string
          entity_id: string
          mentions: number
        }
        Insert: {
          day: string
          entity_id: string
          mentions?: number
        }
        Update: {
          day?: string
          entity_id?: string
          mentions?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_metrics_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relations: {
        Row: {
          co_occurrence_count: number
          created_at: string
          entity_id: string
          related_entity_id: string
          score: number
          updated_at: string
        }
        Insert: {
          co_occurrence_count?: number
          created_at?: string
          entity_id: string
          related_entity_id: string
          score?: number
          updated_at?: string
        }
        Update: {
          co_occurrence_count?: number
          created_at?: string
          entity_id?: string
          related_entity_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_related_entity_id_fkey"
            columns: ["related_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_stopterms: {
        Row: {
          term: string
        }
        Insert: {
          term: string
        }
        Update: {
          term?: string
        }
        Relationships: []
      }
      gsc_daily_metrics: {
        Row: {
          appearance: string
          canonical_url: string
          clicks: number
          country: string
          ctr: number
          dataset: string
          date: string
          device: string
          id: number
          impressions: number
          ingested_at: string
          page: string
          position: number
          query: string
          search_type: string
          site_url: string
        }
        Insert: {
          appearance?: string
          canonical_url: string
          clicks: number
          country?: string
          ctr: number
          dataset: string
          date: string
          device?: string
          id?: never
          impressions: number
          ingested_at?: string
          page: string
          position: number
          query?: string
          search_type?: string
          site_url: string
        }
        Update: {
          appearance?: string
          canonical_url?: string
          clicks?: number
          country?: string
          ctr?: number
          dataset?: string
          date?: string
          device?: string
          id?: never
          impressions?: number
          ingested_at?: string
          page?: string
          position?: number
          query?: string
          search_type?: string
          site_url?: string
        }
        Relationships: []
      }
      gsc_ingestion_days: {
        Row: {
          dataset: string
          date: string
          ingested_at: string
          row_count: number
          site_url: string
          status: string
        }
        Insert: {
          dataset: string
          date: string
          ingested_at?: string
          row_count: number
          site_url: string
          status: string
        }
        Update: {
          dataset?: string
          date?: string
          ingested_at?: string
          row_count?: number
          site_url?: string
          status?: string
        }
        Relationships: []
      }
      gsc_sync_state: {
        Row: {
          error: string | null
          first_available_date: string | null
          id: boolean
          last_completed_at: string | null
          last_started_at: string | null
          latest_complete_date: string | null
          retry_after: string | null
          selected_site_url: string | null
          snapshot: Json
          status: string
          target_url: string
        }
        Insert: {
          error?: string | null
          first_available_date?: string | null
          id?: boolean
          last_completed_at?: string | null
          last_started_at?: string | null
          latest_complete_date?: string | null
          retry_after?: string | null
          selected_site_url?: string | null
          snapshot?: Json
          status?: string
          target_url?: string
        }
        Update: {
          error?: string | null
          first_available_date?: string | null
          id?: boolean
          last_completed_at?: string | null
          last_started_at?: string | null
          latest_complete_date?: string | null
          retry_after?: string | null
          selected_site_url?: string | null
          snapshot?: Json
          status?: string
          target_url?: string
        }
        Relationships: []
      }
      guides: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          difficulty: string | null
          embedded_at: string | null
          embedding: string | null
          estimated_read_time: number | null
          faq_json: Json | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published: boolean
          resources_json: Json | null
          slug: string
          steps_json: Json | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          difficulty?: string | null
          embedded_at?: string | null
          embedding?: string | null
          estimated_read_time?: number | null
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          resources_json?: Json | null
          slug: string
          steps_json?: Json | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          difficulty?: string | null
          embedded_at?: string | null
          embedding?: string | null
          estimated_read_time?: number | null
          faq_json?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          resources_json?: Json | null
          slug?: string
          steps_json?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_link_queue: {
        Row: {
          article_id: string
          queued_at: string
        }
        Insert: {
          article_id: string
          queued_at?: string
        }
        Update: {
          article_id?: string
          queued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_link_queue_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_link_runs: {
        Row: {
          complete: boolean
          completed_at: string | null
          cursor: string | null
          id: boolean
          processed: number
          started_at: string
        }
        Insert: {
          complete?: boolean
          completed_at?: string | null
          cursor?: string | null
          id?: boolean
          processed?: number
          started_at?: string
        }
        Update: {
          complete?: boolean
          completed_at?: string | null
          cursor?: string | null
          id?: boolean
          processed?: number
          started_at?: string
        }
        Relationships: []
      }
      internal_links: {
        Row: {
          anchor: string | null
          created_at: string
          id: string
          relevance_score: number | null
          source_slug: string
          source_type: string
          target_slug: string
          target_type: string
        }
        Insert: {
          anchor?: string | null
          created_at?: string
          id?: string
          relevance_score?: number | null
          source_slug: string
          source_type: string
          target_slug: string
          target_type: string
        }
        Update: {
          anchor?: string | null
          created_at?: string
          id?: string
          relevance_score?: number | null
          source_slug?: string
          source_type?: string
          target_slug?: string
          target_type?: string
        }
        Relationships: []
      }
      knowledge_pages: {
        Row: {
          canonical_url: string | null
          category: string | null
          content: string | null
          created_at: string
          embedded_at: string | null
          embedding: string | null
          entity_id: string | null
          faq_json: Json | null
          id: string
          key_takeaways_json: Json | null
          meta_description: string | null
          meta_title: string | null
          published: boolean
          schema_json: Json | null
          slug: string
          summary: string | null
          title: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_id?: string | null
          faq_json?: Json | null
          id?: string
          key_takeaways_json?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          schema_json?: Json | null
          slug: string
          summary?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_id?: string | null
          faq_json?: Json | null
          id?: string
          key_takeaways_json?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          published?: boolean
          schema_json?: Json | null
          slug?: string
          summary?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_pages_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_pages_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          category: string
          confirmed: boolean
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          category?: string
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          category?: string
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      node_merge_candidates: {
        Row: {
          confidence: number
          created_at: string
          duplicate_id: string
          duplicate_name: string
          hygiene_class: string | null
          id: string
          node_type: string
          primary_id: string
          primary_name: string
          reason: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          duplicate_id: string
          duplicate_name: string
          hygiene_class?: string | null
          id?: string
          node_type: string
          primary_id: string
          primary_name: string
          reason: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          duplicate_id?: string
          duplicate_name?: string
          hygiene_class?: string | null
          id?: string
          node_type?: string
          primary_id?: string
          primary_name?: string
          reason?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          category: string | null
          commercial_score: number | null
          competition_score: number | null
          coverage_score: number | null
          cpc_value: number | null
          created_at: string
          entity_id: string | null
          geo_priority: number | null
          id: string
          keyword: string | null
          keyword_difficulty: number | null
          metadata: Json | null
          momentum_score: number | null
          notes: string | null
          opportunity_score: number | null
          recommended_content_type: string | null
          search_demand_score: number | null
          search_intent: string | null
          search_volume: number | null
          source: string | null
          status: string
          topic_id: string | null
          trend_score: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          commercial_score?: number | null
          competition_score?: number | null
          coverage_score?: number | null
          cpc_value?: number | null
          created_at?: string
          entity_id?: string | null
          geo_priority?: number | null
          id?: string
          keyword?: string | null
          keyword_difficulty?: number | null
          metadata?: Json | null
          momentum_score?: number | null
          notes?: string | null
          opportunity_score?: number | null
          recommended_content_type?: string | null
          search_demand_score?: number | null
          search_intent?: string | null
          search_volume?: number | null
          source?: string | null
          status?: string
          topic_id?: string | null
          trend_score?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          commercial_score?: number | null
          competition_score?: number | null
          coverage_score?: number | null
          cpc_value?: number | null
          created_at?: string
          entity_id?: string | null
          geo_priority?: number | null
          id?: string
          keyword?: string | null
          keyword_difficulty?: number | null
          metadata?: Json | null
          momentum_score?: number | null
          notes?: string | null
          opportunity_score?: number | null
          recommended_content_type?: string | null
          search_demand_score?: number | null
          search_intent?: string | null
          search_volume?: number | null
          source?: string | null
          status?: string
          topic_id?: string | null
          trend_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          details: Json
          duplicates_blocked: number
          duration_ms: number | null
          error: string | null
          failed: number
          id: string
          job_name: string
          processed: number
          published: number
          retry_count: number
          started_at: string
          status: string
          updated: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: Json
          duplicates_blocked?: number
          duration_ms?: number | null
          error?: string | null
          failed?: number
          id?: string
          job_name: string
          processed?: number
          published?: number
          retry_count?: number
          started_at?: string
          status?: string
          updated?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: Json
          duplicates_blocked?: number
          duration_ms?: number | null
          error?: string | null
          failed?: number
          id?: string
          job_name?: string
          processed?: number
          published?: number
          retry_count?: number
          started_at?: string
          status?: string
          updated?: number
        }
        Relationships: []
      }
      research_reports: {
        Row: {
          authors: string[] | null
          body: string | null
          category: string | null
          created_at: string
          embedded_at: string | null
          embedding: string | null
          id: string
          image_url: string | null
          published: boolean
          published_at: string
          slug: string
          sources: Json | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          authors?: string[] | null
          body?: string | null
          category?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          published?: boolean
          published_at?: string
          slug: string
          sources?: Json | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          authors?: string[] | null
          body?: string | null
          category?: string | null
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          published?: boolean
          published_at?: string
          slug?: string
          sources?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rss_feeds: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          last_fetched: string | null
          name: string
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          last_fetched?: string | null
          name: string
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          last_fetched?: string | null
          name?: string
          url?: string
        }
        Relationships: []
      }
      search_intents: {
        Row: {
          article_id: string | null
          commercial_score: number
          content_status: Database["public"]["Enums"]["search_intent_status"]
          coverage_score: number
          created_at: string
          demand_score: number
          duplicate_of: string | null
          embedded_at: string | null
          embedding: string | null
          entity_id: string | null
          geo_blocks: Json
          id: string
          intent_type: Database["public"]["Enums"]["search_intent_type"]
          is_pillar: boolean
          keyword: string
          last_generated_at: string | null
          last_validated_at: string | null
          meta: Json
          pillar_intent_id: string | null
          priority_score: number
          quality_score: number
          search_cluster: string | null
          secondary_entity_id: string | null
          target_slug: string | null
          template: string
          topic_id: string | null
          updated_at: string
          validation: Json
        }
        Insert: {
          article_id?: string | null
          commercial_score?: number
          content_status?: Database["public"]["Enums"]["search_intent_status"]
          coverage_score?: number
          created_at?: string
          demand_score?: number
          duplicate_of?: string | null
          embedded_at?: string | null
          embedding?: string | null
          entity_id?: string | null
          geo_blocks?: Json
          id?: string
          intent_type?: Database["public"]["Enums"]["search_intent_type"]
          is_pillar?: boolean
          keyword: string
          last_generated_at?: string | null
          last_validated_at?: string | null
          meta?: Json
          pillar_intent_id?: string | null
          priority_score?: number
          quality_score?: number
          search_cluster?: string | null
          secondary_entity_id?: string | null
          target_slug?: string | null
          template: string
          topic_id?: string | null
          updated_at?: string
          validation?: Json
        }
        Update: {
          article_id?: string | null
          commercial_score?: number
          content_status?: Database["public"]["Enums"]["search_intent_status"]
          coverage_score?: number
          created_at?: string
          demand_score?: number
          duplicate_of?: string | null
          embedded_at?: string | null
          embedding?: string | null
          entity_id?: string | null
          geo_blocks?: Json
          id?: string
          intent_type?: Database["public"]["Enums"]["search_intent_type"]
          is_pillar?: boolean
          keyword?: string
          last_generated_at?: string | null
          last_validated_at?: string | null
          meta?: Json
          pillar_intent_id?: string | null
          priority_score?: number
          quality_score?: number
          search_cluster?: string | null
          secondary_entity_id?: string | null
          target_slug?: string | null
          template?: string
          topic_id?: string | null
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "search_intents_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_intents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_intents_pillar_intent_id_fkey"
            columns: ["pillar_intent_id"]
            isOneToOne: false
            referencedRelation: "search_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_intents_secondary_entity_id_fkey"
            columns: ["secondary_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_intents_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      search_performance_signals: {
        Row: {
          canonical_url: string
          content_type: string
          mapping: Json
          metrics: Json
          recommendation: Json
          refreshed_at: string
        }
        Insert: {
          canonical_url: string
          content_type: string
          mapping?: Json
          metrics?: Json
          recommendation?: Json
          refreshed_at?: string
        }
        Update: {
          canonical_url?: string
          content_type?: string
          mapping?: Json
          metrics?: Json
          recommendation?: Json
          refreshed_at?: string
        }
        Relationships: []
      }
      source_library: {
        Row: {
          authority_score: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          region: string | null
          resource_type: string | null
          source_type: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          authority_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          region?: string | null
          resource_type?: string | null
          source_type?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          authority_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          region?: string | null
          resource_type?: string | null
          source_type?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          article_id: string | null
          context: Json | null
          created_at: string
          feed_id: string | null
          id: string
          log_level: string
          log_type: string
          message: string
        }
        Insert: {
          article_id?: string | null
          context?: Json | null
          created_at?: string
          feed_id?: string | null
          id?: string
          log_level: string
          log_type: string
          message: string
        }
        Update: {
          article_id?: string | null
          context?: Json | null
          created_at?: string
          feed_id?: string | null
          id?: string
          log_level?: string
          log_type?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_relations: {
        Row: {
          created_at: string
          related_topic_id: string
          score: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          related_topic_id: string
          score?: number
          topic_id: string
        }
        Update: {
          created_at?: string
          related_topic_id?: string
          score?: number
          topic_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          aliases: string[] | null
          article_count: number
          articles_last_30d: number
          articles_last_7d: number
          authority_score: number | null
          category_hint: string | null
          created_at: string
          description: string | null
          explainer_article_id: string | null
          hero_article_id: string | null
          hero_entity_id: string | null
          id: string
          last_article_at: string | null
          meta_description: string | null
          meta_title: string | null
          momentum_score: number | null
          name: string
          og_image: string | null
          slug: string
          trending_score: number
          updated_at: string
          velocity_score: number | null
        }
        Insert: {
          aliases?: string[] | null
          article_count?: number
          articles_last_30d?: number
          articles_last_7d?: number
          authority_score?: number | null
          category_hint?: string | null
          created_at?: string
          description?: string | null
          explainer_article_id?: string | null
          hero_article_id?: string | null
          hero_entity_id?: string | null
          id?: string
          last_article_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          momentum_score?: number | null
          name: string
          og_image?: string | null
          slug: string
          trending_score?: number
          updated_at?: string
          velocity_score?: number | null
        }
        Update: {
          aliases?: string[] | null
          article_count?: number
          articles_last_30d?: number
          articles_last_7d?: number
          authority_score?: number | null
          category_hint?: string | null
          created_at?: string
          description?: string | null
          explainer_article_id?: string | null
          hero_article_id?: string | null
          hero_entity_id?: string | null
          id?: string
          last_article_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          momentum_score?: number | null
          name?: string
          og_image?: string | null
          slug?: string
          trending_score?: number
          updated_at?: string
          velocity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_hero_entity_fk"
            columns: ["hero_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_backfill_progress: { Args: never; Returns: Json }
      candidate_nodes_for_article: {
        Args: { _article_id: string; _limit?: number; _neighbours?: number }
        Returns: {
          id: string
          name: string
          node_type: string
          ntype: string
          score: number
          source: string
        }[]
      }
      classify_ai_required: { Args: never; Returns: Json }
      classify_merge_candidates: { Args: never; Returns: Json }
      cluster_membership_stats: {
        Args: never
        Returns: {
          articles: number
          comparisons: number
          entities_represented: number
          guides: number
          knowledge_pages: number
          last_30d: number
          last_7d: number
          last_article_at: string
          name: string
          slug: string
          topics_represented: number
        }[]
      }
      complete_pipeline_run: {
        Args: {
          _details?: Json
          _duplicates_blocked?: number
          _error?: string
          _failed?: number
          _id: string
          _processed?: number
          _published?: number
          _retry_count?: number
          _status: string
          _updated?: number
        }
        Returns: undefined
      }
      cron_invoke: { Args: { _body?: Json; _fn: string }; Returns: number }
      detect_node_merge_candidates: { Args: never; Returns: Json }
      deterministic_alias_pass: { Args: { _limit?: number }; Returns: Json }
      deterministic_enrich_batch: { Args: { _limit?: number }; Returns: Json }
      find_entity_by_normalized_name: {
        Args: { _name: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      find_topic_by_normalized_name: {
        Args: { _name: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      graph_convergence_status: { Args: never; Returns: Json }
      graph_ready_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_public_link_endpoint: {
        Args: { endpoint_slug: string; endpoint_type: string }
        Returns: boolean
      }
      match_editorial_content: {
        Args: {
          exclude_ref?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content_type: string
          ref: string
          similarity: number
          title: string
        }[]
      }
      merge_nodes: {
        Args: { _duplicate: string; _node_type: string; _primary: string }
        Returns: Json
      }
      normalize_node_name: { Args: { s: string }; Returns: string }
      phase7c_link_audit: { Args: never; Returns: Json }
      phase7c_link_batch: {
        Args: { p_limit?: number; p_reset?: boolean }
        Returns: Json
      }
      phase7c_map_urls: { Args: { p_urls: string[] }; Returns: Json }
      phase7c_reference_links: { Args: never; Returns: number }
      phase7c_replace_gsc_day: {
        Args: {
          p_dataset: string
          p_date: string
          p_rows: Json
          p_site: string
          p_status: string
        }
        Returns: undefined
      }
      preview_article_clusters: {
        Args: never
        Returns: {
          article_id: string
          cluster_slug: string
          matched_refs: Json
          reason: string
          score: number
        }[]
      }
      rebuild_article_clusters: { Args: never; Returns: Json }
      recompute_enrich_priority: { Args: never; Returns: number }
      review_merge_candidates: { Args: never; Returns: Json }
      score_ai_queue: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_pipeline_run: {
        Args: { _job: string; _stale_minutes?: number }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
      search_intent_status:
        | "pending"
        | "queued"
        | "generating"
        | "published"
        | "failed"
        | "skipped"
      search_intent_type:
        | "informational"
        | "commercial"
        | "transactional"
        | "comparison"
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
    Enums: {
      app_role: ["admin", "editor", "user"],
      search_intent_status: [
        "pending",
        "queued",
        "generating",
        "published",
        "failed",
        "skipped",
      ],
      search_intent_type: [
        "informational",
        "commercial",
        "transactional",
        "comparison",
      ],
    },
  },
} as const
