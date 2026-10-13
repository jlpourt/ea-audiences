"""Pydantic data schemas for 2K Courtside — Audience Builder & Segmentation Engine."""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class A2AMessage(BaseModel):
    """A2A (Agent-to-Agent) Standardized Inter-Agent Envelope."""
    message_id: str
    correlation_id: str
    sender: str
    recipient: str
    timestamp: str
    intent: str
    payload: Dict[str, Any]
    status: str = "SENT"


class PersonaReaction(BaseModel):
    """Courtside Focus Group Synthetic Gamer Persona Evaluation Result."""
    archetype: str
    willingness_to_pay_usd: float
    churn_risk_score: float
    final_fsm_state: str  # PURCHASED, ENGAGED_FREE, EVALUATING, ABANDONED, BOYCOTT
    authenticity_rating: float
    verbatim_quote: str
    sentiment_score: float = 0.0


class FocusGroupSimulationResponse(BaseModel):
    """Aggregate Courtside Focus Group multi-agent simulation response."""
    campaign_id: str
    franchise: str
    creative_title: str
    proposed_spend: float
    target_roas: float
    reactions: List[PersonaReaction]
    consensus_summary: str
    predicted_conversion_lift: float
    sentiment_decay_index: float
    churn_mitigation_lift: float
    projected_revenue_impact_usd: float
    a2ui_components: Optional[List[Dict[str, Any]]] = None




class AudienceNLQueryRequest(BaseModel):
    """Natural Language Audience segmentation request."""
    query: str
    franchise: Optional[str] = "NBA2K"
    limit: int = 100


class AudienceNLQueryResponse(BaseModel):
    """Response containing translated GQL and graph nodes."""
    query: str
    generated_gql: str
    natural_language_summary: str
    matched_count: int
    estimated_total_audience: int
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    aggregate_metrics: Dict[str, Any]


class SituationalTrigger(BaseModel):
    """Dynamic situational trigger evaluation event from Spanner telemetry."""
    trigger_id: str
    player_id: str
    player_name: str
    trigger_type: str
    offer_id: str
    offer_title: str
    price_usd: float
    discount_percent: float
    frustration_score: float
    loss_streak: int
    timestamp: str


class CampaignBrief(BaseModel):
    """Structured Campaign Brief generated for 2K Courtside."""
    brief_id: str
    title: str
    franchise: str
    target_segment: str
    audience_size: int
    trigger_rules: List[str]
    focus_group_consensus: str
    predicted_conversion_lift: float
    projected_roi: float
    recommended_action: str
    creative_hooks: List[str]
    generated_at: str
