/**
 * Canonical Take-Two player archetype registry (2K Courtside).
 *
 * This is the SINGLE source of truth for archetype identity, labelling and
 * colour. Every archetype listed here is present in `data/master_players.json`
 * and in the live `twok_graph_db` Spanner database; nothing here is
 * aspirational. The graph API, the sidebar, the geo map and the Courtside
 * Focus Group prompts all import from this file rather than carrying their own
 * copies, which is how off-catalog archetypes survived earlier cleanups.
 *
 * Colours are hex because they are painted onto canvas / WebGL nodes where CSS
 * custom properties are not resolvable. Each one mirrors a brand token from
 * `src/app/globals.css` (noted inline) so the palette stays coherent.
 */

export const ARCHETYPES = [
  "MYTEAM_PACK_WHALE",
  "PARK_REP_GRINDER",
  "REC_CREW_CAPTAIN",
  "MYCAREER_STORY_CASUAL",
  "MYNBA_FRANCHISE_SIM",
  "BUILD_LAB_THEORYCRAFTER",
  "THE_W_LOYALIST",
  "CROSS_LABEL_NOMAD",
  "MOBILE_DAILY_RITUALIST",
  "RAGE_QUIT_TILT_RISK",
] as const;

export const ARCHETYPE_IDS = ARCHETYPES;

export type ArchetypeId = (typeof ARCHETYPES)[number];

/** Canonical 2K division hex accents for canvas/WebGL rendering. */
export const LABEL_COLORS: Record<"2K" | "2K_SPORTS" | "2K_CORE", string> = {
  "2K": "#E4002B",
  "2K_SPORTS": "#F5B400",
  "2K_CORE": "#00D2FF",
};

/** High-LTV monetising archetypes (MyTEAM packs, VC-funded builds, 2K26 veteran & cross-2K spend). */
export const WHALE_ARCHETYPES: ArchetypeId[] = [
  "MYTEAM_PACK_WHALE",
  "PARK_REP_GRINDER",
  "CROSS_LABEL_NOMAD",
];

/**
 * The primary monetising or signature archetype for each franchise filter.
 * Keys are `GameFranchise` values from `src/lib/types`.
 */
export const WHALE_BY_FRANCHISE: Record<string, ArchetypeId> = {
  ALL: "MYTEAM_PACK_WHALE",
  NBA2K: "MYTEAM_PACK_WHALE",
  NBA2K26: "CROSS_LABEL_NOMAD",
  NBA2KMOBILE: "MOBILE_DAILY_RITUALIST",
  WWE2K: "MYTEAM_PACK_WHALE",
  PGA2K: "MYNBA_FRANCHISE_SIM",
  TOPSPIN: "PARK_REP_GRINDER",
  CIV7: "MYNBA_FRANCHISE_SIM",
  BL4: "BUILD_LAB_THEORYCRAFTER",
  MAFIA: "MYCAREER_STORY_CASUAL",
};

export const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  MYTEAM_PACK_WHALE: "MyTEAM Pack Whale",
  PARK_REP_GRINDER: "Park Rep Grinder",
  REC_CREW_CAPTAIN: "Rec & Pro-Am Crew Captain",
  MYCAREER_STORY_CASUAL: "MyCAREER Story Casual",
  MYNBA_FRANCHISE_SIM: "MyNBA Franchise Sim GM",
  BUILD_LAB_THEORYCRAFTER: "Build Lab Theorycrafter",
  THE_W_LOYALIST: "The W Loyalist",
  CROSS_LABEL_NOMAD: "2K26 Veteran & Cross-2K Bridge",
  MOBILE_DAILY_RITUALIST: "NBA 2K Mobile Daily Ritualist",
  RAGE_QUIT_TILT_RISK: "Rage-Quit Churn Risk",
};

/** One-line behavioural summary, used by persona prompts and tooltips. */
export const ARCHETYPE_DESCRIPTIONS: Record<ArchetypeId, string> = {
  MYTEAM_PACK_WHALE:
    "Opens MyTEAM packs weekly, chases Galaxy Opal and Dark Matter cards, buys the Hall of Fame Season Pass on day one.",
  PARK_REP_GRINDER:
    "Lives in The City and the Park; grinds Rep toward Legend, funds a 99 OVR build with VC the moment a new 2K drops.",
  REC_CREW_CAPTAIN:
    "Runs a Rec / Pro-Am Crew, sends the invites, sets the squad schedule; the social gravity that keeps teammates logging in.",
  MYCAREER_STORY_CASUAL:
    "Plays MyCAREER for the narrative and the NBA fantasy; stalls below 85 OVR around week 4–6 and is the classic Season 2 cliff risk.",
  MYNBA_FRANCHISE_SIM:
    "Runs 10-season MyNBA / Eras dynasties, obsesses over trade logic and draft classes, and cross-plays PGA TOUR 2K25 & Civilization VII.",
  BUILD_LAB_THEORYCRAFTER:
    "Watches build videos before buying VC, tests badge thresholds in the Build Lab, follows DBG and Tydebo religiously.",
  THE_W_LOYALIST:
    "Plays The W and WNBA MyNBA, engaged with Caitlin Clark Deluxe-edition content, high sentiment, under-marketed.",
  CROSS_LABEL_NOMAD:
    "High-spend NBA 2K26 veteran or multi-franchise 2K loyalist (WWE 2K25, PGA TOUR 2K25, Borderlands 4) ready to bridge into NBA 2K27.",
  MOBILE_DAILY_RITUALIST:
    "Daily-streak player on NBA 2K Mobile companion and MyTEAM mobile packs; frequent small VC and coin-pack spend.",
  RAGE_QUIT_TILT_RISK:
    "High Rage-Quit Index, on a Park loss streak, skeptical of VC pricing on r/NBA2K; churn and backlash risk in one.",
};

export const ARCHETYPE_COLORS: Record<ArchetypeId, string> = {
  // --vc-gold: money, whales, MyTEAM
  MYTEAM_PACK_WHALE: "#F5B400",
  // --twok-red: the hero accent, Park / The City
  PARK_REP_GRINDER: "#E4002B",
  // Warm social orange, Crew Captains
  REC_CREW_CAPTAIN: "#F28C28",
  // Cool slate, MyCAREER casual
  MYCAREER_STORY_CASUAL: "#8FA3BF",
  // PGA green, the sim GM
  MYNBA_FRANCHISE_SIM: "#10B981",
  // Electric cyan, the theorycrafter
  BUILD_LAB_THEORYCRAFTER: "#00D2FF",
  // Championship gold, The W
  THE_W_LOYALIST: "#D8B13A",
  // 2K26 Veteran / Cross-2K amber-orange bridge
  CROSS_LABEL_NOMAD: "#FF6B35",
  // NBA 2K Mobile electric blue
  MOBILE_DAILY_RITUALIST: "#3B82F6",
  // --loss-red: churn, rage-quit, backlash
  RAGE_QUIT_TILT_RISK: "#FF4D5E",
};

const FALLBACK_COLOR = "#7C8799";

export function isKnownArchetype(value?: string | null): value is ArchetypeId {
  return !!value && (ARCHETYPES as readonly string[]).includes(value);
}

export function isWhaleArchetype(value?: string | null): boolean {
  return !!value && (WHALE_ARCHETYPES as string[]).includes(value);
}

export function archetypeColor(value?: string | null): string {
  return isKnownArchetype(value) ? ARCHETYPE_COLORS[value] : FALLBACK_COLOR;
}

export function archetypeLabel(value?: string | null): string {
  if (isKnownArchetype(value)) return ARCHETYPE_LABELS[value];
  return value ? value.replace(/_/g, " ").toLowerCase() : "Unknown";
}

export function archetypeDescription(value?: string | null): string {
  return isKnownArchetype(value) ? ARCHETYPE_DESCRIPTIONS[value] : "";
}
