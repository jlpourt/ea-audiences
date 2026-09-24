import { NextRequest, NextResponse } from "next/server";
import { GraphData, GraphNode, GraphLink } from "@/lib/types";
import { archetypeColor } from "@/lib/archetypes";
import {
  getCatalog,
  getPlayersForView,
  getPlayerById,
  getIdentitiesForPlayer,
  HUB_ID_BY_FRANCHISE,
  FRANCHISE_COLORS,
  SpannerUnavailableError,
  type GameRow,
  type OfferRow,
  type CreatorRow,
  type ClanRow,
} from "@/lib/gcp/catalog";

export const dynamic = "force-dynamic";

/** Cap on drawn player nodes. A rendering budget, never an audience size. */
const RENDER_LIMIT = 450;

const PLATFORM_COLORS: Record<string, string> = {
  ACTIVISION_ID: "#EAB308",
  BATTLE_NET: "#00AEFF",
  PLAYSTATION_NETWORK: "#0070D1",
  XBOX_LIVE: "#107C10",
  STEAM: "#9146FF",
  COD_MOBILE: "#10B981",
};

/** The frontline relevant games in Call of Duty */
const RELEVANT_GAMES = [
  "game-cod-bo7",
  "game-cod-warzone",
  "game-cod-bo6",
  "game-cod-mw3",
  "game-cod-cdl",
];

/** Macro-view hub anchor positions: 5-point stellar constellation, zero central launcher clutter. */
const MACRO_HUB_POSITIONS: Record<string, { fx: number; fy: number }> = {
  "game-cod-bo7": { fx: 0, fy: -320 },         // North Apex: Call of Duty: Black Ops 7 (Newest 2026 Game)
  "game-cod-warzone": { fx: -420, fy: -140 },  // North-West: Warzone & Resurgence
  "game-cod-bo6": { fx: 420, fy: -140 },       // North-East: Black Ops 6 & Zombies
  "game-cod-mw3": { fx: -340, fy: 240 },       // South-West: Modern Warfare III
  "game-cod-cdl": { fx: 340, fy: 240 },        // South-East: CDL Ranked Play
};

/** Key Social Creators & Clans anchoring each of the community quadrants */
const MACRO_SOCIAL_ANCHORS: {
  id: string;
  type: "CREATOR" | "CLAN";
  name: string;
  franchise: string;
  color: string;
  fx: number;
  fy: number;
}[] = [
  // Black Ops 7 & Community (North Apex)
  { id: "creator-scump", type: "CREATOR", name: "Scump", franchise: "BLACK_OPS", color: "#00F0FF", fx: -170, fy: -380 },
  { id: "creator-shotzzy", type: "CREATOR", name: "Shotzzy", franchise: "BLACK_OPS", color: "#00F0FF", fx: 170, fy: -380 },

  // Warzone (North-West)
  { id: "creator-swagg", type: "CREATOR", name: "FaZe Swagg", franchise: "WARZONE", color: "#00F0FF", fx: -560, fy: -220 },
  { id: "clan-faze", type: "CLAN", name: "FaZe Clan", franchise: "WARZONE", color: "#00F59B", fx: -580, fy: -60 },

  // Modern Warfare III (South-West)
  { id: "creator-jgod", type: "CREATOR", name: "JGOD", franchise: "MODERN_WARFARE", color: "#00F0FF", fx: -460, fy: 320 },
  { id: "clan-taskforce141", type: "CLAN", name: "Task Force 141", franchise: "MODERN_WARFARE", color: "#00F59B", fx: -200, fy: 320 },

  // CDL Ranked Play (South-East)
  { id: "creator-zoomaa", type: "CREATOR", name: "ZooMaa", franchise: "CDL_RANKED", color: "#00F0FF", fx: 200, fy: 320 },
  { id: "clan-optic", type: "CLAN", name: "OpTic Gaming", franchise: "CDL_RANKED", color: "#00F59B", fx: 460, fy: 320 },
];

/** Macro flagship offer positioning offsets with generous clearance */
const MACRO_OFFER_OFFSETS: Record<string, { fx: number; fy: number }[]> = {
  WARZONE: [
    { fx: -540, fy: 0 },
    { fx: -320, fy: -20 },
  ],
  BLACK_OPS: [
    { fx: -110, fy: -240 },
    { fx: 110, fy: -240 },
  ],
  MODERN_WARFARE: [
    { fx: -480, fy: 150 },
    { fx: -200, fy: 160 },
  ],
  CDL_RANKED: [
    { fx: 480, fy: 150 },
    { fx: 200, fy: 160 },
  ],
};

function formatOfferTitle(title: string, price: number): string {
  let clean = title
    .replace(/\(1,100 CP\)/i, "")
    .replace(/\(\+800 Bonus\)/i, "")
    .replace(/Call of Duty:\s*/i, "")
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "audience-cohorts";
  const selectedPlayerId = searchParams.get("playerId");
  const gameFilter = searchParams.get("game") || "ALL";
  const archetypeFilter = searchParams.get("archetype") || "ALL";

  try {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // ======================================================================
    // VIEW 1: SINGLE PLAYER IDENTITY RESOLUTION
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

      nodes.push({
        id: player.player_id,
        name: player.display_name,
        type: "PLAYER",
        franchise: player.primary_franchise,
        archetype: player.primary_archetype,
        spend: player.lifetime_spend_usd,
        churn_risk: player.churn_risk_score,
        tilt: player.tilt_sensitivity,
        val: 28,
        color: "#00F0FF",
        fx: 0,
        fy: 0,
      });

      const identities = await getIdentitiesForPlayer(player.player_id);
      for (const ident of identities) {
        nodes.push({
          id: ident.identity_id,
          name: `${ident.platform}: ${ident.platform_handle ?? "—"}`,
          type: "IDENTITY",
          platform: ident.platform,
          confidence: ident.confidence_score,
          val: 15,
          color: PLATFORM_COLORS[ident.platform] || "#00F0FF",
        });
        links.push({
          source: player.player_id,
          target: ident.identity_id,
          label: `CONFIDENCE: ${(ident.confidence_score * 100).toFixed(0)}%`,
          value: 3,
        });
      }

      return NextResponse.json({ nodes, links } as GraphData);
    }

    // ======================================================================
    // VIEW 2: MULTI-FRANCHISE & GAME-SPECIFIC COHORTS
    // ======================================================================
    const [{ games, offers, creators, clans }, players] = await Promise.all([
      getCatalog(),
      getPlayersForView({
        franchise: gameFilter,
        archetype: archetypeFilter,
        limit: RENDER_LIMIT,
      }),
    ]);

    if (gameFilter === "ALL") {
      // ---- 1. The Frontline Relevant Games (Constellation) ----------------
      const hubs = games.filter((g) => RELEVANT_GAMES.includes(g.game_id));
      for (const g of hubs) {
        const pos = MACRO_HUB_POSITIONS[g.game_id];
        if (!pos) continue;
        const isBo7 = g.game_id === "game-cod-bo7";
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          val: isBo7 ? 46 : 38,
          color: isBo7 ? "#FF3D00" : FRANCHISE_COLORS[g.franchise] || "#00F0FF",
          fx: pos.fx,
          fy: pos.fy,
        });
      }

      // ---- 2. Social Creator & Pro Clan Anchors in Each Quadrant ----------
      for (const anchor of MACRO_SOCIAL_ANCHORS) {
        nodes.push({
          id: anchor.id,
          name: anchor.name,
          type: anchor.type,
          franchise: anchor.franchise,
          val: 26,
          color: anchor.color,
          fx: anchor.fx,
          fy: anchor.fy,
        });
      }

      // ---- 3. Flagship In-Game Purchases (Perimeter Offsets) -------------
      for (const [franchise, offsets] of Object.entries(MACRO_OFFER_OFFSETS)) {
        const list = offers.filter(
          (o) => o.target_franchise === franchise && o.lifecycle_status !== "LEGACY"
        );
        const sorted = [...list].sort((a, b) => b.price_usd - a.price_usd);
        const headline = sorted[0];
        const recovery = sorted[sorted.length - 1];
        const picks =
          headline && recovery && headline.offer_id !== recovery.offer_id
            ? [headline, recovery]
            : [headline].filter(Boolean);

        picks.forEach((o, idx) => {
          const pos = offsets[idx] || offsets[0];
          nodes.push(offerNode(o, pos.fx, pos.fy));
        });
      }
    } else {
      // ---- Single franchise: draw primary hub + surfaces + creators + clan + wide offer orbit -----
      const franchiseGames = games.filter((g) => g.franchise === gameFilter);
      const mainHub = franchiseGames.find((g) => g.is_parent_hub) || franchiseGames[0];
      const surfaces = franchiseGames.filter((g) => !g.is_parent_hub && g.game_id !== "game-cod");

      // Primary Franchise Hub at prominent center anchor
      if (mainHub) {
        nodes.push({
          id: mainHub.game_id,
          name: mainHub.title,
          type: "GAME",
          franchise: mainHub.franchise,
          val: 40,
          color: FRANCHISE_COLORS[mainHub.franchise] || "#00F0FF",
          lifecycle_status: mainHub.lifecycle_status ?? undefined,
          current_season: mainHub.current_season ?? undefined,
          fx: 0,
          fy: -30,
        });
      }

      // Sub-modes / Maps on inner satellite ring (radius ~190)
      surfaces.forEach((g, idx) => {
        const count = surfaces.length;
        const angle = (idx / count) * Math.PI + Math.PI * 0.25; // lower arc
        const radius = 190;
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          val: g.lifecycle_status === "LIVE" ? 30 : 22,
          color:
            g.lifecycle_status === "LIVE"
              ? FRANCHISE_COLORS[g.franchise] || "#00F0FF"
              : "#6B7280",
          lifecycle_status: g.lifecycle_status ?? undefined,
          current_season: g.current_season ?? undefined,
          fx: Math.round(Math.cos(angle) * radius),
          fy: Math.round(Math.sin(angle) * radius) + 50,
        });
      });

      // Top Creators for this franchise as distinct community anchors
      const relevantCreators = creators.filter(
        (c) => c.franchise === gameFilter || c.franchise === "COD" || gameFilter === "WARZONE"
      );
      const topCreators = relevantCreators.slice(0, 2);
      topCreators.forEach((c, idx) => {
        const fx = idx === 0 ? -260 : 260;
        const fy = 120;
        nodes.push({
          id: c.creator_id,
          name: c.handle || c.name,
          type: "CREATOR",
          franchise: c.franchise ?? undefined,
          val: 26,
          color: "#00F0FF",
          fx,
          fy,
        });
      });

      // Matching Pro Clan for this franchise
      const matchingClan = clans.find((cl) => cl.franchise === gameFilter);
      if (matchingClan) {
        nodes.push({
          id: matchingClan.clan_id,
          name: matchingClan.name,
          type: "CLAN",
          franchise: matchingClan.franchise,
          val: 26,
          color: "#00F59B",
          fx: 0,
          fy: 200,
        });
      }

      // In-game offers arranged on wide perimeter orbit (radius = 480) with huge spacing
      const franchiseOffers = offers
        .filter((o) => o.target_franchise === gameFilter)
        .slice(0, 6);

      const offerCount = franchiseOffers.length;
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

    // ---- 3. Player nodes (stratified diverse sample) ----------------------
    for (const p of players) {
      nodes.push({
        id: p.player_id,
        name: p.display_name,
        type: "PLAYER",
        franchise: p.primary_franchise,
        archetype: p.primary_archetype,
        spend: p.lifetime_spend_usd,
        churn_risk: p.churn_risk_score,
        tilt: p.tilt_sensitivity,
        loss_streak: p.recent_loss_streak,
        game_telemetry: p.game_telemetry,
        purchased_items: p.purchased_items,
        val: p.lifetime_spend_usd >= 3000 ? 14 : p.lifetime_spend_usd >= 500 ? 9 : 6,
        color: archetypeColor(p.primary_archetype),
      });
    }

    // ---- 4. Links (clean, bounded topology without noise) ----------------
    const offerNodes = nodes.filter((n) => n.type === "OFFER");
    const gameNodes = nodes.filter((n) => n.type === "GAME");
    const creatorNodes = nodes.filter((n) => n.type === "CREATOR");
    const clanNodes = nodes.filter((n) => n.type === "CLAN");
    const drawnIds = new Set(nodes.map((n) => n.id));

    players.forEach((p: any, i: number) => {
      const spend: number = p.lifetime_spend_usd;

      // A. Primary Franchise / Game Connection (Exactly 1 main link)
      if (gameFilter === "ALL") {
        const hubId = HUB_ID_BY_FRANCHISE[p.primary_franchise] || "game-cod-warzone";
        if (drawnIds.has(hubId)) {
          links.push({
            source: p.player_id,
            target: hubId,
            label: spend === 0 ? "BASE_GAME_RETAIL_PURCHASER" : "PRIMARY_FRANCHISE_PLAYER",
            value: 2,
          });
        }
        // At most 1 subtle cross-franchise play edge
        if (p.franchises_played && p.franchises_played.length > 1) {
          const secondary = p.franchises_played.find((f: string) => f !== p.primary_franchise);
          if (secondary) {
            const secId = HUB_ID_BY_FRANCHISE[secondary];
            if (secId && drawnIds.has(secId)) {
              links.push({
                source: p.player_id,
                target: secId,
                label: "CROSS_FRANCHISE_PLAY",
                value: 1,
                isTriggerStream: i % 12 === 0,
              });
            }
          }
        }
      } else if (gameNodes.length > 0) {
        // Connect to primary hub
        const primaryHub = gameNodes.find((g) => g.fx === 0 && g.fy === -30) || gameNodes[0];
        links.push({
          source: p.player_id,
          target: primaryHub.id,
          label: spend === 0 ? "BASE_GAME_RETAIL_OWNER" : "ACTIVE_MODE_PLAYER",
          value: 2,
        });
      }

      // B. In-Game Purchases (OWNS_SKU) — At most ONE highest-value purchase per player
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
          value: 2.5,
          isTriggerStream: spend >= 1500 && i % 6 === 0,
        });
      } else {
        // Archetype Affinity edge (at most 1 link for non-purchasers)
        const candidates = offerNodes.filter((off) => {
          const o = off.offer_data as OfferRow | undefined;
          if (!o) return false;
          if (gameFilter !== "ALL" && o.target_franchise !== gameFilter) return false;
          return o.affinity_archetype === p.primary_archetype;
        });
        if (candidates.length > 0) {
          const target = candidates[i % candidates.length];
          links.push({
            source: p.player_id,
            target: target.id,
            label: "ARCHETYPE_AFFINITY",
            value: 1.5,
          });
        }
      }

      // C. Social Creator & Clan Connections
      if (creatorNodes.length > 0 && p.followed_creators && p.followed_creators.length > 0) {
        const matchedCreator = creatorNodes.find((c) =>
          p.followed_creators.includes(c.id)
        );
        if (matchedCreator && i % 2 === 0) {
          links.push({
            source: p.player_id,
            target: matchedCreator.id,
            label: "FOLLOWS_CREATOR",
            value: 1.5,
          });
        }
      }

      if (clanNodes.length > 0) {
        const matchingClan = clanNodes.find((cl) => cl.franchise === p.primary_franchise);
        if (matchingClan && i % 4 === 0) {
          links.push({
            source: p.player_id,
            target: matchingClan.id,
            label: "MEMBER_OF_CLAN",
            value: 1.8,
          });
        }
      }

      // D. Situational Friction: Cheap recovery SKU for true severe tilt slumps
      if (p.tilt_sensitivity >= 0.70 && p.recent_loss_streak >= 3) {
        const starter = offerNodes.find((off) => {
          const o = off.offer_data as OfferRow | undefined;
          return (
            !!o &&
            (gameFilter === "ALL" || o.target_franchise === gameFilter) &&
            o.price_usd <= 5
          );
        });
        if (starter) {
          links.push({
            source: p.player_id,
            target: starter.id,
            label: "STARTER_PACK_INTENT",
            value: 2,
            isTriggerStream: p.churn_risk_score >= 0.65 && i % 4 === 0,
          });
        }
      }
    });

    return NextResponse.json({ nodes, links } as GraphData);
  } catch (error: any) {
    if (error instanceof SpannerUnavailableError) {
      console.error("[graph/view] Spanner unavailable:", error.message);
      return NextResponse.json(
        { error: error.message, error_kind: "SPANNER_UNAVAILABLE" },
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
