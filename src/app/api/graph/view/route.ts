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
} from "@/lib/gcp/catalog";

export const dynamic = "force-dynamic";

/** Cap on drawn player nodes. A rendering budget, never an audience size. */
const RENDER_LIMIT = 450;

const PLATFORM_COLORS: Record<string, string> = {
  BATTLE_NET: "#00AEFF",
  KING_MOBILE_ID: "#EC4899",
  PLAYSTATION_NETWORK: "#0070D1",
  XBOX_LIVE: "#107C10",
  STEAM: "#9146FF",
  NINTENDO_SWITCH: "#E60012",
};

/** Macro-view hub anchor positions, keyed by the canonical hub id. */
const MACRO_HUB_POSITIONS: Record<string, { fx: number; fy: number }> = {
  "game-cod": { fx: -340, fy: -180 },
  "game-wow": { fx: 340, fy: -180 },
  "game-diablo4": { fx: -340, fy: 180 },
  "game-overwatch2": { fx: 340, fy: 180 },
  "game-candycrush": { fx: 0, fy: 0 },
};

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
    name: `${o.offer_title} ($${o.price_usd})`,
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
      // Previously this defaulted to a hardcoded player id, which
      // does not exist in the ABK dataset, so `find` returned undefined and
      // the view silently fell back to whichever player happened to be first.
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

      // Traversed through the graph rather than joined in JS across two files.
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
    const [{ games, offers }, players] = await Promise.all([
      getCatalog(),
      getPlayersForView({
        franchise: gameFilter,
        archetype: archetypeFilter,
        limit: RENDER_LIMIT,
      }),
    ]);

    if (gameFilter === "ALL") {
      // ---- Franchise hubs -------------------------------------------------
      const hubs = games.filter((g) => g.is_parent_hub);
      for (const g of hubs) {
        const pos = MACRO_HUB_POSITIONS[g.game_id];
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          val: 36,
          color: FRANCHISE_COLORS[g.franchise] || "#00F0FF",
          fx: pos?.fx,
          fy: pos?.fy,
        });
      }

      // ---- Monetisation poles ---------------------------------------------
      // The previous implementation listed eight specific offer ids by hand,
      // so renumbering the catalog silently emptied this ring.
      //
      // It now draws TWO offers per franchise, chosen to bracket the range:
      // the most expensive current SKU and the cheapest. Taking the top two by
      // price was tried first and showed only whale SKUs, which hides the
      // situational-recovery half of the story — the $0.99 "extra moves" and
      // $4.99 CP top-up are precisely what the tilt triggers point at.
      const perFranchise = new Map<string, OfferRow[]>();
      for (const o of offers) {
        if (!o.target_franchise) continue;
        if (o.lifecycle_status === "LEGACY") continue;
        const list = perFranchise.get(o.target_franchise) || [];
        list.push(o);
        perFranchise.set(o.target_franchise, list);
      }

      for (const [franchise, list] of perFranchise) {
        const hubPos = MACRO_HUB_POSITIONS[HUB_ID_BY_FRANCHISE[franchise]];
        if (!hubPos) continue;
        const sorted = [...list].sort((a, b) => b.price_usd - a.price_usd);
        const headline = sorted[0];
        const recovery = sorted[sorted.length - 1];
        const picks =
          headline && recovery && headline.offer_id !== recovery.offer_id
            ? [headline, recovery]
            : [headline].filter(Boolean);

        picks.forEach((o, idx) => {
          // Park the offers just outside their hub so the ring reads as
          // "this franchise's money", not as a decorative border.
          const spreadX = hubPos.fx === 0 ? 0 : hubPos.fx < 0 ? -150 : 150;
          const spreadY = idx === 0 ? -80 : 80;
          nodes.push(offerNode(o, hubPos.fx + spreadX, hubPos.fy + spreadY));
        });
      }
    } else {
      // ---- Single franchise: draw its surfaces and its full offer set -----
      const franchiseGames = games.filter((g) => g.franchise === gameFilter);
      const surfaces = franchiseGames.filter((g) => !g.is_parent_hub);
      const activeGames: GameRow[] = surfaces.length ? surfaces : franchiseGames;

      activeGames.forEach((g, idx) => {
        const angle = (idx / activeGames.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 220;
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          // Legacy and sunset surfaces read as dimmer, smaller satellites:
          // they are real revenue but not where the roadmap is.
          val: g.lifecycle_status === "LIVE" ? 32 : 22,
          color:
            g.lifecycle_status === "LIVE"
              ? FRANCHISE_COLORS[g.franchise] || "#00F0FF"
              : g.lifecycle_status === "UPCOMING"
              ? "#A855F7"
              : "#6B7280",
          lifecycle_status: g.lifecycle_status ?? undefined,
          current_season: g.current_season ?? undefined,
          fx: Math.round(Math.cos(angle) * radius),
          fy: Math.round(Math.sin(angle) * radius),
        });
      });

      const franchiseOffers = offers.filter((o) => o.target_franchise === gameFilter);
      franchiseOffers.forEach((o, idx) => {
        const angle = (idx / franchiseOffers.length) * 2 * Math.PI;
        const radius = 390;
        nodes.push(
          offerNode(
            o,
            Math.round(Math.cos(angle) * radius),
            Math.round(Math.sin(angle) * radius)
          )
        );
      });
    }

    // ---- Player nodes -----------------------------------------------------
    for (const p of players) {
      // Colour comes from the canonical registry so a new or renamed archetype
      // can never silently fall through to the default green again.
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

    // ---- Links ------------------------------------------------------------
    const offerNodes = nodes.filter((n) => n.type === "OFFER");
    const gameNodes = nodes.filter((n) => n.type === "GAME");
    const drawnIds = new Set(nodes.map((n) => n.id));

    players.forEach((p: any, i: number) => {
      const spend: number = p.lifetime_spend_usd;

      // A. Franchise / surface ownership
      if (gameFilter === "ALL") {
        // Hub ids come from the canonical lookup, NOT from interpolating the
        // franchise code. The interpolated form produced ids that three of the
        // five franchises did not use, so those players drew no franchise edge.
        const hubId = HUB_ID_BY_FRANCHISE[p.primary_franchise];
        if (hubId && drawnIds.has(hubId)) {
          links.push({
            source: p.player_id,
            target: hubId,
            label: spend === 0 ? "BASE_GAME_RETAIL_PURCHASER" : "PRIMARY_FRANCHISE_PLAYER",
            value: 2,
          });
        }
        for (const f of p.franchises_played as string[]) {
          if (f === p.primary_franchise) continue;
          const secId = HUB_ID_BY_FRANCHISE[f];
          if (secId && drawnIds.has(secId)) {
            links.push({
              source: p.player_id,
              target: secId,
              label: "CROSS_FRANCHISE_PLAY",
              value: 1,
              isTriggerStream: i % 5 === 0,
            });
          }
        }
      } else if (gameNodes.length > 0) {
        const target = gameNodes[i % gameNodes.length];
        links.push({
          source: p.player_id,
          target: target.id,
          label: spend === 0 ? "BASE_GAME_RETAIL_OWNER" : "ACTIVE_MODE_PLAYER",
          value: 2,
        });
      }

      // B. Purchases. Where a player owns a REAL SKU that is drawn, link to it
      // directly — this is revealed preference rather than an inference from
      // their spend tier, and it is what makes the offer ring meaningful.
      const owned = new Set<string>(
        (p.purchased_items || [])
          .map((it: any) => it?.offer_id)
          .filter(Boolean)
      );
      let linkedRealPurchase = false;
      for (const offerId of owned) {
        if (!drawnIds.has(offerId)) continue;
        links.push({
          source: p.player_id,
          target: offerId,
          label: "OWNS_SKU",
          value: 3,
          isTriggerStream: spend >= 1000,
        });
        linkedRealPurchase = true;
      }

      // C. Affinity edge for players with no drawn purchase: the single offer
      // whose affinity archetype matches theirs, within their spend band.
      if (!linkedRealPurchase) {
        const band = spend >= 1000 ? 45 : spend >= 100 ? 10 : 0;
        const candidates = offerNodes.filter((off) => {
          const o = off.offer_data as OfferRow | undefined;
          if (!o) return false;
          if (o.target_franchise !== p.primary_franchise) return false;
          if (o.price_usd < band) return false;
          return o.affinity_archetype === p.primary_archetype;
        });
        if (candidates.length) {
          const target = candidates[i % candidates.length];
          links.push({
            source: p.player_id,
            target: target.id,
            label: "ARCHETYPE_AFFINITY",
            value: 1.5,
          });
        }
      }

      // D. Situational friction: a cheap recovery SKU for tilted players.
      if (p.tilt_sensitivity >= 0.6 || p.recent_loss_streak >= 2) {
        const starter = offerNodes.find((off) => {
          const o = off.offer_data as OfferRow | undefined;
          return (
            !!o &&
            o.target_franchise === p.primary_franchise &&
            o.price_usd <= 5
          );
        });
        if (starter) {
          links.push({
            source: p.player_id,
            target: starter.id,
            label: "STARTER_PACK_INTENT",
            value: 2,
            isTriggerStream: true,
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
