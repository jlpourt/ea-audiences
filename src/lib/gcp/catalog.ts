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
import type { GameLabel } from "../types";

export interface GameRow {
  game_id: string;
  title: string;
  franchise: string;
  /** Take-Two publishing label: 2K | 2K_SPORTS | 2K_CORE | ROCKSTAR | ZYNGA. */
  label: GameLabel;
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
  /** 2K: Rec | Pro-Am | Comp. Rockstar: Casual | Competitive | Posse. Zynga: Alliance | Team | Crew. */
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
  // Rockstar Games
  GTAO: "game-gta-online",
  RDO: "game-red-dead-online",
  GTA6: "game-gta6",
  // Zynga
  WWF: "game-words-with-friends",
  MATCHFACTORY: "game-match-factory",
  TOONBLAST: "game-toon-blast",
  CSR2: "game-csr2",
  EMPIRES: "game-empires-puzzles",
  ZPOKER: "game-zynga-poker",
};

/** Franchise accents. Hex because they paint canvas / WebGL nodes. */
export const FRANCHISE_COLORS: Record<string, string> = {
  ALL: "#E4002B", // --twok-red
  NBA2K: "#E4002B", // --twok-red (NBA 2K27)
  NBA2K26: "#FF6B35", // NBA 2K26 Holdout / Veteran Bridge Amber-Orange
  NBA2KMOBILE: "#FF4D6D", // NBA 2K Mobile (2K red family)
  WWE2K: "#C8102E", // WWE 2K25 (2K red family)
  PGA2K: "#B3122E", // PGA TOUR 2K25 (2K red family)
  TOPSPIN: "#E8475F", // TopSpin 2K25 (2K red family)
  CIV7: "#A3001F", // Civilization VII (2K red family)
  BL4: "#FF5A36", // Borderlands 4 (2K red family)
  MAFIA: "#9E2A2B", // Mafia (2K red family)
  // Rockstar Games: --warn gold family
  GTAO: "#F5B400",
  RDO: "#C98A00",
  GTA6: "#FFD24D",
  // Zynga: --good green family
  WWF: "#2FD38A",
  MATCHFACTORY: "#5BE3A6",
  TOONBLAST: "#1FB57A",
  CSR2: "#14966A",
  EMPIRES: "#8BE9C0",
  ZPOKER: "#0F7F5A",
};

/** Label cluster colours (2K divisions share the 2K red family). */
export const LABEL_COLORS: Record<GameLabel, string> = {
  "2K": "#E4002B",
  "2K_SPORTS": "#C8102E",
  "2K_CORE": "#FF5A36",
  ROCKSTAR: "#F5B400",
  ZYNGA: "#2FD38A",
};

const VALID_LABELS: readonly GameLabel[] = [
  "2K",
  "2K_SPORTS",
  "2K_CORE",
  "ROCKSTAR",
  "ZYNGA",
];

function toLabel(v: any): GameLabel {
  return VALID_LABELS.includes(v) ? (v as GameLabel) : "2K";
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
export async function getGamesByLabel(label: GameLabel): Promise<GameRow[]> {
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
  /**
   * PRE_LAUNCH titles (GTA VI) have no PLAYS_GAME edges; their audience is the
   * players holding a WISHLISTED edge to the game.
   */
  wishlistedGameId?: string;
}) {
  const { franchise, archetype, limit = 1050, wishlistedGameId } = opts;
  const where: string[] = [];
  const params: Record<string, any> = {
    limit: Math.max(1, Math.floor(limit)),
  };

  if (wishlistedGameId) {
    where.push(
      `player_id IN (SELECT w.player_id FROM Wishlisted w WHERE w.game_id = @wishGame)`
    );
    params.wishGame = wishlistedGameId;
  } else if (franchise && franchise !== "ALL") {
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
     ORDER BY FARM_FINGERPRINT(player_id) ASC
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

/** Players by id (order not guaranteed). */
export async function getPlayersByIdList(ids: string[]) {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return [];
  const rows = await runRawGql(
    `SELECT ${PLAYER_COLUMNS} FROM Players WHERE player_id IN UNNEST(@ids)`,
    { ids: clean }
  );
  return rows.map(mapPlayer);
}

// ---------------------------------------------------------------------------
// Edge reads for the graph workspace (never cached). Every edge drawn on the
// canvas comes from one of these tables; nothing is synthesised.
// ---------------------------------------------------------------------------

export interface PlayEdgeRow {
  player_id: string;
  game_id: string;
  spend_usd: number;
  hours_played: number;
  acquired_via: string | null;
}

/** PLAYS_GAME edges (with per-title spend) for a set of players. */
export async function getPlayEdges(ids: string[]): Promise<PlayEdgeRow[]> {
  if (ids.length === 0) return [];
  const rows = await runRawGql(
    `SELECT player_id, game_id, spend_usd, hours_played, acquired_via
     FROM PlaysGame WHERE player_id IN UNNEST(@ids)`,
    { ids }
  );
  return rows.map((r: any) => ({
    player_id: r.player_id,
    game_id: r.game_id,
    spend_usd: num(r.spend_usd),
    hours_played: num(r.hours_played),
    acquired_via: r.acquired_via ?? null,
  }));
}

/** WISHLISTED edges (pre-launch intent) for a set of players. */
export async function getWishlistEdges(
  ids: string[]
): Promise<Array<{ player_id: string; game_id: string }>> {
  if (ids.length === 0) return [];
  const rows = await runRawGql(
    `SELECT player_id, game_id FROM Wishlisted WHERE player_id IN UNNEST(@ids)`,
    { ids }
  );
  return rows.map((r: any) => ({ player_id: r.player_id, game_id: r.game_id }));
}

export interface MembershipRow {
  player_id: string;
  clan_id: string;
  role: string | null;
}

/** Active MEMBER_OF_CLAN edges (crew + role) for a set of players. */
export async function getMemberships(ids: string[]): Promise<MembershipRow[]> {
  if (ids.length === 0) return [];
  const rows = await runRawGql(
    `SELECT player_id, clan_id, role FROM MemberOfClan
     WHERE player_id IN UNNEST(@ids) AND left_at IS NULL`,
    { ids }
  );
  return rows.map((r: any) => ({
    player_id: r.player_id,
    clan_id: r.clan_id,
    role: r.role ?? null,
  }));
}

/** Active members of the given crews. */
export async function getCrewMembers(
  crewIds: string[],
  limitPerCrew = 40
): Promise<MembershipRow[]> {
  if (crewIds.length === 0) return [];
  const rows = await runRawGql(
    `SELECT player_id, clan_id, role FROM MemberOfClan
     WHERE clan_id IN UNNEST(@crewIds) AND left_at IS NULL
     ORDER BY clan_id, FARM_FINGERPRINT(player_id)`,
    { crewIds }
  );
  // Spanner has no window functions; cap members per crew here.
  const perCrew = new Map<string, number>();
  return rows
    .filter((r: any) => {
      const n = perCrew.get(r.clan_id) || 0;
      perCrew.set(r.clan_id, n + 1);
      return n < limitPerCrew;
    })
    .map((r: any) => ({
      player_id: r.player_id,
      clan_id: r.clan_id,
      role: r.role ?? null,
    }));
}

export interface InviteRow {
  player_id: string;
  invitee_id: string;
  to_game_id: string;
  from_game_id: string | null;
  accepted: boolean;
}

/** INVITED edges where both inviter and invitee are in the given set. */
export async function getInvitesAmong(ids: string[]): Promise<InviteRow[]> {
  if (ids.length === 0) return [];
  const rows = await runRawGql(
    `SELECT player_id, invitee_id, to_game_id, from_game_id, accepted
     FROM Invited
     WHERE player_id IN UNNEST(@ids) AND invitee_id IN UNNEST(@ids)`,
    { ids }
  );
  return rows.map((r: any) => ({
    player_id: r.player_id,
    invitee_id: r.invitee_id,
    to_game_id: r.to_game_id,
    from_game_id: r.from_game_id ?? null,
    accepted: r.accepted === true,
  }));
}

export interface SocialEdgeRow {
  a: string;
  b: string;
  kind: "PLAYED_WITH" | "FRIENDS_WITH" | "INVITED";
  weight: number;
}

/**
 * Real 1-hop social neighbours (PLAYED_WITH, FRIENDS_WITH, INVITED; both
 * directions) of a frontier, excluding already-visited players. Ranked by
 * co-play intensity so the strongest ties are drawn first.
 */
export async function getSocialNeighbors(
  frontier: string[],
  exclude: string[],
  limit: number
): Promise<SocialEdgeRow[]> {
  if (frontier.length === 0) return [];
  const rows = await runRawGql(
    `SELECT a, b, kind, weight FROM (
       SELECT player_id AS a, other_player_id AS b, 'PLAYED_WITH' AS kind,
              CAST(IFNULL(games_together_30d, 0) AS FLOAT64) AS weight
       FROM PlayedWith WHERE player_id IN UNNEST(@f)
       UNION ALL
       SELECT other_player_id AS a, player_id AS b, 'PLAYED_WITH' AS kind,
              CAST(IFNULL(games_together_30d, 0) AS FLOAT64) AS weight
       FROM PlayedWith WHERE other_player_id IN UNNEST(@f)
       UNION ALL
       SELECT player_id AS a, other_player_id AS b, 'FRIENDS_WITH' AS kind, 0.5 AS weight
       FROM FriendsWith WHERE player_id IN UNNEST(@f)
       UNION ALL
       SELECT other_player_id AS a, player_id AS b, 'FRIENDS_WITH' AS kind, 0.5 AS weight
       FROM FriendsWith WHERE other_player_id IN UNNEST(@f)
       UNION ALL
       SELECT player_id AS a, invitee_id AS b, 'INVITED' AS kind, 1.0 AS weight
       FROM Invited WHERE player_id IN UNNEST(@f)
       UNION ALL
       SELECT invitee_id AS a, player_id AS b, 'INVITED' AS kind, 1.0 AS weight
       FROM Invited WHERE invitee_id IN UNNEST(@f))
     WHERE b NOT IN UNNEST(@x)
     ORDER BY weight DESC, FARM_FINGERPRINT(b)
     LIMIT @lim`,
    { f: frontier, x: exclude.length ? exclude : [""], lim: limit }
  );
  return rows.map((r: any) => ({
    a: r.a,
    b: r.b,
    kind: r.kind,
    weight: num(r.weight),
  }));
}

/** Archetype options for the graph filter, grouped by studio label, with live counts. */
export async function getArchetypeOptions(): Promise<
  Array<{ archetype: string; label: string; players: number }>
> {
  const rows = await runRawGql(
    `SELECT p.primary_archetype AS archetype, g.label AS label, COUNT(*) AS players
     FROM Players p
     JOIN (SELECT franchise, ANY_VALUE(label) AS label FROM Games GROUP BY franchise) g
       ON g.franchise = p.primary_franchise
     GROUP BY archetype, label
     ORDER BY players DESC`
  );
  return rows.map((r: any) => ({
    archetype: r.archetype,
    label: r.label,
    players: num(r.players),
  }));
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
