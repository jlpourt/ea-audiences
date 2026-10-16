/**
 * GET /api/v2/portfolio
 *
 * Take-Two portfolio command center. Every number is computed live from the
 * Spanner player graph (`TakeTwoPlayerGraph` tables on the v2 database):
 *
 *   - franchises:  Games parent hubs (title, label, lifecycle) joined with the
 *                  players whose primary franchise it is (count, lifetime spend,
 *                  churned, churned in the 14 days before the data as-of).
 *   - labels:      distinct players per publishing label via PlaysGame.
 *   - overlap:     franchise x franchise co-play from Players.franchises_played
 *                  (share of franchise A's players who also play B).
 *   - totals:      graph players, multi-title players, lifetime spend, churn.
 *   - headline:    one Gemini (FAST) sentence written only from the numbers above.
 *
 * As-of is anchored to the data (MAX(last_active_at)), not the wall clock.
 * Failures return 503 (Spanner) or 502 (Vertex AI) with the service, resource
 * and message. Nothing is estimated or canned. Results are cached in-process
 * for 15 minutes (pass ?fresh=1 to recompute).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/gcp/spanner-client";
import { generateText } from "@/lib/gcp/genai-client";
import { GCP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface PortfolioFranchise {
  franchise: string;
  game_id: string;
  title: string;
  label: string;
  lifecycle_status: string | null;
  players: number;
  lifetime_spend_usd: number;
  churned: number;
  churned_14d: number;
  churn_rate: number;
}

export interface PortfolioLabel {
  label: string;
  players: number;
  franchises: string[];
}

export interface PortfolioResponse {
  as_of: string | null;
  totals: {
    players: number;
    multi_title_players: number;
    multi_title_share: number;
    cross_label_players: number;
    lifetime_spend_usd: number;
    churned_14d: number;
  };
  labels: PortfolioLabel[];
  franchises: PortfolioFranchise[];
  /** share[a][b] = share of franchise a's players who also play franchise b. */
  overlap: { franchises: string[]; share: number[][]; counts: Record<string, number> };
  headline: string | null;
  model_used: string | null;
  source: { engine: "spanner"; database: string; instance: string };
  latency_ms: number;
  cache: "hit" | "miss";
  computed_at: string;
}

type Built = Omit<PortfolioResponse, "cache" | "computed_at">;

const CACHE_TTL_MS = 15 * 60 * 1000;
const g = globalThis as unknown as { __portfolioCache?: { at: number; value: Built } };

class StageError extends Error {
  constructor(public service: "spanner" | "vertex-ai", public resource: string, message: string) {
    super(message);
  }
}

async function q<T = Record<string, unknown>>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
  try {
    const [rows] = await getDatabase().run(params ? { sql, params } : { sql });
    return rows.map((r) => r.toJSON() as T);
  } catch (e) {
    throw new StageError(
      "spanner",
      `projects/${GCP_CONFIG.projectId}/instances/${GCP_CONFIG.spannerInstanceId}/databases/${GCP_CONFIG.spannerDatabaseId}`,
      `${(e as Error).message}\nSQL: ${sql.replace(/\s+/g, " ").slice(0, 400)}`,
    );
  }
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

async function build(): Promise<Built> {
  const t0 = Date.now();

  const [asOfRow] = await q<{ as_of: Date | string | null }>("SELECT MAX(last_active_at) AS as_of FROM Players");
  const asOf = asOfRow?.as_of ? new Date(asOfRow.as_of as string) : null;

  const [hubs, perFranchise, perLabel, totalsRow, overlapRows, crossLabel] = await Promise.all([
    q<{ game_id: string; title: string; franchise: string; label: string; lifecycle_status: string | null }>(
      "SELECT game_id, title, franchise, label, lifecycle_status FROM Games WHERE is_parent_hub = true",
    ),
    q<{ franchise: string; players: number; spend: number; churned: number; churned_14d: number }>(
      `SELECT primary_franchise AS franchise,
              COUNT(*) AS players,
              SUM(lifetime_spend_usd) AS spend,
              COUNTIF(churned_at IS NOT NULL) AS churned,
              COUNTIF(churned_at IS NOT NULL AND churned_at > TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)) AS churned_14d
       FROM Players GROUP BY primary_franchise`,
      { as_of: asOf ?? new Date(0) },
    ),
    q<{ label: string; players: number }>(
      `SELECT g.label AS label, COUNT(DISTINCT pg.player_id) AS players
       FROM PlaysGame pg JOIN Games g ON g.game_id = pg.game_id
       GROUP BY g.label`,
    ),
    q<{ players: number; multi: number; spend: number; churned_14d: number }>(
      `SELECT COUNT(*) AS players,
              COUNTIF(ARRAY_LENGTH(franchises_played) >= 2) AS multi,
              SUM(lifetime_spend_usd) AS spend,
              COUNTIF(churned_at IS NOT NULL AND churned_at > TIMESTAMP_SUB(@as_of, INTERVAL 14 DAY)) AS churned_14d
       FROM Players`,
      { as_of: asOf ?? new Date(0) },
    ),
    q<{ a: string; b: string; n: number }>(
      `SELECT a, b, COUNT(*) AS n
       FROM Players p, UNNEST(p.franchises_played) AS a, UNNEST(p.franchises_played) AS b
       GROUP BY a, b`,
    ),
    q<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT pg.player_id FROM PlaysGame pg JOIN Games g ON g.game_id = pg.game_id
         GROUP BY pg.player_id HAVING COUNT(DISTINCT g.label) >= 2)`,
    ),
  ]);

  if (hubs.length === 0) {
    throw new StageError("spanner", "Games", "No parent-hub rows in Games; the portfolio cannot be built.");
  }

  const pf = new Map(perFranchise.map((r) => [r.franchise, r]));
  const franchises: PortfolioFranchise[] = hubs
    .map((h) => {
      const r = pf.get(h.franchise);
      const players = num(r?.players);
      const churned = num(r?.churned);
      return {
        franchise: h.franchise,
        game_id: h.game_id,
        title: h.title,
        label: h.label,
        lifecycle_status: h.lifecycle_status,
        players,
        lifetime_spend_usd: Math.round(num(r?.spend)),
        churned,
        churned_14d: num(r?.churned_14d),
        churn_rate: players ? churned / players : 0,
      };
    })
    .sort((a, b) => b.players - a.players);

  const labels: PortfolioLabel[] = perLabel
    .map((l) => ({
      label: l.label,
      players: num(l.players),
      franchises: franchises.filter((f) => f.label === l.label).map((f) => f.franchise),
    }))
    .sort((a, b) => b.players - a.players);

  // Overlap matrix over the franchises that have hubs, ordered by size.
  const order = franchises.map((f) => f.franchise);
  const counts: Record<string, number> = {};
  const pair = new Map<string, number>();
  for (const r of overlapRows) {
    if (r.a === r.b) counts[r.a] = num(r.n);
    else pair.set(`${r.a}|${r.b}`, num(r.n));
  }
  const share = order.map((a) => order.map((b) => (a === b ? 1 : counts[a] ? (pair.get(`${a}|${b}`) ?? 0) / counts[a] : 0)));

  const t = totalsRow[0];
  const totals = {
    players: num(t?.players),
    multi_title_players: num(t?.multi),
    multi_title_share: num(t?.players) ? num(t?.multi) / num(t?.players) : 0,
    cross_label_players: num(crossLabel[0]?.n),
    lifetime_spend_usd: Math.round(num(t?.spend)),
    churned_14d: num(t?.churned_14d),
  };

  // Strongest cross-franchise pull, as context for the headline.
  let best: { a: string; b: string; s: number } | null = null;
  order.forEach((a, i) =>
    order.forEach((b, j) => {
      if (i !== j && (counts[a] ?? 0) >= 100 && (!best || share[i][j] > best.s)) best = { a, b, s: share[i][j] };
    }),
  );

  const usd = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
  const int = (n: number) => n.toLocaleString("en-US");
  const title = (f: string) => franchises.find((x) => x.franchise === f)?.title ?? f;
  const facts = [
    `Players in graph: ${int(totals.players)}`,
    `Lifetime spend: ${usd(totals.lifetime_spend_usd)}`,
    `Play 2+ titles: ${int(totals.multi_title_players)} (${Math.round(totals.multi_title_share * 100)}%)`,
    `Play across 2+ publishing labels: ${int(totals.cross_label_players)}`,
    `Churned in the last 14 days: ${int(totals.churned_14d)}`,
    ...franchises.slice(0, 6).map(
      (f) => `${f.title}: ${int(f.players)} primary players, ${Math.round(f.churn_rate * 100)}% churned, ${usd(f.lifetime_spend_usd)} lifetime spend`,
    ),
    ...(best
      ? [`${Math.round((best as { s: number }).s * 100)}% of ${title((best as { a: string }).a)} players also play ${title((best as { b: string }).b)}`]
      : []),
  ];

  let headline: string | null = null;
  let modelUsed: string | null = null;
  try {
    const gen = await generateText({
      role: "FAST",
      system:
        "You write one-line headlines for the Take-Two Interactive executive team. Plain words. Max 18 words. No emoji. No em dashes. No hype. Use only the numbers given, written exactly as given (keep $ and % formats); never invent a number. Prefer a cross-portfolio insight over a single-title one.",
      prompt: `Write the single most important portfolio takeaway from these live player-graph facts:\n${facts.join("\n")}`,
      temperature: 0.4,
      maxOutputTokens: 1024,
      thinkingBudget: 0,
    });
    if (gen.finishReason === "MAX_TOKENS") throw new Error(`Gemini (${gen.modelUsed}) truncated the headline (MAX_TOKENS).`);
    headline = gen.text.trim().replace(/^["']|["']$/g, "").replace(/\u2014/g, ",") || null;
    modelUsed = gen.modelUsed;
  } catch (e) {
    throw new StageError("vertex-ai", "generateText(FAST)", (e as Error).message);
  }

  return {
    as_of: asOf ? asOf.toISOString() : null,
    totals,
    labels,
    franchises,
    overlap: { franchises: order, share, counts },
    headline,
    model_used: modelUsed,
    source: { engine: "spanner", database: GCP_CONFIG.spannerDatabaseId, instance: GCP_CONFIG.spannerInstanceId },
    latency_ms: Date.now() - t0,
  };
}

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const hit = g.__portfolioCache;
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.value, cache: "hit", computed_at: new Date(hit.at).toISOString() } satisfies PortfolioResponse);
  }
  try {
    const value = await build();
    const at = Date.now();
    g.__portfolioCache = { at, value };
    return NextResponse.json({ ...value, cache: "miss", computed_at: new Date(at).toISOString() } satisfies PortfolioResponse);
  } catch (e) {
    const err = e as StageError;
    console.error("[api/v2/portfolio]", err);
    const status = err.service === "vertex-ai" ? 502 : 503;
    return NextResponse.json(
      {
        error: `Portfolio build failed in ${err.service ?? "unknown"}`,
        service: err.service ?? "unknown",
        resource: err.resource ?? null,
        message: err.message,
      },
      { status },
    );
  }
}
