"""Audience NL-to-GQL Translation and Cohort Segmentation Agent for 2K Courtside."""

import logging
from typing import Dict, List, Any, Optional
from agents.app.schemas import AudienceNLQueryResponse
from agents.app.tools.spanner_graph_tools import run_spanner_gql_query

logger = logging.getLogger("twok.courtside.audience_agent")


class AudienceAgent:
  """ADK Agent that converts Natural Language requests into Spanner Graph GQL queries for 2K Courtside."""

  def __init__(self, model_name: str = "gemini-3.5-flash"):
    self.model_name = model_name

  def query_audience(self, user_query: str, franchise: Optional[str] = "NBA2K", limit: int = 100) -> AudienceNLQueryResponse:
    logger.info(f"AudienceAgent processing 2K Courtside query: '{user_query}'")

    safe_limit = max(1, min(int(limit), 200))
    qLower = user_query.lower()
    generated_gql = (
      f"GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[r:PLAYS_GAME]->(g:Game {{game_id: 'game-nba2k27'}})\n"
      f"WHERE p.churn_risk_score > 0.45 AND p.lifetime_spend_usd > 50.0\n"
      f"RETURN p.player_id, p.display_name, p.gamer_tag, p.primary_archetype, p.churn_risk_score, p.tilt_sensitivity, p.lifetime_spend_usd\n"
      f"LIMIT {safe_limit}"
    )

    if "cliff" in qLower or "85" in qLower or "stall" in qLower or "loss" in qLower:
      generated_gql = (
        f"GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[r:PLAYS_GAME]->(g:Game {{game_id: 'game-nba2k27'}})\n"
        f"WHERE LAX_INT64(p.game_telemetry.myplayer_ovr) < 85 AND LAX_INT64(p.game_telemetry.last_login_days_ago) >= 7\n"
        f"RETURN p.player_id, p.display_name, p.gamer_tag, p.primary_archetype, p.churn_risk_score, p.tilt_sensitivity, p.lifetime_spend_usd\n"
        f"LIMIT {safe_limit}"
      )
    elif "whale" in qLower or "opal" in qLower or "myteam" in qLower:
      generated_gql = (
        f"GRAPH TakeTwoPlayerGraph MATCH (p:Player)\n"
        f"WHERE LAX_INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 10 OR p.lifetime_spend_usd >= 500.0\n"
        f"RETURN p.player_id, p.display_name, p.gamer_tag, p.primary_archetype, p.churn_risk_score, p.tilt_sensitivity, p.lifetime_spend_usd\n"
        f"ORDER BY p.lifetime_spend_usd DESC\n"
        f"LIMIT {safe_limit}"
      )
    elif "gta" in qLower or "rockstar" in qLower or "gravity" in qLower or "social club" in qLower:
      generated_gql = (
        f"GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {{platform: 'Rockstar Social Club'}})\n"
        f"WHERE NOT EXISTS {{ MATCH (p2:Player)-[:PLAYS_GAME]->(:Game {{game_id: 'game-gta6'}}) WHERE p2.player_id = p.player_id }}\n"
        f"RETURN p.player_id, p.display_name, p.gamer_tag, p.primary_archetype, p.churn_risk_score, p.tilt_sensitivity, p.lifetime_spend_usd\n"
        f"LIMIT {safe_limit}"
      )
    elif "crew" in qLower or "clan" in qLower or "teammate" in qLower:
      generated_gql = (
        f"GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[m:MEMBER_OF_CLAN]->(c:Clan)<-[m2:MEMBER_OF_CLAN]-(mate:Player)\n"
        f"WHERE p.player_id <> mate.player_id\n"
        f"RETURN DISTINCT p.player_id, p.display_name, p.gamer_tag, p.primary_archetype, p.churn_risk_score, p.tilt_sensitivity, p.lifetime_spend_usd\n"
        f"LIMIT {safe_limit}"
      )

    rows = run_spanner_gql_query(generated_gql)
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    total_spend = 0.0
    total_churn = 0.0
    archetype_counts: Dict[str, int] = {}

    for p in rows:
      spend = float(p.get("lifetime_spend_usd") or 0.0)
      churn = float(p.get("churn_risk_score") or 0.0)
      tilt = float(p.get("tilt_sensitivity") or 0.0)
      arch = str(p.get("primary_archetype") or "MYCAREER_STORY_CASUAL")
      archetype_counts[arch] = archetype_counts.get(arch, 0) + 1
      total_spend += spend
      total_churn += churn

      nodes.append({
        "id": str(p["player_id"]),
        "name": p.get("gamer_tag") or p.get("display_name") or str(p["player_id"]),
        "type": "PLAYER",
        "archetype": arch,
        "spend": spend,
        "churn_risk": churn,
        "tilt": tilt,
        "val": max(6, int(spend / 50)),
      })

    player_count = len(nodes)
    nodes.append({"id": "game-nba2k27", "name": "NBA 2K27", "type": "GAME", "val": 30})
    nodes.append({"id": "game-nba2k27-mycareer", "name": "NBA 2K27 · The City & Crews", "type": "GAME", "val": 25})

    for n in nodes[:25]:
      if n["type"] == "PLAYER":
        edges.append({
          "source": n["id"],
          "target": "game-nba2k27-mycareer" if "PARK" in n["archetype"] or "CASUAL" in n["archetype"] else "game-nba2k27",
          "label": "PLAYS_GAME",
        })

    avg_spend = round(total_spend / max(1, player_count), 2)
    avg_churn = round(total_churn / max(1, player_count), 2)
    dominant_archetype = (
      max(archetype_counts.items(), key=lambda kv: kv[1])[0]
      if archetype_counts
      else "MYCAREER_STORY_CASUAL"
    )

    return AudienceNLQueryResponse(
      query=user_query,
      generated_gql=generated_gql,
      natural_language_summary=f"Resolved {player_count:,} matching Take-Two player graph nodes from live Spanner with avg spend ${avg_spend}.",
      matched_count=player_count,
      estimated_total_audience=player_count,
      nodes=nodes,
      edges=edges,
      aggregate_metrics={
        "matched_count": player_count,
        "estimated_total": player_count,
        "avg_spend_usd": avg_spend,
        "avg_churn_risk": avg_churn,
        "dominant_archetype": dominant_archetype,
      }
    )


def create_audience_agent() -> AudienceAgent:
  return AudienceAgent()

