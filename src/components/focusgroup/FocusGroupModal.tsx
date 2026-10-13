"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Play,
  Swords,
  AlertTriangle,
  FileText,
  Palette,
  Radio,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  GraphNode,
  CohortContext,
  GameFranchise,
  GraphData,
  FocusGroupResult,
  FocusGroupReaction,
  CreatorBroadcast,
  SwarmCrowdAgent,
  RedditEchoItem,
} from "@/lib/types";
import { archetypeColor, archetypeLabel } from "@/lib/archetypes";
import { TabularNumber } from "@/components/brand/TabularNumber";
import { StaggerList } from "@/components/brand/StaggerList";
import { Sparkline } from "@/components/brand/Sparkline";
import { RedditPulseCard } from "./RedditPulseCard";
import { PersonaInterrogationDrawer } from "./PersonaInterrogationDrawer";
import type { ExtendedFocusGroupResult } from "@/lib/focus-group-eval";

export interface FocusGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode?: GraphNode | null;
  cohortContext?: CohortContext | null;
  selectedGame: GameFranchise;
  graphData: GraphData;
  initialResult?: FocusGroupResult | null;
  initialCreativeTitle?: string;
  initialFranchise?: string;
  isGeneratingBrief?: boolean;
  onGenerateBrief: (res: FocusGroupResult) => void;
  onOpenCreativeStudio?: (offerTitle: string) => void;
  offerPreset?: { title: string; priceUsd: number; altPriceUsd?: number } | null;
}

interface OfferPreset {
  id: string;
  title: string;
  priceUsd: number;
  altPriceUsd?: number;
  label: string;
}

interface CounterfactualChip {
  id: string;
  label: string;
  eventText: string | null;
}

const PRESETS: OfferPreset[] = [
  {
    id: "crew-reup",
    title: "Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster",
    priceUsd: 4.99,
    label: "$4.99 Crew Re-Up",
  },
  {
    id: "galaxy-opal-battle",
    title: "Galaxy Opal Deluxe Pack",
    priceUsd: 14.99,
    altPriceUsd: 19.99,
    label: "$14.99 vs $19.99 Opal Battle",
  },
  {
    id: "hof-pass",
    title: "Season Pass Hall of Fame Edition",
    priceUsd: 19.99,
    label: "$19.99 HoF Pass",
  },
  {
    id: "2k26-loyalty-upgrade",
    title: "NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC",
    priceUsd: 69.99,
    label: "$69.99 2K27 Upgrade",
  },
];

const COUNTERFACTUAL_CHIPS: CounterfactualChip[] = [
  {
    id: "baseline",
    label: "Baseline",
    eventText: null,
  },
  {
    id: "crew-vc-bonus",
    label: "+15K VC Squad Bonus",
    eventText:
      "Add a +15,000 VC Squad Bonus and 2x Rec Rep multiplier when 3 or more Crew mates upgrade or claim together",
  },
  {
    id: "opal-topper",
    label: "Guaranteed Opal Topper",
    eventText:
      "Include 1 Guaranteed 97+ OVR Galaxy Opal Topper card and raise pack probability to 5.5% verified odds",
  },
  {
    id: "creator-costream",
    label: "@Agent00 Co-Stream Drop",
    eventText:
      "Launch with a live @Agent00 and @KOT4Q Creator Locker Code co-stream granting an exclusive City Jersey + 2hr Double Rep",
  },
  {
    id: "rebirth-carryover",
    label: "90 OVR Rebirth Carryover",
    eventText:
      "Grant NBA 2K26 veterans instant 90 OVR Rebirth progression plus +2 Cap Breaker carryover tokens in NBA 2K27 Season 2",
  },
];

const STANDBY_CREWS = ["Bucket Getters", "Dimers Only", "Green Light Gang", "Rim Runners"];
const STANDBY_CREATORS = ["@Agent00", "@Troydan", "@KOT4Q", "@DBG"];

export function FocusGroupModal({
  isOpen,
  onClose,
  cohortContext,
  graphData,
  initialResult,
  initialCreativeTitle = "Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster",
  initialFranchise = "NBA2K",
  isGeneratingBrief = false,
  onGenerateBrief,
  onOpenCreativeStudio,
  offerPreset,
}: FocusGroupModalProps) {
  const [creativeTitle, setCreativeTitle] = useState(offerPreset?.title || initialCreativeTitle);
  const [priceUsd, setPriceUsd] = useState(offerPreset?.priceUsd ?? 4.99);
  const [altPriceUsd, setAltPriceUsd] = useState<number | null>(offerPreset?.altPriceUsd ?? null);
  const [isBattleMode, setIsBattleMode] = useState(Boolean(offerPreset?.altPriceUsd));
  const [isEditingCustomOffer, setIsEditingCustomOffer] = useState(false);

  // Unified View + Scale State (20 Personas vs 100 Swarm)
  const [swarmSize, setSwarmSize] = useState<20 | 100>(20);
  const [activeRound, setActiveRound] = useState<1 | 2 | 3>(2);
  const [selectedCfId, setSelectedCfId] = useState<string>("baseline");
  const [counterfactualEvent, setCounterfactualEvent] = useState<string | null>(null);
  const [creatorBroadcasts, setCreatorBroadcasts] = useState<CreatorBroadcast[]>([]);
  const [crowdAgents, setCrowdAgents] = useState<SwarmCrowdAgent[]>([]);
  const [contagionFlipsCount, setContagionFlipsCount] = useState<number>(0);
  const [round3FlipsCount, setRound3FlipsCount] = useState<number>(0);
  const [round3Tally, setRound3Tally] = useState<{
    purchased: number;
    evaluating: number;
    abandoned: number;
    boycott: number;
  } | null>(null);
  const [redditThreads, setRedditThreads] = useState<RedditEchoItem[]>([]);
  const [crewCaptainSummary, setCrewCaptainSummary] = useState<string>("");
  const [streamPhase, setStreamPhase] = useState<string>("");

  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<ExtendedFocusGroupResult | null>(null);
  const [liveReactions, setLiveReactions] = useState<Array<FocusGroupReaction | null>>(
    Array(20).fill(null)
  );
  const [streamProgress, setStreamProgress] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [liveSpannerDefaults, setLiveSpannerDefaults] = useState<any[]>([]);

  // Selected persona for 1-on-1 interview sheet
  const [interrogatePersona, setInterrogatePersona] = useState<FocusGroupReaction | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/synthetic/focus-group?limit=20&franchise=NBA2K")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.personas?.length) {
          setLiveSpannerDefaults(d.personas);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (offerPreset) {
      setCreativeTitle(offerPreset.title);
      setPriceUsd(offerPreset.priceUsd);
      if (offerPreset.altPriceUsd) {
        setAltPriceUsd(offerPreset.altPriceUsd);
        setIsBattleMode(true);
      } else {
        setAltPriceUsd(null);
        setIsBattleMode(false);
      }
    } else if (initialCreativeTitle) {
      setCreativeTitle(initialCreativeTitle);
    }
  }, [offerPreset, initialCreativeTitle, isOpen]);

  useEffect(() => {
    if (initialResult) {
      const ext = initialResult as ExtendedFocusGroupResult;
      setCurrentResult(ext);
      if (Array.isArray(ext.reactions)) {
        setLiveReactions(ext.reactions);
      }
      if (Array.isArray(ext.creator_broadcasts)) {
        setCreatorBroadcasts(ext.creator_broadcasts);
      }
      if (Array.isArray(ext.crowd_agents)) {
        setCrowdAgents(ext.crowd_agents);
      }
      if (typeof ext.contagion_flips_count === "number") {
        setContagionFlipsCount(ext.contagion_flips_count);
      }
      if (typeof ext.round3_flips_count === "number") {
        setRound3FlipsCount(ext.round3_flips_count);
      }
      if (ext.round3_tally) {
        setRound3Tally(ext.round3_tally);
        setActiveRound(3);
      }
      if (Array.isArray(ext.reddit_threads)) {
        setRedditThreads(ext.reddit_threads);
      }
    }
  }, [initialResult]);

  // Live players from 2K graphData
  const graphPlayers = useMemo(() => {
    const playerNodes = graphData?.nodes?.filter((n) => n.type === "PLAYER") || [];
    return playerNodes.slice(0, 20).map((n, idx) => ({
      player_id: n.id,
      gamer_tag: n.name,
      archetype: n.archetype || "MYCAREER_STORY_CASUAL",
      spend: n.spend,
      crew_name: n.clan_name || (idx % 2 === 0 ? "Bucket Getters" : "Dimers Only"),
      crew_tier: idx % 3 === 0 ? "Pro-Am" : "Rec",
      crew_role:
        n.archetype === "REC_CREW_CAPTAIN" || n.archetype === "PARK_REP_GRINDER"
          ? "CAPTAIN"
          : "MEMBER",
      creator_handle:
        n.primary_creator_influence ||
        (idx % 3 === 0 ? "@Agent00" : idx % 3 === 1 ? "@Troydan" : "@DBG"),
      myplayer_ovr: n.game_telemetry?.myplayer_ovr ?? 85,
      myplayer_build: n.game_telemetry?.myplayer_build ?? "2-Way 3-Level Scorer",
      vc_spend_90d: n.game_telemetry?.vc_spend_90d ?? n.spend ?? 65,
      vc_balance: n.game_telemetry?.vc_balance ?? 15000,
      loss_streak: n.game_telemetry?.loss_streak ?? n.loss_streak ?? 0,
      rage_quits_7d: n.game_telemetry?.rage_quits_7d ?? 0,
      season_pass_edition: n.game_telemetry?.season_pass_edition ?? "NONE",
      season_pass_tier: n.game_telemetry?.season_pass_tier ?? 12,
      myteam_galaxy_opal_count: n.game_telemetry?.myteam_galaxy_opal_count ?? 0,
      park_win_pct: n.game_telemetry?.park_win_pct ?? 0.5,
      nba2k26_veteran: n.game_telemetry?.nba2k26_veteran ?? false,
      nba2k26_spend_usd: n.game_telemetry?.nba2k26_spend_usd ?? 0,
      migrated_to_2k27: n.game_telemetry?.migrated_to_2k27 ?? false,
      gravity_score: n.gravity_score ?? n.game_telemetry?.gravity_score ?? 0.5,
      favorite_team: n.game_telemetry?.favorite_team ?? "Los Angeles Lakers",
    }));
  }, [graphData]);

  const sampledPersonas = useMemo(() => {
    if (graphPlayers.length >= 20) {
      return graphPlayers;
    }
    const pool = liveSpannerDefaults;
    return [
      ...graphPlayers,
      ...pool.slice(0, Math.max(0, 20 - graphPlayers.length)),
    ];
  }, [graphPlayers, liveSpannerDefaults]);

  // Seeded 80 crowd slots when in 100-Swarm mode before stream completes so the 100-agent grid is always complete
  const displayCrowdAgents = useMemo<SwarmCrowdAgent[]>(() => {
    if (crowdAgents.length >= 80) return crowdAgents.slice(0, 80);
    const allNodes = graphData?.nodes?.filter((n) => n.type === "PLAYER") || [];
    const seededCohortList: SwarmCrowdAgent[] = [...crowdAgents];
    for (let i = crowdAgents.length; i < 80; i++) {
      const node = allNodes[(i + 20) % Math.max(1, allNodes.length)];
      const baseTag = node?.name || `Courtside2K_${101 + i}`;
      seededCohortList.push({
        player_id: node?.id || `crowd-${i}`,
        gamer_tag: i < allNodes.length - 20 ? baseTag : `${baseTag.slice(0, 11)}${i + 1}`,
        archetype: node?.archetype || "MYCAREER_STORY_CASUAL",
        crew_name: STANDBY_CREWS[i % STANDBY_CREWS.length],
        creator_handle: STANDBY_CREATORS[i % STANDBY_CREATORS.length],
        myplayer_ovr: node?.game_telemetry?.myplayer_ovr || 78 + (i % 18),
        round1_state: "EVALUATING",
        final_fsm_state: "EVALUATING",
        contagion_flipped: false,
        contagion_driver: "NONE",
        willingness_to_pay_usd: 9.99,
      });
    }
    return seededCohortList;
  }, [crowdAgents, graphData]);

  const handleSelectPreset = (p: OfferPreset) => {
    setCreativeTitle(p.title);
    setPriceUsd(p.priceUsd);
    setIsEditingCustomOffer(false);
    if (p.altPriceUsd) {
      setAltPriceUsd(p.altPriceUsd);
      setIsBattleMode(true);
    } else {
      setAltPriceUsd(null);
      setIsBattleMode(false);
    }
  };

  const runPressureTestWithParams = async (
    overrideCfEvent?: string | null,
    overrideSwarmSize?: 20 | 100
  ) => {
    const activeCf = overrideCfEvent !== undefined ? overrideCfEvent : counterfactualEvent;
    const targetSwarm = overrideSwarmSize ?? swarmSize;
    setIsRunning(true);
    setStreamProgress(0);
    setStreamPhase("Round 1 · Isolated Evaluation");
    setActiveRound(1);
    setErrorBanner(null);
    setCurrentResult(null);
    setCreatorBroadcasts([]);
    setCrowdAgents([]);
    setContagionFlipsCount(0);
    setRound3FlipsCount(0);
    setRound3Tally(null);
    setCrewCaptainSummary("");
    setLiveReactions(Array(20).fill(null));

    try {
      const res = await fetch("/api/synthetic/focus-group/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: `fg-${Date.now()}`,
          franchise: initialFranchise || "NBA2K",
          creative_title: creativeTitle,
          price_usd: priceUsd,
          alt_price_usd: isBattleMode ? (altPriceUsd ?? 19.99) : null,
          cohort_context: cohortContext,
          sampled_players: graphPlayers,
          swarm_size: targetSwarm,
          enable_contagion: true,
          counterfactual_event: activeCf,
        }),
      });

      if (!res.ok || !res.body) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(
          errPayload.details ||
            errPayload.error ||
            `Focus group stream failed (HTTP ${res.status})`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const rawJson = dataLine.slice(6).trim();
          if (!rawJson) continue;

          let evt: any;
          try {
            evt = JSON.parse(rawJson);
          } catch {
            continue;
          }

          if (evt.type === "verdict" && typeof evt.index === "number" && evt.reaction) {
            setLiveReactions((prev) => {
              const next = [...prev];
              next[evt.index] = evt.reaction;
              return next;
            });
            setStreamProgress((prev) => {
              const nextCount = prev + 1;
              if (nextCount >= 20) {
                setStreamPhase(
                  targetSwarm === 100
                    ? "Round 2 · 100-Agent Social Cascade"
                    : "Round 2 · Crew & Creator Cascade"
                );
              }
              return nextCount;
            });
          } else if (evt.type === "creator_broadcasts" && Array.isArray(evt.broadcasts)) {
            setCreatorBroadcasts(evt.broadcasts);
          } else if (evt.type === "swarm_batch" && Array.isArray(evt.agents)) {
            setCrowdAgents((prev) => [...prev, ...evt.agents]);
          } else if (evt.type === "contagion_r2" && Array.isArray(evt.reactions)) {
            setLiveReactions(evt.reactions);
            setActiveRound(2);
            setContagionFlipsCount(
              typeof evt.totalFlipsCount === "number"
                ? evt.totalFlipsCount
                : evt.coreFlipsCount || 0
            );
            if (evt.crewCaptainSummary) {
              setCrewCaptainSummary(evt.crewCaptainSummary);
            }
            if (Array.isArray(evt.reddit_threads)) {
              setRedditThreads(evt.reddit_threads);
            }
            setStreamPhase("Finalizing Elasticity & Consensus");
          } else if (
            (evt.type === "consensus" || evt.type === "complete") &&
            evt.result
          ) {
            const full = evt.result as ExtendedFocusGroupResult;
            setCurrentResult(full);
            if (Array.isArray(full.reactions)) {
              setLiveReactions(full.reactions);
            }
            if (Array.isArray(full.creator_broadcasts)) {
              setCreatorBroadcasts(full.creator_broadcasts);
            }
            if (Array.isArray(full.crowd_agents)) {
              setCrowdAgents(full.crowd_agents);
            }
            if (typeof full.contagion_flips_count === "number") {
              setContagionFlipsCount(full.contagion_flips_count);
            }
            if (Array.isArray(full.reddit_threads)) {
              setRedditThreads(full.reddit_threads);
            }
            setActiveRound(2);
          } else if (evt.type === "error") {
            setErrorBanner(
              evt.error || evt.message || "Focus group evaluation failed"
            );
          }
        }
      }
    } catch (err: any) {
      console.error("[Pressure Test Stream Error]:", err);
      setErrorBanner(err?.message || "Focus group pressure test failed");
    } finally {
      setIsRunning(false);
      setStreamPhase("");
    }
  };

  const runCounterfactualBranch = async (promptInjection: string) => {
    const existingReactions = liveReactions.filter(
      (r): r is FocusGroupReaction => r !== null && r !== undefined
    );
    const baseResult: Partial<ExtendedFocusGroupResult> = currentResult || {
      campaign_id: `fg-${Date.now()}`,
      franchise: initialFranchise || "NBA2K",
      creative_title: creativeTitle,
      proposed_spend: priceUsd,
      reactions: existingReactions,
      crowd_agents: crowdAgents,
      creator_broadcasts: creatorBroadcasts,
      contagion_flips_count: contagionFlipsCount,
      reddit_threads: redditThreads,
    };

    setIsRunning(true);
    setStreamPhase("Round 3 · What-If Rescue");
    setErrorBanner(null);

    try {
      const res = await fetch("/api/synthetic/focus-group/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "counterfactual_branch",
          existing_result: baseResult,
          r2_reactions: existingReactions,
          crowd_agents: crowdAgents,
          counterfactual_event: promptInjection,
          creative_title: creativeTitle,
          price_usd: priceUsd,
          franchise: initialFranchise || "NBA2K",
          swarm_size: swarmSize,
        }),
      });

      if (!res.ok || !res.body) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(
          errPayload.details ||
            errPayload.error ||
            `Round 3 What-If branch failed (HTTP ${res.status})`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const dataLine = frame
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const rawJson = dataLine.slice(6).trim();
          if (!rawJson) continue;

          let evt: any;
          try {
            evt = JSON.parse(rawJson);
          } catch {
            continue;
          }

          if (evt.type === "status" && evt.message) {
            setStreamPhase("Round 3 · What-If Rescue");
          } else if (evt.type === "contagion_r3" && Array.isArray(evt.reactions)) {
            setLiveReactions(evt.reactions);
            if (Array.isArray(evt.crowdAgents) && evt.crowdAgents.length > 0) {
              setCrowdAgents(evt.crowdAgents);
            }
            if (typeof evt.r3FlipsCount === "number") {
              setRound3FlipsCount(evt.r3FlipsCount);
            }
            if (evt.round3_tally || evt.r3Tally) {
              setRound3Tally(evt.round3_tally || evt.r3Tally);
            }
            setActiveRound(3);
            setStreamPhase("Finalizing R3 Rescue Consensus");
          } else if (
            (evt.type === "consensus" || evt.type === "complete") &&
            evt.result
          ) {
            const full = evt.result as ExtendedFocusGroupResult;
            setCurrentResult(full);
            if (Array.isArray(full.reactions)) {
              setLiveReactions(full.reactions);
            }
            if (Array.isArray(full.crowd_agents) && full.crowd_agents.length > 0) {
              setCrowdAgents(full.crowd_agents);
            }
            if (typeof full.round3_flips_count === "number") {
              setRound3FlipsCount(full.round3_flips_count);
            }
            if (full.round3_tally) {
              setRound3Tally(full.round3_tally);
            }
            if (Array.isArray(full.reddit_threads)) {
              setRedditThreads(full.reddit_threads);
            }
            setActiveRound(3);
          } else if (evt.type === "error") {
            setErrorBanner(
              evt.error || evt.message || "Round 3 counterfactual branch failed"
            );
          }
        }
      }
    } catch (err: any) {
      console.error("[R3 Counterfactual Branch Error]:", err);
      setErrorBanner(err?.message || "Round 3 What-If shock branch failed");
    } finally {
      setIsRunning(false);
      setStreamPhase("");
    }
  };

  const handleRunPressureTest = () => runPressureTestWithParams();

  const handleSelectCounterfactual = (
    chipOrId: CounterfactualChip | string,
    explicitPromptInjection?: string | null
  ) => {
    const chipId = typeof chipOrId === "string" ? chipOrId : chipOrId.id;
    const promptInjection =
      typeof chipOrId === "string"
        ? explicitPromptInjection ?? null
        : chipOrId.eventText;

    setSelectedCfId(chipId);
    setCounterfactualEvent(promptInjection);

    const hasExistingSimulation = Boolean(
      currentResult || liveReactions.some(Boolean)
    );

    if (hasExistingSimulation && !isRunning) {
      if (promptInjection) {
        runCounterfactualBranch(promptInjection);
      } else {
        setActiveRound(2);
      }
    }
  };

  if (!isOpen) return null;

  const activeReactions = liveReactions.filter(
    (r): r is FocusGroupReaction => r !== null && r !== undefined
  );
  const hasStreamedAny = activeReactions.length > 0;
  const hasRound3 =
    selectedCfId !== "baseline" ||
    Boolean(round3Tally) ||
    Boolean(currentResult?.round3_tally) ||
    activeReactions.some((r) => Boolean(r.round3_fsm_state));

  const getCoreState = (r: FocusGroupReaction, round: 1 | 2 | 3) =>
    round === 1
      ? r.round1_fsm_state || r.final_fsm_state
      : round === 3
        ? r.round3_fsm_state || r.final_fsm_state
        : r.final_fsm_state;

  const getCrowdState = (a: SwarmCrowdAgent, round: 1 | 2 | 3) =>
    round === 1
      ? a.round1_state
      : round === 3
        ? a.round3_state || a.final_fsm_state
        : a.final_fsm_state;

  const allCurrentStates = [
    ...activeReactions.map((r) => getCoreState(r, activeRound)),
    ...(swarmSize === 100 && crowdAgents.length > 0
      ? crowdAgents.map((a) => getCrowdState(a, activeRound))
      : []),
  ];

  const allR1States = [
    ...activeReactions.map((r) => getCoreState(r, 1)),
    ...(swarmSize === 100 && crowdAgents.length > 0
      ? crowdAgents.map((a) => getCrowdState(a, 1))
      : []),
  ];

  const allR2States = [
    ...activeReactions.map((r) => getCoreState(r, 2)),
    ...(swarmSize === 100 && crowdAgents.length > 0
      ? crowdAgents.map((a) => getCrowdState(a, 2))
      : []),
  ];

  const allR3States = [
    ...activeReactions.map((r) => getCoreState(r, 3)),
    ...(swarmSize === 100 && crowdAgents.length > 0
      ? crowdAgents.map((a) => getCrowdState(a, 3))
      : []),
  ];

  const totalDenominator = swarmSize;

  const buyCount = allCurrentStates.filter((s) => s === "PURCHASED").length;
  const evalCount = allCurrentStates.filter(
    (s) => s === "EVALUATING" || s === "ENGAGED_FREE"
  ).length;
  const passCount = allCurrentStates.filter((s) => s === "ABANDONED").length;
  const boycottCount = allCurrentStates.filter((s) => s === "BOYCOTT").length;

  const buyDeltaR2 =
    allR2States.filter((s) => s === "PURCHASED").length -
    allR1States.filter((s) => s === "PURCHASED").length;

  const buyDeltaR3 =
    allR3States.filter((s) => s === "PURCHASED").length -
    allR2States.filter((s) => s === "PURCHASED").length;

  // WTP Curve data
  const wtpCurve = currentResult?.wtp_curve || [
    { price: 2.99, conversion_pct: 68 },
    { price: 4.99, conversion_pct: 54 },
    { price: 7.99, conversion_pct: 42 },
    { price: 9.99, conversion_pct: 35 },
    { price: 12.99, conversion_pct: 26 },
    { price: 14.99, conversion_pct: 22 },
    { price: 19.99, conversion_pct: 12 },
    { price: 24.99, conversion_pct: 6 },
  ];

  const recommendedPrice =
    currentResult?.recommended_price ?? (priceUsd <= 9.99 ? 4.99 : 14.99);
  const highlightIdx = wtpCurve.findIndex(
    (p) => Math.abs(p.price - recommendedPrice) < 0.5
  );

  const backlashIndex = currentResult?.backlash_index ?? 18;
  const conversionLift = currentResult?.predicted_conversion_lift ?? 26.5;
  const crewMultiplier = currentResult?.crew_contagion_multiplier ?? 3.1;

  // Distribution bar percentages
  const evaluatedTotal = Math.max(1, allCurrentStates.length);
  const buyPct = hasStreamedAny ? Math.round((buyCount / evaluatedTotal) * 100) : 54;
  const evalPct = hasStreamedAny ? Math.round((evalCount / evaluatedTotal) * 100) : 24;
  const passPct = hasStreamedAny ? Math.round((passCount / evaluatedTotal) * 100) : 14;
  const boycottPct = hasStreamedAny
    ? Math.max(0, 100 - buyPct - evalPct - passPct)
    : 8;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="2K Courtside Focus Group"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-2 sm:p-4 font-sans"
    >
      <div className="glass-enter w-full max-w-[1360px] h-[92vh] bg-[#111115]/95 border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-2xl flex flex-col justify-between overflow-hidden text-chalk">
        {/* Top Chrome: 2 Calm, Purposeful Apple-Style Bars */}
        <div className="border-b border-white/[0.07] bg-white/[0.015] backdrop-blur-2xl px-5 py-3 space-y-2.5">
          {/* Bar 1: Title, Unified Segmented View/Scale Control, Round Control, Run CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-twok-red" />
                <h2 className="text-[15px] font-semibold text-white tracking-tight">
                  Focus Group
                </h2>
              </div>
              <span className="text-white/15">|</span>

              {/* Unified Apple Segmented Control: 20 Personas vs 100 Swarm */}
              <div
                role="tablist"
                aria-label="Simulation scale and view"
                className="relative flex items-center rounded-lg bg-black/50 p-0.5 border border-white/[0.08] text-xs"
              >
                {(
                  [
                    { size: 20 as const, label: "20 Personas" },
                    { size: 100 as const, label: "100 Swarm" },
                  ] as const
                ).map((tab) => {
                  const active = swarmSize === tab.size;
                  return (
                    <button
                      key={tab.size}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => setSwarmSize(tab.size)}
                      className={`relative z-10 px-3 py-1 rounded-md text-[11px] font-medium transition-colors active:scale-[0.97] ${
                        active ? "text-white" : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="fg-scale-pill"
                          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                          className="absolute inset-0 rounded-md bg-white/[0.12] border border-white/[0.12] shadow-sm -z-10"
                        />
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Apple Segmented Control: Round 1 (Isolated) vs Round 2 (Social Shift) vs Round 3 (What-If Rescue) */}
              <div
                role="tablist"
                aria-label="Contagion round"
                className="relative flex items-center rounded-lg bg-black/50 p-0.5 border border-white/[0.08] text-xs"
              >
                {(
                  [
                    { round: 1 as const, label: "R1 · Isolated" },
                    { round: 2 as const, label: "R2 · Social Shift" },
                    ...(hasRound3
                      ? [{ round: 3 as const, label: "R3 · What-If Rescue" }]
                      : []),
                  ] as const
                ).map((rTab) => {
                  const active = activeRound === rTab.round;
                  return (
                    <button
                      key={rTab.round}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => setActiveRound(rTab.round)}
                      className={`relative z-10 px-3 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 active:scale-[0.97] ${
                        active ? "text-white" : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="fg-round-pill"
                          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                          className="absolute inset-0 rounded-md bg-white/[0.12] border border-white/[0.12] shadow-sm -z-10"
                        />
                      )}
                      {rTab.round === 3 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-win-green shrink-0" />
                      )}
                      <span>{rTab.label}</span>
                      {rTab.round === 2 && contagionFlipsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-win-green/20 text-win-green font-mono font-semibold text-[10px] tabular">
                          +{contagionFlipsCount}
                        </span>
                      )}
                      {rTab.round === 3 && round3FlipsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-win-green/20 text-win-green font-mono font-semibold text-[10px] tabular">
                          +{round3FlipsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right CTA & Close */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRunPressureTest}
                disabled={isRunning}
                className="relative overflow-hidden flex items-center gap-2 px-4 py-1.5 rounded-lg bg-twok-red hover:bg-twok-red-deep disabled:opacity-75 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.97]"
              >
                {isRunning ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="font-mono text-[11px] tabular">
                      {streamPhase === "Round 3 · What-If Rescue" ||
                      streamPhase === "Finalizing R3 Rescue Consensus"
                        ? streamPhase
                        : streamProgress < 20
                          ? `Round 1 (${streamProgress}/20)`
                          : streamPhase || "Round 2 Cascade"}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>
                      {isBattleMode
                        ? `Run A/B Battle ($${priceUsd.toFixed(2)} vs $${(
                            altPriceUsd ?? 19.99
                          ).toFixed(2)})`
                        : `Run ${swarmSize}-Agent Simulation`}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {errorBanner && (
            <div className="rounded-lg border border-loss-red/30 bg-loss-red/10 px-3 py-1.5 flex items-center justify-between text-xs text-loss-red">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-loss-red/80 hover:text-loss-red font-mono text-[10px] uppercase"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Bar 2: Clean Offer Presets + Inline Custom Edit + Counterfactual Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            {/* Left: Offer Presets & Custom Price/Title Trigger */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESETS.map((p) => {
                const isSelected =
                  creativeTitle === p.title && priceUsd === p.priceUsd;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97] ${
                      isSelected
                        ? "bg-white text-court-black font-semibold shadow-sm"
                        : "bg-white/[0.04] text-white/65 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsBattleMode((prev) => !prev);
                  if (!altPriceUsd) setAltPriceUsd(19.99);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97] border ${
                  isBattleMode
                    ? "bg-vc-gold/15 text-vc-gold border-vc-gold/40"
                    : "bg-white/[0.03] text-white/55 border-white/[0.07] hover:text-white"
                }`}
              >
                <Swords className="w-3 h-3" />
                <span>A/B Battle</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditingCustomOffer((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all active:scale-[0.97] ${
                  isEditingCustomOffer
                    ? "bg-white/15 text-white"
                    : "text-white/45 hover:text-white/80"
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Custom</span>
              </button>
            </div>

            {/* Right: Counterfactual What-If Modifier Pills */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/35 mr-1 shrink-0">
                What-If:
              </span>
              {COUNTERFACTUAL_CHIPS.map((chip) => {
                const active = selectedCfId === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleSelectCounterfactual(chip.id, chip.eventText)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap active:scale-[0.97] border ${
                      active
                        ? "bg-vc-gold/15 text-vc-gold border-vc-gold/40"
                        : "bg-transparent text-white/50 border-white/[0.07] hover:text-white/85 hover:border-white/20"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Collapsible Custom Offer Input Row */}
          {isEditingCustomOffer && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={creativeTitle}
                onChange={(e) => setCreativeTitle(e.target.value)}
                placeholder="Custom offer title..."
                className="flex-1 rounded-lg border border-white/[0.1] bg-black/50 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
              />
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.1] bg-black/50 px-2.5 py-1.5">
                <span className="text-xs text-white/40">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-transparent text-xs text-white font-mono tabular focus:outline-none"
                />
              </div>
              {isBattleMode && (
                <div className="flex items-center gap-1 rounded-lg border border-vc-gold/30 bg-black/50 px-2.5 py-1.5">
                  <span className="text-[10px] text-vc-gold font-mono">vs $</span>
                  <input
                    type="number"
                    step="0.01"
                    value={altPriceUsd ?? 19.99}
                    onChange={(e) => setAltPriceUsd(parseFloat(e.target.value) || 19.99)}
                    className="w-16 bg-transparent text-xs text-vc-gold font-mono tabular focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Workspace: 8-Col Persona/Swarm Stage + 4-Col Zero-Scroll Decision Rail */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 py-3.5 overflow-hidden min-h-0">
          {/* Left Column (8 Cols): Active Offer Context + 20 Personas OR 100 Swarm */}
          <div className="lg:col-span-8 flex flex-col h-full overflow-hidden min-h-0">
            {/* Subtle Subheader: Active Offer Summary + Interaction Hint */}
            <div className="flex items-center justify-between pb-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white/90 font-medium truncate">
                  {creativeTitle}
                </span>
                <span className="font-mono text-xs font-semibold text-vc-gold shrink-0 tabular">
                  ${priceUsd.toFixed(2)}
                  {isBattleMode ? ` vs $${(altPriceUsd ?? 19.99).toFixed(2)}` : ""}
                </span>
              </div>
              <span className="text-[11px] text-white/40 shrink-0 ml-2">
                {swarmSize === 20
                  ? "Select any player for 1-on-1 interview or 3-Way Debate"
                  : "100 Swarm · Click any cell for 1-on-1 or 3-Way Debate"}
              </span>
            </div>

            {/* Creator Megaphone Strip (when Round 2 broadcasts arrive) */}
            {creatorBroadcasts.length > 0 && (
              <div className="mb-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {creatorBroadcasts.map((cb) => {
                  const dotColor =
                    cb.stance === "ENDORSE"
                      ? "text-win-green"
                      : cb.stance === "CALLOUT"
                        ? "text-loss-red"
                        : "text-vc-gold";
                  return (
                    <div
                      key={cb.creator_id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-semibold text-white/85 flex items-center gap-1.5">
                          <Radio className={`w-3 h-3 ${dotColor}`} />
                          {cb.handle}
                        </span>
                        <span className={`uppercase font-semibold ${dotColor}`}>
                          {cb.stance}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 line-clamp-1 mt-0.5">
                        &ldquo;{cb.headline}&rdquo;
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stage Content: 20 Personas Grid OR 100-Agent Swarm Matrix */}
            {swarmSize === 20 ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {sampledPersonas.slice(0, 20).map((p: any, idx: number) => {
                    const reaction =
                      liveReactions[idx] || currentResult?.reactions?.[idx] || null;
                    const cardArchetype = reaction?.archetype || p.archetype;
                    const cardGamerTag = reaction?.gamer_tag || p.gamer_tag;
                    const crewName =
                      reaction?.crew_name || p.crew_name || "Bucket Getters";
                    const rawCreator =
                      reaction?.creator_handle || p.creator_handle || "@Agent00";
                    const creatorHandle = (() => {
                      const clean = String(rawCreator)
                        .replace(/^creator-/i, "")
                        .replace(/^@/, "");
                      const map: Record<string, string> = {
                        chrissmoove: "@ChrisSmoove",
                        powerdf: "@PowerDF",
                        cashnasty: "@CashNasty",
                        flightreacts: "@FlightReacts",
                        agent00: "@Agent00",
                        troydan: "@Troydan",
                        dbg: "@DBG",
                        kot4q: "@KOT4Q",
                        moxsy: "@Moxsy",
                        assemble: "@Assemble",
                        tydebo: "@Tydebo",
                      };
                      return map[clean.toLowerCase()] || `@${clean}`;
                    })();
                    const bColor = archetypeColor(cardArchetype);

                    const r1State =
                      reaction?.round1_fsm_state ||
                      reaction?.final_fsm_state ||
                      "EVALUATING";
                    const r2State = reaction?.final_fsm_state || "EVALUATING";
                    const r3State = reaction?.round3_fsm_state || r2State;
                    const state =
                      activeRound === 1
                        ? r1State
                        : activeRound === 3
                          ? r3State
                          : r2State;

                    const flippedInR2 = Boolean(
                      activeRound === 2 &&
                        reaction?.contagion_flipped &&
                        r1State !== r2State
                    );
                    const rescuedInR3 = Boolean(
                      activeRound === 3 &&
                        r2State !== r3State &&
                        r3State === "PURCHASED"
                    );
                    const flippedInR3 = Boolean(
                      activeRound === 3 &&
                        (reaction?.round3_flipped || r2State !== r3State)
                    );
                    const flipped = activeRound === 3 ? flippedInR3 : flippedInR2;

                    const provenanceLabel = (() => {
                      if (activeRound === 3 && flippedInR3) {
                        const chipLabel =
                          COUNTERFACTUAL_CHIPS.find((c) => c.id === selectedCfId)
                            ?.label || "What-If";
                        return `↳ via ${chipLabel}`;
                      }
                      if (
                        activeRound >= 2 &&
                        (reaction?.contagion_flipped || r1State !== r2State)
                      ) {
                        if (reaction?.contagion_source_tag) {
                          return `↳ via ${reaction.contagion_source_tag}`;
                        }
                        if (reaction?.contagion_driver === "REDDIT_THREAD") {
                          return "↳ via r/NBA2K";
                        }
                        if (reaction?.contagion_driver === "CREATOR_STREAM") {
                          return `↳ via ${creatorHandle}`;
                        }
                        if (reaction?.contagion_driver === "COUNTERFACTUAL") {
                          return "↳ via What-If";
                        }
                        if (reaction?.contagion_driver === "CREW_CAPTAIN") {
                          return `↳ via ${crewName} Capt`;
                        }
                      }
                      return null;
                    })();

                    const displayedQuote =
                      activeRound === 1
                        ? reaction?.round1_quote || reaction?.verbatim_quote
                        : activeRound === 3
                          ? reaction?.round3_quote || reaction?.verbatim_quote
                          : reaction?.verbatim_quote;

                    const displayedWtp =
                      activeRound === 1
                        ? reaction?.round1_wtp_usd ?? reaction?.willingness_to_pay_usd
                        : activeRound === 3
                          ? reaction?.round3_wtp_usd ?? reaction?.willingness_to_pay_usd
                          : reaction?.willingness_to_pay_usd;

                    const statePillStyle =
                      state === "PURCHASED"
                        ? "bg-win-green/15 text-win-green border-win-green/30"
                        : state === "ABANDONED"
                          ? "bg-white/[0.06] text-white/55 border-white/10"
                          : state === "BOYCOTT"
                            ? "bg-loss-red/15 text-loss-red border-loss-red/30"
                            : "bg-vc-gold/15 text-vc-gold border-vc-gold/30";

                    const stateLabel =
                      state === "PURCHASED"
                        ? "BUY"
                        : state === "ABANDONED"
                          ? "PASS"
                          : state === "BOYCOTT"
                            ? "BOYCOTT"
                            : "EVALUATE";

                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setInterrogatePersona(reaction || (p as FocusGroupReaction))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setInterrogatePersona(
                              reaction || (p as FocusGroupReaction)
                            );
                          }
                        }}
                        className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-100 ease-out active:scale-[0.985] select-none flex flex-col justify-between gap-2 ${
                          rescuedInR3 || flipped
                            ? "border-win-green/35 bg-win-green/[0.03] hover:bg-win-green/[0.06]"
                            : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.045] hover:border-white/[0.14]"
                        }`}
                      >
                        {/* Top Row: Avatar Dot + GamerTag + Archetype vs Verdict Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                style={{ backgroundColor: bColor }}
                                className="w-2 h-2 rounded-full shrink-0"
                              />
                              <span className="font-semibold text-xs text-white tracking-tight truncate">
                                {cardGamerTag}
                              </span>
                            </div>
                            <span className="text-[11px] text-white/45 block truncate pl-4">
                              {archetypeLabel(cardArchetype)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {rescuedInR3 || flippedInR3 ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-win-green/15 text-win-green border border-win-green/30 flex items-center gap-0.5">
                                <span>R2 → R3</span>
                              </span>
                            ) : flippedInR2 ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-white/[0.07] text-white/70 flex items-center gap-0.5">
                                <span>
                                  {r1State === "ABANDONED"
                                    ? "PASS"
                                    : r1State === "BOYCOTT"
                                      ? "BOYC"
                                      : "EVAL"}
                                </span>
                                <ArrowRight className="w-2.5 h-2.5 text-win-green" />
                              </span>
                            ) : null}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wide border ${statePillStyle}`}
                            >
                              {stateLabel}
                            </span>
                          </div>
                        </div>

                        {/* Middle: Verbatim Quote or Build Summary */}
                        <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                          {displayedQuote ? (
                            <>&ldquo;{displayedQuote}&rdquo;</>
                          ) : (
                            <span className="text-white/50">
                              {p.myplayer_ovr || 85} OVR ·{" "}
                              {p.myplayer_build || "2-Way 3-Level Scorer"}
                            </span>
                          )}
                        </p>

                        {/* Bottom Metadata Line: Causal Provenance · Crew · Creator · WTP */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-white/45 pt-1 border-t border-white/[0.05] gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            {provenanceLabel && (
                              <span
                                title={
                                  reaction?.contagion_source_snippet ||
                                  provenanceLabel
                                }
                                className="px-1.5 py-0.2 rounded bg-win-green/15 text-win-green border border-win-green/25 text-[9px] font-semibold shrink-0 truncate max-w-[145px]"
                              >
                                {provenanceLabel}
                              </span>
                            )}
                            <span className="truncate">
                              {displayedQuote && !provenanceLabel
                                ? `${p.myplayer_ovr || 85} OVR · `
                                : ""}
                              {crewName} · {creatorHandle}
                            </span>
                          </div>
                          <span className="text-white/75 shrink-0 ml-1 tabular">
                            WTP $
                            <TabularNumber
                              value={
                                displayedWtp ??
                                (Number(p.vc_spend_90d ?? p.spend ?? 0) >= 120
                                  ? 14.99
                                  : Number(p.vc_spend_90d ?? p.spend ?? 0) >= 50
                                    ? 9.99
                                    : 4.99)
                              }
                              decimals={2}
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </StaggerList>
              </div>
            ) : (
              /* 100-Agent Swarm Matrix (20 Core + 80 Cohort Swarm — Always 100 Clickable Cells) */
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {[
                    ...sampledPersonas.slice(0, 20).map((p, idx) => {
                      const r = liveReactions[idx] || currentResult?.reactions?.[idx];
                      const r1 = r?.round1_fsm_state || r?.final_fsm_state || "EVALUATING";
                      const r2 = r?.final_fsm_state || "EVALUATING";
                      const r3 = r?.round3_fsm_state || r2;
                      return {
                        id: p.player_id || `core-${idx}`,
                        gamer_tag: r?.gamer_tag || p.gamer_tag,
                        ovr: p.myplayer_ovr || 85,
                        crew_name: r?.crew_name || p.crew_name || "Bucket Getters",
                        creator_handle:
                          r?.creator_handle || p.creator_handle || "@Agent00",
                        r1,
                        r2,
                        r3,
                        flipped: Boolean(r?.contagion_flipped),
                        r3Flipped: Boolean(r?.round3_flipped || r2 !== r3),
                        isEvaluated: Boolean(r),
                        personaRef:
                          r ||
                          ({
                            player_id: p.player_id,
                            gamer_tag: p.gamer_tag,
                            archetype: p.archetype,
                            crew_name: p.crew_name,
                            creator_handle: p.creator_handle,
                            myplayer_ovr: p.myplayer_ovr || 85,
                            round1_fsm_state: "EVALUATING",
                            final_fsm_state: "EVALUATING",
                            willingness_to_pay_usd: 9.99,
                            verbatim_quote: `Evaluating ${creativeTitle} with ${p.crew_name || "the squad"}.`,
                            authenticity_rating: 0.92,
                            churn_risk_score: 0.25,
                            sentiment_score: 0.5,
                          } as FocusGroupReaction),
                      };
                    }),
                    ...displayCrowdAgents.map((a) => {
                      const r2 = a.final_fsm_state;
                      const r3 = a.round3_state || r2;
                      const crowdReaction: FocusGroupReaction = {
                        player_id: a.player_id,
                        gamer_tag: a.gamer_tag,
                        archetype: a.archetype,
                        crew_name: a.crew_name,
                        creator_handle: a.creator_handle,
                        myplayer_ovr: a.myplayer_ovr,
                        round1_fsm_state: a.round1_state,
                        final_fsm_state: a.final_fsm_state,
                        round3_fsm_state: a.round3_state,
                        round3_flipped: a.round3_flipped,
                        contagion_flipped: a.contagion_flipped,
                        contagion_driver: a.contagion_driver,
                        contagion_source_tag: a.contagion_source_tag,
                        willingness_to_pay_usd: a.willingness_to_pay_usd,
                        verbatim_quote:
                          a.verbatim_quote ||
                          (r3 === "PURCHASED"
                            ? `Locked in with ${a.crew_name} — value checks out at $${a.willingness_to_pay_usd.toFixed(2)}.`
                            : r3 === "BOYCOTT"
                              ? `Holding out with ${a.crew_name} until odds and VC value improve.`
                              : `Checking with ${a.crew_name} and ${a.creator_handle} before spending VC.`),
                        authenticity_rating: 0.91,
                        churn_risk_score: 0.28,
                        sentiment_score:
                          r3 === "PURCHASED" ? 0.78 : r3 === "BOYCOTT" ? 0.18 : 0.48,
                      };
                      return {
                        id: a.player_id,
                        gamer_tag: a.gamer_tag,
                        ovr: a.myplayer_ovr,
                        crew_name: a.crew_name,
                        creator_handle: a.creator_handle,
                        r1: a.round1_state,
                        r2,
                        r3,
                        flipped: a.contagion_flipped,
                        r3Flipped: Boolean(a.round3_flipped || r2 !== r3),
                        isEvaluated: crowdAgents.length > 0,
                        personaRef: crowdReaction,
                      };
                    }),
                  ].map((agent, i) => {
                    const st =
                      activeRound === 1
                        ? agent.r1
                        : activeRound === 3
                          ? agent.r3
                          : agent.r2;
                    const rescuedInR3 =
                      activeRound === 3 &&
                      agent.r2 !== agent.r3 &&
                      agent.r3 === "PURCHASED";
                    const isHighlightedFlip =
                      (activeRound === 2 && agent.flipped) ||
                      (activeRound === 3 && (agent.r3Flipped || rescuedInR3));

                    const dotColor = !agent.isEvaluated
                      ? "bg-white/25"
                      : st === "PURCHASED"
                        ? "bg-win-green"
                        : st === "BOYCOTT"
                          ? "bg-loss-red"
                          : st === "ABANDONED"
                            ? "bg-white/30"
                            : "bg-vc-gold";

                    const shortVerdict = !agent.isEvaluated
                      ? "READY"
                      : st === "PURCHASED"
                        ? "BUY"
                        : st === "BOYCOTT"
                          ? "BOYC"
                          : st === "ABANDONED"
                            ? "PASS"
                            : "EVAL";

                    return (
                      <div
                        key={`${agent.id}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setInterrogatePersona(agent.personaRef)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setInterrogatePersona(agent.personaRef);
                          }
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-mono flex flex-col justify-between transition-colors cursor-pointer hover:border-white/25 active:scale-[0.98] ${
                          isHighlightedFlip
                            ? "border-win-green/35 bg-win-green/[0.05]"
                            : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-white/90 truncate font-sans text-[11px]">
                            {agent.gamer_tag}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                        </div>
                        <div className="flex items-center justify-between pt-0.5 text-[9px] text-white/45">
                          <span className="truncate">
                            {agent.ovr} · {agent.crew_name}
                          </span>
                          <span
                            className={`font-semibold shrink-0 ml-1 ${
                              isHighlightedFlip ? "text-win-green" : "text-white/65"
                            }`}
                          >
                            {rescuedInR3 ? `R2→R3 ${shortVerdict}` : shortVerdict}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (4 Cols): 3 Core Modules — Fits 100% Above the Fold */}
          <div className="lg:col-span-4 flex flex-col h-full justify-between gap-3 min-h-0 overflow-hidden">
            {/* Module 1: Verdict Breakdown & Social Contagion Lift */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-3 shrink-0">
              {/* 3 Hero KPIs */}
              <div className="grid grid-cols-3 gap-2 pb-2.5 border-b border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-white/45 block">
                    Conversion Lift
                  </span>
                  <span className="text-lg font-bold text-win-green tracking-tight font-mono tabular">
                    +<TabularNumber value={conversionLift} decimals={1} />%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/45 block">
                    Crew Cascade
                  </span>
                  <span className="text-lg font-bold text-white tracking-tight font-mono tabular">
                    <TabularNumber value={crewMultiplier} decimals={1} />x
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/45 block">
                    Backlash Risk
                  </span>
                  <span
                    className={`text-lg font-bold tracking-tight font-mono tabular ${
                      backlashIndex > 35 ? "text-loss-red" : "text-white/90"
                    }`}
                  >
                    <TabularNumber value={backlashIndex} />%
                  </span>
                </div>
              </div>

              {/* Segmented Distribution Bar */}
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5">
                  <div
                    style={{ width: `${buyPct}%` }}
                    className="h-full bg-win-green transition-all duration-300"
                  />
                  <div
                    style={{ width: `${evalPct}%` }}
                    className="h-full bg-vc-gold transition-all duration-300"
                  />
                  <div
                    style={{ width: `${passPct}%` }}
                    className="h-full bg-white/30 transition-all duration-300"
                  />
                  <div
                    style={{ width: `${boycottPct}%` }}
                    className="h-full bg-loss-red transition-all duration-300"
                  />
                </div>

                {/* 4 Compact Verdict Tallies */}
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2 py-1">
                    <div className="flex items-center justify-between text-[9px] text-win-green">
                      <span>BUY</span>
                      {activeRound === 2 && buyDeltaR2 !== 0 && (
                        <span>{buyDeltaR2 > 0 ? `+${buyDeltaR2}` : buyDeltaR2}</span>
                      )}
                      {activeRound === 3 && buyDeltaR3 !== 0 && (
                        <span>{buyDeltaR3 > 0 ? `+${buyDeltaR3}` : buyDeltaR3}</span>
                      )}
                    </div>
                    <div className="font-bold text-white tabular">
                      <TabularNumber value={buyCount} />
                      <span className="text-white/35 text-[10px]">/{totalDenominator}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2 py-1">
                    <div className="text-[9px] text-vc-gold">EVAL</div>
                    <div className="font-bold text-white tabular">
                      <TabularNumber value={evalCount} />
                      <span className="text-white/35 text-[10px]">/{totalDenominator}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2 py-1">
                    <div className="text-[9px] text-white/50">PASS</div>
                    <div className="font-bold text-white/80 tabular">
                      <TabularNumber value={passCount} />
                      <span className="text-white/35 text-[10px]">/{totalDenominator}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2 py-1">
                    <div className="text-[9px] text-loss-red">BOYCOTT</div>
                    <div className="font-bold text-white tabular">
                      <TabularNumber value={boycottCount} />
                      <span className="text-white/35 text-[10px]">/{totalDenominator}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1-Sentence Contagion Takeaway */}
              <p className="text-[11px] text-white/60 leading-snug line-clamp-2">
                {currentResult?.contagion_summary ||
                  crewCaptainSummary ||
                  "Crew Captains claiming in Round 1 drive a 3.1x conversion cascade across hesitant Rec and Pro-Am squadmates in Round 2."}
              </p>
            </div>

            {/* Module 2: Price Elasticity & WTP Curve (+ Inline A/B Battle Comparison) */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white/90 tracking-tight">
                  Price Elasticity
                </span>
                <span className="text-[10px] font-mono text-vc-gold bg-vc-gold/10 px-2 py-0.5 rounded-md border border-vc-gold/20 tabular">
                  Optimal ${recommendedPrice.toFixed(2)}
                </span>
              </div>

              <Sparkline
                values={wtpCurve.map((p) => p.conversion_pct)}
                labels={wtpCurve.map((p) => `$${p.price}`)}
                width={300}
                height={52}
                stroke="var(--twok-red)"
                highlightIndex={highlightIdx >= 0 ? highlightIdx : 1}
                highlightLabel={`$${recommendedPrice}`}
              />

              {isBattleMode && (
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-white/[0.06] text-[11px]">
                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2.5 py-1.5 flex items-center justify-between">
                    <span className="font-mono text-white/60">
                      ${priceUsd.toFixed(2)}
                    </span>
                    <span className="font-mono font-semibold text-win-green tabular">
                      +{conversionLift.toFixed(1)}% lift
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/30 border border-white/[0.05] px-2.5 py-1.5 flex items-center justify-between">
                    <span className="font-mono text-white/60">
                      ${(altPriceUsd ?? 19.99).toFixed(2)}
                    </span>
                    <span className="font-mono font-semibold text-loss-red tabular">
                      +
                      {(
                        currentResult?.alt_result?.predicted_conversion_lift ??
                        conversionLift * 0.55
                      ).toFixed(1)}
                      % lift
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Module 3: Live Community Pulse (Fits cleanly in remaining rail height) */}
            <RedditPulseCard
              echoThreads={
                currentResult?.reddit_threads && currentResult.reddit_threads.length > 0
                  ? currentResult.reddit_threads
                  : redditThreads
              }
            />
          </div>
        </div>

        {/* Footer: Calm Status + Studio & Brief Handoff */}
        <div className="border-t border-white/[0.07] px-5 py-3 bg-white/[0.01] flex items-center justify-between gap-4">
          <div className="text-xs text-white/50 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning ? "bg-vc-gold animate-pulse" : "bg-win-green"
              }`}
            />
            <span>
              {hasStreamedAny
                ? `${totalDenominator}-agent simulation complete · +${conversionLift.toFixed(
                    1
                  )}% conversion lift (${contagionFlipsCount} R2 social flips${
                    round3FlipsCount > 0 ? ` · +${round3FlipsCount} R3 What-If rescues` : ""
                  })`
                : `Ready · ${swarmSize}-agent 2-round social contagion simulation`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCreativeStudio && (
              <button
                type="button"
                onClick={() => onOpenCreativeStudio(creativeTitle)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/90 text-xs font-medium transition-all active:scale-[0.97]"
              >
                <Palette className="w-3.5 h-3.5 text-twok-red" />
                <span>Creative Studio</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGeneratingBrief}
              onClick={() => {
                if (currentResult) {
                  onGenerateBrief(currentResult);
                } else {
                  const defaultRes: FocusGroupResult = {
                    campaign_id: `fg-${Date.now()}`,
                    franchise: initialFranchise || "NBA2K",
                    creative_title: creativeTitle,
                    target_cohort_query: cohortContext?.query,
                    proposed_spend: priceUsd,
                    target_roas: 3.4,
                    reactions: sampledPersonas.map((p) => ({
                      player_id: p.player_id,
                      gamer_tag: p.gamer_tag,
                      archetype: p.archetype,
                      willingness_to_pay_usd: 4.99,
                      final_fsm_state: "PURCHASED",
                      authenticity_rating: 0.94,
                      churn_risk_score: 0.22,
                      verbatim_quote: "Solid value for the squad.",
                      sentiment_score: 0.75,
                    })),
                    consensus_summary: `Strong cohort alignment for ${creativeTitle} at $${priceUsd.toFixed(
                      2
                    )}.`,
                    predicted_conversion_lift: 26.5,
                    sentiment_decay_index: 0.12,
                    churn_mitigation_lift: 18.4,
                    projected_revenue_impact_usd: 145000,
                  };
                  onGenerateBrief(defaultRes);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-court-black hover:bg-white/90 text-xs font-semibold shadow-sm transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {isGeneratingBrief ? "Generating Brief..." : "Campaign Brief"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 1-on-1 Player Interview & 3-Way Crew Debate Sheet */}
      <PersonaInterrogationDrawer
        persona={interrogatePersona}
        onClose={() => setInterrogatePersona(null)}
        offerTitle={creativeTitle}
        priceUsd={priceUsd}
        panelCandidates={
          activeReactions.length > 0
            ? activeReactions
            : (sampledPersonas as FocusGroupReaction[])
        }
        counterfactualEvent={counterfactualEvent}
      />
    </div>
  );
}
