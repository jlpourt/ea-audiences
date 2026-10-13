import { NextRequest, NextResponse } from "next/server";
import { runRawGql, toNumber, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { SituationalTrigger } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface TelemetryTriggerItem {
  trigger_id: string;
  event_id: string;
  player_id: string;
  gamer_tag: string;
  dma_market: string;
  myplayer_ovr: number | null;
  event_type: string;
  event_label: string;
  consecutive_losses: number;
  tilt_index: number;
  offer_id: string;
  offer_title: string;
  price_usd: number;
  discount_percent: number;
  timestamp: string;
  reason: string;
}

const EVENT_DESCRIPTIONS: Record<string, { label: string; offer: { id: string; title: string; price: number; discount: number }; reason: string }> = {
  RAGE_QUIT: {
    label: "Park Match Rage-Quit",
    offer: { id: "off-crew-reup-bundle", title: "$4.99 Crew Re-Up Bundle", price: 4.99, discount: 65 },
    reason: "Severe tilt event in The City; social gravity teammate invite + 15K VC deployed",
  },
  REC_GAME_COMPLETE: {
    label: "Rec 5v5 Match Complete",
    offer: { id: "off-crew-reup-bundle", title: "$4.99 Crew Re-Up Bundle", price: 4.99, discount: 50 },
    reason: "Crew synergy active; teammate re-up boost available",
  },
  PARK_GAME_COMPLETE: {
    label: "The City 3v3 Park Win",
    offer: { id: "off-nba2k27-season-pass-hof", title: "Season Pass Hall of Fame", price: 19.99, discount: 25 },
    reason: "Rep tier grind active; 40-tier Season 1 accelerator unlocked",
  },
  MYTEAM_PACK_OPENED: {
    label: "MyTEAM Pack Opened",
    offer: { id: "off-myteam-galaxy-opal-deluxe", title: "Galaxy Opal Deluxe Pack ($14.99)", price: 14.99, discount: 30 },
    reason: "Collection whale momentum; 97+ Galaxy Opal player card bundle matched",
  },
  SEASON_PASS_LEVEL_UP: {
    label: "Season 1 Tier Advance",
    offer: { id: "off-nba2k27-season-pass-hof", title: "Season Pass Hall of Fame", price: 19.99, discount: 20 },
    reason: "Approaching Week 4 milestone; Hall of Fame edition skip available",
  },
  VC_PURCHASE: {
    label: "VC Currency Re-Up",
    offer: { id: "off-nba2k27-loyalty-upgrade", title: "NBA 2K26 → 2K27 HoF Loyalty Upgrade", price: 69.99, discount: 15 },
    reason: "High-LTV NBA 2K26 veteran profile; 100,000 VC + Hall of Fame Season Pass upgrade bridge",
  },
  CREW_INVITE_SENT: {
    label: "Pro-Am Crew Squad Invite",
    offer: { id: "off-crew-reup-bundle", title: "$4.99 Crew Re-Up Bundle", price: 4.99, discount: 50 },
    reason: "Squad formation in progress; co-op VC incentive active",
  },
  DAILY_LOGIN: {
    label: "Courtside Daily Login",
    offer: { id: "off-nba2k27-season-pass-hof", title: "Season Pass Hall of Fame", price: 19.99, discount: 20 },
    reason: "Daily ritual active; Season 1 countdown reminder deployed",
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stepIndex = parseInt(searchParams.get("step") || "0", 10);
  const limit = 8;

  try {
    const query = `
      SELECT
        t.event_id,
        t.player_id,
        t.game_id,
        t.event_type,
        t.consecutive_losses,
        t.tilt_index,
        t.event_timestamp,
        p.gamer_tag,
        p.display_name,
        p.dma_market,
        LAX_INT64(p.game_telemetry.myplayer_ovr) as myplayer_ovr,
        p.primary_archetype,
        p.lifetime_spend_usd,
        LAX_BOOL(p.game_telemetry.rockstar_linked) as rockstar_linked,
        LAX_BOOL(p.game_telemetry.gta6_preorder) as gta6_preorder
      FROM TelemetryEvents t
      JOIN Players p ON p.player_id = t.player_id
      ORDER BY t.event_timestamp DESC
      LIMIT 120
    `;

    const rows = await runRawGql(query);

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        stepIndex,
        currentTimestamp: new Date().toISOString(),
        triggers: [],
        activeStreams: [],
        source: "live_spanner",
      });
    }

    // Paginate through real live Spanner rows using stepIndex
    const startIdx = (stepIndex * limit) % Math.max(1, rows.length - limit);
    const batch = rows.slice(startIdx, startIdx + limit);

    const triggers: SituationalTrigger[] = [];
    const telemetryItems: TelemetryTriggerItem[] = [];
    const activeStreams: { playerId: string; offerId: string; reason: string }[] = [];

    for (const r of batch) {
      const eventType = String(r.event_type || "DAILY_LOGIN");
      const defaultDesc = EVENT_DESCRIPTIONS[eventType] || EVENT_DESCRIPTIONS.DAILY_LOGIN;
      const gamerTag = String(r.gamer_tag || r.display_name || r.player_id);
      const dmaMarket = String(r.dma_market || "National");
      const ovr = r.myplayer_ovr !== null && r.myplayer_ovr !== undefined ? toNumber(r.myplayer_ovr) : null;
      const consecutiveLosses = toNumber(r.consecutive_losses);
      const tiltIndex = Number(toNumber(r.tilt_index).toFixed(2));

      // Determine matched 2K offer
      let offer = defaultDesc.offer;
      let reason = defaultDesc.reason;

      if (ovr !== null && ovr < 85 && consecutiveLosses >= 2) {
        offer = { id: "off-crew-reup-bundle", title: "$4.99 Crew Re-Up Bundle", price: 4.99, discount: 65 };
        reason = `Sub-85 OVR build (${ovr}) on a ${consecutiveLosses}-loss slump; $4.99 Crew Re-Up prevents cliff churn`;
      } else if (r.rockstar_linked && !r.gta6_preorder && (eventType === "DAILY_LOGIN" || eventType === "VC_PURCHASE")) {
        offer = { id: "off-nba2k27-loyalty-upgrade", title: "NBA 2K26 → 2K27 HoF Loyalty Upgrade", price: 69.99, discount: 15 };
        reason = "NBA 2K26 veteran account with prior VC spend; 2K27 Hall of Fame loyalty upgrade prompt";
      }

      triggers.push({
        trigger_id: `trig-${r.event_id}`,
        player_id: String(r.player_id),
        player_name: gamerTag,
        franchise: "NBA2K",
        trigger_type: eventType,
        offer_id: offer.id,
        offer_title: offer.title,
        price_usd: offer.price,
        discount_percent: offer.discount,
        frustration_score: tiltIndex,
        loss_streak: consecutiveLosses,
        timestamp: String(r.event_timestamp),
      });

      telemetryItems.push({
        trigger_id: `trig-${r.event_id}`,
        event_id: String(r.event_id),
        player_id: String(r.player_id),
        gamer_tag: gamerTag,
        dma_market: dmaMarket,
        myplayer_ovr: ovr,
        event_type: eventType,
        event_label: defaultDesc.label,
        consecutive_losses: consecutiveLosses,
        tilt_index: tiltIndex,
        offer_id: offer.id,
        offer_title: offer.title,
        price_usd: offer.price,
        discount_percent: offer.discount,
        timestamp: String(r.event_timestamp),
        reason,
      });

      activeStreams.push({
        playerId: String(r.player_id),
        offerId: offer.id,
        reason,
      });
    }

    return NextResponse.json({
      ok: true,
      stepIndex,
      currentTimestamp: batch[0]?.event_timestamp || new Date().toISOString(),
      batchEventsEvaluated: batch.length,
      triggers,
      telemetryItems,
      activeStreams,
      source: "live_spanner",
    });
  } catch (error: any) {
    console.error("[simulation-triggers] Route error:", error);
    if (error instanceof SpannerUnavailableError) {
      return NextResponse.json(
        { error: error.message, error_kind: "SPANNER_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Failed to query telemetry triggers" },
      { status: 500 }
    );
  }
}
