"""Scoring and Lift Estimation Agent for 2K Courtside."""

import logging
from typing import Dict, List, Any

logger = logging.getLogger("twok.courtside.scoring_agent")


class ScoringAgent:
  """Calculates conversion lift, sentiment decay, and projected revenue lift for 2K campaigns."""

  def evaluate_offer_lift(
    self,
    offer_type: str,
    price_usd: float,
    target_archetype: str,
    frustration_level: float = 0.5,
  ) -> Dict[str, Any]:
    """Calculates expected lift based on archetype elasticity and situational state."""

    # Base elasticity by 2K archetype
    archetype_elasticity = {
      "PARK_REP_GRINDER": {"base_cvr": 0.12, "price_sensitivity": 0.70, "tilt_boost": 0.35},
      "MYTEAM_PACK_WHALE": {"base_cvr": 0.32, "price_sensitivity": 0.10, "tilt_boost": 0.08},
      "MYCAREER_STORY_CASUAL": {"base_cvr": 0.18, "price_sensitivity": 0.85, "tilt_boost": 0.40},
      "REC_CREW_CAPTAIN": {"base_cvr": 0.22, "price_sensitivity": 0.40, "tilt_boost": 0.20},
      "CROSS_LABEL_NOMAD": {"base_cvr": 0.25, "price_sensitivity": 0.25, "tilt_boost": 0.15},
    }.get(target_archetype, {"base_cvr": 0.15, "price_sensitivity": 0.50, "tilt_boost": 0.20})

    # Price penalty
    price_factor = max(0.2, 1.0 - (price_usd / 80.0) * archetype_elasticity["price_sensitivity"])

    # Tilt / Defeat slump situational multiplier (e.g. Crew Re-Up $4.99 converts high on tilt)
    is_reup = "CREW_REUP" in offer_type.upper() or "RE-UP" in offer_type.upper() or price_usd <= 4.99
    situational_multiplier = 1.0 + (frustration_level * archetype_elasticity["tilt_boost"] * (2.8 if is_reup else 0.6))

    projected_cvr = min(0.70, archetype_elasticity["base_cvr"] * price_factor * situational_multiplier)
    predicted_lift_pct = round((projected_cvr / max(0.01, archetype_elasticity["base_cvr"]) - 1.0) * 100, 1)

    return {
      "target_archetype": target_archetype,
      "offer_type": offer_type,
      "price_usd": price_usd,
      "projected_cvr": round(projected_cvr, 3),
      "predicted_conversion_lift_pct": predicted_lift_pct,
      "expected_churn_reduction_pct": round(min(40.0, frustration_level * 32.0), 1),
    }


def create_scoring_agent() -> ScoringAgent:
  return ScoringAgent()
