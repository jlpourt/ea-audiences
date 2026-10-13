import { NextResponse } from "next/server";
import { runRawGql, toNumber } from "@/lib/gcp/spanner-client";
import { GRAPH_NAME } from "@/lib/gcp/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const [
    playerRows,
    crewRows,
    crossRows,
    identRows,
    play1Rows,
    play2Rows,
    play3Rows,
    play4Rows,
    play5Rows,
  ] = await Promise.all([
    runRawGql(`GRAPH ${GRAPH_NAME} MATCH (p:Player) RETURN COUNT(p) AS n`),
    runRawGql(`SELECT COUNT(*) AS n FROM Clans`),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)-[:PLAYS_GAME]->(g:Game)
       WHERE g.franchise <> 'NBA2K'
       RETURN COUNT(DISTINCT p.player_id) AS n`
    ),
    runRawGql(`SELECT COUNT(*) AS n FROM Identities`),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
       WHERE p.primary_franchise = 'NBA2K'
         AND INT64(p.game_telemetry.myplayer_ovr) < 85
         AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50
         AND INT64(p.game_telemetry.last_login_days_ago) >= 7
         AND INT64(mate.game_telemetry.last_login_days_ago) <= 3
         AND p.player_id <> mate.player_id
       RETURN COUNT(DISTINCT p.player_id) AS n`
    ),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
             (p)-[:PLAYS_GAME]->(g:Game {game_id: 'game-nba2k26'})
       WHERE BOOL(p.game_telemetry.nba2k26_veteran) = true
         AND FLOAT64(p.game_telemetry.nba2k26_spend_usd) > 0
         AND BOOL(p.game_telemetry.migrated_to_2k27) = false
         AND FLOAT64(p.game_telemetry.myteam_vc_spend_90d) > 0
       RETURN COUNT(DISTINCT p.player_id) AS n`
    ),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)
       WHERE INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 10
         AND STRING(p.game_telemetry.season_pass_edition) = 'HALL_OF_FAME'
       RETURN COUNT(p.player_id) AS n`
    ),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
             (p)-[:PLAYS_GAME]->(g:Game)
       WHERE g.franchise IN ('WWE2K', 'PGA2K', 'TOPSPIN', 'BL4', 'CIV7', 'MAFIA')
         AND p.lifetime_spend_usd >= 150
       RETURN COUNT(DISTINCT p.player_id) AS n`
    ),
    runRawGql(
      `GRAPH ${GRAPH_NAME}
       MATCH (p:Player)-[:FOLLOWS_CREATOR]->(c:Creator)
       WHERE c.franchise = 'NBA2K'
         AND p.lifetime_spend_usd >= 200
       RETURN COUNT(DISTINCT p.player_id) AS n`
    ),
  ]);

  const play2Count = toNumber(play2Rows[0]?.n);
  const cross2kCount = toNumber(crossRows[0]?.n);

  return NextResponse.json({
    ok: true,
    graph: GRAPH_NAME,
    players: toNumber(playerRows[0]?.n),
    crews: toNumber(crewRows[0]?.n),
    cross_2k_players: cross2kCount,
    cross_label_identities: cross2kCount,
    identities: toNumber(identRows[0]?.n),
    play_counts: {
      play1_season2_cliff: toNumber(play1Rows[0]?.n),
      play2_2k26_bridge: play2Count,
      play2_cross_label_gravity: play2Count,
      play3_myteam_whales: toNumber(play3Rows[0]?.n),
      play4_2k_crossplay: toNumber(play4Rows[0]?.n),
      play5_creator_crews: toNumber(play5Rows[0]?.n),
    },
    execution_ms: Date.now() - started,
  });
}
