/**
 * Canonical ABK archetype registry.
 *
 * This is the SINGLE source of truth for archetype identity, labelling, and
 * colour. Every archetype listed here is present in `data/master_players.json`;
 * nothing here is aspirational. Previously these facts were duplicated across
 * the graph API, the graph controls, the geo map and the DeepSona prompts,
 * which is how off-catalog archetypes and a
 * zero-population archetype survived earlier cleanups.
 */

export const ARCHETYPES = [
  "BLACKCELL_WHALE",
  "VERDANSK_OG",
  "CDL_RANKED_SWEAT",
  "CAMO_COMPLETIONIST",
  "ROUND_BASED_ZOMBIES_SLAYER",
  "SEARCH_AND_DESTROY_SPECIALIST",
  "CASUAL_WARZONE_WARRIOR",
  "MOBILE_TOUCHPAD_PRODIGY",
  "DMZ_EXTRACTION_SURVIVOR",
  "GULAG_TILT_RISK",
] as const;

export type ArchetypeId = (typeof ARCHETYPES)[number];

/** High-LTV monetising archetypes. */
export const WHALE_ARCHETYPES: ArchetypeId[] = [
  "BLACKCELL_WHALE",
  "CAMO_COMPLETIONIST",
  "MOBILE_TOUCHPAD_PRODIGY",
];

/** The primary monetising or signature archetype for each mode. */
export const WHALE_BY_FRANCHISE: Record<string, ArchetypeId> = {
  ALL: "BLACKCELL_WHALE",
  COD: "BLACKCELL_WHALE",
  WARZONE: "BLACKCELL_WHALE",
  BLACK_OPS: "BLACKCELL_WHALE",
  MODERN_WARFARE: "BLACKCELL_WHALE",
  CDL_RANKED: "CDL_RANKED_SWEAT",
  COD_MOBILE: "MOBILE_TOUCHPAD_PRODIGY",
};

export const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  BLACKCELL_WHALE: "BlackCell Pass Whale",
  VERDANSK_OG: "Verdansk OG Veteran",
  CDL_RANKED_SWEAT: "CDL Ranked Sweat",
  CAMO_COMPLETIONIST: "Mastery Camo Grinder",
  ROUND_BASED_ZOMBIES_SLAYER: "Zombies Easter Egg Slayer",
  SEARCH_AND_DESTROY_SPECIALIST: "S&D Clutch Specialist",
  CASUAL_WARZONE_WARRIOR: "Casual Weekend Squad",
  MOBILE_TOUCHPAD_PRODIGY: "CoD Mobile Touchpad Prodigy",
  DMZ_EXTRACTION_SURVIVOR: "DMZ Extraction Survivor",
  GULAG_TILT_RISK: "Gulag Tilt & Loss Risk",
};

export const ARCHETYPE_COLORS: Record<ArchetypeId, string> = {
  // Monetisers — gold family
  BLACKCELL_WHALE: "#FFB800",
  VERDANSK_OG: "#F59E0B",
  // Competitive / Ranked — red / crimson family
  CDL_RANKED_SWEAT: "#FF4757",
  GULAG_TILT_RISK: "#EF4444",
  // Specialists — purple / indigo
  CAMO_COMPLETIONIST: "#A855F7",
  SEARCH_AND_DESTROY_SPECIALIST: "#3B82F6",
  // Co-Op Zombies — emerald green
  ROUND_BASED_ZOMBIES_SLAYER: "#10B981",
  // Casual & Extraction — mint / amber
  CASUAL_WARZONE_WARRIOR: "#34D399",
  DMZ_EXTRACTION_SURVIVOR: "#EAB308",
  // Mobile — cyan
  MOBILE_TOUCHPAD_PRODIGY: "#06B6D4",
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
