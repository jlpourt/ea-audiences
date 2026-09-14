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
  "AZERITE_COLLECTOR",
  "SANCTUARY_COLLECTOR",
  "MYTHIC_COLLECTOR",
  "BOOSTER_WHALE",
  "COMPETITIVE_GRINDER",
  "RANKED_SWEAT",
  "CASUAL_SOCIALIZER",
  "CASUAL_WARRIOR",
  "LORE_SEEKER",
] as const;

export type ArchetypeId = (typeof ARCHETYPES)[number];

/** High-LTV monetising archetypes. One per franchise, by design. */
export const WHALE_ARCHETYPES: ArchetypeId[] = [
  "BLACKCELL_WHALE",
  "AZERITE_COLLECTOR",
  "SANCTUARY_COLLECTOR",
  "MYTHIC_COLLECTOR",
  "BOOSTER_WHALE",
];

/** The monetising archetype that belongs to each franchise. */
export const WHALE_BY_FRANCHISE: Record<string, ArchetypeId> = {
  COD: "BLACKCELL_WHALE",
  WOW: "AZERITE_COLLECTOR",
  DIABLO4: "SANCTUARY_COLLECTOR",
  OVERWATCH2: "MYTHIC_COLLECTOR",
  CANDYCRUSH: "BOOSTER_WHALE",
};

export const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  BLACKCELL_WHALE: "BlackCell Pass Whale",
  AZERITE_COLLECTOR: "Mount & Pet Collector",
  SANCTUARY_COLLECTOR: "Sanctuary Cosmetic Collector",
  MYTHIC_COLLECTOR: "Mythic Skin Collector",
  BOOSTER_WHALE: "Booster & Lives Whale",
  COMPETITIVE_GRINDER: "Competitive Grinder",
  RANKED_SWEAT: "Ranked Sweat",
  CASUAL_SOCIALIZER: "Casual Socializer",
  CASUAL_WARRIOR: "Casual Warrior",
  LORE_SEEKER: "Lore Seeker",
};

export const ARCHETYPE_COLORS: Record<ArchetypeId, string> = {
  // Monetisers — gold family
  BLACKCELL_WHALE: "#FFB800",
  AZERITE_COLLECTOR: "#F0A500",
  SANCTUARY_COLLECTOR: "#E08700",
  MYTHIC_COLLECTOR: "#FFCE45",
  BOOSTER_WHALE: "#FF9F1C",
  // Competitive — red family
  COMPETITIVE_GRINDER: "#FF4757",
  RANKED_SWEAT: "#FF6B7A",
  // Casual — green family
  CASUAL_SOCIALIZER: "#00FF88",
  CASUAL_WARRIOR: "#34D399",
  // Narrative — cyan
  LORE_SEEKER: "#00F0FF",
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
