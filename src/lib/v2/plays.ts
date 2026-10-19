/**
 * Cross-franchise plays for the Take-Two command center.
 *
 * Each play turns a cross-studio insight into an action loop:
 *   Audience (Spanner Graph, live) -> Plan (Gemini) -> Pressure test
 *   (synthetic personas hydrated from that audience) -> Launch (BigQuery
 *   assignment manifest with a randomized holdout + Pub/Sub dispatch) ->
 *   Measure (BigQuery, at the readout date).
 *
 * Shared by the API routes and the UI (no server imports here).
 */

export type Studio = "2K" | "ROCKSTAR" | "ZYNGA";
export type PlayId = "warm_intro" | "gta6_window" | "save_elsewhere";

export const TWOK_FRANCHISES = ["NBA2K", "NBA2K26", "NBA2KMOBILE", "WWE2K", "PGA2K", "TOPSPIN", "BL4", "CIV7", "MAFIA"] as const;
export const ROCKSTAR_FRANCHISES = ["GTAO", "RDO", "GTA6"] as const;
export const ZYNGA_FRANCHISES = ["WWF", "MATCHFACTORY", "TOONBLAST", "CSR2", "EMPIRES", "ZPOKER"] as const;

export const FRANCHISE_TITLE: Record<string, string> = {
  NBA2K: "NBA 2K27", NBA2K26: "NBA 2K26", NBA2KMOBILE: "NBA 2K Mobile", WWE2K: "WWE 2K25", PGA2K: "PGA TOUR 2K25",
  TOPSPIN: "TopSpin 2K25", BL4: "Borderlands 4", CIV7: "Civilization VII", MAFIA: "Mafia: The Old Country",
  GTAO: "GTA Online", RDO: "Red Dead Online", GTA6: "Grand Theft Auto VI",
  WWF: "Words With Friends", MATCHFACTORY: "Match Factory!", TOONBLAST: "Toon Blast", CSR2: "CSR Racing 2",
  EMPIRES: "Empires & Puzzles", ZPOKER: "Zynga Poker",
};
export const FRANCHISE_GAME: Record<string, string> = {
  NBA2K: "game-nba2k27", NBA2K26: "game-nba2k26", NBA2KMOBILE: "game-nba2k-mobile", WWE2K: "game-wwe2k25", PGA2K: "game-pga2k25",
  TOPSPIN: "game-topspin2k25", BL4: "game-bl4", CIV7: "game-civ7", MAFIA: "game-mafia-toc",
  GTAO: "game-gta-online", RDO: "game-red-dead-online", GTA6: "game-gta6",
  WWF: "game-words-with-friends", MATCHFACTORY: "game-match-factory", TOONBLAST: "game-toon-blast", CSR2: "game-csr2",
  EMPIRES: "game-empires-puzzles", ZPOKER: "game-zynga-poker",
};

export function studioOfFranchise(f: string): Studio {
  if ((ROCKSTAR_FRANCHISES as readonly string[]).includes(f)) return "ROCKSTAR";
  if ((ZYNGA_FRANCHISES as readonly string[]).includes(f)) return "ZYNGA";
  return "2K";
}
export const STUDIO_FRANCHISES: Record<Studio, readonly string[]> = { "2K": TWOK_FRANCHISES, ROCKSTAR: ROCKSTAR_FRANCHISES, ZYNGA: ZYNGA_FRANCHISES };
export const STUDIO_NAME: Record<Studio, string> = { "2K": "2K", ROCKSTAR: "Rockstar Games", ZYNGA: "Zynga" };

/** Activation channels understood by the Pub/Sub dispatch path (pubsub-client ActivationChannel). */
export const CHANNELS = ["2K_ACCOUNT_EMAIL", "IN_GAME_INBOX", "PUSH_2K_MOBILE", "ROCKSTAR_NEWSWIRE", "ZYNGA_CROSS_PROMO", "PAID_SOCIAL"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Segment {
  id: string;
  label: string;
  /** One line: who is in it. */
  who: string;
  /** Labels whose players or titles this segment touches (governance line). */
  labels: Studio[];
  /** Segment-specific KPI (falls back to the play KPI). */
  kpi?: string;
  /** The same audience as a prompt-bar question, for "Open in graph". */
  nl: string;
}

export interface PlayDef {
  id: PlayId;
  name: string;
  hook: string;
  /** The insight it acts on (shown on the card). */
  insight: string;
  segments: Segment[];
  /** Primary KPI the holdout is measured on. */
  kpi: string;
  /** Days after launch for the readout. */
  readoutDays: number;
  channels: Channel[];
  /** Guidance for the plan agent. */
  brief: string;
}

/** Warm-intro pairs: (home studio -> title). Same pairs as the landing's friend pull. */
export const WARM_PAIRS: { id: string; source: Studio; franchise: string }[] = [
  { id: "rockstar-nba2k", source: "ROCKSTAR", franchise: "NBA2K" },
  { id: "2k-gtao", source: "2K", franchise: "GTAO" },
  { id: "zynga-nba2kmobile", source: "ZYNGA", franchise: "NBA2KMOBILE" },
  { id: "rockstar-mafia", source: "ROCKSTAR", franchise: "MAFIA" },
  { id: "zynga-gtao", source: "ZYNGA", franchise: "GTAO" },
];

/** Default warm-intro direction for a player from a given home studio (Player 360 "Act on players like this"). */
export const WARM_FOR_STUDIO: Record<Studio, string> = { "2K": "2k-gtao", ROCKSTAR: "rockstar-nba2k", ZYNGA: "zynga-nba2kmobile" };

export const PLAYS: Record<PlayId, PlayDef> = {
  warm_intro: {
    id: "warm_intro",
    name: "Warm intro",
    hook: "Your friends are already there",
    insight: "Players are up to 4x more likely to pick up another label's title when a friend already plays it. Works in every direction.",
    segments: WARM_PAIRS.map((p) => ({
      id: p.id,
      label: `${STUDIO_NAME[p.source]} → ${FRANCHISE_TITLE[p.franchise]}`,
      who: `Active ${STUDIO_NAME[p.source]} players who don't play ${FRANCHISE_TITLE[p.franchise]} but have at least one friend who does.`,
      labels: Array.from(new Set([p.source, studioOfFranchise(p.franchise)])),
      nl: `Active ${STUDIO_NAME[p.source]} players who do not play ${FRANCHISE_TITLE[p.franchise]} but have a friend who plays ${FRANCHISE_TITLE[p.franchise]}`,
    })),
    kpi: "Target-title adoption within 30 days (secondary: week-4 retention)",
    readoutDays: 30,
    channels: ["IN_GAME_INBOX", "ZYNGA_CROSS_PROMO", "ROCKSTAR_NEWSWIRE", "2K_ACCOUNT_EMAIL"],
    brief:
      "Social-proof cross-promotion. Use the real number of friends already playing the target title. The reward must reward playing together (e.g. bonus when you join a friend's session), not a generic discount. Respect cross-studio consent; never reveal friends' names.",
  },
  gta6_window: {
    id: "gta6_window",
    name: "GTA VI launch window",
    hook: "One portfolio plan for Nov 19",
    insight: "GTA VI launches Nov 19. Plan it as one portfolio moment: bring friends in on day one, welcome GTA fans to 2K, keep 2K players' momentum.",
    segments: [
      {
        id: "day_one",
        label: "Day one · friends of wishlisters",
        who: "Active Take-Two players who haven't wishlisted GTA VI yet but have at least one friend who has.",
        labels: ["ROCKSTAR", "2K", "ZYNGA"],
        kpi: "GTA VI wishlist adds within 30 days and day-one play with a friend (Rockstar KPI).",
        nl: "Active players who have not wishlisted GTA VI but have a friend who wishlisted GTA VI",
      },
      {
        id: "halo",
        label: "Welcome GTA fans to 2K",
        who: "Active GTA VI wishlisters who play no 2K title. Opportunity: Mafia: The Old Country and Borderlands 4 after launch.",
        labels: ["ROCKSTAR", "2K"],
        kpi: "2K title adoption within 30 days of the GTA VI launch (2K KPI).",
        nl: "Active players who wishlisted GTA VI and play no 2K title",
      },
      {
        id: "shield",
        label: "Keep 2K momentum",
        who: "Active NBA 2K players with GTA VI wishlisted. They will play GTA VI; the goal is that they keep their NBA 2K27 Season 2 progress going too.",
        labels: ["2K", "ROCKSTAR"],
        kpi: "NBA 2K27 session minutes in the 2 weeks after Nov 19, vs. holdout (2K KPI).",
        nl: "Active NBA 2K players who wishlisted GTA VI",
      },
    ],
    kpi: "Per audience: wishlist adds and day-one co-play (Rockstar), 2K adoption (2K), NBA 2K27 minutes (2K).",
    readoutDays: 30,
    channels: ["ROCKSTAR_NEWSWIRE", "2K_ACCOUNT_EMAIL", "IN_GAME_INBOX", "ZYNGA_CROSS_PROMO", "PAID_SOCIAL"],
    brief:
      "GTA VI (Nov 19, 2026) is a Take-Two win; plan one positive-sum portfolio moment. Day one: social invitations to wishlist and play GTA VI together with friends. Welcome GTA fans: crime-narrative and co-op cross-promotion into Mafia: The Old Country and Borderlands 4 after launch. Keep 2K momentum: make it easy to keep NBA 2K27 Season 2 progress going alongside GTA VI (catch-up boosts, crew events), never asking players to choose. Never frame any title as competing with GTA VI.",
  },
  save_elsewhere: {
    id: "save_elsewhere",
    name: "Save them elsewhere",
    hook: "Reach fading players where they still play",
    insight: "Players fading in 2K are often still active this week in a Rockstar or Zynga title.",
    segments: [
      {
        id: "fading_2k",
        label: "Fading in 2K · active elsewhere",
        who: "2K players whose sessions fell 30%+ week over week (the keystone decline rule), still active, who played a Rockstar or Zynga title in the last 7 days.",
        labels: ["2K", "ROCKSTAR", "ZYNGA"],
        nl: "NBA 2K players whose sessions dropped 30% week over week who played a Rockstar or Zynga title in the last 7 days",
      },
    ],
    kpi: "2K session minutes recovered within 14 days vs. holdout",
    readoutDays: 14,
    channels: ["ZYNGA_CROSS_PROMO", "ROCKSTAR_NEWSWIRE", "IN_GAME_INBOX"],
    brief:
      "Reach the player inside the Rockstar or Zynga title they still play daily, with a reason to come back to their 2K title (a return reward in the 2K title, a crew nudge). Keep it native to the surface they are on; short, not salesy.",
  },
};

export const PLAY_ORDER: PlayId[] = ["warm_intro", "gta6_window", "save_elsewhere"];

export const segmentOf = (play: PlayId, segment: string): Segment | undefined => PLAYS[play].segments.find((s) => s.id === segment);
export const kpiOf = (play: PlayId, segment: string): string => segmentOf(play, segment)?.kpi ?? PLAYS[play].kpi;

/* ------------------------------------------------------------------ API shapes */

export interface AudienceMember {
  player_id: string;
  gamer_tag: string;
  primary_franchise: string;
  primary_archetype: string;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  /** Play-specific signal, e.g. friends in the target title. */
  signal: number | null;
}

export interface AudienceResponse {
  play: PlayId;
  segment: string;
  count: number;
  sample: AudienceMember[];
  stats: {
    avg_spend_usd: number;
    avg_churn_risk: number;
    avg_signal: number | null;
    signal_label: string | null;
    top_archetypes: { name: string; share: number }[];
    top_home_titles: { franchise: string; title: string; share: number }[];
  };
  gql: string;
  database: string;
  latency_ms: number;
  cache: "hit" | "miss";
  computed_at: string;
}

export interface PlanVariant {
  id: "A" | "B" | "C";
  name: string;
  hook: string;
  offer: string;
  message: string;
  channel: Channel;
  reward_trigger: string;
  why: string;
}

export interface PlanResponse {
  play: PlayId;
  segment: string;
  variants: PlanVariant[];
  guardrails: string[];
  kpi: string;
  model_used: string;
  latency_ms: number;
}

export interface PersonaVerdict {
  player_id: string;
  gamer_tag: string;
  home_title: string;
  archetype: string;
  preferred: "A" | "B" | "C" | "NONE";
  scores: Record<"A" | "B" | "C", number>;
  quote: string;
  latency_ms: number;
}

export interface VariantAggregate {
  id: "A" | "B" | "C";
  share: number;
  mean_score: number;
  ci95: number;
  n: number;
}

export type PressureEvent =
  | { type: "cohort"; personas: { player_id: string; gamer_tag: string; home_title: string; archetype: string }[]; latency_ms: number }
  | { type: "verdict"; verdict: PersonaVerdict }
  | { type: "aggregate"; variants: VariantAggregate[]; winner: "A" | "B" | "C"; n: number; none_share: number }
  | { type: "done"; latency_ms: number; model: string }
  | { type: "error"; service: string; phase: string; message: string };

export interface LaunchResponse {
  action_id: string;
  play: PlayId;
  segment: string;
  variant: PlanVariant;
  treatment_n: number;
  control_n: number;
  holdout_pct: number;
  balance: { arm: "treatment" | "control"; n: number; avg_spend_usd: number; avg_churn_risk: number; avg_session_min_7d: number }[];
  pubsub: { topic: string; message_id: string };
  bigquery: { dataset: string; actions_table: string; assignments_table: string };
  readout_date: string;
  kpi: string;
  latency_ms: number;
}

export interface PlaybookEntry {
  action_id: string;
  play: PlayId;
  segment: string;
  variant_name: string;
  channel: string;
  launched_at: string;
  readout_date: string;
  treatment_n: number;
  control_n: number;
  kpi: string;
  pubsub_message_id: string;
}
