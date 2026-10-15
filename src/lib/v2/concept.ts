/**
 * Section D shared config, types and pure helpers (CLIENT-SAFE: no GCP imports).
 *
 * Section D is the **Personalization Flow** (contract §7):
 *   1 Pick user -> 2 Infer preference (NBA / WNBA / College) -> 3 Content pairs
 *   scored by synthetic twins -> 4 Serve on downstream activation channels.
 * Live engine: `src/app/api/v2/personalize/engine.ts`.
 *
 * Node labels, stage names, layout and accents for the canvas are read from
 * `CONCEPT_FLOW_NODES` (bottom of this file) so restyling to Curtis's nodal
 * workflow (docs/v2/curtis_nodal_reference.png) is a one-file change.
 *
 * The earlier population-level 3-arm concept test (`/api/v2/concept-test`)
 * still compiles against the types in the first half of this file.
 */

// ---------------------------------------------------------------------------
// Arms (concept copy). Caitlin Clark appears in concept copy ONLY; personas
// react to the concept and never speak as her.
// ---------------------------------------------------------------------------

export type ConceptArmId = "nba" | "wnba" | "college";

export const CONCEPT_ARM_IDS: ConceptArmId[] = ["nba", "wnba", "college"];

export interface ConceptArm {
  id: ConceptArmId;
  letter: "A" | "B" | "C";
  /** Short label used on nodes and bars. */
  label: string;
  /** Concept title shown to personas and in the UI. */
  title: string;
  /** The pitch personas read. Keep it neutral; this is a test, not an ad. */
  pitch: string;
}

export const CONCEPT_ARMS: Record<ConceptArmId, ConceptArm> = {
  nba: {
    id: "nba",
    letter: "A",
    label: "NBA",
    title: "NBA: MyNBA / MyCAREER core",
    pitch:
      "NBA 2K27 doubles down on the core: a deeper MyCAREER story into The City, and MyNBA with Eras, new trade logic and front-office tools. The modes you already play, built out further.",
  },
  wnba: {
    id: "wnba",
    letter: "B",
    label: "WNBA",
    title: "The W franchise mode featuring Caitlin Clark",
    pitch:
      "A full WNBA franchise mode in NBA 2K27: run a W front office, draft, trade, manage the cap and build a dynasty. Caitlin Clark is the featured athlete of the mode, with her signature animations and a guided rookie-season storyline.",
  },
  college: {
    id: "college",
    letter: "C",
    label: "College",
    title: "College basketball mode",
    pitch:
      "College hoops inside NBA 2K27: recruit, build a program, play in campus atmospheres, chase a March Madness style bracket run, then carry your player into the NBA Draft and MyCAREER.",
  },
};

/** Purchase intent options (concept assumptions; edit here). */
export const CONCEPT_EDITIONS = {
  STANDARD: { label: "Standard", price_usd: 69.99 },
  DELUXE: { label: "Deluxe", price_usd: 99.99 },
  NONE: { label: "No purchase", price_usd: 0 },
} as const;

export type PurchaseIntent = keyof typeof CONCEPT_EDITIONS;

/** Interest threshold (0–100) above which a respondent counts as "interested". */
export const INTERESTED_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// CONCEPT_TEST_FLOW_NODES: layout for the (secondary) population-level 3-arm
// concept test at /api/v2/concept-test. The primary Section D flow is the
// Personalization Flow; its nodes live in CONCEPT_FLOW_NODES further below.
// ---------------------------------------------------------------------------

export type ConceptFlowNodeId =
  | "seed"
  | "cohort"
  | "arm_nba"
  | "arm_wnba"
  | "arm_college"
  | "social"
  | "verdict";

export interface ConceptFlowNodeConfig {
  id: ConceptFlowNodeId;
  /** Node title. */
  label: string;
  /** Small caption under the title. */
  caption: string;
  /** Stage name shown in the stage rail and status line. */
  stage: string;
  /** CSS color expression (tokens only). */
  accent: string;
  /** Position in the 1000×560 SVG viewBox (node centre). */
  x: number;
  y: number;
}

export const CONCEPT_TEST_FLOW_NODES = {
  /** Title over the canvas. */
  title: "Concept Test",
  subtitle: "NBA 2K27 · three concepts, one live cohort",
  /** Ordered stage rail (rename to Curtis's stage names here). */
  stages: [
    { key: "hydrate", label: "Cohort" },
    { key: "react", label: "Reactions" },
    { key: "social", label: "Social shift" },
    { key: "synthesis", label: "Verdict" },
  ] as const,
  nodes: {
    seed: {
      id: "seed",
      label: "NBA 2K27",
      caption: "Concept seed",
      stage: "Seed",
      accent: "var(--text)",
      x: 70,
      y: 280,
    },
    cohort: {
      id: "cohort",
      label: "Live cohort",
      caption: "Spanner Graph",
      stage: "Cohort",
      accent: "var(--text)",
      x: 230,
      y: 280,
    },
    arm_nba: {
      id: "arm_nba",
      label: CONCEPT_ARMS.nba.label,
      caption: "MyNBA · MyCAREER",
      stage: "Reactions",
      accent: "var(--accent-2)",
      x: 500,
      y: 110,
    },
    arm_wnba: {
      id: "arm_wnba",
      label: CONCEPT_ARMS.wnba.label,
      caption: "The W franchise · Caitlin Clark",
      stage: "Reactions",
      accent: "var(--accent)",
      x: 500,
      y: 280,
    },
    arm_college: {
      id: "arm_college",
      label: CONCEPT_ARMS.college.label,
      caption: "College hoops",
      stage: "Reactions",
      accent: "var(--text)",
      x: 500,
      y: 450,
    },
    social: {
      id: "social",
      label: "Social shift",
      caption: "Crew · Creator",
      stage: "Social shift",
      accent: "var(--text-dim)",
      x: 700,
      y: 280,
    },
    verdict: {
      id: "verdict",
      label: "Verdict",
      caption: "Share of preference",
      stage: "Verdict",
      accent: "var(--text)",
      x: 880,
      y: 280,
    },
  } satisfies Record<ConceptFlowNodeId, ConceptFlowNodeConfig>,
  /** Arm node id lookup. */
  armNode: {
    nba: "arm_nba",
    wnba: "arm_wnba",
    college: "arm_college",
  } as Record<ConceptArmId, ConceptFlowNodeId>,
  /** Verdict row y positions (one bar per arm, stacked at the verdict node). */
  verdictRows: { nba: 200, wnba: 280, college: 360 } as Record<ConceptArmId, number>,
} as const;

export const CONCEPT_SCALES = [20, 100, 1000] as const;
export type ConceptScale = (typeof CONCEPT_SCALES)[number];

/** Number of individually voiced core personas (Vertex AI FAST). */
export const CONCEPT_CORE_SIZE = 20;

// ---------------------------------------------------------------------------
// Wire types (SSE payloads)
// ---------------------------------------------------------------------------

export interface ConceptArmReaction {
  interest: number; // 0–100
  weekly_hours: number; // hours / week they'd spend in this mode
  replaces_current_mode: boolean; // cannibalization
}

export interface ConceptPersonaAffinity {
  wnba_affinity: number | null;
  college_hoops_affinity: number | null;
  franchise_mode_affinity: number | null;
}

export interface ConceptVerdict {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  tier: "core" | "crowd";
  age: number | null;
  crew_id: string | null;
  crew_name: string | null;
  crew_role: string | null;
  creator_id: string | null;
  creator_handle: string | null;
  /** Live Players.churn_risk_score from Spanner. */
  churn_risk_score: number;
  affinity: ConceptPersonaAffinity;
  arms: Record<ConceptArmId, ConceptArmReaction>;
  preferred_arm: ConceptArmId;
  purchase_intent: PurchaseIntent;
  quote: string;
  /** Post-social preference (set after the social round). */
  final_arm?: ConceptArmId;
  shifted?: boolean;
  shift_driver?: "CREW" | "CREATOR" | "NONE";
  shift_source?: string;
  final_quote?: string;
  voice_tier?: string;
  latency_ms?: number;
  model?: string;
}

export interface ConceptArmAggregate {
  arm: ConceptArmId;
  n: number;
  preferred_count: number;
  share_of_preference: number; // 0–1
  mean_interest: number;
  interest_ci_low: number;
  interest_ci_high: number;
  /** Mean net-new weekly hours per respondent (weekly_hours where the mode does NOT replace current play). */
  incremental_hours: number;
  /** Mean weekly hours among interested respondents (interest ≥ threshold). */
  interested_hours: number;
  interested_count: number;
  /** Share of interested respondents who say the mode would replace their current mode. */
  cannibalization_rate: number;
  purchase: { standard: number; deluxe: number; none: number }; // counts among preferrers
  best_fit_archetypes: Array<{ archetype: string; mean_interest: number; n: number }>;
}

export interface ConceptCreatorStance {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  followers: number;
  cohort_followers: number;
  endorsed_arm: ConceptArmId | "none";
  stance: "ENDORSE" | "MIXED" | "CALLOUT";
  headline: string;
}

export interface ConceptShift {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  tier: "core" | "crowd";
  from: ConceptArmId;
  to: ConceptArmId;
  driver: "CREW" | "CREATOR";
  source: string;
  quote?: string;
}

export interface ConceptSynthesis {
  headline: string;
  recommendation: { arm: ConceptArmId; confidence: "low" | "medium" | "high"; rationale: string };
  arms: Array<{ arm: ConceptArmId; opportunity: string; risk: string; best_fit: string }>;
  cannibalization_note: string;
  next_test: string;
  model: string;
  latency_ms: number;
}

export interface ConceptCohortSummary {
  n: number;
  core: number;
  crowd: number;
  database: string;
  affinity_columns: string[];
  missing_affinity_columns: string[];
  archetypes: Record<string, number>;
  crews: number;
  sample_seed: string;
  latency_ms: number;
  query: string;
}

export type ConceptStreamEvent =
  | { type: "status"; phase: string; message: string }
  | { type: "cohort"; cohort: ConceptCohortSummary; personas: Array<Pick<ConceptVerdict, "player_id" | "gamer_tag" | "archetype" | "tier">> }
  | { type: "persona_verdict"; round: 1; verdicts: ConceptVerdict[]; batch_index?: number; latency_ms: number; model: string }
  | { type: "creator_stances"; creators: ConceptCreatorStance[]; latency_ms: number; model: string }
  | { type: "social_shift"; shifts: ConceptShift[]; evaluated: number; batch_index?: number; latency_ms: number; model: string }
  | { type: "arm_aggregate"; round: 1 | 2; aggregates: ConceptArmAggregate[]; n: number }
  | { type: "synthesis"; synthesis: ConceptSynthesis }
  | {
      type: "done";
      ok: true;
      latency_ms: number;
      phases: Record<string, number>;
      models: { fast: string; lite: string; synthesis: string };
      n: number;
      shifts: number;
    }
  | { type: "error"; service: string; error: string; phase: string };

// ---------------------------------------------------------------------------
// Pure aggregate math (used by the server and, for live ticks, the client).
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

/**
 * Per-arm aggregates. `useFinal` switches preference to the post-social
 * `final_arm` (falls back to the round-1 preference only for respondents the
 * social round did not change, which is the definition of "no shift").
 */
export function computeArmAggregates(
  verdicts: ConceptVerdict[],
  useFinal = false
): ConceptArmAggregate[] {
  const n = verdicts.length;
  return CONCEPT_ARM_IDS.map((arm) => {
    const pref = verdicts.filter((v) => (useFinal ? v.final_arm ?? v.preferred_arm : v.preferred_arm) === arm);
    const interests = verdicts.map((v) => v.arms[arm].interest);
    const m = mean(interests);
    const half = n > 1 ? (1.96 * sd(interests)) / Math.sqrt(n) : 0;
    const interested = verdicts.filter((v) => v.arms[arm].interest >= INTERESTED_THRESHOLD);
    const incremental = mean(
      verdicts.map((v) => (v.arms[arm].replaces_current_mode ? 0 : v.arms[arm].weekly_hours))
    );
    const byArch = new Map<string, number[]>();
    for (const v of verdicts) {
      const list = byArch.get(v.archetype) || [];
      list.push(v.arms[arm].interest);
      byArch.set(v.archetype, list);
    }
    const minN = n >= 100 ? 5 : 2;
    const bestFit = Array.from(byArch.entries())
      .filter(([, xs]) => xs.length >= minN)
      .map(([archetype, xs]) => ({ archetype, mean_interest: mean(xs), n: xs.length }))
      .sort((a, b) => b.mean_interest - a.mean_interest)
      .slice(0, 3);

    return {
      arm,
      n,
      preferred_count: pref.length,
      share_of_preference: n ? pref.length / n : 0,
      mean_interest: m,
      interest_ci_low: Math.max(0, m - half),
      interest_ci_high: Math.min(100, m + half),
      incremental_hours: incremental,
      interested_hours: mean(interested.map((v) => v.arms[arm].weekly_hours)),
      interested_count: interested.length,
      cannibalization_rate: interested.length
        ? interested.filter((v) => v.arms[arm].replaces_current_mode).length / interested.length
        : 0,
      purchase: {
        standard: pref.filter((v) => v.purchase_intent === "STANDARD").length,
        deluxe: pref.filter((v) => v.purchase_intent === "DELUXE").length,
        none: pref.filter((v) => v.purchase_intent === "NONE").length,
      },
      best_fit_archetypes: bestFit,
    };
  });
}

export function isConceptArmId(v: unknown): v is ConceptArmId {
  return v === "nba" || v === "wnba" || v === "college";
}

// ===========================================================================
// PERSONALIZATION FLOW (Section D primary, contract §7)
// ===========================================================================

export type PreferenceId = ConceptArmId; // "nba" | "wnba" | "college"
export const PREFERENCE_IDS: PreferenceId[] = ["nba", "wnba", "college"];

export const PREFERENCES: Record<PreferenceId, { label: string; long: string; color: string; soft: string }> = {
  nba: { label: "NBA", long: "NBA · MyNBA / MyCAREER", color: "var(--accent-2)", soft: "var(--accent-2-soft)" },
  wnba: { label: "WNBA", long: "WNBA · The W", color: "var(--accent)", soft: "var(--accent-soft)" },
  college: { label: "College", long: "College hoops", color: "var(--warn)", soft: "var(--warn-soft)" },
};

export type ChannelId = "twotv" | "console" | "push" | "email" | "youtube";
export type CreativeFormat = "16:9" | "9:16" | "1:1" | "4:3";

/** Existing Pub/Sub activation channel enum (src/lib/gcp/pubsub-client.ts). */
export type DispatchChannel =
  | "2K_ACCOUNT_EMAIL"
  | "IN_GAME_INBOX"
  | "PUSH_2K_MOBILE"
  | "CTV_ARENA_SPOT"
  | "PAID_SOCIAL";

/** Share of each channel's audience held out as a control (deterministic by player id). */
export const HOLDOUT_PCT = 5;

export const CHANNELS: Record<
  ChannelId,
  { label: string; short: string; format: CreativeFormat; dispatch: DispatchChannel; edge: string; audience: "user" | "lookalikes" }
> = {
  twotv: { label: "In-game / 2KTV story", short: "2KTV", format: "9:16", dispatch: "IN_GAME_INBOX", edge: "var(--accent)", audience: "user" },
  console: { label: "Console & 2K launcher ad", short: "Console", format: "4:3", dispatch: "CTV_ARENA_SPOT", edge: "var(--warn)", audience: "user" },
  push: { label: "Push / SMS", short: "Push", format: "1:1", dispatch: "PUSH_2K_MOBILE", edge: "var(--good)", audience: "user" },
  email: { label: "Email", short: "Email", format: "16:9", dispatch: "2K_ACCOUNT_EMAIL", edge: "var(--accent-2)", audience: "user" },
  youtube: { label: "YouTube / Google Ads", short: "YouTube", format: "16:9", dispatch: "PAID_SOCIAL", edge: "var(--text-dim)", audience: "lookalikes" },
};
/** Serve order (approved by Jamie): story, console, push, email, then YouTube / Google Ads as the closer. */
export const CHANNEL_IDS: ChannelId[] = ["twotv", "console", "push", "email", "youtube"];

/** Deterministic holdout assignment (FNV-1a over player + channel). */
export function isHoldout(playerId: string, channel: ChannelId): boolean {
  let h = 2166136261;
  const s = `${playerId}:${channel}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 100) < HOLDOUT_PCT;
}

export type FlowNodeId = "user" | "preference" | "pairs" | "serve";

export interface FlowNodeConfig {
  id: FlowNodeId;
  step: number;
  title: string;
  caption: string;
  /** Small header pill (model or source). */
  pill: string;
  /** Header icon accent. */
  accent: string;
  /** World-space position of the column's top-left (canvas units, 1 unit = 1px at 100%). */
  x: number;
  y: number;
  /** Card width in canvas units. */
  w: number;
}

/**
 * CONCEPT_FLOW_NODES: the ONE place to rename / restyle the Section D nodal
 * workflow (Curtis's reference: dark node cards on a pan/zoom canvas, colored
 * bezier edges, zoom % / reset controls, header pills).
 */
export const CONCEPT_FLOW_NODES = {
  title: "Personalization Flow",
  subtitle: "Pick a player. Infer what they love. Test content on their twins. Serve it everywhere.",
  /** Stage rail labels, in order. */
  stages: [
    { key: "user", label: "Pick user" },
    { key: "preference", label: "Infer preference" },
    { key: "pairs", label: "Content pairs" },
    { key: "serve", label: "Serve" },
  ] as const,
  nodes: {
    user: {
      id: "user",
      step: 1,
      title: "Pick user",
      caption: "Spanner Graph · live player",
      pill: "SPANNER",
      accent: "var(--accent-2)",
      x: 0,
      y: 120,
      w: 300,
    },
    preference: {
      id: "preference",
      step: 2,
      title: "Infer preference",
      caption: "Graph signals → NBA · WNBA · College",
      pill: "FLASH · JSON",
      accent: "var(--accent)",
      x: 400,
      y: 80,
      w: 340,
    },
    pairs: {
      id: "pairs",
      step: 3,
      title: "Content pairs",
      caption: "Creative + offer · scored by synthetic twins",
      pill: "6 TWINS",
      accent: "var(--good)",
      x: 840,
      y: 0,
      w: 380,
    },
    serve: {
      id: "serve",
      step: 4,
      title: "Serve downstream",
      caption: "Pub/Sub dispatch · BigQuery log",
      pill: "ACTIVATION",
      accent: "var(--warn)",
      x: 1320,
      y: 0,
      w: 400,
    },
  } satisfies Record<FlowNodeId, FlowNodeConfig>,
  /** Default view: zoom and pan (canvas units) applied on mount and on Reset. */
  view: { zoom: 0.72, x: 40, y: 40, minZoom: 0.3, maxZoom: 1.6 },
  /** Labels used inside node cards (rename freely). */
  copy: {
    pickPresets: "Presets",
    surprise: "Surprise me",
    evidence: "Evidence",
    twins: "Synthetic twins",
    winner: "Winner",
    serve: "Serve",
    served: "Served",
  },
} as const;

// ----- Wire types -----------------------------------------------------------

export interface PersonalizeUser {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  age: number | null;
  primary_franchise: string;
  ovr: number | null;
  build: string | null;
  position: string | null;
  platform: string | null;
  favorite_team: string | null;
  favorite_player: string | null;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  crew: { id: string; name: string; tier: string; role: string } | null;
  creators: Array<{ handle: string; name: string; signature_mode: string }>;
  affinity: { wnba: number | null; college: number | null; franchise: number | null };
}

export interface PersonalizePreset {
  pref: PreferenceId;
  label: string;
  /** Why this player leans this way (which live signal). */
  basis: string;
  user: PersonalizeUser;
}

export interface PersonalizeUsersResponse {
  presets: PersonalizePreset[];
  users: PersonalizeUser[];
  database: string;
  lean_basis: "affinity" | "archetype_telemetry";
  affinity_columns: string[];
  latency_ms: number;
}

export interface UserSignals {
  crew_mix: Array<{ archetype: string; n: number }>;
  crew_wnba_fans: number;
  crew_size_sampled: number;
  purchases: Array<{ title: string; category: string; price: number | null }>;
  watched_streams: Array<{ title: string; creator: string; minutes: number }>;
  friends_affinity: { wnba: number | null; college: number | null; franchise: number | null; n: number } | null;
  sources: string[];
}

export interface PreferenceEvidence {
  pref: PreferenceId;
  signal: string; // e.g. "wnba_affinity", "favorite_player", "followed_creator"
  label: string; // chip text, short
  detail: string; // one line citing the graph value
}

export interface PreferenceInference {
  split: Record<PreferenceId, number>; // sums to 1
  top: PreferenceId;
  evidence: PreferenceEvidence[];
  rationale: string;
  model: string;
  latency_ms: number;
}

export interface Twin {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  age: number | null;
  is_self: boolean;
  similarity: string;
}

export interface TwinScore {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  is_self: boolean;
  score: number; // 0–10
  quote: string;
  voice_tier: string;
}

export interface ContentPair {
  id: string;
  asset_id: string;
  preference: PreferenceId;
  asset_title: string;
  concept: string;
  headline: string;
  body: string;
  cta: string;
  offer: string;
  why: string;
  creatives: Record<CreativeFormat, string>;
  twin_scores: TwinScore[];
  score: number | null;
  winner: boolean;
}

export interface ChannelActivation {
  channel: ChannelId;
  label: string;
  format: CreativeFormat;
  dispatch: DispatchChannel;
  creative_url: string;
  pair_id: string;
  copy: { headline: string; body: string; cta: string; subject?: string; meta?: string };
  /** Whether the picked player falls in this channel's 5% holdout. */
  holdout: boolean;
  /** YouTube / Google Ads only: the Customer Match-ready audience that Serve will stage. */
  audience?: { seed: number; lookalikes: number; holdout: number; basis: string };
}

export type PersonalizeEvent =
  | { type: "status"; stage: FlowNodeId; message: string }
  | { type: "user"; user: PersonalizeUser; signals: UserSignals; database: string; latency_ms: number }
  | { type: "preference"; preference: PreferenceInference }
  | { type: "twins"; twins: Twin[]; latency_ms: number }
  | { type: "content_pairs"; scored: boolean; pairs: ContentPair[]; latency_ms: number; model: string }
  | { type: "activation"; channels: ChannelActivation[]; latency_ms: number; model: string }
  | {
      type: "done";
      ok: true;
      latency_ms: number;
      phases: Record<string, number>;
      models: { fast: string };
    }
  | { type: "error"; service: string; stage: string; error: string };

export interface ServeRequest {
  player_id: string;
  gamer_tag: string;
  preference: PreferenceId;
  channel: ChannelId;
  pair_id: string;
  asset_id: string;
  creative_url: string;
  headline: string;
}

export interface ServeResponse {
  ok: true;
  channel: ChannelId;
  dispatch: DispatchChannel;
  status: "served" | "held_out" | "audience_staged";
  topic: string | null;
  message_id: string | null;
  activation_id: string;
  published_at: string;
  latency_ms: number;
  /** YouTube / Google Ads: rows written to BigQuery v2_ads_audience_staging. */
  staged?: { table: string; seed: number; lookalikes: number; holdout: number; audience_id: string };
}
