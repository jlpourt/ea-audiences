export type NodeType = "PLAYER" | "IDENTITY" | "GAME" | "CLAN" | "OFFER" | "CREATOR" | "SQUADMATE";

/**
 * Franchise filter values. These are the canonical `franchise` ids stored on
 * `Games.franchise` and `Players.primary_franchise` in `twok_graph_db`.
 * Focused strictly on 2K brands: NBA 2K27 · NBA 2K26 · NBA 2K Mobile · 2K Sports
 * (WWE 2K25 / PGA TOUR 2K25 / TopSpin 2K25) · 2K Core (Borderlands 4 / Civ VII / Mafia).
 */
export type GameFranchise =
  | "ALL"
  | "NBA2K"
  | "NBA2K26"
  | "NBA2KMOBILE"
  | "WWE2K"
  | "PGA2K"
  | "TOPSPIN"
  | "CIV7"
  | "BL4"
  | "MAFIA";

/** 2K publishing division label. Stored on `Games.label`; drives cluster colour. */
export type TakeTwoLabel = "2K" | "2K_SPORTS" | "2K_CORE";

/** Franchise groups as rendered by the segmented control. */
export const FRANCHISE_GROUPS: Array<{ id: string; label: string; franchises: GameFranchise[] }> = [
  { id: "nba2k27", label: "NBA 2K27", franchises: ["NBA2K"] },
  { id: "nba2k26", label: "NBA 2K26", franchises: ["NBA2K26"] },
  { id: "nba2k-mobile", label: "NBA 2K Mobile", franchises: ["NBA2KMOBILE"] },
  { id: "2k-sports", label: "WWE & PGA 2K", franchises: ["WWE2K", "PGA2K", "TOPSPIN"] },
  { id: "2k-core", label: "Borderlands & Civ VII", franchises: ["BL4", "CIV7", "MAFIA"] },
  { id: "all", label: "All 2K Titles", franchises: ["ALL"] },
];

export const LABEL_BY_FRANCHISE: Record<Exclude<GameFranchise, "ALL">, TakeTwoLabel> = {
  NBA2K: "2K",
  NBA2K26: "2K",
  NBA2KMOBILE: "2K",
  WWE2K: "2K_SPORTS",
  PGA2K: "2K_SPORTS",
  TOPSPIN: "2K_SPORTS",
  CIV7: "2K_CORE",
  BL4: "2K_CORE",
  MAFIA: "2K_CORE",
};

// Archetype identity lives in one place: src/lib/archetypes.ts. Imported for
// local use and re-exported so existing `import { Archetype } from "@/lib/types"`
// call sites keep working.
import type { ArchetypeId } from "@/lib/archetypes";
export type Archetype = ArchetypeId;

export type ContextualViewType =
  | "audience-cohorts"
  | "geo-map"
  | "marketing-journey"
  | "single-identity"
  | "cross-franchise"
  | "social-clans"
  | "social-hops";

export type SegmentationLens =
  | "FRANCHISE"
  | "SOCIAL_HOPS"
  | "CATE_UPLIFT"
  | "PORTFOLIO_RINGS"
  | "TRAJECTORY";

/** Season Pass editions as stored in `game_telemetry.season_pass_edition`. */
export type SeasonPassEdition = "NONE" | "PRO" | "HALL_OF_FAME";

/**
 * The NBA 2K-specific portion of `Players.game_telemetry` (Spanner JSON).
 *
 * Every player row carries every key. Players who have never touched NBA 2K27
 * carry `null` for the MyPLAYER / MyTEAM / Park fields so numeric predicates
 * (`INT64(p.game_telemetry.myplayer_ovr) < 85`) exclude them rather than
 * matching a fabricated zero. Cross-label fields are always populated.
 *
 * UI naming: `tilt_sensitivity` (top-level column) is shown as "Rage-Quit
 * Index"; `recent_loss_streak` as "Park loss streak".
 */
export interface NBA2KTelemetry {
  myplayer_ovr: number | null;
  myplayer_build: string | null;
  position: string | null;
  rep_tier: string | null;
  badges_count: number | null;
  cap_breakers_unlocked: number | null;
  vc_balance: number;
  vc_spend_90d: number;
  season_pass_tier: number;
  season_pass_edition: SeasonPassEdition;
  myteam_rating: number | null;
  myteam_galaxy_opal_count: number;
  myteam_packs_opened_30d: number;
  myteam_vc_spend_90d: number;
  park_win_pct: number | null;
  rec_games_30d: number;
  crew_id: string | null;
  loss_streak: number;
  rage_quits_7d: number;
  favorite_team: string;
  favorite_player: string;
  hours_played: number;
  last_login_days_ago: number;
  platform: string;
  nba2k26_veteran?: boolean;
  nba2k26_spend_usd?: number;
  nba2k26_ovr?: number | null;
  migrated_to_2k27?: boolean;
  cross_2k_titles?: number;
  rockstar_linked?: boolean;
  gta_online_spend_usd?: number;
  gta6_preorder?: boolean;
  zynga_linked?: boolean;
  zynga_daily_streak?: number;
  /** 0–1 likelihood to upgrade from NBA 2K26 or cross-pollinate across 2K titles. */
  gravity_score: number;
}

export interface MultiHopPathInfo {
  hops: number;
  patternLabel: string;
  summary: string;
  steps: string[];
  targetEntity?: string;
  bridgeNodes?: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  franchise?: GameFranchise | string;
  /** Take-Two label for GAME nodes and for cross-label cluster colouring. */
  label?: TakeTwoLabel;
  archetype?: Archetype | string;
  spend?: number;
  churn_risk?: number;
  tilt?: number;
  loss_streak?: number;
  /** 0–1 likelihood to adopt a sibling-label title (Play 2). */
  gravity_score?: number;
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
  game_telemetry?: Partial<NBA2KTelemetry> & Record<string, any>;
  /**
   * `offer_id` makes a purchase joinable back to the catalogue SKU. Without it
   * a purchase was just a display string and could not be linked in the graph.
   */
  purchased_items?: Array<{
    offer_id?: string;
    title: string;
    price: number;
    date: string;
    category: string;
    type?: string;
  }>;
  /** GAME nodes only: LIVE | LEGACY | PRE_LAUNCH | SUNSET. */
  lifecycle_status?: string;
  /** GAME nodes only, e.g. "Season 1". */
  current_season?: string;
  country?: string;
  country_code?: string;
  country_flag?: string;
  dma_market?: string;
  lat?: number;
  lng?: number;
  multiHopPath?: MultiHopPathInfo;
  isMultiHopBridge?: boolean;
  hopStep?: number;
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
  isMultiHopBridge?: boolean;
  hopStep?: number;
  hopLabel?: string;
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
  game_telemetry?: Partial<NBA2KTelemetry> & Record<string, any>;
  last_active_at?: string;
}

/** Event types emitted by the NBA 2K27 telemetry stream. */
export type TelemetryEventType =
  | "PARK_GAME_COMPLETE"
  | "REC_GAME_COMPLETE"
  | "MYTEAM_PACK_OPENED"
  | "SEASON_PASS_LEVEL_UP"
  | "RAGE_QUIT"
  | "VC_PURCHASE"
  | "CREW_INVITE_SENT"
  | "DAILY_LOGIN";

export interface TelemetryEvent {
  event_id: string;
  player_id: string;
  game_id: string;
  event_type: TelemetryEventType | string;
  event_timestamp: string;
  consecutive_losses?: number;
  tilt_index?: number;
  triggered_offer_id?: string | null;
  session_id?: string;
  match_outcome?: "WIN" | "LOSS" | "BLOWOUT_LOSS" | "QUIT";
  session_duration_minutes?: number;
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

export type FSMState =
  | "PURCHASED"
  | "ENGAGED_FREE"
  | "EVALUATING"
  | "ABANDONED"
  | "BOYCOTT";

export type ContagionDriver =
  | "CREW_CAPTAIN"
  | "CREATOR_STREAM"
  | "REDDIT_THREAD"
  | "COUNTERFACTUAL"
  | "NONE";

export type UpliftQuadrant =
  | "PERSUADABLE"
  | "SURE_THING"
  | "LOST_CAUSE"
  | "SLEEPING_DOG";

export interface CausalUpliftSummary {
  persuadables_count: number;
  sure_things_count: number;
  lost_causes_count: number;
  sleeping_dogs_count: number;
  persuadables_pct: number;
  sure_things_pct: number;
  lost_causes_pct: number;
  sleeping_dogs_pct: number;
  cate_lift_pct: number;
  margin_saved_usd: number;
  backlash_avoided_pts: number;
  takeaway: string;
}

export interface SurvivalCurvePoint {
  day: number;
  baseline_survival_pct: number;
  treated_survival_pct: number;
}

export interface SurvivalAnalysisSummary {
  baseline_t50_days: number;
  treated_t50_days: number;
  days_gained: number;
  crew_hazard_reduction_pct: number;
  build_wall_hazard_ratio: number;
  curve: SurvivalCurvePoint[];
}

export interface TimesFmForecastPoint {
  horizon_label: string;
  baseline_bookings_usd: number;
  treated_bookings_usd: number;
  ci_10_usd: number;
  ci_90_usd: number;
}

/**
 * Creator impact measured live by /api/v2/creator/incremental (BigQuery matched-control
 * D30 retention). Replaces the old heuristic "x mROAS". No creator cost data exists, so
 * this is incremental players, never a dollar ROAS.
 */
export interface CreatorImpactItem {
  handle: string;
  platform: string;
  /** False when the creator had too few eligible viewers to measure. */
  measured: boolean;
  incremental_players: number | null;
  ci_low: number | null;
  ci_high: number | null;
  lift_pp: number | null;
  significant: boolean;
  treated_n: number | null;
  /** Share of the listed creators' positive incremental players, in %. */
  budget_share_pct: number | null;
  /** Simulated focus-group flips attributed to this creator's broadcast. */
  attributed_flips: number;
}

export type CreatorImpactSummary =
  | {
      status: "ok";
      label: string;
      method: string;
      as_of: string | null;
      computed_at: string | null;
      items: CreatorImpactItem[];
    }
  | { status: "pending"; label: string; items: CreatorImpactItem[] }
  | {
      status: "error";
      label: string;
      error: string;
      service?: string;
      resource?: string;
      items: CreatorImpactItem[];
    };

export interface TimesFmForecastSummary {
  projected_30d_bookings_usd: number;
  ci_10_usd: number;
  ci_90_usd: number;
  whale_decay_offset_pct: number;
  model_used?: string;
  points: TimesFmForecastPoint[];
  creator_impact: CreatorImpactSummary;
}

export interface RedditEchoItem {
  subreddit: string;
  title: string;
  url?: string;
  sentiment: "BULLISH" | "MIXED" | "BACKLASH";
  score: number;
  comment_count?: number;
  flair?: string;
  snippet: string;
  swarm_echo_count?: number;
  r2_flips_driven?: number;
}

export interface CreatorBroadcast {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  stance: "ENDORSE" | "MIXED" | "CALLOUT";
  headline: string;
  influence_reach: number;
}

export interface SwarmCrowdAgent {
  player_id: string;
  gamer_tag: string;
  archetype: Archetype | string;
  myplayer_ovr: number;
  crew_name: string;
  creator_handle: string;
  round1_state: FSMState;
  final_fsm_state: FSMState;
  round3_state?: FSMState;
  round3_flipped?: boolean;
  verbatim_quote?: string;
  willingness_to_pay_usd: number;
  contagion_flipped: boolean;
  contagion_driver: ContagionDriver;
  contagion_source_tag?: string;
  uplift_quadrant?: UpliftQuadrant;
}

export interface MigrationCurvePoint {
  stage: string;
  isolated_pct: number;
  contagion_pct: number;
}

/** One synthetic persona's reaction inside a Courtside Focus Group session. */
export interface FocusGroupReaction {
  archetype: Archetype | string;
  gamer_tag?: string;
  player_id?: string;
  myplayer_ovr?: number;
  crew_name?: string;
  crew_tier?: string;
  crew_role?: string;
  creator_handle?: string;
  willingness_to_pay_usd: number;
  churn_risk_score: number;
  final_fsm_state: FSMState;
  round1_fsm_state?: FSMState;
  round1_quote?: string;
  round1_wtp_usd?: number;
  contagion_flipped?: boolean;
  contagion_driver?: ContagionDriver;
  contagion_source?: string;
  contagion_source_tag?: string;
  contagion_source_snippet?: string;
  round3_fsm_state?: FSMState;
  round3_quote?: string;
  round3_wtp_usd?: number;
  round3_flipped?: boolean;
  uplift_quadrant?: UpliftQuadrant;
  authenticity_rating: number;
  verbatim_quote: string;
  sentiment_score: number;
}

export interface DynamicCohortFinding {
  id: string;
  category: "churn_contagion" | "whale_spillover" | "creator_halo" | "dormant_currency" | "demotion_slump" | "cross_title" | "defeat_slump" | string;
  tabLabel: string;
  shortLabel: string;
  badge: string;
  iconType: "shield" | "sparkles" | "trending" | "users" | "zap" | "crosshair" | "creator" | "cross_title" | "currency" | "slump" | string;
  iconColor: string;
  bgAccent: string;
  pillColor: string;
  metricPill: string;
  title: string;
  summary: string;
  base: string;
  metrics: {
    cohortSize: number;
    avgSpend: number;
    avgChurn: number;
    liftMetric?: string;
    highRiskCount?: number;
    secondaryMetric?: string;
  };
  caveats: string[];
  actionLabel: string;
  queryToRun: string;
  franchise: GameFranchise;
  prompts: {
    title: string;
    query: string;
    franchise: GameFranchise;
    tag: string;
    highlight: string;
  }[];
}

export interface CohortContext {
  query: string;
  franchise?: string;
  /** True number of players satisfying the query predicates. */
  matchedCount: number;
  /** How many player nodes are actually drawn on the canvas. */
  renderedCount?: number;
  /** True when renderedCount < matchedCount. */
  isSampled?: boolean;
  /** Mirrors matchedCount. Retained for backwards compatibility. */
  estimatedTotal: number;
  dominantArchetype: string;
  avgSpend: number;
  avgChurn?: number;
  avgTilt?: number;
  highChurnCount?: number;
  /** Whether the cohort came from live Spanner or the local engine. */
  isLive?: boolean;
  source?: string;
  suggestedCampaign?: string;
  isMultiHop?: boolean;
  multiHopMetadata?: MultiHopPathInfo;
  dynamicFinding?: DynamicCohortFinding;
}

/** Full Courtside Focus Group result for one creative / offer. */
export interface FocusGroupResult {
  campaign_id: string;
  franchise: string;
  creative_title: string;
  target_cohort_query?: string;
  proposed_spend: number;
  target_roas: number;
  reactions: FocusGroupReaction[];
  consensus_summary: string;
  predicted_conversion_lift: number;
  sentiment_decay_index: number;
  churn_mitigation_lift: number;
  projected_revenue_impact_usd: number;
  causal_uplift?: CausalUpliftSummary;
  survival_analysis?: SurvivalAnalysisSummary;
  timesfm_forecast?: TimesFmForecastSummary;
  a2ui_components?: any[];
}

export interface CampaignBrief {
  brief_id: string;
  title: string;
  franchise: string;
  target_segment: string;
  audience_size: number;
  trigger_rules: string[];
  /** Consensus line from the Courtside Focus Group session. */
  focus_group_consensus: string;
  predicted_conversion_lift: number;
  projected_roi: number;
  recommended_action: string;
  creative_hooks: string[];
  grounded_community_insight?: string;
  strategic_pivot?: {
    original_concept: string;
    pivot_reason: string;
    pivoted_concept: string;
  };
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

// ---------------------------------------------------------------------------
// BigQuery-backed audience library (dataset `twok_marketing_intelligence`)
// ---------------------------------------------------------------------------

export type ActivationChannel =
  | "2K_ACCOUNT_EMAIL"
  | "IN_GAME_INBOX"
  | "PUSH_2K_MOBILE"
  | "ROCKSTAR_NEWSWIRE"
  | "PAID_SOCIAL"
  | "ZYNGA_CROSS_PROMO";

export type SavedAudienceStatus = "DRAFT" | "SAVED" | "ACTIVATED" | "ARCHIVED";

/** Row shape of `twok_marketing_intelligence.saved_audiences`. */
export interface SavedAudience {
  audience_id: string;
  name: string;
  nl_query: string;
  gql: string;
  matched_count: number;
  created_at: string;
  created_by: string;
  channels: ActivationChannel[] | string[];
  status: SavedAudienceStatus | string;
  franchise?: string | null;
  dominant_archetype?: string | null;
  avg_spend?: number | null;
}

/** Row shape of `twok_marketing_intelligence.activation_log`. */
export interface ActivationRecord {
  activation_id: string;
  audience_id: string;
  channel: ActivationChannel | string;
  payload: Record<string, any>;
  published_at: string;
  pubsub_message_id: string | null;
}
