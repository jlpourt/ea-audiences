import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { SituationalTrigger } from "@/lib/types";

/**
 * Situational trigger feed.
 *
 * This route previously read fields that do not exist on any telemetry record
 * (`loss_streak_count`, `frustration_score`, `event_timestamp`,
 * `spend_amount_usd`) and matched event types that are never emitted
 * (`RAGE_QUIT`, `PURCHASE`). The result was that it returned an empty trigger
 * list on every single call while appearing to work. It also still carried
 * FIFA Ultimate Team offer names and player-ID formats from before the reskin.
 *
 * It now reads the real schema:
 *   { event_id, player_id, game_id, event_type, consecutive_losses,
 *     tilt_index, timestamp, triggered_offer_id }
 * and resolves offer titles and prices from the real ABK catalog.
 */

let cachedTelemetry: any[] = [];
let cachedOffers: Map<string, any> | null = null;
let cachedPlayerNames: Map<string, string> | null = null;

function loadJson(relativePath: string): any {
  const p = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function getTelemetry() {
  if (cachedTelemetry.length === 0) {
    cachedTelemetry = loadJson("data/telemetry_match_events.json") || [];
  }
  return cachedTelemetry;
}

function getOffers(): Map<string, any> {
  if (!cachedOffers) {
    const offers = loadJson("data/marketing_offers.json") || [];
    cachedOffers = new Map(offers.map((o: any) => [o.offer_id, o]));
  }
  return cachedOffers;
}

/** Real display names, so the feed shows actual players rather than a template. */
function getPlayerNames(): Map<string, string> {
  if (!cachedPlayerNames) {
    const players = loadJson("data/master_players.json") || [];
    cachedPlayerNames = new Map(
      players.map((p: any) => [p.player_id, p.gamer_tag || p.display_name])
    );
  }
  return cachedPlayerNames;
}

/**
 * Each telemetry event type is a franchise-specific frustration moment. The
 * label is what a marketer sees in the live feed, so it has to name the actual
 * in-game situation.
 */
const EVENT_PROFILES: Record<
  string,
  { franchise: string; label: string; triggerType: string; discount: number }
> = {
  GULAG_DEFEAT_LOSS_STREAK: {
    franchise: "COD",
    label: "Gulag defeat streak",
    triggerType: "COD_GULAG_LOSS_STREAK_TILT",
    discount: 65.0,
  },
  RAID_WIPE_STREAK: {
    franchise: "WOW",
    label: "Raid wipe streak",
    triggerType: "WOW_RAID_WIPE_FRUSTRATION",
    discount: 40.0,
  },
  PIT_DEATH_SLUMP: {
    franchise: "DIABLO4",
    label: "The Pit death slump",
    triggerType: "DIABLO4_PIT_DEATH_SLUMP",
    discount: 55.0,
  },
  OUT_OF_MOVES_STUCK: {
    franchise: "CANDYCRUSH",
    label: "Out of moves on a sticky level",
    triggerType: "CANDYCRUSH_STICKY_LEVEL_STALL",
    discount: 50.0,
  },
};

/** Fires when a player is genuinely frustrated, not merely present. */
const LOSS_STREAK_FLOOR = 3;
const TILT_FLOOR = 0.6;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stepIndex = parseInt(searchParams.get("step") || "0", 10);
  const batchSize = 15;

  const telemetry = getTelemetry();
  const offers = getOffers();
  const playerNames = getPlayerNames();

  if (telemetry.length === 0) {
    return NextResponse.json({
      stepIndex,
      currentTimestamp: new Date().toISOString(),
      batchEventsEvaluated: 0,
      triggers: [],
      activeStreams: [],
    });
  }

  const start = (stepIndex * batchSize) % Math.max(1, telemetry.length - batchSize);
  const currentBatch = telemetry.slice(start, start + batchSize);

  const triggers: SituationalTrigger[] = [];
  const activeStreams: { playerId: string; offerId: string; reason: string }[] = [];

  for (const ev of currentBatch) {
    const profile = EVENT_PROFILES[ev.event_type];
    if (!profile) continue;

    const lossStreak = Number(ev.consecutive_losses || 0);
    const tilt = Number(ev.tilt_index || 0);

    // A trigger needs a real frustration signal behind it.
    if (lossStreak < LOSS_STREAK_FLOOR && tilt < TILT_FLOOR) continue;

    const offer = offers.get(ev.triggered_offer_id);
    if (!offer) continue;

    triggers.push({
      trigger_id: `trig-${ev.event_id}`,
      player_id: ev.player_id,
      player_name: playerNames.get(ev.player_id) || ev.player_id,
      franchise: profile.franchise,
      trigger_type: profile.triggerType,
      offer_id: offer.offer_id,
      offer_title: offer.offer_title,
      price_usd: Number(offer.price_usd || 0),
      discount_percent: profile.discount,
      frustration_score: tilt,
      loss_streak: lossStreak,
      timestamp: ev.timestamp,
    });

    activeStreams.push({
      playerId: ev.player_id,
      offerId: offer.offer_id,
      reason: `${profile.label} — ${lossStreak} in a row, tilt ${(tilt * 100).toFixed(0)}%`,
    });
  }

  return NextResponse.json({
    stepIndex,
    currentTimestamp: currentBatch[0]?.timestamp || new Date().toISOString(),
    batchEventsEvaluated: currentBatch.length,
    triggers,
    activeStreams,
  });
}
