import { NextRequest, NextResponse } from "next/server";
import { embedText, cosine } from "@/lib/gcp/genai-client";
import { runRawGql, toNumber } from "@/lib/gcp/spanner-client";
import { GRAPH_NAME } from "@/lib/gcp/catalog";
import { archetypeDescription, archetypeLabel } from "@/lib/archetypes";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * Lookalike Audience Expansion powered by `gemini-embedding-001` (3,072-d)
 * and live candidate rows from `TakeTwoPlayerGraph`.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json();
    const seedArchetype = String(body?.dominant_archetype || "CROSS_LABEL_NOMAD");
    const seedQuery = String(body?.query || "High-gravity Take-Two cross-label players");
    const baseCount = Math.max(1, Number(body?.matched_count || 250));
    const expansionPct = Math.min(50, Math.max(5, Number(body?.expansion_pct || 25)));

    // Fetch a candidate pool from Spanner
    const candidateRows = await runRawGql(`
      GRAPH ${GRAPH_NAME}
      MATCH (p:Player)
      RETURN p.player_id AS player_id,
             p.gamer_tag AS gamer_tag,
             p.primary_archetype AS primary_archetype,
             p.primary_franchise AS primary_franchise,
             p.lifetime_spend_usd AS lifetime_spend_usd,
             FLOAT64(p.game_telemetry.gravity_score) AS gravity_score
      ORDER BY p.lifetime_spend_usd DESC
      LIMIT 60
    `);

    const seedProfileText = `${archetypeLabel(seedArchetype)}: ${archetypeDescription(
      seedArchetype
    )}. Target cohort: ${seedQuery}`;

    // Embed seed profile + candidate archetype summaries via gemini-embedding-001
    const uniqueArchetypes = Array.from(
      new Set(candidateRows.map((r) => String(r.primary_archetype)))
    );
    const textsToEmbed = [
      seedProfileText,
      ...uniqueArchetypes.map(
        (arch) => `${archetypeLabel(arch)}: ${archetypeDescription(arch)}`
      ),
    ];

    const vectors = await embedText(textsToEmbed);
    const seedVec = vectors[0];
    const simByArchetype = new Map<string, number>();
    uniqueArchetypes.forEach((arch, idx) => {
      simByArchetype.set(arch, cosine(seedVec, vectors[idx + 1]));
    });

    const scoredCandidates = candidateRows
      .map((r) => {
        const archSim = simByArchetype.get(String(r.primary_archetype)) ?? 0.82;
        const grav = toNumber(r.gravity_score);
        const similarity = Number((archSim * 0.75 + grav * 0.25).toFixed(3));
        return {
          player_id: String(r.player_id),
          gamer_tag: String(r.gamer_tag),
          archetype: String(r.primary_archetype),
          franchise: String(r.primary_franchise),
          spend_usd: toNumber(r.lifetime_spend_usd),
          similarity,
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const addedCount = Math.round((baseCount * expansionPct) / 100);

    return NextResponse.json({
      ok: true,
      model_used: MODELS.EMBED.id,
      dimensions: seedVec.length,
      base_count: baseCount,
      expansion_pct: expansionPct,
      added_count: addedCount,
      expanded_total: baseCount + addedCount,
      avg_cosine_similarity: Number(
        (
          scoredCandidates.slice(0, 12).reduce((s, c) => s + c.similarity, 0) /
          Math.max(1, Math.min(12, scoredCandidates.length))
        ).toFixed(3)
      ),
      sample_players: scoredCandidates.slice(0, 8),
      latency_ms: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
