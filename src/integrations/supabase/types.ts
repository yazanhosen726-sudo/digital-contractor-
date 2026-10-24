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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_actions: {
        Row: {
          action_type: string
          conversation_id: string | null
          created_at: string
          decided_at: string | null
          error: string | null
          id: string
          org_id: string
          payload: Json
          result: Json | null
          status: Database["public"]["Enums"]["ai_action_status"]
          summary: string
          user_id: string
        }
        Insert: {
          action_type: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          error?: string | null
          id?: string
          org_id: string
          payload: Json
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_action_status"]
          summary: string
          user_id: string
        }
        Update: {
          action_type?: string
          conversation_id?: string | null
          created_at?: string
          decided_at?: string | null
          error?: string | null
          id?: string
          org_id?: string
          payload?: Json
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_action_status"]
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          org_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          org_id: string
          role: string
          tool_trace: Json
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          org_id: string
          role: string
          tool_trace?: Json
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          tool_trace?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          org_id: string
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          org_id: string
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          org_id?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      budget_revisions: {
        Row: {
          amount_delta: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          org_id: string
          project_id: string
          reason: string
          requested_by: string | null
          status: Database["public"]["Enums"]["revision_status"]
        }
        Insert: {
          amount_delta: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          org_id: string
          project_id: string
          reason: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["revision_status"]
        }
        Update: {
          amount_delta?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          org_id?: string
          project_id?: string
          reason?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["revision_status"]
        }
        Relationships: [
          {
            foreignKeyName: "budget_revisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      design_assets: {
        Row: {
          asset_type: string
          created_at: string
          created_by: string | null
          data: Json
          document_id: string | null
          id: string
          org_id: string
          project_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          asset_type?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          document_id?: string | null
          id?: string
          org_id: string
          project_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          document_id?: string | null
          id?: string
          org_id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "design_assets_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          extracted_data: Json | null
          extraction_issues: Json
          extraction_model: string | null
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          org_id: string
          project_id: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          extracted_data?: Json | null
          extraction_issues?: Json
          extraction_model?: string | null
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          org_id: string
          project_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          extracted_data?: Json | null
          extraction_issues?: Json
          extraction_model?: string | null
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          org_id?: string
          project_id?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          created_by: string | null
          from_currency: string
          id: string
          org_id: string
          rate: number
          rate_date: string
          source: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_currency: string
          id?: string
          org_id: string
          rate: number
          rate_date: string
          source?: string
          to_currency: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_currency?: string
          id?: string
          org_id?: string
          rate?: number
          rate_date?: string
          source?: string
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          archived: boolean
          code: string
          created_at: string
          id: string
          is_labor: boolean
          name: string
          org_id: string
        }
        Insert: {
          archived?: boolean
          code: string
          created_at?: string
          id?: string
          is_labor?: boolean
          name: string
          org_id: string
        }
        Update: {
          archived?: boolean
          code?: string
          created_at?: string
          id?: string
          is_labor?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_lines: {
        Row: {
          created_at: string
          delivery_included: boolean | null
          expense_id: string
          id: string
          item_key: string | null
          item_name: string
          line_total: number
          org_id: string
          quantity: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          delivery_included?: boolean | null
          expense_id: string
          id?: string
          item_key?: string | null
          item_name: string
          line_total: number
          org_id: string
          quantity: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          delivery_included?: boolean | null
          expense_id?: string
          id?: string
          item_key?: string | null
          item_name?: string
          line_total?: number
          org_id?: string
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_lines_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          discount_amount: number
          document_id: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          is_general_overhead: boolean
          needs_review: boolean
          notes: string | null
          org_id: string
          payment_method: string | null
          project_id: string | null
          purchase_order_id: string | null
          review_reasons: string[]
          source: Database["public"]["Enums"]["data_source"]
          status: Database["public"]["Enums"]["expense_status"]
          subtotal: number
          supplier_id: string | null
          tax_amount: number
          tax_rate_id: string | null
          total_amount: number
          transaction_date: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          description: string
          discount_amount?: number
          document_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          is_general_overhead?: boolean
          needs_review?: boolean
          notes?: string | null
          org_id: string
          payment_method?: string | null
          project_id?: string | null
          purchase_order_id?: string | null
          review_reasons?: string[]
          source?: Database["public"]["Enums"]["data_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          subtotal: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate_id?: string | null
          total_amount: number
          transaction_date: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          discount_amount?: number
          document_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          is_general_overhead?: boolean
          needs_review?: boolean
          notes?: string | null
          org_id?: string
          payment_method?: string | null
          project_id?: string | null
          purchase_order_id?: string | null
          review_reasons?: string[]
          source?: Database["public"]["Enums"]["data_source"]
          status?: Database["public"]["Enums"]["expense_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_amount?: number
          tax_rate_id?: string | null
          total_amount?: number
          transaction_date?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          expense_id: string | null
          id: string
          notes: string | null
          org_id: string
          project_id: string | null
          quantity: number
          rate: number
          status: Database["public"]["Enums"]["labor_status"]
          unit: string
          work_date: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          project_id?: string | null
          quantity: number
          rate: number
          status?: Database["public"]["Enums"]["labor_status"]
          unit: string
          work_date: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          project_id?: string | null
          quantity?: number
          rate?: number
          status?: Database["public"]["Enums"]["labor_status"]
          unit?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_entries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          org_id: string
          project_id: string
          title: string
          verified: boolean
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          project_id: string
          title: string
          verified?: boolean
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          project_id?: string
          title?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "milestones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country_code: string | null
          created_at: string
          created_by: string
          date_format: string
          id: string
          locale: string
          measurement_system: string
          name: string
          reporting_currency: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          created_by: string
          date_format?: string
          id?: string
          locale?: string
          measurement_system?: string
          name: string
          reporting_currency?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          created_by?: string
          date_format?: string
          id?: string
          locale?: string
          measurement_system?: string
          name?: string
          reporting_currency?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          expense_id: string | null
          id: string
          idempotency_key: string | null
          method: string | null
          notes: string | null
          org_id: string
          payment_date: string
          project_id: string | null
          receivable_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          expense_id?: string | null
          id?: string
          idempotency_key?: string | null
          method?: string | null
          notes?: string | null
          org_id: string
          payment_date: string
          project_id?: string | null
          receivable_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          expense_id?: string | null
          id?: string
          idempotency_key?: string | null
          method?: string | null
          notes?: string | null
          org_id?: string
          payment_date?: string
          project_id?: string | null
          receivable_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_budget_lines: {
        Row: {
          category_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          planned_amount: number
          project_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          planned_amount: number
          project_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          planned_amount?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          code: string
          contract_value: number | null
          created_at: string
          created_by: string | null
          currency: string
          expected_completion_date: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          org_id: string
          original_budget: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          code: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency: string
          expected_completion_date?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          org_id: string
          original_budget?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          code?: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_completion_date?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          original_budget?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          org_id: string
          po_number: string
          project_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          org_id: string
          po_number: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          org_id?: string
          po_number?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          org_id: string
          project_id: string | null
          reference: string
          status: Database["public"]["Enums"]["receivable_status"]
          total_amount: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          due_date?: string | null
          id?: string
          issue_date: string
          notes?: string | null
          org_id: string
          project_id?: string | null
          reference: string
          status?: Database["public"]["Enums"]["receivable_status"]
          total_amount: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          project_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["receivable_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          supplies: string[]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          supplies?: string[]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          supplies?: string[]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_inclusive: boolean
          jurisdiction: string | null
          name: string
          org_id: string
          rate_percent: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_inclusive?: boolean
          jurisdiction?: string | null
          name: string
          org_id: string
          rate_percent: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_inclusive?: boolean
          jurisdiction?: string | null
          name?: string
          org_id?: string
          rate_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          active: boolean
          arrangement: string
          created_at: string
          currency: string
          default_rate: number | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          supplier_id: string | null
          trade: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          arrangement?: string
          created_at?: string
          currency: string
          default_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          supplier_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          arrangement?: string
          created_at?: string
          currency?: string
          default_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          supplier_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_finance: { Args: { _org: string }; Returns: boolean }
      can_write_org: { Args: { _org: string }; Returns: boolean }
      create_organization: {
        Args: { _currency?: string; _name: string }
        Returns: string
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
    }
    Enums: {
      ai_action_status:
        | "proposed"
        | "confirmed"
        | "executed"
        | "rejected"
        | "failed"
      approval_status: "not_required" | "pending" | "approved" | "rejected"
      data_source: "manual" | "ai_extracted" | "verified" | "labor_entry"
      document_status:
        | "uploaded"
        | "extracting"
        | "needs_review"
        | "verified"
        | "failed"
      expense_status: "draft" | "recorded" | "void"
      labor_status: "planned" | "recorded" | "void"
      org_role:
        | "owner"
        | "admin"
        | "accountant"
        | "project_manager"
        | "member"
        | "viewer"
      payment_direction: "outgoing" | "incoming"
      po_status:
        | "draft"
        | "issued"
        | "partially_invoiced"
        | "closed"
        | "cancelled"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      receivable_status: "draft" | "issued" | "void"
      revision_status: "pending" | "approved" | "rejected"
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
      ai_action_status: [
        "proposed",
        "confirmed",
        "executed",
        "rejected",
        "failed",
      ],
      approval_status: ["not_required", "pending", "approved", "rejected"],
      data_source: ["manual", "ai_extracted", "verified", "labor_entry"],
      document_status: [
        "uploaded",
        "extracting",
        "needs_review",
        "verified",
        "failed",
      ],
      expense_status: ["draft", "recorded", "void"],
      labor_status: ["planned", "recorded", "void"],
      org_role: [
        "owner",
        "admin",
        "accountant",
        "project_manager",
        "member",
        "viewer",
      ],
      payment_direction: ["outgoing", "incoming"],
      po_status: [
        "draft",
        "issued",
        "partially_invoiced",
        "closed",
        "cancelled",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      receivable_status: ["draft", "issued", "void"],
      revision_status: ["pending", "approved", "rejected"],
    },
  },
} as const
