export type NodeType = "PLAYER" | "IDENTITY" | "GAME" | "CLAN" | "OFFER" | "CREATOR";

export type GameFranchise = "ALL" | "COD" | "WOW" | "DIABLO4" | "OVERWATCH2" | "CANDYCRUSH";

export type Archetype =
  | "COMPETITIVE_GRINDER"
  | "ULTIMATE_TEAM_WHALE"
  | "CASUAL_SOCIALIZER"
  | "LORE_SEEKER"
  | "RANKED_SWEAT"
  | "HEIRLOOM_WHALE"
  | "CASUAL_WARRIOR"
  | "BLACKCELL_WHALE"
  | "MYTHIC_RAIDER"
  | "SANCTUARY_COLLECTOR"
  | "BOOSTER_WHALE"
  | "MUT_WHALE"
  | "CONQUEST_LEADER"
  | "SIMS_COLLECTOR"
  | "BUILDER_CREATOR";

export type ContextualViewType =
  | "audience-cohorts"
  | "geo-map"
  | "marketing-journey"
  | "single-identity"
  | "cross-franchise"
  | "social-clans";

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  franchise?: GameFranchise | string;
  archetype?: Archetype | string;
  spend?: number;
  churn_risk?: number;
  tilt?: number;
  loss_streak?: number;
  squad_ovr?: number;
  rank_tier?: string;
  kd_ratio?: number;
  expansion_count?: number;
  favorite_class?: string;
  confidence?: number;
  platform?: string;
  hours?: number;
  val?: number;
  color?: string;
  offer_data?: any;
  creator_data?: any;
  followed_creators?: string[];
  primary_creator_influence?: string;
  clan_id?: string;
  clan_name?: string;
  game_telemetry?: Record<string, any>;
  purchased_items?: Array<{ title: string; price: number; date: string; category: string; type?: string }>;
  country?: string;
  country_code?: string;
  country_flag?: string;
  dma_market?: string;
  lat?: number;
  lng?: number;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  value?: number;
  isTriggerStream?: boolean;
  color?: string;
  curvature?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface PlayerIdentity {
  platform: string;
  handle: string;
  confidence_score: number;
}

export interface MasterPlayer {
  player_id: string;
  display_name: string;
  primary_email: string;
  primary_franchise: string;
  country: string;
  dma_market?: string;
  lat?: number;
  lng?: number;
  lifetime_spend_usd: number;
  primary_archetype: Archetype | string;
  churn_risk_score: number;
  tilt_sensitivity: number;
  recent_loss_streak?: number;
  archetype_embedding?: number[];
  linked_identities?: PlayerIdentity[];
  franchises_played?: string[];
  total_play_hours?: number;
  game_telemetry?: Record<string, any>;
  last_active_at?: string;
}

export interface TelemetryEvent {
  event_id: string;
  player_id: string;
  game_id: string;
  session_id: string;
  event_timestamp: string;
  event_type: "MATCH_COMPLETE" | "PURCHASE" | "RAGE_QUIT" | "SQUAD_JOIN" | "TIER_UNLOCK";
  match_outcome?: "VICTORY" | "DEFEAT" | "CRUSHING_LOSS" | "STALEMATE";
  loss_streak_count?: number;
  session_duration_minutes?: number;
  frustration_score?: number;
  tilt_index?: number;
  spend_amount_usd?: number;
  metadata_json?: Record<string, any>;
}

export interface MarketingOffer {
  offer_id: string;
  target_franchise: string;
  offer_title: string;
  offer_type: string;
  price_usd: number;
  discount_percent: number;
  trigger_condition: string;
  description: string;
  category?: string;
  affinity_archetype?: string;
  projected_revenue_lift?: string;
  conversion_rate?: string;
}

export interface SituationalTrigger {
  trigger_id: string;
  player_id: string;
  player_name: string;
  franchise?: string;
  trigger_type: string;
  offer_id: string;
  offer_title: string;
  price_usd: number;
  discount_percent: number;
  frustration_score: number;
  loss_streak: number;
  timestamp: string;
}

export interface DeepSonaReaction {
  archetype: Archetype | string;
  gamer_tag?: string;
  player_id?: string;
  willingness_to_pay_usd: number;
  churn_risk_score: number;
  final_fsm_state: "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT";
  authenticity_rating: number;
  verbatim_quote: string;
  sentiment_score: number;
}

export interface CohortContext {
  query: string;
  franchise?: string;
  matchedCount: number;
  estimatedTotal: number;
  dominantArchetype: string;
  avgSpend: number;
  suggestedCampaign?: string;
}

export interface DeepSonaResult {
  campaign_id: string;
  franchise: string;
  creative_title: string;
  target_cohort_query?: string;
  proposed_spend: number;
  target_roas: number;
  reactions: DeepSonaReaction[];
  consensus_summary: string;
  predicted_conversion_lift: number;
  sentiment_decay_index: number;
  churn_mitigation_lift: number;
  projected_revenue_impact_usd: number;
  a2ui_components?: any[];
}

export interface CampaignBrief {
  brief_id: string;
  title: string;
  franchise: string;
  target_segment: string;
  audience_size: number;
  trigger_rules: string[];
  deepsona_consensus: string;
  predicted_conversion_lift: number;
  projected_roi: number;
  recommended_action: string;
  creative_hooks: string[];
  generated_at: string;
}

export interface A2AMessageType {
  message_id: string;
  correlation_id: string;
  sender: string;
  recipient: string;
  timestamp: string;
  intent: string;
  payload: Record<string, any>;
  status: string;
}
