import { NextRequest, NextResponse } from "next/server";
import { handleOfficialA2ARequest, getAgentCard } from "@/lib/a2a/official-server";
import { listActivations } from "@/lib/gcp/bigquery-client";
import { A2AMessageType, ActivationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const sessionA2AEvents: A2AMessageType[] = [];

function mapActivationToA2AMessage(act: ActivationRecord): A2AMessageType {
  return {
    message_id: act.pubsub_message_id
      ? `msg-pubsub-${act.pubsub_message_id}`
      : `msg-${act.activation_id}`,
    correlation_id: act.audience_id || act.activation_id,
    sender: "Courtside_AudienceAgent",
    recipient: `Courtside_ChannelAgent (${act.channel})`,
    timestamp: act.published_at,
    intent: "DISPATCH_ACTIVATION_EVENT",
    payload: {
      activation_id: act.activation_id,
      audience_id: act.audience_id,
      channel: act.channel,
      pubsub_message_id: act.pubsub_message_id,
      ...act.payload,
    },
    status: "PROCESSED",
  };
}

export async function GET() {
  try {
    const activations = await listActivations(15);
    const messages = [
      ...sessionA2AEvents,
      ...activations.map(mapActivationToA2AMessage),
    ];

    return NextResponse.json({
      jsonrpc: "2.0",
      result: {
        agent_card: getAgentCard(),
        messages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: `BigQuery activation_log query failed: ${error?.message || String(error)}`,
        service: "BigQuery",
        is_live: false,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Process via Official A2A JSON-RPC 2.0 Engine
    if (body.jsonrpc === "2.0") {
      const response = await handleOfficialA2ARequest(body);

      // Record in UI feed
      const params = body.params || {};
      const newEvent: A2AMessageType = {
        message_id: `msg-${Math.random().toString(36).substring(2, 9)}`,
        correlation_id: params.task_id || `task-${Date.now()}`,
        sender: params.sender || "Courtside_AudienceAgent",
        recipient: params.recipient || "Courtside_ChannelAgent",
        timestamp: new Date().toISOString(),
        intent: params.intent || body.method,
        payload: params.payload || params.message?.parts?.[0]?.data || {},
        status: "PROCESSED",
      };
      sessionA2AEvents.unshift(newEvent);

      return NextResponse.json(response);
    }

    // 2. Direct REST dispatch
    const newMsg: A2AMessageType = {
      message_id: body.message_id || `msg-${Math.random().toString(36).substring(2, 9)}`,
      correlation_id: body.correlation_id || `corr-${Math.random().toString(36).substring(2, 9)}`,
      sender: body.sender || "Courtside_AudienceAgent",
      recipient: body.recipient || "Courtside_ChannelAgent",
      timestamp: new Date().toISOString(),
      intent: body.intent || "EMIT_AUDIENCE_BRIEF",
      payload: body.payload || {},
      status: "PROCESSED",
    };

    sessionA2AEvents.unshift(newMsg);

    return NextResponse.json({
      status: "SUCCESS",
      message: newMsg,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
