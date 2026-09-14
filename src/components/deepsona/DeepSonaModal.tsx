"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ArrowRight, Sparkles, Send, Check, Users, MessageSquare, Target, SlidersHorizontal, Loader2 } from "lucide-react";
import { DeepSonaResult, GraphNode, GraphData, CohortContext, GameFranchise } from "@/lib/types";
import LiftScoreGauge from "./LiftScoreGauge";
import FUTPersonaCard, { PersonaProfile } from "./FUTPersonaCard";
import CommunityDebateSimulator from "./CommunityDebateSimulator";
import ConversionScoringMatrix from "./ConversionScoringMatrix";
import SensitivitySimulator from "./SensitivitySimulator";

interface DeepSonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: GraphNode | null;
  cohortContext?: CohortContext | null;
  selectedGame?: GameFranchise;
  graphData?: GraphData | null;
  initialResult?: DeepSonaResult | null;
  initialCreativeTitle?: string;
  initialFranchise?: string;
  isGeneratingBrief?: boolean;
  onGenerateBrief: (result: DeepSonaResult) => void;
}

type DeepSonaTab = "personas" | "community_debate" | "conversion_scoring" | "sensitivity";

function generateDynamicQuote(
  node: GraphNode,
  activeGame: string,
  slotIndex: number,
  reactionQuote?: string
): string {
  if (reactionQuote && reactionQuote.length > 15 && !reactionQuote.includes("...")) {
    return reactionQuote;
  }

  const rawFranchise = (node.franchise || activeGame || "COD").toUpperCase();
  const isCOD = rawFranchise.includes("COD") || rawFranchise.includes("CALL OF DUTY") || rawFranchise.includes("WARZONE");
  const isWOW = rawFranchise.includes("WOW") || rawFranchise.includes("WARCRAFT");
  const isDiablo = rawFranchise.includes("DIABLO");
  const isCandy = rawFranchise.includes("CANDY");
  const isOW = rawFranchise.includes("OVERWATCH") || rawFranchise.includes("OW");

  const spend = node.spend !== undefined && node.spend > 0 ? node.spend : slotIndex === 1 ? 4200 : slotIndex === 0 ? 450 : slotIndex === 2 ? 140 : 40;
  const lossStreak = node.loss_streak !== undefined && node.loss_streak > 0 ? node.loss_streak : slotIndex === 0 ? 3 : 1;
  const tilt = Math.round((node.tilt !== undefined ? node.tilt : slotIndex === 0 ? 0.85 : slotIndex === 1 ? 0.15 : slotIndex === 2 ? 0.35 : 0.20) * 100);
  const formattedSpend = `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Slot 0: Frustrated Competitive Sweats (Loss Streak / Defeat Trigger)
  if (slotIndex === 0) {
    if (isCOD) {
      return `After getting eliminated in the Gulag ${lossStreak} matches in a row (tilt at ${tilt}%), grabbing the $9.99 BlackCell starter reload on the defeat screen gets me right back into Resurgence.`;
    } else if (isWOW) {
      return `Wiping on Mythic Queen Ansurak ${lossStreak} pulls in a row (${tilt}% tilt). A 30-day token or mount voucher softens the burn so our guild can regroup.`;
    } else if (isDiablo) {
      return `Got one-shot by the Pit tier 85 boss (${lossStreak} wipe slump, ${tilt}% tilt). A $19.99 Infernal Relic Cache with masterworking mats gives the stat push needed to clear.`;
    } else if (isCandy) {
      return `Failed level 540 with 1 jelly remaining 3 times in a row. A $1.99 50 Gold Bars booster pack lets me clear the level and keep my streak.`;
    } else {
      return `Suffered ${lossStreak} straight rank demotion losses in competitive role queue (${tilt}% tilt). A Mythic Prisms reload keeps morale high.`;
    }
  }

  // Slot 1: High-LTV Whales & Collection Event Hunters (Big Spenders)
  if (slotIndex === 1) {
    if (isCOD) {
      return `I've invested ${formattedSpend} into Call of Duty. Every seasonal launch I buy the $29.99 BlackCell Vault bundle with 20 tier skips and animated operator camos instantly.`;
    } else if (isWOW) {
      return `20-year WoW veteran with ${formattedSpend} lifetime account value. The 12-Month Subscription bundle with 4 exclusive mounts and collector pets is an automatic renewal.`;
    } else if (isDiablo) {
      return `Sanctuary Whale with ${formattedSpend} invested. The Vessel of Hatred Ultimate Edition with wings, town portal animations, and platinum is mandatory for my collection.`;
    } else if (isCandy) {
      return `Lifetime spend of ${formattedSpend} on boosters and extra moves. When I'm in the top 1% weekly leaderboard, I stock up on Gold Bars and Color Bombs.`;
    } else {
      return `Invested ${formattedSpend} on Overwatch cosmetics. Whenever a new Mythic Skin releases, I unlock all 4 color variants and custom voice lines immediately.`;
    }
  }

  // Slot 2: Squad Co-op / Socializers (Team Play & Group Passes)
  if (slotIndex === 2) {
    if (isCOD) {
      return `Our 4-stack drops into Warzone Resurgence every Friday night. Clan XP boosts and weapon blueprint bundles are things our whole squad buys together.`;
    } else if (isWOW) {
      return `Guild officer for a 20-player Mythic raiding roster. Guild vault cauldrons and feast vouchers under $15 save our officers hundreds of hours of prep.`;
    } else if (isDiablo) {
      return `We run 4-player Torment IV Infernal Hordes together every weekend. Infernal Compass keys provide massive group loot efficiency under $10.`;
    } else if (isCandy) {
      return `I trade lives daily with my social team. Group milestone booster packs keep our team at the top of the leaderboard.`;
    } else {
      return `Our 5-stack queues Competitive every weekend. Team battle pass XP boost passes give great squad progression under $10.`;
    }
  }

  // Slot 3: Value Optimizers & Casual Story Purists (Price-Conscious / Franchise Purist)
  if (isCOD) {
    return `I usually stick to free Warzone, but a $9.99 starter pack with an operator skin and CP coins is fair value that avoids store clutter.`;
  } else if (isWOW) {
    return `Casual subscriber who plays for the lore and expansion campaign. 6-Month subscription bundles with bonus mounts provide great long-term value.`;
  } else if (isDiablo) {
    return `Solo seasonal campaign grinder. Cosmetic battle passes under $10 give solid dark fantasy visual upgrades without pay-to-win.`;
  } else if (isCandy) {
    return `Casual commuter playing on the subway. 99¢ booster reloads for sticky levels keep the game fun without overspending.`;
  } else {
    return `Casual arcade player with limited gaming time. Starter skin packs under $10 give clean visual identity without pressure.`;
  }
}

export default function DeepSonaModal({
  isOpen,
  onClose,
  targetNode,
  cohortContext,
  selectedGame = "ALL",
  graphData,
  initialResult,
  initialCreativeTitle,
  initialFranchise,
  isGeneratingBrief = false,
  onGenerateBrief,
}: DeepSonaModalProps) {
  const [activeTab, setActiveTab] = useState<DeepSonaTab>("personas");
  const [creativeTitle, setCreativeTitle] = useState(
    initialCreativeTitle || "Contextual Marketing & Retention Intervention"
  );
  const [franchise, setFranchise] = useState(initialFranchise || "Activision Blizzard King");
  const [proposedSpend, setProposedSpend] = useState(120000);
  const [targetRoas, setTargetRoas] = useState(2.45);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DeepSonaResult | null>(initialResult || null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaProfile | null>(null);

  // Debate Stream State
  const [debatePrompt, setDebatePrompt] = useState("");
  const [isDebating, setIsDebating] = useState(false);
  const [debateMessages, setDebateMessages] = useState<
    Array<{ id: string; sender: string; role: string; text: string; wtp: number; fsm: string }>
  >([]);

  // Dynamically Grounded Personas Based on the Selected Game and Cohort (Driven by Active Graph Group)
  const groundedPersonas: PersonaProfile[] = useMemo(() => {
    const game = (targetNode?.franchise || cohortContext?.franchise || selectedGame || "ALL") as GameFranchise;
    const rawPlayerNodes = graphData?.nodes?.filter((n) => n.type === "PLAYER") || [];
    const playerNodes = rawPlayerNodes.filter((n) =>
      game === "ALL" ||
      n.franchise === game ||
      (n.franchise || "").toUpperCase().includes(game === "COD" ? "COD" : game)
    );
    const arch = cohortContext?.dominantArchetype || targetNode?.archetype || "COMPETITIVE_GRINDER";
    const q = cohortContext?.query?.toLowerCase() || "";

    // 1. If we have actual real player nodes in the active graph slice, sample 4 diverse archetypes from the current graph group!
    if (playerNodes.length >= 4) {
      const competitiveCandidates = playerNodes.filter(
        (n) =>
          (n.loss_streak || 0) >= 2 ||
          (n.tilt || 0) >= 0.6 ||
          (n.archetype || "").includes("SWEAT") ||
          (n.archetype || "").includes("COMPETITIVE")
      );
      const whaleCandidates = [...playerNodes].sort((a, b) => (b.spend || 0) - (a.spend || 0));
      const socialCandidates = playerNodes.filter(
        (n) =>
          (n.archetype || "").includes("SOCIAL") ||
          (n.archetype || "").includes("SQUAD") ||
          (n.archetype || "").includes("CONQUEST") ||
          (n.archetype || "").includes("PREMADE")
      );
      const casualCandidates = [...playerNodes].sort((a, b) => (a.spend || 0) - (b.spend || 0));

      const pickedNodes: GraphNode[] = [];

      // Slot 0: Competitive / Target Node
      if (targetNode && targetNode.type === "PLAYER") {
        pickedNodes.push(targetNode);
      } else {
        pickedNodes.push(competitiveCandidates[0] || playerNodes[0]);
      }

      // Slot 1: Whale (High Spend)
      const whaleNode =
        whaleCandidates.find((n) => !pickedNodes.some((p) => p.id === n.id)) ||
        playerNodes[1 % playerNodes.length];
      pickedNodes.push(whaleNode);

      // Slot 2: Social / Co-op
      const socialNode =
        socialCandidates.find((n) => !pickedNodes.some((p) => p.id === n.id)) ||
        playerNodes[2 % playerNodes.length];
      pickedNodes.push(socialNode);

      // Slot 3: Casual / Story Purist
      const casualNode =
        casualCandidates.find((n) => !pickedNodes.some((p) => p.id === n.id)) ||
        playerNodes[3 % playerNodes.length];
      pickedNodes.push(casualNode);

      const sampled: PersonaProfile[] = pickedNodes.map((node, slotIdx) => {
        const liveReaction = result?.reactions?.[slotIdx];
        const spend =
          node.spend !== undefined && node.spend > 0
            ? node.spend
            : slotIdx === 1
            ? 850
            : slotIdx === 0
            ? 320
            : slotIdx === 2
            ? 140
            : 40;
        const tilt = Math.round(
          (node.tilt !== undefined
            ? node.tilt
            : slotIdx === 0
            ? 0.88
            : slotIdx === 1
            ? 0.15
            : slotIdx === 2
            ? 0.35
            : 0.2) * 100
        );
        const lossStreak =
          node.loss_streak !== undefined
            ? node.loss_streak
            : slotIdx === 0
            ? 3
            : slotIdx === 1
            ? 0
            : slotIdx === 2
            ? 1
            : 0;

        const nodeFranchise = (node.franchise || game || "COD").toUpperCase();
        const isCOD = nodeFranchise.includes("COD") || nodeFranchise.includes("CALL OF DUTY") || nodeFranchise.includes("WARZONE");
        const isWOW = nodeFranchise.includes("WOW") || nodeFranchise.includes("WARCRAFT");
        const isDiablo = nodeFranchise.includes("DIABLO");
        const isCandy = nodeFranchise.includes("CANDY");
        const isOW = nodeFranchise.includes("OVERWATCH") || nodeFranchise.includes("OW");

        let pArch =
          slotIdx === 0
            ? "COMPETITIVE_GRINDER"
            : slotIdx === 1
            ? "BLACKCELL_WHALE"
            : slotIdx === 2
            ? "CASUAL_SOCIALIZER"
            : "LORE_SEEKER";

        if (isWOW) {
          pArch =
            slotIdx === 0
              ? "MYTHIC_RAIDER"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "LORE_SEEKER";
        } else if (isDiablo) {
          pArch =
            slotIdx === 0
              ? "SANCTUARY_COLLECTOR"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "LORE_SEEKER";
        } else if (isCandy) {
          pArch =
            slotIdx === 0
              ? "BOOSTER_WHALE"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "COMPETITIVE_GRINDER";
        } else if (isOW) {
          pArch =
            slotIdx === 0
              ? "COMPETITIVE_GRINDER"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "CASUAL_WARRIOR";
        }

        const cardTier: PersonaProfile["cardTier"] =
          slotIdx === 1 ? "ICON" : slotIdx === 0 ? "GOLD_RARE" : slotIdx === 2 ? "HERO" : "MANAGER";
        const ovrRating = slotIdx === 1 ? 98 : slotIdx === 0 ? 94 : slotIdx === 2 ? 89 : 85;

        const wtp =
          liveReaction?.willingness_to_pay_usd !== undefined
            ? liveReaction.willingness_to_pay_usd
            : slotIdx === 1
            ? spend >= 2000
              ? 99.99
              : 49.99
            : slotIdx === 0
            ? 4.99
            : slotIdx === 2
            ? 9.99
            : 0.0;

        const fsmState =
          liveReaction?.final_fsm_state || (wtp > 0 ? "PURCHASED" : "ENGAGED_FREE");

        const franchiseName = isCOD
          ? "Call of Duty: Warzone"
          : isWOW
          ? "World of Warcraft"
          : isDiablo
          ? "Diablo IV"
          : isCandy
          ? "Candy Crush Saga"
          : "Overwatch 2";

        const division =
          slotIdx === 0
            ? `${franchiseName} • ${isCOD ? "BO6 Iridescent (Rank 1)" : isWOW ? "Mythic+ Title (3,200 IO)" : isDiablo ? "The Pit Tier 100" : isCandy ? "Level 5,000+ Master" : "Grandmaster 1"}`
            : slotIdx === 1
            ? `${franchiseName} • ${isCOD ? "BlackCell Vault Whale" : isWOW ? "20-Year Collector ($4k+)" : isDiablo ? "Sanctuary Ultimate Collector" : isCandy ? "VIP Booster Whale" : "Mythic Prism Collector"}`
            : slotIdx === 2
            ? `${franchiseName} • ${isCOD ? "Resurgence Quad Captain" : isWOW ? "Mythic Raid Guild Master" : isDiablo ? "Infernal Horde 4-Stack" : isCandy ? "Daily Commuter Social" : "Role Queue 5-Stack Lead"}`
            : `${franchiseName} • ${isCOD ? "Campaign Purist" : isWOW ? "Casual Lore Explorer" : isDiablo ? "Solo Seasonal Purist" : isCandy ? "Subway Commuter" : "Arcade Casual"}`;

        return {
          id: node.id,
          name: node.name,
          gamerTag: node.name,
          archetype: pArch,
          cardTier,
          ovrRating,
          division,
          matchesPlayed: Math.floor(200 + spend * 1.5),
          spendLtv: spend,
          tiltLevel: tilt,
          wtp,
          fsmState,
          recentLossStreak: lossStreak,
          quote: generateDynamicQuote(node, node.franchise || game, slotIdx, liveReaction?.verbatim_quote),
        };
      });

      return sampled;
    }

    // 2. CALL OF DUTY PERSONAS FALLBACK
    if (game === "COD" || q.includes("cod") || q.includes("warzone") || q.includes("resurgence") || q.includes("gulag")) {
      return [
        {
          id: "COD_WarzoneSweat_94",
          name: "Marcus 'Ghost' Vance",
          gamerTag: "Ghost_Resurgence_94",
          archetype: "COMPETITIVE_GRINDER",
          cardTier: "GOLD_RARE",
          ovrRating: 94,
          division: "Call of Duty • BO6 Iridescent (Rank 1)",
          matchesPlayed: 1450,
          spendLtv: 480.0,
          tiltLevel: 88,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "After getting eliminated in the Gulag 3 matches in a row, grabbing the $9.99 BlackCell starter reload with 1,100 CP coins gets me right back into Resurgence squads.",
        },
        {
          id: "BlackCell_Whale_01",
          name: "Alexander 'Vault' Price",
          gamerTag: "BlackCell_Whale_01",
          archetype: "BLACKCELL_WHALE",
          cardTier: "ICON",
          ovrRating: 98,
          division: "Call of Duty • BlackCell Vault Collector ($3.5k+)",
          matchesPlayed: 2100,
          spendLtv: 3800.0,
          tiltLevel: 12,
          wtp: 29.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Guaranteed mastercraft weapon blueprint and animated operator camos with 2,400 CP Coins? That's an immediate reload for my seasonal vault.",
        },
        {
          id: "Resurgence_Captain_10",
          name: "Liam 'Squad' Miller",
          gamerTag: "Resurgence_Captain_10",
          archetype: "CASUAL_SOCIALIZER",
          cardTier: "HERO",
          ovrRating: 91,
          division: "Call of Duty • Resurgence Quad Captain",
          matchesPlayed: 620,
          spendLtv: 140.0,
          tiltLevel: 28,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our whole 4-player Resurgence quad logs in Friday night. The Clan 2x Weapon XP Pass was bought by all 4 of us immediately.",
        },
        {
          id: "Campaign_Purist_Echo",
          name: "David 'Bravo' Chen",
          gamerTag: "Campaign_Purist_Echo",
          archetype: "LORE_SEEKER",
          cardTier: "MANAGER",
          ovrRating: 86,
          division: "Call of Duty • Campaign & Solo Purist",
          matchesPlayed: 340,
          spendLtv: 70.0,
          tiltLevel: 10,
          wtp: 0.0,
          fsmState: "ENGAGED_FREE",
          recentLossStreak: 0,
          quote: "As long as weapons stay balanced and narrative modes don't get paywalled, I support the seasonal liveops.",
        },
      ];
    }

    // 3. WORLD OF WARCRAFT PERSONAS FALLBACK
    else if (game === "WOW" || q.includes("wow") || q.includes("warcraft") || q.includes("raid") || q.includes("mythic")) {
      return [
        {
          id: "Mythic_Raider_Ansurak",
          name: "Theron 'Void' Sunstrider",
          gamerTag: "Void_Raider_Ansurak",
          archetype: "MYTHIC_RAIDER",
          cardTier: "GOLD_RARE",
          ovrRating: 94,
          division: "World of Warcraft • Mythic+ Title (3,200 IO)",
          matchesPlayed: 1800,
          spendLtv: 620.0,
          tiltLevel: 85,
          wtp: 14.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Wiping on Mythic raid bosses 3 times in a row tests team morale. A 30-day token or feast pack softens the grind for our guild.",
        },
        {
          id: "WoW_20Year_Whale",
          name: "Thorvald 'Aman' Proudmoore",
          gamerTag: "Aman_Collector_Whale",
          archetype: "BLACKCELL_WHALE",
          cardTier: "ICON",
          ovrRating: 99,
          division: "World of Warcraft • 20-Year Collector ($4k+)",
          matchesPlayed: 5200,
          spendLtv: 4500.0,
          tiltLevel: 8,
          wtp: 77.94,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "12-Month Subscription bundle with 4 exclusive mounts and collector pets is an automatic renewal for my 20-year account.",
        },
        {
          id: "Guild_Master_Elysium",
          name: "Victoria 'Valk' Sterling",
          gamerTag: "Elysium_Guild_Lead",
          archetype: "CASUAL_SOCIALIZER",
          cardTier: "HERO",
          ovrRating: 92,
          division: "World of Warcraft • Mythic Raid Guild Master",
          matchesPlayed: 2400,
          spendLtv: 340.0,
          tiltLevel: 25,
          wtp: 14.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Guild cauldron vouchers and group repair discounts save our officers hundreds of hours of gold farming every tier.",
        },
        {
          id: "Azeroth_Lore_Explorer",
          name: "Sean 'Lore' Walker",
          gamerTag: "Azeroth_Lore_Explorer",
          archetype: "LORE_SEEKER",
          cardTier: "MANAGER",
          ovrRating: 88,
          division: "World of Warcraft • Lore & Quest Purist",
          matchesPlayed: 890,
          spendLtv: 180.0,
          tiltLevel: 10,
          wtp: 14.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "I play through every expansion campaign for the world storytelling. The 6-Month sub with bonus mount is solid value.",
        },
      ];
    }

    // 4. DIABLO IV PERSONAS FALLBACK
    else if (game === "DIABLO4" || q.includes("diablo") || q.includes("pit") || q.includes("sanctuary")) {
      return [
        {
          id: "Pit_Grinder_Tier90",
          name: "Kaelen 'Bane' Cross",
          gamerTag: "Pit_Master_Bane",
          archetype: "SANCTUARY_COLLECTOR",
          cardTier: "GOLD_RARE",
          ovrRating: 94,
          division: "Diablo IV • The Pit Tier 100 Grinder",
          matchesPlayed: 1200,
          spendLtv: 380.0,
          tiltLevel: 84,
          wtp: 19.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Got one-shot by the Pit tier 85 boss 3 runs in a row. An Infernal Relic Cache with masterworking obducite gives the stat push to clear.",
        },
        {
          id: "Sanctuary_Whale_Deluxe",
          name: "Lilith 'Inarius' Thorne",
          gamerTag: "Sanctuary_Whale_Prime",
          archetype: "BLACKCELL_WHALE",
          cardTier: "ICON",
          ovrRating: 98,
          division: "Diablo IV • Sanctuary Deluxe Collector",
          matchesPlayed: 1950,
          spendLtv: 2800.0,
          tiltLevel: 15,
          wtp: 59.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Vessel of Hatred Ultimate Edition with wings, town portal animations, and 3,000 Platinum was an immediate pre-order.",
        },
        {
          id: "Horde_4Stack_Leader",
          name: "Darius 'Hammer' Stone",
          gamerTag: "Infernal_Horde_Stack",
          archetype: "CASUAL_SOCIALIZER",
          cardTier: "HERO",
          ovrRating: 90,
          division: "Diablo IV • Torment IV 4-Stack Lead",
          matchesPlayed: 650,
          spendLtv: 160.0,
          tiltLevel: 20,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our 4-player party runs Torment Hordes every Friday. Infernal Compass keys and party loot boosts give huge group efficiency.",
        },
        {
          id: "Solo_Seasonal_Purist",
          name: "Elena 'Rogue' Frost",
          gamerTag: "Solo_Seasonal_Purist",
          archetype: "LORE_SEEKER",
          cardTier: "MANAGER",
          ovrRating: 87,
          division: "Diablo IV • Solo Seasonal Purist",
          matchesPlayed: 480,
          spendLtv: 70.0,
          tiltLevel: 10,
          wtp: 0.0,
          fsmState: "ENGAGED_FREE",
          recentLossStreak: 0,
          quote: "As long as the battle pass remains cosmetic-only and season mechanics are free, I enjoy clearing the seasonal journey.",
        },
      ];
    }

    // 5. OVERWATCH 2 PERSONAS FALLBACK
    else if (game === "OVERWATCH2" || q.includes("overwatch") || q.includes("ow2")) {
      return [
        {
          id: "OW2_Top500_Tracer",
          name: "Maya 'Blink' Lin",
          gamerTag: "Tracer_Top500_Pulse",
          archetype: "COMPETITIVE_GRINDER",
          cardTier: "GOLD_RARE",
          ovrRating: 95,
          division: "Overwatch 2 • Top 500 Grandmaster",
          matchesPlayed: 2100,
          spendLtv: 520.0,
          tiltLevel: 86,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "After 3 straight rank demotion losses in competitive role queue, a Mythic Prisms reload keeps morale high.",
        },
        {
          id: "Mythic_Prism_Whale",
          name: "Austin 'Reinhardt' Miller",
          gamerTag: "Mythic_Prism_King",
          archetype: "BLACKCELL_WHALE",
          cardTier: "ICON",
          ovrRating: 98,
          division: "Overwatch 2 • Mythic Prism Collector",
          matchesPlayed: 1750,
          spendLtv: 2400.0,
          tiltLevel: 14,
          wtp: 39.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Whenever a new Mythic Skin drops, I unlock all 4 weapon visual variants and sound effects immediately.",
        },
        {
          id: "RoleQueue_5Stack_Lead",
          name: "Chloe 'Mercy' Sterling",
          gamerTag: "RoleQueue_5Stack_Lead",
          archetype: "CASUAL_SOCIALIZER",
          cardTier: "HERO",
          ovrRating: 91,
          division: "Overwatch 2 • Role Queue 5-Stack Lead",
          matchesPlayed: 780,
          spendLtv: 120.0,
          tiltLevel: 22,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our 5-stack hops on every weekend. The Premium Battle Pass with 20 tier skips gives our whole squad great unlocks.",
        },
        {
          id: "Arcade_Casual_Lucio",
          name: "Liam 'Boop' S.",
          gamerTag: "Arcade_Casual_Lucio",
          archetype: "CASUAL_WARRIOR",
          cardTier: "GOLD_RARE",
          ovrRating: 85,
          division: "Overwatch 2 • Mystery Heroes Casual",
          matchesPlayed: 380,
          spendLtv: 30.0,
          tiltLevel: 15,
          wtp: 4.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "1,000 Coins starter pack with a featured legendary hero skin is great value for casual players.",
        },
      ];
    }

    // 6. DEFAULT / CANDY CRUSH & ALL ABK PERSONAS FALLBACK
    else {
      return [
        {
          id: "Candy_Commuter_Slump",
          name: "Brenda 'Subway' K.",
          gamerTag: "Subway_Crush_99",
          archetype: "BOOSTER_WHALE",
          cardTier: "GOLD_RARE",
          ovrRating: 92,
          division: "Candy Crush • Level 500+ Commuter",
          matchesPlayed: 3100,
          spendLtv: 450.0,
          tiltLevel: 82,
          wtp: 1.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Failed level 540 with 1 jelly remaining 3 times in a row. A $1.99 50 Gold Bars booster pack lets me clear the level and keep my streak.",
        },
        {
          id: "Candy_VIP_Whale",
          name: "Eleanor 'Sugar' Vance",
          gamerTag: "Candy_VIP_Whale_01",
          archetype: "BLACKCELL_WHALE",
          cardTier: "ICON",
          ovrRating: 97,
          division: "Candy Crush • VIP Hall of Fame",
          matchesPlayed: 4500,
          spendLtv: 1850.0,
          tiltLevel: 10,
          wtp: 19.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "I buy the $19.99 Gold Bar vault every month to maintain my position at the top of the weekly team race.",
        },
        {
          id: "Daily_Streak_Social",
          name: "Jessica 'Candy' W.",
          gamerTag: "Daily_Streak_Social",
          archetype: "CASUAL_SOCIALIZER",
          cardTier: "HERO",
          ovrRating: 89,
          division: "Candy Crush • 365-Day Daily Streak",
          matchesPlayed: 1400,
          spendLtv: 85.0,
          tiltLevel: 20,
          wtp: 4.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our social team exchanges extra lives and booster gifts every morning on the train commute.",
        },
        {
          id: "Subway_Casual_Gamer",
          name: "Marcus 'Transit' B.",
          gamerTag: "Subway_Casual_Gamer",
          archetype: "COMPETITIVE_GRINDER",
          cardTier: "GOLD_RARE",
          ovrRating: 84,
          division: "Candy Crush • Casual Subway Commuter",
          matchesPlayed: 520,
          spendLtv: 15.0,
          tiltLevel: 15,
          wtp: 0.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "99¢ extra moves when I'm one match away from clearing a hard level is a no-brainer.",
        },
      ];
    }
  }, [cohortContext, targetNode, selectedGame, graphData, result]);



  useEffect(() => {
    const activeFranchise =
      selectedGame === "ALL"
        ? (cohortContext?.franchise && cohortContext.franchise !== "ALL" ? cohortContext.franchise : "Activision Blizzard King")
        : selectedGame === "COD"
        ? "Call of Duty: Warzone"
        : selectedGame === "WOW"
        ? "World of Warcraft"
        : selectedGame === "DIABLO4"
        ? "Diablo IV"
        : selectedGame === "OVERWATCH2"
        ? "Overwatch 2"
        : "Candy Crush Saga";
    setFranchise(activeFranchise);

    if (cohortContext?.query) {
      setCreativeTitle(`${cohortContext.query} — Real-Time Intervention`);
    } else if (targetNode) {
      setCreativeTitle(`${targetNode.name} • ${targetNode.archetype || "Player"} Direct Contextual Offer`);
    } else if (selectedGame === "COD") {
      setCreativeTitle("Call of Duty: Warzone BlackCell Battle Pass & 1,100 CP Starter ($9.99 - $29.99)");
      setProposedSpend(220000);
    } else if (selectedGame === "WOW") {
      setCreativeTitle("World of Warcraft 6-Month Subscription Bundle & Mount Voucher ($14.99 - $77.94)");
      setProposedSpend(190000);
    } else if (selectedGame === "DIABLO4") {
      setCreativeTitle("Diablo IV: Vessel of Hatred Deluxe & Infernal Relic Cache ($19.99 - $59.99)");
      setProposedSpend(160000);
    } else if (selectedGame === "OVERWATCH2") {
      setCreativeTitle("Overwatch 2 Mythic Skin Prism Bundle & 2,200 Coins ($9.99 - $39.99)");
      setProposedSpend(140000);
    } else {
      setCreativeTitle("Candy Crush Saga Infinite Lives & 50 Gold Bars Bundle ($4.99 - $19.99)");
      setProposedSpend(110000);
    }
  }, [selectedGame, cohortContext, targetNode]);

  const runSimulation = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/synthetic/deepsona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: `camp-abk-${Date.now()}`,
          franchise,
          creative_title: creativeTitle,
          proposed_spend: proposedSpend,
          target_roas: targetRoas,
          cohort_context: {
            ...cohortContext,
            franchise: selectedGame,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
    }
  }, [initialResult]);

  useEffect(() => {
    if (initialCreativeTitle) {
      setCreativeTitle(initialCreativeTitle);
    }
  }, [initialCreativeTitle]);

  useEffect(() => {
    if (initialFranchise) {
      setFranchise(initialFranchise);
    }
  }, [initialFranchise]);

  useEffect(() => {
    if (isOpen && !initialResult && !result) {
      runSimulation();
    }
  }, [isOpen, initialResult, cohortContext, selectedGame]);

  const handleAskPersonas = async (customPrompt?: string) => {
    const p = customPrompt || debatePrompt;
    if (!p.trim()) return;
    setDebatePrompt("");
    setIsDebating(true);

    try {
      const res = await fetch("/api/synthetic/deepsona/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          campaign_title: creativeTitle,
          franchise,
          cohort_context: cohortContext,
          sampled_players: groundedPersonas,
          price: 4.99,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const turns = data.debate_turns || [];

        const newItems = turns.map((t: any, idx: number) => ({
          id: `feed-turn-${Date.now()}-${idx}`,
          sender: t.persona_id,
          role: t.name || t.persona_id,
          text: t.message,
          wtp: t.wtp,
          fsm: t.fsm_state,
        }));

        setDebateMessages((prev) => [...prev, ...newItems]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDebating(false);
    }
  };

  if (!isOpen) return null;

  const currentAudienceSize =
    cohortContext?.estimatedTotal ||
    (graphData?.nodes ? graphData.nodes.filter((n) => n.type === "PLAYER").length * 12 : 245000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6 animate-fade-in font-sans">
      <div className="w-full max-w-5xl bg-[#0E1015]/95 border border-white/10 rounded-3xl p-6 space-y-4 max-h-[92vh] flex flex-col justify-between shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                AI Focus Group • Player Testing
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-xs text-gray-400">{franchise}</span>
            </div>
            <h2 className="text-base font-semibold text-white mt-1 tracking-tight">
              {creativeTitle}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Testing with <strong>{currentAudienceSize.toLocaleString()}</strong> players in {selectedGame === "ALL" ? "cross-franchise" : selectedGame} segment
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Scorecard Metrics Row */}
        {result && (
          <LiftScoreGauge
            conversionLift={result.predicted_conversion_lift}
            churnMitigation={result.churn_mitigation_lift}
            revenueImpact={result.projected_revenue_impact_usd}
            sentimentDecay={result.sentiment_decay_index}
          />
        )}

        {/* 2. Simplified Tab Navigation */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab("personas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "personas"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>1. Player Profiles</span>
            </button>

            <button
              onClick={() => setActiveTab("community_debate")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "community_debate"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>2. Community Chat</span>
            </button>

            <button
              onClick={() => setActiveTab("conversion_scoring")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "conversion_scoring"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>3. Purchase Likelihood</span>
            </button>

            <button
              onClick={() => setActiveTab("sensitivity")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "sensitivity"
                  ? "bg-white text-black shadow-md"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>4. Price & Triggers</span>
            </button>
          </div>
        </div>

        {/* 3. Tab Content View Area */}
        <div className="min-h-[350px]">
          {/* TAB 1: Grounded Personas + Live Persona Debate Feed */}
          {activeTab === "personas" && (
            <div className="grid grid-cols-12 gap-4">
              {/* Left: 4 Persona Cards (7 Columns) */}
              <div className="col-span-7 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                    Simulated Players ({groundedPersonas.length} Archetypes)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Sampled from Active Audience
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {groundedPersonas.map((persona) => (
                    <FUTPersonaCard
                      key={persona.id}
                      persona={persona}
                      isSelected={selectedPersona?.id === persona.id}
                      onSelect={() => setSelectedPersona(persona)}
                    />
                  ))}
                </div>
              </div>

              {/* Right: Live Multi-Agent AI Debate Stream (5 Columns) */}
              <div className="col-span-5 flex flex-col justify-between bg-black/40 p-3.5 rounded-2xl border border-white/5 h-[340px]">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                        Live Chat with Players
                      </span>
                      {debateMessages.length > 0 && (
                        <button
                          onClick={() => setDebateMessages([])}
                          className="text-[9px] text-zinc-400 hover:text-white font-mono px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">Simulated Reactions</span>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
                    {debateMessages.length === 0 ? (
                      /* Clean Pristine Empty State */
                      <div className="h-full flex flex-col items-center justify-center text-center p-3 space-y-2 text-zinc-400">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white block">Chat is Clear</span>
                          <p className="text-[10px] text-zinc-500 max-w-[210px] leading-tight">
                            Ask players a question to trigger live Vertex AI reactions from all 4 archetypes.
                          </p>
                        </div>
                        {/* Quick Starter Chips */}
                        <div className="flex flex-col gap-1 w-full pt-1">
                          {[
                            "Would you buy this for $4.99?",
                            "How does defeat tilt affect your spend?",
                            "Is $49.99 fair for guaranteed walkouts?",
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                handleAskPersonas(chip);
                              }}
                              disabled={isDebating}
                              className="w-full text-left text-[10px] text-zinc-300 hover:text-white px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/5 truncate transition-all"
                            >
                              💬 {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      debateMessages.map((msg) => (
                        <div key={msg.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white text-[11px]">{msg.sender}</span>
                            <span className="text-amber-300 text-[10px] font-mono">${msg.wtp.toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-gray-300 leading-relaxed">&ldquo;{msg.text}&rdquo;</p>
                        </div>
                      ))
                    )}

                    {isDebating && (
                      <div className="text-[11px] text-cyan-400 italic py-1 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Players are typing their reactions...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input Bar */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={debatePrompt}
                    onChange={(e) => setDebatePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAskPersonas()}
                    placeholder="Ask players (e.g. 'Would you buy this for $4.99?')..."
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    onClick={() => handleAskPersonas()}
                    disabled={isDebating || !debatePrompt.trim()}
                    className="px-3 py-1.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    Ask
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Community Debate Simulator (Reddit & Discord) */}
          {activeTab === "community_debate" && (
            <CommunityDebateSimulator
              franchise={franchise}
              selectedGame={selectedGame}
              creativeTitle={creativeTitle}
              cohortContext={cohortContext}
            />
          )}

          {/* TAB 3: Conversion Scoring Matrix (Casual vs Hardcore) */}
          {activeTab === "conversion_scoring" && (
            <ConversionScoringMatrix
              franchise={franchise}
              selectedGame={selectedGame}
              creativeTitle={creativeTitle}
              cohortContext={cohortContext}
            />
          )}

          {/* TAB 4: Sensitivity & Situational Rules */}
          {activeTab === "sensitivity" && (
            <SensitivitySimulator
              cohortContext={cohortContext}
              baseSpend={proposedSpend}
              baseRoas={targetRoas}
            />
          )}
        </div>

        {/* 4. Footer: Clear Summary & Step 4 CTA */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3.5">
          <div className="flex items-center gap-2 max-w-[65%]">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-300 line-clamp-1">
              Focus Group Summary: <strong>+{result?.predicted_conversion_lift || 28.5}% sales boost estimated</strong> across {selectedGame === "ALL" ? "all titles" : selectedGame}.
            </span>
          </div>

          <button
            onClick={() => result && onGenerateBrief(result)}
            disabled={isGeneratingBrief || !result}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-lg active:scale-95 ${
              isGeneratingBrief
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-wait shadow-neon-green"
                : "bg-white hover:bg-gray-200 text-black"
            }`}
          >
            {isGeneratingBrief ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Creating Campaign Plan...</span>
              </>
            ) : (
              <>
                <span>Approve & Export Campaign Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
