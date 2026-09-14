import { Spanner } from "@google-cloud/spanner";
import { GCP_CONFIG } from "../config";
import fs from "fs";
import path from "path";

let spannerClient: Spanner | null = null;

export function getSpannerDatabase() {
  if (!spannerClient) {
    spannerClient = new Spanner({ projectId: GCP_CONFIG.projectId });
  }
  const instance = spannerClient.instance(GCP_CONFIG.spannerInstanceId);
  return instance.database(GCP_CONFIG.spannerDatabaseId);
}

export function loadLocalMasterPlayers() {
  try {
    const playersPath = path.join(process.cwd(), "data/master_players.json");
    if (fs.existsSync(playersPath)) {
      const raw = fs.readFileSync(playersPath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("[Local Fallback] Error reading master players:", e);
  }
  return [];
}

export async function runSpannerGraphQuery(
  gqlQuery: string,
  params: Record<string, any> = {},
  sourceMode: "live_spanner" | "local" = "local"
) {
  const startTime = Date.now();
  let cleanedGql = gqlQuery.trim();
  
  if (!cleanedGql.startsWith("GRAPH ")) {
    cleanedGql = `GRAPH ABKPlayerGraph\n${cleanedGql}`;
  }

  // Ensure node table reference matches Spanner DDL (Players table)
  cleanedGql = cleanedGql.replace(/MATCH\s*\(\s*p:Player\s*\)/gi, "MATCH (p:Players)");

  console.log(`[Spanner Engine Mode]: ${sourceMode.toUpperCase()}`);

  if (sourceMode === "live_spanner") {
    try {
      console.log(`[Cloud Spanner Live GQL Executing]:\n${cleanedGql}`);
      const database = getSpannerDatabase();
      const [rows] = await database.run({
        sql: cleanedGql,
        params,
      });

      if (rows && rows.length > 0) {
        const executionTimeMs = Date.now() - startTime;
        console.log(`[Cloud Spanner Result]: Successfully returned ${rows.length} rows in ${executionTimeMs}ms`);
        
        const mappedRows = rows.map((r: any) => {
          let telemetry: any = {};
          let purchasedItems: any[] = [];
          try {
            if (r.telemetry_json) {
              telemetry = typeof r.telemetry_json === "string" ? JSON.parse(r.telemetry_json) : r.telemetry_json;
            }
          } catch (e) {}
          try {
            if (r.purchased_items_json) {
              purchasedItems = typeof r.purchased_items_json === "string" ? JSON.parse(r.purchased_items_json) : r.purchased_items_json;
            }
          } catch (e) {}

          return {
            player_id: r.player_id || r.p?.player_id,
            display_name: r.display_name || r.p?.display_name,
            gamer_tag: r.gamer_tag || r.p?.gamer_tag || r.display_name,
            primary_franchise: r.primary_franchise || r.p?.primary_franchise,
            franchises_played: [r.primary_franchise || r.p?.primary_franchise],
            primary_archetype: r.primary_archetype || r.p?.primary_archetype,
            lifetime_spend_usd: Number(r.lifetime_spend_usd || r.p?.lifetime_spend_usd || 0),
            churn_risk_score: Number(r.churn_risk_score || r.p?.churn_risk_score || 0),
            tilt_sensitivity: Number(r.tilt_sensitivity || r.p?.tilt_sensitivity || 0),
            recent_loss_streak: Number(r.recent_loss_streak || r.p?.recent_loss_streak || 0),
            country: r.country || r.p?.country || "United States",
            country_code: r.country_code || r.p?.country_code || "US",
            country_flag: r.country_flag || r.p?.country_flag || "🇺🇸",
            dma_market: r.dma_market || r.p?.dma_market || "London Metro",
            lat: Number(r.lat || r.p?.lat || 51.5074),
            lng: Number(r.lng || r.p?.lng || -0.1278),
            game_telemetry: telemetry,
            purchased_items: purchasedItems,
            followed_creators: r.followed_creators || telemetry?.followed_creators || [r.primary_creator_influence || "creator-scump"],
            primary_creator_influence: r.primary_creator_influence || telemetry?.primary_creator_influence || "creator-scump",
            favorite_club: r.favorite_club || r.p?.favorite_club || telemetry?.favorite_club || "OpTic Gaming",
            favorite_player: r.favorite_player || r.p?.favorite_player || telemetry?.favorite_player || "Seth 'Scump' Abner",
            favorite_formation: r.favorite_formation || r.p?.favorite_formation || telemetry?.favorite_formation || "MCW / Striker 9",
            _spanner_metadata: {
              source: "Google Cloud Spanner Enterprise (ABKPlayerGraph)",
              instance: GCP_CONFIG.spannerInstanceId,
              database: GCP_CONFIG.spannerDatabaseId,
              execution_time_ms: executionTimeMs,
              live: true,
            },
          };
        });

        return mappedRows;
      }
    } catch (error: any) {
      console.warn("[Cloud Spanner Notice - Falling back to Grounded Engine]:", error?.message || error);
    }
  }

  // Grounded Spanner Graph Execution against 5,000 Master Players
  const allPlayers = loadLocalMasterPlayers();
  const lowerGql = cleanedGql.toLowerCase();

  const limitMatch = cleanedGql.match(/LIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : 250;

  const spendMatch = cleanedGql.match(/lifetime_spend_usd\s*>=\s*([0-9.]+)/i);
  const minSpend = spendMatch ? parseFloat(spendMatch[1]) : null;

  const tiltMatch = cleanedGql.match(/tilt_sensitivity\s*>=\s*([0-9.]+)/i);
  const minTilt = tiltMatch ? parseFloat(tiltMatch[1]) : null;

  let filtered = allPlayers;

  // Franchise filtering
  if (lowerGql.includes("cod") && (lowerGql.includes("wow") || lowerGql.includes("diablo"))) {
    filtered = filtered.filter((p: any) => 
      p.primary_franchise === "COD" || p.primary_franchise === "WOW" || p.primary_franchise === "DIABLO4" ||
      (p.franchises_played && (p.franchises_played.includes("COD") || p.franchises_played.includes("WOW") || p.franchises_played.includes("DIABLO4")))
    );
  } else if (lowerGql.includes("cod") || lowerGql.includes("warzone")) {
    filtered = filtered.filter((p: any) => p.primary_franchise === "COD" || (p.franchises_played && p.franchises_played.includes("COD")));
  } else if (lowerGql.includes("wow") || lowerGql.includes("warcraft")) {
    filtered = filtered.filter((p: any) => p.primary_franchise === "WOW" || (p.franchises_played && p.franchises_played.includes("WOW")));
  } else if (lowerGql.includes("diablo")) {
    filtered = filtered.filter((p: any) => p.primary_franchise === "DIABLO4" || (p.franchises_played && p.franchises_played.includes("DIABLO4")));
  } else if (lowerGql.includes("overwatch")) {
    filtered = filtered.filter((p: any) => p.primary_franchise === "OVERWATCH2" || (p.franchises_played && p.franchises_played.includes("OVERWATCH2")));
  } else if (lowerGql.includes("candy")) {
    filtered = filtered.filter((p: any) => p.primary_franchise === "CANDYCRUSH" || (p.franchises_played && p.franchises_played.includes("CANDYCRUSH")));
  }

  // Archetype filtering
  if (lowerGql.includes("whale")) {
    filtered = filtered.filter((p: any) => 
      p.primary_archetype.includes("WHALE") || p.primary_archetype === "SIMS_COLLECTOR" || (p.lifetime_spend_usd >= 1000)
    );
  } else if (lowerGql.includes("casual_socializer") || lowerGql.includes("social")) {
    filtered = filtered.filter((p: any) => p.primary_archetype === "CASUAL_SOCIALIZER");
  } else if (lowerGql.includes("lore_seeker") || lowerGql.includes("builder")) {
    filtered = filtered.filter((p: any) => p.primary_archetype === "LORE_SEEKER" || p.primary_archetype === "BUILDER_CREATOR");
  } else if (lowerGql.includes("grinder") || lowerGql.includes("sweat")) {
    filtered = filtered.filter((p: any) => p.primary_archetype === "COMPETITIVE_GRINDER" || p.primary_archetype === "RANKED_SWEAT");
  }

  // Geographic Filtering
  if (lowerGql.includes("dallas")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("dallas"));
  } else if (lowerGql.includes("new york") || lowerGql.includes("nyc")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("new york"));
  } else if (lowerGql.includes("los angeles") || lowerGql.includes("lax")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("los angeles"));
  } else if (lowerGql.includes("chicago")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("chicago"));
  } else if (lowerGql.includes("london")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("london"));
  } else if (lowerGql.includes("manchester")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("manchester"));
  } else if (lowerGql.includes("paris")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("paris"));
  } else if (lowerGql.includes("madrid")) {
    filtered = filtered.filter((p: any) => p.dma_market && p.dma_market.toLowerCase().includes("madrid"));
  } else if (lowerGql.includes("berlin") || lowerGql.includes("germany") || lowerGql.includes("dach")) {
    filtered = filtered.filter((p: any) => (p.dma_market && p.dma_market.toLowerCase().includes("berlin")) || p.country === "Germany");
  } else if (lowerGql.includes("são paulo") || lowerGql.includes("sao paulo") || lowerGql.includes("brazil")) {
    filtered = filtered.filter((p: any) => (p.dma_market && p.dma_market.toLowerCase().includes("paulo")) || p.country === "Brazil");
  } else if (lowerGql.includes("tokyo") || lowerGql.includes("japan")) {
    filtered = filtered.filter((p: any) => (p.dma_market && p.dma_market.toLowerCase().includes("tokyo")) || p.country === "Japan");
  } else if (lowerGql.includes("riyadh") || lowerGql.includes("saudi") || lowerGql.includes("gcc")) {
    filtered = filtered.filter((p: any) => (p.dma_market && p.dma_market.toLowerCase().includes("riyadh")) || p.country === "Saudi Arabia");
  } else if (lowerGql.includes("united kingdom") || lowerGql.includes("uk")) {
    filtered = filtered.filter((p: any) => p.country === "United Kingdom");
  } else if (lowerGql.includes("united states") || lowerGql.includes("usa") || lowerGql.includes("us")) {
    filtered = filtered.filter((p: any) => p.country === "United States");
  }

  if (minSpend !== null) {
    filtered = filtered.filter((p: any) => p.lifetime_spend_usd >= minSpend);
    filtered.sort((a: any, b: any) => b.lifetime_spend_usd - a.lifetime_spend_usd);
  }

  if (minTilt !== null) {
    filtered = filtered.filter((p: any) => p.tilt_sensitivity >= minTilt || (p.recent_loss_streak && p.recent_loss_streak >= 2));
  }

  const resultRows = filtered.slice(0, limit).map((p: any) => ({
    player_id: p.player_id,
    display_name: p.display_name,
    primary_franchise: p.primary_franchise,
    franchises_played: p.franchises_played || [p.primary_franchise],
    primary_archetype: p.primary_archetype,
    lifetime_spend_usd: p.lifetime_spend_usd,
    churn_risk_score: p.churn_risk_score,
    tilt_sensitivity: p.tilt_sensitivity,
    recent_loss_streak: p.recent_loss_streak || 0,
    country: p.country,
    country_code: p.country_code || "US",
    country_flag: p.country_flag || "🇺🇸",
    dma_market: p.dma_market,
    lat: p.lat,
    lng: p.lng,
    followed_creators: p.followed_creators || [p.primary_creator_influence || "creator-scump"],
    primary_creator_influence: p.primary_creator_influence || "creator-scump",
    game_telemetry: p.game_telemetry || {},
    purchased_items: p.purchased_items || [],
  }));

  return resultRows;
}
