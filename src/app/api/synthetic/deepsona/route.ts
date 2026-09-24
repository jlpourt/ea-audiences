import { NextRequest, NextResponse } from "next/server";
import { generateVertexContent, parseModelJson } from "@/lib/gcp/vertex-client";
import { GCP_CONFIG } from "@/lib/config";
import { DeepSonaResult, DeepSonaReaction, CohortContext } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = body.campaign_id || "camp-abk-dynamic";
    const franchise = body.franchise || "Call of Duty: Warzone";
    const creativeTitle = body.creative_title || "Warzone Gulag Retention & BlackCell Recovery Shield";
    const proposedSpend = Number(body.proposed_spend || 120000.0);
    const targetRoas = Number(body.target_roas || 2.45);
    const cohortContext: CohortContext | undefined = body.cohort_context;
    const sampledPlayers: any[] = body.sampled_players || [];

    let reactions: DeepSonaReaction[] = [];
    let consensusSummary = "";
    let conversionLift = 26.4;
    let churnMitigation = 22.1;
    let revImpact = proposedSpend * targetRoas * 1.55;

    const cohortDesc = cohortContext?.query
      ? `Target Audience Cohort: "${cohortContext.query}" (~${cohortContext.estimatedTotal?.toLocaleString() || "4,200"} addressable Spanner Graph players, Dominant: ${cohortContext.dominantArchetype || "COMPETITIVE_GRINDER"}, Avg Spend: $${cohortContext.avgSpend || 850})`
      : "Target Audience Cohort: Broad Active Live Service Player Base";

    /**
     * Summarise what this player has actually paid.
     *
     * The prompt used to dictate willingness-to-pay from the archetype label
     * alone (Whale $39.99-$99.99, Casual $0-$4.99). That overrides the real
     * signal: purchase history now reconciles to lifetime spend and carries
     * real offer ids, so we know the actual price points each player has
     * accepted. A "whale" who has only ever bought $9.99 passes is a very
     * different target from one who buys $99.99 currency vaults.
     */
    const revealedPreference = (p: any): string => {
      const items: any[] = Array.isArray(p?.purchased_items) ? p.purchased_items : [];
      const prices = items
        .map((it) => Number(it?.price_usd))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);

      if (prices.length === 0) {
        return "No recorded purchases — treat as unproven, price sensitivity unknown.";
      }

      const max = prices[prices.length - 1];
      const median = prices[Math.floor(prices.length / 2)];
      const total = prices.reduce((a, b) => a + b, 0);
      return (
        `${prices.length} purchases, $${total.toFixed(2)} total. ` +
        `Typical price paid $${median.toFixed(2)}, highest ever $${max.toFixed(2)}.`
      );
    };

    const playersDetailsPrompt = sampledPlayers.length > 0
      ? `\n\nWe have sampled 4 REAL players from the active Spanner Property Graph segment to participate in this focus group:\n` +
        sampledPlayers.map((p, idx) => {
          const role = idx === 0 ? "Frustrated / High-Tilt Grinder" : idx === 1 ? "High-LTV Whale" : idx === 2 ? "Squad / Rush Co-op Leader" : "Value Optimizer / Core Player";
          return `Player ${idx + 1} [${role}]:
- Gamer Tag: ${p.name} (ID: ${p.id})
- Location: ${p.dma_market || "Global"}, ${p.country || "United States"} (${p.country_code || "US"})
- Spend: $${(p.spend || 0).toFixed(2)}
- Loss Streak: ${p.loss_streak || 0} matches, Tilt: ${Math.round((p.tilt || 0.5) * 100)}%
- Archetype: ${p.archetype || "GENERAL_PLAYER"}
- Revealed price preference: ${revealedPreference(p)}
- Telemetry: Squad: ${p.game_telemetry?.main_loadout || p.game_telemetry?.character_class || "N/A"}, Rank: ${p.game_telemetry?.rank_tier || "N/A"}`;
        }).join("\n\n")
      : "";

    // Live Vertex AI Gemini Call Grounded in the Segmented Cohort & Real Sampled Players
    try {
      const prompt = `
You are running the DeepSona Multi-Agent Synthetic Focus Group Simulation for Activision / Call of Duty Marketing using Google Cloud Vertex AI Gemini.

${cohortDesc}
Franchise: ${franchise}
Campaign Proposition: "${creativeTitle}"
Proposed Media Budget: $${proposedSpend.toLocaleString()}
Target ROAS: ${targetRoas}
${playersDetailsPrompt}

Simulate authentic, nuanced reactions, willingness to pay (WTP), and distinct verbatim feedback from 4 diverse gamer archetypes in this franchise.
If 4 real players were provided above, make sure the verbatim quotes, playstyle reactions, and willingness to pay match the EXACT gamer tags, locations, loss streaks, and spend levels of those 4 players!

CRITICAL INSTRUCTIONS:
- Each of the 4 personas MUST provide a UNIQUE, differentiated verbatim quote reflecting their specific playstyle, frustration level, and budget!
- Mention realistic details from their telemetry (e.g. their defeat streak, their local DMA market, their squad setup, or their specific spend level).
- Use authentic Call of Duty terminology across game modes (e.g. for Warzone: 'Gulag clutch', 'Warzone', 'BlackCell', 'CoD Points', 'Ricochet', 'loadout drop', 'Rebirth Island'; for Black Ops 7: 'Round-Based Zombies', 'GobbleGums', 'Omnimovement 2.0', 'Dark Matter', 'Terminus', 'Vault Edition'; for CDL Ranked: 'Skill Rating (SR)', 'Hardpoint rotation', 'Iridescent', 'OpTic / FaZe pro packs'; for Mobile: 'Mythic weapon draw', 'Legendary crate', 'Touchpad claw').
- Anchor willingness_to_pay_usd on each player's REVEALED PRICE PREFERENCE above, not on their archetype label. A player's WTP should sit near the price points they have actually paid before; going far above their highest recorded purchase needs a reason grounded in the offer. Players with no recorded purchases should show low WTP and high scepticism.

Output STRICT JSON matching:
{
  "reactions": [
    {
      "archetype": "COMPETITIVE_GRINDER",
      "gamer_tag": "${sampledPlayers[0]?.name || "Player_1"}",
      "willingness_to_pay_usd": 4.99,
      "churn_risk_score": 0.21,
      "final_fsm_state": "PURCHASED",
      "authenticity_rating": 0.94,
      "verbatim_quote": "Detailed unique quote reflecting their loss streak...",
      "sentiment_score": 0.82
    },
    {
      "archetype": "BLACKCELL_WHALE",
      "gamer_tag": "${sampledPlayers[1]?.name || "Player_2"}",
      "willingness_to_pay_usd": 49.99,
      "churn_risk_score": 0.08,
      "final_fsm_state": "PURCHASED",
      "authenticity_rating": 0.96,
      "verbatim_quote": "Detailed unique quote reflecting their high spend...",
      "sentiment_score": 0.95
    },
    {
      "archetype": "CASUAL_SOCIALIZER",
      "gamer_tag": "${sampledPlayers[2]?.name || "Player_3"}",
      "willingness_to_pay_usd": 7.99,
      "churn_risk_score": 0.12,
      "final_fsm_state": "PURCHASED",
      "authenticity_rating": 0.93,
      "verbatim_quote": "Detailed unique quote reflecting their squad play...",
      "sentiment_score": 0.88
    },
    {
      "archetype": "LORE_SEEKER",
      "gamer_tag": "${sampledPlayers[3]?.name || "Player_4"}",
      "willingness_to_pay_usd": 0.00,
      "churn_risk_score": 0.15,
      "final_fsm_state": "ENGAGED_FREE",
      "authenticity_rating": 0.90,
      "verbatim_quote": "Detailed unique quote reflecting value and anti-P2W balance...",
      "sentiment_score": 0.65
    }
  ],
  "consensus_summary": "Summary of how this specific segmented cohort responded...",
  "predicted_conversion_lift": 28.5,
  "sentiment_decay_index": -2.4,
  "churn_mitigation_lift": 24.2,
  "projected_revenue_impact_usd": 485000.0
}
`;
      const generatedText = await generateVertexContent(prompt, true);
      const parsed = parseModelJson<any>(generatedText);
      if (parsed) {
        reactions = parsed.reactions || [];
        consensusSummary = parsed.consensus_summary || "";
        conversionLift = Number(parsed.predicted_conversion_lift || 28.5);
        churnMitigation = Number(parsed.churn_mitigation_lift || 24.2);
        revImpact = Number(parsed.projected_revenue_impact_usd || (proposedSpend * targetRoas * 1.5));
      }
    } catch (e) {
      console.warn("[Vertex AI DeepSona] Error during live persona simulation, using grounded cohort fallback:", e);
      
      const p1Name = sampledPlayers[0]?.name || "Ghost_Sweat_44";
      const p1Loss = sampledPlayers[0]?.loss_streak || 3;
      const p1Tilt = Math.round((sampledPlayers[0]?.tilt || 0.78) * 100);
      const p1Market = sampledPlayers[0]?.dma_market || "Los Angeles Metro";

      const p2Name = sampledPlayers[1]?.name || "BlackCell_Vanguard_88";
      const p2Spend = (sampledPlayers[1]?.spend || 8874).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const p3Name = sampledPlayers[2]?.name || "OpTic_GreenWall_Fan";
      const p4Name = sampledPlayers[3]?.name || "Verdansk_Veteran_Echo";

      const isBlackOps = franchise.includes("Black Ops") || franchise.includes("BLACK_OPS") || franchise.includes("Zombies");
      const isCDL = franchise.includes("CDL") || franchise.includes("Ranked");
      const isMobile = franchise.includes("Mobile") || franchise.includes("MOBILE");
      const isMW3 = franchise.includes("Modern Warfare") || franchise.includes("MW3");

      if (isBlackOps) {
        reactions = [
          {
            archetype: "ROUND_BASED_ZOMBIES_SLAYER",
            gamer_tag: p1Name,
            willingness_to_pay_usd: 9.99,
            churn_risk_score: 0.15,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.95,
            verbatim_quote: `Wiped on Round 38 after a Mangler swarm ${p1Loss} times in a row (${p1Tilt}% tilt in ${p1Market}). The $9.99 GobbleGum Ultra Mega Pack with Perkaholic and Cache Back resets team morale for our Easter Egg run.`,
            sentiment_score: 0.85,
          },
          {
            archetype: "BLACKCELL_WHALE",
            gamer_tag: p2Name,
            willingness_to_pay_usd: 99.99,
            churn_risk_score: 0.04,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.99,
            verbatim_quote: `Lifetime spend of $${p2Spend} across Treyarch titles. The BO6 Vault Edition upgrade with Mastercraft weapon blueprints and GobbleGums is an automatic day-one purchase.`,
            sentiment_score: 0.98,
          },
          {
            archetype: "CASUAL_SOCIALIZER",
            gamer_tag: p3Name,
            willingness_to_pay_usd: 9.99,
            churn_risk_score: 0.12,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.92,
            verbatim_quote: "Our 4-player co-op squad runs Terminus Island Zombies every Friday. Shared GobbleGum caches and weapon XP boosts provide massive team survival value.",
            sentiment_score: 0.89,
          },
          {
            archetype: "CAMO_COMPLETIONIST",
            gamer_tag: p4Name,
            willingness_to_pay_usd: 0.00,
            churn_risk_score: 0.13,
            final_fsm_state: "ENGAGED_FREE",
            authenticity_rating: 0.89,
            verbatim_quote: "Grinding Dark Matter across all launch weapons. As long as mastery camo challenges stay purely skill-based and unobtrusive, the seasonal progression feels great.",
            sentiment_score: 0.74,
          },
        ];
      } else if (isCDL) {
        reactions = [
          {
            archetype: "CDL_RANKED_SWEAT",
            gamer_tag: p1Name,
            willingness_to_pay_usd: 4.99,
            churn_risk_score: 0.18,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.94,
            verbatim_quote: `Suffered ${p1Loss} straight demotion losses in Hardpoint (${p1Tilt}% tilt). Grabbing the $4.99 Ranked Play Demotion Recovery Pack protects my SR and gets our squad back locked in.`,
            sentiment_score: 0.82,
          },
          {
            archetype: "BLACKCELL_WHALE",
            gamer_tag: p2Name,
            willingness_to_pay_usd: 19.99,
            churn_risk_score: 0.05,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.97,
            verbatim_quote: `Lifetime spend of $${p2Spend} on Call of Duty. Every CDL Major I buy both the OpTic Gaming and FaZe Clan team packs and weapon camos immediately.`,
            sentiment_score: 0.96,
          },
          {
            archetype: "CASUAL_SOCIALIZER",
            gamer_tag: p3Name,
            willingness_to_pay_usd: 9.99,
            churn_risk_score: 0.10,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.91,
            verbatim_quote: "Our 4-stack scrims CDL competitive maps every weekend. Pro pack operator uniforms give our squad clean visual uniformity in Search & Destroy.",
            sentiment_score: 0.87,
          },
          {
            archetype: "COMPETITIVE_GRINDER",
            gamer_tag: p4Name,
            willingness_to_pay_usd: 0.00,
            churn_risk_score: 0.14,
            final_fsm_state: "ENGAGED_FREE",
            authenticity_rating: 0.88,
            verbatim_quote: "Diamond anchor queuing solo. No cheese weapons, no gaudy skins—just pure gunskill, rotation timing, and CDL map knowledge.",
            sentiment_score: 0.70,
          },
        ];
      } else if (isMobile) {
        reactions = [
          {
            archetype: "MOBILE_TOUCHPAD_PRODIGY",
            gamer_tag: p1Name,
            willingness_to_pay_usd: 9.99,
            churn_risk_score: 0.12,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.95,
            verbatim_quote: `Dropped ${p1Loss} ranked matches in legendary tier (${p1Tilt}% tilt). The Mythic Grau 5.56 draw reload gives the weapon inspection and kill effects I love.`,
            sentiment_score: 0.90,
          },
          {
            archetype: "BLACKCELL_WHALE",
            gamer_tag: p2Name,
            willingness_to_pay_usd: 49.99,
            churn_risk_score: 0.03,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.98,
            verbatim_quote: `Lifetime spend $${p2Spend} on CoD Mobile. The Mythic weapon draws and legendary operator skins are instant completions for my vault collection.`,
            sentiment_score: 0.97,
          },
          {
            archetype: "CASUAL_SOCIALIZER",
            gamer_tag: p3Name,
            willingness_to_pay_usd: 4.99,
            churn_risk_score: 0.15,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.92,
            verbatim_quote: "I play 5-stack multiplayer with my clan daily. Clan war milestone rewards and battle pass gift cards keep our team on top of the leaderboard.",
            sentiment_score: 0.86,
          },
          {
            archetype: "CASUAL_WARRIOR",
            gamer_tag: p4Name,
            willingness_to_pay_usd: 2.99,
            churn_risk_score: 0.16,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.86,
            verbatim_quote: "Quick 10-minute Team Deathmatch rounds on lunch break. The $2.99 Mobile Starter Claw pack is the perfect bite-sized upgrade.",
            sentiment_score: 0.68,
          },
        ];
      } else {
        // Call of Duty: Warzone & Resurgence Default
        reactions = [
          {
            archetype: "GULAG_TILT_RISK",
            gamer_tag: p1Name,
            willingness_to_pay_usd: 4.99,
            churn_risk_score: 0.18,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.96,
            verbatim_quote: `Eliminated early in Resurgence 3 matches in a row (${p1Loss} losses in ${p1Market}, tilt ${p1Tilt}%). $4.99 for 500 CoD Points plus a Gulag Recovery token and 2x XP gets me straight back into the queue.`,
            sentiment_score: 0.86,
          },
          {
            archetype: "BLACKCELL_WHALE",
            gamer_tag: p2Name,
            willingness_to_pay_usd: 29.99,
            churn_risk_score: 0.04,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.98,
            verbatim_quote: `Lifetime spend of $${p2Spend} across Call of Duty. The BlackCell Season Pass bundle with 20 tier skips and animated mastercraft blueprints is an immediate Day 1 purchase.`,
            sentiment_score: 0.98,
          },
          {
            archetype: "CASUAL_SOCIALIZER",
            gamer_tag: p3Name,
            willingness_to_pay_usd: 9.99,
            churn_risk_score: 0.11,
            final_fsm_state: "PURCHASED",
            authenticity_rating: 0.93,
            verbatim_quote: "We drop Warzone Resurgence every Friday night. Double weapon XP tokens and squad camo unlocks under $10 provide massive team value.",
            sentiment_score: 0.88,
          },
          {
            archetype: "VERDANSK_OG",
            gamer_tag: p4Name,
            willingness_to_pay_usd: 0.00,
            churn_risk_score: 0.14,
            final_fsm_state: "ENGAGED_FREE",
            authenticity_rating: 0.88,
            verbatim_quote: "Playing since Verdansk day one in March 2020. As long as Ricochet keeps lobbies clean and weapon blueprints don't have pay-to-win stat advantages, I'm happy.",
            sentiment_score: 0.72,
          },
        ];
      }

      consensusSummary = `DeepSona focus group consensus for ${franchise}: High resonance across ${p1Market} cohort. Proposed starter & recovery intervention mitigates rage-quit churn by +${churnMitigation}%.`;
    }

    return NextResponse.json({
      campaign_id: campaignId,
      franchise,
      creative_title: creativeTitle,
      proposed_spend: proposedSpend,
      target_roas: targetRoas,
      consensus_summary: consensusSummary,
      predicted_conversion_lift: conversionLift,
      churn_mitigation_lift: churnMitigation,
      projected_revenue_impact_usd: revImpact,
      sentiment_decay_index: -2.4,
      reactions,
    });
  } catch (err: any) {
    console.error("[DeepSona API Error]", err);
    return NextResponse.json({ error: err?.message || "Simulation failed" }, { status: 500 });
  }
}
