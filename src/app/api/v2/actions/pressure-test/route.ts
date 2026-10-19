/**
 * POST /api/v2/actions/pressure-test  { play, segment, variants: PlanVariant[], n?: 8-24 }   (SSE)
 *
 * Synthetic panel: samples N real players from the live audience, hydrates
 * each from Spanner (titles, spend, churn risk, crew, friends, telemetry) and
 * has Gemini react in that player's voice to all three variants (0-100 score
 * each, preferred variant or NONE, one-line quote). Then aggregates share of
 * preference and mean score with a 95% CI and picks the winner.
 *
 * Events: cohort, verdict, aggregate, done, error. Spanner failures return 503
 * before the stream opens; Vertex AI failures emit an `error` event and close.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { getAudience, hydratePersonas, PlayQueryError } from "@/lib/v2/plays-server";
import { FRANCHISE_TITLE, PLAYS, type PersonaVerdict, type PlanVariant, type PlayId, type PressureEvent, type VariantAggregate } from "@/lib/v2/plays";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const IDS = ["A", "B", "C"] as const;
const CONCURRENCY = 6;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    scores: {
      type: "OBJECT",
      properties: { A: { type: "INTEGER" }, B: { type: "INTEGER" }, C: { type: "INTEGER" } },
      required: ["A", "B", "C"],
    },
    preferred: { type: "STRING", enum: ["A", "B", "C", "NONE"] },
    quote: { type: "STRING", description: "one sentence in the player's own voice, max 25 words, no emoji" },
  },
  required: ["scores", "preferred", "quote"],
};

function personaCard(p: Record<string, unknown>, context: string | null): string {
  const tel = JSON.parse(String(p.telemetry ?? "{}")) as Record<string, unknown>;
  const titles = ((p.franchises_played as string[]) ?? []).map((f) => FRANCHISE_TITLE[f] ?? f);
  const keep = Object.entries(tel)
    .filter(([, v]) => v !== null && v !== false && v !== 0 && typeof v !== "object")
    .slice(0, 14)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return [
    `Gamer tag: ${p.gamer_tag}. Age ${p.age ?? "unknown"}, ${p.country ?? "unknown country"}. Account tenure ${p.account_tenure_days ?? "?"} days.`,
    `Home title: ${FRANCHISE_TITLE[String(p.primary_franchise)] ?? p.primary_franchise}. Archetype: ${p.primary_archetype}.`,
    `Plays: ${titles.join(", ")}.`,
    `Lifetime spend $${Number(p.lifetime_spend_usd ?? 0).toFixed(0)}. Churn risk ${(Number(p.churn_risk_score ?? 0) * 100).toFixed(0)}%.`,
    `Minutes played last 7 days ${p.session_min_7d ?? "?"} vs the 7 days before ${p.session_min_prev_7d ?? "?"}.`,
    `Friends on Take-Two accounts: ${p.friends ?? 0}. Crew: ${p.crew ?? "none"}.`,
    keep ? `Telemetry: ${keep}.` : "",
    context ? `Relevant to this offer: ${context}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function aggregate(verdicts: PersonaVerdict[]): { variants: VariantAggregate[]; winner: "A" | "B" | "C"; none_share: number } {
  const n = verdicts.length;
  const variants = IDS.map((id) => {
    const xs = verdicts.map((v) => v.scores[id]);
    const mean = xs.reduce((s, x) => s + x, 0) / Math.max(1, n);
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
    return { id, share: verdicts.filter((v) => v.preferred === id).length / Math.max(1, n), mean_score: mean, ci95: n > 1 ? (1.96 * sd) / Math.sqrt(n) : 0, n };
  });
  const winner = [...variants].sort((a, b) => b.mean_score - a.mean_score || b.share - a.share)[0].id;
  return { variants, winner, none_share: verdicts.filter((v) => v.preferred === "NONE").length / Math.max(1, n) };
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const play = body?.play as PlayId;
  const segment = String(body?.segment ?? "");
  const variants = body?.variants as PlanVariant[] | undefined;
  const n = Math.max(8, Math.min(24, Number(body?.n) || 16));
  const def = PLAYS[play];
  if (!def || !def.segments.some((s) => s.id === segment)) return NextResponse.json({ error: "Unknown play or segment" }, { status: 400 });
  if (!Array.isArray(variants) || variants.length !== 3) return NextResponse.json({ error: "Exactly three variants are required" }, { status: 400 });

  // Phase 0: sample + hydrate personas from the live audience BEFORE streaming.
  let personas: Record<string, unknown>[];
  let contextById = new Map<string, string>();
  try {
    const { members, response } = await getAudience(play, segment);
    const label = response.stats.signal_label;
    if (label) {
      contextById = new Map(
        members
          .filter((m) => m.signal != null)
          .map((m) => [m.player_id, label.includes("drop") ? `${label}: ${Math.round((m.signal ?? 0) * 100)}%` : `${label}: ${m.signal}`]),
      );
    }
    if (members.length === 0) return NextResponse.json({ error: "The audience is empty; nothing to test." }, { status: 409 });
    const stride = Math.max(1, Math.floor(members.length / n));
    const ids = Array.from({ length: Math.min(n, members.length) }, (_, i) => members[(i * stride + 7) % members.length].player_id);
    personas = await hydratePersonas(Array.from(new Set(ids)));
  } catch (e) {
    return NextResponse.json(
      { error: "Spanner persona hydration failed", service: "spanner", message: (e as Error).message, gql: e instanceof PlayQueryError ? e.gql : null },
      { status: 503 },
    );
  }

  const offerText = variants
    .map((v) => `Variant ${v.id} · ${v.name}\nOffer: ${v.offer}\nMessage: "${v.message}"\nChannel: ${v.channel}\nReward when: ${v.reward_trigger}`)
    .join("\n\n");

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: PressureEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      send({
        type: "cohort",
        personas: personas.map((p) => ({
          player_id: String(p.player_id),
          gamer_tag: String(p.gamer_tag),
          home_title: FRANCHISE_TITLE[String(p.primary_franchise)] ?? String(p.primary_franchise),
          archetype: String(p.primary_archetype),
        })),
        latency_ms: Date.now() - t0,
      });
      const verdicts: PersonaVerdict[] = [];
      let model = "";
      let failed = false;
      let next = 0;
      const worker = async () => {
        while (!failed && next < personas.length) {
          const p = personas[next++];
          const s0 = Date.now();
          try {
            const gen = await generateText({
              role: "FAST",
              schema: SCHEMA,
              temperature: 0.8,
              maxOutputTokens: 1024,
              thinkingBudget: 0,
              system:
                "You are role-playing one real player from a Take-Two game's player graph. React honestly as THIS player, given their titles, habits, spend and friends. " +
                "Score each variant 0-100 for how likely you are to act on it. Pick NONE if none would move you. Many offers should score low for players they don't fit. " +
                "Quote: one sentence in your own voice, no emoji. Vary length and wording; do not start with 'I just' or 'I mostly'. Mention the specific detail that moved you or put you off, in your own words; never restate the offer text or start with 'Free'.",
              prompt: `You are this player:\n${personaCard(p, contextById.get(String(p.player_id)) ?? null)}\n\nThe marketing team is testing three versions of: ${def.name} (${def.hook}).\n\n${offerText}`,
            });
            const out = parseModelJson<{ scores: Record<"A" | "B" | "C", number>; preferred: PersonaVerdict["preferred"]; quote: string }>(gen.text);
            if (!out?.scores) throw new Error(`Gemini (${gen.modelUsed}) returned an invalid verdict: ${gen.text.slice(0, 200)}`);
            model = gen.modelUsed;
            const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
            const v: PersonaVerdict = {
              player_id: String(p.player_id),
              gamer_tag: String(p.gamer_tag),
              home_title: FRANCHISE_TITLE[String(p.primary_franchise)] ?? String(p.primary_franchise),
              archetype: String(p.primary_archetype),
              preferred: out.preferred,
              scores: { A: clamp(out.scores.A), B: clamp(out.scores.B), C: clamp(out.scores.C) },
              quote: String(out.quote ?? "").replace(/\u2014/g, ","),
              latency_ms: Date.now() - s0,
            };
            verdicts.push(v);
            send({ type: "verdict", verdict: v });
          } catch (e) {
            if (!failed) {
              failed = true;
              send({ type: "error", service: "vertex-ai", phase: `persona ${String(p.gamer_tag)}`, message: (e as Error).message });
            }
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      if (!failed) {
        const agg = aggregate(verdicts);
        send({ type: "aggregate", ...agg, n: verdicts.length });
        send({ type: "done", latency_ms: Date.now() - t0, model });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
