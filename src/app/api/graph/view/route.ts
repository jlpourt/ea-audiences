import { NextRequest, NextResponse } from "next/server";
import { GraphData, GraphNode, GraphLink, TakeTwoLabel } from "@/lib/types";
import { archetypeColor } from "@/lib/archetypes";
import {
  getCatalog,
  getGames,
  getOffers,
  getCreators,
  getClans,
  getPlayersForView,
  getPlayerById,
  getIdentitiesForPlayer,
  GRAPH_NAME,
  HUB_ID_BY_FRANCHISE,
  FRANCHISE_COLORS,
  LABEL_COLORS,
  SpannerUnavailableError,
  type OfferRow,
  type CreatorRow,
  type ClanRow,
} from "@/lib/gcp/catalog";
import { getCrewMates, getCrossLabelBridges } from "@/lib/gcp/spanner-client";

export const dynamic = "force-dynamic";

/** Cap on drawn player nodes. A rendering budget, never an audience size. */
const RENDER_LIMIT = 780;

const PLATFORM_COLORS: Record<string, string> = {
  "2K Account": "#E4002B",
  "PlayStation Network": "#0070D1",
  "Xbox Live": "#107C10",
  Steam: "#9146FF",
  "Nintendo Switch 2": "#FF4D5E",
  "NBA 2K Mobile ID": "#00D2FF",
  "My2K Companion": "#F5B400",
};

/**
 * 5 Pinned Core 2K Hubs (Pure-2K Stellar Constellation)
 * Arranged with generous radial separation so player clusters never collide.
 */
const MACRO_HUB_POSITIONS: Record<
  string,
  {
    fx: number;
    fy: number;
    fz: number;
    title: string;
    franchise: string;
    label: TakeTwoLabel;
    color: string;
    val: number;
  }
> = {
  "game-nba2k27": {
    fx: 0,
    fy: -320,
    fz: 0,
    title: "NBA 2K27",
    franchise: "NBA2K",
    label: "2K",
    color: "#E4002B",
    val: 46,
  },
  "game-nba2k26": {
    fx: -420,
    fy: -140,
    fz: 90,
    title: "NBA 2K26",
    franchise: "NBA2K26",
    label: "2K",
    color: "#FF6B35",
    val: 38,
  },
  "game-nba2k-mobile": {
    fx: 420,
    fy: -140,
    fz: -90,
    title: "NBA 2K Mobile",
    franchise: "NBA2KMOBILE",
    label: "2K",
    color: "#00D2FF",
    val: 38,
  },
  "game-wwe2k25": {
    fx: -340,
    fy: 240,
    fz: -110,
    title: "WWE 2K25 & PGA TOUR 2K25",
    franchise: "WWE2K",
    label: "2K_SPORTS",
    color: "#F5B400",
    val: 38,
  },
  "game-bl4": {
    fx: 340,
    fy: 240,
    fz: 110,
    title: "Borderlands 4 & Civilization VII",
    franchise: "BL4",
    label: "2K_CORE",
    color: "#10B981",
    val: 38,
  },
};

/**
 * Outer Pinned Social Creators & Crews anchoring the perimeter quadrants
 * Coordinates strictly in the outer ring (±610..680, ±30..360) for zero collision.
 */
const MACRO_CREATOR_ANCHORS: {
  id: string;
  name: string;
  franchise: string;
  color: string;
  fx: number;
  fy: number;
}[] = [
  { id: "creator-agent00", name: "Agent 00", franchise: "NBA2K", color: "#00F0FF", fx: -610, fy: -340 },
  { id: "creator-troydan", name: "Troydan", franchise: "NBA2K", color: "#00F0FF", fx: 610, fy: -340 },
  { id: "creator-kot4q", name: "KOT4Q", franchise: "NBA2K26", color: "#00F0FF", fx: -670, fy: -190 },
  { id: "creator-cashnasty", name: "CashNasty", franchise: "NBA2KMOBILE", color: "#00F0FF", fx: 670, fy: -190 },
  { id: "creator-dbg", name: "DBG", franchise: "WWE2K", color: "#00F0FF", fx: -630, fy: 340 },
  { id: "creator-moxsy", name: "Moxsy", franchise: "BL4", color: "#00F0FF", fx: 630, fy: 340 },
];

const MACRO_CREW_COORDS: { fx: number; fy: number; franchise: string }[] = [
  { fx: -660, fy: -40, franchise: "NBA2K26" },
  { fx: 660, fy: -40, franchise: "NBA2KMOBILE" },
  { fx: -680, fy: 110, franchise: "NBA2K" },
  { fx: 680, fy: 110, franchise: "NBA2K" },
  { fx: -620, fy: 230, franchise: "WWE2K" },
  { fx: 620, fy: 230, franchise: "BL4" },
];

/**
 * Top 5 Flagship Offer Anchor Offsets
 */
const MACRO_OFFER_OFFSETS: { dx: number; dy: number; franchise: string }[] = [
  { dx: -220, dy: -290, franchise: "NBA2K26" },
  { dx: 220, dy: -290, franchise: "NBA2K" },
  { dx: -560, dy: 40, franchise: "WWE2K" },
  { dx: 560, dy: 40, franchise: "NBA2KMOBILE" },
  { dx: 0, dy: 390, franchise: "BL4" },
];

/**
 * Map any 2K franchise to one of the 5 Pinned Macro Constellation Hubs when `franchise === "ALL"`.
 * - WWE2K, PGA2K, TOPSPIN -> game-wwe2k25 (South-West 2K Sports hub)
 * - BL4, CIV7, MAFIA -> game-bl4 (South-East 2K Core hub)
 * - NBA2K26 -> game-nba2k26 (West 2K26 migration/holdout hub)
 * - NBA2KMOBILE -> game-nba2k-mobile (East Mobile & MyTEAM companion hub)
 * - NBA2K -> game-nba2k27 (North Apex Flagship hub)
 */
function mapFranchiseToMacroHub(franchise?: string | null): string {
  switch (franchise) {
    case "NBA2K":
      return "game-nba2k27";
    case "NBA2K26":
      return "game-nba2k26";
    case "NBA2KMOBILE":
      return "game-nba2k-mobile";
    case "WWE2K":
    case "PGA2K":
    case "TOPSPIN":
      return "game-wwe2k25";
    case "BL4":
    case "CIV7":
    case "MAFIA":
      return "game-bl4";
    default:
      return "game-nba2k27";
  }
}

function resolvePrimaryMacroHubForPlayer(p: any): string {
  if (
    p.primary_franchise === "NBA2KMOBILE" ||
    p.primary_archetype === "MOBILE_DAILY_RITUALIST"
  ) {
    return "game-nba2k-mobile";
  }
  if (
    p.primary_franchise === "NBA2K26" ||
    (p.primary_franchise === "NBA2K" &&
      p.game_telemetry?.nba2k26_veteran &&
      p.game_telemetry?.migrated_to_2k27 === false)
  ) {
    return "game-nba2k26";
  }
  return mapFranchiseToMacroHub(p.primary_franchise);
}

function to2KDivisionLabel(franchise?: string | null): TakeTwoLabel {
  if (franchise === "WWE2K" || franchise === "PGA2K" || franchise === "TOPSPIN") {
    return "2K_SPORTS";
  }
  if (franchise === "BL4" || franchise === "CIV7" || franchise === "MAFIA") {
    return "2K_CORE";
  }
  return "2K";
}

const VALID_2K_FRANCHISES = new Set<string>([
  "NBA2K",
  "NBA2K26",
  "NBA2KMOBILE",
  "WWE2K",
  "PGA2K",
  "TOPSPIN",
  "BL4",
  "CIV7",
  "MAFIA",
]);

function sanitizePlatformName(platform: string): string {
  const lower = platform.toLowerCase();
  if (lower.includes("playstation") || lower.includes("psn") || lower.includes("ps5")) {
    return "PlayStation Network";
  }
  if (lower.includes("xbox")) return "Xbox Live";
  if (lower.includes("steam") || lower.includes("pc")) return "Steam";
  if (lower.includes("switch") || lower.includes("nintendo")) return "Nintendo Switch 2";
  if (lower.includes("mobile")) return "NBA 2K Mobile ID";
  if (lower.includes("companion") || lower.includes("my2k")) return "My2K Companion";
  return "2K Account";
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
    franchise: o.target_franchise ?? "NBA2K",
    spend: o.price_usd,
    val: offerSize(o),
    color: offerColor(o),
    offer_data: o,
    fx,
    fy,
  };
}

export async function GET(request: NextRequest) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "audience-cohorts";
  const selectedPlayerId = searchParams.get("playerId");
  const hopFilterParam = searchParams.get("hop") || "all";
  const maxHopAllowed =
    hopFilterParam === "1"
      ? 1
      : hopFilterParam === "2"
      ? 2
      : hopFilterParam === "3"
      ? 3
      : 3;
  const gameFilter = searchParams.get("game") || "ALL";
  const archetypeFilter = searchParams.get("archetype") || "ALL";
  const isExpandOverlay = searchParams.get("expand") === "1";
  const customLimit = Number(searchParams.get("limit") || 0);
  const effectiveRenderLimit =
    customLimit >= 100 && customLimit <= 1400 ? customLimit : RENDER_LIMIT;

  try {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // ======================================================================
    // VIEW 0: INTERPERSONAL CO-PLAY & 1st / 2nd / 3rd HOP SOCIAL GRAPH
    // ======================================================================
    if (view === "social-hops") {
      const socialPlayers = await getPlayersForView({
        franchise: gameFilter,
        archetype: archetypeFilter,
        limit: 240,
      });

      const egoPlayer = selectedPlayerId
        ? (await getPlayerById(selectedPlayerId)) || socialPlayers[0]
        : socialPlayers.find(
            (p) =>
              p.primary_archetype === "REC_CREW_CAPTAIN" ||
              p.game_telemetry?.crew_role === "CAPTAIN"
          ) || socialPlayers[0];

      if (!egoPlayer) {
        return NextResponse.json(
          { error: "No players found in Spanner for social-hops view." },
          { status: 404 }
        );
      }

      const crewMates = await getCrewMates([egoPlayer.player_id]);
      const usedIds = new Set<string>([egoPlayer.player_id]);

      // 0° Center Ego / Anchor Captain Node
      nodes.push({
        id: egoPlayer.player_id,
        name: `${egoPlayer.gamer_tag || egoPlayer.display_name} (0° Seed)`,
        type: "PLAYER",
        franchise: egoPlayer.primary_franchise,
        label: to2KDivisionLabel(egoPlayer.primary_franchise),
        archetype: egoPlayer.primary_archetype,
        spend: egoPlayer.lifetime_spend_usd,
        churn_risk: egoPlayer.churn_risk_score,
        tilt: egoPlayer.tilt_sensitivity,
        loss_streak: egoPlayer.recent_loss_streak,
        gravity_score: Number(egoPlayer.game_telemetry?.gravity_score ?? 0.88),
        game_telemetry: {
          ...egoPlayer.game_telemetry,
          social_hop_degree: 0,
          social_hop_label: "0° Ego Seed / Crew Anchor",
          interpersonal_role: "Keystone Squad Anchor",
          monetization_play: "Seed Captain Co-Op Multiplier",
        },
        purchased_items: egoPlayer.purchased_items,
        followed_creators: egoPlayer.followed_creators,
        primary_creator_influence: egoPlayer.primary_creator_influence ?? undefined,
        val: 28,
        color: "#4285F4",
        fx: 0,
        fy: 0,
      });

      // Build 1st Hop (1° Direct Co-Play Squadmates — Same Crew / Direct Rec Co-Play)
      const hop1Players = socialPlayers
        .filter((p) => {
          if (usedIds.has(p.player_id)) return false;
          const isDirectMate = crewMates.some((m) => m.mate_id === p.player_id);
          const sameCrew =
            egoPlayer.game_telemetry?.crew_id &&
            p.game_telemetry?.crew_id === egoPlayer.game_telemetry?.crew_id;
          return isDirectMate || sameCrew;
        })
        .slice(0, 14);

      // Supplement up to 12 1st-hop co-play squadmates if needed from active Rec players
      if (hop1Players.length < 12) {
        for (const p of socialPlayers) {
          if (usedIds.has(p.player_id) || hop1Players.some((h) => h.player_id === p.player_id)) {
            continue;
          }
          hop1Players.push(p);
          if (hop1Players.length >= 12) break;
        }
      }

      hop1Players.forEach((p, idx) => {
        usedIds.add(p.player_id);
        const angle = (idx / Math.max(1, hop1Players.length)) * Math.PI * 2;
        const r = 185;
        const coplayGames = 14 + ((idx * 5) % 24);
        nodes.push({
          id: p.player_id,
          name: `${p.gamer_tag || p.display_name} (1°)`,
          type: "PLAYER",
          franchise: p.primary_franchise,
          label: to2KDivisionLabel(p.primary_franchise),
          archetype: p.primary_archetype,
          spend: p.lifetime_spend_usd,
          churn_risk: p.churn_risk_score,
          tilt: p.tilt_sensitivity,
          loss_streak: p.recent_loss_streak,
          gravity_score: Number(p.game_telemetry?.gravity_score ?? 0.65),
          game_telemetry: {
            ...p.game_telemetry,
            social_hop_degree: 1,
            social_hop_label: "1° Direct Co-Play Squadmate",
            coplay_games_30d: coplayGames,
            interpersonal_role:
              idx % 3 === 0
                ? "Pick & Roll Duo Partner"
                : idx % 3 === 1
                ? "Rec 5v5 Starting Wing"
                : "Park 3v3 Co-Op Anchor",
            monetization_play: "1° Altruistic Squad Gifting & Co-Op Bundle ($9.99)",
          },
          purchased_items: p.purchased_items,
          followed_creators: p.followed_creators,
          primary_creator_influence: p.primary_creator_influence ?? undefined,
          val: 16,
          color: "#19C37D",
          fx: Math.round(Math.cos(angle) * r),
          fy: Math.round(Math.sin(angle) * r),
        });

        links.push({
          source: egoPlayer.player_id,
          target: p.player_id,
          label: `1° PLAYED_WITH (${coplayGames} games)`,
          value: 2.6,
          isMultiHopBridge: true,
          hopStep: 1,
          isTriggerStream: idx % 3 === 0,
        });

        // Triadic closure edges between 1st-hop squadmates who also play together
        if (idx > 0 && idx % 2 === 0) {
          links.push({
            source: hop1Players[idx - 1].player_id,
            target: p.player_id,
            label: "1° SQUAD_TRIAD",
            value: 1.4,
            hopStep: 1,
          });
        }
      });

      // Build 2nd Hop (2° Friends-of-Squad / Cross-Crew Rivals)
      const hop2Players: any[] = [];
      if (maxHopAllowed >= 2) {
        for (const p of socialPlayers) {
          if (usedIds.has(p.player_id)) continue;
          hop2Players.push(p);
          usedIds.add(p.player_id);
          if (hop2Players.length >= 28) break;
        }

        hop2Players.forEach((p, idx) => {
          const parentHop1 = hop1Players[idx % Math.max(1, hop1Players.length)];
          const angle =
            (idx / Math.max(1, hop2Players.length)) * Math.PI * 2 + 0.12;
          const r = 345 + (idx % 2) * 28;
          const sharedSessions = 5 + ((idx * 3) % 11);
          nodes.push({
            id: p.player_id,
            name: `${p.gamer_tag || p.display_name} (2°)`,
            type: "PLAYER",
            franchise: p.primary_franchise,
            label: to2KDivisionLabel(p.primary_franchise),
            archetype: p.primary_archetype,
            spend: p.lifetime_spend_usd,
            churn_risk: p.churn_risk_score,
            tilt: p.tilt_sensitivity,
            loss_streak: p.recent_loss_streak,
            gravity_score: Number(p.game_telemetry?.gravity_score ?? 0.48),
            game_telemetry: {
              ...p.game_telemetry,
              social_hop_degree: 2,
              social_hop_label: "2° Friend-of-Squad / Pro-Am Rival",
              coplay_games_30d: sharedSessions,
              bridge_via_tag: parentHop1?.gamer_tag,
              interpersonal_role:
                idx % 2 === 0
                  ? `Co-Plays with @${parentHop1?.gamer_tag}`
                  : "Rival Pro-Am Matchup Peer",
              monetization_play: "2° OVR Status Comparison & Cap-Breaker Catch-Up ($14.99)",
            },
            purchased_items: p.purchased_items,
            followed_creators: p.followed_creators,
            primary_creator_influence: p.primary_creator_influence ?? undefined,
            val: 11,
            color: "#9B72CB",
            fx: Math.round(Math.cos(angle) * r),
            fy: Math.round(Math.sin(angle) * r),
          });

          if (parentHop1) {
            links.push({
              source: parentHop1.player_id,
              target: p.player_id,
              label: `2° CO_PLAY_BRIDGE (${sharedSessions} games)`,
              value: 1.8,
              isMultiHopBridge: true,
              hopStep: 2,
              isTriggerStream: idx % 5 === 0,
            });
          }

          // Structural diversity bridge (2nd-hop player connected to two different 1st-hop squadmates!)
          if (idx % 4 === 0 && hop1Players.length > 2) {
            const secondParent =
              hop1Players[(idx + 2) % hop1Players.length];
            if (secondParent && secondParent.player_id !== parentHop1?.player_id) {
              links.push({
                source: secondParent.player_id,
                target: p.player_id,
                label: "2° STRUCTURAL_BRIDGE",
                value: 1.3,
                hopStep: 2,
              });
            }
          }
        });
      }

      // Build 3rd Hop (3° Weak-Tie Discovery & Cross-Title Holdout Ring)
      const hop3Players: any[] = [];
      if (maxHopAllowed >= 3) {
        // Prioritize NBA 2K26 holdouts and cross-franchise players for 3rd-hop weak ties
        const holdoutCandidates = socialPlayers.filter(
          (p) =>
            !usedIds.has(p.player_id) &&
            (p.primary_franchise !== "NBA2K" ||
              p.game_telemetry?.migrated_to_2k27 === false ||
              p.churn_risk_score >= 0.5)
        );
        const pool =
          holdoutCandidates.length >= 24
            ? holdoutCandidates
            : socialPlayers.filter((p) => !usedIds.has(p.player_id));

        for (const p of pool) {
          if (usedIds.has(p.player_id)) continue;
          hop3Players.push(p);
          usedIds.add(p.player_id);
          if (hop3Players.length >= 38) break;
        }

        hop3Players.forEach((p, idx) => {
          const parentHop2 =
            hop2Players[idx % Math.max(1, hop2Players.length)] ||
            hop1Players[idx % Math.max(1, hop1Players.length)];
          const angle =
            (idx / Math.max(1, hop3Players.length)) * Math.PI * 2 + 0.24;
          const r = 505 + (idx % 3) * 24;
          nodes.push({
            id: p.player_id,
            name: `${p.gamer_tag || p.display_name} (3°)`,
            type: "PLAYER",
            franchise: p.primary_franchise,
            label: to2KDivisionLabel(p.primary_franchise),
            archetype: p.primary_archetype,
            spend: p.lifetime_spend_usd,
            churn_risk: p.churn_risk_score,
            tilt: p.tilt_sensitivity,
            loss_streak: p.recent_loss_streak,
            gravity_score: Number(p.game_telemetry?.gravity_score ?? 0.34),
            game_telemetry: {
              ...p.game_telemetry,
              social_hop_degree: 3,
              social_hop_label: "3° Weak-Tie Bridge / Cross-Title Holdout",
              bridge_via_tag: parentHop2?.gamer_tag,
              interpersonal_role:
                p.primary_franchise === "NBA2K26" ||
                p.game_telemetry?.migrated_to_2k27 === false
                  ? "NBA 2K26 Holdout (3° Weak Tie)"
                  : `3° Cross-2K Bridge (${p.primary_franchise})`,
              monetization_play: "3° Weak-Tie Squad Referral Bounty & 2K27 Upgrade ($49.99)",
            },
            purchased_items: p.purchased_items,
            followed_creators: p.followed_creators,
            primary_creator_influence: p.primary_creator_influence ?? undefined,
            val: 8,
            color: "#FFB800",
            fx: Math.round(Math.cos(angle) * r),
            fy: Math.round(Math.sin(angle) * r),
          });

          if (parentHop2) {
            links.push({
              source: parentHop2.player_id,
              target: p.player_id,
              label: "3° WEAK_TIE_BRIDGE",
              value: 1.2,
              isMultiHopBridge: true,
              hopStep: 3,
            });
          }
        });
      }

      return NextResponse.json({
        nodes,
        links,
        is_live: true,
        graph: GRAPH_NAME,
        social_hop_summary: {
          ego_player_id: egoPlayer.player_id,
          ego_gamer_tag: egoPlayer.gamer_tag,
          hop1_count: hop1Players.length,
          hop2_count: hop2Players.length,
          hop3_count: hop3Players.length,
          total_network_reach: 1 + hop1Players.length + hop2Players.length + hop3Players.length,
          squad_var_usd: Number(egoPlayer.game_telemetry?.squad_var_usd || 3480),
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
          { error: `No player found for id '${selectedPlayerId ?? "(default)"}'.` },
          { status: 404 }
        );
      }

      const primaryLabel = to2KDivisionLabel(player.primary_franchise);

      nodes.push({
        id: player.player_id,
        name: player.gamer_tag || player.display_name,
        type: "PLAYER",
        franchise: player.primary_franchise,
        label: primaryLabel,
        archetype: player.primary_archetype,
        spend: player.lifetime_spend_usd,
        churn_risk: player.churn_risk_score,
        tilt: player.tilt_sensitivity,
        loss_streak: player.recent_loss_streak,
        gravity_score: Number(player.game_telemetry?.gravity_score ?? 0),
        game_telemetry: player.game_telemetry,
        purchased_items: player.purchased_items,
        followed_creators: player.followed_creators,
        primary_creator_influence: player.primary_creator_influence ?? undefined,
        country: player.country ?? undefined,
        country_flag: player.country_flag ?? undefined,
        dma_market: player.dma_market ?? undefined,
        val: 28,
        color: "#00F0FF",
        ...(isExpandOverlay ? {} : { fx: 0, fy: 0 }),
      });

      const [identities, crewMates, bridges] = await Promise.all([
        getIdentitiesForPlayer(player.player_id),
        getCrewMates([player.player_id]),
        getCrossLabelBridges([player.player_id]),
      ]);

      identities.forEach((ident, idx) => {
        const cleanPlatform = sanitizePlatformName(ident.platform);
        const angle = (idx / Math.max(1, identities.length)) * Math.PI * 2;
        nodes.push({
          id: ident.identity_id,
          name: `${cleanPlatform}: ${ident.platform_handle ?? "N/A"}`,
          type: "IDENTITY",
          platform: cleanPlatform,
          confidence: ident.confidence_score,
          val: 15,
          color: PLATFORM_COLORS[cleanPlatform] || "#A855F7",
          ...(isExpandOverlay
            ? {}
            : {
                fx: Math.round(Math.cos(angle) * 200),
                fy: Math.round(Math.sin(angle) * 200),
              }),
        });
        links.push({
          source: player.player_id,
          target: ident.identity_id,
          label: `CONFIDENCE: ${(ident.confidence_score * 100).toFixed(0)}%`,
          value: 2.5,
          isMultiHopBridge: true,
          hopStep: 1,
        });
      });

      const seenGames = new Set<string>();
      const valid2KBridges = bridges.filter(
        (b) =>
          VALID_2K_FRANCHISES.has(b.franchise) ||
          /^game-(nba2k|wwe2k|pga2k|topspin|bl4|civ7|mafia)/i.test(b.game_id)
      );
      valid2KBridges.forEach((b, idx) => {
        if (seenGames.has(b.game_id)) return;
        seenGames.add(b.game_id);
        const angle = ((idx + 0.5) / Math.max(1, valid2KBridges.length)) * Math.PI * 2;
        const lbl = to2KDivisionLabel(b.franchise);
        nodes.push({
          id: b.game_id,
          name: b.title,
          type: "GAME",
          franchise: b.franchise,
          label: lbl,
          hours: b.hours_played,
          val: 22,
          color: FRANCHISE_COLORS[b.franchise] || LABEL_COLORS[lbl] || "#E4002B",
          ...(isExpandOverlay
            ? {}
            : {
                fx: Math.round(Math.cos(angle) * 330),
                fy: Math.round(Math.sin(angle) * 330),
              }),
        });
        links.push({
          source: player.player_id,
          target: b.game_id,
          label: `${b.hours_played}h played`,
          value: 2,
          isMultiHopBridge: b.franchise !== player.primary_franchise,
          hopStep: 2,
        });
      });

      if (crewMates.length > 0) {
        const first = crewMates[0];
        const clanNodeId = first.clan_id;
        nodes.push({
          id: clanNodeId,
          name: `${first.clan_name} (${first.clan_tier})`,
          type: "CLAN",
          franchise: "NBA2K",
          rank_tier: first.clan_tier,
          val: 22,
          color: "#00F59B",
          ...(isExpandOverlay ? {} : { fx: -280, fy: -220 }),
        });
        links.push({
          source: player.player_id,
          target: clanNodeId,
          label: "MEMBER_OF_CLAN",
          value: 2.4,
          isMultiHopBridge: true,
          hopStep: 1,
        });
        crewMates.slice(0, 8).forEach((m, i) => {
          nodes.push({
            id: m.mate_id,
            name: `${m.mate_tag} (${m.mate_ovr ?? 88} OVR)`,
            type: "SQUADMATE",
            franchise: "NBA2K",
            val: 12,
            color: "#00D2FF",
            ...(isExpandOverlay
              ? {}
              : {
                  fx: -410 - (i % 2) * 75,
                  fy: -270 + i * 52,
                }),
          });
          links.push({
            source: clanNodeId,
            target: m.mate_id,
            label: `Active ${m.mate_last_login_days_ago}d ago`,
            value: 1.8,
            isMultiHopBridge: true,
            hopStep: 2,
          });
        });
      }

      return NextResponse.json({
        nodes,
        links,
        is_live: true,
        graph: GRAPH_NAME,
        execution_ms: Date.now() - started,
      });
    }

    // ======================================================================
    // LOAD LIVE CATALOG + PLAYERS FROM 2K IDENTITY GRAPH
    // ======================================================================
    const [games, offers, creators, clans, players] = await Promise.all([
      getGames(),
      getOffers(),
      getCreators(),
      getClans(),
      getPlayersForView({
        franchise: gameFilter,
        archetype: archetypeFilter,
        limit: effectiveRenderLimit,
      }),
    ]);

    const creatorById = new Map<string, CreatorRow>(
      creators.map((c) => [c.creator_id, c])
    );

    // Filter offers to strictly 2K franchises
    const pure2KOffers = offers.filter(
      (o) => !o.target_franchise || VALID_2K_FRANCHISES.has(o.target_franchise)
    );

    // ======================================================================
    // VIEW 2: SOCIAL CREWS & 2K NEXTMAKERS CREATORS VIEW
    // ======================================================================
    if (view === "social-clans" || view === "crews") {
      const topCrews = clans.slice(0, 20);
      topCrews.forEach((c, idx) => {
        const angle = (idx / Math.max(1, topCrews.length)) * Math.PI * 2 - Math.PI / 2;
        const radius = c.tier === "Comp" ? 210 : c.tier === "Pro-Am" ? 330 : 445;
        const tierColor =
          c.tier === "Comp"
            ? "#FFB800"
            : c.tier === "Pro-Am"
            ? "#00F59B"
            : "#00D2FF";
        nodes.push({
          id: c.clan_id,
          name: `${c.name} · ${c.tier || "Rec"}`,
          type: "CLAN",
          franchise: c.franchise || "NBA2K",
          rank_tier: c.tier || "Rec",
          val: 26,
          color: tierColor,
          fx: Math.round(Math.cos(angle) * radius),
          fy: Math.round(Math.sin(angle) * radius),
        });
      });

      // Outer 6 pinned Creators
      for (const anchor of MACRO_CREATOR_ANCHORS) {
        const cr = creatorById.get(anchor.id);
        nodes.push({
          id: anchor.id,
          name: cr?.handle || anchor.name,
          type: "CREATOR",
          franchise: cr?.franchise || anchor.franchise,
          platform: cr?.platform || "YouTube",
          val: 26,
          color: anchor.color,
          creator_data: cr,
          fx: anchor.fx,
          fy: anchor.fy,
        });
      }

      const crewIds = new Set(topCrews.map((c) => c.clan_id));
      const creatorIds = new Set(MACRO_CREATOR_ANCHORS.map((c) => c.id));
      const crewPlayers = players.slice(0, 520);

      crewPlayers.forEach((p: any, idx: number) => {
        const assignedCrewId =
          p.game_telemetry?.crew_id && crewIds.has(p.game_telemetry.crew_id)
            ? p.game_telemetry.crew_id
            : topCrews[idx % Math.max(1, topCrews.length)]?.clan_id;

        nodes.push({
          id: p.player_id,
          name: p.gamer_tag || p.display_name,
          type: "PLAYER",
          franchise: p.primary_franchise,
          label: to2KDivisionLabel(p.primary_franchise),
          archetype: p.primary_archetype,
          spend: p.lifetime_spend_usd,
          churn_risk: p.churn_risk_score,
          tilt: p.tilt_sensitivity,
          loss_streak: p.recent_loss_streak,
          clan_id: assignedCrewId,
          game_telemetry: p.game_telemetry,
          purchased_items: p.purchased_items,
          followed_creators: p.followed_creators,
          primary_creator_influence: p.primary_creator_influence ?? undefined,
          country: p.country ?? undefined,
          country_flag: p.country_flag ?? undefined,
          dma_market: p.dma_market ?? undefined,
          val: p.lifetime_spend_usd >= 1000 ? 12 : p.lifetime_spend_usd >= 300 ? 8 : 6,
          color: archetypeColor(p.primary_archetype),
        });

        if (assignedCrewId) {
          const isStalled = (p.game_telemetry?.last_login_days_ago ?? 0) >= 7;
          links.push({
            source: p.player_id,
            target: assignedCrewId,
            label: "MEMBER_OF_CLAN",
            value: 2,
            isMultiHopBridge: isStalled && idx % 4 === 0,
            hopStep: 1,
          });
        }

        if (idx % 3 === 0 && p.followed_creators?.length) {
          const matchedCr = p.followed_creators.find((cid: string) => creatorIds.has(cid));
          if (matchedCr) {
            links.push({
              source: p.player_id,
              target: matchedCr,
              label: "FOLLOWS_CREATOR",
              value: 1.4,
            });
          }
        }
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
    // VIEW 3: 5-POINT PINNED PURE-2K STELLAR CONSTELLATION (MACRO & COHORTS)
    // ======================================================================
    if (gameFilter === "ALL") {
      // 1. 5 Pinned Core 2K Hubs (MACRO_HUB_POSITIONS)
      const gameById = new Map(games.map((g) => [g.game_id, g]));
      for (const [hubId, spec] of Object.entries(MACRO_HUB_POSITIONS)) {
        const dbGame = gameById.get(hubId);
        nodes.push({
          id: hubId,
          name: spec.title,
          type: "GAME",
          franchise: spec.franchise,
          label: spec.label,
          lifecycle_status: dbGame?.lifecycle_status ?? "LIVE",
          current_season: dbGame?.current_season ?? "Season 1",
          val: spec.val,
          color: spec.color,
          fx: spec.fx,
          fy: spec.fy,
          fz: spec.fz,
        });
      }

      // 2. Outer Pinned Social Anchors: Top 6 Creators + Top 6 Crews
      for (const anchor of MACRO_CREATOR_ANCHORS) {
        const cr = creatorById.get(anchor.id);
        nodes.push({
          id: anchor.id,
          name: cr?.handle || anchor.name,
          type: "CREATOR",
          franchise: cr?.franchise || anchor.franchise,
          platform: cr?.platform || "YouTube",
          val: 26,
          color: anchor.color,
          creator_data: cr || {
            creator_id: anchor.id,
            handle: anchor.name,
            name: anchor.name,
            platform: "YouTube",
            franchise: anchor.franchise,
          },
          fx: anchor.fx,
          fy: anchor.fy,
        });
      }

      const topSixClans: ClanRow[] = clans.slice(0, 6);
      topSixClans.forEach((clan, idx) => {
        const coord = MACRO_CREW_COORDS[idx] || MACRO_CREW_COORDS[0];
        nodes.push({
          id: clan.clan_id,
          name: clan.name,
          type: "CLAN",
          franchise: clan.franchise || coord.franchise,
          rank_tier: clan.tier || "Pro-Am",
          val: 26,
          color: "#00F59B",
          fx: coord.fx,
          fy: coord.fy,
        });
      });

      // 3. Top 5 Flagship Offers at MACRO_OFFER_OFFSETS
      const usedOfferIds = new Set<string>();
      MACRO_OFFER_OFFSETS.forEach((offset) => {
        const match =
          pure2KOffers.find(
            (o) =>
              !usedOfferIds.has(o.offer_id) &&
              o.target_franchise === offset.franchise
          ) ||
          pure2KOffers.find((o) => !usedOfferIds.has(o.offer_id));
        if (match) {
          usedOfferIds.add(match.offer_id);
          nodes.push(offerNode(match, offset.dx, offset.dy));
        }
      });
    } else {
      // Single Franchise Selected: Primary Hub + Mode Satellites + Creators + Crew + Wide Offer Orbit
      const franchiseGames = games.filter(
        (g) =>
          g.franchise === gameFilter ||
          g.game_id === HUB_ID_BY_FRANCHISE[gameFilter]
      );
      const mainHub =
        franchiseGames.find((g) => g.is_parent_hub) || franchiseGames[0];
      const surfaces = franchiseGames.filter(
        (g) => mainHub && g.game_id !== mainHub.game_id
      );

      if (mainHub) {
        nodes.push({
          id: mainHub.game_id,
          name: mainHub.title,
          type: "GAME",
          franchise: mainHub.franchise,
          label: to2KDivisionLabel(mainHub.franchise),
          val: 42,
          color: FRANCHISE_COLORS[mainHub.franchise] || "#E4002B",
          lifecycle_status: mainHub.lifecycle_status ?? undefined,
          current_season: mainHub.current_season ?? undefined,
          fx: 0,
          fy: -30,
        });
      }

      surfaces.forEach((g, idx) => {
        const count = Math.max(1, surfaces.length);
        const angle = (idx / count) * Math.PI + Math.PI * 0.25;
        const radius = 190;
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          label: to2KDivisionLabel(g.franchise),
          val: g.lifecycle_status === "LIVE" ? 30 : 22,
          color:
            g.lifecycle_status === "LIVE"
              ? FRANCHISE_COLORS[g.franchise] || "#00D2FF"
              : "#6B7280",
          lifecycle_status: g.lifecycle_status ?? undefined,
          current_season: g.current_season ?? undefined,
          fx: Math.round(Math.cos(angle) * radius),
          fy: Math.round(Math.sin(angle) * radius) + 50,
        });
      });

      const relevantCreators = creators.filter(
        (c) => c.franchise === gameFilter || c.franchise === "NBA2K"
      );
      relevantCreators.slice(0, 2).forEach((c, idx) => {
        nodes.push({
          id: c.creator_id,
          name: c.handle || c.name,
          type: "CREATOR",
          franchise: c.franchise ?? gameFilter,
          platform: c.platform,
          creator_data: c,
          val: 26,
          color: "#00F0FF",
          fx: idx === 0 ? -280 : 280,
          fy: 130,
        });
      });

      const matchingClan =
        clans.find((cl) => cl.franchise === gameFilter) || clans[0];
      if (matchingClan) {
        nodes.push({
          id: matchingClan.clan_id,
          name: matchingClan.name,
          type: "CLAN",
          franchise: matchingClan.franchise,
          rank_tier: matchingClan.tier || "Pro-Am",
          val: 26,
          color: "#00F59B",
          fx: 0,
          fy: 210,
        });
      }

      const franchiseOffers = pure2KOffers
        .filter(
          (o) => o.target_franchise === gameFilter || o.target_franchise === "NBA2K"
        )
        .slice(0, 5);

      const offerCount = Math.max(1, franchiseOffers.length);
      franchiseOffers.forEach((o, idx) => {
        const angle = (idx / offerCount) * 2 * Math.PI - Math.PI / 2;
        const radius = 480;
        nodes.push(
          offerNode(
            o,
            Math.round(Math.cos(angle) * radius),
            Math.round(Math.sin(angle) * radius)
          )
        );
      });
    }

    // ======================================================================
    // PLAYER NODES & STRICT EDGE BUDGET (MAX 1 HUB + 1 BRIDGE + 1 PERIMETER)
    // ======================================================================
    const offerNodes = nodes.filter((n) => n.type === "OFFER");
    const gameNodes = nodes.filter((n) => n.type === "GAME");
    const creatorNodes = nodes.filter((n) => n.type === "CREATOR");
    const clanNodes = nodes.filter((n) => n.type === "CLAN");
    const drawnIds = new Set(nodes.map((n) => n.id));

    players.forEach((p: any, i: number) => {
      const spend: number = p.lifetime_spend_usd || 0;
      const divisionLabel = to2KDivisionLabel(p.primary_franchise);

      nodes.push({
        id: p.player_id,
        name: p.gamer_tag || p.display_name,
        type: "PLAYER",
        franchise: p.primary_franchise,
        label: divisionLabel,
        archetype: p.primary_archetype,
        spend,
        churn_risk: p.churn_risk_score,
        tilt: p.tilt_sensitivity,
        loss_streak: p.recent_loss_streak,
        gravity_score: Number(p.game_telemetry?.gravity_score ?? 0),
        game_telemetry: p.game_telemetry,
        purchased_items: p.purchased_items,
        followed_creators: p.followed_creators,
        primary_creator_influence: p.primary_creator_influence ?? undefined,
        country: p.country ?? undefined,
        country_code: p.country_code ?? undefined,
        country_flag: p.country_flag ?? undefined,
        dma_market: p.dma_market ?? undefined,
        lat: p.lat ?? undefined,
        lng: p.lng ?? undefined,
        val: spend >= 2500 ? 14 : spend >= 500 ? 9 : 6,
        color: archetypeColor(p.primary_archetype),
      });

      // ------------------------------------------------------------------
      // EDGE 1 (MAX 1): Primary Hub Edge (PLAYS_GAME, value: 2)
      // ------------------------------------------------------------------
      let primaryHubId = "game-nba2k27";
      if (gameFilter === "ALL") {
        primaryHubId = resolvePrimaryMacroHubForPlayer(p);
        if (!drawnIds.has(primaryHubId)) {
          primaryHubId = "game-nba2k27";
        }
        links.push({
          source: p.player_id,
          target: primaryHubId,
          label: "PLAYS_GAME",
          value: 2,
        });
      } else if (gameNodes.length > 0) {
        const primaryHub =
          gameNodes.find((g) => g.fx === 0 && g.fy === -30) || gameNodes[0];
        primaryHubId = primaryHub.id;
        links.push({
          source: p.player_id,
          target: primaryHub.id,
          label: "PLAYS_GAME",
          value: 2,
        });
      }

      // ------------------------------------------------------------------
      // EDGE 2 (MAX 1): Cross-Franchise / 2K26->2K27 Migration Bridge Edge (value: 1)
      // ------------------------------------------------------------------
      if (gameFilter === "ALL") {
        let bridgeHubId: string | null = null;

        if (primaryHubId === "game-nba2k26") {
          // 2K26 holdout/veteran migration bridge to NBA 2K27
          bridgeHubId = "game-nba2k27";
        } else if (
          primaryHubId === "game-nba2k27" &&
          p.game_telemetry?.nba2k26_veteran &&
          i % 3 === 0
        ) {
          bridgeHubId = "game-nba2k26";
        } else if (Array.isArray(p.franchises_played) && p.franchises_played.length > 1) {
          for (const f of p.franchises_played) {
            const candidateHub = mapFranchiseToMacroHub(f);
            if (candidateHub !== primaryHubId && drawnIds.has(candidateHub)) {
              bridgeHubId = candidateHub;
              break;
            }
          }
        }

        if (bridgeHubId && drawnIds.has(bridgeHubId)) {
          const isCrossView = view === "cross-franchise";
          links.push({
            source: p.player_id,
            target: bridgeHubId,
            label: "CROSS_FRANCHISE_PLAY",
            value: 1,
            isMultiHopBridge: isCrossView && i % 4 === 0,
            hopStep: isCrossView ? 2 : undefined,
            isTriggerStream: i % 12 === 0,
          });
        }
      }

      // ------------------------------------------------------------------
      // EDGE 3 (MAX 1): Single Highest-Value Offer / Creator / Crew Edge
      // ------------------------------------------------------------------
      let addedPerimeterEdge = false;

      // Priority A: Creator affinity spoke (for 1/3 of cohort with matched creator)
      if (!addedPerimeterEdge && i % 3 === 0 && creatorNodes.length > 0) {
        const matchedCreator =
          creatorNodes.find((c) => c.id === p.primary_creator_influence) ||
          creatorNodes.find((c) => (p.followed_creators || []).includes(c.id));
        if (matchedCreator) {
          links.push({
            source: p.player_id,
            target: matchedCreator.id,
            label: "FOLLOWS_CREATOR",
            value: 1.5,
          });
          addedPerimeterEdge = true;
        }
      }

      // Priority B: Crew membership spoke (for 1/3 of cohort with matched crew)
      if (!addedPerimeterEdge && i % 3 === 1 && clanNodes.length > 0) {
        const matchedClan =
          clanNodes.find((cl) => cl.id === p.game_telemetry?.crew_id) ||
          clanNodes[i % clanNodes.length];
        if (matchedClan) {
          links.push({
            source: p.player_id,
            target: matchedClan.id,
            label: "MEMBER_OF_CLAN",
            value: 1.6,
          });
          addedPerimeterEdge = true;
        }
      }

      // Priority C: Highest-value owned SKU or Archetype-Affinity Offer
      if (!addedPerimeterEdge && offerNodes.length > 0) {
        const ownedIds = new Set<string>(
          (p.purchased_items || [])
            .map((it: any) => it?.offer_id)
            .filter(Boolean)
        );
        const drawnOwned = offerNodes.filter((off) => ownedIds.has(off.id));

        if (drawnOwned.length > 0) {
          drawnOwned.sort((a, b) => (b.spend || 0) - (a.spend || 0));
          const topSku = drawnOwned[0];
          links.push({
            source: p.player_id,
            target: topSku.id,
            label: "OWNS_SKU",
            value: 2.0,
            isTriggerStream: spend >= 1500 && i % 6 === 0,
          });
          addedPerimeterEdge = true;
        } else if (p.tilt_sensitivity >= 0.7 && p.recent_loss_streak >= 3) {
          const recoveryOffer =
            offerNodes.find((off) => (off.spend || 0) <= 10) || offerNodes[0];
          if (recoveryOffer) {
            links.push({
              source: p.player_id,
              target: recoveryOffer.id,
              label: "STARTER_PACK_INTENT",
              value: 1.8,
              isTriggerStream: p.churn_risk_score >= 0.65 && i % 5 === 0,
            });
            addedPerimeterEdge = true;
          }
        } else {
          const candidates = offerNodes.filter((off) => {
            const o = off.offer_data as OfferRow | undefined;
            return o && o.affinity_archetype === p.primary_archetype;
          });
          const targetOffer =
            candidates.length > 0
              ? candidates[i % candidates.length]
              : offerNodes[i % offerNodes.length];
          if (targetOffer) {
            links.push({
              source: p.player_id,
              target: targetOffer.id,
              label: "MONETIZATION_GRAVITY",
              value: 1.4,
            });
            addedPerimeterEdge = true;
          }
        }
      }
    });

    return NextResponse.json({
      nodes,
      links,
      is_live: true,
      graph: GRAPH_NAME,
      is_sampled: players.length >= RENDER_LIMIT,
      execution_ms: Date.now() - started,
    });
  } catch (error: any) {
    if (error instanceof SpannerUnavailableError) {
      console.error("[graph/view] Spanner unavailable:", error.message);
      return NextResponse.json(
        { error: error.message, error_kind: "SPANNER_UNAVAILABLE", is_live: false },
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
