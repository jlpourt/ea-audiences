/**
 * Spanner-backed reads for the reference catalog and for entity-level graph
 * views.
 *
 * WHY THIS EXISTS: several API routes read `data/*.json` straight off disk.
 * For player data that was outright dishonest — the UI reported cohort sizes
 * that had never touched the database. For the catalog (games, offers,
 * creators) it was subtler but worse in one specific way: the files and the
 * database were free to drift, and they had. `is_parent_hub` and
 * `affinity_archetype` were read by the graph route but present in neither,
 * so the macro view silently rendered no franchise hubs at all.
 *
 * CACHING: the catalog is small (tens of rows) and immutable for the lifetime
 * of a process, so it is fetched once and memoised. Player reads are never
 * cached — they must reflect the database on every request.
 */
import { runRawGql, SpannerUnavailableError } from "./spanner-client";
import type { TakeTwoLabel } from "../types";

export interface GameRow {
  game_id: string;
  title: string;
  franchise: string;
  /** Take-Two publishing label: 2K | ROCKSTAR | ZYNGA. */
  label: TakeTwoLabel;
  genre: string | null;
  active_players: number | null;
  is_parent_hub: boolean;
  parent_game_id: string | null;
  release_date: string | null;
  lifecycle_status: string | null;
  monetization_model: string | null;
  current_season: string | null;
}

export interface OfferRow {
  offer_id: string;
  offer_title: string;
  target_franchise: string | null;
  game_id: string | null;
  offer_type: string | null;
  category: string | null;
  price_usd: number;
  expected_conversion_boost: number | null;
  affinity_archetype: string | null;
  lifecycle_status: string | null;
  available_from: string | null;
  description: string | null;
}

export interface CreatorRow {
  creator_id: string;
  handle: string;
  name: string;
  platform: string;
  franchise: string | null;
  followers: number | null;
  avg_stream_viewers: number | null;
  conversion_affinity: number | null;
  signature_mode: string | null;
  avatar: string | null;
}

/** A Crew (table name stays `Clans` for schema compatibility). */
export interface ClanRow {
  clan_id: string;
  name: string;
  franchise: string;
  region: string | null;
  /** Rec | Pro-Am | Comp */
  tier: string | null;
  member_count: number | null;
}

export interface IdentityRow {
  identity_id: string;
  platform: string;
  platform_handle: string | null;
  confidence_score: number;
}

/** The property graph name declared in schema/twok_graph_db.ddl. */
export const GRAPH_NAME = "TakeTwoPlayerGraph";

/**
 * Franchise root / hub game ids (one per franchise, `is_parent_hub = true`).
 *
 * Deliberately a lookup table rather than `game-${franchise.toLowerCase()}`.
 * The ids are canonical in the Codex AND the derivation is explicit, so any
 * rename fails loudly here instead of quietly dropping edges.
 */
export const HUB_ID_BY_FRANCHISE: Record<string, string> = {
  ALL: "game-nba2k27",
  NBA2K: "game-nba2k27",
  NBA2K26: "game-nba2k26",
  NBA2KMOBILE: "game-nba2k-mobile",
  WWE2K: "game-wwe2k25",
  PGA2K: "game-pga2k25",
  TOPSPIN: "game-topspin2k25",
  CIV7: "game-civ7",
  BL4: "game-bl4",
  MAFIA: "game-mafia-toc",
};

/** Franchise accents (2K Courtside). Hex because they paint canvas / WebGL nodes. */
export const FRANCHISE_COLORS: Record<string, string> = {
  ALL: "#E4002B", // --twok-red
  NBA2K: "#E4002B", // --twok-red (NBA 2K27)
  NBA2K26: "#FF6B35", // NBA 2K26 Holdout / Veteran Bridge Amber-Orange
  NBA2KMOBILE: "#00D2FF", // NBA 2K Mobile Electric Cyan
  WWE2K: "#F5B400", // WWE 2K25 Championship Gold
  PGA2K: "#10B981", // PGA TOUR 2K25 Emerald Green
  TOPSPIN: "#1FA8A0", // TopSpin 2K25 Court Teal
  CIV7: "#A855F7", // Civilization VII Imperial Violet
  BL4: "#F28C28", // Borderlands 4 Vault Orange
  MAFIA: "#8C6E4A", // Mafia Bronze
};

/** Division cluster colours for the cross-franchise graph view. */
export const LABEL_COLORS: Record<TakeTwoLabel, string> = {
  "2K": "#E4002B",
  "2K_SPORTS": "#F5B400",
  "2K_CORE": "#00D2FF",
};

const VALID_LABELS: readonly TakeTwoLabel[] = ["2K", "2K_SPORTS", "2K_CORE"];

function toLabel(v: any): TakeTwoLabel {
  return VALID_LABELS.includes(v) ? (v as TakeTwoLabel) : "2K";
}

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && typeof v.value !== "undefined") return Number(v.value);
  return Number(v);
}

function nullableNum(v: any): number | null {
  return v === null || v === undefined ? null : num(v);
}

// ---------------------------------------------------------------------------
// Catalog (memoised)
// ---------------------------------------------------------------------------

let gamesCache: GameRow[] | null = null;
let offersCache: OfferRow[] | null = null;
let creatorsCache: CreatorRow[] | null = null;

export async function getGames(): Promise<GameRow[]> {
  if (gamesCache && process.env.NODE_ENV !== "development") return gamesCache;
  const rows = await runRawGql(
    `SELECT game_id, title, franchise, label, genre, active_players, is_parent_hub,
            parent_game_id, release_date, lifecycle_status, monetization_model,
            current_season
     FROM Games ORDER BY is_parent_hub DESC, release_date DESC`
  );
  gamesCache = rows.map((r: any) => ({
    game_id: r.game_id,
    title: r.title,
    franchise: r.franchise,
    label: toLabel(r.label),
    genre: r.genre ?? null,
    active_players: nullableNum(r.active_players),
    is_parent_hub: r.is_parent_hub === true,
    parent_game_id: r.parent_game_id ?? null,
    release_date: r.release_date ?? null,
    lifecycle_status: r.lifecycle_status ?? null,
    monetization_model: r.monetization_model ?? null,
    current_season: r.current_season ?? null,
  }));
  return gamesCache;
}

/** Games published under one Take-Two label (2K / ROCKSTAR / ZYNGA). */
export async function getGamesByLabel(label: TakeTwoLabel): Promise<GameRow[]> {
  const games = await getGames();
  return games.filter((g) => g.label === label);
}

export async function getOffers(): Promise<OfferRow[]> {
  if (offersCache && process.env.NODE_ENV !== "development") return offersCache;
  const rows = await runRawGql(
    `SELECT offer_id, offer_title, target_franchise, game_id, offer_type,
            category, price_usd, expected_conversion_boost, affinity_archetype,
            lifecycle_status, available_from, description
     FROM Offers ORDER BY price_usd DESC`
  );
  offersCache = rows.map((r: any) => ({
    offer_id: r.offer_id,
    offer_title: r.offer_title,
    target_franchise: r.target_franchise ?? null,
    game_id: r.game_id ?? null,
    offer_type: r.offer_type ?? null,
    category: r.category ?? null,
    price_usd: num(r.price_usd),
    expected_conversion_boost: nullableNum(r.expected_conversion_boost),
    affinity_archetype: r.affinity_archetype ?? null,
    lifecycle_status: r.lifecycle_status ?? null,
    available_from: r.available_from ?? null,
    description: r.description ?? null,
  }));
  return offersCache;
}

export async function getCreators(): Promise<CreatorRow[]> {
  if (creatorsCache) return creatorsCache;
  const rows = await runRawGql(
    `SELECT creator_id, handle, name, platform, franchise, followers,
            avg_stream_viewers, conversion_affinity, signature_mode, avatar
     FROM Creators ORDER BY followers DESC`
  );
  creatorsCache = rows.map((r: any) => ({
    creator_id: r.creator_id,
    handle: r.handle,
    name: r.name,
    platform: r.platform,
    franchise: r.franchise ?? null,
    followers: nullableNum(r.followers),
    avg_stream_viewers: nullableNum(r.avg_stream_viewers),
    conversion_affinity: nullableNum(r.conversion_affinity),
    signature_mode: r.signature_mode ?? null,
    avatar: r.avatar ?? null,
  }));
  return creatorsCache;
}

let clansCache: ClanRow[] | null = null;

/**
 * Crews. There is deliberately no local fallback here: a Spanner failure must
 * surface as an error rather than as a plausible-looking invented roster.
 */
export async function getClans(): Promise<ClanRow[]> {
  if (clansCache) return clansCache;
  const rows = await runRawGql(
    `SELECT clan_id, name, franchise, region, tier, member_count
     FROM Clans ORDER BY member_count DESC`
  );
  clansCache = rows.map((r: any) => ({
    clan_id: r.clan_id,
    name: r.name,
    franchise: r.franchise,
    region: r.region ?? null,
    tier: r.tier ?? null,
    member_count: nullableNum(r.member_count),
  }));
  return clansCache;
}

/** Fetch the whole catalog in one round trip rather than three serial ones. */
export async function getCatalog(): Promise<{
  games: GameRow[];
  offers: OfferRow[];
  creators: CreatorRow[];
  clans: ClanRow[];
}> {
  const [games, offers, creators, clans] = await Promise.all([
    getGames(),
    getOffers(),
    getCreators(),
    getClans(),
  ]);
  return { games, offers, creators, clans };
}

/** Test/ops hook: drop the memoised catalog after a reload. */
export function invalidateCatalogCache() {
  gamesCache = null;
  offersCache = null;
  creatorsCache = null;
  clansCache = null;
}

// ---------------------------------------------------------------------------
// Player reads (never cached)
// ---------------------------------------------------------------------------

const PLAYER_COLUMNS = `player_id, display_name, gamer_tag, primary_franchise,
  franchises_played, primary_archetype, lifetime_spend_usd, churn_risk_score,
  tilt_sensitivity, recent_loss_streak, age, gender, account_tenure_days,
  currency_balance, country, country_code, country_flag, dma_market, lat, lng,
  followed_creators, primary_creator_influence, game_telemetry, purchased_items`;

function parseJson(v: any, fallback: any) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  }
  return v;
}

export function mapPlayer(r: any) {
  return {
    ...r,
    lifetime_spend_usd: num(r.lifetime_spend_usd),
    churn_risk_score: num(r.churn_risk_score),
    tilt_sensitivity: num(r.tilt_sensitivity),
    recent_loss_streak: num(r.recent_loss_streak),
    age: nullableNum(r.age),
    account_tenure_days: nullableNum(r.account_tenure_days),
    currency_balance: nullableNum(r.currency_balance),
    lat: nullableNum(r.lat),
    lng: nullableNum(r.lng),
    franchises_played: r.franchises_played || [],
    followed_creators: r.followed_creators || [],
    game_telemetry: parseJson(r.game_telemetry, {}),
    purchased_items: parseJson(r.purchased_items, []),
  };
}

/**
 * Players for the macro/cohort canvas.
 *
 * `franchise` matches players for whom the title is primary OR merely played —
 * a marketer asking for "GTA Online players" means everyone who plays GTA
 * Online, and restricting to `primary_franchise` would exclude exactly the
 * cross-label 2K Account ↔ Rockstar Social Club players the whole story
 * depends on.
 */
export async function getPlayersForView(opts: {
  franchise?: string;
  archetype?: string;
  limit?: number;
}) {
  const { franchise, archetype, limit = 450 } = opts;
  const where: string[] = [];
  const params: Record<string, any> = {
    limit: Math.max(1, Math.floor(limit)),
  };

  if (franchise && franchise !== "ALL") {
    where.push(`(primary_franchise = @franchise OR @franchise IN UNNEST(franchises_played))`);
    params.franchise = franchise;
  }
  if (archetype && archetype !== "ALL") {
    where.push(`primary_archetype = @archetype`);
    params.archetype = archetype;
  }

  const rows = await runRawGql(
    `SELECT ${PLAYER_COLUMNS} FROM Players
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY player_id ASC
     LIMIT @limit`,
    params
  );
  return rows.map(mapPlayer);
}

export async function getPlayerById(playerId: string) {
  const rows = await runRawGql(
    `SELECT ${PLAYER_COLUMNS} FROM Players
     WHERE player_id = @playerId LIMIT 1`,
    { playerId }
  );
  return rows.length ? mapPlayer(rows[0]) : null;
}

/** Resolved platform identities for one player, via the HAS_IDENTITY edge. */
export async function getIdentitiesForPlayer(
  playerId: string
): Promise<IdentityRow[]> {
  const rows = await runRawGql(
    `GRAPH ${GRAPH_NAME}
     MATCH (p:Player)-[h:HAS_IDENTITY]->(i:Identity)
     WHERE p.player_id = @playerId
     RETURN i.identity_id AS identity_id, i.platform AS platform,
            i.platform_handle AS platform_handle,
            h.confidence_score AS confidence_score
     ORDER BY confidence_score DESC`,
    { playerId }
  );
  return rows.map((r: any) => ({
    identity_id: r.identity_id,
    platform: r.platform,
    platform_handle: r.platform_handle ?? null,
    confidence_score: num(r.confidence_score),
  }));
}

export { SpannerUnavailableError };
