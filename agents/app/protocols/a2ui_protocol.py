"""A2UI Protocol Component Generator for streaming dynamic components to the Executive UI."""

from typing import Dict, List, Any


class A2UIProtocolGenerator:
    """Generates A2UI structured component payloads for 2K Courtside Command Center."""

    @staticmethod
    def create_metric_card(
        card_id: str,
        title: str,
        value: str,
        delta: str,
        trend: str = "UP",
        accent_color: str = "GREEN",
    ) -> Dict[str, Any]:
        return {
            "type": "a2ui-metric-card",
            "id": card_id,
            "title": title,
            "value": value,
            "delta": delta,
            "trend": trend,
            "accent_color": accent_color,
        }

    @staticmethod
    def create_sentiment_breakdown(
        title: str,
        archetype_scores: Dict[str, float],
    ) -> Dict[str, Any]:
        return {
            "type": "a2ui-sentiment-breakdown",
            "title": title,
            "scores": archetype_scores,
        }

    @staticmethod
    def create_action_banner(
        headline: str,
        action_text: str,
        target_offer_id: str,
    ) -> Dict[str, Any]:
        return {
            "type": "a2ui-action-banner",
            "headline": headline,
            "action_text": action_text,
            "target_offer_id": target_offer_id,
        }
