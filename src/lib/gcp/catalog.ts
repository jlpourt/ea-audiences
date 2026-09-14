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

export interface GameRow {
  game_id: string;
  title: string;
  franchise: string;
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

export interface IdentityRow {
  identity_id: string;
  platform: string;
  platform_handle: string | null;
  confidence_score: number;
}

/**
 * The five franchise roots.
 *
 * Deliberately a lookup table rather than `game-${franchise.toLowerCase()}`.
 * That interpolation is what broke linking for three of the five franchises:
 * it produced `game-diablo4`, `game-overwatch2` and `game-candycrush` while
 * the catalog used `game-diablo`, `game-ow2` and `game-candy`, so those
 * players were never joined to their hub. The ids are now normalised AND the
 * derivation is explicit, so a future rename fails loudly here instead of
 * quietly dropping edges.
 */
export const HUB_ID_BY_FRANCHISE: Record<string, string> = {
  COD: "game-cod",
  WOW: "game-wow",
  DIABLO4: "game-diablo4",
  OVERWATCH2: "game-overwatch2",
  CANDYCRUSH: "game-candycrush",
};

export const FRANCHISE_COLORS: Record<string, string> = {
  COD: "#F59E0B",
  WOW: "#00F0FF",
  DIABLO4: "#FF334B",
  OVERWATCH2: "#38BDF8",
  CANDYCRUSH: "#EC4899",
};

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
  if (gamesCache) return gamesCache;
  const rows = await runRawGql(
    `SELECT game_id, title, franchise, genre, active_players, is_parent_hub,
            parent_game_id, release_date, lifecycle_status, monetization_model,
            current_season
     FROM Games ORDER BY game_id`
  );
  gamesCache = rows.map((r: any) => ({
    game_id: r.game_id,
    title: r.title,
    franchise: r.franchise,
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

export async function getOffers(): Promise<OfferRow[]> {
  if (offersCache) return offersCache;
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

/** Fetch the whole catalog in one round trip rather than three serial ones. */
export async function getCatalog(): Promise<{
  games: GameRow[];
  offers: OfferRow[];
  creators: CreatorRow[];
}> {
  const [games, offers, creators] = await Promise.all([
    getGames(),
    getOffers(),
    getCreators(),
  ]);
  return { games, offers, creators };
}

/** Test/ops hook: drop the memoised catalog after a reload. */
export function invalidateCatalogCache() {
  gamesCache = null;
  offersCache = null;
  creatorsCache = null;
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
 * a marketer asking for "WoW players" means everyone who plays WoW, and
 * restricting to `primary_franchise` would exclude exactly the cross-title
 * Battle.net accounts the whole story depends on.
 */
export async function getPlayersForView(opts: {
  franchise?: string;
  archetype?: string;
  limit?: number;
}) {
  const { franchise, archetype, limit = 450 } = opts;
  const where: string[] = [];

  if (franchise && franchise !== "ALL") {
    const f = franchise.replace(/'/g, "");
    where.push(`(primary_franchise = '${f}' OR '${f}' IN UNNEST(franchises_played))`);
  }
  if (archetype && archetype !== "ALL") {
    where.push(`primary_archetype = '${archetype.replace(/'/g, "")}'`);
  }

  const rows = await runRawGql(
    `SELECT ${PLAYER_COLUMNS} FROM Players
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY lifetime_spend_usd DESC
     LIMIT ${Math.max(1, Math.floor(limit))}`
  );
  return rows.map(mapPlayer);
}

export async function getPlayerById(playerId: string) {
  const rows = await runRawGql(
    `SELECT ${PLAYER_COLUMNS} FROM Players
     WHERE player_id = '${playerId.replace(/'/g, "")}' LIMIT 1`
  );
  return rows.length ? mapPlayer(rows[0]) : null;
}

/** Resolved platform identities for one player, via the HAS_IDENTITY edge. */
export async function getIdentitiesForPlayer(
  playerId: string
): Promise<IdentityRow[]> {
  const rows = await runRawGql(
    `GRAPH ABKPlayerGraph
     MATCH (p:Player)-[h:HAS_IDENTITY]->(i:Identity)
     WHERE p.player_id = '${playerId.replace(/'/g, "")}'
     RETURN i.identity_id AS identity_id, i.platform AS platform,
            i.platform_handle AS platform_handle,
            h.confidence_score AS confidence_score
     ORDER BY confidence_score DESC`
  );
  return rows.map((r: any) => ({
    identity_id: r.identity_id,
    platform: r.platform,
    platform_handle: r.platform_handle ?? null,
    confidence_score: num(r.confidence_score),
  }));
}

export { SpannerUnavailableError };
