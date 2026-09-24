"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, ArrowRight, Sparkles, Send, Check, Users, MessageSquare, Target, SlidersHorizontal, Loader2 } from "lucide-react";
import { DeepSonaResult, GraphNode, GraphData, CohortContext, GameFranchise } from "@/lib/types";
import LiftScoreGauge from "./LiftScoreGauge";
import SyntheticPersonaCard, { PersonaProfile } from "./SyntheticPersonaCard";
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
  const isWarzone = rawFranchise.includes("WARZONE");
  const isBlackOps = rawFranchise.includes("BLACK_OPS") || rawFranchise.includes("BO6") || rawFranchise.includes("ZOMBIES");
  const isCDL = rawFranchise.includes("CDL") || rawFranchise.includes("RANKED");
  const isMobile = rawFranchise.includes("MOBILE");

  const spend = node.spend !== undefined && node.spend > 0 ? node.spend : slotIndex === 1 ? 4200 : slotIndex === 0 ? 450 : slotIndex === 2 ? 140 : 40;
  const lossStreak = node.loss_streak !== undefined && node.loss_streak > 0 ? node.loss_streak : slotIndex === 0 ? 3 : 1;
  const tilt = Math.round((node.tilt !== undefined ? node.tilt : slotIndex === 0 ? 0.85 : slotIndex === 1 ? 0.15 : slotIndex === 2 ? 0.35 : 0.20) * 100);
  const formattedSpend = `$${spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Slot 0: Frustrated Competitive Sweats (Loss Streak / Defeat Trigger)
  if (slotIndex === 0) {
    if (isBlackOps) {
      return `Wiped on Round 35 after a Mangler swarm (${lossStreak} wipe slump, ${tilt}% tilt). Grabbing the $9.99 GobbleGum & Wonder Weapon Pack resets team morale for the Easter Egg run.`;
    } else if (isCDL) {
      return `Suffered ${lossStreak} straight demotion losses in Hardpoint (${tilt}% tilt). Grabbing the $4.99 Ranked Play Demotion Recovery Pack protects my SR and gets my squad back locked in.`;
    } else if (isMobile) {
      return `Dropped ${lossStreak} straight ranked S&D matches in legendary tier (${tilt}% tilt). The $2.99 Mobile Starter Claw pack gives 300 CP and weapon XP to reset momentum.`;
    } else {
      return `After getting eliminated in the Gulag ${lossStreak} matches in a row (tilt at ${tilt}%), grabbing the $4.99 Gulag Loss-Streak Recovery Care Package on the defeat screen gets me right back into Resurgence.`;
    }
  }

  // Slot 1: High-LTV Whales & Collection Event Hunters (Big Spenders)
  if (slotIndex === 1) {
    if (isBlackOps) {
      return `Lifetime spend of ${formattedSpend} across Treyarch titles. The $99.99 Black Ops 7 Vault Edition upgrade with Mastercraft weapon blueprints and GobbleGums is an automatic day-one purchase.`;
    } else if (isCDL) {
      return `Invested ${formattedSpend} in CDL team bundles and pro operator camos. Every Major I pick up the OpTic and FaZe team supporter packs and animated weapon camos immediately.`;
    } else if (isMobile) {
      return `Mobile whale with ${formattedSpend} invested. The Mythic Grau 5.56 draw and legendary operator skins are instant completions for my vault collection.`;
    } else {
      return `I've invested ${formattedSpend} into Call of Duty. Every seasonal launch I buy the $29.99 BlackCell Vault bundle with 20 tier skips and animated mastercraft blueprints instantly.`;
    }
  }

  // Slot 2: Squad Co-op / Socializers (Team Play & Group Passes)
  if (slotIndex === 2) {
    if (isBlackOps) {
      return `We run 4-player Terminus Island Zombies every weekend. Squad GobbleGum caches and shared weapon XP boosts provide massive group survival efficiency.`;
    } else if (isCDL) {
      return `Our 4-stack queues CDL Ranked every night. Shared clan weapon blueprints and callout packs keep our squad synchronized in Crimson and Iridescent.`;
    } else if (isMobile) {
      return `I play 5-stack multiplayer with my clan daily. Group clan war milestone rewards and battle pass gift cards keep our team on top of the leaderboard.`;
    } else {
      return `Our 4-stack drops into Warzone Resurgence every Friday night. Clan 2x Weapon XP passes and blueprint bundles are things our whole squad buys together.`;
    }
  }

  // Slot 3: Value Optimizers & Casual Story Purists (Price-Conscious / Franchise Purist)
  if (isBlackOps) {
    return `Solo round-based Zombies and campaign grinder. As long as Easter egg quests are accessible and GobbleGums don't create pay-to-win barriers, I support the seasonal liveops.`;
  } else if (isCDL) {
    return `Competitive purist who watches CDL Majors on YouTube and grinds ranked. Clean team weapon camos under $10 are solid value without gaudy reactive effects.`;
  } else if (isMobile) {
    return `Casual mobile player on lunch breaks. The 80 CP starter crates and seasonal milestone rewards give great visual identity for pocket change.`;
  } else {
    return `I usually stick to free Warzone and MP camo grinding, but a $9.99 starter pack with an operator skin and 1,100 CP coins is fair value that avoids store clutter.`;
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
  const [franchise, setFranchise] = useState(initialFranchise || "Activision | Call of Duty");
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

  // Strategic Pivot & Grounding State passed to Brief Generation
  const [strategicPivot, setStrategicPivot] = useState<{
    original_concept: string;
    pivot_reason: string;
    pivoted_concept: string;
  } | null>(null);
  const [groundedInsight, setGroundedInsight] = useState<string | null>(null);

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
        const isWarzone = nodeFranchise.includes("WARZONE");
        const isBlackOps = nodeFranchise.includes("BLACK_OPS") || nodeFranchise.includes("BO6") || nodeFranchise.includes("ZOMBIES");
        const isCDL = nodeFranchise.includes("CDL") || nodeFranchise.includes("RANKED");
        const isMobile = nodeFranchise.includes("MOBILE");
        const isMW3 = nodeFranchise.includes("MODERN_WARFARE") || nodeFranchise.includes("MW3");

        let pArch =
          slotIdx === 0
            ? "COMPETITIVE_GRINDER"
            : slotIdx === 1
            ? "BLACKCELL_WHALE"
            : slotIdx === 2
            ? "CASUAL_SOCIALIZER"
            : "LORE_SEEKER";

        if (isBlackOps) {
          pArch =
            slotIdx === 0
              ? "ROUND_BASED_ZOMBIES_SLAYER"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "CAMO_COMPLETIONIST";
        } else if (isCDL) {
          pArch =
            slotIdx === 0
              ? "CDL_RANKED_SWEAT"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "COMPETITIVE_GRINDER";
        } else if (isMobile) {
          pArch =
            slotIdx === 0
              ? "MOBILE_TOUCHPAD_PRODIGY"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "CASUAL_WARRIOR";
        } else if (isMW3) {
          pArch =
            slotIdx === 0
              ? "SEARCH_AND_DESTROY_SPECIALIST"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "CAMO_COMPLETIONIST";
        } else {
          pArch =
            slotIdx === 0
              ? "GULAG_TILT_RISK"
              : slotIdx === 1
              ? "BLACKCELL_WHALE"
              : slotIdx === 2
              ? "CASUAL_SOCIALIZER"
              : "VERDANSK_OG";
        }

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

        const franchiseName = isBlackOps
          ? "Call of Duty: Black Ops 7 & Zombies"
          : isCDL
          ? "Call of Duty: CDL Ranked Play"
          : isMobile
          ? "Call of Duty: Mobile"
          : isMW3
          ? "Call of Duty: Modern Warfare III"
          : "Call of Duty: Warzone & Resurgence";

        const division =
          slotIdx === 0
            ? `${franchiseName} • ${isBlackOps ? "Round 40+ Zombies Slayer" : isCDL ? "CDL Iridescent (Rank 1)" : isMobile ? "Legendary 10,000+ Grinder" : isMW3 ? "S&D Clutch Specialist" : "Rebirth Demon (Top 250)"}`
            : slotIdx === 1
            ? `${franchiseName} • ${isBlackOps ? "Dark Matter Camo Whale" : isCDL ? "OpTic/FaZe Pro Supporter" : isMobile ? "Mythic Weapon Collector" : isMW3 ? "Interstellar Vault Collector" : "BlackCell Vault Whale ($3.5k+)"}`
            : slotIdx === 2
            ? `${franchiseName} • ${isBlackOps ? "Terminus Island Squad Lead" : isCDL ? "4-Stack Callout Captain" : isMobile ? "Clan War Squad Lead" : isMW3 ? "6v6 Hardcore Party Leader" : "Resurgence Quad Captain"}`
            : `${franchiseName} • ${isBlackOps ? "Treyarch Lore & Solo Purist" : isCDL ? "Competitive Meta Purist" : isMobile ? "Touchpad Commuter" : isMW3 ? "Camo Grinder" : "Verdansk OG Veteran"}`;

        return {
          id: node.id,
          name: node.name,
          gamerTag: node.name,
          archetype: pArch,
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

    // 2. WARZONE & RESURGENCE PERSONAS FALLBACK
    if (game === "WARZONE" || game === "COD" || q.includes("cod") || q.includes("warzone") || q.includes("resurgence") || q.includes("gulag")) {
      return [
        {
          id: "COD_WarzoneSweat_94",
          name: "Marcus 'Ghost' Vance",
          gamerTag: "Ghost_Resurgence_94",
          archetype: "GULAG_TILT_RISK",
          division: "Call of Duty: Warzone • Rebirth Demon (Top 250)",
          matchesPlayed: 1450,
          spendLtv: 480.0,
          tiltLevel: 88,
          wtp: 4.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "After getting eliminated in the Gulag 3 matches in a row, grabbing the $4.99 Gulag Recovery Care Package gets me right back into Resurgence squads.",
        },
        {
          id: "BlackCell_Whale_01",
          name: "Alexander 'Vault' Price",
          gamerTag: "BlackCell_Whale_01",
          archetype: "BLACKCELL_WHALE",
          division: "Call of Duty: Warzone • BlackCell Vault Collector ($3.5k+)",
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
          division: "Call of Duty: Warzone • Resurgence Quad Captain",
          matchesPlayed: 620,
          spendLtv: 140.0,
          tiltLevel: 28,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our whole 4-player Resurgence quad logs in Friday night. The Clan 2x Weapon XP Pass was bought by all 4 of us immediately.",
        },
        {
          id: "Verdansk_OG_Echo",
          name: "David 'Bravo' Chen",
          gamerTag: "Verdansk_OG_Echo",
          archetype: "VERDANSK_OG",
          division: "Call of Duty: Warzone • Verdansk 2020 Veteran",
          matchesPlayed: 1840,
          spendLtv: 120.0,
          tiltLevel: 10,
          wtp: 0.0,
          fsmState: "ENGAGED_FREE",
          recentLossStreak: 0,
          quote: "Playing since Verdansk day one in March 2020. As long as movement stays fluid and there's no pay-to-win weapon blueprint stats, I support the game.",
        },
      ];
    }

    // 3. BLACK OPS 6 & ZOMBIES PERSONAS FALLBACK
    else if (game === "BLACK_OPS" || q.includes("black ops") || q.includes("bo6") || q.includes("zombies") || q.includes("terminus")) {
      return [
        {
          id: "Terminus_Slayer_115",
          name: "Edward 'Mangler' Richter",
          gamerTag: "Terminus_Slayer_115",
          archetype: "ROUND_BASED_ZOMBIES_SLAYER",
          division: "Call of Duty: Black Ops 7 • Round 40+ Zombies Slayer",
          matchesPlayed: 1240,
          spendLtv: 320.0,
          tiltLevel: 82,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Wiped on Round 38 after a Mangler swarm 3 runs in a row. The $9.99 GobbleGum Ultra Mega Pack gives our crew the Perkaholic and Cache Back boosts needed for the Easter Egg.",
        },
        {
          id: "DarkMatter_Whale_BO7",
          name: "Samantha 'Aether' Maxis",
          gamerTag: "DarkMatter_Whale_BO7",
          archetype: "BLACKCELL_WHALE",
          division: "Call of Duty: Black Ops 7 • Dark Matter Camo Whale ($2.8k+)",
          matchesPlayed: 1980,
          spendLtv: 2850.0,
          tiltLevel: 15,
          wtp: 99.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Black Ops 7 Vault Edition upgrade with Mastercraft weapon blueprints, GobbleGums, and Woods Operator pack was an instant pre-order.",
        },
        {
          id: "Treyarch_Squad_Lead",
          name: "Marcus 'Mason' Woods",
          gamerTag: "Treyarch_Squad_Lead",
          archetype: "CASUAL_SOCIALIZER",
          division: "Call of Duty: Black Ops 7 • Terminus Island Squad Lead",
          matchesPlayed: 750,
          spendLtv: 160.0,
          tiltLevel: 22,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our 4-player co-op squad runs round-based Zombies every Friday. Shared GobbleGum caches keep our team surviving past Round 50.",
        },
        {
          id: "Camo_Completionist_BO7",
          name: "Alex 'DarkMatter' Miller",
          gamerTag: "Camo_Completionist_BO7",
          archetype: "CAMO_COMPLETIONIST",
          division: "Call of Duty: Black Ops 7 • Dark Matter Grinder",
          matchesPlayed: 920,
          spendLtv: 40.0,
          tiltLevel: 10,
          wtp: 0.0,
          fsmState: "ENGAGED_FREE",
          recentLossStreak: 0,
          quote: "Grinding Dark Matter across all 33 launch weapons. As long as mastery camo challenges remain skill-based and not buyable, the liveops loop is great.",
        },
      ];
    }

    // 4. CDL RANKED COMPETITORS FALLBACK
    else if (game === "CDL_RANKED" || q.includes("cdl") || q.includes("ranked") || q.includes("optic") || q.includes("faze")) {
      return [
        {
          id: "Iridescent_Sweat_CDL",
          name: "Tyler 'Shotz' Murphy",
          gamerTag: "Iridescent_Sweat_CDL",
          archetype: "CDL_RANKED_SWEAT",
          division: "Call of Duty: CDL Ranked • Iridescent Rank 1",
          matchesPlayed: 2150,
          spendLtv: 520.0,
          tiltLevel: 86,
          wtp: 4.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Suffered 3 straight demotion losses in Hardpoint (tilt at 86%). The $4.99 Ranked Play Demotion Recovery Pack protects my SR and resets squad focus.",
        },
        {
          id: "OpTic_GreenWall_Whale",
          name: "Hector 'Wall' Rodriguez",
          gamerTag: "OpTic_GreenWall_Whale",
          archetype: "BLACKCELL_WHALE",
          division: "Call of Duty: CDL Ranked • OpTic/FaZe Pro Supporter",
          matchesPlayed: 1850,
          spendLtv: 2400.0,
          tiltLevel: 14,
          wtp: 19.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Every CDL Major I buy both the OpTic Gaming and FaZe Clan team packs and weapon camos. Creator codes for Scump and ZooMaa are always active on checkout.",
        },
        {
          id: "Hardpoint_IGL_Lead",
          name: "Jordan 'Comms' Blake",
          gamerTag: "Hardpoint_IGL_Lead",
          archetype: "CASUAL_SOCIALIZER",
          division: "Call of Duty: CDL Ranked • 4-Stack Callout Captain",
          matchesPlayed: 890,
          spendLtv: 130.0,
          tiltLevel: 24,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "Our 4-stack scrims competitive CDL maps 4 nights a week. Pro pack operator uniforms give our squad clean visual uniformity.",
        },
        {
          id: "Competitive_Meta_Purist",
          name: "Chris 'Anchor' Nolan",
          gamerTag: "Competitive_Meta_Purist",
          archetype: "COMPETITIVE_GRINDER",
          division: "Call of Duty: CDL Ranked • Diamond Anchor",
          matchesPlayed: 640,
          spendLtv: 20.0,
          tiltLevel: 18,
          wtp: 0.0,
          fsmState: "ENGAGED_FREE",
          recentLossStreak: 0,
          quote: "Strict competitive ruleset player. No cheese weapons, no gaudy anime skins—just pure gunskill, rotation timing, and CDL map knowledge.",
        },
      ];
    }

    // 5. COD MOBILE & MWIII PERSONAS FALLBACK
    else {
      return [
        {
          id: "Mythic_Grau_Demon",
          name: "Kenji 'Claw' Sato",
          gamerTag: "Mythic_Grau_Demon",
          archetype: "MOBILE_TOUCHPAD_PRODIGY",
          division: "Call of Duty: Mobile • Legendary 10,000+ Grinder",
          matchesPlayed: 3200,
          spendLtv: 850.0,
          tiltLevel: 75,
          wtp: 9.99,
          fsmState: "PURCHASED",
          recentLossStreak: 3,
          quote: "Dropped 3 ranked matches in legendary tier. The Mythic Grau 5.56 draw reload gives the weapon inspection and kill effects I love.",
        },
        {
          id: "Mobile_Crate_Whale",
          name: "Sarah 'Draw' Jenkins",
          gamerTag: "Mobile_Crate_Whale",
          archetype: "BLACKCELL_WHALE",
          division: "Call of Duty: Mobile • Mythic Weapon Collector ($3k+)",
          matchesPlayed: 4100,
          spendLtv: 3200.0,
          tiltLevel: 10,
          wtp: 49.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Every Mythic lucky draw I spin to completion. Having the animated mythic weapon shroud and custom tracer rounds is mandatory for my loadout.",
        },
        {
          id: "SnD_Clutch_Specialist",
          name: "Jason 'Defuse' Briggs",
          gamerTag: "SnD_Clutch_Specialist",
          archetype: "SEARCH_AND_DESTROY_SPECIALIST",
          division: "Call of Duty: MWIII • Search & Destroy Specialist",
          matchesPlayed: 1100,
          spendLtv: 180.0,
          tiltLevel: 35,
          wtp: 19.99,
          fsmState: "PURCHASED",
          recentLossStreak: 1,
          quote: "1v4 clutch specialist in Search & Destroy. The S&D Clutch Pro Bundle with dead silence footsteps and ninja defuse calling card is perfect.",
        },
        {
          id: "Casual_Standoff_Purist",
          name: "Marcus 'Commute' Rivera",
          gamerTag: "Casual_Standoff_Purist",
          archetype: "CASUAL_WARRIOR",
          division: "Call of Duty: Mobile • Casual Standoff Slayer",
          matchesPlayed: 480,
          spendLtv: 10.0,
          tiltLevel: 12,
          wtp: 2.99,
          fsmState: "PURCHASED",
          recentLossStreak: 0,
          quote: "Quick 10-minute Team Deathmatch rounds on lunch break. The $2.99 Mobile Starter Claw pack is the perfect bite-sized upgrade.",
        },
      ];
    }
  }, [cohortContext, targetNode, selectedGame, graphData, result]);



  useEffect(() => {
    const activeFranchise =
      selectedGame === "ALL"
        ? (cohortContext?.franchise && cohortContext.franchise !== "ALL" ? cohortContext.franchise : "Call of Duty: Unified HQ")
        : selectedGame === "WARZONE"
        ? "Call of Duty: Warzone & Resurgence"
        : selectedGame === "BLACK_OPS"
        ? "Call of Duty: Black Ops 7 & Zombies"
        : selectedGame === "MODERN_WARFARE"
        ? "Call of Duty: Modern Warfare III"
        : selectedGame === "CDL_RANKED"
        ? "Call of Duty: CDL Ranked Play"
        : selectedGame === "COD_MOBILE"
        ? "Call of Duty: Mobile"
        : "Call of Duty: Unified HQ";
    setFranchise(activeFranchise);

    if (cohortContext?.query) {
      setCreativeTitle(`${cohortContext.query} — Real-Time Intervention`);
    } else if (targetNode) {
      setCreativeTitle(`${targetNode.name} • ${targetNode.archetype || "Player"} Direct Contextual Offer`);
    } else if (selectedGame === "BLACK_OPS") {
      setCreativeTitle("Black Ops 7 Zombies GobbleGum Ultra Mega Pack & 1,100 CP ($9.99 - $29.99)");
      setProposedSpend(180000);
    } else if (selectedGame === "CDL_RANKED") {
      setCreativeTitle("CDL Ranked Play Demotion Recovery Pack & OpTic/FaZe Pro Supporter Bundle ($4.99 - $19.99)");
      setProposedSpend(150000);
    } else if (selectedGame === "COD_MOBILE") {
      setCreativeTitle("Call of Duty: Mobile Mythic Grau 5.56 Draw & 800 CP Starter ($2.99 - $49.99)");
      setProposedSpend(120000);
    } else if (selectedGame === "MODERN_WARFARE") {
      setCreativeTitle("MWIII Search & Destroy Clutch Pro Bundle & 2,400 CP ($19.99 - $39.99)");
      setProposedSpend(140000);
    } else {
      setCreativeTitle("Call of Duty: Warzone BlackCell Battle Pass & 1,100 CP Starter ($9.99 - $29.99)");
      setProposedSpend(220000);
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
                    <SyntheticPersonaCard
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
                            "Is $29.99 fair for a premium battle pass?",
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
              onApplyStrategicPivot={(pivotedTitle, pivot, insight) => {
                setCreativeTitle(pivotedTitle);
                setStrategicPivot(pivot);
                setGroundedInsight(insight);
              }}
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
            onClick={() => {
              if (!result) return;
              onGenerateBrief({
                ...result,
                creative_title: creativeTitle,
                strategic_pivot: strategicPivot,
                grounded_community_insight: groundedInsight,
              } as any);
            }}
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
