/**
 * Take-Two studio grouping for the graph workspace.
 *
 * Studio is derived from `Games.label` in Spanner: ROCKSTAR = Rockstar Games,
 * ZYNGA = Zynga, every other label (2K, 2K_SPORTS, 2K_CORE) = 2K. Callers that
 * have the live `Games` catalog should prefer `buildFranchiseIndex(games)` so
 * new titles show up without a code change; the static franchise map below
 * only exists for client components that render before any catalog fetch and
 * mirrors `schema/t2_graph_db.ddl` seed data.
 *
 * Colours are hex because they paint canvas / WebGL nodes; they mirror the
 * design tokens `--accent` (2K), `--warn` (Rockstar) and `--good` (Zynga).
 */

export type Studio = "2K" | "ROCKSTAR" | "ZYNGA";

export const STUDIOS: readonly Studio[] = ["2K", "ROCKSTAR", "ZYNGA"];

export const STUDIO_NAMES: Record<Studio, string> = {
  "2K": "2K",
  ROCKSTAR: "Rockstar Games",
  ZYNGA: "Zynga",
};

export const STUDIO_COLORS: Record<Studio, string> = {
  "2K": "#E4002B",
  ROCKSTAR: "#F5B400",
  ZYNGA: "#2FD38A",
};

/** `Games.label` -> studio. */
export function studioForLabel(label?: string | null): Studio {
  if (label === "ROCKSTAR") return "ROCKSTAR";
  if (label === "ZYNGA") return "ZYNGA";
  return "2K";
}

/** Franchise -> `Games.label` for every seeded franchise in t2_graph_db. */
export const LABEL_BY_FRANCHISE_ALL: Record<string, string> = {
  NBA2K: "2K",
  NBA2K26: "2K",
  NBA2KMOBILE: "2K",
  WWE2K: "2K_SPORTS",
  PGA2K: "2K_SPORTS",
  TOPSPIN: "2K_SPORTS",
  BL4: "2K_CORE",
  CIV7: "2K_CORE",
  MAFIA: "2K_CORE",
  GTAO: "ROCKSTAR",
  RDO: "ROCKSTAR",
  GTA6: "ROCKSTAR",
  WWF: "ZYNGA",
  MATCHFACTORY: "ZYNGA",
  TOONBLAST: "ZYNGA",
  CSR2: "ZYNGA",
  EMPIRES: "ZYNGA",
  ZPOKER: "ZYNGA",
};

/** Short display names for franchise ids (UI chips / legends). */
export const FRANCHISE_SHORT_NAMES: Record<string, string> = {
  NBA2K: "NBA 2K27",
  NBA2K26: "NBA 2K26",
  NBA2KMOBILE: "NBA 2K Mobile",
  WWE2K: "WWE 2K25",
  PGA2K: "PGA TOUR 2K25",
  TOPSPIN: "TopSpin 2K25",
  BL4: "Borderlands 4",
  CIV7: "Civilization VII",
  MAFIA: "Mafia: The Old Country",
  GTAO: "GTA Online",
  RDO: "Red Dead Online",
  GTA6: "GTA VI",
  WWF: "Words With Friends",
  MATCHFACTORY: "Match Factory!",
  TOONBLAST: "Toon Blast",
  CSR2: "CSR Racing 2",
  EMPIRES: "Empires & Puzzles",
  ZPOKER: "Zynga Poker",
};

export function studioForFranchise(franchise?: string | null): Studio {
  return studioForLabel(franchise ? LABEL_BY_FRANCHISE_ALL[franchise] : null);
}

export function franchiseName(franchise?: string | null): string {
  if (!franchise) return "Unknown title";
  return FRANCHISE_SHORT_NAMES[franchise] || franchise;
}

/** Studio inferred from a player id prefix (t2-usr = 2K, t2-rsg = Rockstar, t2-zng = Zynga). */
export function studioForPlayerId(playerId?: string | null): Studio | null {
  if (!playerId) return null;
  if (playerId.startsWith("t2-rsg-")) return "ROCKSTAR";
  if (playerId.startsWith("t2-zng-")) return "ZYNGA";
  if (playerId.startsWith("t2-usr-")) return "2K";
  return null;
}

/** NBA 2K titles carry MyPLAYER OVR / VC telemetry; nothing else does. */
export const NBA_FRANCHISES = new Set(["NBA2K", "NBA2K26", "NBA2KMOBILE"]);

export interface FranchiseIndexGame {
  game_id: string;
  title: string;
  franchise: string;
  label: string;
  is_parent_hub: boolean;
  lifecycle_status: string | null;
}

/**
 * Data-driven franchise index built from the live Spanner `Games` table:
 * franchise -> hub game, label, studio, lifecycle.
 */
export function buildFranchiseIndex<G extends FranchiseIndexGame>(games: G[]) {
  const hubByFranchise = new Map<string, G>();
  for (const g of games) {
    const cur = hubByFranchise.get(g.franchise);
    if (!cur || (g.is_parent_hub && !cur.is_parent_hub)) {
      hubByFranchise.set(g.franchise, g);
    }
  }
  return {
    hubByFranchise,
    labelOf(franchise?: string | null): string {
      if (!franchise) return "2K";
      return (
        hubByFranchise.get(franchise)?.label ||
        LABEL_BY_FRANCHISE_ALL[franchise] ||
        "2K"
      );
    },
    studioOf(franchise?: string | null): Studio {
      return studioForLabel(this.labelOf(franchise));
    },
    isPreLaunch(franchise?: string | null): boolean {
      if (!franchise) return false;
      return hubByFranchise.get(franchise)?.lifecycle_status === "PRE_LAUNCH";
    },
  };
}
