import { NextRequest, NextResponse } from "next/server";
import { SituationalTrigger } from "@/lib/types";
import { runRawGql, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { getOffers } from "@/lib/gcp/catalog";

/**
 * Situational trigger feed.
 *
 * This route previously read fields that do not exist on any telemetry record
 * (`loss_streak_count`, `frustration_score`, `event_timestamp`,
 * `spend_amount_usd`) and matched event types that are never emitted
 * (`RAGE_QUIT`, `PURCHASE`). The result was that it returned an empty trigger
 * list on every single call while appearing to work. It also still carried
 * offer names and player-ID formats that no longer exist in the catalog.
 *
 * It now reads the real schema from LIVE SPANNER:
 *   { event_id, player_id, game_id, event_type, consecutive_losses,
 *     tilt_index, event_timestamp, triggered_offer_id }
 * joined to the player and the real ABK catalog in a single graph query.
 */

export const dynamic = "force-dynamic";

/**
 * Telemetry is immutable for the lifetime of a run and the whole table is
 * ~1,500 rows, so it is paged in memory rather than re-queried per step. The
 * catalog is memoised in the catalog module. Player names come back on the
 * join, so there is no separate 5,000-row fetch.
 */
let telemetryCache: any[] | null = null;

async function getTelemetry() {
  if (telemetryCache) return telemetryCache;
  telemetryCache = await runRawGql(
    `SELECT t.event_id, t.player_id, t.game_id, t.event_type,
            t.consecutive_losses, t.tilt_index, t.event_timestamp,
            t.triggered_offer_id,
            p.gamer_tag, p.display_name, p.primary_franchise,
            p.lifetime_spend_usd, p.churn_risk_score
     FROM TelemetryEvents t
     JOIN Players p ON p.player_id = t.player_id
     ORDER BY t.event_timestamp DESC`
  );
  return telemetryCache;
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

  try {
    const [telemetry, offerList] = await Promise.all([getTelemetry(), getOffers()]);
    const offers = new Map(offerList.map((o) => [o.offer_id, o]));

    if (telemetry.length === 0) {
      return NextResponse.json({
        stepIndex,
        currentTimestamp: new Date().toISOString(),
        batchEventsEvaluated: 0,
        triggers: [],
        activeStreams: [],
        dataErrors: [],
      });
    }

    const start = (stepIndex * batchSize) % Math.max(1, telemetry.length - batchSize);
    const currentBatch = telemetry.slice(start, start + batchSize);

    const triggers: SituationalTrigger[] = [];
    const activeStreams: { playerId: string; offerId: string; reason: string }[] = [];
    // Integrity problems are reported, not swallowed. Offer ids stored on
    // telemetry have already drifted once: after a catalog renumbering they
    // still resolved, but pointed at a $99.99 currency vault as the response
    // to a Gulag loss streak, and at an Overwatch pass for a Candy Crush
    // event. A silent `continue` is what let that survive.
    const dataErrors: string[] = [];

    for (const ev of currentBatch) {
      const profile = EVENT_PROFILES[ev.event_type];
      if (!profile) {
        dataErrors.push(`Unknown event_type '${ev.event_type}' on ${ev.event_id}`);
        continue;
      }

      const lossStreak = Number(ev.consecutive_losses || 0);
      const tilt = Number(ev.tilt_index || 0);

      // A trigger needs a real frustration signal behind it.
      if (lossStreak < LOSS_STREAK_FLOOR && tilt < TILT_FLOOR) continue;

      const offer = offers.get(ev.triggered_offer_id);
      if (!offer) {
        dataErrors.push(
          `Event ${ev.event_id} references offer '${ev.triggered_offer_id}' which is not in the catalog`
        );
        continue;
      }
      if (offer.target_franchise !== profile.franchise) {
        dataErrors.push(
          `Event ${ev.event_id} (${ev.event_type}, ${profile.franchise}) is paired with ` +
            `'${offer.offer_id}' which belongs to ${offer.target_franchise}`
        );
        continue;
      }

      triggers.push({
        trigger_id: `trig-${ev.event_id}`,
        player_id: ev.player_id,
        // The join already carried the real gamer tag back, so there is no
        // separate 5,000-row lookup and no chance of a missing name.
        player_name: ev.gamer_tag || ev.display_name || ev.player_id,
        franchise: profile.franchise,
        trigger_type: profile.triggerType,
        offer_id: offer.offer_id,
        offer_title: offer.offer_title,
        price_usd: offer.price_usd,
        discount_percent: profile.discount,
        frustration_score: tilt,
        loss_streak: lossStreak,
        timestamp: ev.event_timestamp,
      });

      activeStreams.push({
        playerId: ev.player_id,
        offerId: offer.offer_id,
        reason: `${profile.label} — ${lossStreak} in a row, tilt ${(tilt * 100).toFixed(0)}%`,
      });
    }

    if (dataErrors.length) {
      console.warn("[triggers] data integrity issues:", dataErrors);
    }

    return NextResponse.json({
      stepIndex,
      currentTimestamp: currentBatch[0]?.event_timestamp || new Date().toISOString(),
      batchEventsEvaluated: currentBatch.length,
      triggers,
      activeStreams,
      dataErrors,
      source: "live_spanner",
    });
  } catch (error: any) {
    if (error instanceof SpannerUnavailableError) {
      console.error("[triggers] Spanner unavailable:", error.message);
      return NextResponse.json(
        { error: error.message, error_kind: "SPANNER_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("[triggers] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? String(error), error_kind: "INTERNAL" },
      { status: 500 }
    );
  }
}
