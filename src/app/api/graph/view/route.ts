import { NextRequest, NextResponse } from "next/server";
import { GraphNode, GraphLink, GameLabel } from "@/lib/types";
import { archetypeColor, archetypeLabel } from "@/lib/archetypes";
import {
  getGames,
  getOffers,
  getCreators,
  getClans,
  getPlayersForView,
  getPlayerById,
  getPlayersByIdList,
  getIdentitiesForPlayer,
  getPlayEdges,
  getWishlistEdges,
  getMemberships,
  getCrewMembers,
  getInvitesAmong,
  getSocialNeighbors,
  getArchetypeOptions,
  GRAPH_NAME,
  FRANCHISE_COLORS,
  LABEL_COLORS,
  SpannerUnavailableError,
  type GameRow,
  type OfferRow,
  type CreatorRow,
  type ClanRow,
  type PlayEdgeRow,
  type MembershipRow,
} from "@/lib/gcp/catalog";
import { getCrewMates } from "@/lib/gcp/spanner-client";
import {
  buildFranchiseIndex,
  studioForLabel,
  STUDIOS,
  STUDIO_COLORS,
  STUDIO_NAMES,
  type Studio,
} from "@/lib/studios";

export const dynamic = "force-dynamic";

/** Cap on drawn player nodes. A rendering budget, never an audience size. */
const RENDER_LIMIT = 1050;

const PLATFORM_COLORS: Record<string, string> = {
  "2K Account": "#E4002B",
  "Rockstar Games Social Club": "#F5B400",
  "Zynga Account": "#2FD38A",
  "PlayStation Network": "#0070D1",
  "Xbox Live": "#107C10",
  Steam: "#66C0F4",
  "Nintendo Switch 2": "#FF4D5E",
  "Google Play Games": "#34A853",
  "Apple Game Center": "#A1A1AA",
  Twitch: "#9146FF",
  YouTube: "#FF3B30",
  "NBA 2K Mobile ID": "#FF4D6D",
  "My2K Companion": "#F5B400",
};

/**
 * Studio sectors for the macro constellation. Angles are degrees on the
 * canvas (y grows downward, so -90 is the top). Hubs for every parent game in
 * Spanner `Games` are spread across their studio's sector, so a new title
 * appears without a code change.
 */
const STUDIO_SECTORS: Record<Studio, { angle: number; spread: number }> = {
  "2K": { angle: -90, spread: 150 },
  ROCKSTAR: { angle: 135, spread: 50 },
  ZYNGA: { angle: 45, spread: 70 },
};

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
}

function sectorAngles(studio: Studio, n: number, spreadScale = 1): number[] {
  const s = STUDIO_SECTORS[studio];
  if (n <= 1) return [s.angle];
  const spread = s.spread * spreadScale;
  return Array.from(
    { length: n },
    (_, i) => s.angle - spread / 2 + (spread * i) / (n - 1)
  );
}

function sanitizePlatformName(platform: string): string {
  if (PLATFORM_COLORS[platform]) return platform;
  const lower = platform.toLowerCase();
  if (lower.includes("rockstar") || lower.includes("social club")) {
    return "Rockstar Games Social Club";
  }
  if (lower.includes("zynga")) return "Zynga Account";
  if (lower.includes("google play")) return "Google Play Games";
  if (lower.includes("game center") || lower.includes("apple")) return "Apple Game Center";
  if (lower.includes("playstation") || lower.includes("psn") || lower.includes("ps5")) {
    return "PlayStation Network";
  }
  if (lower.includes("xbox")) return "Xbox Live";
  if (lower.includes("steam")) return "Steam";
  if (lower.includes("switch") || lower.includes("nintendo")) return "Nintendo Switch 2";
  if (lower.includes("companion") || lower.includes("my2k")) return "My2K Companion";
  return platform;
}

function formatOfferTitle(title: string, price: number): string {
  let clean = title
    .replace(/\s*\u2014\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length > 28) {
    clean = clean.substring(0, 26).trim() + "…";
  }
  return `${clean} ($${price})`;
}

function offerColor(o: OfferRow): string {
  const isMajor = (o.offer_type || "").includes("MAJOR_DLC") || o.price_usd >= 60;
  if (isMajor) return "#FFB800";
  if (o.price_usd >= 30) return "#A855F7";
  if (o.price_usd <= 5) return "#FF4757";
  return "#EC4899";
}

function offerSize(o: OfferRow): number {
  const isMajor = (o.offer_type || "").includes("MAJOR_DLC") || o.price_usd >= 60;
  return isMajor ? 32 : o.price_usd >= 30 ? 28 : 22;
}

function offerNode(o: OfferRow, fx?: number, fy?: number): GraphNode {
  return {
    id: o.offer_id,
    name: formatOfferTitle(o.offer_title, o.price_usd),
    type: "OFFER",
    franchise: o.target_franchise ?? undefined,
    spend: o.price_usd,
    val: offerSize(o),
    color: offerColor(o),
    offer_data: o,
    fx,
    fy,
  };
}

/** Crew tiers across studios, ordered from most to least competitive. */
function crewTierRank(tier?: string | null): number {
  switch (tier) {
    case "Comp":
    case "Competitive":
      return 0;
    case "Pro-Am":
    case "Posse":
    case "Alliance":
    case "Team":
    case "Crew":
      return 1;
    default:
      return 2; // Rec, Casual
  }
}

type FranchiseIndex = ReturnType<typeof buildFranchiseIndex<GameRow>>;

interface PlayerExtras {
  plays?: PlayEdgeRow[];
  wishlists?: string[];
  membership?: MembershipRow;
}

/** One PLAYER node, labelled from the live Games catalog. */
function playerNode(
  p: any,
  idx: FranchiseIndex,
  gameById: Map<string, GameRow>,
  extras: PlayerExtras = {}
): GraphNode {
  const spend: number = p.lifetime_spend_usd || 0;
  const label = idx.labelOf(p.primary_franchise) as GameLabel;
  const titleSpend: Record<string, number> = {};
  for (const e of extras.plays || []) {
    const g = gameById.get(e.game_id);
    if (!g) continue;
    titleSpend[g.franchise] = (titleSpend[g.franchise] || 0) + e.spend_usd;
  }
  const wishlisted = (extras.wishlists || [])
    .map((gid) => gameById.get(gid)?.franchise)
    .filter(Boolean) as string[];
  return {
    id: p.player_id,
    name: p.gamer_tag || p.display_name,
    type: "PLAYER",
    franchise: p.primary_franchise,
    label,
    studio: studioForLabel(label),
    archetype: p.primary_archetype,
    spend,
    churn_risk: p.churn_risk_score,
    tilt: p.tilt_sensitivity,
    loss_streak: p.recent_loss_streak,
    gravity_score:
      typeof p.game_telemetry?.gravity_score === "number"
        ? Number(p.game_telemetry.gravity_score)
        : undefined,
    game_telemetry: p.game_telemetry,
    purchased_items: p.purchased_items,
    followed_creators: p.followed_creators,
    primary_creator_influence: p.primary_creator_influence ?? undefined,
    franchises_played: p.franchises_played || [],
    title_spend: extras.plays ? titleSpend : undefined,
    wishlisted: extras.wishlists ? wishlisted : undefined,
    clan_id: extras.membership?.clan_id,
    crew_role: extras.membership?.role ?? undefined,
    country: p.country ?? undefined,
    country_code: p.country_code ?? undefined,
    country_flag: p.country_flag ?? undefined,
    dma_market: p.dma_market ?? undefined,
    lat: p.lat ?? undefined,
    lng: p.lng ?? undefined,
    val: spend >= 2500 ? 14 : spend >= 500 ? 9 : 6,
    color: archetypeColor(p.primary_archetype),
  };
}

function gameNode(
  g: GameRow,
  pos: { x: number; y: number },
  val: number
): GraphNode {
  const preLaunch = g.lifecycle_status === "PRE_LAUNCH";
  return {
    id: g.game_id,
    name: preLaunch ? `${g.title} (pre-launch)` : g.title,
    type: "GAME",
    franchise: g.franchise,
    label: g.label,
    studio: studioForLabel(g.label),
    lifecycle_status: g.lifecycle_status ?? undefined,
    current_season: g.current_season ?? undefined,
    val,
    color: FRANCHISE_COLORS[g.franchise] || LABEL_COLORS[g.label] || STUDIO_COLORS["2K"],
    fx: pos.x,
    fy: pos.y,
  };
}

function crewNode(c: ClanRow, idx: FranchiseIndex, pos?: { x: number; y: number }): GraphNode {
  const studio = idx.studioOf(c.franchise);
  return {
    id: c.clan_id,
    name: `${c.name} · ${c.tier || "Crew"}`,
    type: "CLAN",
    franchise: c.franchise,
    studio,
    rank_tier: c.tier || undefined,
    val: 24,
    color: STUDIO_COLORS[studio],
    ...(pos ? { fx: pos.x, fy: pos.y } : {}),
  };
}

function creatorNode(c: CreatorRow, idx: FranchiseIndex, pos?: { x: number; y: number }): GraphNode {
  return {
    id: c.creator_id,
    name: c.handle || c.name,
    type: "CREATOR",
    franchise: c.franchise ?? undefined,
    studio: idx.studioOf(c.franchise),
    platform: c.platform,
    creator_data: c,
    val: 24,
    color: "#00F0FF",
    ...(pos ? { fx: pos.x, fy: pos.y } : {}),
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export async function GET(request: NextRequest) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "audience-cohorts";
  const selectedPlayerId = searchParams.get("playerId");
  const hopFilterParam = searchParams.get("hop") || "all";
  const maxHopAllowed =
    hopFilterParam === "1" ? 1 : hopFilterParam === "2" ? 2 : 3;
  const gameFilter = searchParams.get("game") || "ALL";
  const archetypeFilter = searchParams.get("archetype") || "ALL";
  const isExpandOverlay = searchParams.get("expand") === "1";
  const customLimit = Number(searchParams.get("limit") || 0);
  const effectiveRenderLimit =
    customLimit >= 100 && customLimit <= 2000 ? customLimit : RENDER_LIMIT;

  try {
    const games = await getGames();
    const idx = buildFranchiseIndex(games);
    const gameById = new Map(games.map((g) => [g.game_id, g]));
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // ======================================================================
    // FILTER OPTIONS (data-driven from Spanner Games + Players)
    // ======================================================================
    if (view === "filters") {
      const archetypes = await getArchetypeOptions();
      const hubs = games.filter((g) => g.is_parent_hub);
      return NextResponse.json({
        games: hubs.map((g) => ({
          franchise: g.franchise,
          game_id: g.game_id,
          title: g.title,
          label: g.label,
          studio: studioForLabel(g.label),
          lifecycle_status: g.lifecycle_status,
        })),
        archetypes: archetypes.map((a) => ({
          archetype: a.archetype,
          name: archetypeLabel(a.archetype),
          studio: studioForLabel(a.label),
          players: a.players,
        })),
        studios: STUDIOS.map((s) => ({ id: s, name: STUDIO_NAMES[s] })),
        execution_ms: Date.now() - started,
      });
    }

    // ======================================================================
    // VIEW 0: SOCIAL HOPS — real PLAYED_WITH / FRIENDS_WITH / INVITED BFS
    // ======================================================================
    if (view === "social-hops") {
      let ego: any = null;
      if (selectedPlayerId) {
        ego = await getPlayerById(selectedPlayerId);
        if (!ego) {
          return NextResponse.json(
            { error: `Spanner Players: no player '${selectedPlayerId}' for social-hops view.` },
            { status: 404 }
          );
        }
      } else {
        const sample = await getPlayersForView({
          franchise: gameFilter,
          archetype: archetypeFilter,
          limit: 240,
        });
        const memberships = await getMemberships(sample.map((p) => p.player_id));
        const captainIds = new Set(
          memberships.filter((m) => m.role === "CAPTAIN").map((m) => m.player_id)
        );
        ego = sample.find((p) => captainIds.has(p.player_id)) || sample[0];
      }
      if (!ego) {
        return NextResponse.json(
          { error: "Spanner Players: no players match the current filter for social-hops view." },
          { status: 404 }
        );
      }

      const visited = new Set<string>([ego.player_id]);
      const hopOf = new Map<string, number>([[ego.player_id, 0]]);
      const hopEdges: Array<{ a: string; b: string; kind: string; weight: number; hop: number }> = [];
      const caps = [14, 28, 38];
      let frontier = [ego.player_id];
      for (let hop = 1; hop <= maxHopAllowed; hop++) {
        const rows = await getSocialNeighbors(frontier, Array.from(visited), caps[hop - 1] * 4);
        const next: string[] = [];
        for (const r of rows) {
          if (visited.has(r.b)) continue;
          visited.add(r.b);
          hopOf.set(r.b, hop);
          next.push(r.b);
          hopEdges.push({ ...r, hop });
          if (next.length >= caps[hop - 1]) break;
        }
        if (next.length === 0) break;
        frontier = next;
      }

      const others = await getPlayersByIdList(Array.from(visited).filter((id) => id !== ego.player_id));
      const byId = new Map<string, any>([[ego.player_id, ego], ...others.map((p) => [p.player_id, p] as [string, any])]);
      const ringCount = [1, 0, 0, 0];
      for (const h of Array.from(hopOf.values())) ringCount[h]++;
      const ringIdx = [0, 0, 0, 0];
      const ringRadius = [0, 185, 345, 505];
      const ringColor = ["#FFFFFF", "#2FD38A", "#9B72CB", "#F5B400"];

      for (const [id, hop] of Array.from(hopOf.entries())) {
        const p = byId.get(id);
        if (!p) continue;
        const i = ringIdx[hop]++;
        const pos = hop === 0 ? { x: 0, y: 0 } : polar((i / Math.max(1, ringCount[hop])) * 360 + hop * 7, ringRadius[hop]);
        const n = playerNode(p, idx, gameById);
        nodes.push({
          ...n,
          name: `${n.name} (${hop}°)`,
          val: hop === 0 ? 28 : hop === 1 ? 16 : hop === 2 ? 11 : 8,
          color: ringColor[hop],
          game_telemetry: {
            ...(p.game_telemetry || {}),
            social_hop_degree: hop,
          },
          fx: pos.x,
          fy: pos.y,
        });
      }
      for (const e of hopEdges) {
        links.push({
          source: e.a,
          target: e.b,
          label:
            e.kind === "PLAYED_WITH"
              ? `PLAYED_WITH (${Math.round(e.weight)} games, 30d)`
              : e.kind,
          value: e.hop === 1 ? 2.6 : e.hop === 2 ? 1.8 : 1.2,
          isMultiHopBridge: true,
          hopStep: e.hop,
        });
      }

      const hopIds = (h: number) =>
        Array.from(hopOf.entries()).filter(([, v]) => v === h).map(([k]) => k);
      const squadSpend = hopIds(1).reduce(
        (s, id) => s + Number(byId.get(id)?.lifetime_spend_usd || 0),
        0
      );
      return NextResponse.json({
        nodes,
        links,
        is_live: true,
        graph: GRAPH_NAME,
        social_hop_summary: {
          ego_player_id: ego.player_id,
          ego_gamer_tag: ego.gamer_tag,
          hop1_count: hopIds(1).length,
          hop2_count: hopIds(2).length,
          hop3_count: hopIds(3).length,
          total_network_reach: hopOf.size,
          squad_spend_usd: Math.round(squadSpend),
          edge_kinds: Array.from(new Set(hopEdges.map((e) => e.kind))),
        },
        execution_ms: Date.now() - started,
      });
    }

    // ======================================================================
    // VIEW 1: SINGLE PLAYER 2-HOP IDENTITY & CREW RESOLUTION
    // ======================================================================
    if (view === "single-identity") {
      const player = selectedPlayerId
        ? await getPlayerById(selectedPlayerId)
        : (await getPlayersForView({ limit: 1 }))[0];

      if (!player) {
        return NextResponse.json(
          { error: `Spanner Players: no player found for id '${selectedPlayerId ?? "(default)"}'.` },
          { status: 404 }
        );
      }

      const [identities, crewMates, plays, wish, memberships, clans] = await Promise.all([
        getIdentitiesForPlayer(player.player_id),
        getCrewMates([player.player_id]),
        getPlayEdges([player.player_id]),
        getWishlistEdges([player.player_id]),
        getMemberships([player.player_id]),
        getClans(),
      ]);

      nodes.push({
        ...playerNode(player, idx, gameById, {
          plays,
          wishlists: wish.map((w) => w.game_id),
          membership: memberships[0],
        }),
        val: 28,
        color: "#00F0FF",
        ...(isExpandOverlay ? {} : { fx: 0, fy: 0 }),
      });

      identities.forEach((ident, i) => {
        const cleanPlatform = sanitizePlatformName(ident.platform);
        const pos = polar((i / Math.max(1, identities.length)) * 360, 200);
        nodes.push({
          id: ident.identity_id,
          name: `${cleanPlatform}: ${ident.platform_handle ?? "N/A"}`,
          type: "IDENTITY",
          platform: cleanPlatform,
          confidence: ident.confidence_score,
          val: 15,
          color: PLATFORM_COLORS[cleanPlatform] || "#A855F7",
          ...(isExpandOverlay ? {} : { fx: pos.x, fy: pos.y }),
        });
        links.push({
          source: player.player_id,
          target: ident.identity_id,
          label: `HAS_IDENTITY (${(ident.confidence_score * 100).toFixed(0)}%)`,
          value: 2.5,
          isMultiHopBridge: true,
          hopStep: 1,
        });
      });

      const titleEdges = [
        ...plays.map((e) => ({ game_id: e.game_id, kind: "PLAYS_GAME" as const, e })),
        ...wish.map((w) => ({ game_id: w.game_id, kind: "WISHLISTED" as const, e: null })),
      ];
      titleEdges.forEach((t, i) => {
        const g = gameById.get(t.game_id);
        if (!g) return;
        const pos = polar(((i + 0.5) / Math.max(1, titleEdges.length)) * 360, 330);
        nodes.push({
          ...gameNode(g, pos, 22),
          hours: t.e?.hours_played,
          ...(isExpandOverlay ? { fx: undefined, fy: undefined } : {}),
        });
        links.push({
          source: player.player_id,
          target: g.game_id,
          label:
            t.kind === "WISHLISTED"
              ? "WISHLISTED"
              : `PLAYS_GAME (${Math.round(t.e!.hours_played)}h · $${Math.round(t.e!.spend_usd)})`,
          value: 2,
          isMultiHopBridge: g.franchise !== player.primary_franchise,
          hopStep: 2,
        });
      });

      const membership = memberships[0];
      if (membership) {
        const crew = clans.find((c) => c.clan_id === membership.clan_id);
        if (crew) {
          nodes.push({
            ...crewNode(crew, idx),
            ...(isExpandOverlay ? {} : { fx: -280, fy: -220 }),
          });
          links.push({
            source: player.player_id,
            target: crew.clan_id,
            label: `MEMBER_OF_CLAN (${membership.role || "MEMBER"})`,
            value: 2.4,
            isMultiHopBridge: true,
            hopStep: 1,
          });
          crewMates
            .filter((m) => m.clan_id === crew.clan_id)
            .slice(0, 8)
            .forEach((m, i) => {
              nodes.push({
                id: m.mate_id,
                name: m.mate_ovr !== null ? `${m.mate_tag} (${m.mate_ovr} OVR)` : m.mate_tag,
                type: "SQUADMATE",
                franchise: crew.franchise,
                studio: idx.studioOf(crew.franchise),
                val: 12,
                color: STUDIO_COLORS[idx.studioOf(crew.franchise)],
                ...(isExpandOverlay ? {} : { fx: -410 - (i % 2) * 75, fy: -270 + i * 52 }),
              });
              links.push({
                source: crew.clan_id,
                target: m.mate_id,
                label: `MEMBER_OF_CLAN · active ${m.mate_last_login_days_ago}d ago`,
                value: 1.8,
                isMultiHopBridge: true,
                hopStep: 2,
              });
            });
        }
      }

      return NextResponse.json({
        nodes,
        links,
        is_live: true,
        graph: GRAPH_NAME,
        execution_ms: Date.now() - started,
      });
    }

    const [offers, creators, clans] = await Promise.all([
      getOffers(),
      getCreators(),
      getClans(),
    ]);

    // ======================================================================
    // VIEW 2: CREWS — real MEMBER_OF_CLAN rosters across all studios
    // ======================================================================
    if (view === "social-clans" || view === "crews") {
      const topCrews: ClanRow[] =
        gameFilter === "ALL"
          ? STUDIOS.flatMap((s) =>
              clans.filter((c) => idx.studioOf(c.franchise) === s).slice(0, 7)
            )
          : clans.filter((c) => c.franchise === gameFilter).slice(0, 20);

      topCrews.forEach((c, i) => {
        const angle = (i / Math.max(1, topCrews.length)) * 360 - 90;
        const radius = [210, 330, 445][crewTierRank(c.tier)];
        nodes.push({ ...crewNode(c, idx, polar(angle, radius)), val: 26 });
      });

      const members = await getCrewMembers(topCrews.map((c) => c.clan_id), 36);
      const memberPlayers = await getPlayersByIdList(members.map((m) => m.player_id));
      const playerById = new Map(memberPlayers.map((p) => [p.player_id, p]));
      const drawnCreators = new Map<string, CreatorRow>();
      const creatorById = new Map(creators.map((c) => [c.creator_id, c]));

      for (const m of members) {
        const p = playerById.get(m.player_id);
        if (!p) continue;
        if (archetypeFilter !== "ALL" && p.primary_archetype !== archetypeFilter) continue;
        if (!nodes.some((n) => n.id === p.player_id)) {
          nodes.push(playerNode(p, idx, gameById, { membership: m }));
        }
        links.push({
          source: p.player_id,
          target: m.clan_id,
          label: `MEMBER_OF_CLAN (${m.role || "MEMBER"})`,
          value: 2,
        });
        for (const cid of p.followed_creators || []) {
          const cr = creatorById.get(cid);
          if (!cr) continue;
          if (!drawnCreators.has(cid) && drawnCreators.size >= 6) continue;
          drawnCreators.set(cid, cr);
          links.push({ source: p.player_id, target: cid, label: "FOLLOWS_CREATOR", value: 1.4 });
        }
      }
      Array.from(drawnCreators.values()).forEach((cr, i, arr) => {
        nodes.push(creatorNode(cr, idx, polar((i / Math.max(1, arr.length)) * 360 - 60, 640)));
      });

      return NextResponse.json({
        nodes,
        links,
        is_live: true,
        graph: GRAPH_NAME,
        execution_ms: Date.now() - started,
      });
    }

    // ======================================================================
    // VIEW 3: COHORT CONSTELLATION (macro = every studio; or one title)
    // ======================================================================
    const filterHub = gameFilter === "ALL" ? null : idx.hubByFranchise.get(gameFilter);
    if (gameFilter !== "ALL" && !filterHub) {
      return NextResponse.json(
        {
          error: `Spanner Games: franchise '${gameFilter}' has no row in ${GRAPH_NAME} Games.`,
          error_kind: "UNKNOWN_FRANCHISE",
        },
        { status: 400 }
      );
    }
    const isPreLaunchFilter = filterHub?.lifecycle_status === "PRE_LAUNCH";

    const players = await getPlayersForView({
      franchise: gameFilter,
      archetype: archetypeFilter,
      limit: effectiveRenderLimit,
      wishlistedGameId: isPreLaunchFilter ? filterHub!.game_id : undefined,
    });
    const ids = players.map((p) => p.player_id);
    const [plays, wishes, memberships, invites] = await Promise.all([
      getPlayEdges(ids),
      getWishlistEdges(ids),
      getMemberships(ids),
      getInvitesAmong(ids),
    ]);
    const playsBy = groupBy(plays, (r) => r.player_id);
    const wishBy = groupBy(wishes, (r) => r.player_id);
    const memberBy = new Map(memberships.map((m) => [m.player_id, m]));

    const drawnPerimeter: GraphNode[] = [];

    if (gameFilter === "ALL") {
      // Every parent hub in Spanner Games, grouped into its studio sector.
      const sampleCount = new Map<string, number>();
      for (const p of players) {
        sampleCount.set(p.primary_franchise, (sampleCount.get(p.primary_franchise) || 0) + 1);
      }
      for (const studio of STUDIOS) {
        // Largest hub (by sampled players) in the middle of the sector, the
        // rest alternating outward.
        const sorted = games
          .filter((g) => g.is_parent_hub && studioForLabel(g.label) === studio)
          .sort((a, b) => (sampleCount.get(b.franchise) || 0) - (sampleCount.get(a.franchise) || 0));
        const hubs: GameRow[] = new Array(sorted.length);
        const center = (sorted.length - 1) / 2;
        const slots = Array.from({ length: sorted.length }, (_, i) => i).sort(
          (a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b
        );
        sorted.forEach((g, k) => {
          hubs[slots[k]] = g;
        });
        const mid = slots[0] ?? 0;
        const angles = sectorAngles(studio, hubs.length);
        hubs.forEach((g, i) => {
          const r = hubs.length > 4 && Math.abs(i - mid) % 2 === 1 ? 450 : 340;
          const n = sampleCount.get(g.franchise) || 0;
          nodes.push(gameNode(g, polar(angles[i], r), Math.min(46, 26 + Math.sqrt(n) * 1.6)));
        });

        // Perimeter anchors for this studio: top crews, creators and offers.
        const crews = clans.filter((c) => idx.studioOf(c.franchise) === studio).slice(0, 2);
        const studioCreators = creators.filter((c) => idx.studioOf(c.franchise) === studio).slice(0, 3);
        const studioOffers = offers.filter((o) => idx.studioOf(o.target_franchise) === studio).slice(0, 3);
        const anchors: GraphNode[] = [
          ...crews.map((c) => crewNode(c, idx)),
          ...studioCreators.map((c) => creatorNode(c, idx)),
          ...studioOffers.map((o) => offerNode(o)),
        ];
        const aAngles = sectorAngles(studio, anchors.length, 1.25);
        anchors.forEach((a, i) => {
          const pos = polar(aAngles[i], 640);
          drawnPerimeter.push({ ...a, fx: pos.x, fy: pos.y });
        });
      }
    } else {
      const hub = filterHub!;
      nodes.push(gameNode(hub, { x: 0, y: -30 }, 42));
      const surfaces = games.filter(
        (g) => g.franchise === gameFilter && g.game_id !== hub.game_id
      );
      surfaces.forEach((g, i) => {
        const angle = (i / Math.max(1, surfaces.length)) * 180 + 45;
        const pos = polar(angle, 190);
        nodes.push(gameNode(g, { x: pos.x, y: pos.y + 50 }, 28));
      });
      const anchors: GraphNode[] = [
        ...clans.filter((c) => c.franchise === gameFilter).slice(0, 3).map((c) => crewNode(c, idx)),
        ...creators.filter((c) => c.franchise === gameFilter).slice(0, 2).map((c) => creatorNode(c, idx)),
        ...offers.filter((o) => o.target_franchise === gameFilter).slice(0, 5).map((o) => offerNode(o)),
      ];
      anchors.forEach((a, i) => {
        const pos = polar((i / Math.max(1, anchors.length)) * 360 - 90, 480);
        drawnPerimeter.push({ ...a, fx: pos.x, fy: pos.y });
      });
    }
    nodes.push(...drawnPerimeter);

    const drawnIds = new Set(nodes.map((n) => n.id));
    const hubIdOf = (franchise?: string | null) =>
      franchise ? idx.hubByFranchise.get(franchise)?.game_id : undefined;
    const offerNodes = drawnPerimeter.filter((n) => n.type === "OFFER");
    const isCrossView = view === "cross-franchise";

    players.forEach((p: any, i: number) => {
      const myPlays = playsBy.get(p.player_id) || [];
      const myWish = (wishBy.get(p.player_id) || []).map((w) => w.game_id);
      const membership = memberBy.get(p.player_id);
      const node = playerNode(p, idx, gameById, {
        plays: myPlays,
        wishlists: myWish,
        membership,
      });
      nodes.push(node);

      // EDGE 1: primary title (PLAYS_GAME), or WISHLISTED for a pre-launch filter.
      if (gameFilter === "ALL") {
        const hubId = hubIdOf(p.primary_franchise);
        if (hubId && drawnIds.has(hubId)) {
          links.push({ source: p.player_id, target: hubId, label: "PLAYS_GAME", value: 2 });
        }
      } else {
        links.push({
          source: p.player_id,
          target: filterHub!.game_id,
          label: isPreLaunchFilter ? "WISHLISTED" : "PLAYS_GAME",
          value: 2,
        });
      }

      // EDGE 2 (macro only): strongest real cross-title PLAYS_GAME edge,
      // preferring a title from another studio.
      if (gameFilter === "ALL") {
        const myStudio = node.studio;
        const candidates = myPlays
          .map((e) => ({ e, g: gameById.get(e.game_id) }))
          .filter(
            (c) =>
              c.g &&
              c.g.franchise !== p.primary_franchise &&
              drawnIds.has(hubIdOf(c.g.franchise) || "")
          )
          .sort((a, b) => {
            const aCross = studioForLabel(a.g!.label) !== myStudio ? 1 : 0;
            const bCross = studioForLabel(b.g!.label) !== myStudio ? 1 : 0;
            return bCross - aCross || b.e.spend_usd - a.e.spend_usd || b.e.hours_played - a.e.hours_played;
          });
        const best = candidates[0];
        if (best) {
          const crossStudio = studioForLabel(best.g!.label) !== myStudio;
          links.push({
            source: p.player_id,
            target: hubIdOf(best.g!.franchise)!,
            label: crossStudio ? "CROSS_STUDIO_PLAY" : "CROSS_FRANCHISE_PLAY",
            value: 1,
            isMultiHopBridge: isCrossView && i % 4 === 0,
            hopStep: isCrossView ? 2 : undefined,
          });
        }

        // EDGE 3: WISHLISTED intent for a pre-launch title (GTA VI).
        for (const gid of myWish) {
          if (drawnIds.has(gid)) {
            links.push({ source: p.player_id, target: gid, label: "WISHLISTED", value: 1 });
          }
        }
      }

      // EDGE 4: real crew membership when the crew is drawn.
      if (membership && drawnIds.has(membership.clan_id)) {
        links.push({
          source: p.player_id,
          target: membership.clan_id,
          label: "MEMBER_OF_CLAN",
          value: 1.6,
        });
      }

      // EDGE 5: real creator follow when the creator is drawn.
      const followed = [p.primary_creator_influence, ...(p.followed_creators || [])].find(
        (cid: string | null | undefined) => cid && drawnIds.has(cid)
      );
      if (followed) {
        links.push({ source: p.player_id, target: followed, label: "FOLLOWS_CREATOR", value: 1.5 });
      }

      // EDGE 6: owned SKU (purchased_items.offer_id) when the offer is drawn.
      if (offerNodes.length > 0) {
        const ownedIds = new Set<string>(
          (p.purchased_items || []).map((it: any) => it?.offer_id).filter(Boolean)
        );
        const owned = offerNodes
          .filter((off) => ownedIds.has(off.id))
          .sort((a, b) => (b.spend || 0) - (a.spend || 0))[0];
        if (owned) {
          links.push({ source: p.player_id, target: owned.id, label: "OWNS_SKU", value: 2 });
        }
      }
    });

    // EDGE 7: INVITED between players that are both on the canvas.
    for (const inv of invites) {
      const toGame = gameById.get(inv.to_game_id);
      links.push({
        source: inv.player_id,
        target: inv.invitee_id,
        label: `INVITED → ${toGame?.title || inv.to_game_id}${inv.accepted ? " (accepted)" : ""}`,
        value: 1.4,
        isTriggerStream: inv.accepted,
      });
    }

    return NextResponse.json({
      nodes,
      links,
      is_live: true,
      graph: GRAPH_NAME,
      is_sampled: players.length >= effectiveRenderLimit,
      execution_ms: Date.now() - started,
    });
  } catch (error: any) {
    if (error instanceof SpannerUnavailableError) {
      console.error("[graph/view] Spanner unavailable:", error.message);
      return NextResponse.json(
        {
          error: `Cloud Spanner ${process.env.SPANNER_INSTANCE_ID || ""}/${process.env.SPANNER_DATABASE_ID || ""}: ${error.message}`,
          error_kind: "SPANNER_UNAVAILABLE",
          is_live: false,
        },
        { status: 503 }
      );
    }
    console.error("[graph/view] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? String(error), error_kind: "INTERNAL" },
      { status: 500 }
    );
  }
}
