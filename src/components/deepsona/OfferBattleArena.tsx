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
        name: "BlackCell Battle Pass Bundle",
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
  WARZONE: {
    whale: {
      a: {
        id: "A",
        name: "Season 6 BlackCell Battle Pass Bundle",
        price: 29.99,
        perks: ["Full BlackCell Sector unlock", "1,100 CP returned on completion", "20 Tier Skips + Reactive Operator skin"],
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
        name: "Rebirth Island Resurgence Squad Recovery Drop",
        price: 9.99,
        perks: ["1,100 CP included", "Kar98k nostalgic blueprint", "4x squad 2XP tokens"],
        conversionLift: 16.5,
        churnMitigation: 14.2,
        projectedRevenue: 145000,
        sentimentRisk: "8.4%",
        votes: [
          { persona: "Tilted Resurgence player", reason: "1,100 CP gives me flexibility to pick my own store camo." },
        ],
      },
    },
  },
  BLACK_OPS: {
    whale: {
      a: {
        id: "A",
        name: "Black Ops 7 Vault Edition Upgrade",
        price: 29.99,
        perks: ["Hunters vs Hunted Operator Pack", "Mastercraft Weapon Collection", "Season 1 BlackCell included"],
        conversionLift: 36.8,
        churnMitigation: 22.4,
        projectedRevenue: 445000,
        sentimentRisk: "4.8%",
        votes: [
          { persona: "BlackCell whale", reason: "Mastercraft collection and instant BlackCell pass make this the premier upgrade." },
          { persona: "Zombies slayer", reason: "The bundled GobbleGums make high-round Easter Egg hunting much easier." },
        ],
      },
      b: {
        id: "B",
        name: "Mastercraft Weapon Blueprint Collection",
        price: 24.99,
        perks: ["Custom inspection animations", "Tracer rounds + death effects", "No BlackCell sector"],
        conversionLift: 20.4,
        churnMitigation: 11.2,
        projectedRevenue: 280000,
        sentimentRisk: "12.0%",
        votes: [
          { persona: "BlackCell whale", reason: "Cool blueprints, but without the BlackCell sector I'd rather buy the Vault Edition." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Zombies GobbleGum Ultra Mega Pack",
        price: 9.99,
        perks: ["15x Ultra-Rare GobbleGums (Perkaholic, Reign Drops)", "Instant delivery for Terminus & Liberty Falls", "Main Quest boss fight advantage"],
        conversionLift: 31.8,
        churnMitigation: 28.5,
        projectedRevenue: 198000,
        sentimentRisk: "4.2%",
        votes: [
          { persona: "Zombies slayer", reason: "Perkaholic on spawn lets our squad complete the Easter Egg in half the time." },
          { persona: "Casual co-op player", reason: "Ten bucks for a weekend of guaranteed high-round fun is an easy buy." },
        ],
      },
      b: {
        id: "B",
        name: "Standard Seasonal Battle Pass (1,100 CP)",
        price: 9.99,
        perks: ["Full seasonal progression track", "1,100 CP earnable back", "No GobbleGums included"],
        conversionLift: 15.2,
        churnMitigation: 12.0,
        projectedRevenue: 135000,
        sentimentRisk: "10.5%",
        votes: [
          { persona: "Zombies slayer", reason: "Battle pass cosmetics don't help survive round 40 on Terminus." },
        ],
      },
    },
  },
  MODERN_WARFARE: {
    whale: {
      a: {
        id: "A",
        name: "Mastercraft Tracer Pack: Celestial Dragon",
        price: 24.99,
        perks: ["Animated dragon inspection", "Celestial tracers on MCW & Rival-9", "Dismemberment death effect"],
        conversionLift: 33.0,
        churnMitigation: 19.5,
        projectedRevenue: 380000,
        sentimentRisk: "6.0%",
        votes: [
          { persona: "Camo completionist", reason: "The animated dragon inspection while inspecting Interstellar looks unbelievable." },
          { persona: "S&D clutch player", reason: "Death effects demoralize the other team after a round 11 ninja defuse." },
        ],
      },
      b: {
        id: "B",
        name: "5,000 (+800 Bonus) CoD Points Tactical Pack",
        price: 39.99,
        perks: ["5,800 CoD Points", "Sufficient for 2 full mastercraft bundles", "Bonus currency tier"],
        conversionLift: 21.0,
        churnMitigation: 10.8,
        projectedRevenue: 295000,
        sentimentRisk: "13.5%",
        votes: [
          { persona: "Camo completionist", reason: "I only buy points when there's an actual bundle I want in the shop." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Search & Destroy Clutch Pro Bundle",
        price: 19.99,
        perks: ["2,400 CP included (100% rebate value)", "Stealth operator skin", "Silenced sniper blueprint + defuse animation"],
        conversionLift: 29.7,
        churnMitigation: 25.1,
        projectedRevenue: 215000,
        sentimentRisk: "3.5%",
        votes: [
          { persona: "S&D clutch player", reason: "It gives 2,400 CP back, so the operator and sniper blueprint are basically free." },
          { persona: "Casual pub stomper", reason: "Pro packs that refund their cost in CP are the only things worth buying." },
        ],
      },
      b: {
        id: "B",
        name: "Standard Seasonal Battle Pass (1,100 CP)",
        price: 9.99,
        perks: ["Base 100-tier progression", "1,100 CP returned", "No pro pack operator skin"],
        conversionLift: 14.8,
        churnMitigation: 11.0,
        projectedRevenue: 125000,
        sentimentRisk: "9.8%",
        votes: [
          { persona: "S&D clutch player", reason: "Pro pack is way better value because it includes 2,400 CP." },
        ],
      },
    },
  },
  CDL_RANKED: {
    whale: {
      a: {
        id: "A",
        name: "CDL Championship OpTic Texas Supporter Pack",
        price: 9.99,
        perks: ["Home & away CDL operator uniforms", "OpTic Green Wall weapon camo & charm", "Tournament calling card & emblem"],
        conversionLift: 38.6,
        churnMitigation: 32.0,
        projectedRevenue: 340000,
        sentimentRisk: "3.1%",
        votes: [
          { persona: "CDL sweat", reason: "Green Wall pride in ranked play. Everyone in Crimson wears team camos." },
          { persona: "The Flank listener", reason: "Supporting the esport directly through team rev-share is a no-brainer." },
        ],
      },
      b: {
        id: "B",
        name: "CDL Atlanta FaZe Championship Supporter Pack",
        price: 9.99,
        perks: ["Home & away FaZe uniforms", "FaZe Clan red/black camo & charm", "FaZe tournament emblem"],
        conversionLift: 36.1,
        churnMitigation: 29.4,
        projectedRevenue: 325000,
        sentimentRisk: "3.4%",
        votes: [
          { persona: "CDL sweat", reason: "FaZe red/black looks lethal with the MCW. Essential for ranked Hardpoint." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Ranked Play Demotion Recovery Pack",
        price: 4.99,
        perks: ["Instant 500 CoD Points", "1-Hour Double Weapon XP", "Ranked Veteran calling card"],
        conversionLift: 32.4,
        churnMitigation: 30.5,
        projectedRevenue: 175000,
        sentimentRisk: "3.2%",
        votes: [
          { persona: "CDL sweat", reason: "After getting demoted from Crimson, this resets the tilt and gets me back in queue." },
          { persona: "Ranked grinder", reason: "Five bucks to take the edge off an SR loss streak." },
        ],
      },
      b: {
        id: "B",
        name: "Standard Seasonal Battle Pass",
        price: 9.99,
        perks: ["100-tier progression", "1,100 CP returned", "No ranked-specific items"],
        conversionLift: 13.5,
        churnMitigation: 10.2,
        projectedRevenue: 110000,
        sentimentRisk: "11.2%",
        votes: [
          { persona: "CDL sweat", reason: "Ranked players care about SR and camos, not battle pass filler." },
        ],
      },
    },
  },
  COD_MOBILE: {
    whale: {
      a: {
        id: "A",
        name: "CoD Mobile Mythic Weapon Drop: Grau 5.56 Phantom",
        price: 29.99,
        perks: ["Full Mythic weapon shroud", "Custom muzzle flash & inspection animation", "Dynamic kill counter"],
        conversionLift: 31.5,
        churnMitigation: 24.0,
        projectedRevenue: 360000,
        sentimentRisk: "5.8%",
        votes: [
          { persona: "Mobile whale", reason: "The Mythic Grau 5.56 is the cleanly designed weapon in mobile FPS history." },
          { persona: "Touch claw prodigy", reason: "Custom iron sights provide an undeniable visibility advantage on iPad." },
        ],
      },
      b: {
        id: "B",
        name: "10,000 CP Mobile Treasury Vault",
        price: 79.99,
        perks: ["10,000 CoD Points", "Discounted CP rate", "Spend across lucky draws"],
        conversionLift: 19.8,
        churnMitigation: 11.5,
        projectedRevenue: 270000,
        sentimentRisk: "14.0%",
        votes: [
          { persona: "Mobile whale", reason: "I prefer buying the lucky draw directly rather than hoarding CP." },
        ],
      },
    },
    core: {
      a: {
        id: "A",
        name: "Mobile Battle Pass Premium",
        price: 9.99,
        perks: ["50-tier mobile progression", "All CP refunded on completion", "4 exclusive mobile operators"],
        conversionLift: 28.5,
        churnMitigation: 26.8,
        projectedRevenue: 195000,
        sentimentRisk: "2.9%",
        votes: [
          { persona: "Touch claw prodigy", reason: "The mobile pass is easy to finish and pays for itself every month." },
          { persona: "Casual mobile player", reason: "Best value in the game by far." },
        ],
      },
      b: {
        id: "B",
        name: "Mobile Starter Claw Pack",
        price: 2.99,
        perks: ["300 CP", "Epic weapon blueprint", "3-day XP boost"],
        conversionLift: 18.2,
        churnMitigation: 14.0,
        projectedRevenue: 105000,
        sentimentRisk: "4.5%",
        votes: [
          { persona: "Casual mobile player", reason: "Cheap enough to buy on impulse." },
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
