import { NextRequest, NextResponse } from "next/server";
import { POST as dispatchActivation } from "@/app/api/activation/dispatch/route";
import {
  buildFocusGroupHandoff,
  crewErrorBody,
  resolveRetentionOffer,
  resolveTarget,
  type CrewTargetKind,
} from "@/lib/v2/crew";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_CHANNELS = ["IN_GAME_INBOX", "PUSH_2K_MOBILE"];

/**
 * POST /api/v2/crew/act
 * body: {
 *   action: "pressure_test" | "dispatch",
 *   target: { kind: "keystones" | "crews", ids: string[], label?: string },
 *   offer?: { id: string, title: string, priceUsd: number },   // dispatch: the pressure-tested offer
 *   channels?: string[]
 * }
 * pressure_test -> live cohort (Spanner) + offer presets for the existing Focus Group.
 * dispatch      -> the existing /api/activation/dispatch path (Pub/Sub publish + BigQuery activation_log).
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const action = body?.action;
  const kind = body?.target?.kind as CrewTargetKind;
  const ids = Array.isArray(body?.target?.ids) ? body.target.ids.map(String) : [];
  if (action !== "pressure_test" && action !== "dispatch") {
    return NextResponse.json({ error: "action must be 'pressure_test' or 'dispatch'" }, { status: 400 });
  }
  if (kind !== "keystones" && kind !== "crews") {
    return NextResponse.json({ error: "target.kind must be 'keystones' or 'crews'" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "target.ids must be a non-empty array" }, { status: 400 });
  }

  try {
    const target = await resolveTarget(kind, ids, typeof body?.target?.label === "string" ? body.target.label : undefined);

    if (action === "pressure_test") {
      const offer = await resolveRetentionOffer(target.player_ids);
      const handoff = buildFocusGroupHandoff(target, offer);
      return NextResponse.json({
        action,
        target: { ...target, player_ids: target.player_ids.slice(0, 50) },
        retention_offer: offer,
        focus_group: handoff,
        latency_ms: Date.now() - started,
      });
    }

    // dispatch
    const offer = body?.offer && typeof body.offer.title === "string" ? body.offer : null;
    const offerTitle: string = offer ? String(offer.title).slice(0, 240) : (await resolveRetentionOffer(target.player_ids)).title;
    const offerId: string = offer?.id ? String(offer.id).slice(0, 80) : "keystone-retention";
    const channels: string[] = Array.isArray(body?.channels) && body.channels.length ? body.channels.map(String) : DEFAULT_CHANNELS;
    const audienceId = `crew-${kind}-${Date.now()}`;

    const dispatchReq = new NextRequest(new URL("/api/activation/dispatch", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audienceId,
        audienceName: target.label.slice(0, 180),
        matchedCount: target.count,
        channels,
        offerId,
        nlQuery: `${offerTitle} -> ${target.label}`.slice(0, 900),
      }),
    });
    const res = await dispatchActivation(dispatchReq);
    const dispatched = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        {
          route: "POST /api/v2/crew/act",
          error: dispatched?.error || "Activation dispatch failed",
          service: "pubsub+bigquery",
          resource: "/api/activation/dispatch",
          dispatch_status: res.status,
        },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }
    return NextResponse.json({
      action,
      audience_id: audienceId,
      offer: { id: offerId, title: offerTitle },
      target: { kind: target.kind, ids: target.ids, label: target.label, count: target.count },
      dispatch: dispatched,
      latency_ms: Date.now() - started,
    });
  } catch (e) {
    const { status, body: errBody } = crewErrorBody(e, "POST /api/v2/crew/act");
    return NextResponse.json(errBody, { status });
  }
}
