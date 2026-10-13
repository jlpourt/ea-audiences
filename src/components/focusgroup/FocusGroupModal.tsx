"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Play,
  RotateCw,
  Swords,
  AlertTriangle,
  FileText,
  Palette,
  Flame,
  Users,
  Radio,
  Zap,
  ArrowRight,
  Sliders,
} from "lucide-react";
import {
  GraphNode,
  CohortContext,
  GameFranchise,
  GraphData,
  FocusGroupResult,
  FocusGroupReaction,
  CreatorBroadcast,
  SwarmCrowdAgent,
  MigrationCurvePoint,
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
    title: "Crew Re-Up Bundle",
    priceUsd: 4.99,
    label: "$4.99 Crew Re-Up",
  },
  {
    id: "galaxy-opal-battle",
    title: "Galaxy Opal Deluxe Pack",
    priceUsd: 14.99,
    altPriceUsd: 19.99,
    label: "$14.99 vs $19.99 Opal Pack Battle",
  },
  {
    id: "hof-pass",
    title: "Season Pass Hall of Fame Edition",
    priceUsd: 19.99,
    label: "$19.99 Season Pass HoF",
  },
  {
    id: "2k26-loyalty-upgrade",
    title: "NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC",
    priceUsd: 69.99,
    label: "$69.99 2K26 → 2K27 Upgrade",
  },
];

const COUNTERFACTUAL_CHIPS: CounterfactualChip[] = [
  {
    id: "baseline",
    label: "Baseline Offer",
    eventText: null,
  },
  {
    id: "crew-vc-bonus",
    label: "+15K VC Squad Bonus (3+ Crew Upgrade)",
    eventText:
      "Add a +15,000 VC Squad Bonus and 2x Rec Rep multiplier when 3 or more Crew mates upgrade or claim together",
  },
  {
    id: "opal-topper",
    label: "Guaranteed Opal Topper (5.5% Odds)",
    eventText:
      "Include 1 Guaranteed 97+ OVR Galaxy Opal Topper card and raise pack probability to 5.5% verified odds",
  },
  {
    id: "creator-costream",
    label: "@Agent00 + @KOT4Q Co-Stream Drop",
    eventText:
      "Launch with a live @Agent00 and @KOT4Q Creator Locker Code co-stream granting an exclusive City Jersey + 2hr Double Rep",
  },
  {
    id: "rebirth-carryover",
    label: "2K26 Cap Breaker + Rebirth Carryover",
    eventText:
      "Grant NBA 2K26 veterans instant 90 OVR Rebirth progression plus +2 Cap Breaker carryover tokens in NBA 2K27 Season 2",
  },
];

export function FocusGroupModal({
  isOpen,
  onClose,
  targetNode,
  cohortContext,
  selectedGame,
  graphData,
  initialResult,
  initialCreativeTitle = "Crew Re-Up Bundle",
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

  // MiroFish Plus-Up States
  const [swarmSize, setSwarmSize] = useState<20 | 100>(100);
  const [activeRound, setActiveRound] = useState<1 | 2>(2);
  const [leftTab, setLeftTab] = useState<"core20" | "swarm100">("core20");
  const [selectedCfId, setSelectedCfId] = useState<string>("baseline");
  const [counterfactualEvent, setCounterfactualEvent] = useState<string | null>(null);
  const [creatorBroadcasts, setCreatorBroadcasts] = useState<CreatorBroadcast[]>([]);
  const [crowdAgents, setCrowdAgents] = useState<SwarmCrowdAgent[]>([]);
  const [contagionFlipsCount, setContagionFlipsCount] = useState<number>(0);
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

  // Selected persona for interrogation drawer
  const [interrogatePersona, setInterrogatePersona] = useState<FocusGroupReaction | null>(null);

  // Load 20 live Spanner personas when modal opens if graph has fewer than 20
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

  // Synchronize initial result or preset when opened
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
      myplayer_build: n.game_telemetry?.myplayer_build ?? "Balanced Build",
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

  // Display cards before/during pressure test
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

  const handleSelectPreset = (p: OfferPreset) => {
    setCreativeTitle(p.title);
    setPriceUsd(p.priceUsd);
    if (p.altPriceUsd) {
      setAltPriceUsd(p.altPriceUsd);
      setIsBattleMode(true);
    } else {
      setAltPriceUsd(null);
      setIsBattleMode(false);
    }
  };

  const runPressureTestWithParams = async (overrideCfEvent?: string | null) => {
    const activeCf = overrideCfEvent !== undefined ? overrideCfEvent : counterfactualEvent;
    setIsRunning(true);
    setStreamProgress(0);
    setStreamPhase("Round 1: Isolated Persona Eval");
    setActiveRound(1);
    setErrorBanner(null);
    setCurrentResult(null);
    setCreatorBroadcasts([]);
    setCrowdAgents([]);
    setContagionFlipsCount(0);
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
          swarm_size: swarmSize,
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
                  swarmSize === 100
                    ? "Round 2: Crew Contagion + 80 Crowd Swarm..."
                    : "Round 2: Crew & Creator Contagion..."
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
            setStreamPhase("Synthesizing Consensus & Migration Curve...");
          } else if (evt.type === "consensus" && evt.result) {
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

  const handleRunPressureTest = () => runPressureTestWithParams();

  const handleSelectCounterfactual = (chip: CounterfactualChip) => {
    setSelectedCfId(chip.id);
    setCounterfactualEvent(chip.eventText);
    if (currentResult && !isRunning) {
      runPressureTestWithParams(chip.eventText);
    }
  };

  if (!isOpen) return null;

  // Verdict tallies (live during SSE stream + Round 1 vs Round 2 toggle + N=100 Swarm)
  const activeReactions = liveReactions.filter(
    (r): r is FocusGroupReaction => r !== null && r !== undefined
  );

  const getCoreState = (r: FocusGroupReaction, round: 1 | 2) =>
    round === 1 ? r.round1_fsm_state || r.final_fsm_state : r.final_fsm_state;

  const getCrowdState = (a: SwarmCrowdAgent, round: 1 | 2) =>
    round === 1 ? a.round1_state : a.final_fsm_state;

  const allCurrentStates = [
    ...activeReactions.map((r) => getCoreState(r, activeRound)),
    ...(swarmSize === 100 ? crowdAgents.map((a) => getCrowdState(a, activeRound)) : []),
  ];

  const allR1States = [
    ...activeReactions.map((r) => getCoreState(r, 1)),
    ...(swarmSize === 100 ? crowdAgents.map((a) => getCrowdState(a, 1)) : []),
  ];

  const allR2States = [
    ...activeReactions.map((r) => getCoreState(r, 2)),
    ...(swarmSize === 100 ? crowdAgents.map((a) => getCrowdState(a, 2)) : []),
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
  const boycottDeltaR2 =
    allR2States.filter((s) => s === "BOYCOTT").length -
    allR1States.filter((s) => s === "BOYCOTT").length;

  const coreFlipsCount = activeReactions.filter((r) => r.contagion_flipped).length;

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

  // Season 1 -> Season 3 Migration Curve
  const migrationCurve: MigrationCurvePoint[] = currentResult?.migration_curve || [
    { stage: "S1 Wk4", isolated_pct: 24, contagion_pct: 36 },
    { stage: "S1 Cliff", isolated_pct: 31, contagion_pct: 54 },
    { stage: "S2 Tip-Off", isolated_pct: 38, contagion_pct: 68 },
    { stage: "S2 Holiday", isolated_pct: 44, contagion_pct: 79 },
    { stage: "S3 All-Star", isolated_pct: 49, contagion_pct: 86 },
  ];

  const recommendedPrice = currentResult?.recommended_price ?? (priceUsd <= 9.99 ? 4.99 : 14.99);
  const highlightIdx = wtpCurve.findIndex((p) => Math.abs(p.price - recommendedPrice) < 0.5);

  const backlashIndex = currentResult?.backlash_index ?? 18;
  const conversionLift = currentResult?.predicted_conversion_lift ?? 26.5;
  const crewMultiplier = currentResult?.crew_contagion_multiplier ?? 3.1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="2K Courtside Focus Group"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 sm:p-4 font-sans"
    >
      <div className="glass-enter w-full max-w-7xl h-[94vh] bg-[#121216] border border-white/10 rounded-2xl flex flex-col justify-between shadow-2xl overflow-hidden text-chalk">
        {/* Top Bar: Title, Swarm Scale Toggle, Round Toggle, Run Trigger */}
        <div className="border-b border-white/10 px-4 py-3 bg-white/[0.01] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold text-twok-red uppercase tracking-wider">
                2K COURTSIDE
              </span>
              <span className="text-white/20">·</span>
              <span className="text-sm font-semibold text-chalk">
                Social Contagion Focus Group
              </span>

              {/* Plus-Up #2: Swarm Scale Segmented Toggle (N=20 vs N=100) */}
              <div className="ml-2 flex items-center rounded-lg bg-black/50 p-0.5 border border-white/10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSwarmSize(20)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    swarmSize === 20
                      ? "bg-white/15 text-white"
                      : "text-chalk-dim hover:text-white"
                  }`}
                >
                  N=20 Core
                </button>
                <button
                  type="button"
                  onClick={() => setSwarmSize(100)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    swarmSize === 100
                      ? "bg-twok-red text-white"
                      : "text-chalk-dim hover:text-white"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>N=100 Swarm</span>
                </button>
              </div>

              {/* Plus-Up #1: Round 1 vs Round 2 Social Contagion Switcher */}
              <div className="flex items-center rounded-lg bg-black/50 p-0.5 border border-white/10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveRound(1)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                    activeRound === 1
                      ? "bg-white/15 text-white"
                      : "text-chalk-dim hover:text-white"
                  }`}
                >
                  R1 · Isolated
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRound(2)}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    activeRound === 2
                      ? "bg-win-green/20 text-win-green border border-win-green/40"
                      : "text-chalk-dim hover:text-white"
                  }`}
                >
                  <span>R2 · Crew &amp; Creator Shift</span>
                  {contagionFlipsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-win-green text-court-black font-mono font-bold text-[10px]">
                      {contagionFlipsCount} Flipped
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunPressureTest}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-twok-red hover:bg-twok-red-deep disabled:opacity-50 text-xs font-semibold text-white shadow transition-all active:scale-[0.97]"
              >
                {isRunning ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 courtside-Transfer-pulse" />
                    <span>
                      {streamProgress < 20
                        ? `R1 Eval (${streamProgress}/20)...`
                        : streamPhase || "Running Contagion Pass..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {isBattleMode
                        ? `Run ${swarmSize}-Agent Battle ($${priceUsd.toFixed(2)} vs $${(altPriceUsd ?? 19.99).toFixed(2)})`
                        : `Run ${swarmSize}-Agent Contagion Test`}
                    </span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-chalk-dim hover:text-chalk hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {errorBanner && (
            <div className="rounded-lg border border-loss-red/40 bg-loss-red/10 px-3 py-1.5 flex items-center justify-between text-xs text-loss-red">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
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

          {/* Offer Controls: Title + Presets + Battle Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <span className="text-[10px] text-chalk-dim uppercase tracking-wider font-mono">
                Offer:
              </span>
              <input
                type="text"
                value={creativeTitle}
                onChange={(e) => setCreativeTitle(e.target.value)}
                placeholder="Offer Title..."
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-chalk focus:border-twok-red focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-chalk-dim">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(parseFloat(e.target.value) || 0)}
                  className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-chalk font-mono tabular focus:border-twok-red focus:outline-none"
                />
              </div>
            </div>

            {/* Offer Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    creativeTitle === p.title && priceUsd === p.priceUsd
                      ? "bg-twok-red text-white"
                      : "bg-white/5 text-chalk-dim hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setIsBattleMode((prev) => !prev);
                  if (!altPriceUsd) setAltPriceUsd(19.99);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border ${
                  isBattleMode
                    ? "bg-vc-gold/20 text-vc-gold border-vc-gold/50"
                    : "bg-white/5 text-chalk-dim border-white/10 hover:text-white"
                }`}
              >
                <Swords className="w-3 h-3" />
                <span>Battle Mode</span>
              </button>
            </div>
          </div>

          {/* Plus-Up #3: God's-Eye Counterfactual Injection Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-vc-gold shrink-0">
              <Sliders className="w-3 h-3" />
              <span>Inject Event:</span>
            </span>
            {COUNTERFACTUAL_CHIPS.map((chip) => {
              const active = selectedCfId === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleSelectCounterfactual(chip)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap border ${
                    active
                      ? "bg-vc-gold/20 text-vc-gold border-vc-gold/50 shadow-sm"
                      : "bg-white/[0.03] text-chalk-dim border-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* 4 Live TabularNumber Verdict Tallies with R2 Contagion Delta */}
          <div className="grid grid-cols-4 gap-2 pt-0.5 font-mono">
            <div className="rounded-lg border border-win-green/20 bg-win-green/[0.04] px-2.5 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-win-green tracking-wider font-semibold">
                  BUY
                </span>
                {activeRound === 2 && buyDeltaR2 !== 0 && (
                  <span
                    className={`text-[10px] px-1 rounded ${
                      buyDeltaR2 > 0
                        ? "bg-win-green/20 text-win-green"
                        : "bg-loss-red/20 text-loss-red"
                    }`}
                  >
                    {buyDeltaR2 > 0 ? `+${buyDeltaR2} R2` : `${buyDeltaR2} R2`}
                  </span>
                )}
              </div>
              <span className="text-base font-bold text-win-green">
                <TabularNumber value={buyCount} /> / {totalDenominator}
              </span>
            </div>

            <div className="rounded-lg border border-vc-gold/20 bg-vc-gold/[0.04] px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase text-vc-gold tracking-wider font-semibold">
                EVALUATE
              </span>
              <span className="text-base font-bold text-vc-gold">
                <TabularNumber value={evalCount} /> / {totalDenominator}
              </span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase text-chalk-dim tracking-wider font-semibold">
                PASS
              </span>
              <span className="text-base font-bold text-chalk-dim">
                <TabularNumber value={passCount} /> / {totalDenominator}
              </span>
            </div>

            <div className="rounded-lg border border-loss-red/20 bg-loss-red/[0.04] px-2.5 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-loss-red tracking-wider font-semibold">
                  BOYCOTT
                </span>
                {activeRound === 2 && boycottDeltaR2 !== 0 && (
                  <span
                    className={`text-[10px] px-1 rounded ${
                      boycottDeltaR2 > 0
                        ? "bg-loss-red/20 text-loss-red"
                        : "bg-win-green/20 text-win-green"
                    }`}
                  >
                    {boycottDeltaR2 > 0 ? `+${boycottDeltaR2} R2` : `${boycottDeltaR2} R2`}
                  </span>
                )}
              </div>
              <span className="text-base font-bold text-loss-red">
                <TabularNumber value={boycottCount} /> / {totalDenominator}
              </span>
            </div>
          </div>
        </div>

        {/* Body: Left 8-Col Persona/Swarm Stage + Right 4-Col Telemetry */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 py-3 overflow-hidden min-h-0">
          {/* Left Column: Creator Megaphone + 20 Core Cards OR 100-Agent Swarm Matrix */}
          <div className="lg:col-span-8 flex flex-col h-full overflow-hidden min-h-0">
            {/* Creator Megaphone Strip (appears live when broadcasts stream in) */}
            {creatorBroadcasts.length > 0 && (
              <div className="mb-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {creatorBroadcasts.map((cb) => {
                  const pillColor =
                    cb.stance === "ENDORSE"
                      ? "border-win-green/30 bg-win-green/[0.05] text-win-green"
                      : cb.stance === "CALLOUT"
                        ? "border-loss-red/30 bg-loss-red/[0.05] text-loss-red"
                        : "border-vc-gold/30 bg-vc-gold/[0.05] text-vc-gold";
                  return (
                    <div
                      key={cb.creator_id}
                      className={`rounded-lg border px-2.5 py-1.5 flex flex-col justify-between ${pillColor}`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold flex items-center gap-1">
                          <Radio className="w-3 h-3" />
                          {cb.handle}
                        </span>
                        <span className="uppercase font-bold">{cb.stance}</span>
                      </div>
                      <p className="text-[11px] text-chalk line-clamp-1 mt-0.5">
                        &ldquo;{cb.headline}&rdquo;
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Header Switcher: 20 Core Personas vs 100-Agent Swarm Matrix */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLeftTab("core20")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    leftTab === "core20"
                      ? "bg-white/10 text-chalk"
                      : "text-chalk-dim hover:text-white"
                  }`}
                >
                  20 Core Personas{" "}
                  {coreFlipsCount > 0 && activeRound === 2 ? `(${coreFlipsCount} Flipped)` : ""}
                </button>
                {swarmSize === 100 && (
                  <button
                    type="button"
                    onClick={() => setLeftTab("swarm100")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      leftTab === "swarm100"
                        ? "bg-white/10 text-chalk"
                        : "text-chalk-dim hover:text-white"
                    }`}
                  >
                    <span>100-Agent Swarm Matrix</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-vc-gold">
                      {crowdAgents.length > 0 ? 20 + crowdAgents.length : 100} Agents
                    </span>
                  </button>
                )}
              </div>
              <span className="text-[11px] text-chalk-dim">
                {leftTab === "core20"
                  ? "Click any card for 1-on-1 interrogation"
                  : "20 Rich Personas + 80 Crowd Swarm Agents"}
              </span>
            </div>

            {/* Tab 1: 20 Core Persona Cards */}
            {leftTab === "core20" ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {sampledPersonas.slice(0, 20).map((p: any, idx: number) => {
                    const reaction = liveReactions[idx] || currentResult?.reactions?.[idx] || null;
                    const cardArchetype = reaction?.archetype || p.archetype;
                    const cardGamerTag = reaction?.gamer_tag || p.gamer_tag;
                    const crewName = reaction?.crew_name || p.crew_name || "Bucket Getters";
                    const creatorHandle =
                      reaction?.creator_handle || p.creator_handle || "@Agent00";
                    const bColor = archetypeColor(cardArchetype);

                    const r1State =
                      reaction?.round1_fsm_state || reaction?.final_fsm_state || "EVALUATING";
                    const r2State = reaction?.final_fsm_state || "EVALUATING";
                    const state = activeRound === 1 ? r1State : r2State;
                    const flipped = Boolean(
                      activeRound === 2 && reaction?.contagion_flipped && r1State !== r2State
                    );

                    const displayedQuote =
                      activeRound === 1
                        ? reaction?.round1_quote || reaction?.verbatim_quote
                        : reaction?.verbatim_quote;

                    const displayedWtp =
                      activeRound === 1
                        ? reaction?.round1_wtp_usd ?? reaction?.willingness_to_pay_usd
                        : reaction?.willingness_to_pay_usd;

                    const stateBadgeColor =
                      state === "PURCHASED"
                        ? "bg-win-green text-court-black border-win-green"
                        : state === "ABANDONED"
                          ? "bg-white/10 text-chalk-dim border-white/20"
                          : state === "BOYCOTT"
                            ? "bg-loss-red text-white border-loss-red"
                            : "bg-vc-gold/20 text-vc-gold border-vc-gold/40";

                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => setInterrogatePersona(reaction || (p as FocusGroupReaction))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setInterrogatePersona(reaction || (p as FocusGroupReaction));
                          }
                        }}
                        style={{
                          perspective: "600px",
                        }}
                        className={`pressable group relative cursor-pointer rounded-xl border p-3 transition-all space-y-1.5 select-none ${
                          flipped
                            ? "border-win-green/40 bg-win-green/[0.04] hover:bg-win-green/[0.07]"
                            : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                        }`}
                      >
                        {/* Archetype Color Bar */}
                        <div
                          style={{ backgroundColor: bColor }}
                          className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
                        />

                        {/* Card Top: Gamer Tag + Archetype + Verdict Badge */}
                        <div className="flex items-center justify-between pl-2 gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-chalk truncate">
                                {cardGamerTag}
                              </span>
                              <span className="text-[10px] font-mono text-chalk-dim truncate">
                                · {crewName} · {creatorHandle}
                              </span>
                            </div>
                            <span
                              style={{ color: bColor }}
                              className="text-[10px] font-medium block truncate"
                            >
                              {archetypeLabel(cardArchetype)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {flipped && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-chalk flex items-center gap-0.5">
                                <span>{r1State}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-win-green" />
                              </span>
                            )}
                            <div
                              style={{
                                transform: reaction ? "rotateX(0deg)" : "rotateX(90deg)",
                                transition: "transform 200ms var(--ease-out)",
                                transformOrigin: "center top",
                              }}
                              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border shadow-sm ${stateBadgeColor}`}
                            >
                              {state}
                            </div>
                          </div>
                        </div>

                        {/* Card Stats: OVR / VC Spend / WTP / Contagion Source */}
                        <div className="flex items-center justify-between pl-2 text-[10px] font-mono text-chalk-dim border-y border-white/5 py-1">
                          <span>
                            OVR:{" "}
                            <span className="text-chalk font-semibold">
                              <TabularNumber value={p.myplayer_ovr || 85} />
                            </span>
                          </span>
                          <span>
                            90d VC:{" "}
                            <span className="text-vc-gold">
                              $<TabularNumber value={Math.round(Number(p.vc_spend_90d ?? p.spend ?? 50))} />
                            </span>
                          </span>
                          <span>
                            WTP:{" "}
                            <span className="text-win-green font-semibold">
                              $
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
                          </span>
                        </div>

                        {/* Verbatim Quote or Build Posture */}
                        <p className="pl-2 text-[11px] text-chalk-dim/90 line-clamp-2 leading-snug italic">
                          {displayedQuote ? (
                            <>&ldquo;{displayedQuote}&rdquo;</>
                          ) : (
                            `${p.myplayer_ovr || 84} OVR · ${p.myplayer_build || "2-Way Slashing Playmaker"}`
                          )}
                        </p>
                      </div>
                    );
                  })}
                </StaggerList>
              </div>
            ) : (
              /* Tab 2: 100-Agent Swarm Contagion Matrix (20 Core + 80 Crowd) */
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                  {[
                    ...sampledPersonas.slice(0, 20).map((p, idx) => {
                      const r = liveReactions[idx] || currentResult?.reactions?.[idx];
                      return {
                        id: p.player_id || `core-${idx}`,
                        gamer_tag: r?.gamer_tag || p.gamer_tag,
                        ovr: p.myplayer_ovr || 85,
                        crew_name: r?.crew_name || p.crew_name || "Bucket Getters",
                        creator_handle: r?.creator_handle || p.creator_handle || "@Agent00",
                        r1: r?.round1_fsm_state || r?.final_fsm_state || "EVALUATING",
                        r2: r?.final_fsm_state || "EVALUATING",
                        flipped: Boolean(r?.contagion_flipped),
                        tier: "CORE",
                      };
                    }),
                    ...crowdAgents.map((a) => ({
                      id: a.player_id,
                      gamer_tag: a.gamer_tag,
                      ovr: a.myplayer_ovr,
                      crew_name: a.crew_name,
                      creator_handle: a.creator_handle,
                      r1: a.round1_state,
                      r2: a.final_fsm_state,
                      flipped: a.contagion_flipped,
                      tier: "CROWD",
                    })),
                  ].map((agent, i) => {
                    const st = activeRound === 1 ? agent.r1 : agent.r2;
                    const dotColor =
                      st === "PURCHASED"
                        ? "bg-win-green border-win-green/50 text-win-green"
                        : st === "BOYCOTT"
                          ? "bg-loss-red border-loss-red/50 text-loss-red"
                          : st === "ABANDONED"
                            ? "bg-white/20 border-white/20 text-chalk-dim"
                            : "bg-vc-gold border-vc-gold/50 text-vc-gold";
                    return (
                      <div
                        key={`${agent.id}-${i}`}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-mono flex flex-col justify-between ${
                          agent.flipped && activeRound === 2
                            ? "border-win-green/40 bg-win-green/[0.06]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-chalk truncate">{agent.gamer_tag}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor.split(" ")[0]}`} />
                        </div>
                        <div className="text-[9px] text-chalk-dim truncate">
                          {agent.ovr} OVR · {agent.crew_name}
                        </div>
                        <div className="flex items-center justify-between pt-0.5 text-[9px]">
                          <span className="text-chalk-dim">{agent.creator_handle}</span>
                          <span className="font-bold text-chalk">
                            {agent.flipped && activeRound === 2 ? `${agent.r1.slice(0, 4)}→${st.slice(0, 4)}` : st.slice(0, 4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Contagion Multiplier, 2K26->2K27 Migration Curve, Battle Arena, WTP, Backlash, Reddit */}
          <div className="lg:col-span-4 flex flex-col h-full overflow-y-auto space-y-3 pr-1 min-h-0">
            {/* Plus-Up #1: Crew & Creator Contagion Impact Card */}
            <div className="rounded-xl border border-win-green/30 bg-win-green/[0.04] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-win-green" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-win-green">
                    Crew &amp; Creator Contagion
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-win-green">
                  {crewMultiplier.toFixed(1)}x Squad Multiplier
                </span>
              </div>
              <p className="text-[11px] text-chalk leading-snug">
                {currentResult?.contagion_summary ||
                  crewCaptainSummary ||
                  "Crew Captains upgrading or claiming in Round 1 trigger a 3.1x conversion cascade across hesitant Rec & Pro-Am squadmates in Round 2."}
              </p>
            </div>

            {/* Plus-Up #3: NBA 2K26 -> 2K27 Season 1-3 Migration & Contagion Trajectory */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-chalk">
                  2K26 → 2K27 Migration Curve
                </span>
                <span className="text-[10px] font-mono text-win-green">
                  Isolated vs Crew Contagion
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {migrationCurve.map((pt) => (
                  <div key={pt.stage} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-chalk-dim">{pt.stage}</span>
                      <span>
                        <span className="text-chalk-dim">{pt.isolated_pct}%</span>
                        <span className="text-white/30 mx-1">→</span>
                        <span className="text-win-green font-bold">{pt.contagion_pct}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden relative">
                      <div
                        style={{ width: `${Math.min(100, pt.contagion_pct)}%` }}
                        className="h-full bg-win-green/70 rounded-full transition-all duration-300"
                      />
                      <div
                        style={{ width: `${Math.min(100, pt.isolated_pct)}%` }}
                        className="h-full bg-white/30 rounded-full absolute top-0 left-0 transition-all duration-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Offer Battle Side-by-Side (if present or in Battle mode) */}
            {isBattleMode && (
              <div className="rounded-xl border border-vc-gold/30 bg-vc-gold/[0.04] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-vc-gold" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-vc-gold">
                      Offer Battle Arena
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-chalk-dim">
                    ${priceUsd.toFixed(2)} vs ${(altPriceUsd ?? 19.99).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-black/40 border border-white/10 p-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-chalk-dim">
                      <span>Tier A</span>
                      <span className="text-win-green font-bold">${priceUsd.toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] text-chalk">
                      Lift: <span className="text-win-green font-bold">+{conversionLift.toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] text-chalk-dim font-mono">
                      Backlash: <span className="text-chalk">{backlashIndex}%</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/40 border border-white/10 p-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-chalk-dim">
                      <span>Tier B</span>
                      <span className="text-loss-red font-bold">
                        ${(altPriceUsd ?? 19.99).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[11px] text-chalk">
                      Lift:{" "}
                      <span className="text-loss-red font-bold">
                        +{((currentResult?.alt_result?.predicted_conversion_lift ?? conversionLift * 0.55)).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-chalk-dim font-mono">
                      Backlash:{" "}
                      <span className="text-loss-red font-bold">
                        {currentResult?.alt_result?.backlash_index ?? 48}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WTP Curve (Sparkline) */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-chalk">
                  Willingness-to-Pay Curve
                </span>
                <span className="text-[10px] font-mono text-vc-gold bg-vc-gold/10 px-1.5 py-0.5 rounded border border-vc-gold/20">
                  Optimal: ${recommendedPrice.toFixed(2)}
                </span>
              </div>

              <div className="pt-1">
                <Sparkline
                  values={wtpCurve.map((p) => p.conversion_pct)}
                  labels={wtpCurve.map((p) => `$${p.price}`)}
                  width={280}
                  height={56}
                  stroke="var(--twok-red)"
                  highlightIndex={highlightIdx >= 0 ? highlightIdx : 1}
                  highlightLabel={`$${recommendedPrice}`}
                />
              </div>
            </div>

            {/* Backlash Index Bar */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-loss-red" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-chalk">
                    Backlash Index
                  </span>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    backlashIndex > 35 ? "text-loss-red" : "text-win-green"
                  }`}
                >
                  <TabularNumber value={backlashIndex} />%
                </span>
              </div>

              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, backlashIndex))}%`,
                    transition: "width 300ms var(--ease-out)",
                  }}
                  className={`h-full ${
                    backlashIndex > 35 ? "bg-loss-red" : "bg-win-green"
                  }`}
                />
              </div>
            </div>

            {/* Live Reddit Pulse Block */}
            <RedditPulseCard />
          </div>
        </div>

        {/* Footer: Generate Campaign Brief + Open Creative Studio */}
        <div className="border-t border-white/10 px-4 py-3 bg-white/[0.01] flex items-center justify-between gap-4">
          <div className="text-xs text-chalk-dim flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-win-green animate-pulse" />
            <span>
              {activeReactions.length > 0
                ? `${totalDenominator}-Agent Contagion Complete (+${conversionLift.toFixed(1)}% lift · ${contagionFlipsCount} R2 flips)`
                : `Ready to run ${swarmSize}-agent 2-round social contagion test`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCreativeStudio && (
              <button
                type="button"
                onClick={() => onOpenCreativeStudio(creativeTitle)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-chalk text-xs font-semibold transition-colors active:scale-[0.97]"
              >
                <Palette className="w-3.5 h-3.5 text-twok-red" />
                <span>Open Creative Studio</span>
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
                    consensus_summary: `Strong cohort alignment for ${creativeTitle} at $${priceUsd.toFixed(2)}.`,
                    predicted_conversion_lift: 26.5,
                    sentiment_decay_index: 0.12,
                    churn_mitigation_lift: 18.4,
                    projected_revenue_impact_usd: 145000,
                  };
                  onGenerateBrief(defaultRes);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-court-black hover:bg-chalk text-xs font-bold shadow transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isGeneratingBrief ? "Generating Brief..." : "Generate Campaign Brief"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1-on-1 Persona Interrogation Drawer */}
      <PersonaInterrogationDrawer
        persona={interrogatePersona}
        onClose={() => setInterrogatePersona(null)}
        offerTitle={creativeTitle}
        priceUsd={priceUsd}
      />
    </div>
  );
}
