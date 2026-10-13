"""Root Orchestrator Agent for 2K Courtside Multi-Agent Fleet."""

import os
import json
import logging
from typing import Dict, List, Any, Optional

from agents.app.sub_agents.focus_group_agent import FocusGroupAgent, create_focus_group_agent
from agents.app.sub_agents.audience_agent import AudienceAgent, create_audience_agent
from agents.app.sub_agents.scoring_agent import ScoringAgent, create_scoring_agent
from agents.app.protocols.a2a_protocol import (
    register_agent_handler,
    create_a2a_message,
    route_a2a_message,
    get_conversation_history,
)

logger = logging.getLogger("twok.courtside.agent")


class CourtsideRootOrchestratorAgent:
    """Master Orchestrator Agent for 2K Courtside — Audience Builder & Segmentation Engine.
    Coordinates Take-Two Identity Graph resolution, NL Audience Building, Courtside Focus Group
    Synthetic Persona Simulation, and cross-agent A2A dispatch with Creative Studio and Channel activation.
    """

    def __init__(self, model_name: str = "gemini-3.5-flash"):
        self.model_name = model_name
        self.focus_group_agent = create_focus_group_agent()
        self.audience_agent = create_audience_agent()
        self.scoring_agent = create_scoring_agent()

        # Register A2A protocol bus handlers
        self._register_a2a_handlers()

    def _register_a2a_handlers(self):
        """Registers inter-agent dispatchers on the A2A bus."""

        def handle_focus_group_simulation(msg: Dict[str, Any]) -> Dict[str, Any]:
            payload = msg.get("payload", {})
            campaign_id = payload.get("campaign_id", "camp-2k27-s2-cliff-rescue")
            franchise = payload.get("franchise", "NBA2K")
            creative_title = payload.get("creative_title", "Season 1→2 Crew Re-Up & Sub-85 Progression Shield")
            proposed_spend = payload.get("proposed_spend", 120000.0)
            target_roas = payload.get("target_roas", 2.45)
            archetypes = payload.get("archetypes", [
                "PARK_REP_GRINDER", "MYTEAM_PACK_WHALE", "MYCAREER_STORY_CASUAL", "CROSS_LABEL_NOMAD"
            ])

            res = self.focus_group_agent.simulate_campaign_reaction(
                campaign_id=campaign_id,
                franchise=franchise,
                creative_title=creative_title,
                proposed_spend=proposed_spend,
                target_roas=target_roas,
                target_archetypes=archetypes,
            )
            return res.model_dump()

        def handle_audience_query(msg: Dict[str, Any]) -> Dict[str, Any]:
            payload = msg.get("payload", {})
            query_str = payload.get("query", "MyCAREER builds under 85 OVR with $50+ VC spend")
            franchise = payload.get("franchise", "NBA2K")
            res = self.audience_agent.query_audience(query_str, franchise=franchise)
            return res.model_dump()

        register_agent_handler("Courtside_FocusGroupAgent", handle_focus_group_simulation)
        register_agent_handler("Courtside_AudienceAgent", handle_audience_query)
        logger.info("✅ CourtsideRootOrchestratorAgent registered A2A handlers successfully.")

    def emit_audience_brief_to_creative_insights(
        self,
        friction_point: str = "The City Sub-85 OVR Stalled Build Cliff Risk",
        target_archetype: str = "PARK_REP_GRINDER",
        creative_agent_name: str = "Courtside_CreativeAgent",
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Outbound A2A Contract: Sends AudienceBrief with telemetry churn friction points to Creative Studio."""
        payload = {
            "intent": "AUDIENCE_BRIEF_HANDOFF",
            "friction_point": friction_point,
            "target_archetype": target_archetype,
            "recommended_focus": "Deploy $4.99 Crew Re-Up Bundle with 15,000 VC and teammate squad pass to mitigate Season 2 cliff churn.",
            "urgency": "HIGH",
        }
        msg = create_a2a_message(
            sender="Courtside_AudienceAgent",
            recipient=creative_agent_name,
            intent="EMIT_AUDIENCE_BRIEF",
            payload=payload,
            correlation_id=correlation_id,
        )
        response = route_a2a_message(msg)
        return {"dispatched_message": msg, "response": response}

    def emit_player_context_to_commerce_media(
        self,
        cohort_id: str = "cohort-2k-s2-cliff",
        ad_server_agent_name: str = "Courtside_ChannelAgent",
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Outbound A2A Contract: Passes real-time player telemetry context to Channel Activation Agent."""
        payload = {
            "intent": "PLAYER_CONTEXT_FEED",
            "cohort_id": cohort_id,
            "target_surfaces": ["IN_GAME_INBOX", "2K_ACCOUNT_EMAIL", "PUSH_2K_MOBILE"],
            "suggested_cpm_floor": 22.50,
        }
        msg = create_a2a_message(
            sender="Courtside_AudienceAgent",
            recipient=ad_server_agent_name,
            intent="PUSH_PLAYER_CONTEXT",
            payload=payload,
            correlation_id=correlation_id,
        )
        response = route_a2a_message(msg)
        return {"dispatched_message": msg, "response": response}


# Global agent instance & alias
root_agent = CourtsideRootOrchestratorAgent()
JamieRootOrchestratorAgent = CourtsideRootOrchestratorAgent
