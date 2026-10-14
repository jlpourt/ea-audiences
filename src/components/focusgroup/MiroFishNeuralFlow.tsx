"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Users,
  MessageSquare,
  Zap,
  CheckCircle2,
  Clock,
  MinusCircle,
  AlertOctagon,
  X,
  ArrowRight,
  Layers,
  Cpu,
} from "lucide-react";
import { FocusGroupReaction } from "@/lib/types";
import { archetypeLabel, archetypeColor } from "@/lib/archetypes";

export type NeuralNodeId =
  | "seed"
  | "r1"
  | "sig_creators"
  | "sig_crews"
  | "sig_reddit"
  | "r2"
  | "r3"
  | "verdict_buy"
  | "verdict_eval"
  | "verdict_pass"
  | "verdict_boycott";

export interface CreatorSignalSummary {
  id: string;
  handle: string;
  platform: string;
  stance: "ENDORSE" | "MIXED" | "CALLOUT";
  headline: string;
  mroas: number;
  attributed_flips: number;
}

export interface RedditThreadSummary {
  id?: string;
  subreddit?: string;
  author_tag?: string;
  title: string;
  body?: string;
  upvotes?: number;
  score?: number;
  sentiment?: string;
  contagion_impact?: string;
}

interface MiroFishNeuralFlowProps {
  isRunning: boolean;
  streamPhase: string;
  streamProgress: number;
  swarmSize: 20 | 100;
  activeRound: 1 | 2 | 3;
  hasRound3: boolean;
  selectedCfLabel?: string;
  cohortName: string;
  creativeTitle: string;
  priceUsd: number;
  altPriceUsd?: number;
  isBattleMode?: boolean;
  sampledPersonas: any[];
  activeReactions: FocusGroupReaction[];
  crowdAgents: any[];
  creatorSignals: CreatorSignalSummary[];
  redditThreads: RedditThreadSummary[];
  contagionFlipsCount: number;
  round3FlipsCount: number;
  crewMultiplier: number;
  conversionLift: number;
  buyCount: number;
  evalCount: number;
  passCount: number;
  boycottCount: number;
  totalDenominator: number;
  onSelectRound: (round: 1 | 2 | 3) => void;
  onInterrogatePersona: (persona: FocusGroupReaction) => void;
  prefersReducedMotion?: boolean;
}

function shortStateBadge(state?: string) {
  switch (state) {
    case "PURCHASED":
      return "BUY";
    case "ABANDONED":
      return "PASS";
    case "BOYCOTT":
      return "BOYCOTT";
    case "ENGAGED_FREE":
    case "EVALUATING":
    default:
      return "EVAL";
  }
}

export default function MiroFishNeuralFlow({
  isRunning,
  streamPhase,
  streamProgress,
  swarmSize,
  activeRound,
  hasRound3,
  selectedCfLabel = "What-If Shock",
  cohortName,
  creativeTitle,
  priceUsd,
  altPriceUsd,
  isBattleMode = false,
  sampledPersonas,
  activeReactions,
  crowdAgents,
  creatorSignals,
  redditThreads,
  contagionFlipsCount,
  round3FlipsCount,
  crewMultiplier,
  conversionLift,
  buyCount,
  evalCount,
  passCount,
  boycottCount,
  totalDenominator,
  onSelectRound,
  onInterrogatePersona,
  prefersReducedMotion = false,
}: MiroFishNeuralFlowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<NeuralNodeId | null>(null);
  const [thoughtTickIndex, setThoughtTickIndex] = useState<number>(0);

  // Rotate live thought stream during/after simulation
  useEffect(() => {
    if (activeReactions.length === 0) return;
    const interval = setInterval(() => {
      setThoughtTickIndex((prev) => (prev + 1) % Math.max(1, activeReactions.length));
    }, isRunning ? 650 : 2800);
    return () => clearInterval(interval);
  }, [activeReactions.length, isRunning]);

  // Determine which neural layer is actively firing right now
  const activeStage = useMemo(() => {
    if (!isRunning) {
      if (activeReactions.length === 0) return "idle";
      return hasRound3 && activeRound === 3 ? "complete_r3" : "complete";
    }
    const phaseLower = (streamPhase || "").toLowerCase();
    if (phaseLower.includes("round 3") || phaseLower.includes("r3") || phaseLower.includes("rescue")) {
      return "r3_firing";
    }
    if (
      phaseLower.includes("round 2") ||
      phaseLower.includes("cascade") ||
      phaseLower.includes("contagion") ||
      phaseLower.includes("swarm") ||
      streamProgress >= 20
    ) {
      return "r2_firing";
    }
    return "r1_firing";
  }, [isRunning, streamPhase, streamProgress, activeReactions.length, hasRound3, activeRound]);

  // Compute R1 isolated counts vs R2 social counts
  const r1Breakdown = useMemo(() => {
    const states = [
      ...activeReactions.map((r) => r.round1_fsm_state || r.final_fsm_state || "EVALUATING"),
      ...(swarmSize === 100 && crowdAgents.length > 0
        ? crowdAgents.map((a) => a.round1_state || "EVALUATING")
        : []),
    ];
    if (states.length === 0) {
      return { buy: 5, eval: 9, pass: 4, boycott: 2, total: 20 };
    }
    const buy = states.filter((s) => s === "PURCHASED").length;
    const evalC = states.filter((s) => s === "EVALUATING" || s === "ENGAGED_FREE").length;
    const pass = states.filter((s) => s === "ABANDONED").length;
    const boycott = states.filter((s) => s === "BOYCOTT").length;
    return { buy, eval: evalC, pass, boycott, total: states.length };
  }, [activeReactions, crowdAgents, swarmSize]);

  // Latest active thought for R1 and R2
  const currentR1Thought = useMemo(() => {
    if (activeReactions.length === 0) {
      return {
        tag: "@ SwishGod_2K",
        state: "EVALUATING",
        quote: `Evaluating ${creativeTitle} ($${priceUsd.toFixed(2)}) against VC grind value...`,
      };
    }
    const idx = isRunning
      ? Math.max(0, activeReactions.length - 1)
      : thoughtTickIndex % activeReactions.length;
    const r = activeReactions[idx] || activeReactions[0];
    return {
      tag: `@${String(r.gamer_tag || "Player").replace(/^@/, "")}`,
      state: shortStateBadge(r.round1_fsm_state || r.final_fsm_state),
      quote:
        r.round1_quote ||
        r.verbatim_quote ||
        `Checking ${creativeTitle} at $${priceUsd.toFixed(2)} before locking in.`,
    };
  }, [activeReactions, isRunning, thoughtTickIndex, creativeTitle, priceUsd]);

  const flippedReactions = useMemo(
    () =>
      activeReactions.filter(
        (r) =>
          r.contagion_flipped ||
          (r.round1_fsm_state && r.round1_fsm_state !== r.final_fsm_state)
      ),
    [activeReactions]
  );

  const r3RescuedReactions = useMemo(
    () =>
      activeReactions.filter(
        (r) =>
          r.round3_flipped ||
          (r.round3_fsm_state && r.round3_fsm_state !== r.final_fsm_state)
      ),
    [activeReactions]
  );

  const currentR2Thought = useMemo(() => {
    const pool = flippedReactions.length > 0 ? flippedReactions : activeReactions;
    if (pool.length === 0) {
      return {
        tag: "@IsoKing_99",
        driver: "via @Agent00 + Crew Captain",
        quote: "Squad captain locked the bundle for Rec tonight · flipping from EVAL to BUY.",
      };
    }
    const r = pool[thoughtTickIndex % pool.length] || pool[0];
    const driver = r.contagion_source_tag
      ? `via ${r.contagion_source_tag}`
      : r.contagion_driver === "CREATOR_STREAM"
        ? `via ${r.creator_handle || "@Agent00"}`
        : r.contagion_driver === "REDDIT_THREAD"
          ? "via r/NBA2K"
          : `via ${r.crew_name || "Crew"} Captain`;
    return {
      tag: `@${String(r.gamer_tag || "Player").replace(/^@/, "")}`,
      driver,
      quote:
        r.verbatim_quote ||
        `Squad is running Rec tonight · flipping to ${shortStateBadge(r.final_fsm_state)}.`,
    };
  }, [flippedReactions, activeReactions, thoughtTickIndex]);

  // Build unified list of inspectable reactions for the slide-up drawer when a node is clicked
  const allInspectableReactions: FocusGroupReaction[] = useMemo(() => {
    const base: FocusGroupReaction[] =
      activeReactions.length > 0
        ? activeReactions
        : sampledPersonas.slice(0, 20).map(
            (p, idx): FocusGroupReaction => ({
              player_id: p.player_id || `p-${idx}`,
              gamer_tag: p.gamer_tag || `Player_${idx + 1}`,
              archetype: p.archetype || "MYCAREER_STORY_CASUAL",
              crew_name: p.crew_name || "Bucket Getters",
              creator_handle: p.creator_handle || "@Agent00",
              myplayer_ovr: p.myplayer_ovr || 85,
              round1_fsm_state: idx % 4 === 0 ? "PURCHASED" : "EVALUATING",
              final_fsm_state: idx % 2 === 0 ? "PURCHASED" : "EVALUATING",
              contagion_flipped: idx % 2 === 0 && idx % 4 !== 0,
              willingness_to_pay_usd: priceUsd,
              verbatim_quote: `Evaluating ${creativeTitle} at $${priceUsd.toFixed(2)} with ${p.crew_name || "the squad"}.`,
              authenticity_rating: 0.93,
              churn_risk_score: 0.28,
              sentiment_score: 0.68,
            })
          );
    return base;
  }, [activeReactions, sampledPersonas, priceUsd, creativeTitle]);

  const drawerData = useMemo(() => {
    if (!selectedNodeId) return null;
    const getRoundState = (r: FocusGroupReaction) =>
      activeRound === 1
        ? r.round1_fsm_state || r.final_fsm_state
        : activeRound === 3
          ? r.round3_fsm_state || r.final_fsm_state
          : r.final_fsm_state;

    switch (selectedNodeId) {
      case "seed":
        return {
          title: `Layer 1 · Seed Cohort & Offer Injection (${totalDenominator} Agents)`,
          subtitle: `${cohortName} · Testing "${creativeTitle}" at $${priceUsd.toFixed(2)}`,
          accent: "from-[#4285F4] to-[#9B72CB]",
          players: allInspectableReactions,
          mode: "players" as const,
        };
      case "r1":
        return {
          title: `Layer 2 · Round 1 Isolated Neural Evaluation`,
          subtitle: `Pre-social individual utility reactions (${r1Breakdown.buy} BUY · ${r1Breakdown.eval} EVAL · ${r1Breakdown.pass} PASS · ${r1Breakdown.boycott} BOYC)`,
          accent: "from-[#4285F4] to-[#669DF6]",
          players: allInspectableReactions,
          mode: "players_r1" as const,
        };
      case "sig_creators":
        return {
          title: `Layer 3A · Creator Co-Stream Contagion Signal`,
          subtitle: `Live creator broadcast amplification & attributed R2 social flips`,
          accent: "from-[#9B72CB] to-[#D96570]",
          players: allInspectableReactions.filter(
            (r) => r.contagion_driver === "CREATOR_STREAM" || r.contagion_flipped
          ),
          mode: "creators" as const,
        };
      case "sig_crews":
        return {
          title: `Layer 3B · Crew Captain Social Gravity (${crewMultiplier.toFixed(1)}x Cascade)`,
          subtitle: `Discord & Rec Squad peer pressure pulling hesitant teammates into the offer`,
          accent: "from-[#4285F4] to-[#00F5D4]",
          players: allInspectableReactions.filter(
            (r) =>
              r.contagion_driver === "CREW_CAPTAIN" ||
              r.archetype === "REC_CREW_CAPTAIN" ||
              r.contagion_flipped
          ),
          mode: "players" as const,
        };
      case "sig_reddit":
        return {
          title: `Layer 3C · r/NBA2K Community Pulse Signal`,
          subtitle: `Live community sentiment threads shaping Skeptic & Holdout reactions`,
          accent: "from-[#D96570] to-[#FFB800]",
          players: allInspectableReactions.filter(
            (r) => r.contagion_driver === "REDDIT_THREAD" || r.final_fsm_state === "BOYCOTT"
          ),
          mode: "reddit" as const,
        };
      case "r2":
        return {
          title: `Layer 4 · Round 2 Social Contagion Shift (+${contagionFlipsCount} Flips)`,
          subtitle: `Players whose decision flipped after Creator, Crew Captain, and Reddit contagion`,
          accent: "from-[#9B72CB] via-[#D96570] to-[#00F5D4]",
          players:
            flippedReactions.length > 0 ? flippedReactions : allInspectableReactions,
          mode: "players" as const,
        };
      case "r3":
        return {
          title: `Layer 4B · Round 3 What-If Counterfactual Rescue (+${round3FlipsCount} Rescued)`,
          subtitle: `Triggered "${selectedCfLabel}" · rescuing holdouts & boycotters into BUY`,
          accent: "from-[#00F5D4] to-[#19C37D]",
          players:
            r3RescuedReactions.length > 0 ? r3RescuedReactions : allInspectableReactions,
          mode: "players" as const,
        };
      case "verdict_buy":
        return {
          title: `Layer 5 · PURCHASED Verdict Cluster (${buyCount} Agents)`,
          subtitle: `Converted players ready for 2K Account / D2C Web Store activation`,
          accent: "from-[#19C37D] to-[#00F5D4]",
          players: allInspectableReactions.filter(
            (r) => getRoundState(r) === "PURCHASED"
          ),
          mode: "players" as const,
        };
      case "verdict_eval":
        return {
          title: `Layer 5 · EVALUATING Verdict Cluster (${evalCount} Agents)`,
          subtitle: `Persuadable fence-sitters awaiting Crew Captain or What-If nudge`,
          accent: "from-[#FFB800] to-[#F59E0B]",
          players: allInspectableReactions.filter((r) => {
            const st = getRoundState(r);
            return st === "EVALUATING" || st === "ENGAGED_FREE";
          }),
          mode: "players" as const,
        };
      case "verdict_pass":
        return {
          title: `Layer 5 · PASS / ABANDONED Cluster (${passCount} Agents)`,
          subtitle: `Low-intent players where offer price exceeds current Willingness-to-Pay`,
          accent: "from-slate-400 to-slate-600",
          players: allInspectableReactions.filter(
            (r) => getRoundState(r) === "ABANDONED"
          ),
          mode: "players" as const,
        };
      case "verdict_boycott":
        return {
          title: `Layer 5 · BOYCOTT / SLEEPING DOG Cluster (${boycottCount} Agents)`,
          subtitle: `High-backlash holdouts · suppress from standard push or rescue via R3 What-If`,
          accent: "from-[#FF4D5E] to-[#D96570]",
          players: allInspectableReactions.filter(
            (r) => getRoundState(r) === "BOYCOTT"
          ),
          mode: "players" as const,
        };
    }
  }, [
    selectedNodeId,
    activeRound,
    totalDenominator,
    cohortName,
    creativeTitle,
    priceUsd,
    allInspectableReactions,
    r1Breakdown,
    crewMultiplier,
    contagionFlipsCount,
     flippedReactions,
    round3FlipsCount,
    selectedCfLabel,
    r3RescuedReactions,
    buyCount,
    evalCount,
    passCount,
    boycottCount,
  ]);

  const totalEvaluated = buyCount + evalCount + passCount + boycottCount;
  const buyPct = totalEvaluated > 0 ? Math.round((buyCount / totalEvaluated) * 100) : 0;
  const evalPct = totalEvaluated > 0 ? Math.round((evalCount / totalEvaluated) * 100) : 0;
  const passPct = totalEvaluated > 0 ? Math.round((passCount / totalEvaluated) * 100) : 0;
  const boycottPct =
    totalEvaluated > 0 ? Math.max(0, 100 - buyPct - evalPct - passPct) : 0;

  const isR1Active =
    activeStage === "r1_firing" ||
    activeStage === "r2_firing" ||
    activeStage === "r3_firing" ||
    activeStage === "complete" ||
    activeStage === "complete_r3";
  const isR2Active =
    activeStage === "r2_firing" ||
    activeStage === "r3_firing" ||
    activeStage === "complete" ||
    activeStage === "complete_r3";
  const isR3Active =
    hasRound3 &&
    (activeStage === "r3_firing" || activeStage === "complete_r3" || activeRound === 3);

  return (
    <div className="relative flex-1 h-full min-h-0 rounded-2xl border border-white/[0.08] bg-[#040407] overflow-hidden flex flex-col justify-between select-none shadow-[inset_0_0_80px_rgba(66,133,244,0.06)]">
      {/* Ambient Google Gemini Dark Nebula Background + Neural Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Top Gemini Blue/Violet Radial Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[220px] rounded-full blur-[90px] opacity-30 transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(circle, rgba(66,133,244,0.55) 0%, rgba(155,114,203,0.35) 50%, rgba(217,101,112,0) 100%)",
          }}
        />
        {/* Center Contagion Violet/Coral Nebula */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[280px] rounded-full blur-[110px] transition-opacity duration-700 ${
            isRunning ? "opacity-40" : "opacity-20"
          }`}
          style={{
            background:
              "radial-gradient(circle, rgba(155,114,203,0.5) 0%, rgba(217,101,112,0.3) 55%, rgba(0,245,212,0) 100%)",
          }}
        />
        {/* Subtle Dot Matrix Grid */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* SVG Neural Synaptic Spine & Travelling Energy Comets (ViewBox 0 0 1000 600) */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full z-0"
      >
        <defs>
          {/* Google Gemini Signature Gradients */}
          <linearGradient id="gemini-beam-vertical" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>

          <linearGradient id="gemini-beam-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#00F5D4" />
          </linearGradient>

          <linearGradient id="gemini-beam-buy" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9B72CB" />
            <stop offset="45%" stopColor="#00F5D4" />
            <stop offset="100%" stopColor="#19C37D" />
          </linearGradient>

          <linearGradient id="gemini-beam-eval" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9B72CB" />
            <stop offset="100%" stopColor="#FFB800" />
          </linearGradient>

          <linearGradient id="gemini-beam-pass" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#669DF6" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          <linearGradient id="gemini-beam-boycott" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D96570" />
            <stop offset="100%" stopColor="#FF4D5E" />
          </linearGradient>

          <filter id="gemini-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ================= LAYER 1 (500,62) -> LAYER 2 R1 (500,165) ================= */}
        {[
          "M 500 62 C 500 100, 500 125, 500 165",
          "M 440 62 C 440 105, 475 130, 485 165",
          "M 560 62 C 560 105, 525 130, 515 165",
        ].map((d, i) => (
          <g key={`l1-l2-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={i === 0 ? 2.5 : 1.5}
            />
            <motion.path
              d={d}
              fill="none"
              stroke="url(#gemini-beam-vertical)"
              strokeWidth={i === 0 ? 3 : 1.75}
              filter="url(#gemini-glow)"
              initial={{ pathLength: 0, opacity: 0.25 }}
              animate={{
                pathLength: isR1Active ? 1 : 0.35,
                opacity: isR1Active ? 0.95 : 0.3,
              }}
              transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
            />
            {(isRunning || isR1Active) && !prefersReducedMotion && (
              <path
                d={d}
                fill="none"
                stroke="#A8C7FA"
                strokeWidth={i === 0 ? 3.2 : 2}
                strokeLinecap="round"
                strokeDasharray="10 26"
                className="dag-edge-active"
                style={{
                  animationDuration: isRunning ? "420ms" : "1400ms",
                }}
              />
            )}
          </g>
        ))}

        {/* ================= LAYER 2 R1 (500,225) -> LAYER 3 SIGNALS (190, 500, 810 at Y=305) ================= */}
        {[
          { d: "M 460 225 C 390 258, 240 262, 190 305", grad: "url(#gemini-beam-vertical)" },
          { d: "M 500 225 C 500 258, 500 272, 500 305", grad: "url(#gemini-beam-cyan)" },
          { d: "M 540 225 C 610 258, 760 262, 810 305", grad: "url(#gemini-beam-vertical)" },
        ].map((edge, i) => (
          <g key={`l2-l3-${i}`}>
            <path d={edge.d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
            <motion.path
              d={edge.d}
              fill="none"
              stroke={edge.grad}
              strokeWidth="2.4"
              filter="url(#gemini-glow)"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{
                pathLength: isR1Active ? 1 : 0.2,
                opacity: isR1Active ? 0.9 : 0.25,
              }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }}
            />
            {(isRunning || isR2Active) && !prefersReducedMotion && (
              <path
                d={edge.d}
                fill="none"
                stroke="#E9D5FF"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray="8 28"
                className="dag-edge-active"
                style={{
                  animationDuration: isRunning ? "460ms" : "1600ms",
                }}
              />
            )}
          </g>
        ))}

        {/* ================= LAYER 3 SIGNALS (Y=355) -> LAYER 4 R2 (X=hasRound3 ? 370 : 500, Y=425) ================= */}
        {(() => {
          const r2X = hasRound3 ? 360 : 500;
          const l3ToL4 = [
            `M 190 355 C 210 392, ${r2X - 70} 395, ${r2X - 25} 425`,
            `M 500 355 C 500 390, ${r2X} 395, ${r2X} 425`,
            `M 810 355 C 790 392, ${r2X + 70} 395, ${r2X + 25} 425`,
          ];
          return l3ToL4.map((d, i) => (
            <g key={`l3-l4-${i}`}>
              <path d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
              <motion.path
                d={d}
                fill="none"
                stroke="url(#gemini-beam-cyan)"
                strokeWidth="2.4"
                filter="url(#gemini-glow)"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{
                  pathLength: isR2Active ? 1 : 0.15,
                  opacity: isR2Active ? 0.92 : 0.22,
                }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              />
              {(activeStage === "r2_firing" || isR2Active) && !prefersReducedMotion && (
                <path
                  d={d}
                  fill="none"
                  stroke="#00F5D4"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeDasharray="9 28"
                  className="dag-edge-active"
                  style={{
                    animationDuration: isRunning ? "380ms" : "1500ms",
                  }}
                />
              )}
            </g>
          ));
        })()}

        {/* ================= DYNAMIC R2 -> R3 WHAT-IF BRIDGE & RESCUE BEAM ================= */}
        {hasRound3 && (
          <g>
            {/* Horizontal Synaptic Bridge from R2 (360,455) to R3 (680,455) */}
            <motion.path
              d="M 480 455 C 535 455, 565 455, 610 455"
              fill="none"
              stroke="url(#gemini-beam-buy)"
              strokeWidth="3"
              filter="url(#gemini-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            />
            {!prefersReducedMotion && (
              <path
                d="M 480 455 C 535 455, 565 455, 610 455"
                fill="none"
                stroke="#00F5D4"
                strokeWidth="3.5"
                strokeDasharray="8 20"
                className="dag-edge-active"
                style={{ animationDuration: "420ms" }}
              />
            )}

            {/* Direct R3 Rescue Beam (680,485) -> PURCHASED Verdict Node (145,540) */}
            <motion.path
              d="M 680 485 C 620 525, 290 508, 145 540"
              fill="none"
              stroke="url(#gemini-beam-buy)"
              strokeWidth="3.2"
              filter="url(#gemini-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.95 }}
              transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
            />
            {!prefersReducedMotion && (
              <path
                d="M 680 485 C 620 525, 290 508, 145 540"
                fill="none"
                stroke="#19C37D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="12 24"
                className="dag-edge-active"
                style={{ animationDuration: "450ms" }}
              />
            )}
          </g>
        )}

        {/* ================= LAYER 4 R2 (Y=485) -> LAYER 5 VERDICTS (145, 385, 615, 855 at Y=540) ================= */}
        {(() => {
          const r2X = hasRound3 ? 360 : 500;
          const verdictTargets = [
            {
              x: 145,
              grad: "url(#gemini-beam-buy)",
              pulse: "#19C37D",
              weight: Math.max(1.8, (buyPct / 100) * 5.2),
            },
            {
              x: 385,
              grad: "url(#gemini-beam-eval)",
              pulse: "#FFB800",
              weight: Math.max(1.5, (evalPct / 100) * 4.5),
            },
            {
              x: 615,
              grad: "url(#gemini-beam-pass)",
              pulse: "#94A3B8",
              weight: Math.max(1.3, (passPct / 100) * 4.0),
            },
            {
              x: 855,
              grad: "url(#gemini-beam-boycott)",
              pulse: "#FF4D5E",
              weight: Math.max(1.3, (boycottPct / 100) * 4.0),
            },
          ];

          return verdictTargets.map((vt, i) => {
            const d = `M ${r2X} 485 C ${r2X} 515, ${vt.x} 510, ${vt.x} 540`;
            return (
              <g key={`l4-l5-${i}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={vt.weight}
                />
                <motion.path
                  d={d}
                  fill="none"
                  stroke={vt.grad}
                  strokeWidth={vt.weight}
                  filter="url(#gemini-glow)"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{
                    pathLength: isR2Active ? 1 : 0.2,
                    opacity: isR2Active ? 0.9 : 0.25,
                  }}
                  transition={{
                    duration: 0.65,
                    delay: i * 0.05,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                />
                {isR2Active && !prefersReducedMotion && (
                  <path
                    d={d}
                    fill="none"
                    stroke={vt.pulse}
                    strokeWidth={Math.max(2, vt.weight * 0.85)}
                    strokeLinecap="round"
                    strokeDasharray="10 30"
                    className="dag-edge-active"
                    style={{
                      animationDuration:
                        i === 0
                          ? isRunning
                            ? "360ms"
                            : "1100ms"
                          : isRunning
                            ? "520ms"
                            : "1700ms",
                    }}
                  />
                )}
              </g>
            );
          });
        })()}
      </svg>

      {/* ================= FOREGROUND INTERACTIVE 5-LAYER NEURAL NODES ================= */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-5 min-h-0">
        {/* LAYER 1: SEED COHORT & OFFER CAPSULE NODE */}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={() =>
              setSelectedNodeId((prev) => (prev === "seed" ? null : "seed"))
            }
            whileTap={{ scale: 0.98 }}
            className={`group relative rounded-full px-5 py-2 transition-all text-left border backdrop-blur-xl flex items-center gap-3 ${
              selectedNodeId === "seed"
                ? "bg-[#111526]/95 border-[#669DF6]/85 shadow-[0_0_32px_rgba(66,133,244,0.38)]"
                : "bg-[#0B0D16]/90 border-white/[0.12] hover:border-[#669DF6]/60 shadow-[0_0_24px_rgba(66,133,244,0.16)]"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4285F4]/35 via-[#9B72CB]/35 to-[#D96570]/35 border border-[#669DF6]/50 flex items-center justify-center shrink-0">
              <Cpu className="w-3.5 h-3.5 text-[#A8C7FA]" />
            </div>
            <span className="text-xs font-semibold text-white">
              {creativeTitle}
            </span>
            <span className="font-mono text-xs font-semibold text-[#00F5D4] tabular-nums">
              ${priceUsd.toFixed(2)}
              {isBattleMode && altPriceUsd ? ` vs $${altPriceUsd.toFixed(2)}` : ""}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#4285F4]/20 border border-[#4285F4]/40 text-[10px] font-mono font-semibold text-[#A8C7FA] tabular-nums">
              {totalDenominator} Agents
            </span>
          </motion.button>
        </div>

        {/* LAYER 2: ROUND 1 · ISOLATED NEURAL EVALUATION NODE */}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={() => {
              onSelectRound(1);
              setSelectedNodeId((prev) => (prev === "r1" ? null : "r1"));
            }}
            animate={{
              scale: activeStage === "r1_firing" ? 1.02 : 1,
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className={`group relative rounded-2xl px-5 py-2.5 transition-all text-left border backdrop-blur-xl w-full max-w-xl ${
              selectedNodeId === "r1" || activeRound === 1
                ? "bg-[#111528]/95 border-[#669DF6]/75 shadow-[0_0_36px_rgba(66,133,244,0.3)]"
                : "bg-[#0B0D16]/90 border-white/[0.12] hover:border-[#669DF6]/50 shadow-[0_0_20px_rgba(66,133,244,0.12)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStage === "r1_firing"
                      ? "bg-[#669DF6] animate-ping"
                      : "bg-[#669DF6]"
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  R1 · Isolated Baseline
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                <span className="px-1.5 py-0.5 rounded bg-win-green/15 text-win-green border border-win-green/30">
                  {r1Breakdown.buy} BUY
                </span>
                <span className="px-1.5 py-0.5 rounded bg-vc-gold/15 text-vc-gold border border-vc-gold/30">
                  {r1Breakdown.eval} EVAL
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 border border-white/10">
                  {r1Breakdown.pass} PASS
                </span>
                <span className="px-1.5 py-0.5 rounded bg-loss-red/15 text-loss-red border border-loss-red/30">
                  {r1Breakdown.boycott} BOYC
                </span>
              </div>
            </div>

            {(isRunning || activeReactions.length > 0) && (
              <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] truncate">
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="font-mono font-semibold text-[#A8C7FA] shrink-0">
                    {currentR1Thought.tag}
                  </span>
                  <span className="text-white/65 truncate">
                    &ldquo;{currentR1Thought.quote}&rdquo;
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#A8C7FA] shrink-0 tabular-nums">
                  {activeReactions.length}/20
                </span>
              </div>
            )}
          </motion.button>
        </div>

        {/* LAYER 3: 3 PARALLEL CONTAGION SIGNAL NODES (CREATORS · CREW CAPTAINS · REDDIT) */}
        <div className="grid grid-cols-3 gap-3 max-w-3xl w-full mx-auto">
          {/* Node 3A: Creator Co-Streams */}
          <motion.button
            type="button"
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_creators" ? null : "sig_creators"
              )
            }
            whileTap={{ scale: 0.98 }}
            className={`rounded-2xl px-3.5 py-2.5 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              selectedNodeId === "sig_creators"
                ? "bg-[#1A1228]/95 border-[#9B72CB]/80 shadow-[0_0_26px_rgba(155,114,203,0.35)]"
                : "bg-[#0C0D17]/90 border-white/[0.1] hover:border-[#9B72CB]/55"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-3.5 h-3.5 text-[#D96570] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  Creator Co-Streams
                </div>
                <div className="text-[10px] font-mono text-white/50 truncate">
                  {creatorSignals[0]?.handle || "@Agent00"} ·{" "}
                  {creatorSignals[0]?.mroas
                    ? `${creatorSignals[0].mroas.toFixed(1)}x`
                    : "3.8x"}{" "}
                  mROAS
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-win-green/15 border border-win-green/30 text-[10px] font-mono font-semibold text-win-green shrink-0 tabular-nums">
              +
              {creatorSignals.reduce(
                (acc, c) => acc + (c.attributed_flips || 0),
                0
              ) || Math.max(2, Math.round(contagionFlipsCount * 0.45))}
            </span>
          </motion.button>

          {/* Node 3B: Crew Captain Social Gravity */}
          <motion.button
            type="button"
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_crews" ? null : "sig_crews"
              )
            }
            whileTap={{ scale: 0.98 }}
            className={`rounded-2xl px-3.5 py-2.5 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              selectedNodeId === "sig_crews"
                ? "bg-[#0E1C26]/95 border-[#00F5D4]/75 shadow-[0_0_26px_rgba(0,245,212,0.3)]"
                : "bg-[#0C0D17]/90 border-white/[0.1] hover:border-[#00F5D4]/50"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  Crew Captains
                </div>
                <div className="text-[10px] font-mono text-[#00F5D4] truncate tabular-nums">
                  {crewMultiplier.toFixed(1)}x Squad Cascade
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-win-green/15 border border-win-green/30 text-[10px] font-mono font-semibold text-win-green shrink-0 tabular-nums">
              +{Math.max(2, Math.round(contagionFlipsCount * 0.4))}
            </span>
          </motion.button>

          {/* Node 3C: r/NBA2K Community Pulse */}
          <motion.button
            type="button"
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_reddit" ? null : "sig_reddit"
              )
            }
            whileTap={{ scale: 0.98 }}
            className={`rounded-2xl px-3.5 py-2.5 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              selectedNodeId === "sig_reddit"
                ? "bg-[#24131C]/95 border-[#D96570]/80 shadow-[0_0_26px_rgba(217,101,112,0.35)]"
                : "bg-[#0C0D17]/90 border-white/[0.1] hover:border-[#D96570]/55"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">
                  r/NBA2K Pulse
                </div>
                <div className="text-[10px] font-mono text-white/50 truncate">
                  Community Sentiment
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-vc-gold/15 border border-vc-gold/30 text-[10px] font-mono font-semibold text-vc-gold shrink-0 tabular-nums">
              {redditThreads.length || 3}
            </span>
          </motion.button>
        </div>

        {/* LAYER 4: ROUND 2 · SOCIAL CONTAGION SHIFT (+ DYNAMIC R3 WHAT-IF RESCUE BRANCH) */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* R2 Social Contagion Node */}
          <motion.button
            type="button"
            layout
            onClick={() => {
              onSelectRound(2);
              setSelectedNodeId((prev) => (prev === "r2" ? null : "r2"));
            }}
            animate={{
              scale: activeStage === "r2_firing" ? 1.025 : 1,
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.38 }}
            className={`group relative rounded-2xl px-5 py-2.5 text-left border backdrop-blur-xl transition-all ${
              hasRound3 ? "w-full sm:w-[420px]" : "w-full max-w-xl"
            } ${
              selectedNodeId === "r2" || (activeRound === 2 && !hasRound3)
                ? "bg-[#151226]/95 border-[#9B72CB]/85 shadow-[0_0_40px_rgba(155,114,203,0.35)]"
                : "bg-[#0C0E18]/90 border-white/[0.14] hover:border-[#9B72CB]/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStage === "r2_firing"
                      ? "bg-[#D96570] animate-ping"
                      : "bg-[#9B72CB]"
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  R2 · Social Contagion Cascade
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-win-green/20 border border-win-green/40 text-win-green font-mono text-[10px] font-semibold tabular-nums">
                  +{contagionFlipsCount} Flips
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#9B72CB]/20 border border-[#9B72CB]/40 text-[#E9D5FF] font-mono text-[10px] font-semibold tabular-nums">
                  +{conversionLift.toFixed(1)}% Lift
                </span>
              </div>
            </div>

            {(isRunning || activeReactions.length > 0) && (
              <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] truncate">
                <span className="font-mono font-semibold text-[#00F5D4] shrink-0">
                  {currentR2Thought.tag}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-win-green/15 text-win-green text-[9px] font-mono shrink-0">
                  {currentR2Thought.driver}
                </span>
                <span className="text-white/70 truncate">
                  &ldquo;{currentR2Thought.quote}&rdquo;
                </span>
              </div>
            )}
          </motion.button>

          {/* Dynamic R3 What-If Counterfactual Rescue Branch Node */}
          <AnimatePresence>
            {hasRound3 && (
              <motion.button
                key="r3-neural-branch"
                type="button"
                initial={{ opacity: 0, scale: 0.88, x: -16 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.88, x: -16 }}
                transition={{ type: "spring", bounce: 0.22, duration: 0.42 }}
                onClick={() => {
                  onSelectRound(3);
                  setSelectedNodeId((prev) => (prev === "r3" ? null : "r3"));
                }}
                className={`rounded-2xl px-4 py-2.5 text-left border backdrop-blur-xl transition-all w-full sm:w-[270px] ${
                  selectedNodeId === "r3" || activeRound === 3
                    ? "bg-[#09221E]/95 border-[#00F5D4]/85 shadow-[0_0_36px_rgba(0,245,212,0.35)]"
                    : "bg-[#081917]/90 border-[#00F5D4]/45 hover:border-[#00F5D4]/80"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">
                      R3 · What-If Rescue
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-win-green/25 border border-win-green/50 text-win-green font-mono text-[10px] font-semibold tabular-nums shrink-0">
                    +{round3FlipsCount} Rescued
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-[#A7F3D0]">
                  <span className="truncate">{selectedCfLabel}</span>
                  <span className="text-white/75 shrink-0">→ BUY</span>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* LAYER 5: 4 FINAL VERDICT OUTPUT TERMINALS (BUY / EVAL / PASS / BOYCOTT) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl w-full mx-auto">
          {[
            {
              id: "verdict_buy" as const,
              label: "PURCHASED",
              count: buyCount,
              pct: buyPct,
              icon: CheckCircle2,
              color: "text-win-green",
              bar: "bg-win-green",
              borderActive:
                "border-win-green/80 bg-[#0A2018]/95 shadow-[0_0_28px_rgba(25,195,125,0.3)]",
              borderIdle: "border-win-green/30 hover:border-win-green/65 bg-[#091412]/90",
            },
            {
              id: "verdict_eval" as const,
              label: "EVALUATING",
              count: evalCount,
              pct: evalPct,
              icon: Clock,
              color: "text-vc-gold",
              bar: "bg-vc-gold",
              borderActive:
                "border-vc-gold/80 bg-[#211A0A]/95 shadow-[0_0_28px_rgba(255,184,0,0.28)]",
              borderIdle: "border-vc-gold/30 hover:border-vc-gold/65 bg-[#141109]/90",
            },
            {
              id: "verdict_pass" as const,
              label: "ABANDONED",
              count: passCount,
              pct: passPct,
              icon: MinusCircle,
              color: "text-slate-300",
              bar: "bg-slate-400",
              borderActive: "border-white/50 bg-[#151821]/95",
              borderIdle: "border-white/[0.12] hover:border-white/30 bg-[#0D0F16]/90",
            },
            {
              id: "verdict_boycott" as const,
              label: "BOYCOTT",
              count: boycottCount,
              pct: boycottPct,
              icon: AlertOctagon,
              color: "text-loss-red",
              bar: "bg-loss-red",
              borderActive:
                "border-loss-red/80 bg-[#240D12]/95 shadow-[0_0_28px_rgba(255,77,94,0.3)]",
              borderIdle: "border-loss-red/30 hover:border-loss-red/65 bg-[#160B0E]/90",
            },
          ].map((v) => {
            const Icon = v.icon;
            const isSelected = selectedNodeId === v.id;
            return (
              <motion.button
                key={v.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setSelectedNodeId((prev) => (prev === v.id ? null : v.id))
                }
                className={`rounded-2xl px-3.5 py-2.5 text-left border backdrop-blur-xl transition-all ${
                  isSelected ? v.borderActive : v.borderIdle
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${v.color}`} />
                    <span className="text-[10px] font-mono font-bold tracking-wider text-white/90">
                      {v.label}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white tabular-nums">
                    {v.count}
                    <span className="text-[10px] font-normal text-white/40">
                      /{totalDenominator}
                    </span>
                  </span>
                </div>

                <div className="mt-2 h-1 w-full rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    style={{ width: `${v.pct}%` }}
                    className={`h-full ${v.bar} transition-all duration-500`}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ================= INLINE SLIDE-UP GLASS DRAWER ON NODE CLICK ================= */}
      <AnimatePresence>
        {drawerData && (
          <motion.div
            key={`neural-drawer-${selectedNodeId}`}
            initial={{ opacity: 0, y: 120 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 120 }}
            transition={{ type: "spring", bounce: 0.14, duration: 0.36 }}
            className="absolute inset-x-3 bottom-3 z-30 max-h-[56%] rounded-2xl border border-white/[0.16] bg-[#0B0D16]/95 backdrop-blur-2xl shadow-[0_-16px_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
          >
            {/* Top Gemini Accent Strip */}
            <div className={`h-1 w-full bg-gradient-to-r ${drawerData.accent}`} />

            <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#A8C7FA] shrink-0" />
                  <h4 className="text-xs font-semibold text-white truncate">
                    {drawerData.title}
                  </h4>
                </div>
                <p className="text-[11px] text-white/55 truncate mt-0.5">
                  {drawerData.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2">
              {/* Special Creator Signal Breakdown when sig_creators is clicked */}
              {drawerData.mode === "creators" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
                  {creatorSignals.map((cr) => (
                    <div
                      key={cr.id}
                      className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-semibold text-white">{cr.handle}</span>
                        <span className="text-win-green">+{cr.attributed_flips} flips</span>
                      </div>
                      <p className="text-[11px] text-white/75 leading-snug">
                        &ldquo;{cr.headline}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Special Reddit Pulse Breakdown when sig_reddit is clicked */}
              {drawerData.mode === "reddit" && redditThreads.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                  {redditThreads.slice(0, 4).map((th, i) => (
                    <div
                      key={th.id || i}
                      className="rounded-xl border border-white/[0.08] bg-black/50 p-2.5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                        <span>{th.subreddit || "r/NBA2K"}</span>
                        <span className="text-vc-gold">▲ {th.upvotes} upvotes</span>
                      </div>
                      <p className="text-xs font-medium text-white/90 leading-snug">
                        {th.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Filtered Personas Grid inside the Drawer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(drawerData.players.length > 0
                  ? drawerData.players
                  : allInspectableReactions.slice(0, 6)
                ).map((p, idx) => {
                  const r1S = shortStateBadge(p.round1_fsm_state || p.final_fsm_state);
                  const r2S = shortStateBadge(p.final_fsm_state);
                  const r3S = p.round3_fsm_state
                    ? shortStateBadge(p.round3_fsm_state)
                    : null;
                  const bColor = archetypeColor(p.archetype);
                  return (
                    <div
                      key={`${p.player_id}-${idx}`}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] px-3 py-2 flex flex-col justify-between gap-1.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            style={{ backgroundColor: bColor }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="text-xs font-semibold text-white truncate">
                            @{String(p.gamer_tag).replace(/^@/, "")}
                          </span>
                          <span className="text-[10px] font-mono text-white/45 truncate">
                            {p.myplayer_ovr || 85} OVR · {p.crew_name || "Bucket Getters"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/80">
                            R1 {r1S}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-white/35" />
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              r2S === "BUY"
                                ? "bg-win-green/20 text-win-green"
                                : r2S === "BOYCOTT"
                                  ? "bg-loss-red/20 text-loss-red"
                                  : "bg-vc-gold/20 text-vc-gold"
                            }`}
                          >
                            R2 {r2S}
                          </span>
                          {r3S && r3S !== r2S && (
                            <>
                              <ArrowRight className="w-2.5 h-2.5 text-white/35" />
                              <span className="px-1.5 py-0.5 rounded bg-win-green/25 text-win-green font-semibold">
                                R3 {r3S}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-white/75 line-clamp-2 leading-snug">
                        &ldquo;
                        {drawerData.mode === "players_r1"
                          ? p.round1_quote || p.verbatim_quote
                          : p.verbatim_quote}
                        &rdquo;
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[10px] font-mono text-white/45 truncate">
                          {archetypeLabel(p.archetype)} · WTP $
                          {(p.willingness_to_pay_usd || priceUsd).toFixed(2)}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onInterrogatePersona(p)}
                            className="px-2 py-0.5 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[10px] font-medium text-white flex items-center gap-1 transition-colors"
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-[#669DF6]" />
                            <span>1-on-1</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onInterrogatePersona(p)}
                            className="px-2 py-0.5 rounded-md bg-twok-red/20 hover:bg-twok-red/30 border border-twok-red/35 text-[10px] font-medium text-white flex items-center gap-1 transition-colors"
                          >
                            <Users className="w-2.5 h-2.5 text-twok-red" />
                            <span>Debate</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
