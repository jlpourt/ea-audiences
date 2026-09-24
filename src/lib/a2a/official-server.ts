import {
  A2A_PROTOCOL_VERSION,
  TaskState,
  Role,
  AGENT_CARD_PATH,
} from "@a2a-js/sdk";
import fs from "fs";
import path from "path";

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
    name: "Jamie_AudienceIntelligenceAgent",
    version: "1.0.0",
    protocolVersion: A2A_PROTOCOL_VERSION,
  };
}

function extractPlayersForA2A(promptText: string, payload: any) {
  try {
    const dataPath = path.join(process.cwd(), "data", "master_players.json");
    if (!fs.existsSync(dataPath)) return [];
    const allPlayers = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    const lower = (promptText || "").toLowerCase();
    
    // 1. Determine franchise / mode
    let franchise = "COD";
    if (lower.includes("warzone") || lower.includes("resurgence")) franchise = "WARZONE";
    else if (lower.includes("black ops") || lower.includes("bo6") || lower.includes("zombies")) franchise = "BLACK_OPS";
    else if (lower.includes("modern warfare") || lower.includes("mw3")) franchise = "MODERN_WARFARE";
    else if (lower.includes("cdl") || lower.includes("ranked")) franchise = "CDL_RANKED";
    else if (lower.includes("mobile")) franchise = "COD_MOBILE";

    // 2. Determine count limit (default 5)
    const countMatch = promptText.match(/\b([0-9]+)\b/);
    const limit = countMatch ? Math.min(25, parseInt(countMatch[1], 10)) : 5;

    // 3. Filter candidates
    let candidates = allPlayers.filter((p: any) => p.primary_franchise === franchise || (p.franchises_played && p.franchises_played.includes(franchise)));

    if (lower.includes("tilt") || lower.includes("loss") || lower.includes("defeat") || lower.includes("streak") || lower.includes("gulag")) {
      candidates = candidates.filter((p: any) => p.tilt_sensitivity >= 0.55 || (p.recent_loss_streak && p.recent_loss_streak >= 1));
      candidates.sort((a: any, b: any) => (b.recent_loss_streak || 0) - (a.recent_loss_streak || 0) || b.tilt_sensitivity - a.tilt_sensitivity);
    } else if (lower.includes("whale") || lower.includes("spend")) {
      candidates = candidates.filter((p: any) => p.lifetime_spend_usd >= 1000);
      candidates.sort((a: any, b: any) => b.lifetime_spend_usd - a.lifetime_spend_usd);
    }

    const matched = candidates.slice(0, limit);

    return matched.map((p: any) => {
      const tel = p.game_telemetry || {};
      const loadout = tel.main_loadout || "Kastov 762 / Kar98k";
      const charClass = tel.character_class || "Enforcer / Recon Specialist";
      const playstyle = tel.primary_playstyle || "Aggressive Resurgence Sweeper";
      const rewardPref = tel.preferred_reward_type || "BlackCell Season Battle Pass";
      const streak = p.recent_loss_streak || 0;

      return {
        player_id: p.player_id,
        gamer_tag: p.display_name,
        display_name: p.display_name,
        primary_email: p.primary_email || `${p.display_name.toLowerCase().replace(/[^a-z0-9]/g, "_")}@activision.sample.com`,
        primary_franchise: p.primary_franchise,
        franchises_played: p.franchises_played || [p.primary_franchise],
        
        geographic_location: {
          country: p.country || "United States",
          country_code: p.country_code || "US",
          country_flag: p.country_flag || "🇺🇸",
          dma_market: p.dma_market || "London Metro",
          region: p.dma_market || "London Metro",
          lat: Number(p.lat || 51.5074),
          lng: Number(p.lng || -0.1278),
        },

        engagement_profile: {
          primary_archetype: p.primary_archetype,
          lifetime_spend_usd: Number(p.lifetime_spend_usd || 0),
          spend_tier: (p.lifetime_spend_usd || 0) >= 2500
            ? "Tier 4 Mega Whale"
            : (p.lifetime_spend_usd || 0) >= 700
            ? "Tier 3 High Engagement"
            : (p.lifetime_spend_usd || 0) >= 100
            ? "Tier 2 Core Loyalist"
            : (p.lifetime_spend_usd || 0) > 0
            ? "Tier 1 Starter Spender"
            : "Tier 0 Base Game / F2P",
          churn_risk_score: Number(p.churn_risk_score || 0.4),
          tilt_sensitivity: Number(p.tilt_sensitivity || 0.5),
          recent_loss_streak: streak,
          total_play_hours: Number(p.total_play_hours || 150),
          last_active_at: p.last_active_at || "2026-08-17T14:30:00Z",
        },

        creator_affiliations: {
          primary_creator_influence: p.primary_creator_influence || "creator-scump",
          followed_creators: p.followed_creators || ["creator-scump"],
        },

        in_game_telemetry: {
          ...tel,
          main_loadout: loadout,
          character_class: charClass,
          primary_playstyle: playstyle,
          preferred_reward_type: rewardPref,
        },

        purchased_items: p.purchased_items || [],

        campaign_context: {
          suggested_headline: `${p.display_name} • Reset momentum in ${tel.rank_tier || "Ranked Play"}`,
          recovery_hook: `Targeted defeat mitigation for ${p.display_name} after ${streak} match loss streak`,
        }
      };
    });
  } catch (e) {
    console.error("Error extracting players for A2A:", e);
    return [];
  }
}

export function handleOfficialA2ARequest(rpcRequest: any) {
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
    const taskId = params.task_id || params.taskId || `task-cod-${Date.now()}`;
    const promptText = params.message?.parts?.[0]?.text || params.prompt || "";
    
    // Resolve matching players with personalized telemetry
    const matchedPlayers = extractPlayersForA2A(promptText, params.payload || {});

    const artifactData = {
      audience_segment: "Call of Duty: Warzone High-Tilt Personalized Cohort",
      total_cohort_estimate: 1840,
      extracted_players_count: matchedPlayers.length,
      players: matchedPlayers,
      agent_metadata: {
        engine: "Spanner Property Graph (ABKPlayerGraph)",
        protocol: "Linux Foundation / Google A2A Open Standard v0.3",
        generated_at: new Date().toISOString()
      }
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
        message: `Extracted ${matchedPlayers.length} individual players with comprehensive Spanner Graph telemetry, geographic DMA data, and economic profiles.`,
      },
      messages: [
        message,
        {
          role: Role.ROLE_AGENT,
          parts: [
            {
              text: `Dispatched ${matchedPlayers.length} personalized player profiles over A2A SDK Protocol.`,
              data: artifactData,
            },
          ],
        },
      ],
      artifacts: [
        {
          name: "personalized_audience_cohort",
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
