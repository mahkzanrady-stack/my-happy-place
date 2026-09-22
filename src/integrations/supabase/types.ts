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
      artifacts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          identifier: string
          kind: Database["public"]["Enums"]["artifact_kind"]
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          identifier: string
          kind: Database["public"]["Enums"]["artifact_kind"]
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          identifier?: string
          kind?: Database["public"]["Enums"]["artifact_kind"]
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["beneficiary_kind"]
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["beneficiary_kind"]
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["beneficiary_kind"]
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          actor: string | null
          changed_apis: string[]
          changed_files: string[]
          changed_tables: string[]
          created_at: string
          cycle_id: string | null
          decisions: string | null
          done_summary: string
          execution_id: string | null
          id: string
          is_final: boolean
          issues: string | null
          last_successful_step: string
          next_action: string
          project_id: string
          remaining: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_id: string
          tests: string | null
        }
        Insert: {
          actor?: string | null
          changed_apis?: string[]
          changed_files?: string[]
          changed_tables?: string[]
          created_at?: string
          cycle_id?: string | null
          decisions?: string | null
          done_summary: string
          execution_id?: string | null
          id?: string
          is_final?: boolean
          issues?: string | null
          last_successful_step: string
          next_action: string
          project_id: string
          remaining?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id: string
          tests?: string | null
        }
        Update: {
          actor?: string | null
          changed_apis?: string[]
          changed_files?: string[]
          changed_tables?: string[]
          created_at?: string
          cycle_id?: string | null
          decisions?: string | null
          done_summary?: string
          execution_id?: string | null
          id?: string
          is_final?: boolean
          issues?: string | null
          last_successful_step?: string
          next_action?: string
          project_id?: string
          remaining?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_id?: string
          tests?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "task_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "task_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      constitution_rule_history: {
        Row: {
          approved_by: string | null
          change_reason: string
          created_at: string
          id: string
          new_rule_text: string | null
          new_status: Database["public"]["Enums"]["rule_status"] | null
          old_rule_text: string | null
          old_status: Database["public"]["Enums"]["rule_status"] | null
          project_id: string
          related_task_id: string | null
          rule_id: string
        }
        Insert: {
          approved_by?: string | null
          change_reason: string
          created_at?: string
          id?: string
          new_rule_text?: string | null
          new_status?: Database["public"]["Enums"]["rule_status"] | null
          old_rule_text?: string | null
          old_status?: Database["public"]["Enums"]["rule_status"] | null
          project_id: string
          related_task_id?: string | null
          rule_id: string
        }
        Update: {
          approved_by?: string | null
          change_reason?: string
          created_at?: string
          id?: string
          new_rule_text?: string | null
          new_status?: Database["public"]["Enums"]["rule_status"] | null
          old_rule_text?: string | null
          old_status?: Database["public"]["Enums"]["rule_status"] | null
          project_id?: string
          related_task_id?: string | null
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "constitution_rule_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitution_rule_history_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitution_rule_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "constitution_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      constitution_rules: {
        Row: {
          category: Database["public"]["Enums"]["rule_category"]
          code: string | null
          constitution_id: string | null
          created_at: string
          id: string
          keywords: string[]
          project_id: string
          rationale: string | null
          rule_text: string
          section_id: string | null
          severity_level: Database["public"]["Enums"]["rule_severity_level"]
          status: Database["public"]["Enums"]["rule_status"]
          updated_at: string
          version: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["rule_category"]
          code?: string | null
          constitution_id?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          project_id: string
          rationale?: string | null
          rule_text: string
          section_id?: string | null
          severity_level?: Database["public"]["Enums"]["rule_severity_level"]
          status?: Database["public"]["Enums"]["rule_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["rule_category"]
          code?: string | null
          constitution_id?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          project_id?: string
          rationale?: string | null
          rule_text?: string
          section_id?: string | null
          severity_level?: Database["public"]["Enums"]["rule_severity_level"]
          status?: Database["public"]["Enums"]["rule_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "constitution_rules_constitution_id_fkey"
            columns: ["constitution_id"]
            isOneToOne: false
            referencedRelation: "constitutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitution_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitution_rules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "constitution_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      constitution_sections: {
        Row: {
          constitution_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          project_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          constitution_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          project_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          constitution_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          project_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "constitution_sections_constitution_id_fkey"
            columns: ["constitution_id"]
            isOneToOne: false
            referencedRelation: "constitutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constitution_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      constitutions: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          status: string
          summary: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          status?: string
          summary?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "constitutions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_logs: {
        Row: {
          actor: string | null
          created_at: string
          cycle_id: string | null
          description: string
          details: Json
          event_type: string
          execution_id: string | null
          id: string
          outcome: string | null
          project_id: string
          task_id: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          cycle_id?: string | null
          description: string
          details?: Json
          event_type: string
          execution_id?: string | null
          id?: string
          outcome?: string | null
          project_id: string
          task_id?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          cycle_id?: string | null
          description?: string
          details?: Json
          event_type?: string
          execution_id?: string | null
          id?: string
          outcome?: string | null
          project_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_logs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "task_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "task_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_position: {
        Row: {
          affected_later_tasks: string[]
          blocked_by: string | null
          completed_work: string | null
          created_at: string
          current_phase_id: string | null
          current_task_id: string | null
          id: string
          is_active: boolean
          last_checkpoint_id: string | null
          last_completed_task_id: string | null
          last_execution_id: string | null
          last_known_good_state: string | null
          next_action: string | null
          next_natural_task_id: string | null
          next_natural_task_note: string | null
          project_id: string
          remaining_work: string | null
          reopened_from_task_id: string | null
          resume_reason: Database["public"]["Enums"]["resume_reason"] | null
          resume_rule: string | null
          task_status: Database["public"]["Enums"]["task_status"] | null
          updated_at: string
        }
        Insert: {
          affected_later_tasks?: string[]
          blocked_by?: string | null
          completed_work?: string | null
          created_at?: string
          current_phase_id?: string | null
          current_task_id?: string | null
          id?: string
          is_active?: boolean
          last_checkpoint_id?: string | null
          last_completed_task_id?: string | null
          last_execution_id?: string | null
          last_known_good_state?: string | null
          next_action?: string | null
          next_natural_task_id?: string | null
          next_natural_task_note?: string | null
          project_id: string
          remaining_work?: string | null
          reopened_from_task_id?: string | null
          resume_reason?: Database["public"]["Enums"]["resume_reason"] | null
          resume_rule?: string | null
          task_status?: Database["public"]["Enums"]["task_status"] | null
          updated_at?: string
        }
        Update: {
          affected_later_tasks?: string[]
          blocked_by?: string | null
          completed_work?: string | null
          created_at?: string
          current_phase_id?: string | null
          current_task_id?: string | null
          id?: string
          is_active?: boolean
          last_checkpoint_id?: string | null
          last_completed_task_id?: string | null
          last_execution_id?: string | null
          last_known_good_state?: string | null
          next_action?: string | null
          next_natural_task_id?: string | null
          next_natural_task_note?: string | null
          project_id?: string
          remaining_work?: string | null
          reopened_from_task_id?: string | null
          resume_reason?: Database["public"]["Enums"]["resume_reason"] | null
          resume_rule?: string | null
          task_status?: Database["public"]["Enums"]["task_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_position_current_phase_id_fkey"
            columns: ["current_phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_current_task_id_fkey"
            columns: ["current_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_last_checkpoint_id_fkey"
            columns: ["last_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_last_completed_task_id_fkey"
            columns: ["last_completed_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_last_execution_id_fkey"
            columns: ["last_execution_id"]
            isOneToOne: false
            referencedRelation: "task_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_next_natural_task_id_fkey"
            columns: ["next_natural_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_position_reopened_from_task_id_fkey"
            columns: ["reopened_from_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_transactions: {
        Row: {
          amount: number
          beneficiary_id: string | null
          context: Database["public"]["Enums"]["tx_context"]
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          notes: string | null
          occurred_at: string
          paid_amount: number
          payment_type: Database["public"]["Enums"]["payment_type"]
          type_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          context?: Database["public"]["Enums"]["tx_context"]
          created_at?: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          occurred_at?: string
          paid_amount?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          type_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          context?: Database["public"]["Enums"]["tx_context"]
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          occurred_at?: string
          paid_amount?: number
          payment_type?: Database["public"]["Enums"]["payment_type"]
          type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_transactions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_transactions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "movement_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      money_transactions: {
        Row: {
          amount: number
          beneficiary_id: string | null
          context: Database["public"]["Enums"]["tx_context"]
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          notes: string | null
          occurred_at: string
          type_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          context?: Database["public"]["Enums"]["tx_context"]
          created_at?: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          occurred_at?: string
          type_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          context?: Database["public"]["Enums"]["tx_context"]
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          notes?: string | null
          occurred_at?: string
          type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_transactions_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_transactions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "movement_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_types: {
        Row: {
          created_at: string
          domain: Database["public"]["Enums"]["movement_domain"]
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: Database["public"]["Enums"]["movement_domain"]
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: Database["public"]["Enums"]["movement_domain"]
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balance_history: {
        Row: {
          changed_at: string
          id: string
          new_value: number
          old_value: number
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_value: number
          old_value: number
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_value?: number
          old_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balance_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          project_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          manager_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          manager_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          manager_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_decisions: {
        Row: {
          alternatives: string | null
          created_at: string
          decided_at: string
          decided_by: string | null
          decision: string
          id: string
          impact: string | null
          project_id: string
          reason: string
          status: Database["public"]["Enums"]["decision_status"]
          superseded_by: string | null
          task_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          alternatives?: string | null
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision: string
          id?: string
          impact?: string | null
          project_id: string
          reason: string
          status?: Database["public"]["Enums"]["decision_status"]
          superseded_by?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          alternatives?: string | null
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision?: string
          id?: string
          impact?: string | null
          project_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["decision_status"]
          superseded_by?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_decisions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "project_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_description: {
        Row: {
          architecture: string | null
          core_principles: string[]
          created_at: string
          description: string | null
          fixed_facts: Json
          goal: string | null
          id: string
          integrations: string[]
          main_components: string[]
          main_systems: string[]
          problem_solved: string | null
          project_id: string
          purpose: string | null
          target_users: string | null
          technologies: string[]
          updated_at: string
          updated_by: string | null
          version: number
          vision: string | null
        }
        Insert: {
          architecture?: string | null
          core_principles?: string[]
          created_at?: string
          description?: string | null
          fixed_facts?: Json
          goal?: string | null
          id?: string
          integrations?: string[]
          main_components?: string[]
          main_systems?: string[]
          problem_solved?: string | null
          project_id: string
          purpose?: string | null
          target_users?: string | null
          technologies?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: number
          vision?: string | null
        }
        Update: {
          architecture?: string | null
          core_principles?: string[]
          created_at?: string
          description?: string | null
          fixed_facts?: Json
          goal?: string | null
          id?: string
          integrations?: string[]
          main_components?: string[]
          main_systems?: string[]
          problem_solved?: string | null
          project_id?: string
          purpose?: string | null
          target_users?: string | null
          technologies?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: number
          vision?: string | null
        }
        Relationships: []
      }
      project_description_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          project_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          project_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          project_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: []
      }
      project_execution_summary: {
        Row: {
          created_at: string
          current_focus: string | null
          current_task_id: string | null
          id: string
          is_authoritative: boolean
          last_important_point: string | null
          operational_constraints: string[]
          overall_state: string | null
          project_id: string
          stack: string | null
          updated_at: string
          what_is_project: string | null
        }
        Insert: {
          created_at?: string
          current_focus?: string | null
          current_task_id?: string | null
          id?: string
          is_authoritative?: boolean
          last_important_point?: string | null
          operational_constraints?: string[]
          overall_state?: string | null
          project_id: string
          stack?: string | null
          updated_at?: string
          what_is_project?: string | null
        }
        Update: {
          created_at?: string
          current_focus?: string | null
          current_task_id?: string | null
          id?: string
          is_authoritative?: boolean
          last_important_point?: string | null
          operational_constraints?: string[]
          overall_state?: string | null
          project_id?: string
          stack?: string | null
          updated_at?: string
          what_is_project?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          active_constitution_id: string | null
          created_at: string
          current_task_id: string | null
          description_id: string | null
          id: string
          name: string
          owner_id: string
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_constitution_id?: string | null
          created_at?: string
          current_task_id?: string | null
          description_id?: string | null
          id?: string
          name: string
          owner_id?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_constitution_id?: string | null
          created_at?: string
          current_task_id?: string | null
          description_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      resume_packages: {
        Row: {
          completed: string | null
          created_at: string
          current_state: string | null
          cycle_id: string | null
          id: string
          is_active: boolean
          last_checkpoint_id: string | null
          last_known_good_state: string | null
          next_action: string
          position_id: string | null
          project_id: string
          relevant_apis: string[]
          relevant_decisions: string[]
          relevant_files: string[]
          relevant_rules: string[]
          relevant_tables: string[]
          remaining: string | null
          resume_reason: Database["public"]["Enums"]["resume_reason"] | null
          task_id: string
          updated_at: string
        }
        Insert: {
          completed?: string | null
          created_at?: string
          current_state?: string | null
          cycle_id?: string | null
          id?: string
          is_active?: boolean
          last_checkpoint_id?: string | null
          last_known_good_state?: string | null
          next_action: string
          position_id?: string | null
          project_id: string
          relevant_apis?: string[]
          relevant_decisions?: string[]
          relevant_files?: string[]
          relevant_rules?: string[]
          relevant_tables?: string[]
          remaining?: string | null
          resume_reason?: Database["public"]["Enums"]["resume_reason"] | null
          task_id: string
          updated_at?: string
        }
        Update: {
          completed?: string | null
          created_at?: string
          current_state?: string | null
          cycle_id?: string | null
          id?: string
          is_active?: boolean
          last_checkpoint_id?: string | null
          last_known_good_state?: string | null
          next_action?: string
          position_id?: string | null
          project_id?: string
          relevant_apis?: string[]
          relevant_decisions?: string[]
          relevant_files?: string[]
          relevant_rules?: string[]
          relevant_tables?: string[]
          remaining?: string | null
          resume_reason?: Database["public"]["Enums"]["resume_reason"] | null
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_conflicts: {
        Row: {
          affected_artifact: string | null
          created_at: string
          description: string
          execution_id: string | null
          finding: string | null
          id: string
          inspected_scope: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          source_a: string | null
          source_b: string | null
          status: Database["public"]["Enums"]["conflict_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          affected_artifact?: string | null
          created_at?: string
          description: string
          execution_id?: string | null
          finding?: string | null
          id?: string
          inspected_scope?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          source_a?: string | null
          source_b?: string | null
          status?: Database["public"]["Enums"]["conflict_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          affected_artifact?: string | null
          created_at?: string
          description?: string
          execution_id?: string | null
          finding?: string | null
          id?: string
          inspected_scope?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          source_a?: string | null
          source_b?: string | null
          status?: Database["public"]["Enums"]["conflict_status"]
          task_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_artifacts: {
        Row: {
          action: Database["public"]["Enums"]["artifact_action"]
          artifact_id: string
          created_at: string
          cycle_id: string | null
          id: string
          project_id: string
          purpose: string | null
          task_id: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["artifact_action"]
          artifact_id: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          project_id: string
          purpose?: string | null
          task_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["artifact_action"]
          artifact_id?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          project_id?: string
          purpose?: string | null
          task_id?: string
        }
        Relationships: []
      }
      task_changes: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          task_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          task_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          task_id?: string
        }
        Relationships: []
      }
      task_constitution_rules: {
        Row: {
          created_at: string
          id: string
          project_id: string
          relevance_note: string | null
          rule_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          relevance_note?: string | null
          rule_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          relevance_note?: string | null
          rule_id?: string
          task_id?: string
        }
        Relationships: []
      }
      task_cycles: {
        Row: {
          closed_at: string | null
          cycle_number: number
          id: string
          opened_at: string
          outcome: string | null
          project_id: string
          reason: string | null
          task_id: string
        }
        Insert: {
          closed_at?: string | null
          cycle_number?: number
          id?: string
          opened_at?: string
          outcome?: string | null
          project_id: string
          reason?: string | null
          task_id: string
        }
        Update: {
          closed_at?: string | null
          cycle_number?: number
          id?: string
          opened_at?: string
          outcome?: string | null
          project_id?: string
          reason?: string | null
          task_id?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          depends_on_task_id: string
          id: string
          project_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          project_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: []
      }
      task_executions: {
        Row: {
          created_at: string
          cycle_id: string | null
          ended_at: string | null
          executor_name: string | null
          executor_type: string
          id: string
          project_id: string
          started_at: string
          status: Database["public"]["Enums"]["execution_session_status"]
          stop_reason: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          ended_at?: string | null
          executor_name?: string | null
          executor_type?: string
          id?: string
          project_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["execution_session_status"]
          stop_reason?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          ended_at?: string | null
          executor_name?: string | null
          executor_type?: string
          id?: string
          project_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["execution_session_status"]
          stop_reason?: string | null
          task_id?: string
        }
        Relationships: []
      }
      task_relations: {
        Row: {
          created_at: string
          id: string
          note: string | null
          project_id: string
          related_task_id: string
          relation_type: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          project_id: string
          related_task_id: string
          relation_type?: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string
          related_task_id?: string
          relation_type?: string
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          cancelled_at: string | null
          code: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          execution_approach: string | null
          execution_steps: Json
          goal: string | null
          id: string
          keywords: string[]
          last_executor: string | null
          last_known_good_state: string | null
          next_action: string | null
          notes: string | null
          parent_task_id: string | null
          phase_id: string | null
          priority: number
          project_id: string
          reason: string | null
          required_relations: string | null
          required_tools: string[]
          risks: string | null
          scope: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          success_criteria: string | null
          testing_method: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          code?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          execution_approach?: string | null
          execution_steps?: Json
          goal?: string | null
          id?: string
          keywords?: string[]
          last_executor?: string | null
          last_known_good_state?: string | null
          next_action?: string | null
          notes?: string | null
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: number
          project_id: string
          reason?: string | null
          required_relations?: string | null
          required_tools?: string[]
          risks?: string | null
          scope?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          success_criteria?: string | null
          testing_method?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          code?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          execution_approach?: string | null
          execution_steps?: Json
          goal?: string | null
          id?: string
          keywords?: string[]
          last_executor?: string | null
          last_known_good_state?: string | null
          next_action?: string | null
          notes?: string | null
          parent_task_id?: string | null
          phase_id?: string | null
          priority?: number
          project_id?: string
          reason?: string | null
          required_relations?: string | null
          required_tools?: string[]
          risks?: string | null
          scope?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          success_criteria?: string | null
          testing_method?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      user_settings: {
        Row: {
          created_at: string
          opening_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opening_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          opening_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      get_resume_message: { Args: { _project_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      owns_project: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "admin_staff" | "user" | "user_staff"
      artifact_action:
        | "created"
        | "modified"
        | "deleted"
        | "inspected"
        | "verified"
      artifact_kind:
        | "file"
        | "table"
        | "api"
        | "component"
        | "other"
        | "integration"
      beneficiary_kind:
        | "supplier"
        | "shipping_company"
        | "shipping_agent"
        | "employee"
        | "other"
      conflict_status: "open" | "investigating" | "resolved" | "dismissed"
      decision_status: "active" | "superseded" | "reverted"
      execution_session_status: "running" | "paused" | "completed" | "aborted"
      movement_domain: "goods" | "money"
      payment_type: "cash" | "credit" | "partial"
      resume_reason:
        | "NEW_TASK"
        | "OPEN_TASK"
        | "REOPENED_TASK"
        | "BLOCKED_TASK"
        | "RESUME_AFTER_SESSION_END"
        | "RESUME_AFTER_RESOURCE_EXHAUSTION"
      rule_category:
        | "red_line"
        | "warning"
        | "recommendation"
        | "execution_rule"
        | "verification_rule"
      rule_severity_level: "critical" | "high" | "normal"
      rule_status: "active" | "disabled" | "archived"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "reopened"
        | "cancelled"
        | "soft_deleted"
        | "blocked"
        | "verify"
      tx_context: "personal" | "business"
      tx_direction: "in" | "out"
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
      app_role: ["admin", "admin_staff", "user", "user_staff"],
      artifact_action: [
        "created",
        "modified",
        "deleted",
        "inspected",
        "verified",
      ],
      artifact_kind: [
        "file",
        "table",
        "api",
        "component",
        "other",
        "integration",
      ],
      beneficiary_kind: [
        "supplier",
        "shipping_company",
        "shipping_agent",
        "employee",
        "other",
      ],
      conflict_status: ["open", "investigating", "resolved", "dismissed"],
      decision_status: ["active", "superseded", "reverted"],
      execution_session_status: ["running", "paused", "completed", "aborted"],
      movement_domain: ["goods", "money"],
      payment_type: ["cash", "credit", "partial"],
      resume_reason: [
        "NEW_TASK",
        "OPEN_TASK",
        "REOPENED_TASK",
        "BLOCKED_TASK",
        "RESUME_AFTER_SESSION_END",
        "RESUME_AFTER_RESOURCE_EXHAUSTION",
      ],
      rule_category: [
        "red_line",
        "warning",
        "recommendation",
        "execution_rule",
        "verification_rule",
      ],
      rule_severity_level: ["critical", "high", "normal"],
      rule_status: ["active", "disabled", "archived"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "reopened",
        "cancelled",
        "soft_deleted",
        "blocked",
        "verify",
      ],
      tx_context: ["personal", "business"],
      tx_direction: ["in", "out"],
    },
  },
} as const
