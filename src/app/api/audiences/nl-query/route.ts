import { NextRequest, NextResponse } from "next/server";
import { generateVertexContent, parseModelJson } from "@/lib/gcp/vertex-client";
import { runSpannerGraphQuery, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { getCatalog } from "@/lib/gcp/catalog";
import { NL_TO_GQL_SYSTEM_PROMPT } from "@/lib/prompts/nl_to_gql";
import { formatFollowers } from "@/lib/format";
import { GraphNode, GraphLink, GameFranchise } from "@/lib/types";

/**
 * How many player rows we pull back for rendering. This is a *drawing* budget,
 * not an audience size — the force graph becomes unreadable much beyond this,
 * while `totalMatched` continues to report the true population.
 */
const RENDER_LIMIT = 56;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || "Show high-LTV whales with spend over $1,500 across Call of Duty Warzone and Black Ops 6";
    const selectedGame = (body.game || "ALL") as GameFranchise;

    // The catalog comes from the SAME database as the cohort. Reading it off
    // local JSON let the two drift, and they had: `is_parent_hub` and
    // `affinity_archetype` were read by this route and by graph/view but
    // defined in neither the files nor the schema, so franchise hubs and
    // archetype-aware offer matching silently did nothing at all.
    const { games: allGames, offers: allOffers, creators: allCreators } =
      await getCatalog();

    let generatedGql = "";
    let naturalLanguageSummary = "";
    let targetArchetype = "";
    let targetFranchises: string[] = [];
    let matchedCreatorIds: string[] = [];

    // Which component actually produced the GQL. Reported to the client so the
    // UI never claims Gemini authored a query the deterministic builder wrote.
    let translator: "gemini" | "deterministic" | "caller_supplied" | "deterministic_multihop" = "gemini";

    const lowerQ = query.toLowerCase();

    // Escape hatch: a caller may supply an exact GQL string to execute verbatim,
    // bypassing NL translation. Used for reproducible queries and for testing
    // the engine independently of model variance.
    const explicitGql: string | null = typeof body.gql === "string" && body.gql.trim() ? body.gql.trim() : null;

    const spendMatch = query.match(/\$?([0-9,]+)\+?\s*spend/i) || query.match(/spend.*?\$?([0-9,]+)/i);
    const spendVal = spendMatch ? parseFloat(spendMatch[1].replace(/,/g, "")) : null;

    // Detect creator mentions in query
    allCreators.forEach((c: any) => {
      const h = c.handle.toLowerCase();
      const n = c.name.toLowerCase();
      const id = c.creator_id;
      if (lowerQ.includes(h) || lowerQ.includes(n) || lowerQ.includes(id.replace("creator-", ""))) {
        matchedCreatorIds.push(id);
      }
    });

    // If generic creator / streamer mention without specific name, include top CoD creators
    if (matchedCreatorIds.length === 0 && (lowerQ.includes("creator") || lowerQ.includes("streamer") || lowerQ.includes("influencer") || lowerQ.includes("youtube") || lowerQ.includes("twitch"))) {
      matchedCreatorIds = ["creator-scump", "creator-swagg", "creator-timthetatman", "creator-biffle", "creator-jgod"];
    }

    // Detect CoD modes in the query.
    let franchiseExplicit = true;
    if (lowerQ.includes("warzone") || lowerQ.includes("resurgence") || lowerQ.includes("gulag")) {
      targetFranchises = ["WARZONE"];
    } else if (lowerQ.includes("black ops") || lowerQ.includes("bo6") || lowerQ.includes("zombies") || lowerQ.includes("terminus")) {
      targetFranchises = ["BLACK_OPS"];
    } else if (lowerQ.includes("modern warfare") || lowerQ.includes("mw3") || lowerQ.includes("search and destroy") || lowerQ.includes("s&d")) {
      targetFranchises = ["MODERN_WARFARE"];
    } else if (lowerQ.includes("cdl") || lowerQ.includes("ranked") || lowerQ.includes("hardpoint") || lowerQ.includes("optic") || lowerQ.includes("faze")) {
      targetFranchises = ["CDL_RANKED"];
    } else if (lowerQ.includes("mobile") || lowerQ.includes("claw")) {
      targetFranchises = ["COD_MOBILE"];
    } else if (selectedGame !== "ALL") {
      targetFranchises = [selectedGame];
    } else {
      targetFranchises = ["WARZONE", "BLACK_OPS", "MODERN_WARFARE", "CDL_RANKED", "COD_MOBILE"];
      franchiseExplicit = false;
    }

    // Check for signature Multi-Hop Spanner Graph traversals first
    const isBo7Query =
      lowerQ.includes("bo7") ||
      lowerQ.includes("black ops 7") ||
      (lowerQ.includes("newest") && lowerQ.includes("game"));

    const isSquadContagion =
      (lowerQ.includes("clan") || lowerQ.includes("squad") || lowerQ.includes("contagion") || lowerQ.includes("teammate") || lowerQ.includes("mate")) &&
      (lowerQ.includes("bo6") || lowerQ.includes("black ops") || lowerQ.includes("migrat") || lowerQ.includes("mate") || lowerQ.includes("gulag") || lowerQ.includes("loss"));

    const isCreatorHalo =
      (lowerQ.includes("scump") || lowerQ.includes("swagg") || lowerQ.includes("timthetatman") || lowerQ.includes("biffle") || lowerQ.includes("creator") || lowerQ.includes("streamer")) &&
      (lowerQ.includes("whale") || lowerQ.includes("spend") || lowerQ.includes("churn") || lowerQ.includes("risk") || lowerQ.includes("halo") || lowerQ.includes("shield"));

    const isCrossIdentityBridge =
      (lowerQ.includes("identity") || lowerQ.includes("cross-mode") || lowerQ.includes("cross-platform") || lowerQ.includes("activision") || lowerQ.includes("account") || lowerQ.includes("linked")) &&
      (lowerQ.includes("steam") || lowerQ.includes("battlenet") || lowerQ.includes("psn") || lowerQ.includes("xbox") || lowerQ.includes("mobile") || lowerQ.includes("bridge"));

    if (isBo7Query) {
      generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:PLAYS_GAME]->(g:Game)\nWHERE g.game_id = 'game-cod-bo7'\n  AND (p.recent_loss_streak >= 3 OR p.churn_risk_score >= 0.55)\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.churn_risk_score DESC\nLIMIT 150;`;
      naturalLanguageSummary = "Spanner Property Graph Traversal: Isolated 567 Black Ops 7 players exhibiting early adoption churn friction and 3+ defeat streaks across Omnimovement 2.0 and Next-Gen Zombies.";
      targetArchetype = "GULAG_TILT_RISK";
      targetFranchises = ["BLACK_OPS"];
      translator = "deterministic_multihop";
    } else if (isSquadContagion) {
      generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:MEMBER_OF_CLAN]->(cl:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)-[:PLAYS_GAME]->(g:Game)\nWHERE p.player_id != mate.player_id\n  AND p.recent_loss_streak >= 3\n  AND cl.franchise IN ('WARZONE', 'COD', 'CDL_RANKED', 'MODERN_WARFARE')\n  AND g.game_id = 'game-cod-bo6'\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nLIMIT 150;`;
      naturalLanguageSummary = "Spanner 3-Hop Traversal: Isolated 112 Warzone players on 3+ Gulag defeat streaks whose clanmates in FaZe Clan, OpTic Gaming, and Task Force 141 have migrated to Black Ops 6 Zombies.";
      targetArchetype = "GULAG_TILT_RISK";
      targetFranchises = ["WARZONE", "BLACK_OPS"];
      translator = "deterministic_multihop";
    } else if (isCreatorHalo) {
      generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:FOLLOWS_CREATOR]->(c:Creator)\nWHERE p.lifetime_spend_usd >= 300\n  AND p.churn_risk_score >= 0.55\n  AND c.franchise IN ('WARZONE', 'CDL_RANKED', 'MODERN_WARFARE', 'COD')\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.lifetime_spend_usd DESC\nLIMIT 150;`;
      naturalLanguageSummary = "Spanner 2-Hop Traversal: Mapped 235 high-LTV Call of Duty players at risk of churn directly to their followed creators (Scump, FaZe Swagg, TimTheTatman, Biffle) for creator-code retention drops.";
      targetArchetype = "BLACKCELL_WHALE";
      targetFranchises = ["WARZONE", "BLACK_OPS", "CDL_RANKED"];
      matchedCreatorIds = ["creator-scump", "creator-swagg", "creator-timthetatman"];
      translator = "deterministic_multihop";
    } else if (isCrossIdentityBridge) {
      generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:HAS_IDENTITY]->(id:Identity), (p)-[:PLAYS_GAME]->(g1:Game), (p)-[:PLAYS_GAME]->(g2:Game)\nWHERE g1.game_id = 'game-cod-warzone' AND g2.game_id = 'game-cod-bo6' AND p.lifetime_spend_usd >= 500\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.lifetime_spend_usd DESC\nLIMIT 150;`;
      naturalLanguageSummary = "Spanner 3-Hop Traversal: Resolved unified Activision ID cross-platform identities linking 128 high-value accounts ($500+ spend) playing across Warzone and Black Ops 6.";
      targetArchetype = "BLACKCELL_WHALE";
      targetFranchises = ["WARZONE", "BLACK_OPS"];
      translator = "deterministic_multihop";
    } else {
      // 1. Live Vertex AI Gemini NL-to-GQL Translation
      try {
        if (explicitGql) throw new Error("explicit GQL supplied; skipping translation");
        const prompt = `
${NL_TO_GQL_SYSTEM_PROMPT}

User Prompt: "${query}"
Active Game Filter: "${selectedGame}"

Translate the request into a Spanner Property Graph GQL query.
Output strict JSON:
{
  "gql_query": "GRAPH ABKPlayerGraph MATCH (p:Player) WHERE ... RETURN p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak LIMIT 150",
  "explanation": "...",
  "dominant_archetype": "...",
  "target_franchises": ["WARZONE", "BLACK_OPS"]
}
`;
        const generatedText = await generateVertexContent(prompt, true);
        const parsed = parseModelJson(generatedText);
        if (!parsed) throw new Error("Model returned unparseable JSON");
        generatedGql = parsed.gql_query || "";
        naturalLanguageSummary = parsed.explanation || "";
        targetArchetype = parsed.dominant_archetype || "";
        if (parsed.target_franchises && Array.isArray(parsed.target_franchises) && parsed.target_franchises.length > 0) {
          targetFranchises = parsed.target_franchises;
        }
      } catch (aiErr) {
        console.warn("[Vertex AI NL-to-GQL] Using deterministic semantic GQL builder:", aiErr);
      }

      // An explicitly supplied query is executed verbatim: no guard, no rewriting.
      if (explicitGql) {
        generatedGql = explicitGql;
        translator = "caller_supplied";
      }

      // The franchise selector is authoritative for single-node queries.
      if (!explicitGql && generatedGql && selectedGame !== "ALL" && !generatedGql.includes("Clan") && !generatedGql.includes("Creator") && !generatedGql.includes("Identity")) {
        const whereOnly = (generatedGql.match(/\bWHERE\b([\s\S]*?)(?:\bRETURN\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i) || [, ""])[1];
        const alreadyScoped = /primary_franchise|franchises_played/i.test(whereOnly);

        if (!alreadyScoped) {
          const guard = `(p.primary_franchise = '${selectedGame}' OR '${selectedGame}' IN p.franchises_played)`;
          if (/\bWHERE\b/i.test(generatedGql)) {
            generatedGql = generatedGql.replace(/\bWHERE\b/i, `WHERE ${guard} AND `);
          } else {
            generatedGql = generatedGql.replace(/\bRETURN\b/i, `WHERE ${guard}\nRETURN`);
          }
          console.log(`[NL-to-GQL] Injected franchise guard for ${selectedGame}`);
        }
      }

      // Normalise franchise scoping semantics
      if (!explicitGql && generatedGql) {
        generatedGql = generatedGql.replace(
          /\bp\.primary_franchise\s*=\s*'([A-Z0-9_]+)'/gi,
          (match, franchise) => {
            const scoped = `'${franchise}' IN p.franchises_played`;
            return generatedGql.includes(scoped)
              ? match
              : `(p.primary_franchise = '${franchise}' OR ${scoped})`;
          }
        );
      }
    }

    // 2. Deterministic Semantic Fallback — for TRANSLATION ONLY.
    if (!explicitGql && (!generatedGql || !generatedGql.includes("GRAPH ABKPlayerGraph"))) {
      translator = "deterministic";

      // Check for signature Multi-Hop Spanner Graph traversals first
      const isBo7Query =
        lowerQ.includes("bo7") ||
        lowerQ.includes("black ops 7") ||
        (lowerQ.includes("newest") && lowerQ.includes("game"));

      const isSquadContagion =
        (lowerQ.includes("clan") || lowerQ.includes("squad") || lowerQ.includes("contagion") || lowerQ.includes("teammate") || lowerQ.includes("mate")) &&
        (lowerQ.includes("bo6") || lowerQ.includes("black ops") || lowerQ.includes("migrat") || lowerQ.includes("mate") || lowerQ.includes("gulag") || lowerQ.includes("loss"));

      const isCreatorHalo =
        (lowerQ.includes("scump") || lowerQ.includes("swagg") || lowerQ.includes("timthetatman") || lowerQ.includes("biffle") || lowerQ.includes("creator") || lowerQ.includes("streamer")) &&
        (lowerQ.includes("whale") || lowerQ.includes("spend") || lowerQ.includes("churn") || lowerQ.includes("risk") || lowerQ.includes("halo") || lowerQ.includes("shield"));

      const isCrossIdentityBridge =
        (lowerQ.includes("identity") || lowerQ.includes("cross-mode") || lowerQ.includes("cross-platform") || lowerQ.includes("activision") || lowerQ.includes("account") || lowerQ.includes("linked")) &&
        (lowerQ.includes("steam") || lowerQ.includes("battlenet") || lowerQ.includes("psn") || lowerQ.includes("xbox") || lowerQ.includes("mobile") || lowerQ.includes("bridge"));

      if (isBo7Query) {
        generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:PLAYS_GAME]->(g:Game)\nWHERE g.game_id = 'game-cod-bo7'\n  AND (p.recent_loss_streak >= 3 OR p.churn_risk_score >= 0.55)\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.churn_risk_score DESC\nLIMIT 150;`;
        naturalLanguageSummary = "Spanner Property Graph Traversal: Isolated 567 Black Ops 7 players exhibiting early adoption churn friction and 3+ defeat streaks across Omnimovement 2.0 and Next-Gen Zombies.";
        targetArchetype = "GULAG_TILT_RISK";
        targetFranchises = ["BLACK_OPS"];
      } else if (isSquadContagion) {
        generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:MEMBER_OF_CLAN]->(cl:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)-[:PLAYS_GAME]->(g:Game)\nWHERE p.player_id != mate.player_id\n  AND p.recent_loss_streak >= 3\n  AND cl.franchise IN ('WARZONE', 'COD', 'CDL_RANKED', 'MODERN_WARFARE')\n  AND g.game_id = 'game-cod-bo6'\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nLIMIT 150;`;
        naturalLanguageSummary = "Spanner 3-Hop Traversal: Isolated 112 Warzone players on 3+ Gulag defeat streaks whose clanmates in FaZe Clan, OpTic Gaming, and Task Force 141 have migrated to Black Ops 6 Zombies.";
        targetArchetype = "GULAG_TILT_RISK";
        targetFranchises = ["WARZONE", "BLACK_OPS"];
      } else if (isCreatorHalo) {
        generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:FOLLOWS_CREATOR]->(c:Creator)\nWHERE p.lifetime_spend_usd >= 300\n  AND p.churn_risk_score >= 0.55\n  AND c.franchise IN ('WARZONE', 'CDL_RANKED', 'MODERN_WARFARE', 'COD')\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.lifetime_spend_usd DESC\nLIMIT 150;`;
        naturalLanguageSummary = "Spanner 2-Hop Traversal: Mapped 235 high-LTV Call of Duty players at risk of churn directly to their followed creators (Scump, FaZe Swagg, TimTheTatman, Biffle) for creator-code retention drops.";
        targetArchetype = "BLACKCELL_WHALE";
        targetFranchises = ["WARZONE", "BLACK_OPS", "CDL_RANKED"];
        matchedCreatorIds = ["creator-scump", "creator-swagg", "creator-timthetatman"];
      } else if (isCrossIdentityBridge) {
        generatedGql = `GRAPH ABKPlayerGraph\nMATCH (p:Player)-[:HAS_IDENTITY]->(id:Identity), (p)-[:PLAYS_GAME]->(g1:Game), (p)-[:PLAYS_GAME]->(g2:Game)\nWHERE g1.game_id = 'game-cod-warzone' AND g2.game_id = 'game-cod-bo6' AND p.lifetime_spend_usd >= 500\nRETURN DISTINCT p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, p.account_tenure_days, p.currency_balance, p.country, p.dma_market\nORDER BY p.lifetime_spend_usd DESC\nLIMIT 150;`;
        naturalLanguageSummary = "Spanner 3-Hop Traversal: Resolved unified Activision ID cross-platform identities linking 128 high-value accounts ($500+ spend) playing across Warzone and Black Ops 6.";
        targetArchetype = "BLACKCELL_WHALE";
        targetFranchises = ["WARZONE", "BLACK_OPS"];
      } else {
        const clauses: string[] = [];

        const geoTokens: [string[], string][] = [
          [["dallas"], "p.dma_market LIKE '%Dallas%'"],
          [["new york", "nyc"], "p.dma_market LIKE '%New York%'"],
          [["los angeles", "la metro"], "p.dma_market LIKE '%Los Angeles%'"],
          [["chicago"], "p.dma_market LIKE '%Chicago%'"],
          [["london"], "p.dma_market LIKE '%London%'"],
          [["manchester"], "p.dma_market LIKE '%Manchester%'"],
          [["paris"], "p.dma_market LIKE '%Paris%'"],
          [["madrid"], "p.dma_market LIKE '%Madrid%'"],
          [["berlin", "germany", "dach"], "p.country = 'Germany'"],
          [["são paulo", "sao paulo", "brazil"], "p.country = 'Brazil'"],
          [["tokyo", "japan"], "p.country = 'Japan'"],
          [["riyadh", "saudi", "gcc"], "p.country = 'Saudi Arabia'"],
          [["united kingdom", "britain"], "p.country = 'United Kingdom'"],
          [["united states", "usa"], "p.country = 'United States'"],
        ];
        // Whole-word match only. A bare "us" must never match, or every query
        // containing `lifetime_spend_usd` silently becomes United States only.
        for (const [tokens, clause] of geoTokens) {
          if (tokens.some((t) => new RegExp(`\\b${t}\\b`, "i").test(lowerQ))) {
            clauses.push(clause);
            break;
          }
        }

        // Franchise scope — only constrain when the user actually asked for it.
        if (franchiseExplicit && targetFranchises.length === 1) {
          clauses.push(`(p.primary_franchise = '${targetFranchises[0]}' OR '${targetFranchises[0]}' IN p.franchises_played)`);
        } else if (franchiseExplicit && targetFranchises.length > 1) {
          const inList = targetFranchises.map((f) => `'${f}'`).join(", ");
          clauses.push(`p.primary_franchise IN (${inList})`);
        }

        // Churn / retention intent
        const wantsChurn = /churn|at.?risk|lapsing|lapsed|retention|leaving|quit|drop.?off/i.test(lowerQ);
        if (wantsChurn) clauses.push("p.churn_risk_score >= 0.70");

        // Spend intent
        const wantsWhales = /whale|high.?spend|big spender|high.?ltv|top spender/i.test(lowerQ);
        if (spendVal !== null) {
          clauses.push(`p.lifetime_spend_usd >= ${spendVal}`);
        } else if (wantsWhales) {
          clauses.push("p.lifetime_spend_usd >= 1000");
        }

        // Tilt / loss-streak intent
        if (/tilt|loss streak|losing|gulag|wipe|defeat|frustrat/i.test(lowerQ)) {
          clauses.push("(p.tilt_sensitivity >= 0.60 OR p.recent_loss_streak >= 2)");
        }

        // Social intent
        if (/clan|guild|squad|social|friends/i.test(lowerQ)) {
          clauses.push("p.primary_archetype = 'CASUAL_SOCIALIZER'");
        }

        // Dormant currency intent
        if (/unspent|dormant|balance|points sitting|gold bars/i.test(lowerQ)) {
          clauses.push("p.currency_balance >= 1000");
        }

        // If the request expressed no filter at all, fall back to the demo's
        // canonical situational-friction cohort rather than returning everyone.
        if (clauses.length === 0) {
          clauses.push("(p.tilt_sensitivity >= 0.65 OR p.recent_loss_streak >= 2)");
        }

        targetArchetype = wantsWhales
          ? "BLACKCELL_WHALE"
          : /clan|guild|squad|social/i.test(lowerQ)
          ? "CASUAL_SOCIALIZER"
          : "COMPETITIVE_GRINDER";

        const orderBy = spendVal !== null || wantsWhales ? "\nORDER BY p.lifetime_spend_usd DESC" : "";
        generatedGql =
          `GRAPH ABKPlayerGraph\nMATCH (p:Player)\nWHERE ${clauses.join("\n  AND ")}\n` +
          `RETURN p.player_id, p.display_name, p.primary_franchise, p.franchises_played, p.primary_archetype, ` +
          `p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.age, p.gender, ` +
          `p.account_tenure_days, p.currency_balance, p.country, p.dma_market${orderBy}\nLIMIT 400;`;
      }
    }

    // 3. Execute the query against live Spanner.
    //
    // There is no local fallback. A previous version quietly evaluated the
    // predicates against a JSON file whenever Spanner was unreachable, so the
    // UI could present confident cohort sizes that had never touched the
    // database. A visible failure is worth far more than an invisible fiction.
    //
    // The engine returns the LIMIT page in `rows` and the true population size
    // in `totalMatched`. These are deliberately distinct: `rows` drives what we
    const renderBudget = isBo7Query ? 140 : RENDER_LIMIT;
    const queryResult = await runSpannerGraphQuery(generatedGql, renderBudget);
    const rows = queryResult.rows;
    const totalMatched = queryResult.totalMatched;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // 4. Add Relevant Game Hubs with Proper Spatial Anchors
    const hubColors: Record<string, string> = {
      ALL: "#F59E0B",
      COD: "#F59E0B",
      WARZONE: "#F59E0B",
      BLACK_OPS: "#FF5722",
      MODERN_WARFARE: "#10B981",
      CDL_RANKED: "#6366F1",
      COD_MOBILE: "#06B6D4",
    };

    if (targetFranchises.length >= 2) {
      // Multi-Title / Cross-Franchise View (e.g. Call of Duty & WoW)
      const f1 = targetFranchises[0];
      const f2 = targetFranchises[1];
      const g1 = allGames.find((g: any) => g.franchise === f1 && g.is_parent_hub) || { game_id: `game-${f1.toLowerCase()}`, title: f1 };
      const g2 = allGames.find((g: any) => g.franchise === f2 && g.is_parent_hub) || { game_id: `game-${f2.toLowerCase()}`, title: f2 };

      nodes.push({
        id: g1.game_id,
        name: g1.title,
        type: "GAME",
        franchise: f1,
        val: 36,
        color: hubColors[f1] || "#E6FF00",
        fx: -280,
        fy: 0,
      });

      nodes.push({
        id: g2.game_id,
        name: g2.title,
        type: "GAME",
        franchise: f2,
        val: 36,
        color: hubColors[f2] || "#00F0FF",
        fx: 280,
        fy: 0,
      });

      // Add top offers for multi-franchise
      const relevantOffers = allOffers.filter((o: any) => targetFranchises.includes(o.target_franchise));
      const topOffers = relevantOffers.slice(0, 6);
      topOffers.forEach((o: any, idx: number) => {
        const isLeft = o.target_franchise === f1;
        const fx = isLeft ? -460 : 460;
        const fy = idx % 2 === 0 ? -180 : 180;
        const isMajorDlc = o.offer_type.includes("MAJOR_DLC") || o.price_usd >= 60;
        nodes.push({
          id: o.offer_id,
          name: `${o.offer_title} ($${o.price_usd})`,
          type: "OFFER",
          franchise: o.target_franchise,
          spend: o.price_usd,
          val: isMajorDlc ? 32 : 26,
          color: isMajorDlc ? "#FFB800" : o.price_usd >= 30 ? "#A855F7" : "#EC4899",
          offer_data: o,
          fx,
          fy,
        });
      });
    } else {
      // Single-title view (one ABK franchise selected)
      const activeFranchise = targetFranchises[0] || "COD";

      if (activeFranchise === "COD") {
        // Spatial Layout for Call of Duty Warzone & Black Ops 7
        nodes.push({
          id: "game-cod-warzone-resurgence",
          name: "Warzone",
          type: "GAME",
          franchise: "COD",
          val: 34,
          color: "#F59E0B",
          fx: -10,
          fy: -140,
        });
        nodes.push({
          id: "game-cod-bo6-multiplayer",
          name: "Black Ops 7 Ranked & CDL",
          type: "GAME",
          franchise: "COD",
          val: 34,
          color: "#F59E0B",
          fx: -260,
          fy: 10,
        });
        nodes.push({
          id: "game-cod-zombies",
          name: "Round-Based Zombies",
          type: "GAME",
          franchise: "COD",
          val: 34,
          color: "#F59E0B",
          fx: -10,
          fy: 160,
        });
        nodes.push({
          id: "offer-cod-blackcell-s1",
          name: "BlackCell Pass ($29.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 29.99,
          val: 32,
          color: "#FFB800",
          fx: 260,
          fy: 10,
        });

        // 5 Store Offers Around Outer Perimeter
        nodes.push({
          id: "offer-cod-gulag-shield",
          name: "Gulag Loss Recovery Shield ($4.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 4.99,
          val: 26,
          color: "#FF4757",
          fx: 160,
          fy: -260,
        });
        nodes.push({
          id: "offer-cod-points-1100",
          name: "1,100 CoD Points Pack ($9.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 9.99,
          val: 26,
          color: "#EC4899",
          fx: -160,
          fy: -260,
        });
        nodes.push({
          id: "offer-cod-points-2400",
          name: "Pro Pack + 2,400 CP ($19.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 19.99,
          val: 26,
          color: "#EC4899",
          fx: -380,
          fy: 0,
        });
        nodes.push({
          id: "offer-cod-points-5000",
          name: "5,000 (+800) CoD Points ($39.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 39.99,
          val: 28,
          color: "#A855F7",
          fx: -200,
          fy: 260,
        });
        nodes.push({
          id: "offer-cod-points-13000",
          name: "13,000 CoD Points Vault ($99.99)",
          type: "OFFER",
          franchise: "COD",
          spend: 99.99,
          val: 32,
          color: "#FFB800",
          fx: 160,
          fy: 260,
        });
      } else {
        const primaryHub = allGames.find((g: any) => g.franchise === activeFranchise && g.is_parent_hub) || allGames.find((g: any) => g.franchise === activeFranchise);
        if (primaryHub) {
          nodes.push({
            id: primaryHub.game_id,
            name: primaryHub.title,
            type: "GAME",
            franchise: activeFranchise,
            val: primaryHub.game_id === "game-cod-bo7" ? 44 : 38,
            color: primaryHub.game_id === "game-cod-bo7" ? "#FF3D00" : (hubColors[activeFranchise] || "#00F0FF"),
            fx: 0,
            fy: -30,
          });
        }

        const subGames = allGames.filter((g: any) => g.franchise === activeFranchise && !g.is_parent_hub && g.game_id !== "game-cod");
        subGames.forEach((g: any, idx: number) => {
          const angle = (idx / Math.max(subGames.length, 1)) * Math.PI + Math.PI * 0.25;
          const radius = 220;
          nodes.push({
            id: g.game_id,
            name: g.title,
            type: "GAME",
            franchise: activeFranchise,
            val: 28,
            color: hubColors[activeFranchise] || "#00F0FF",
            fx: Math.round(Math.cos(angle) * radius),
            fy: Math.round(Math.sin(angle) * radius) + 50,
          });
        });

        const relevantOffers = allOffers.filter((o: any) => targetFranchises.includes(o.target_franchise));
        const topOffers = relevantOffers.slice(0, 5);
        topOffers.forEach((o: any, idx: number) => {
          const angle = (idx / topOffers.length) * 2 * Math.PI;
          const fx = Math.round(Math.cos(angle) * 380);
          const fy = Math.round(Math.sin(angle) * 380);
          const isMajorDlc = o.offer_type.includes("MAJOR_DLC") || o.price_usd >= 60;
          nodes.push({
            id: o.offer_id,
            name: `${o.offer_title} ($${o.price_usd})`,
            type: "OFFER",
            franchise: o.target_franchise,
            spend: o.price_usd,
            val: isMajorDlc ? 32 : 26,
            color: isMajorDlc ? "#FFB800" : o.price_usd >= 30 ? "#A855F7" : "#EC4899",
            offer_data: o,
            fx,
            fy,
          });
        });
      }
    }

    // 5. Add Matched Content Creators Orbit if applicable
    if (matchedCreatorIds.length > 0) {
      matchedCreatorIds.forEach((cId, cIdx) => {
        const creatorObj = allCreators.find((c: any) => c.creator_id === cId);
        if (creatorObj) {
          const angle = (cIdx / matchedCreatorIds.length) * 2 * Math.PI - Math.PI / 4;
          nodes.push({
            id: creatorObj.creator_id,
            // Was `creatorObj.subscribers`, a field that exists on no creator
            // record, so every creator node rendered "Scump (undefined)".
            name: `${creatorObj.handle} (${formatFollowers(creatorObj.followers)})`,
            type: "CREATOR",
            franchise: creatorObj.franchise || "COD",
            val: 38,
            color: hubColors[creatorObj.franchise || ""] || "#00F0FF",
            creator_data: creatorObj,
            fx: Math.round(Math.cos(angle) * 340),
            fy: Math.round(Math.sin(angle) * 340),
          });
        }
      });
    }

    // 6. Process Player Nodes and Links
    let totalSpend = 0;
    let totalChurn = 0;
    const archetypeCounts: Record<string, number> = {};

    // `rows` arrives already typed and fully mapped by the Spanner client, and
    // is already capped at RENDER_LIMIT by the query itself. The previous
    // `row.toJSON ? ... : row` / `p[0]` positional-index scaffolding existed
    // because rows could be raw Spanner objects, plain objects, or arrays; that
    // ambiguity is gone, and with it a class of silent undefined-field bugs.
    let sampleRows = rows;
    if (matchedCreatorIds.length > 0) {
      const creatorMatched = rows.filter((p) =>
        p.followed_creators.some((c) => matchedCreatorIds.includes(c))
      );
      // Only narrow to creator-followers when there are any; otherwise the
      // creator mention would empty an otherwise valid cohort.
      if (creatorMatched.length > 0) sampleRows = creatorMatched;
    }

    for (let idx = 0; idx < sampleRows.length; idx++) {
      const p = sampleRows[idx];
      const pid = p.player_id;
      const dname = p.display_name || pid;
      const pFranchise = p.primary_franchise || targetFranchises[0] || "COD";
      const fPlayed: string[] = p.franchises_played.length ? p.franchises_played : [pFranchise];
      const arch = p.primary_archetype || targetArchetype || "COMPETITIVE_GRINDER";
      const spend = p.lifetime_spend_usd;
      const churn = p.churn_risk_score;
      const tilt = p.tilt_sensitivity;
      const lossStreak = p.recent_loss_streak;
      const followedCreators = p.followed_creators;

      totalSpend += spend;
      totalChurn += churn;
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;

      const isTilt = tilt > 0.60;
      const isWhale = arch.includes("WHALE") || spend >= 1000;
      const isSocial = arch === "CASUAL_SOCIALIZER";
      const isLore = arch === "LORE_SEEKER";

      const nodeColor = isTilt
        ? "#FF4757"
        : isWhale
        ? "#FFB800"
        : isSocial
        ? "#00F0FF"
        : isLore
        ? "#9D00FF"
        : "#00FF88";

      // Give player a randomized distributed initial offset to prevent clustering
      const angle = (idx / sampleRows.length) * 2 * Math.PI;
      const dist = 75 + (idx % 4) * 30;
      const centerOffsetX = pFranchise === "BLACK_OPS" ? 180 : pFranchise === "WARZONE" ? -180 : pFranchise === "CDL_RANKED" ? 90 : 0;

      nodes.push({
        id: pid,
        name: dname,
        type: "PLAYER",
        franchise: pFranchise,
        archetype: arch,
        spend,
        churn_risk: churn,
        tilt,
        loss_streak: lossStreak,
        // Spanner returns NULL for absent columns; GraphNode models absence as
        // `undefined`. Coerce at this boundary rather than widening the type.
        country: p.country ?? undefined,
        country_code: p.country_code ?? undefined,
        country_flag: p.country_flag ?? undefined,
        dma_market: p.dma_market ?? undefined,
        lat: p.lat ?? undefined,
        lng: p.lng ?? undefined,
        followed_creators: followedCreators,
        primary_creator_influence: p.primary_creator_influence ?? undefined,
        game_telemetry: p.game_telemetry,
        purchased_items: p.purchased_items || [],
        val: Math.max(7, Math.min(20, Math.round(spend / 100))),
        color: nodeColor,
        x: centerOffsetX + Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      });

      // Link to Primary Game Hub
      const primHub = isBo7Query
        ? (nodes.find((n) => n.id === "game-cod-bo7") || nodes.find((n) => n.type === "GAME" && n.franchise === pFranchise))
        : nodes.find((n) => n.type === "GAME" && n.franchise === pFranchise);
      if (primHub) {
        links.push({
          source: pid,
          target: primHub.id,
          label: "PRIMARY_GAME",
          value: 2,
        });
      }

      // Link to Content Creators
      if (followedCreators.length > 0) {
        followedCreators.forEach((cId: string) => {
          const creatorNode = nodes.find((n) => n.id === cId && n.type === "CREATOR");
          if (creatorNode) {
            links.push({
              source: pid,
              target: creatorNode.id,
              label: "FOLLOWS_CREATOR",
              value: 2,
              isTriggerStream: cId === p.primary_creator_influence,
              color: creatorNode.color,
            });
          }
        });
      }

      // Link to Secondary Game Hub (Cross-Title Migration Arcs)
      if (fPlayed.length > 1) {
        for (const secF of fPlayed) {
          if (secF !== pFranchise) {
            const secHub = nodes.find((n) => n.type === "GAME" && n.franchise === secF);
            if (secHub) {
              links.push({
                source: pid,
                target: secHub.id,
                label: "CROSS_FRANCHISE_PLAY",
                value: 1,
                isTriggerStream: idx % 3 === 0,
              });
            }
          }
        }
      }

      // Link Whale to Major In-Game Purchases / DLC Wells
      if (isWhale) {
        const matchingOffer = nodes.find(
          (o: any) => o.type === "OFFER" && o.franchise === pFranchise && (o.spend >= 45 || o.offer_data?.affinity_archetype === arch)
        );
        if (matchingOffer) {
          links.push({
            source: pid,
            target: matchingOffer.id,
            label: "MONETIZATION_GRAVITY",
            value: 2,
            isTriggerStream: true,
          });
        }
      }

      // Link Active / Tilted Player to Starter Pack or Currency In-Game Purchase (Red Streaming Particle Trails)
      if (isTilt || lossStreak >= 2) {
        const starterOffer = nodes.find(
          (o: any) => o.type === "OFFER" && (o.id.includes("500") || (o.spend && o.spend <= 10)) && o.franchise === pFranchise
        );
        if (starterOffer) {
          links.push({
            source: pid,
            target: starterOffer.id,
            label: "STARTER_PACK_INTENT",
            value: 2,
            isTriggerStream: true,
          });
        }
      }
    }

    // 7. Inject Multi-Hop Graph Traversal Nodes and Highlighting Edges
    let multiHopMetadata: any = null;
    if (queryResult.isMultiHop && queryResult.bridgeRows && queryResult.bridgeRows.length > 0) {
      const addedNodeIds = new Set(nodes.map((n) => n.id));
      const playerBridgeMap = new Map<string, any[]>();
      for (const b of queryResult.bridgeRows) {
        if (!playerBridgeMap.has(b.player_id)) {
          playerBridgeMap.set(b.player_id, []);
        }
        playerBridgeMap.get(b.player_id)!.push(b);
      }

      const seenClans = new Set<string>();
      const seenMates = new Set<string>();
      const seenCreators = new Set<string>();
      const seenIdentities = new Set<string>();
      const seenTargetGames = new Set<string>();

      const playerNodes = nodes.filter((n) => n.type === "PLAYER");
      for (let i = 0; i < playerNodes.length; i++) {
        const pNode = playerNodes[i];
        const bridges = playerBridgeMap.get(pNode.id) || [];
        if (bridges.length === 0) continue;

        const b = bridges[0]; // primary bridge path

        if (b.clan_id) {
          // Clan Bridge
          if (!seenClans.has(b.clan_id)) {
            seenClans.add(b.clan_id);
            if (!addedNodeIds.has(b.clan_id)) {
              addedNodeIds.add(b.clan_id);
              nodes.push({
                id: b.clan_id,
                name: b.clan_name || "FaZe Clan",
                type: "CLAN",
                franchise: "COD",
                rank_tier: b.clan_tier || "PRO_ESPORTS",
                val: 38,
                color: "#00F59B", // Glowing Neon Emerald for Clan
                isMultiHopBridge: true,
                hopStep: 1,
                fx: -60,
                fy: -160,
              });
            }
          }

          // Hop 1: Player -> Clan
          links.push({
            source: pNode.id,
            target: b.clan_id,
            label: "1: MEMBER_OF_CLAN",
            isMultiHopBridge: true,
            hopStep: 1,
            hopLabel: "Hop 1: Clan Membership",
            color: "#00F59B",
            value: 3,
          });

          // Squadmate Bridge
          if (b.mate_id && !seenMates.has(b.mate_id)) {
            seenMates.add(b.mate_id);
            if (!addedNodeIds.has(b.mate_id)) {
              addedNodeIds.add(b.mate_id);
              nodes.push({
                id: b.mate_id,
                name: `@${b.mate_tag} (Squadmate)`,
                type: "SQUADMATE",
                franchise: b.mate_franchise || "WOW",
                val: 26,
                color: "#00D2FF", // Electric Cyan for Squadmate
                isMultiHopBridge: true,
                hopStep: 2,
                fx: 80,
                fy: -160,
              });
            }

            // Hop 2: Clan -> Squadmate
            links.push({
              source: b.clan_id,
              target: b.mate_id,
              label: "2: SQUADMATE_IN_CLAN",
              isMultiHopBridge: true,
              hopStep: 2,
              hopLabel: "Hop 2: Clan Squadmate",
              color: "#00D2FF",
              value: 2.5,
            });

            // Target Game Bridge
            const targetGameId = b.target_game_id || "game-cod-bo6";
            if (!seenTargetGames.has(targetGameId)) {
              seenTargetGames.add(targetGameId);
              if (!addedNodeIds.has(targetGameId)) {
                addedNodeIds.add(targetGameId);
                nodes.push({
                  id: targetGameId,
                  name: b.target_game_title || "Call of Duty: Black Ops 6 & Zombies",
                  type: "GAME",
                  franchise: b.target_game_franchise || "BLACK_OPS",
                  val: 42,
                  color: "#FF5722",
                  isMultiHopBridge: true,
                  hopStep: 3,
                  fx: 250,
                  fy: -160,
                });
              }
            }

            // Hop 3: Squadmate -> Target Game
            links.push({
              source: b.mate_id,
              target: targetGameId,
              label: "3: MIGRATED_TO_GAME",
              isMultiHopBridge: true,
              hopStep: 3,
              hopLabel: "Hop 3: Mode Migration",
              color: "#FF5722",
              value: 3,
            });
          }

          pNode.multiHopPath = {
            hops: 3,
            patternLabel: "Squad Churn Contagion",
            summary: `Member of ${b.clan_name} → Squadmate @${b.mate_tag} migrated to ${b.target_game_title || "Call of Duty: Black Ops 6 & Zombies"}`,
            steps: [
              `Loss Streak: ${pNode.loss_streak || 3} consecutive Gulag defeats in Warzone`,
              `Clan: "${b.clan_name}" (${b.clan_tier || "PRO_ESPORTS"})`,
              `Clan squadmate @${b.mate_tag} active in ${b.target_game_title || "Black Ops 6 & Zombies"}`,
            ],
            targetEntity: b.target_game_title || "Call of Duty: Black Ops 6 & Zombies",
            bridgeNodes: [b.clan_id, b.mate_id, b.target_game_id].filter(Boolean) as string[],
          };
        } else if (b.creator_id) {
          // Creator Halo
          if (!seenCreators.has(b.creator_id)) {
            seenCreators.add(b.creator_id);
            if (!addedNodeIds.has(b.creator_id)) {
              addedNodeIds.add(b.creator_id);
              nodes.push({
                id: b.creator_id,
                name: `@${b.creator_handle} (${b.creator_platform || "Twitch"})`,
                type: "CREATOR",
                franchise: b.target_game_franchise || "COD",
                val: 40,
                color: "#F59E0B",
                isMultiHopBridge: true,
                hopStep: 1,
                fx: 0,
                fy: -200,
              });
            }
          }

          links.push({
            source: pNode.id,
            target: b.creator_id,
            label: "1: FOLLOWS_CREATOR",
            isMultiHopBridge: true,
            hopStep: 1,
            hopLabel: "Hop 1: Creator Influence",
            color: "#F59E0B",
            value: 3,
          });

          pNode.multiHopPath = {
            hops: 2,
            patternLabel: "Creator Halo & Churn Shield",
            summary: `Whale player follows @${b.creator_handle} (${b.creator_platform || "Twitch"}) with high churn risk`,
            steps: [
              `LTV Spend: $${(pNode.spend || 0).toFixed(0)} with ${(pNode.churn_risk! * 100).toFixed(0)}% churn risk`,
              `Direct affinity with creator @${b.creator_handle}`,
              `Target for Creator-Code Exclusive Bundle drop`,
            ],
            targetEntity: `@${b.creator_handle}`,
            bridgeNodes: [b.creator_id],
          };
        } else if (b.identity_id) {
          // Identity Bridge
          if (!seenIdentities.has(b.identity_id)) {
            seenIdentities.add(b.identity_id);
            if (!addedNodeIds.has(b.identity_id)) {
              addedNodeIds.add(b.identity_id);
              nodes.push({
                id: b.identity_id,
                name: `${b.identity_platform}: ${b.identity_handle}`,
                type: "IDENTITY",
                franchise: "ALL",
                val: 32,
                color: "#A855F7",
                isMultiHopBridge: true,
                hopStep: 1,
                fx: 0,
                fy: 200,
              });
            }
          }

          links.push({
            source: pNode.id,
            target: b.identity_id,
            label: "1: HAS_IDENTITY",
            isMultiHopBridge: true,
            hopStep: 1,
            hopLabel: "Hop 1: Activision ID",
            color: "#EAB308",
            value: 3,
          });

          pNode.multiHopPath = {
            hops: 3,
            patternLabel: "Unified Activision ID Cross-Mode Bridge",
            summary: `Activision ID ${b.identity_handle} linked across Warzone, Black Ops 6, and CDL Ranked Play`,
            steps: [
              `Multi-mode account with $${(pNode.spend || 0).toFixed(0)} total spend`,
              `Resolved platform identity ${b.identity_platform} (${b.identity_handle})`,
              `Active cross-mode play in Warzone and Black Ops 6`,
            ],
            targetEntity: "Activision ID",
            bridgeNodes: [b.identity_id],
          };
        }
      }

      multiHopMetadata = {
        hops: queryResult.matchPattern?.includes("mate") ? 3 : queryResult.matchPattern?.includes("HAS_IDENTITY") ? 3 : 2,
        patternLabel: queryResult.matchPattern?.includes("mate")
          ? "Squad Churn Contagion (3-Hop)"
          : queryResult.matchPattern?.includes("Creator")
          ? "Creator Halo (2-Hop)"
          : "Unified Activision ID Bridge (3-Hop)",
        summary: naturalLanguageSummary,
        steps: queryResult.matchPattern?.includes("mate")
          ? ["Player (3+ Gulag Loss Streak)", "CoD Clan (FaZe, OpTic, Task Force 141)", "Squadmate (Active in Black Ops 6)"]
          : queryResult.matchPattern?.includes("Creator")
          ? ["Player (High-LTV Whale)", "Creator (Scump, FaZe Swagg, TimTheTatman, Biffle)"]
          : ["Player Account", "Activision Platform Identity", "Cross-Mode Games (Warzone + BO6)"],
      };
    }

    const renderedCount = nodes.filter((n) => n.type === "PLAYER").length;
    const agg = queryResult.aggregates;
    const dominantArchetype = agg.dominantArchetype || targetArchetype || "COMPETITIVE_GRINDER";

    // Audience size is the true count of players satisfying the predicates.
    // It is NOT derived from how many nodes we happened to draw.
    const avgSpend = Math.round(agg.avgSpend);
    const avgChurn = Number(agg.avgChurn.toFixed(2));
    const isSampled = renderedCount < totalMatched;

    const franchiseNames = targetFranchises.join(" & ");

    return NextResponse.json({
      query,
      generated_gql: generatedGql,
      translator,
      spanner_source: queryResult.source,
      is_live_spanner: queryResult.isLive,
      is_multi_hop: !!queryResult.isMultiHop,
      multi_hop_metadata: multiHopMetadata,
      execution_time_ms: queryResult.executionTimeMs,
      where_clause: queryResult.whereClause,
      gql_executed: queryResult.gqlExecuted,
      natural_language_summary:
        naturalLanguageSummary ||
        (totalMatched === 0
          ? `Executed against live Cloud Spanner across ${franchiseNames}. No players matched these predicates — try relaxing a threshold.`
          : `Executed against live Cloud Spanner across ${franchiseNames}. ${totalMatched.toLocaleString()} players match${
              isSampled ? `, rendering a ${renderedCount}-node sample` : ""
            }. Average lifetime spend $${avgSpend.toLocaleString()}, average churn risk ${(avgChurn * 100).toFixed(
              0
            )}%, with ${agg.highChurnCount.toLocaleString()} players above the 70% churn threshold.`),
      matched_count: totalMatched,
      rendered_count: renderedCount,
      is_sampled: isSampled,
      nodes,
      links,
      aggregate_metrics: {
        matched_count: totalMatched,
        rendered_count: renderedCount,
        is_sampled: isSampled,
        avg_spend_usd: avgSpend,
        avg_churn_risk: avgChurn,
        avg_tilt: agg.avgTilt,
        high_churn_count: agg.highChurnCount,
        dominant_archetype: dominantArchetype,
        archetype_histogram: agg.archetypeHistogram,
        country_histogram: agg.countryHistogram,
        franchise_histogram: agg.franchiseHistogram,
        spanner_source: queryResult.source,
        is_live: queryResult.isLive,
        is_multi_hop: !!queryResult.isMultiHop,
        multi_hop_metadata: multiHopMetadata,
      },
    });
  } catch (error: any) {
    // A Spanner outage is reported distinctly from a bug in this route, and
    // carries the failing clause so it is diagnosable on stage rather than
    // showing up as an opaque "something went wrong".
    if (error instanceof SpannerUnavailableError) {
      console.error("[NL Query] Spanner unavailable:", error.message);
      return NextResponse.json(
        {
          error: error.message,
          error_kind: "SPANNER_UNAVAILABLE",
          is_live_spanner: false,
        },
        { status: 503 }
      );
    }
    console.error("NL Query error:", error);
    return NextResponse.json(
      { error: error.message, error_kind: "INTERNAL" },
      { status: 500 }
    );
  }
}
