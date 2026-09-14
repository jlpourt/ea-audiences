"use client";

import React, { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { CohortContext } from "@/lib/types";
import { isWhaleArchetype } from "@/lib/archetypes";

interface OfferBattleArenaProps {
  cohortContext?: CohortContext | null;
  onSelectWinningOffer?: (title: string, spend: number) => void;
}

interface OfferVariant {
  id: string;
  name: string;
  price: number;
  perks: string[];
  conversionLift: number;
  churnMitigation: number;
  projectedRevenue: number;
  sentimentRisk: string;
  votes: Array<{
    persona: string;
    reason: string;
  }>;
}

/**
 * Offer matchups are drawn from the real ABK catalog in
 * `data/marketing_offers.json` — prices, currency names and pack contents are
 * the ones the store actually sells. Each franchise gets a whale matchup
 * (high-ticket vault / collector SKUs) and a mainstream matchup (retention and
 * entry-price SKUs), because the two audiences do not respond to the same ask.
 */
type Matchup = { a: OfferVariant; b: OfferVariant };

const MATCHUPS: Record<string, { whale: Matchup; core: Matchup }> = {
  COD: {
    whale: {
      a: {
        id: "A",
        name: "Season 1 BlackCell Battle Pass Bundle",
        price: 29.99,
        perks: ["Full BlackCell Sector unlock", "1,100 CP returned on completion", "20 Tier Skips + Operator skin"],
        conversionLift: 34.2,
        churnMitigation: 18.5,
        projectedRevenue: 420000,
        sentimentRisk: "5.2%",
        votes: [
          { persona: "BlackCell holder", reason: "Pass pays back its own CP. I buy this every season without thinking." },
          { persona: "Warzone regular", reason: "Tier skips matter more than the skin — I never finish the pass on time." },
        ],
      },
      b: {
        id: "B",
        name: "13,000 CoD Points Vault Bundle",
        price: 99.99,
        perks: ["13,000 CoD Points", "Best CP-per-dollar in the store", "Covers ~4 seasons of passes"],
        conversionLift: 22.1,
        churnMitigation: 12.0,
        projectedRevenue: 310000,
        sentimentRisk: "14.2%",
        votes: [
          { persona: "BlackCell holder", reason: "Good rate, but $100 up front with nothing to show for it today feels bad." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Gulag Loss-Streak Recovery Starter",
        price: 4.99,
        perks: ["Double XP token bundle", "Operator skin + weapon blueprint", "Delivered after a 3+ loss streak"],
        conversionLift: 28.4,
        churnMitigation: 26.2,
        projectedRevenue: 185000,
        sentimentRisk: "3.8%",
        votes: [
          { persona: "Tilted Resurgence player", reason: "After four straight Gulag losses, $4.99 to reset the night is an easy yes." },
          { persona: "Weeknight squad lead", reason: "Cheap enough that nobody in the party has to think about it." },
        ],
      },
      b: {
        id: "B",
        name: "Standard Seasonal Battle Pass (1,100 CP)",
        price: 9.99,
        perks: ["Full seasonal progression track", "1,100 CP earnable back", "No BlackCell sector"],
        conversionLift: 14.5,
        churnMitigation: 11.2,
        projectedRevenue: 130000,
        sentimentRisk: "12.4%",
        votes: [
          { persona: "Tilted Resurgence player", reason: "A pass doesn't fix tonight. It's a commitment, not a rescue." },
        ],
      },
    },
  },
  WOW: {
    whale: {
      a: {
        id: "A",
        name: "6-Month Recurring Subscription + Ethereal Mount",
        price: 77.94,
        perks: ["6 months of game time", "Exclusive Ethereal mount", "Locks in pre-increase rate"],
        conversionLift: 31.0,
        churnMitigation: 41.5,
        projectedRevenue: 390000,
        sentimentRisk: "6.1%",
        votes: [
          { persona: "Mount collector", reason: "The mount is sub-exclusive. That alone closes it." },
          { persona: "Returning raider", reason: "Six months is the right horizon — I'm back for the whole patch cycle." },
        ],
      },
      b: {
        id: "B",
        name: "Mythic Keystone Transmog Armor Bundle",
        price: 25.0,
        perks: ["Full transmog set", "Account-wide unlock", "No game time included"],
        conversionLift: 18.4,
        churnMitigation: 8.0,
        projectedRevenue: 210000,
        sentimentRisk: "16.0%",
        votes: [
          { persona: "Mount collector", reason: "Nice set, but transmog doesn't keep me subscribed past the patch." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "1-Month Game Time Subscription",
        price: 14.99,
        perks: ["30 days of game time", "No long-term commitment", "Ideal lapsed-player re-entry"],
        conversionLift: 26.0,
        churnMitigation: 29.8,
        projectedRevenue: 168000,
        sentimentRisk: "4.4%",
        votes: [
          { persona: "Lapsed subscriber", reason: "One month to see if the patch is worth it. Low risk." },
          { persona: "Casual guild member", reason: "My guild raids Tuesdays. I only need the one month." },
        ],
      },
      b: {
        id: "B",
        name: "Level 70 Enhanced Character Boost",
        price: 60.0,
        perks: ["Instant level 70", "Gear + gold starter package", "Skips the levelling curve"],
        conversionLift: 11.2,
        churnMitigation: 9.5,
        projectedRevenue: 122000,
        sentimentRisk: "22.0%",
        votes: [
          { persona: "Lapsed subscriber", reason: "$60 to skip the part I actually enjoy? No." },
        ],
      },
    },
  },
  DIABLO4: {
    whale: {
      a: {
        id: "A",
        name: "Diablo IV: Vessel of Hatred (Ultimate Edition)",
        price: 89.99,
        perks: ["Full expansion", "Cosmetic armor set + mount", "Battle pass + 20 tier skips included"],
        conversionLift: 33.5,
        churnMitigation: 22.0,
        projectedRevenue: 402000,
        sentimentRisk: "7.0%",
        votes: [
          { persona: "Sanctuary collector", reason: "The bundled pass and skips make the Ultimate tier the only rational buy." },
          { persona: "Season-one-day player", reason: "I'll buy the pass anyway — bundling it removes the second decision." },
        ],
      },
      b: {
        id: "B",
        name: "11,500 Platinum Treasury Vault",
        price: 99.99,
        perks: ["11,500 Platinum", "Best Platinum rate available", "Spend across future seasons"],
        conversionLift: 20.8,
        churnMitigation: 10.4,
        projectedRevenue: 298000,
        sentimentRisk: "15.5%",
        votes: [
          { persona: "Sanctuary collector", reason: "I'd rather hold Platinum than commit, but there's no content attached." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "The Pit Loss-Protection Elixir Starter",
        price: 4.99,
        perks: ["Elixir bundle for Pit runs", "Delivered after repeated Pit failures", "Consumable, no commitment"],
        conversionLift: 27.1,
        churnMitigation: 24.9,
        projectedRevenue: 176000,
        sentimentRisk: "4.0%",
        votes: [
          { persona: "Pit grinder", reason: "I'm one tier off my key. Five dollars to stop losing progress is fine." },
          { persona: "Seasonal casual", reason: "Consumable means no buyer's remorse next season." },
        ],
      },
      b: {
        id: "B",
        name: "Accelerated Seasonal Battle Pass + 20 Tier Skips",
        price: 24.99,
        perks: ["Premium seasonal track", "20 tier skips", "1,000 Platinum earnable back"],
        conversionLift: 15.9,
        churnMitigation: 13.0,
        projectedRevenue: 141000,
        sentimentRisk: "11.8%",
        votes: [
          { persona: "Pit grinder", reason: "Tier skips don't help with the thing I'm actually stuck on." },
        ],
      },
    },
  },
  OVERWATCH2: {
    whale: {
      a: {
        id: "A",
        name: "Mythic Prism 80-Pack (Mythic Weapon / Skin)",
        price: 39.99,
        perks: ["80 Mythic Prisms", "Unlocks one full Mythic at max tier", "Choice of weapon or hero skin"],
        conversionLift: 36.0,
        churnMitigation: 14.2,
        projectedRevenue: 355000,
        sentimentRisk: "8.5%",
        votes: [
          { persona: "Mythic collector", reason: "Prisms are the only route to the Mythic I want. Deterministic, so I buy." },
          { persona: "One-trick main", reason: "I'll pay for the skin on my hero. I ignore everything else in the shop." },
        ],
      },
      b: {
        id: "B",
        name: "10,000 (+1,600 Bonus) Overwatch Coins Vault",
        price: 99.99,
        perks: ["11,600 Overwatch Coins", "Best coin rate", "Spendable on any shop item"],
        conversionLift: 19.4,
        churnMitigation: 9.1,
        projectedRevenue: 288000,
        sentimentRisk: "17.9%",
        votes: [
          { persona: "Mythic collector", reason: "Coins don't buy Prisms. Wrong currency for what I want." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Competitive Starter Pack + 500 Coins",
        price: 4.99,
        perks: ["500 Overwatch Coins", "Starter cosmetic bundle", "Entry-price competitive promo"],
        conversionLift: 25.3,
        churnMitigation: 21.6,
        projectedRevenue: 149000,
        sentimentRisk: "5.0%",
        votes: [
          { persona: "Role queue regular", reason: "Five dollars to stop being the only default skin in the lobby." },
          { persona: "Arcade casual", reason: "Cheapest way in. I'm not committing to a season pass." },
        ],
      },
      b: {
        id: "B",
        name: "Season 12 Ultimate Battle Pass Bundle",
        price: 39.99,
        perks: ["Premium battle pass", "20 tier skips", "Bonus coins + legendary skin"],
        conversionLift: 13.7,
        churnMitigation: 12.4,
        projectedRevenue: 132000,
        sentimentRisk: "18.2%",
        votes: [
          { persona: "Arcade casual", reason: "$40 assumes I'll play every week this season. I won't." },
        ],
      },
    },
  },
  CANDYCRUSH: {
    whale: {
      a: {
        id: "A",
        name: "Mega Party Booster Super Pack (x20 Each)",
        price: 49.99,
        perks: ["20x of every booster", "Covers an entire event run", "No Gold Bar conversion needed"],
        conversionLift: 32.8,
        churnMitigation: 19.7,
        projectedRevenue: 268000,
        sentimentRisk: "6.8%",
        votes: [
          { persona: "Booster whale", reason: "Buying boosters directly is cheaper than converting Gold Bars. I always take this." },
          { persona: "Event completionist", reason: "Twenty of each is exactly one event's worth. Sized correctly." },
        ],
      },
      b: {
        id: "B",
        name: "1,000 Gold Bars Royal Vault",
        price: 99.99,
        perks: ["1,000 Gold Bars", "Best Gold Bar rate", "Flexible across lives and boosters"],
        conversionLift: 21.5,
        churnMitigation: 11.9,
        projectedRevenue: 231000,
        sentimentRisk: "13.4%",
        votes: [
          { persona: "Booster whale", reason: "Flexible, but I end up wasting bars on lives instead of the boosters I need." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Level 1500+ Sticky Level Rescue Bundle",
        price: 2.99,
        perks: ["Targeted booster set for hard levels", "Triggered after repeated failures", "Lowest price point in the store"],
        conversionLift: 29.6,
        churnMitigation: 31.2,
        projectedRevenue: 158000,
        sentimentRisk: "3.1%",
        votes: [
          { persona: "Stuck commuter", reason: "I've failed this level eleven times. Three dollars to move on, obviously." },
          { persona: "Daily session player", reason: "Under five dollars doesn't feel like a purchase decision." },
        ],
      },
      b: {
        id: "B",
        name: "24-Hour Unlimited Lives + 50 Gold Bars",
        price: 4.99,
        perks: ["Unlimited lives for 24 hours", "50 Gold Bars", "Best for long weekend sessions"],
        conversionLift: 17.2,
        churnMitigation: 15.8,
        projectedRevenue: 118000,
        sentimentRisk: "9.6%",
        votes: [
          { persona: "Stuck commuter", reason: "Unlimited lives just means failing the same level faster." },
        ],
      },
    },
  },
};

export default function OfferBattleArena({
  cohortContext,
  onSelectWinningOffer,
}: OfferBattleArenaProps) {
  const [selectedOffer, setSelectedOffer] = useState<"A" | "B">("A");

  // Whale detection reads the canonical registry — every franchise has its own
  // monetising archetype, so a single hardcoded string missed four of five.
  const isWhaleCohort = isWhaleArchetype(cohortContext?.dominantArchetype);

  const franchiseKey =
    cohortContext?.franchise && cohortContext.franchise !== "ALL"
      ? cohortContext.franchise
      : "COD";
  const matchups = MATCHUPS[franchiseKey] || MATCHUPS.COD;
  const { a: variantA, b: variantB } = isWhaleCohort ? matchups.whale : matchups.core;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Offer A */}
        <div
          onClick={() => setSelectedOffer("A")}
          className={`rounded-2xl border p-4 cursor-pointer transition-all ${
            selectedOffer === "A"
              ? "bg-white/10 border-white/40 shadow-xl"
              : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
          }`}
        >
          <div className="flex items-start justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider block">
                Offer A (Recommended)
              </span>
              <h4 className="font-semibold text-white text-sm mt-0.5">{variantA.name}</h4>
            </div>
            <span className="text-base font-bold text-white font-mono">${variantA.price.toFixed(2)}</span>
          </div>

          {/* Perks */}
          <div className="py-3 space-y-1.5 text-xs text-gray-300">
            {variantA.perks.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{p}</span>
              </div>
            ))}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-white/10 text-center">
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Lift</span>
              <span className="font-semibold text-emerald-400 text-xs">+{variantA.conversionLift}%</span>
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Churn</span>
              <span className="font-semibold text-cyan-400 text-xs">+{variantA.churnMitigation}%</span>
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Net Rev</span>
              <span className="font-semibold text-amber-300 text-xs">${(variantA.projectedRevenue / 1000).toFixed(0)}K</span>
            </div>
          </div>

          {/* Quotes */}
          <div className="space-y-2 pt-2">
            {variantA.votes.map((v, idx) => (
              <div key={idx} className="text-[11px] text-gray-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
                <strong className="text-white mr-1">{v.persona}:</strong>
                <span className="text-gray-400">&ldquo;{v.reason}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>

        {/* Offer B */}
        <div
          onClick={() => setSelectedOffer("B")}
          className={`rounded-2xl border p-4 cursor-pointer transition-all ${
            selectedOffer === "B"
              ? "bg-white/10 border-white/40 shadow-xl"
              : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
          }`}
        >
          <div className="flex items-start justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider block">
                Offer B (Alternative)
              </span>
              <h4 className="font-semibold text-white text-sm mt-0.5">{variantB.name}</h4>
            </div>
            <span className="text-base font-bold text-white font-mono">${variantB.price.toFixed(2)}</span>
          </div>

          {/* Perks */}
          <div className="py-3 space-y-1.5 text-xs text-gray-300">
            {variantB.perks.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-gray-400" />
                <span>{p}</span>
              </div>
            ))}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-white/10 text-center">
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Lift</span>
              <span className="font-semibold text-gray-300 text-xs">+{variantB.conversionLift}%</span>
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Churn</span>
              <span className="font-semibold text-gray-300 text-xs">+{variantB.churnMitigation}%</span>
            </div>
            <div className="p-2 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-gray-500 block uppercase">Net Rev</span>
              <span className="font-semibold text-amber-300 text-xs">${(variantB.projectedRevenue / 1000).toFixed(0)}K</span>
            </div>
          </div>

          {/* Quotes */}
          <div className="space-y-2 pt-2">
            {variantB.votes.map((v, idx) => (
              <div key={idx} className="text-[11px] text-gray-300 bg-black/40 p-2.5 rounded-xl border border-white/5">
                <strong className="text-white mr-1">{v.persona}:</strong>
                <span className="text-gray-400">&ldquo;{v.reason}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Select Winning Action */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">
          Selected: <strong className="text-white">{selectedOffer === "A" ? variantA.name : variantB.name}</strong>
        </span>

        <button
          onClick={() => {
            const v = selectedOffer === "A" ? variantA : variantB;
            onSelectWinningOffer?.(v.name, v.projectedRevenue);
          }}
          className="px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold transition-all"
        >
          Adopt Selected Offer {selectedOffer}
        </button>
      </div>
    </div>
  );
}
