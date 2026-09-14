import { NextRequest, NextResponse } from "next/server";
import { handleOfficialA2ARequest, getAgentCard } from "@/lib/a2a/official-server";
import { A2AMessageType } from "@/lib/types";

// Message feed for UI Inspector
let liveA2AEvents: A2AMessageType[] = [
  {
    message_id: "msg-mb-sim-001",
    correlation_id: "corr-cod-warzone-preflight",
    sender: "MediaBuyingAgent",
    recipient: "Jamie_DeepSonaAgent",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    intent: "SIMULATE_PERSONA_REACTION",
    payload: {
      campaign_id: "camp-cod-warzone-retention",
      franchise: "Call of Duty: Warzone",
      creative_title: "Warzone Resurgence Gulag Retention & BlackCell Tilt Shield",
      proposed_spend: 120000.0,
      target_roas: 2.45,
      archetypes: ["COMPETITIVE_GRINDER", "BLACKCELL_WHALE", "CASUAL_SOCIALIZER", "LORE_SEEKER"],
    },
    status: "PROCESSED",
  },
  {
    message_id: "msg-ds-ack-002",
    correlation_id: "corr-cod-warzone-preflight",
    sender: "Jamie_DeepSonaAgent",
    recipient: "MediaBuyingAgent",
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    intent: "ACK_SIMULATE_PERSONA_REACTION",
    payload: {
      predicted_conversion_lift: 28.4,
      churn_mitigation_lift: 24.8,
      authenticity_rating: 0.95,
      consensus: "Strong positive resonance (95% authenticity). Warzone Gulag loss-mitigation shields reduced rage-quit churn by +24.8%.",
    },
    status: "DELIVERED",
  },
  {
    message_id: "msg-ab-out-003",
    correlation_id: "corr-cod-creative-handoff",
    sender: "Jamie_DeepSonaAgent",
    recipient: "Curtis_CreativeStudioAgent",
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    intent: "EMIT_AUDIENCE_BRIEF",
    payload: {
      friction_point: "Warzone Resurgence 3+ Gulag Elimination Tilt",
      target_archetype: "COMPETITIVE_GRINDER",
      urgency: "HIGH",
      suggested_hook: "Lead with 2s action killcam hook featuring Ghost Mastery Camo and BlackCell re-entry shield.",
    },
    status: "PROCESSED",
  },
];

export async function GET() {
  return NextResponse.json({
    jsonrpc: "2.0",
    result: {
      agent_card: getAgentCard(),
      messages: liveA2AEvents,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Process via Official A2A JSON-RPC 2.0 Engine (@a2a-js/sdk)
    if (body.jsonrpc === "2.0") {
      const response = handleOfficialA2ARequest(body);

      // Record in UI feed
      const params = body.params || {};
      const newEvent: A2AMessageType = {
        message_id: `msg-${Math.random().toString(36).substring(2, 9)}`,
        correlation_id: params.task_id || `task-${Date.now()}`,
        sender: params.sender || "Jamie_DeepSonaAgent",
        recipient: params.recipient || "Curtis_CreativeStudioAgent",
        timestamp: new Date().toISOString(),
        intent: params.intent || body.method,
        payload: params.payload || (params.message?.parts?.[0]?.data) || {},
        status: "PROCESSED",
      };
      liveA2AEvents.unshift(newEvent);

      return NextResponse.json(response);
    }

    // 2. Direct REST Fallback
    const newMsg: A2AMessageType = {
      message_id: body.message_id || `msg-${Math.random().toString(36).substring(2, 9)}`,
      correlation_id: body.correlation_id || `corr-${Math.random().toString(36).substring(2, 9)}`,
      sender: body.sender || "Jamie_DeepSonaAgent",
      recipient: body.recipient || "Curtis_CreativeStudioAgent",
      timestamp: new Date().toISOString(),
      intent: body.intent || "EMIT_AUDIENCE_BRIEF",
      payload: body.payload || {},
      status: "PROCESSED",
    };

    liveA2AEvents.unshift(newMsg);

    return NextResponse.json({
      status: "SUCCESS",
      message: newMsg,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
