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
    const query = body.query || "Show cross-title whales with spend over $3,500 across Call of Duty and World of Warcraft";
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
    let translator: "gemini" | "deterministic" | "caller_supplied" = "gemini";

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

    // If generic creator / streamer mention without specific name, include top ABK creators
    if (matchedCreatorIds.length === 0 && (lowerQ.includes("creator") || lowerQ.includes("streamer") || lowerQ.includes("influencer") || lowerQ.includes("youtube") || lowerQ.includes("twitch"))) {
      matchedCreatorIds = ["creator-scump", "creator-timthetatman", "creator-asmongold", "creator-wudijo"];
    }

    // Detect franchises in the query. `franchiseExplicit` records whether the
    // user (or the franchise selector) actually scoped the request — an
    // unscoped query must span all five franchises, not a default pair.
    let franchiseExplicit = true;
    if (lowerQ.includes("cod") && (lowerQ.includes("wow") || lowerQ.includes("diablo"))) {
      targetFranchises = lowerQ.includes("wow") ? ["COD", "WOW"] : ["COD", "DIABLO4"];
    } else if (lowerQ.includes("cod") || lowerQ.includes("warzone") || lowerQ.includes("ops")) {
      targetFranchises = ["COD"];
    } else if (lowerQ.includes("wow") || lowerQ.includes("warcraft")) {
      targetFranchises = ["WOW"];
    } else if (lowerQ.includes("diablo") || lowerQ.includes("sanctuary")) {
      targetFranchises = ["DIABLO4"];
    } else if (lowerQ.includes("overwatch") || lowerQ.includes("ow2")) {
      targetFranchises = ["OVERWATCH2"];
    } else if (lowerQ.includes("candy") || lowerQ.includes("crush")) {
      targetFranchises = ["CANDYCRUSH"];
    } else if (selectedGame !== "ALL") {
      targetFranchises = [selectedGame];
    } else {
      targetFranchises = ["COD", "WOW", "DIABLO4", "OVERWATCH2", "CANDYCRUSH"];
      franchiseExplicit = false;
    }

    // 1. Live Vertex AI Gemini NL-to-GQL Translation
    // Skipped entirely when the caller supplied an exact query.
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
  "target_franchises": ["COD", "DIABLO4"]
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

    // The franchise selector is authoritative. The model intermittently drops
    // the scope even when the prompt demands it, which silently widens the
    // cohort beyond the title the marketer is actually looking at.
    if (!explicitGql && generatedGql && selectedGame !== "ALL") {
      // Inspect ONLY the WHERE clause: the RETURN list always mentions
      // `franchises_played`, so testing the whole query never matches.
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

    // Normalise franchise scoping semantics. A marketer asking for "WoW players"
    // means everyone who plays WoW, not only those whose *primary* title it is —
    // otherwise cross-title Battle.net players are silently excluded from the
    // very cohorts the cross-title story depends on.
    if (!explicitGql && generatedGql) {
      generatedGql = generatedGql.replace(
        /\bp\.primary_franchise\s*=\s*'([A-Z0-9_]+)'/gi,
        (match, franchise) => {
          const scoped = `'${franchise}' IN p.franchises_played`;
          // Skip if this equality is already paired with a membership test.
          return generatedGql.includes(scoped)
            ? match
            : `(p.primary_franchise = '${franchise}' OR ${scoped})`;
        }
      );
    }

    // 2. Deterministic Semantic Fallback — for TRANSLATION ONLY.
    //
    // This substitutes for Gemini when the model is unreachable or returns
    // something unusable. It does NOT substitute for Spanner: whatever it
    // builds is still executed against the live graph, so the numbers remain
    // real. The `translator` flag below is returned to the client so a fallback
    // is never mistaken for a model-authored query.
    //
    // Predicates are composed ADDITIVELY so that "at-risk whales in Germany"
    // yields churn AND spend AND geography, rather than whichever branch
    // happened to be checked first.
    //
    // An explicitly supplied GQL is never overridden — the whole point of the
    // escape hatch is verbatim execution. Previously the prefix check below
    // silently replaced it with the fallback whenever the caller omitted the
    // "GRAPH ABKPlayerGraph" header.
    if (!explicitGql && (!generatedGql || !generatedGql.includes("GRAPH ABKPlayerGraph"))) {
      translator = "deterministic";
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

    // 3. Execute the query against live Spanner.
    //
    // There is no local fallback. A previous version quietly evaluated the
    // predicates against a JSON file whenever Spanner was unreachable, so the
    // UI could present confident cohort sizes that had never touched the
    // database. A visible failure is worth far more than an invisible fiction.
    //
    // The engine returns the LIMIT page in `rows` and the true population size
    // in `totalMatched`. These are deliberately distinct: `rows` drives what we
    // render, `totalMatched` is what a marketer reads as reachable audience.
    const queryResult = await runSpannerGraphQuery(generatedGql, RENDER_LIMIT);
    const rows = queryResult.rows;
    const totalMatched = queryResult.totalMatched;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // 4. Add Relevant Game Hubs with Proper Spatial Anchors
    const hubColors: Record<string, string> = {
      COD: "#F59E0B",
      WOW: "#00F0FF",
      DIABLO4: "#FF334B",
      OVERWATCH2: "#38BDF8",
      CANDYCRUSH: "#EC4899",
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
        const matchedGames = allGames.filter((g: any) => g.franchise === activeFranchise && !g.is_parent_hub);
        const subGames = matchedGames.length > 0 ? matchedGames : allGames.filter((g: any) => g.franchise === activeFranchise);

        subGames.forEach((g: any, idx: number) => {
          const angle = (idx / subGames.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 240;
          nodes.push({
            id: g.game_id,
            name: g.title,
            type: "GAME",
            franchise: activeFranchise,
            val: 34,
            color: hubColors[activeFranchise] || "#00F0FF",
            fx: Math.round(Math.cos(angle) * radius),
            fy: Math.round(Math.sin(angle) * radius),
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
      const centerOffsetX = pFranchise === "DIABLO4" ? 180 : pFranchise === "COD" ? 0 : -180;

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
      const primHub = nodes.find((n) => n.type === "GAME" && n.franchise === pFranchise);
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
      execution_time_ms: queryResult.executionTimeMs,
      where_clause: queryResult.whereClause,
      gql_executed: queryResult.gqlExecuted,
      natural_language_summary:
        totalMatched === 0
          ? `Executed against live Cloud Spanner across ${franchiseNames}. No players matched these predicates — try relaxing a threshold.`
          : `Executed against live Cloud Spanner across ${franchiseNames}. ${totalMatched.toLocaleString()} players match${
              isSampled ? `, rendering a ${renderedCount}-node sample` : ""
            }. Average lifetime spend $${avgSpend.toLocaleString()}, average churn risk ${(avgChurn * 100).toFixed(
              0
            )}%, with ${agg.highChurnCount.toLocaleString()} players above the 70% churn threshold.`,
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
