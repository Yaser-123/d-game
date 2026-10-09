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
      battle_invitations: {
        Row: {
          challenger_id: string
          created_at: string | null
          id: string
          status: string
          target_id: string
          updated_at: string | null
        }
        Insert: {
          challenger_id: string
          created_at?: string | null
          id?: string
          status?: string
          target_id: string
          updated_at?: string | null
        }
        Update: {
          challenger_id?: string
          created_at?: string | null
          id?: string
          status?: string
          target_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_invitations_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_invitations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_logs: {
        Row: {
          action_details: Json
          action_type: string
          actor_id: string
          battle_id: string
          created_at: string | null
          id: string
          turn_number: number
        }
        Insert: {
          action_details?: Json
          action_type: string
          actor_id: string
          battle_id: string
          created_at?: string | null
          id?: string
          turn_number: number
        }
        Update: {
          action_details?: Json
          action_type?: string
          actor_id?: string
          battle_id?: string
          created_at?: string | null
          id?: string
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_logs_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          completion_reason: string | null
          created_at: string | null
          current_turn_player_id: string
          id: string
          max_turns: number
          p1_defending: boolean
          p1_effects: Json | null
          p1_health: number
          p2_defending: boolean
          p2_effects: Json | null
          p2_health: number
          player1_id: string
          player2_id: string
          status: string
          turn_counter: number
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          completion_reason?: string | null
          created_at?: string | null
          current_turn_player_id: string
          id?: string
          max_turns?: number
          p1_defending?: boolean
          p1_effects?: Json | null
          p1_health?: number
          p2_defending?: boolean
          p2_effects?: Json | null
          p2_health?: number
          player1_id: string
          player2_id: string
          status?: string
          turn_counter?: number
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          completion_reason?: string | null
          created_at?: string | null
          current_turn_player_id?: string
          id?: string
          max_turns?: number
          p1_defending?: boolean
          p1_effects?: Json | null
          p1_health?: number
          p2_defending?: boolean
          p2_effects?: Json | null
          p2_health?: number
          player1_id?: string
          player2_id?: string
          status?: string
          turn_counter?: number
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battles_current_turn_player_id_fkey"
            columns: ["current_turn_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battles_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      bosses: {
        Row: {
          armour: number | null
          base_damage: number
          behavior_pattern: string
          created_at: string | null
          description: string | null
          difficulty: string
          id: string
          max_health: number
          name: string
          points_reward: number
        }
        Insert: {
          armour?: number | null
          base_damage: number
          behavior_pattern: string
          created_at?: string | null
          description?: string | null
          difficulty: string
          id: string
          max_health: number
          name: string
          points_reward: number
        }
        Update: {
          armour?: number | null
          base_damage?: number
          behavior_pattern?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string
          id?: string
          max_health?: number
          name?: string
          points_reward?: number
        }
        Relationships: []
      }
      clan_invitations: {
        Row: {
          clan_id: string
          created_at: string | null
          id: string
          invitee_id: string
          inviter_id: string
          status: Database["public"]["Enums"]["clan_invitation_status"]
          updated_at: string | null
        }
        Insert: {
          clan_id: string
          created_at?: string | null
          id?: string
          invitee_id: string
          inviter_id: string
          status?: Database["public"]["Enums"]["clan_invitation_status"]
          updated_at?: string | null
        }
        Update: {
          clan_id?: string
          created_at?: string | null
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: Database["public"]["Enums"]["clan_invitation_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clan_invitations_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          joined_at: string | null
          player_id: string
          role: Database["public"]["Enums"]["clan_role"]
        }
        Insert: {
          clan_id: string
          joined_at?: string | null
          player_id: string
          role?: Database["public"]["Enums"]["clan_role"]
        }
        Update: {
          clan_id?: string
          joined_at?: string | null
          player_id?: string
          role?: Database["public"]["Enums"]["clan_role"]
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string | null
          creator_id: string
          description: string
          id: string
          name: string
          status: Database["public"]["Enums"]["clan_status"]
          tag: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          description: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["clan_status"]
          tag: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          description?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["clan_status"]
          tag?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clans_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      event_battles: {
        Row: {
          battle_id: string
          created_at: string | null
          event_id: string
          player_id: string
          score_awarded: number
        }
        Insert: {
          battle_id: string
          created_at?: string | null
          event_id: string
          player_id: string
          score_awarded: number
        }
        Update: {
          battle_id?: string
          created_at?: string | null
          event_id?: string
          player_id?: string
          score_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_battles_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_battles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_battles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          created_at: string | null
          event_id: string
          player_id: string
          reward_claimed: boolean
          score: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          player_id: string
          reward_claimed?: boolean
          score?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          player_id?: string
          reward_claimed?: boolean
          score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string
          end_time: string
          id: string
          reward_points: number
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          end_time: string
          id?: string
          reward_points: number
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          end_time?: string
          id?: string
          reward_points?: number
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      intel_disclosures: {
        Row: {
          content: string
          listing_id: string
        }
        Insert: {
          content: string
          listing_id: string
        }
        Update: {
          content?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intel_disclosures_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "intel_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_listings: {
        Row: {
          category: Database["public"]["Enums"]["intel_category"]
          created_at: string | null
          id: string
          price: number
          seller_id: string
          sigil_id: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["intel_category"]
          created_at?: string | null
          id?: string
          price: number
          seller_id: string
          sigil_id: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["intel_category"]
          created_at?: string | null
          id?: string
          price?: number
          seller_id?: string
          sigil_id?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_listings_sigil_id_fkey"
            columns: ["sigil_id"]
            isOneToOne: false
            referencedRelation: "sigils"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_purchases: {
        Row: {
          buyer_id: string
          id: string
          listing_id: string
          price_paid: number
          purchased_at: string | null
        }
        Insert: {
          buyer_id: string
          id?: string
          listing_id: string
          price_paid: number
          purchased_at?: string | null
        }
        Update: {
          buyer_id?: string
          id?: string
          listing_id?: string
          price_paid?: number
          purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "intel_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          equipped: boolean
          id: string
          item_id: string
          player_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          equipped?: boolean
          id?: string
          item_id: string
          player_id: string
          quantity?: number
        }
        Update: {
          created_at?: string | null
          equipped?: boolean
          id?: string
          item_id?: string
          player_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          description: string
          effects: Json
          equipment_slot: string | null
          id: string
          is_stackable: boolean
          name: string
          price: number
        }
        Insert: {
          category: string
          description: string
          effects?: Json
          equipment_slot?: string | null
          id: string
          is_stackable?: boolean
          name: string
          price?: number
        }
        Update: {
          category?: string
          description?: string
          effects?: Json
          equipment_slot?: string | null
          id?: string
          is_stackable?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string | null
          handle: string
          id: string
          points: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          handle: string
          id: string
          points?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          handle?: string
          id?: string
          points?: number | null
          status?: string
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          player_id: string
          reference_key: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          player_id: string
          reference_key: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          player_id?: string
          reference_key?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      pve_encounters: {
        Row: {
          boss_defending: boolean | null
          boss_effects: Json
          boss_health: number
          boss_id: string
          combat_log: Json | null
          created_at: string | null
          id: string
          player_defending: boolean | null
          player_effects: Json
          player_health: number
          player_id: string
          status: string
          turn_counter: number
          updated_at: string | null
        }
        Insert: {
          boss_defending?: boolean | null
          boss_effects?: Json
          boss_health: number
          boss_id: string
          combat_log?: Json | null
          created_at?: string | null
          id?: string
          player_defending?: boolean | null
          player_effects?: Json
          player_health?: number
          player_id: string
          status?: string
          turn_counter?: number
          updated_at?: string | null
        }
        Update: {
          boss_defending?: boolean | null
          boss_effects?: Json
          boss_health?: number
          boss_id?: string
          combat_log?: Json | null
          created_at?: string | null
          id?: string
          player_defending?: boolean | null
          player_effects?: Json
          player_health?: number
          player_id?: string
          status?: string
          turn_counter?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pve_encounters_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "bosses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pve_encounters_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      sigils: {
        Row: {
          ability_meta: Json | null
          basic_ability: string
          created_at: string | null
          fingerprint: string
          hidden_mechanic: string
          id: string
          limitation: string
          mastery: number | null
          name: string
          player_id: string | null
        }
        Insert: {
          ability_meta?: Json | null
          basic_ability: string
          created_at?: string | null
          fingerprint: string
          hidden_mechanic: string
          id?: string
          limitation: string
          mastery?: number | null
          name: string
          player_id?: string | null
        }
        Update: {
          ability_meta?: Json | null
          basic_ability?: string
          created_at?: string | null
          fingerprint?: string
          hidden_mechanic?: string
          id?: string
          limitation?: string
          mastery?: number | null
          name?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sigils_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_invite_id: string }; Returns: string }
      cancel_clan_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      cancel_intel_listing: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      cancel_invitation: { Args: { p_invite_id: string }; Returns: undefined }
      claim_event_reward: { Args: { p_event_id: string }; Returns: undefined }
      create_clan: {
        Args: { p_description: string; p_name: string; p_tag: string }
        Returns: string
      }
      create_intel_listing: {
        Args: { p_category: string; p_price: number; p_title: string }
        Returns: string
      }
      create_invitation: { Args: { p_target_id: string }; Returns: string }
      decline_invitation: { Args: { p_invite_id: string }; Returns: undefined }
      disband_clan: { Args: never; Returns: undefined }
      equip_item: {
        Args: { p_equip: boolean; p_inventory_id: string }
        Returns: undefined
      }
      get_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          battles_completed: number
          handle: string
          losses: number
          player_id: string
          points: number
          rank: number
          win_rate: number
          wins: number
        }[]
      }
      get_public_players: {
        Args: never
        Returns: {
          basic_ability: string
          created_at: string
          handle: string
          mastery: number
          player_id: string
          sigil_name: string
        }[]
      }
      initialize_player: {
        Args: {
          p_ability_meta?: Json
          p_basic_ability: string
          p_fingerprint: string
          p_handle: string
          p_hidden_mechanic: string
          p_limitation: string
          p_name: string
        }
        Returns: undefined
      }
      invite_to_clan: { Args: { p_invitee_id: string }; Returns: undefined }
      leave_clan: { Args: never; Returns: undefined }
      process_points_transaction: {
        Args: {
          p_amount: number
          p_player_id: string
          p_reference_key: string
          p_transaction_type: string
        }
        Returns: undefined
      }
      purchase_intel: { Args: { p_listing_id: string }; Returns: undefined }
      purchase_item: {
        Args: { p_item_id: string; p_quantity?: number }
        Returns: undefined
      }
      register_for_event: { Args: { p_event_id: string }; Returns: undefined }
      remove_clan_member: { Args: { p_player_id: string }; Returns: undefined }
      respond_to_clan_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: undefined
      }
      start_battle: { Args: { p_opponent_id: string }; Returns: string }
      start_pve_encounter: { Args: { p_boss_id: string }; Returns: string }
      submit_battle_action: {
        Args: {
          p_action_type: string
          p_battle_id: string
          p_expected_turn: number
          p_item_id?: string
        }
        Returns: undefined
      }
      submit_battle_to_event: {
        Args: { p_battle_id: string; p_event_id: string }
        Returns: number
      }
      submit_pve_action: {
        Args: {
          p_action_type: string
          p_encounter_id: string
          p_item_id?: string
        }
        Returns: undefined
      }
      transfer_clan_leadership: {
        Args: { p_new_leader_id: string }
        Returns: undefined
      }
    }
    Enums: {
      clan_invitation_status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"
      clan_role: "MEMBER" | "OFFICER" | "LEADER"
      clan_status: "ACTIVE" | "DISBANDED"
      event_status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED"
      event_type: "SURVIVAL_CHALLENGE" | "SIGIL_TRIAL" | "BLOOD_PRICE"
      intel_category:
        | "SIGIL_CLASS"
        | "ABILITY_HINT"
        | "LIMITATION"
        | "MECHANIC_CLUE"
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
      clan_invitation_status: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"],
      clan_role: ["MEMBER", "OFFICER", "LEADER"],
      clan_status: ["ACTIVE", "DISBANDED"],
      event_status: ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"],
      event_type: ["SURVIVAL_CHALLENGE", "SIGIL_TRIAL", "BLOOD_PRICE"],
      intel_category: [
        "SIGIL_CLASS",
        "ABILITY_HINT",
        "LIMITATION",
        "MECHANIC_CLUE",
      ],
    },
  },
} as const
