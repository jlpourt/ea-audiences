import { NextResponse } from "next/server";
import { runRawGql, toNumber } from "@/lib/gcp/spanner-client";
import { archetypeLabel } from "@/lib/archetypes";

export const dynamic = "force-dynamic";

export interface NBAMarketData {
  id: string;
  dma_market: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  player_count: number;
  avg_spend: number;
  cliff_count: number;
  nba2k26_bridge_count: number;
  avg_gravity_score: number;
  top_archetype: string;
  top_archetype_label: string;
  team_affinity: string;
}

const MARKET_AFFINITIES: Record<string, string> = {
  "Atlanta DMA": "Atlanta Hawks",
  "Boston DMA": "Boston Celtics",
  "Brooklyn DMA": "Brooklyn Nets",
  "Charlotte DMA": "Charlotte Hornets",
  "Chicago DMA": "Chicago Bulls",
  "Cleveland DMA": "Cleveland Cavaliers",
  "Dallas DMA": "Dallas Mavericks",
  "Denver DMA": "Denver Nuggets",
  "Detroit DMA": "Detroit Pistons",
  "Bay Area DMA": "Golden State Warriors",
  "Golden State DMA": "Golden State Warriors",
  "Houston DMA": "Houston Rockets",
  "Indianapolis DMA": "Indiana Pacers",
  "Indiana DMA": "Indiana Pacers",
  "Los Angeles DMA": "LA Lakers / Clippers",
  "Memphis DMA": "Memphis Grizzlies",
  "Miami DMA": "Miami Heat",
  "Milwaukee DMA": "Milwaukee Bucks",
  "Minneapolis DMA": "Minnesota Timberwolves",
  "New Orleans DMA": "New Orleans Pelicans",
  "New York DMA": "New York Knicks",
  "Oklahoma City DMA": "OKC Thunder",
  "Orlando DMA": "Orlando Magic",
  "Philadelphia DMA": "Philadelphia 76ers",
  "Phoenix DMA": "Phoenix Suns",
  "Portland DMA": "Portland Trail Blazers",
  "Sacramento DMA": "Sacramento Kings",
  "San Antonio DMA": "San Antonio Spurs",
  "Salt Lake City DMA": "Utah Jazz",
  "Toronto DMA": "Toronto Raptors",
  "Washington DC DMA": "Washington Wizards",
  "London DMA": "NBA Europe · London Hub",
  "Paris DMA": "NBA Europe · Paris (Wemby)",
  "Manila DMA": "NBA Asia · Philippines Hoops",
  "São Paulo DMA": "NBA Latin America · Brazil",
  "Sydney DMA": "NBA Australasia · Sydney",
};

export async function GET() {
  const started = Date.now();
  try {
    const marketQuery = `
      SELECT
        p.dma_market,
        p.country,
        p.country_code,
        AVG(p.lat) as avg_lat,
        AVG(p.lng) as avg_lng,
        COUNT(p.player_id) as player_count,
        AVG(p.lifetime_spend_usd) as avg_spend,
        COUNTIF(LAX_INT64(p.game_telemetry.myplayer_ovr) < 85 AND LAX_INT64(p.game_telemetry.last_login_days_ago) >= 7) as cliff_count,
        COUNTIF(LAX_BOOL(p.game_telemetry.nba2k26_veteran) AND NOT LAX_BOOL(p.game_telemetry.migrated_to_2k27)) as nba2k26_bridge_count,
        AVG(LAX_FLOAT64(p.game_telemetry.gravity_score)) as avg_gravity_score
      FROM Players p
      WHERE p.dma_market IS NOT NULL
      GROUP BY p.dma_market, p.country, p.country_code
      ORDER BY player_count DESC
    `;

    const archQuery = `
      SELECT
        p.dma_market,
        p.primary_archetype,
        COUNT(p.player_id) as arch_count
      FROM Players p
      WHERE p.dma_market IS NOT NULL
      GROUP BY p.dma_market, p.primary_archetype
      ORDER BY p.dma_market, arch_count DESC
    `;

    const [marketRows, archRows] = await Promise.all([
      runRawGql(marketQuery),
      runRawGql(archQuery),
    ]);

    // Build map of top archetype per DMA
    const topArchMap = new Map<string, string>();
    for (const row of archRows) {
      const dma = String(row.dma_market);
      if (!topArchMap.has(dma)) {
        topArchMap.set(dma, String(row.primary_archetype));
      }
    }

    const markets: NBAMarketData[] = marketRows.map((r: any) => {
      const dma = String(r.dma_market);
      const topArch = topArchMap.get(dma) || "MYCAREER_STORY_CASUAL";
      return {
        id: dma.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        dma_market: dma,
        country: String(r.country || "USA"),
        country_code: String(r.country_code || "US"),
        lat: toNumber(r.avg_lat),
        lng: toNumber(r.avg_lng),
        player_count: toNumber(r.player_count),
        avg_spend: Math.round(toNumber(r.avg_spend)),
        cliff_count: toNumber(r.cliff_count),
        nba2k26_bridge_count: toNumber(r.nba2k26_bridge_count),
        avg_gravity_score: Number(toNumber(r.avg_gravity_score).toFixed(3)),
        top_archetype: topArch,
        top_archetype_label: archetypeLabel(topArch),
        team_affinity: MARKET_AFFINITIES[dma] || dma,
      };
    });

    const execution_ms = Date.now() - started;

    return NextResponse.json({
      ok: true,
      markets,
      total_markets: markets.length,
      execution_ms,
      source: "live_spanner",
    });
  } catch (error: any) {
    console.error("[marketing-markets] Spanner error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to query NBA markets" },
      { status: 500 }
    );
  }
}
