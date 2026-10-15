import { NextResponse } from "next/server";
import { errorPayload, getSocialHops, pickDefaultHopPair } from "@/lib/v2/creatorbrand";

/**
 * GET /api/v2/social/hops?from=&to=
 * Degrees of separation over PLAYED_WITH | FRIENDS_WITH using Spanner Graph ANY SHORTEST
 * with a {1,4} quantified path. `from` / `to` accept a player_id, `community:<id>`, or
 * `archetype:<NAME>`. When both are omitted, two live communities are picked.
 */
export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_:\-\.]{1,96}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");
  if ((from && !TOKEN.test(from)) || (to && !TOKEN.test(to))) {
    return NextResponse.json({ error: "Invalid from/to token" }, { status: 400 });
  }
  if ((from && !to) || (!from && to)) {
    return NextResponse.json({ error: "Provide both from and to, or neither" }, { status: 400 });
  }
  try {
    if (!from || !to) {
      const pair = await pickDefaultHopPair();
      from = pair.from;
      to = pair.to;
    }
    const data = await getSocialHops(from, to);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[v2/social/hops]", e);
    const { status, body } = errorPayload(e, "/api/v2/social/hops");
    return NextResponse.json(body, { status });
  }
}
