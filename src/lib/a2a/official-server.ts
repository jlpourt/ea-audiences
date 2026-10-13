import {
  A2A_PROTOCOL_VERSION,
  TaskState,
  Role,
} from "@a2a-js/sdk";
import fs from "fs";
import path from "path";
import { runRawGql, toNumber } from "@/lib/gcp/spanner-client";

export interface OfficialA2ATask {
  id: string;
  createdAt: string;
  status: {
    state: TaskState;
    message?: string;
  };
  messages: Array<{
    role: Role;
    parts: Array<{ text?: string; data?: any }>;
  }>;
  artifacts: Array<{
    name: string;
    type: string;
    data: any;
  }>;
}

const inMemoryTasks: Map<string, OfficialA2ATask> = new Map();

export function getAgentCard() {
  try {
    const cardPath = path.join(process.cwd(), "public/.well-known/agent-card.json");
    if (fs.existsSync(cardPath)) {
      return JSON.parse(fs.readFileSync(cardPath, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading agent card:", e);
  }
  return {
    name: "Courtside_AudienceAgent",
    version: "1.0.0",
    protocolVersion: A2A_PROTOCOL_VERSION,
    description: "2K Courtside — Audience Builder & Segmentation Engine for NBA 2K and Take-Two Interactive",
  };
}

export async function extractPlayersForA2A(promptText: string, payload: any) {
  const lower = (promptText || "").toLowerCase();

  // Determine count limit
  const countMatch = promptText.match(/\b([0-9]+)\b/);
  const limit = countMatch ? Math.min(25, Math.max(1, parseInt(countMatch[1], 10))) : 8;

  let whereClause = "WHERE 1=1";
  if (lower.includes("cliff") || lower.includes("sub-85") || lower.includes("stalled")) {
    whereClause += " AND LAX_INT64(p.game_telemetry.myplayer_ovr) < 85 AND LAX_INT64(p.game_telemetry.last_login_days_ago) >= 5";
  } else if (lower.includes("gta") || lower.includes("rockstar") || lower.includes("cross-label")) {
    whereClause += " AND LAX_BOOL(p.game_telemetry.rockstar_linked) AND NOT LAX_BOOL(p.game_telemetry.gta6_preorder)";
  } else if (lower.includes("whale") || lower.includes("opal") || lower.includes("myteam")) {
    whereClause += " AND (LAX_INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 5 OR p.lifetime_spend_usd >= 300)";
  } else if (lower.includes("tilt") || lower.includes("loss") || lower.includes("rage")) {
    whereClause += " AND (p.tilt_sensitivity >= 0.55 OR p.recent_loss_streak >= 2)";
  }

  const query = `
    SELECT p.player_id, p.display_name, p.gamer_tag, p.primary_franchise,
           p.franchises_played, p.primary_archetype, p.lifetime_spend_usd,
           p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak,
           p.dma_market, p.country, p.game_telemetry
    FROM Players p
    ${whereClause}
    ORDER BY p.lifetime_spend_usd DESC
    LIMIT @limit
  `;

  const rows = await runRawGql(query, { limit });

  return rows.map((p: any) => {
    const tel = typeof p.game_telemetry === "string" ? JSON.parse(p.game_telemetry) : (p.game_telemetry || {});
    const gamerTag = String(p.gamer_tag || p.display_name || p.player_id);

    return {
      player_id: String(p.player_id),
      gamer_tag: gamerTag,
      display_name: gamerTag,
      primary_franchise: String(p.primary_franchise || "NBA2K"),
      franchises_played: Array.isArray(p.franchises_played) ? p.franchises_played : ["NBA2K"],
      geographic_location: {
        country: String(p.country || "United States"),
        dma_market: String(p.dma_market || "National"),
      },
      engagement_profile: {
        primary_archetype: String(p.primary_archetype || "MYCAREER_STORY_CASUAL"),
        lifetime_spend_usd: toNumber(p.lifetime_spend_usd),
        churn_risk_score: toNumber(p.churn_risk_score),
        tilt_sensitivity: toNumber(p.tilt_sensitivity),
        recent_loss_streak: toNumber(p.recent_loss_streak),
      },
      in_game_telemetry: {
        myplayer_ovr: tel.myplayer_ovr ?? null,
        myplayer_build: tel.myplayer_build ?? null,
        position: tel.position ?? null,
        rep_tier: tel.rep_tier ?? null,
        season_pass_tier: tel.season_pass_tier ?? 0,
        season_pass_edition: tel.season_pass_edition ?? "NONE",
        myteam_galaxy_opal_count: tel.myteam_galaxy_opal_count ?? 0,
        rockstar_linked: Boolean(tel.rockstar_linked),
        gta6_preorder: Boolean(tel.gta6_preorder),
        gravity_score: tel.gravity_score ?? 0,
      },
    };
  });
}

export async function handleOfficialA2ARequest(rpcRequest: any) {
  const reqId = rpcRequest.id || `req-${Date.now()}`;
  const method = rpcRequest.method;
  const params = rpcRequest.params || {};

  // Method 1: Discover AgentCard
  if (method === "agents/getCard" || method === "agent/getCard") {
    return {
      jsonrpc: "2.0",
      id: reqId,
      result: getAgentCard(),
    };
  }

  // Method 2: Send Message / Execute Task
  if (method === "tasks/send" || method === "tasks/create" || method === "message/send") {
    const taskId = params.task_id || params.taskId || `task-2k-${Date.now()}`;
    const promptText = params.message?.parts?.[0]?.text || params.prompt || "";

    const matchedPlayers = await extractPlayersForA2A(promptText, params.payload || {});

    const artifactData = {
      audience_segment: "NBA 2K27 Courtside Segment Resolution",
      total_cohort_estimate: matchedPlayers.length * 15,
      extracted_players_count: matchedPlayers.length,
      players: matchedPlayers,
      agent_metadata: {
        engine: "TakeTwoPlayerGraph (blackrock-spanner/twok_graph_db)",
        protocol: "A2A Protocol / 2K Courtside Multi-Agent Standard",
        participating_agents: [
          "Courtside_AudienceAgent",
          "Courtside_BriefAgent",
          "Courtside_CreativeAgent",
          "Courtside_ChannelAgent",
        ],
        generated_at: new Date().toISOString(),
      },
    };

    const message = params.message || {
      role: Role.ROLE_USER,
      parts: [{ text: promptText, data: artifactData }],
    };

    const task: OfficialA2ATask = {
      id: taskId,
      createdAt: new Date().toISOString(),
      status: {
        state: TaskState.TASK_STATE_COMPLETED,
        message: `Extracted ${matchedPlayers.length} players from live TakeTwoPlayerGraph with DMA location and NBA 2K telemetry.`,
      },
      messages: [
        message,
        {
          role: Role.ROLE_AGENT,
          parts: [
            {
              text: `Dispatched ${matchedPlayers.length} player profiles across Courtside A2A channel agents.`,
              data: artifactData,
            },
          ],
        },
      ],
      artifacts: [
        {
          name: "courtside_audience_cohort",
          type: "application/json",
          data: artifactData,
        },
      ],
    };

    inMemoryTasks.set(taskId, task);

    return {
      jsonrpc: "2.0",
      id: reqId,
      result: {
        task_id: taskId,
        status: "TASK_STATE_COMPLETED",
        artifacts: task.artifacts,
        messages: task.messages,
      },
    };
  }

  // Method 3: Get Task
  if (method === "tasks/get" || method === "task/get") {
    const taskId = params.task_id || params.taskId;
    if (inMemoryTasks.has(taskId)) {
      return {
        jsonrpc: "2.0",
        id: reqId,
        result: inMemoryTasks.get(taskId),
      };
    }
    return {
      jsonrpc: "2.0",
      id: reqId,
      error: { code: -32602, message: `Task '${taskId}' not found` },
    };
  }

  // Method 4: List Tasks
  if (method === "tasks/list" || method === "task/list") {
    return {
      jsonrpc: "2.0",
      id: reqId,
      result: {
        tasks: Array.from(inMemoryTasks.values()),
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id: reqId,
    error: { code: -32601, message: `Method '${method}' not implemented` },
  };
}
