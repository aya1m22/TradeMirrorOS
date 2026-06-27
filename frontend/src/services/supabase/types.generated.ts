/**
 * Database type structure for TradeMirror OS.
 *
 * Hand-authored to mirror the schema defined in the PRD §14 (the seven tables:
 * users, entities, bank_profiles, clients, contacts, trades, documents). It is
 * written in the exact shape `supabase gen types typescript` emits, so once the
 * migrations land (a later step) this file can be regenerated and dropped in
 * with no downstream changes.
 *
 * No business logic lives here — these are type definitions only.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          invited_at: string | null;
          last_login_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          is_active?: boolean;
          invited_at?: string | null;
          last_login_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          invited_at?: string | null;
          last_login_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      entities: {
        Row: {
          id: string;
          name: string;
          country: string;
          ruc_ein: string;
          address: string;
          city: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country: string;
          ruc_ein: string;
          address: string;
          city: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country?: string;
          ruc_ein?: string;
          address?: string;
          city?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      bank_profiles: {
        Row: {
          id: string;
          entity_id: string;
          profile_name: string;
          beneficiary_name: string;
          beneficiary_address: string;
          intermediary_bank_name: string;
          intermediary_bank_swift: string;
          bank_name: string;
          bank_swift: string;
          account_number: string;
          ara_number: string | null;
          field_71a: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_id: string;
          profile_name: string;
          beneficiary_name: string;
          beneficiary_address: string;
          intermediary_bank_name: string;
          intermediary_bank_swift: string;
          bank_name: string;
          bank_swift: string;
          account_number: string;
          ara_number?: string | null;
          field_71a?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_id?: string;
          profile_name?: string;
          beneficiary_name?: string;
          beneficiary_address?: string;
          intermediary_bank_name?: string;
          intermediary_bank_swift?: string;
          bank_name?: string;
          bank_swift?: string;
          account_number?: string;
          ara_number?: string | null;
          field_71a?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_profiles_entity_id_fkey";
            columns: ["entity_id"];
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          company_name: string;
          address: string;
          city: string;
          country: string;
          tax_id: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_name: string;
          address: string;
          city: string;
          country: string;
          tax_id: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_name?: string;
          address?: string;
          city?: string;
          country?: string;
          tax_id?: string;
          contact_name?: string;
          contact_email?: string;
          contact_phone?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string;
          role: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          email: string;
          role?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          email?: string;
          role?: string | null;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          id: string;
          trade_reference: string;
          entity_id: string;
          bank_profile_id: string;
          client_id: string;
          contact_id: string;
          contract_date: string;
          signing_date: string | null;
          bol_date: string | null;
          frigo_contract_ref: string;
          quantity_tons: number;
          product_description: string;
          frigo_unit_price: number;
          frigo_total: number;
          sale_unit_price: number;
          sale_total: number;
          shipping_cost: number;
          insurance_cost: number;
          bank_fees: number;
          total_costs: number;
          net_profit: number;
          advance_status: MilestoneStatus;
          advance_received_at: string | null;
          balance_status: MilestoneStatus;
          balance_received_at: string | null;
          trade_status: TradeStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trade_reference: string;
          entity_id: string;
          bank_profile_id: string;
          client_id: string;
          contact_id: string;
          contract_date: string;
          signing_date?: string | null;
          bol_date?: string | null;
          frigo_contract_ref: string;
          quantity_tons: number;
          product_description: string;
          frigo_unit_price: number;
          frigo_total: number;
          sale_unit_price: number;
          sale_total: number;
          shipping_cost: number;
          insurance_cost: number;
          bank_fees: number;
          // total_costs / net_profit are GENERATED columns — not insertable.
          advance_status?: MilestoneStatus;
          advance_received_at?: string | null;
          balance_status?: MilestoneStatus;
          balance_received_at?: string | null;
          trade_status?: TradeStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trade_reference?: string;
          entity_id?: string;
          bank_profile_id?: string;
          client_id?: string;
          contact_id?: string;
          contract_date?: string;
          signing_date?: string | null;
          bol_date?: string | null;
          frigo_contract_ref?: string;
          quantity_tons?: number;
          product_description?: string;
          frigo_unit_price?: number;
          frigo_total?: number;
          sale_unit_price?: number;
          sale_total?: number;
          shipping_cost?: number;
          insurance_cost?: number;
          bank_fees?: number;
          // total_costs / net_profit are GENERATED columns — not updatable.
          advance_status?: MilestoneStatus;
          advance_received_at?: string | null;
          balance_status?: MilestoneStatus;
          balance_received_at?: string | null;
          trade_status?: TradeStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trades_entity_id_fkey";
            columns: ["entity_id"];
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_bank_profile_id_fkey";
            columns: ["bank_profile_id"];
            referencedRelation: "bank_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_contact_id_fkey";
            columns: ["contact_id"];
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          trade_id: string;
          document_type: DocumentType;
          file_name: string;
          storage_path: string;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          document_type: DocumentType;
          file_name: string;
          storage_path: string;
          uploaded_by: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          trade_id?: string;
          document_type?: DocumentType;
          file_name?: string;
          storage_path?: string;
          uploaded_by?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_trade_id_fkey";
            columns: ["trade_id"];
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      trade_status: TradeStatus;
      milestone_status: MilestoneStatus;
      document_type: DocumentType;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ── Enum string-literal unions (PRD §3, §10.3, §9.2, §10.1) ──────────────
export type UserRole = "super_admin" | "internal" | "partner";

export type TradeStatus =
  | "draft"
  | "active"
  | "advance_received"
  | "shipped"
  | "balance_received"
  | "overdue";

export type MilestoneStatus = "pending" | "received" | "overdue";

export type DocumentType =
  | "frigo_contract"
  | "sales_contract"
  | "signed_contract"
  | "bol"
  | "other";
