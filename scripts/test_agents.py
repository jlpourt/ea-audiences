import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.app.agent import root_agent
from agents.app.schemas import DeepSonaSimulationResponse

def main():
    print("Testing JamieRootOrchestratorAgent and DeepSonaAgent...")
    res = root_agent.deepsona_agent.simulate_campaign_reaction(
        campaign_id="test-camp-01",
        franchise="Call of Duty: Warzone",
        creative_title="Season 22 Squad Breach Cut",
        proposed_spend=120000.0,
        target_roas=2.45,
    )
    print(f"✅ DeepSona Simulation Success: {res.campaign_id} ({res.franchise})")
    print(f"✅ Evaluated {len(res.reactions)} BARE Archetypes:")
    for r in res.reactions:
        print(f"   [{r.archetype}] WTP: ${r.willingness_to_pay_usd:.2f} | State: {r.final_fsm_state} | Authenticity: {r.authenticity_rating*100:.0f}%")
        print(f"      Quote: \"{r.verbatim_quote}\"")
    print(f"✅ Predicted Conversion Lift: +{res.predicted_conversion_lift}%")
    print(f"✅ Projected Net Incremental Revenue: ${res.projected_revenue_impact_usd:,.2f}")

    # Test Outbound A2A Brief Handoff
    print("\nTesting Outbound A2A Audience Brief Hand-off to Act 2 (Curtis Gross)...")
    a2a_res = root_agent.emit_audience_brief_to_creative_insights(
        friction_point="Warzone Gulag Loss Streak Churn Risk",
        target_archetype="COMPETITIVE_GRINDER",
    )
    print(f"✅ A2A Hand-off Status: {a2a_res['response']['status']} (Intent: {a2a_res['response']['intent']})")

if __name__ == "__main__":
    main()
