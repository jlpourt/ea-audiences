import { NextRequest, NextResponse } from "next/server";
import {
  generateGroundedContent,
  generateVertexContent,
  parseModelJson,
  type GroundingCitation,
} from "@/lib/gcp/vertex-client";

/** Verified-active subreddits per CoD mode / franchise. */
const SUBREDDITS_BY_FRANCHISE: Record<string, string[]> = {
  COD: ["r/CallOfDuty", "r/CODWarzone", "r/blackops7", "r/ModernWarfareIII"],
  WARZONE: ["r/CODWarzone", "r/Warzone"],
  BLACK_OPS: ["r/blackops7", "r/CODZombies"],
  MODERN_WARFARE: ["r/ModernWarfareIII", "r/ModernWarfareII"],
  CDL_RANKED: ["r/CoDCompetitive", "r/CallOfDuty"],
  COD_MOBILE: ["r/CallOfDutyMobile", "r/CODMobile"],
};

/** Current live content, so search targets what players are playing now. */
const LIVE_CONTEXT_BY_FRANCHISE: Record<string, string> = {
  COD: "Call of Duty ecosystem, cross-title progression, BlackCell battle pass tier ($29.99), standard battle pass (1,100 CP / $9.99), and CoD Points pricing",
  WARZONE: "Call of Duty: Warzone & Resurgence, Gulag mechanics, Urzikstan / Rebirth Island, BlackCell ($29.99), and weapon blueprint balancing",
  BLACK_OPS: "Call of Duty: Black Ops 7, Omnimovement 2.0, Round-Based Zombies, GobbleGums, Dark Matter camo grind, and Vault Edition upgrades",
  MODERN_WARFARE: "Call of Duty: Modern Warfare III, multiplayer map rotations, aftermarket parts, and carry-forward operator bundles",
  CDL_RANKED: "Call of Duty League (CDL) Ranked Play, Skill Rating (SR) demotion protection, OpTic / FaZe team bundles, and competitive meta weapons",
  COD_MOBILE: "Call of Duty: Mobile, Mythic weapon draws, Legendary operator skins, and CP crate pricing",
};

/**
 * Map a free-text franchise label onto a catalog franchise code.
 */
function resolveFranchiseCode(raw: string): string {
  const f = (raw || "").toUpperCase();
  if (f.includes("WARZONE") || f.includes("RESURGENCE")) return "WARZONE";
  if (f.includes("BLACK_OPS") || f.includes("BO7") || f.includes("BO6") || f.includes("ZOMBIES")) return "BLACK_OPS";
  if (f.includes("MODERN_WARFARE") || f.includes("MW3")) return "MODERN_WARFARE";
  if (f.includes("CDL") || f.includes("RANKED")) return "CDL_RANKED";
  if (f.includes("MOBILE")) return "COD_MOBILE";
  return "COD";
}

/**
 * Retrieve real Reddit sentiment through Google Search grounding.
 * Throws on failure; the caller must surface that, never paper over it.
 */
async function fetchRedditPulse(args: {
  franchise: string;
  topic: string;
  offerTitle: string;
  price: number;
}): Promise<{ themesText: string; citations: GroundingCitation[]; searchQueries: string[] }> {
  const subreddits = SUBREDDITS_BY_FRANCHISE[args.franchise] || SUBREDDITS_BY_FRANCHISE.COD;
  const liveContext = LIVE_CONTEXT_BY_FRANCHISE[args.franchise] || LIVE_CONTEXT_BY_FRANCHISE.COD;

  const grounded = await generateGroundedContent(
    `Search Reddit for what players are currently saying about ${liveContext}.

Look across ${subreddits.join(", ")}.

A marketing team is evaluating an offer titled "${args.offerTitle}" at $${args.price.toFixed(
      2
    )}, and specifically wants to understand community sentiment on: ${args.topic}. (If no threads discuss this exact phrasing, report on player reactions to related concepts like pay-to-win mechanics, respawn tokens, battle pass progression, or pricing).

Report what you find in Reddit discussions. For each distinct
theme of player sentiment, name the subreddit it came from and summarise the
player position in their own framing. Include positive and neutral sentiment
where it exists, not only complaints.`
  );

  return {
    themesText: grounded.text,
    citations: grounded.citations,
    searchQueries: grounded.searchQueries,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userPrompt = body.prompt || "What do you think of this campaign offer?";
    const campaignTitle = body.campaign_title || "Warzone Gulag Retention & BlackCell Recovery Shield";
    const franchise = body.franchise || "Call of Duty: Warzone";
    const franchiseCode = resolveFranchiseCode(franchise);
    const platform = body.platform || "focus_group"; // "focus_group" | "discord" | "reddit"
    const cohortContext = body.cohort_context;
    const sampledPlayers: any[] = body.sampled_players || [];

    // Populated only on the grounded (reddit) path.
    let groundingCitations: GroundingCitation[] = [];
    let groundingQueries: string[] = [];
    let groundedThemes = "";

    // Extract dynamic price from prompt if user typed one (e.g., "$10.99", "10.99", "15 bucks", etc.)
    let dynamicPrice = body.price || 4.99;
    const priceMatch = userPrompt.match(/(?:\$|usd\s*|for\s*)(\d+(?:\.\d{1,2})?)/i);
    if (priceMatch && priceMatch[1]) {
      dynamicPrice = parseFloat(priceMatch[1]);
    }

    const cohortInfo = cohortContext
      ? `Target Audience Cohort: "${cohortContext.query}" (~${cohortContext.estimatedTotal?.toLocaleString() || "4,200"} players, Dominant: ${cohortContext.dominantArchetype})`
      : "Target Audience: Active Live Service Players";

    const p1Name = sampledPlayers[0]?.name || sampledPlayers[0]?.gamerTag || "Ghost_771";
    const p2Name = sampledPlayers[1]?.name || sampledPlayers[1]?.gamerTag || "Price_BlackCell_88";
    const p3Name = sampledPlayers[2]?.name || sampledPlayers[2]?.gamerTag || "Soap_Resurgence_99";
    const p4Name = sampledPlayers[3]?.name || sampledPlayers[3]?.gamerTag || "ZombieHunter_42";

    const p1Role = sampledPlayers[0]?.division || "Warzone Top 250 Ranked";
    const p2Role = sampledPlayers[1]?.division || "BlackCell Vault Whale ($3k+)";
    const p3Role = sampledPlayers[2]?.division || "Resurgence 4-Stack Captain";
    const p4Role = sampledPlayers[3]?.division || "Solo Campaign & Zombie Tactician";

    try {
      let systemPrompt = "";

      if (platform === "discord") {
        systemPrompt = `
You are simulating a live Discord server discussion (#live-service-chat) for ${franchise} players using Google Cloud Vertex AI Gemini.

${cohortInfo}
Campaign Title: "${campaignTitle}"
Stated Offer Price: $${dynamicPrice.toFixed(2)}
Franchise: ${franchise}

Marketer's Discussion Trigger / Question:
"${userPrompt}"

Generate 4 realistic Discord chat messages from 4 authentic gamers reacting to this specific question (taking into account the price of $${dynamicPrice.toFixed(2)} if applicable):
1. Competitive Player (reacts to rank, loss streak, weapon TTK, Gulag retry utility at $${dynamicPrice.toFixed(2)})
2. High-Spend Whale (reacts to BlackCell vaults, spend threshold at $${dynamicPrice.toFixed(2)})
3. Social Co-op Squad Leader (reacts to Resurgence 4-player squad value, playing with friends at $${dynamicPrice.toFixed(2)})
4. F2P Purist / Critic (critiques pricing, microtransactions, game balance)

Output strict JSON:
{
  "model_used": "Vertex AI Gemini 3.5 Flash-Lite (Discord Simulation)",
  "debate_turns": [
    {
      "persona_id": "SweatGamer#4401",
      "archetype": "COMPETITIVE_GRINDER",
      "avatar": "⚔️",
      "name": "SweatGamer#4401",
      "message": "...",
      "wtp": ${dynamicPrice},
      "fsm_state": "PURCHASED",
      "sentiment_delta": "+15%"
    }
  ],
  "facilitator_takeaway": "..."
}
`;
      } else if (platform === "reddit") {
        // Ground the thread in real Reddit discussion before simulating it.
        // Previously this invented upvote counts, flairs and usernames with no
        // basis whatsoever, which is indistinguishable from real data on screen
        // and therefore the most dangerous kind of fake in a sales demo.
        try {
          const pulse = await fetchRedditPulse({
            franchise: franchiseCode,
            topic: userPrompt,
            offerTitle: campaignTitle,
            price: dynamicPrice,
          });
          groundingCitations = pulse.citations;
          groundingQueries = pulse.searchQueries;
          groundedThemes = pulse.themesText;
        } catch (e: any) {
          console.warn("[DeepSona Debate] Reddit grounding unavailable:", e?.message);
          return NextResponse.json(
            {
              error: "Live Reddit grounding is unavailable.",
              error_kind: "SOCIAL_GROUNDING_UNAVAILABLE",
              details: e?.message || String(e),
            },
            { status: 503 }
          );
        }

        systemPrompt = `You are analysing how a ${franchise} community would react to a marketing offer.

${cohortInfo}
Campaign Title: "${campaignTitle}"
Stated Offer Price: $${dynamicPrice.toFixed(2)}
Franchise: ${franchise}

Marketer Question / Thread Topic:
"${userPrompt}"

REAL community sentiment retrieved from Reddit via live Google Search grounding:
--- BEGIN GROUNDED RESEARCH ---
${groundedThemes}
--- END GROUNDED RESEARCH ---

Write 4 representative comments that reflect the positions found in the grounded
research above, reacting to "${userPrompt}" at $${dynamicPrice.toFixed(2)}.

Rules:
- Every position you write MUST trace back to a theme in the grounded research.
- Do NOT invent statistics, upvote counts, or claims not supported above.
- These are composite representations of real positions, not quotes from real
  people. Do not attribute them to real usernames.
- Cover the range of sentiment present in the research, including any positive
  or neutral positions. Do not make them uniformly negative.

Output strict JSON:
{
  "thread_title": "a realistic discussion title for this topic",
  "subreddit": "the most relevant subreddit named in the research",
  "debate_turns": [
    {
      "persona_id": "Value Analyst",
      "archetype": "ANALYTICAL_PURIST",
      "avatar": "📊",
      "name": "Value Analyst",
      "flair": "Composite of grounded sentiment",
      "grounded_theme": "which theme from the research this represents",
      "sentiment": "FAIR_VALUE",
      "message": "...",
      "wtp": ${dynamicPrice},
      "fsm_state": "PURCHASED",
      "sentiment_delta": "+15%"
    }
  ],
  "facilitator_takeaway": "what the marketing team should conclude"
}`;
      } else {
        // Standard DeepSona Player Focus Group (Tab 1)
        systemPrompt = `
You are orchestrating the DeepSona Multi-Agent Interactive Focus Group for ${franchise} using Google Cloud Vertex AI Gemini.

${cohortInfo}
Campaign Title: "${campaignTitle}"
Stated Offer Price: $${dynamicPrice.toFixed(2)}
Franchise: ${franchise}

Marketer's Question to the Focus Group:
"${userPrompt}"

Generate realistic, turn-by-turn debate responses between these 4 authentic gamer personas directly answering "${userPrompt}" at $${dynamicPrice.toFixed(2)}:
1. ${p1Name} (${p1Role} - Competitive player, evaluates rank protection and loss tilt reset at $${dynamicPrice.toFixed(2)})
2. ${p2Name} (${p2Role} - High LTV Whale, evaluates high-tier pack milestones & points vaults at $${dynamicPrice.toFixed(2)})
3. ${p3Name} (${p3Role} - Social/Squad leader, values co-op progression, double XP, and squad cosmetics at $${dynamicPrice.toFixed(2)})
4. ${p4Name} (${p4Role} - Value optimizer / tactical purist, evaluates fair pricing and anti-P2W balance at $${dynamicPrice.toFixed(2)})

Instructions:
- All 4 personas MUST directly react to the exact question "${userPrompt}".
- Reflect their willingness to pay (WTP) based on their reaction to $${dynamicPrice.toFixed(2)}.

Output strict JSON:
{
  "model_used": "Vertex AI Gemini 3.5 Flash-Lite",
  "debate_turns": [
    {
      "persona_id": "${p1Name}",
      "archetype": "COMPETITIVE_GRINDER",
      "avatar": "⚔️",
      "name": "${p1Name} (${p1Role})",
      "message": "Specific reaction to '${userPrompt}' at $${dynamicPrice.toFixed(2)}...",
      "wtp": ${dynamicPrice},
      "fsm_state": "PURCHASED",
      "sentiment_delta": "+10%"
    },
    {
      "persona_id": "${p2Name}",
      "archetype": "BLACKCELL_WHALE",
      "avatar": "💎",
      "name": "${p2Name} (${p2Role})",
      "message": "Specific reaction to '${userPrompt}' at $${dynamicPrice.toFixed(2)}...",
      "wtp": ${dynamicPrice},
      "fsm_state": "PURCHASED",
      "sentiment_delta": "+15%"
    },
    {
      "persona_id": "${p3Name}",
      "archetype": "CASUAL_SOCIALIZER",
      "avatar": "⚽",
      "name": "${p3Name} (${p3Role})",
      "message": "Specific reaction to '${userPrompt}' at $${dynamicPrice.toFixed(2)}...",
      "wtp": ${dynamicPrice > 10 ? 7.99 : dynamicPrice},
      "fsm_state": "PURCHASED",
      "sentiment_delta": "+8%"
    },
    {
      "persona_id": "${p4Name}",
      "archetype": "LORE_SEEKER",
      "avatar": "📋",
      "name": "${p4Name} (${p4Role})",
      "message": "Specific reaction to '${userPrompt}' at $${dynamicPrice.toFixed(2)}...",
      "wtp": 0.00,
      "fsm_state": "BOYCOTT",
      "sentiment_delta": "-15%"
    }
  ],
  "facilitator_takeaway": "Executive summary of player consensus on '${userPrompt}' at $${dynamicPrice.toFixed(2)}."
}
`;
      }

      const generatedText = await generateVertexContent(systemPrompt, true);
      const parsed = parseModelJson<any>(generatedText);
      if (!parsed) throw new Error("Model returned unparseable JSON");
      parsed.model_used = `Vertex AI Gemini 3.5 Flash-Lite`;

      if (platform === "reddit") {
        // Carry the provenance through to the UI so a presenter can open the
        // actual sources rather than asking the audience to take it on faith.
        parsed.grounded = true;
        parsed.source = "google_search_grounding";
        parsed.citations = groundingCitations;
        parsed.search_queries = groundingQueries;
        parsed.grounded_research = groundedThemes;
      } else {
        parsed.grounded = false;
        parsed.source = "synthetic_persona_simulation";
      }

      return NextResponse.json(parsed);
    } catch (e: any) {
      console.warn("[DeepSona Debate] Live generation parse error:", e?.message);

      // The Reddit tab's entire claim is that it reflects real community
      // sentiment. Serving canned text there would be a lie, so fail loudly.
      if (platform === "reddit") {
        return NextResponse.json(
          {
            error: "Could not structure the grounded Reddit research.",
            error_kind: "SOCIAL_GROUNDING_UNAVAILABLE",
            details: e?.message || String(e),
          },
          { status: 503 }
        );
      }

      // Dynamic fallback that still tracks the user prompt and price
      return NextResponse.json({
        model_used: "Vertex AI Gemini 3.5 Flash-Lite",
        grounded: false,
        source: "static_fallback",
        degraded: true,
        degraded_reason: "Live generation failed; showing illustrative personas.",
        debate_turns: [
          {
            persona_id: p1Name,
            archetype: "COMPETITIVE_GRINDER",
            avatar: "⚔️",
            name: `${p1Name} (${p1Role})`,
            message: `Regarding "${userPrompt}": At $${dynamicPrice.toFixed(2)}, as long as it protects my ranked progress, I'm buying it mid-tilt.`,
            wtp: dynamicPrice,
            fsm_state: "PURCHASED",
            sentiment_delta: "+10%",
          },
          {
            persona_id: p2Name,
            archetype: "BLACKCELL_WHALE",
            avatar: "💎",
            name: `${p2Name} (${p2Role})`,
            message: `At $${dynamicPrice.toFixed(2)}, that's an easy add-on, but add a 12,000 Points Vault option alongside it.`,
            wtp: Math.max(dynamicPrice, 49.99),
            fsm_state: "PURCHASED",
            sentiment_delta: "+15%",
          },
          {
            persona_id: p3Name,
            archetype: "CASUAL_SOCIALIZER",
            avatar: "⚽",
            name: `${p3Name} (${p3Role})`,
            message: `For $${dynamicPrice.toFixed(2)}, if this includes squad progression for Rush 5v5, our entire group will pitch in.`,
            wtp: Math.min(dynamicPrice, 7.99),
            fsm_state: dynamicPrice <= 10 ? "PURCHASED" : "EVALUATING",
            sentiment_delta: "+6%",
          },
          {
            persona_id: p4Name,
            archetype: "LORE_SEEKER",
            avatar: "📋",
            name: `${p4Name} (${p4Role})`,
            message: `$${dynamicPrice.toFixed(2)} is too expensive for defeat recovery. Microtransactions shouldn't gate competitive balance.`,
            wtp: 0,
            fsm_state: "BOYCOTT",
            sentiment_delta: "-10%",
          },
        ],
        facilitator_takeaway: `At $${dynamicPrice.toFixed(2)}, competitive players and whales maintain purchase intent, while casuals evaluate squad utility and purists reject the price point.`,
      });
    }
  } catch (error: any) {
    console.error("[DeepSona Debate] Route Error:", error);
    return NextResponse.json(
      { error: "Failed to generate debate simulation", details: error.message },
      { status: 500 }
    );
  }
}
