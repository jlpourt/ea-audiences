import { NextRequest, NextResponse } from "next/server";
import { runRawGql, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { GRAPH_NAME, getGames, getClans, type GameRow } from "@/lib/gcp/catalog";
import { archetypeColor, archetypeLabel } from "@/lib/archetypes";
import {
  buildFranchiseIndex,
  studioForLabel,
  STUDIOS,
  STUDIO_COLORS,
  franchiseName,
  type Studio,
} from "@/lib/studios";
import type { GraphLink, GraphNode, GameLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Graph Twins (lookalike expansion), computed live over every player in
 * Spanner `TakeTwoPlayerGraph`.
 *
 * Each player becomes a studio-aware feature vector built only from stored
 * data:
 *   - titles played (PLAYS_GAME presence) and per-title spend (PLAYS_GAME.spend_usd)
 *   - primary studio and primary archetype
 *   - crew membership / role (MEMBER_OF_CLAN, active rows)
 *   - friend count (FRIENDS_WITH, both directions)
 *   - lifetime spend and churn risk (Players)
 * The seed centroid is the mean of the seed players' vectors; similarity is
 * cosine similarity to that centroid, ranked over every non-seed player.
 * Expansion: with `matched_count` + `expansion_pct` the twins are the
 * round(matched_count * pct / 100) most similar players (the usual lookalike
 * "+25%" expansion); otherwise every player with similarity >=
 * `min_similarity`. The similarity range of the selected twins is returned so
 * the cut is visible. Counts and aggregates are exact over the selected twins;
 * nothing is imputed, and values that cannot be computed are omitted.
 */

const DEFAULT_MIN_SIMILARITY = 0.9;
const MAX_RENDERED_TWINS = 60;
const MAX_SEEDS = 500;

interface PlayerFeatures {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  primary_franchise: string;
  studio: Studio;
  label: GameLabel;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  titles: Map<string, number>; // franchise -> spend
  crew_id: string | null;
  crew_role: string | null;
  friends: number;
}

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && typeof v.value !== "undefined") return Number(v.value);
  return Number(v);
}

function norm(v: number[]): number {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

function cosine(a: number[], b: number[], nb: number): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  const na = norm(a);
  return na && nb ? dot / (na * nb) : 0;
}


// ---------------------------------------------------------------------------
// In-process feature store. Built live from Spanner on first use, then reused
// for 1h per database. Concurrent requests share one in-flight build. A failed
// build is never cached and an expired store is never served.
// ---------------------------------------------------------------------------
const FEATURE_TTL_MS = 60 * 60 * 1000;

async function buildFeatureStore() {
  // ------------------------------------------------------------------
  // 1. Load every player's features from Spanner (exact, no sampling).
  // ------------------------------------------------------------------
  const [games, clans, playerRows, playRows, crewRows, friendRows] = await Promise.all([
    getGames(),
    getClans(),
    runRawGql(
      `SELECT player_id, gamer_tag, primary_archetype, primary_franchise,
              lifetime_spend_usd, churn_risk_score
       FROM Players`
    ),
    runRawGql(`SELECT player_id, game_id, spend_usd FROM PlaysGame`),
    runRawGql(
      `SELECT player_id, clan_id, role FROM MemberOfClan WHERE left_at IS NULL`
    ),
    runRawGql(
      `SELECT pid, COUNT(*) AS n FROM (
         SELECT player_id AS pid FROM FriendsWith
         UNION ALL
         SELECT other_player_id AS pid FROM FriendsWith)
       GROUP BY pid`
    ),
  ]);

  const idx = buildFranchiseIndex(games);
  const gameById = new Map<string, GameRow>(games.map((g) => [g.game_id, g]));
  const clanById = new Map(clans.map((c) => [c.clan_id, c]));
  const franchises = Array.from(new Set(games.map((g) => g.franchise))).sort();
  const fIndex = new Map(franchises.map((f, i) => [f, i]));

  const players = new Map<string, PlayerFeatures>();
  const archetypes = new Set<string>();
  for (const r of playerRows) {
    const label = idx.labelOf(r.primary_franchise) as GameLabel;
    archetypes.add(r.primary_archetype);
    players.set(r.player_id, {
      player_id: r.player_id,
      gamer_tag: r.gamer_tag,
      archetype: r.primary_archetype,
      primary_franchise: r.primary_franchise,
      studio: studioForLabel(label),
      label,
      lifetime_spend_usd: num(r.lifetime_spend_usd),
      churn_risk_score: num(r.churn_risk_score),
      titles: new Map(),
      crew_id: null,
      crew_role: null,
      friends: 0,
    });
  }
  for (const r of playRows) {
    const p = players.get(r.player_id);
    const g = gameById.get(r.game_id);
    if (!p || !g) continue;
    p.titles.set(g.franchise, (p.titles.get(g.franchise) || 0) + num(r.spend_usd));
  }
  for (const r of crewRows) {
    const p = players.get(r.player_id);
    if (p) {
      p.crew_id = r.clan_id;
      p.crew_role = r.role ?? null;
    }
  }
  for (const r of friendRows) {
    const p = players.get(r.pid);
    if (p) p.friends = num(r.n);
  }

  // ------------------------------------------------------------------
  // 2. Feature vectors. Blocks are scaled so no single block dominates.
  // ------------------------------------------------------------------
  const archList = Array.from(archetypes).sort();
  const aIndex = new Map(archList.map((a, i) => [a, i]));
  const maxLogSpend = Math.log1p(
    Math.max(1, ...Array.from(players.values()).map((p) => p.lifetime_spend_usd))
  );
  const maxLogFriends = Math.log1p(
    Math.max(1, ...Array.from(players.values()).map((p) => p.friends))
  );
  const W = { title: 1.0, titleSpend: 0.6, studio: 1.0, arch: 1.0, crew: 0.5, scalar: 0.5 };
  const F = franchises.length;
  const dim = F * 2 + STUDIOS.length + archList.length + 2 + 3;

  const vec = (p: PlayerFeatures): number[] => {
    const v = new Array(dim).fill(0);
    let maxTitle = 0;
    for (const s of Array.from(p.titles.values())) maxTitle = Math.max(maxTitle, s);
    for (const [f, spend] of Array.from(p.titles.entries())) {
      const i = fIndex.get(f);
      if (i === undefined) continue;
      v[i] = W.title;
      v[F + i] = maxTitle > 0 ? (W.titleSpend * Math.log1p(spend)) / Math.log1p(maxTitle) : 0;
    }
    v[F * 2 + STUDIOS.indexOf(p.studio)] = W.studio;
    const ai = aIndex.get(p.archetype);
    if (ai !== undefined) v[F * 2 + STUDIOS.length + ai] = W.arch;
    const o = F * 2 + STUDIOS.length + archList.length;
    v[o] = p.crew_id ? W.crew : 0;
    v[o + 1] = p.crew_role === "CAPTAIN" || p.crew_role === "CO_CAPTAIN" ? W.crew : 0;
    v[o + 2] = (W.scalar * Math.log1p(p.lifetime_spend_usd)) / maxLogSpend;
    v[o + 3] = W.scalar * p.churn_risk_score;
    v[o + 4] = (W.scalar * Math.log1p(p.friends)) / maxLogFriends;
    return v;
  };

  const vecs = new Map<string, number[]>();
  const norms = new Map<string, number>();
  for (const p of Array.from(players.values())) {
    const v = vec(p);
    vecs.set(p.player_id, v);
    norms.set(p.player_id, norm(v));
  }
  return {
    games,
    clans,
    idx,
    gameById,
    clanById,
    players,
    vecs,
    norms,
    dim,
    computedAt: new Date().toISOString(),
    builtAtMs: Date.now(),
  };
}

type FeatureStore = Awaited<ReturnType<typeof buildFeatureStore>>;
const featureCache = new Map<string, { store?: FeatureStore; inflight?: Promise<FeatureStore> }>();

async function getFeatureStore(): Promise<{ store: FeatureStore; cacheHit: boolean }> {
  const key = process.env.SPANNER_DATABASE_ID || "default";
  const entry = featureCache.get(key) || {};
  if (entry.store && Date.now() - entry.store.builtAtMs < FEATURE_TTL_MS) {
    return { store: entry.store, cacheHit: true };
  }
  if (!entry.inflight) {
    // Expired or missing: drop the old store so it can never be served.
    const inflight = buildFeatureStore();
    featureCache.set(key, { inflight });
    inflight.then(
      (store) => featureCache.set(key, { store }),
      () => featureCache.delete(key)
    );
    return { store: await inflight, cacheHit: false };
  }
  return { store: await entry.inflight, cacheHit: false };
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const body = await request.json();
    const seedIds: string[] = Array.from(
      new Set<string>(
        (Array.isArray(body?.seed_player_ids) ? body.seed_player_ids : [])
          .map(String)
          .filter(Boolean)
      )
    ).slice(0, MAX_SEEDS);
    if (seedIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Graph Twins needs seed_player_ids: pick a player or load a cohort first. No seed was sent, so nothing was computed.",
        },
        { status: 400 }
      );
    }
    const minSimilarity = Math.min(
      0.995,
      Math.max(0.5, Number(body?.min_similarity) || DEFAULT_MIN_SIMILARITY)
    );
    const baseCount =
      typeof body?.matched_count === "number" && body.matched_count > 0
        ? Math.round(body.matched_count)
        : null;
    const expansionPct =
      typeof body?.expansion_pct === "number" && body.expansion_pct > 0
        ? Math.min(100, body.expansion_pct)
        : null;
    const targetCount =
      baseCount !== null && expansionPct !== null
        ? Math.max(1, Math.round((baseCount * expansionPct) / 100))
        : null;

    // ------------------------------------------------------------------
    // 1–2. Per-player feature vectors (live Spanner build, cached 1h).
    // ------------------------------------------------------------------
    const { store, cacheHit } = await getFeatureStore();
    const { idx, clanById, players, dim } = store;
    const vec = (p: PlayerFeatures): number[] => store.vecs.get(p.player_id)!;

    const seeds = seedIds.map((id) => players.get(id)).filter(Boolean) as PlayerFeatures[];
    if (seeds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Spanner Players: none of the ${seedIds.length} seed ids exist in ${GRAPH_NAME}.`,
        },
        { status: 404 }
      );
    }

    const centroid = new Array(dim).fill(0);
    for (const s of seeds) {
      const v = vec(s);
      for (let i = 0; i < dim; i++) centroid[i] += v[i] / seeds.length;
    }
    const nc = norm(centroid);
    const seedSet = new Set(seeds.map((s) => s.player_id));

    const scored: Array<{ p: PlayerFeatures; sim: number }> = [];
    for (const p of Array.from(players.values())) {
      if (seedSet.has(p.player_id)) continue;
      const v = store.vecs.get(p.player_id)!;
      let dot = 0;
      for (let i = 0; i < dim; i++) dot += v[i] * centroid[i];
      const nv = store.norms.get(p.player_id)!;
      scored.push({ p, sim: nv && nc ? dot / (nv * nc) : 0 });
    }
    scored.sort((a, b) => b.sim - a.sim || (a.p.player_id < b.p.player_id ? -1 : 1));
    const twins =
      targetCount !== null
        ? scored.slice(0, targetCount)
        : scored.filter((s) => s.sim >= minSimilarity);
    const rendered = twins.slice(0, MAX_RENDERED_TWINS);

    // ------------------------------------------------------------------
    // 3. Real graph ties between rendered twins and seeds.
    // ------------------------------------------------------------------
    const renderedIds = rendered.map((t) => t.p.player_id);
    const seedSample = seeds.slice(0, 8);
    const tieRows = renderedIds.length
      ? await runRawGql(
          `SELECT player_id AS a, other_player_id AS b, 'FRIENDS_WITH' AS kind FROM FriendsWith
             WHERE (player_id IN UNNEST(@t) AND other_player_id IN UNNEST(@s))
                OR (player_id IN UNNEST(@s) AND other_player_id IN UNNEST(@t))
           UNION ALL
           SELECT player_id AS a, invitee_id AS b, 'INVITED' AS kind FROM Invited
             WHERE (player_id IN UNNEST(@t) AND invitee_id IN UNNEST(@s))
                OR (player_id IN UNNEST(@s) AND invitee_id IN UNNEST(@t))`,
          { t: renderedIds, s: seeds.map((s) => s.player_id) }
        )
      : [];
    const tiedTwins = new Set<string>();
    for (const r of tieRows) {
      if (seedSet.has(r.a)) tiedTwins.add(r.b);
      else tiedTwins.add(r.a);
    }

    // ------------------------------------------------------------------
    // 4. Aggregates (exact over all twins >= threshold).
    // ------------------------------------------------------------------
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const twinStudioMix = STUDIOS.map((s) => ({
      studio: s,
      players: twins.filter((t) => t.p.studio === s).length,
    })).filter((m) => m.players > 0);
    const seedStudioMix = STUDIOS.map((s) => ({
      studio: s,
      players: seeds.filter((p) => p.studio === s).length,
    })).filter((m) => m.players > 0);
    const archGroup = new Map<string, number[]>();
    for (const t of twins) {
      const arr = archGroup.get(t.p.archetype) || [];
      arr.push(t.sim);
      archGroup.set(t.p.archetype, arr);
    }

    const sharedTitles = (p: PlayerFeatures) => {
      const seedTitles = new Set<string>();
      for (const s of seedSample) for (const f of Array.from(s.titles.keys())) seedTitles.add(f);
      return Array.from(p.titles.keys()).filter((f) => seedTitles.has(f));
    };

    const topTwins = rendered.map(({ p, sim }) => {
      const crew = p.crew_id ? clanById.get(p.crew_id) : undefined;
      return {
        player_id: p.player_id,
        gamer_tag: p.gamer_tag,
        archetype: p.archetype,
        franchise: p.primary_franchise,
        studio: p.studio,
        cosine_similarity: Number(sim.toFixed(4)),
        lifetime_spend_usd: p.lifetime_spend_usd,
        churn_risk_score: p.churn_risk_score,
        crew_name: crew?.name,
        crew_role: p.crew_role ?? undefined,
        shared_titles: sharedTitles(p).map((f) => franchiseName(f)),
        tied_to_seed: tiedTwins.has(p.player_id),
      };
    });

    // ------------------------------------------------------------------
    // 5. Graph: seeds, twins, their primary title hubs and real crews.
    // ------------------------------------------------------------------
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const seen = new Set<string>();
    const add = (n: GraphNode) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      nodes.push(n);
    };
    const playerNode = (p: PlayerFeatures, extra: Partial<GraphNode>): GraphNode => ({
      id: p.player_id,
      name: p.gamer_tag,
      type: "PLAYER",
      franchise: p.primary_franchise,
      label: p.label,
      studio: p.studio,
      archetype: p.archetype,
      spend: p.lifetime_spend_usd,
      churn_risk: p.churn_risk_score,
      franchises_played: Array.from(p.titles.keys()),
      title_spend: Object.fromEntries(p.titles.entries()),
      clan_id: p.crew_id ?? undefined,
      crew_role: p.crew_role ?? undefined,
      val: 8,
      color: archetypeColor(p.archetype),
      ...extra,
    });
    const hubFor = (p: PlayerFeatures) => {
      const hub = idx.hubByFranchise.get(p.primary_franchise);
      if (!hub) return null;
      add({
        id: hub.game_id,
        name: hub.title,
        type: "GAME",
        franchise: hub.franchise,
        label: hub.label,
        studio: studioForLabel(hub.label),
        lifecycle_status: hub.lifecycle_status ?? undefined,
        val: 30,
        color: STUDIO_COLORS[studioForLabel(hub.label)],
      });
      return hub.game_id;
    };

    for (const s of seedSample) {
      add(playerNode(s, { name: `${s.gamer_tag} (seed)`, val: 14, color: "#FFFFFF", game_telemetry: { twin_seed: true } }));
      const h = hubFor(s);
      if (h) links.push({ source: s.player_id, target: h, label: "PLAYS_GAME", value: 2 });
    }
    const seedVecs = seedSample.map((s) => ({ id: s.player_id, v: vec(s) }));
    for (const { p, sim } of rendered) {
      add(
        playerNode(p, {
          name: `${p.gamer_tag} (${(sim * 100).toFixed(1)}%)`,
          game_telemetry: { twin_similarity: Number(sim.toFixed(4)) },
        })
      );
      const h = hubFor(p);
      if (h) links.push({ source: p.player_id, target: h, label: "PLAYS_GAME", value: 2 });
      if (p.crew_id && clanById.has(p.crew_id)) {
        const c = clanById.get(p.crew_id)!;
        add({
          id: c.clan_id,
          name: `${c.name} · ${c.tier || "Crew"}`,
          type: "CLAN",
          franchise: c.franchise,
          studio: idx.studioOf(c.franchise),
          rank_tier: c.tier || undefined,
          val: 16,
          color: STUDIO_COLORS[idx.studioOf(c.franchise)],
        });
        links.push({ source: p.player_id, target: c.clan_id, label: `MEMBER_OF_CLAN (${p.crew_role || "MEMBER"})`, value: 1.4 });
      }
      // Computed relation: nearest seed by cosine similarity (clearly labelled as such).
      const pv = vec(p);
      let best = seedVecs[0];
      let bestSim = -1;
      for (const sv of seedVecs) {
        const sSim = cosine(pv, sv.v, norm(sv.v));
        if (sSim > bestSim) {
          bestSim = sSim;
          best = sv;
        }
      }
      if (best) {
        links.push({
          source: best.id,
          target: p.player_id,
          label: `TWIN_OF (cosine ${bestSim.toFixed(3)})`,
          value: 1.6,
          isMultiHopBridge: true,
          hopStep: 1,
        });
      }
    }
    for (const r of tieRows) {
      if (seen.has(r.a) && seen.has(r.b)) {
        links.push({ source: r.a, target: r.b, label: r.kind, value: 1.4 });
      }
    }

    return NextResponse.json({
      ok: true,
      method:
        "Cosine similarity to the seed centroid over studio-aware features from Spanner: titles played + PLAYS_GAME.spend_usd, studio, archetype, crew membership/role, FRIENDS_WITH degree, lifetime spend, churn risk.",
      graph: GRAPH_NAME,
      feature_dimensions: dim,
      computed_at: store.computedAt,
      feature_cache: cacheHit ? "hit" : "built",
      seed_count: seeds.length,
      seed_ids_not_found: seedIds.length - seeds.length,
      seed_studio_mix: seedStudioMix,
      players_scored: scored.length,
      selection:
        targetCount !== null
          ? `top ${targetCount.toLocaleString()} most similar (${expansionPct}% of ${baseCount!.toLocaleString()})`
          : `similarity >= ${minSimilarity}`,
      min_similarity: targetCount !== null ? null : minSimilarity,
      expansion_pct: expansionPct,
      similarity_range: twins.length
        ? { min: Number(twins[twins.length - 1].sim.toFixed(4)), max: Number(twins[0].sim.toFixed(4)) }
        : null,
      added_count: twins.length,
      rendered_count: rendered.length,
      base_count: baseCount,
      expanded_total: baseCount !== null ? baseCount + twins.length : null,
      avg_cosine_similarity: twins.length ? Number(avg(twins.map((t) => t.sim))!.toFixed(4)) : null,
      twins_avg_spend_usd: twins.length ? Number(avg(twins.map((t) => t.p.lifetime_spend_usd))!.toFixed(2)) : null,
      twins_total_spend_usd: twins.length ? Number(twins.reduce((s, t) => s + t.p.lifetime_spend_usd, 0).toFixed(2)) : null,
      twins_avg_churn: twins.length ? Number(avg(twins.map((t) => t.p.churn_risk_score))!.toFixed(4)) : null,
      twins_high_churn_count: twins.filter((t) => t.p.churn_risk_score >= 0.7).length,
      twins_dominant_archetype:
        Array.from(archGroup.entries()).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null,
      twins_tied_to_seed_in_render: tiedTwins.size,
      twin_studio_mix: twinStudioMix,
      lookalike_archetypes: Array.from(archGroup.entries())
        .map(([a, sims]) => ({
          archetype: a,
          label: archetypeLabel(a),
          matched_twins: sims.length,
          cosine_similarity: Number(avg(sims)!.toFixed(4)),
        }))
        .sort((x, y) => y.matched_twins - x.matched_twins),
      top_twins: topTwins,
      nearest_below_threshold:
        twins.length === 0
          ? scored.slice(0, 5).map(({ p, sim }) => ({
              player_id: p.player_id,
              gamer_tag: p.gamer_tag,
              cosine_similarity: Number(sim.toFixed(4)),
            }))
          : undefined,
      graph_data: { nodes, links },
      latency_ms: Date.now() - started,
    });
  } catch (e: any) {
    console.error("[/api/audiences/lookalike] failed:", e);
    const isSpanner = e instanceof SpannerUnavailableError;
    return NextResponse.json(
      {
        ok: false,
        error: isSpanner
          ? `Cloud Spanner ${process.env.SPANNER_INSTANCE_ID || ""}/${process.env.SPANNER_DATABASE_ID || ""}: ${e.message}`
          : e?.message || String(e),
        error_kind: isSpanner ? "SPANNER_UNAVAILABLE" : "INTERNAL",
      },
      { status: isSpanner ? 503 : 500 }
    );
  }
}
