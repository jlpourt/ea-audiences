import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { GraphData, GraphNode, GraphLink } from "@/lib/types";

function loadJson(filename: string) {
  const filepath = path.join(process.cwd(), "data", filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }
  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "audience-cohorts";
  const selectedPlayerId = searchParams.get("playerId") || "ea-usr-00001";
  const gameFilter = searchParams.get("game") || "ALL";
  const archetypeFilter = searchParams.get("archetype") || "ALL";

  const masterPlayers = loadJson("master_players.json");
  const platformIdentities = loadJson("platform_identities.json");
  const hasIdentityEdges = loadJson("has_identity_edges.json");
  const games = loadJson("games.json");
  const playedEdges = loadJson("played_game_edges.json");
  const offers = loadJson("marketing_offers.json");

  let nodes: GraphNode[] = [];
  let links: GraphLink[] = [];

  // ==========================================
  // VIEW 1: SINGLE PLAYER IDENTITY RESOLUTION
  // ==========================================
  if (view === "single-identity") {
    const player = masterPlayers.find((p: any) => p.player_id === selectedPlayerId) || masterPlayers[0];
    
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

    const pEdges = hasIdentityEdges.filter((e: any) => e.player_id === player.player_id);
    for (const e of pEdges) {
      const ident = platformIdentities.find((i: any) => i.identity_id === e.identity_id);
      if (ident) {
        let identColor = "#00F0FF";
        if (ident.platform.includes("BATTLE")) identColor = "#00F0FF";
        else if (ident.platform.includes("KING")) identColor = "#EC4899";
        else if (ident.platform.includes("PLAY")) identColor = "#0070D1";
        else if (ident.platform.includes("XBOX")) identColor = "#107C10";
        else if (ident.platform.includes("STEAM")) identColor = "#9146FF";
        else if (ident.platform.includes("SWITCH")) identColor = "#E60012";

        nodes.push({
          id: ident.identity_id,
          name: `${ident.platform}: ${ident.platform_handle}`,
          type: "IDENTITY",
          platform: ident.platform,
          confidence: ident.confidence_score,
          val: 15,
          color: identColor,
        });

        links.push({
          source: player.player_id,
          target: ident.identity_id,
          label: `CONFIDENCE: ${(ident.confidence_score * 100).toFixed(0)}%`,
          value: 3,
        });
      }
    }
  }

  // ==========================================
  // VIEW 2: MULTI-FRANCHISE & GAME-SPECIFIC COHORTS
  // ==========================================
  else {
    let targetPlayers = masterPlayers;
    let targetGames = games;
    let targetOffers = offers;

    // 1. Filter by Game Franchise if not ALL
    if (gameFilter !== "ALL") {
      targetPlayers = masterPlayers.filter(
        (p: any) => p.primary_franchise === gameFilter || (p.franchises_played && p.franchises_played.includes(gameFilter))
      );
      targetGames = games.filter((g: any) => g.franchise === gameFilter);
      targetOffers = offers.filter((o: any) => o.target_franchise === gameFilter);
    }

    // 2. Filter by Archetype if specified
    if (archetypeFilter !== "ALL") {
      targetPlayers = targetPlayers.filter((p: any) => p.primary_archetype === archetypeFilter);
    }

    const sample = targetPlayers.slice(0, 450);

    // 3. Anchor Coordinates Calculation
    if (gameFilter === "ALL") {
      // 5 Grand Franchise Hubs
      const macroHubPositions: Record<string, { fx: number; fy: number; color: string }> = {
        "game-cod": { fx: -340, fy: -180, color: "#F59E0B" },      // CoD Amber
        "game-wow": { fx: 340, fy: -180, color: "#00F0FF" },       // WoW Cyan
        "game-diablo": { fx: -340, fy: 180, color: "#FF334B" },    // Diablo Crimson
        "game-ow2": { fx: 340, fy: 180, color: "#38BDF8" },       // Overwatch Sky Blue
        "game-candy": { fx: 0, fy: 0, color: "#EC4899" },          // Candy Crush Pink
      };

      const parentGames = games.filter((g: any) => g.is_parent_hub);
      for (const g of parentGames) {
        const pos = macroHubPositions[g.game_id];
        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          val: 36,
          color: pos?.color || "#00F0FF",
          fx: pos?.fx,
          fy: pos?.fy,
        });
      }

      // Macro Top Major DLC & Monetization Wells (100% Real Official Store Products)
      const macroOfferPositions: Record<string, { fx: number; fy: number }> = {
        "off-cod-01": { fx: -500, fy: -260 },
        "off-cod-03": { fx: -460, fy: -80 },
        "off-wow-01": { fx: 500, fy: -260 },
        "off-wow-03": { fx: 460, fy: -80 },
        "off-diablo4-01": { fx: -480, fy: 260 },
        "off-overwatch2-01": { fx: 480, fy: 260 },
        "off-candycrush-01": { fx: 0, fy: -140 },
        "off-candycrush-02": { fx: 0, fy: 140 },
      };

      for (const o of offers) {
        if (macroOfferPositions[o.offer_id]) {
          const isMajorDlc = o.offer_type.includes("MAJOR_DLC") || o.price_usd >= 60;
          nodes.push({
            id: o.offer_id,
            name: `${o.offer_title} ($${o.price_usd})`,
            type: "OFFER",
            franchise: o.target_franchise,
            spend: o.price_usd,
            val: isMajorDlc ? 34 : 26,
            color: isMajorDlc ? "#FFB800" : o.price_usd >= 30 ? "#A855F7" : "#EC4899",
            offer_data: o,
            fx: macroOfferPositions[o.offer_id].fx,
            fy: macroOfferPositions[o.offer_id].fy,
          });
        }
      }
    } else {
      // Specific Game Selected -> Sub-modes and All Game Offers & Major DLCs
      const subGames = targetGames.filter((g: any) => !g.is_parent_hub);
      const activeGames = subGames.length > 0 ? subGames : targetGames;

      activeGames.forEach((g: any, idx: number) => {
        const angle = (idx / activeGames.length) * 2 * Math.PI - Math.PI / 2;
        const radius = 220;
        const fx = Math.round(Math.cos(angle) * radius);
        const fy = Math.round(Math.sin(angle) * radius);

        nodes.push({
          id: g.game_id,
          name: g.title,
          type: "GAME",
          franchise: g.franchise,
          val: 32,
          color: g.franchise === "COD" ? "#F59E0B" : g.franchise === "WOW" ? "#00F0FF" : g.franchise === "DIABLO4" ? "#FF334B" : g.franchise === "OVERWATCH2" ? "#38BDF8" : "#EC4899",
          fx,
          fy,
        });
      });

      // Position Major DLCs and In-Game Offers in Outer Orbit
      targetOffers.forEach((o: any, idx: number) => {
        const angle = (idx / targetOffers.length) * 2 * Math.PI;
        const radius = 390;
        const fx = Math.round(Math.cos(angle) * radius);
        const fy = Math.round(Math.sin(angle) * radius);

        const isMajorDlc = o.offer_type.includes("MAJOR_DLC") || o.price_usd >= 60;
        const itemColor = isMajorDlc ? "#FFB800" : o.price_usd >= 30 ? "#A855F7" : o.price_usd <= 5 ? "#FF4757" : "#EC4899";

        nodes.push({
          id: o.offer_id,
          name: `${o.offer_title} ($${o.price_usd})`,
          type: "OFFER",
          franchise: o.target_franchise,
          spend: o.price_usd,
          val: isMajorDlc ? 32 : o.price_usd >= 30 ? 28 : 22,
          color: itemColor,
          offer_data: o,
          fx,
          fy,
        });
      });
    }

    // 4. Player Nodes Generation
    for (let idx = 0; idx < sample.length; idx++) {
      const p = sample[idx];
      let nodeColor = "#00FF88";

      if (p.primary_archetype === "COMPETITIVE_GRINDER" || p.primary_archetype === "RANKED_SWEAT") {
        nodeColor = "#FF4757"; // Sweat / Tilt Red
      } else if (p.primary_archetype === "ULTIMATE_TEAM_WHALE" || p.primary_archetype === "BLACKCELL_WHALE" || p.primary_archetype === "SANCTUARY_COLLECTOR" || p.primary_archetype === "BOOSTER_WHALE" || p.primary_archetype === "HEIRLOOM_WHALE" || p.primary_archetype === "MUT_WHALE" || p.primary_archetype === "SIMS_COLLECTOR") {
        nodeColor = "#FFB800"; // Whale Gold
      } else if (p.primary_archetype === "LORE_SEEKER" || p.primary_archetype === "BUILDER_CREATOR") {
        nodeColor = "#00F0FF"; // Cyan
      } else if (p.primary_archetype === "MYTHIC_RAIDER") {
        nodeColor = "#38BDF8"; // Raider Sky Blue
      }

      const size = p.lifetime_spend_usd >= 3000 ? 14 : p.lifetime_spend_usd >= 500 ? 9 : 6;

      nodes.push({
        id: p.player_id,
        name: p.display_name,
        type: "PLAYER",
        franchise: p.primary_franchise,
        archetype: p.primary_archetype,
        spend: p.lifetime_spend_usd,
        churn_risk: p.churn_risk_score,
        tilt: p.tilt_sensitivity,
        loss_streak: p.recent_loss_streak || 0,
        game_telemetry: p.game_telemetry,
        purchased_items: (p as any).purchased_items || [],
        val: size,
        color: nodeColor,
      });
    }

    // 5. Connect Links with Realistic User Purchase Diversity
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.type === "PLAYER") {
        const rawPlayer = sample.find((p: any) => p.player_id === n.id);
        if (!rawPlayer) continue;
        const playerSpend = n.spend || 0;
        const isWhale = playerSpend >= 1000;
        const isMidSpender = playerSpend >= 100 && playerSpend < 1000;
        const isLowSpender = playerSpend > 0 && playerSpend < 100;
        const isBaseGameOnly = playerSpend === 0 || (playerSpend <= 70 && rawPlayer.primary_archetype === "LORE_SEEKER");

        // A. Primary Game Ownership / Play Connection
        if (gameFilter === "ALL") {
          const parentHubId = `game-${rawPlayer.primary_franchise.toLowerCase()}`;
          if (nodes.some((item) => item.id === parentHubId)) {
            links.push({
              source: n.id,
              target: parentHubId,
              label: isBaseGameOnly ? "BASE_GAME_RETAIL_PURCHASER" : "PRIMARY_FRANCHISE_PLAYER",
              value: 2,
            });
          }

          // Cross-Franchise Play Edges (e.g. FC player playing Apex on weekends)
          if (rawPlayer.franchises_played && rawPlayer.franchises_played.length > 1) {
            for (let j = 1; j < rawPlayer.franchises_played.length; j++) {
              const secHubId = `game-${rawPlayer.franchises_played[j].toLowerCase()}`;
              if (nodes.some((item) => item.id === secHubId)) {
                links.push({
                  source: n.id,
                  target: secHubId,
                  label: "CROSS_FRANCHISE_PLAY",
                  value: 1,
                  isTriggerStream: i % 5 === 0,
                });
              }
            }
          }
        } else {
          // Specific Game Mode Linking
          const matchedModes = nodes.filter((item) => item.type === "GAME");
          if (matchedModes.length > 0) {
            links.push({
              source: n.id,
              target: matchedModes[i % matchedModes.length].id,
              label: isBaseGameOnly ? "BASE_GAME_RETAIL_OWNER" : "ACTIVE_MODE_PLAYER",
              value: 2,
            });
          }
        }

        // B. Tiered In-Game Purchases & DLC Ownership Connections
        const availableOffers = nodes.filter((item) => item.type === "OFFER");

        // Category 1: Whales ($1,000+ LTV) -> Connect to Major DLC Upgrades & Currency Vaults
        if (isWhale) {
          const whaleOffers = availableOffers.filter(
            (off) =>
              off.spend &&
              off.spend >= 45 &&
              (off.offer_data?.affinity_archetype === n.archetype || off.franchise === n.franchise)
          );
          if (whaleOffers.length > 0) {
            const targetOffer = whaleOffers[i % whaleOffers.length];
            links.push({
              source: n.id,
              target: targetOffer.id,
              label: targetOffer.offer_data?.offer_type.includes("MAJOR_DLC") ? "MAJOR_DLC_PURCHASE" : "MONETIZATION_GRAVITY",
              value: 3,
              isTriggerStream: true,
            });
          }
        }

        // Category 2: Mid-Tier Spenders ($100 - $999 LTV) -> Connect to Expansion Packs, Collab Skins, and Battle Passes
        else if (isMidSpender) {
          const midOffers = availableOffers.filter(
            (off) =>
              off.spend &&
              off.spend >= 10 &&
              off.spend <= 40 &&
              (off.franchise === n.franchise || off.offer_data?.affinity_archetype === n.archetype)
          );
          if (midOffers.length > 0) {
            const targetOffer = midOffers[i % midOffers.length];
            links.push({
              source: n.id,
              target: targetOffer.id,
              label: targetOffer.offer_data?.offer_type.includes("EXPANSION") ? "EXPANSION_DLC_OWNER" : "SEASONAL_PASS_HOLDER",
              value: 2,
            });
          }
        }

        // Category 3: Low-Tier & Social Spenders ($10 - $90 LTV) -> Connect to Squad Passes, Creator Kits, XP Boosters
        else if (isLowSpender) {
          const lowOffers = availableOffers.filter((off) => off.spend && off.spend <= 10 && off.franchise === n.franchise);
          if (lowOffers.length > 0) {
            const targetOffer = lowOffers[i % lowOffers.length];
            links.push({
              source: n.id,
              target: targetOffer.id,
              label: "CREATOR_OR_SQUAD_PASS",
              value: 1.5,
            });
          }
        }

        // Category 4: Entry Tier Store Packs (For active / loss-streak players seeking quick squad boosters)
        if ((n.tilt && n.tilt >= 0.60) || (n.loss_streak && n.loss_streak >= 2)) {
          const starterOffer = availableOffers.find(
            (off) =>
              (off.offer_data?.offer_type === "CURRENCY_STARTER" || (off.spend !== undefined && off.spend <= 5)) &&
              off.franchise === n.franchise
          );
          if (starterOffer) {
            links.push({
              source: n.id,
              target: starterOffer.id,
              label: "STARTER_PACK_INTENT",
              value: 2,
              isTriggerStream: true,
            });
          }
        }

        // Category 5: Zero-MTX / Base Game Purchasers -> Have 0 store links, only the base game node link above!
      }
    }
  }

  const payload: GraphData = { nodes, links };
  return NextResponse.json(payload);
}
