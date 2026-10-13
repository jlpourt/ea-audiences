"""Courtside Focus Group Synthetic Persona Simulation Agent tailored for 2K Courtside (ADK Fleet)."""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from google import genai
from agents.app.schemas import PersonaReaction, FocusGroupSimulationResponse
from agents.app.protocols.a2ui_protocol import A2UIProtocolGenerator

logger = logging.getLogger("twok.courtside.focus_group")

ARCHETYPE_PERSONAS = {
  "PARK_REP_GRINDER": {
    "title": "Park Rep & City Grinder",
    "avatar": "🏀",
    "description": "Rep tier grinder in The City with 800+ games. Highly sensitive to Park loss streaks, green-window contest timing, and rage-quitting against 99-OVR stacked squads.",
    "eval_prompt": "You are a competitive NBA 2K27 Park grinder (Starter 3 / All-Star). You evaluate campaigns strictly on contest balance, Cap Breaker unlocks, and loss-slump recovery.",
  },
  "MYTEAM_PACK_WHALE": {
    "title": "MyTEAM 10+ Galaxy Opal Collector",
    "avatar": "💎",
    "description": "High discretionary spend ($1,500+/yr on VC). Opens 20-box Deluxe packs, targets Victor Wembanyama and Caitlin Clark Galaxy Opals, active in Unlimited.",
    "eval_prompt": "You are a high-spending MyTEAM whale in NBA 2K27. You have disposable income and look for guaranteed 97+ Galaxy Opal cards and Season Pass Hall of Fame skips.",
  },
  "MYCAREER_STORY_CASUAL": {
    "title": "Sub-85 OVR Stalled Build (Cliff)",
    "avatar": "🎯",
    "description": "Casual player whose build stalled at 82 OVR in week 5. At severe risk of churning before Season 2 unless offered an affordable Crew Re-Up bundle.",
    "eval_prompt": "You are an NBA 2K27 casual player with an 83 OVR Inside-Out Playmaker. VC upgrades felt too expensive, and you haven't logged in for 8 days.",
  },
  "CROSS_LABEL_NOMAD": {
    "title": "Take-Two Cross-Label Nomad (2K ↔ Rockstar)",
    "avatar": "⚡",
    "description": "Active in NBA 2K27 and GTA Online, linked via Rockstar Social Club to Take-Two account, evaluating GTA VI pre-order.",
    "eval_prompt": "You play both NBA 2K27 and GTA Online. You respond strongly to cross-label Take-Two incentives linking 2K VC with GTA VI bonuses.",
  },
}


class FocusGroupAgent:
  """ADK Courtside Focus Group Synthetic Persona Simulation Agent for 2K Games."""

  def __init__(self, model_name: str = "gemini-3.5-flash"):
    self.model_name = model_name
    self.client = self._init_client()

  def _init_client(self) -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    project_id = os.getenv("GCP_PROJECT_ID", "jamie-bq-test")
    location = os.getenv("GEMINI_LOCATION", "global")

    if api_key:
      return genai.Client(api_key=api_key)
    client = genai.Client(vertexai=True, project=project_id, location=location)
    logger.info(f"Initialized Google GenAI Vertex Client on {project_id} ({location})")
    return client

  def simulate_campaign_reaction(
    self,
    campaign_id: str,
    franchise: str = "NBA2K",
    creative_title: str = "Season 1→2 Crew Re-Up & Sub-85 Progression Shield",
    proposed_spend: float = 120000.0,
    target_roas: float = 2.45,
    target_archetypes: Optional[List[str]] = None,
    custom_offer_desc: Optional[str] = None,
  ) -> FocusGroupSimulationResponse:
    """Executes live multi-agent synthetic persona simulation across 2K archetypes."""
    logger.info(f"Running Courtside Focus Group simulation for 2K: '{creative_title}'...")

    prompt = f"""
    You are running the Courtside Focus Group Synthetic Persona Simulation for NBA 2K / Take-Two Growth Marketing.
    Campaign ID: {campaign_id}
    Franchise: {franchise}
    Creative Title: {creative_title}
    Proposed Spend: ${proposed_spend:,.2f}
    Target ROAS: {target_roas}
    Custom Offer Details: {custom_offer_desc or '$4.99 Crew Re-Up Bundle: 15,000 VC + Teammate Squad Pass + Season 2 Pre-Registration'}

    Evaluate the campaign from the perspective of each of these 4 NBA 2K archetypes:
    1. PARK_REP_GRINDER (City Park rep sweat, contest sensitive, defeat slump risk)
    2. MYTEAM_PACK_WHALE (Galaxy Opal pack ripper, $1,500+ spend)
    3. MYCAREER_STORY_CASUAL (Sub-85 OVR stalled build, week 5 churn risk)
    4. CROSS_LABEL_NOMAD (Take-Two Rockstar Social Club linked, GTA VI pre-order bridge)

    For each archetype, respond with:
    - willingness_to_pay_usd (float)
    - churn_risk_score (float 0.0 to 1.0)
    - final_fsm_state (PURCHASED, ENGAGED_FREE, EVALUATING, ABANDONED, BOYCOTT)
    - authenticity_rating (float 0.0 to 1.0)
    - verbatim_quote (authentic 2K gamer slang: 'The City', 'green release', 'Cap Breaker', 'Galaxy Opal', 'Crew Re-Up', 'VC ladder')
    - sentiment_score (float -1.0 to 1.0)

    Output STRICT JSON matching this schema:
    {{
      "reactions": [
        {{
          "archetype": "MYCAREER_STORY_CASUAL",
          "willingness_to_pay_usd": 4.99,
          "churn_risk_score": 0.18,
          "final_fsm_state": "PURCHASED",
          "authenticity_rating": 0.96,
          "verbatim_quote": "...",
          "sentiment_score": 0.84
        }}
      ],
      "consensus_summary": "...",
      "predicted_conversion_lift": 28.4,
      "sentiment_decay_index": -2.1,
      "churn_mitigation_lift": 26.2,
      "projected_revenue_impact_usd": 520000.0
    }}
    """
    response = self.client.models.generate_content(
      model=self.model_name,
      contents=prompt,
      config={"response_mime_type": "application/json"},
    )
    parsed = json.loads(response.text)
    reactions = [PersonaReaction(**r) for r in parsed.get("reactions", [])]

    conv_lift = float(parsed["predicted_conversion_lift"])
    decay_idx = float(parsed["sentiment_decay_index"])
    churn_lift = float(parsed["churn_mitigation_lift"])
    rev_impact = float(parsed["projected_revenue_impact_usd"])

    return FocusGroupSimulationResponse(
      campaign_id=campaign_id,
      franchise=franchise,
      creative_title=creative_title,
      proposed_spend=proposed_spend,
      target_roas=target_roas,
      reactions=reactions,
      consensus_summary=str(parsed["consensus_summary"]),
      predicted_conversion_lift=conv_lift,
      sentiment_decay_index=decay_idx,
      churn_mitigation_lift=churn_lift,
      projected_revenue_impact_usd=rev_impact,
      a2ui_components=[
        A2UIProtocolGenerator.create_metric_card("card-lift", "Predicted Conversion Lift", f"+{conv_lift:.1f}%", "vs S1 baseline", "UP", "GREEN"),
        A2UIProtocolGenerator.create_metric_card("card-churn", "Season 2 Cliff Mitigation", f"+{churn_lift:.1f}%", "churn reduction", "UP", "CYAN"),
        A2UIProtocolGenerator.create_metric_card("card-rev", "Projected VC Lift", f"${rev_impact / 1000:.0f}K", f"Target ROAS {target_roas:.2f}x", "UP", "GOLD"),
      ],
    )


def create_focus_group_agent() -> FocusGroupAgent:
  return FocusGroupAgent()

