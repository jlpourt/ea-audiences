"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  Volume2,
  Pause,
  Play,
  RotateCcw,
  GitBranch,
  Eye,
} from "lucide-react";
import { FocusGroupReaction } from "@/lib/types";
import { archetypeLabel, archetypeColor } from "@/lib/archetypes";
import type { ExplainFlowBeat } from "@/app/api/synthetic/focus-group/explain/route";

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

export type SignalChannelId = "sig_creators" | "sig_crews" | "sig_reddit";

export type SyntheticAudienceScale = 20 | 100 | 1000 | 6500;

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
  swarmSize: SyntheticAudienceScale;
  onChangeSwarmSize?: (size: SyntheticAudienceScale) => void;
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
  onChangeSwarmSize,
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
  const [hoveredNodeId, setHoveredNodeId] = useState<NeuralNodeId | null>(null);
  const [thoughtTickIndex, setThoughtTickIndex] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // 1. Single-Photon Attribution Trace State
  // ---------------------------------------------------------------------------
  const [traceModeActive, setTraceModeActive] = useState<boolean>(false);
  const [tracePlayerIndex, setTracePlayerIndex] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // 2. Layer-3 Interactive Signal Ablation / Mute Toggles
  // ---------------------------------------------------------------------------
  const [mutedSignals, setMutedSignals] = useState<Record<SignalChannelId, boolean>>({
    sig_creators: false,
    sig_crews: false,
    sig_reddit: false,
  });

  const anySignalMuted =
    mutedSignals.sig_creators || mutedSignals.sig_crews || mutedSignals.sig_reddit;

  const toggleMuteSignal = useCallback(
    (sig: SignalChannelId, e: React.MouseEvent) => {
      e.stopPropagation();
      setMutedSignals((prev) => ({ ...prev, [sig]: !prev[sig] }));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // 3. Choreographed Dual-Voice Walkthrough State (Gemini 3.8 Flash + 3.1 TTS)
  // ---------------------------------------------------------------------------
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioBeats, setAudioBeats] = useState<ExplainFlowBeat[]>([]);
  const [activeBeatIndex, setActiveBeatIndex] = useState<number | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cachedKeyRef = useRef<string>("");

  // Reset cached voice walkthrough when offer or simulation reactions change
  const currentSimSignature = `${creativeTitle}|${priceUsd}|${totalDenominator}|${buyCount}|${contagionFlipsCount}|${hasRound3}|${round3FlipsCount}`;
  useEffect(() => {
    if (cachedKeyRef.current && cachedKeyRef.current !== currentSimSignature) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingAudio(false);
      setActiveBeatIndex(null);
      setAudioDataUrl(null);
      setAudioBeats([]);
    }
  }, [currentSimSignature]);

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

  // Compute R1 isolated counts vs R2 social counts, scaled to totalDenominator (20 | 100 | 1,000 | 6,500)
  const r1Breakdown = useMemo(() => {
    const states = [
      ...activeReactions.map((r) => r.round1_fsm_state || r.final_fsm_state || "EVALUATING"),
      ...(swarmSize >= 100 && crowdAgents.length > 0
        ? crowdAgents.map((a) => a.round1_state || "EVALUATING")
        : []),
    ];
    if (states.length === 0) {
      const scale = totalDenominator / 20;
      const buy = Math.round(5 * scale);
      const pass = Math.round(4 * scale);
      const boycott = Math.round(2 * scale);
      const evalC = Math.max(0, totalDenominator - buy - pass - boycott);
      return { buy, eval: evalC, pass, boycott, total: totalDenominator };
    }
    const rawTotal = Math.max(1, states.length);
    const scale = totalDenominator / rawTotal;
    const buy = Math.round(states.filter((s) => s === "PURCHASED").length * scale);
    const pass = Math.round(states.filter((s) => s === "ABANDONED").length * scale);
    const boycott = Math.round(states.filter((s) => s === "BOYCOTT").length * scale);
    const evalC = Math.max(0, totalDenominator - buy - pass - boycott);
    return { buy, eval: evalC, pass, boycott, total: totalDenominator };
  }, [activeReactions, crowdAgents, swarmSize, totalDenominator]);

  // Attributed flip counts per Layer-3 Signal Node
  const signalAttribution = useMemo(() => {
    const totalFlips = Math.max(0, contagionFlipsCount);
    const creatorRaw =
      creatorSignals.reduce((acc, c) => acc + (c.attributed_flips || 0), 0) ||
      Math.max(1, Math.round(totalFlips * 0.42));
    const crewRaw = Math.max(1, Math.round(totalFlips * 0.45));
    const redditRaw = Math.max(0, totalFlips - Math.min(totalFlips, creatorRaw + crewRaw));

    // Normalize so attributed flips sum cleanly to totalFlips when > 0
    if (totalFlips === 0) {
      return { creators: 2, crews: 3, reddit: 1, lostFlips: 0, lostBoycotts: 0 };
    }
    const c1 = Math.min(totalFlips, Math.max(1, Math.round(totalFlips * 0.42)));
    const c2 = Math.min(totalFlips - c1, Math.max(1, Math.round(totalFlips * 0.45)));
    const c3 = Math.max(0, totalFlips - c1 - c2);

    const lostFlips =
      (mutedSignals.sig_creators ? c1 : 0) +
      (mutedSignals.sig_crews ? c2 : 0) +
      (mutedSignals.sig_reddit ? c3 : 0);

    return {
      creators: c1,
      crews: c2,
      reddit: Math.max(1, c3),
      lostFlips,
      lostBoycotts: mutedSignals.sig_reddit ? Math.min(boycottCount, 1) : 0,
    };
  }, [creatorSignals, contagionFlipsCount, mutedSignals, boycottCount]);

  // Effective downstream numbers after any Layer-3 Signal Ablation / Mute
  const effectiveMetrics = useMemo(() => {
    const lost = signalAttribution.lostFlips;
    const effFlips = Math.max(0, contagionFlipsCount - lost);
    const effBuy = Math.max(r1Breakdown.buy, buyCount - lost);
    const effEval = evalCount + lost;
    const effPass = passCount;
    const effBoycott = Math.max(0, boycottCount - signalAttribution.lostBoycotts);
    const ratio =
      contagionFlipsCount > 0 ? effFlips / contagionFlipsCount : 1;
    const effLift = Number((conversionLift * ratio).toFixed(1));
    const effCascade = mutedSignals.sig_crews
      ? 1.0
      : Number((1 + (crewMultiplier - 1) * ratio).toFixed(1));

    return {
      flips: effFlips,
      buy: effBuy,
      eval: effEval,
      pass: effPass,
      boycott: effBoycott,
      lift: effLift,
      cascade: effCascade,
      deltaBuy: effBuy - buyCount,
    };
  }, [
    signalAttribution,
    contagionFlipsCount,
    r1Breakdown.buy,
    buyCount,
    evalCount,
    passCount,
    boycottCount,
    conversionLift,
    crewMultiplier,
    mutedSignals.sig_crews,
  ]);

  // Build unified list of inspectable reactions
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
              contagion_driver:
                idx % 3 === 0 ? "CREATOR_STREAM" : "CREW_CAPTAIN",
              round1_quote: `At $${priceUsd.toFixed(2)}, I'm waiting to see if my ${p.crew_name || "Rec"} squad locks in before spending VC.`,
              willingness_to_pay_usd: priceUsd,
              verbatim_quote: `My ${p.crew_name || "Bucket Getters"} Captain locked in ${creativeTitle} for Rec tonight · flipping from EVAL to BUY.`,
              authenticity_rating: 0.93,
              churn_risk_score: 0.28,
              sentiment_score: 0.68,
            })
          );
    return base;
  }, [activeReactions, sampledPersonas, priceUsd, creativeTitle]);

  const flippedReactions = useMemo(
    () =>
      allInspectableReactions.filter(
        (r) =>
          r.contagion_flipped ||
          (r.round1_fsm_state && r.round1_fsm_state !== r.final_fsm_state)
      ),
    [allInspectableReactions]
  );

  const r3RescuedReactions = useMemo(
    () =>
      allInspectableReactions.filter(
        (r) =>
          r.round3_flipped ||
          (r.round3_fsm_state && r.round3_fsm_state !== r.final_fsm_state)
      ),
    [allInspectableReactions]
  );

  // Active traced player for Single-Photon Attribution Trace
  const tracedPlayer = useMemo(() => {
    const pool =
      flippedReactions.length > 0 ? flippedReactions : allInspectableReactions;
    const p = pool[tracePlayerIndex % Math.max(1, pool.length)] || pool[0];
    if (!p) return null;
    const signalNode: SignalChannelId =
      p.contagion_driver === "CREATOR_STREAM"
        ? "sig_creators"
        : p.contagion_driver === "REDDIT_THREAD"
          ? "sig_reddit"
          : "sig_crews";
    const signalLabel =
      signalNode === "sig_creators"
        ? p.creator_handle || creatorSignals[0]?.handle || "@Agent00"
        : signalNode === "sig_reddit"
          ? "r/NBA2K Thread"
          : `${p.crew_name || "Bucket Getters"} Captain`;
    const r1State = shortStateBadge(p.round1_fsm_state || "EVALUATING");
    const r2State = shortStateBadge(p.final_fsm_state || "PURCHASED");
    const verdictNode: NeuralNodeId =
      r2State === "BUY"
        ? "verdict_buy"
        : r2State === "BOYCOTT"
          ? "verdict_boycott"
          : r2State === "PASS"
            ? "verdict_pass"
            : "verdict_eval";

    return {
      reaction: p,
      tag: `@${String(p.gamer_tag || "SwishGod_2K").replace(/^@/, "")}`,
      ovr: p.myplayer_ovr || 84,
      crew: p.crew_name || "Bucket Getters",
      r1State,
      r2State,
      signalNode,
      signalLabel,
      verdictNode,
      r1Quote:
        p.round1_quote ||
        `Holding off at $${priceUsd.toFixed(2)} until I see what my squad is doing.`,
      r2Quote:
        p.verbatim_quote ||
        `Saw ${signalLabel} lock in for Rec tonight · flipping from ${r1State} to ${r2State}.`,
    };
  }, [flippedReactions, allInspectableReactions, tracePlayerIndex, creatorSignals, priceUsd]);

  // Latest active thought for R1 and R2
  const currentR1Thought = useMemo(() => {
    const pool = allInspectableReactions;
    const idx = isRunning
      ? Math.max(0, pool.length - 1)
      : thoughtTickIndex % Math.max(1, pool.length);
    const r = pool[idx] || pool[0];
    return {
      tag: `@${String(r?.gamer_tag || "SwishGod_2K").replace(/^@/, "")}`,
      state: shortStateBadge(r?.round1_fsm_state || r?.final_fsm_state),
      quote:
        r?.round1_quote ||
        r?.verbatim_quote ||
        `Checking ${creativeTitle} at $${priceUsd.toFixed(2)} before locking in.`,
    };
  }, [allInspectableReactions, isRunning, thoughtTickIndex, creativeTitle, priceUsd]);

  const currentR2Thought = useMemo(() => {
    const pool =
      flippedReactions.length > 0 ? flippedReactions : allInspectableReactions;
    const r = pool[thoughtTickIndex % Math.max(1, pool.length)] || pool[0];
    const driver = r?.contagion_source_tag
      ? `via ${r.contagion_source_tag}`
      : r?.contagion_driver === "CREATOR_STREAM"
        ? `via ${r.creator_handle || "@Agent00"}`
        : r?.contagion_driver === "REDDIT_THREAD"
          ? "via r/NBA2K"
          : `via ${r?.crew_name || "Crew"} Captain`;
    return {
      tag: `@${String(r?.gamer_tag || "IsoKing_99").replace(/^@/, "")}`,
      driver,
      quote:
        r?.verbatim_quote ||
        `Squad is running Rec tonight · flipping to ${shortStateBadge(r?.final_fsm_state)}.`,
    };
  }, [flippedReactions, allInspectableReactions, thoughtTickIndex]);

  // ---------------------------------------------------------------------------
  // Web Audio API Analyser + Timecode Beat Sync for Voice Walkthrough
  // ---------------------------------------------------------------------------
  const stopAudioMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAudioMeter = useCallback(() => {
    if (!audioRef.current) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      if (!sourceNodeRef.current) {
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
        sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(
          audioRef.current
        );
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }
      const analyser = analyserRef.current;
      if (!analyser) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!audioRef.current || audioRef.current.paused) {
          setAudioLevel(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / (dataArray.length * 255);
        setAudioLevel(Math.min(1, avg * 2.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Fallback if MediaElementSource already attached
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudioMeter();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [stopAudioMeter]);

  const handleAudioTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.duration || audioBeats.length === 0) return;
    const ratio = el.currentTime / el.duration;
    const foundIdx = audioBeats.findIndex(
      (b, idx) =>
        (ratio >= b.startRatio && ratio <= b.endRatio) ||
        (idx === audioBeats.length - 1 && ratio >= b.startRatio)
    );
    const nextIdx = foundIdx >= 0 ? foundIdx : 0;
    setActiveBeatIndex(nextIdx);
    // Automatically enable single-photon trace during Beat 3 (Player Flip story)
    if (audioBeats[nextIdx]?.stage === "r2") {
      setTraceModeActive(true);
    }
  }, [audioBeats]);

  const handleScrubToBeat = useCallback(
    (idx: number) => {
      setActiveBeatIndex(idx);
      const beat = audioBeats[idx];
      if (!beat) return;
      if (beat.stage === "r2") {
        setTraceModeActive(true);
      }
      if (audioRef.current && audioRef.current.duration) {
        audioRef.current.currentTime =
          beat.startRatio * audioRef.current.duration + 0.05;
        if (audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
          setIsPlayingAudio(true);
          startAudioMeter();
        }
      }
    },
    [audioBeats, startAudioMeter]
  );

  const handleToggleVoiceWalkthrough = useCallback(async () => {
    setAudioError(null);
    // If already playing, pause
    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      stopAudioMeter();
      return;
    }

    // If already synthesized for this simulation state, resume or replay from start
    if (
      audioDataUrl &&
      audioBeats.length > 0 &&
      cachedKeyRef.current === currentSimSignature &&
      audioRef.current
    ) {
      if (
        audioRef.current.ended ||
        audioRef.current.currentTime >= (audioRef.current.duration || 1) - 0.2
      ) {
        audioRef.current.currentTime = 0;
        setActiveBeatIndex(0);
      }
      await audioRef.current.play();
      setIsPlayingAudio(true);
      startAudioMeter();
      return;
    }

    // Synthesize live via Gemini 3.8 Flash + Gemini 3.1 Flash Multi-Speaker TTS
    setIsSynthesizingAudio(true);
    try {
      const revenue30d = Math.round(effectiveMetrics.buy * priceUsd * 65);
      const resp = await fetch("/api/synthetic/focus-group/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creativeTitle,
          priceUsd,
          totalDenominator,
          r1Buy: r1Breakdown.buy,
          r1Eval: r1Breakdown.eval,
          r1Pass: r1Breakdown.pass,
          buyCount: effectiveMetrics.buy,
          contagionFlipsCount: effectiveMetrics.flips,
          round3FlipsCount,
          hasRound3,
          selectedCfLabel,
          crewMultiplier: effectiveMetrics.cascade,
          conversionLift: effectiveMetrics.lift,
          revenue30d,
          topCreator: creatorSignals[0]?.handle || "@Agent00",
          featuredPlayerTag: tracedPlayer?.tag || "@SwishGod_2K",
          featuredPlayerOvr: tracedPlayer?.ovr || 84,
          featuredPlayerCrew: tracedPlayer?.crew || "Bucket Getters",
          featuredPlayerR1State: tracedPlayer?.r1State || "EVAL",
          featuredPlayerDriver: tracedPlayer?.signalLabel || "Crew Captain",
          featuredPlayerQuote:
            tracedPlayer?.r2Quote ||
            "My Crew Captain locked in for Rec tonight, I'm in.",
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.audioDataUrl) {
        throw new Error(data.details || data.error || `HTTP ${resp.status}`);
      }

      cachedKeyRef.current = currentSimSignature;
      setAudioDataUrl(data.audioDataUrl);
      setAudioBeats(data.beats || []);
      setActiveBeatIndex(0);

      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.src = data.audioDataUrl;
          audioRef.current.currentTime = 0;
          try {
            await audioRef.current.play();
            setIsPlayingAudio(true);
            startAudioMeter();
          } catch (playErr: any) {
            setAudioError(playErr?.message || "Playback blocked by browser");
          }
        }
      }, 60);
    } catch (err: any) {
      setAudioError(err?.message || "Voice synthesis failed");
    } finally {
      setIsSynthesizingAudio(false);
    }
  }, [
    isPlayingAudio,
    audioDataUrl,
    audioBeats.length,
    currentSimSignature,
    stopAudioMeter,
    startAudioMeter,
    effectiveMetrics,
    priceUsd,
    creativeTitle,
    totalDenominator,
    r1Breakdown,
    round3FlipsCount,
    hasRound3,
    selectedCfLabel,
    creatorSignals,
    tracedPlayer,
  ]);

  // Active Walkthrough Beat
  const currentBeat =
    activeBeatIndex !== null && audioBeats[activeBeatIndex]
      ? audioBeats[activeBeatIndex]
      : null;

  // Determine which node(s) are currently spotlighted by hover, trace, or voice walkthrough
  const isNodeSpotlighted = useCallback(
    (nodeId: NeuralNodeId): boolean => {
      if (hoveredNodeId === nodeId || selectedNodeId === nodeId) return true;
      if (currentBeat) {
        if (currentBeat.stage === "r1" && (nodeId === "seed" || nodeId === "r1"))
          return true;
        if (
          currentBeat.stage === "signals" &&
          (nodeId === "sig_creators" ||
            nodeId === "sig_crews" ||
            nodeId === "sig_reddit")
        )
          return true;
        if (
          currentBeat.stage === "r2" &&
          (nodeId === "r2" || nodeId === tracedPlayer?.signalNode)
        )
          return true;
        if (
          currentBeat.stage === "verdict" &&
          (nodeId === "verdict_buy" || (hasRound3 && nodeId === "r3"))
        )
          return true;
      }
      if (traceModeActive && tracedPlayer) {
        if (
          nodeId === "seed" ||
          nodeId === "r1" ||
          nodeId === tracedPlayer.signalNode ||
          nodeId === "r2" ||
          nodeId === tracedPlayer.verdictNode
        ) {
          return true;
        }
      }
      return false;
    },
    [hoveredNodeId, selectedNodeId, currentBeat, traceModeActive, tracedPlayer, hasRound3]
  );

  // Plain-English X-Ray Hover Explanation for any hovered node
  const hoverExplanation = useMemo(() => {
    const target = hoveredNodeId || selectedNodeId;
    if (!target) return null;
    switch (target) {
      case "seed":
        return {
          badge: "STEP 1 · INJECTION",
          color: "text-[#A8C7FA]",
          text: `Injecting "${creativeTitle}" ($${priceUsd.toFixed(2)}) into ${totalDenominator} live Spanner Graph player personas from ${cohortName}.`,
        };
      case "r1":
        return {
          badge: "STEP 2 · ALONE (R1)",
          color: "text-[#669DF6]",
          text: `Each player evaluates price vs. OVR & VC balance in isolation—only ${r1Breakdown.buy} buy alone while ${r1Breakdown.eval} wait on their squad.`,
        };
      case "sig_creators":
        return {
          badge: mutedSignals.sig_creators
            ? "SIGNAL MUTED · CREATORS"
            : "STEP 3A · CREATOR STREAM",
          color: mutedSignals.sig_creators ? "text-white/40" : "text-[#D96570]",
          text: mutedSignals.sig_creators
            ? `Creator Co-Streams muted—losing ${signalAttribution.creators} attributed R2 conversions.`
            : `${creatorSignals[0]?.handle || "@Agent00"} co-stream validates the build meta, flipping +${signalAttribution.creators} fence-sitters (${creatorSignals[0]?.mroas?.toFixed(1) || "3.8"}x mROAS).`,
        };
      case "sig_crews":
        return {
          badge: mutedSignals.sig_crews
            ? "SIGNAL MUTED · CREWS"
            : "STEP 3B · CREW GRAVITY",
          color: mutedSignals.sig_crews ? "text-white/40" : "text-[#00F5D4]",
          text: mutedSignals.sig_crews
            ? `Crew Captains muted—losing ${signalAttribution.crews} squad-cascade conversions.`
            : `Rec/Pro-Am Captains trigger a ${effectiveMetrics.cascade.toFixed(1)}x peer cascade in Discord, pulling +${signalAttribution.crews} squadmates into BUY.`,
        };
      case "sig_reddit":
        return {
          badge: mutedSignals.sig_reddit
            ? "SIGNAL MUTED · REDDIT"
            : "STEP 3C · r/NBA2K PULSE",
          color: mutedSignals.sig_reddit ? "text-white/40" : "text-[#FFB800]",
          text: `Live r/NBA2K community threads test price backlash vs. build utility across ${redditThreads.length || 3} viral discussions.`,
        };
      case "r2":
        return {
          badge: "STEP 4 · CONTAGION SHIFT (R2)",
          color: "text-[#E9D5FF]",
          text: `Social proof flips +${effectiveMetrics.flips} hesitant players into BUY, boosting net conversion lift by +${effectiveMetrics.lift.toFixed(1)}%.`,
        };
      case "r3":
        return {
          badge: "STEP 4B · WHAT-IF RESCUE (R3)",
          color: "text-[#00F5D4]",
          text: `Counterfactual shock ("${selectedCfLabel}") rescues +${round3FlipsCount} holdouts directly into PURCHASED.`,
        };
      case "verdict_buy":
        return {
          badge: "VERDICT · PURCHASED",
          color: "text-win-green",
          text: `${effectiveMetrics.buy} of ${totalDenominator} players convert (${r1Breakdown.buy} in R1 alone + ${effectiveMetrics.flips} via social contagion${hasRound3 ? ` + ${round3FlipsCount} R3 rescue` : ""}).`,
        };
      case "verdict_eval":
        return {
          badge: "VERDICT · EVALUATING",
          color: "text-vc-gold",
          text: `${effectiveMetrics.eval} persuadable fence-sitters waiting for a Crew Captain nudge or What-If bonus.`,
        };
      case "verdict_pass":
        return {
          badge: "VERDICT · ABANDONED",
          color: "text-slate-300",
          text: `${effectiveMetrics.pass} low-intent players where $${priceUsd.toFixed(2)} exceeds current Willingness-to-Pay.`,
        };
      case "verdict_boycott":
        return {
          badge: "VERDICT · SLEEPING DOGS",
          color: "text-loss-red",
          text: `${effectiveMetrics.boycott} high-tilt holdouts—suppress from standard push to protect squad retention.`,
        };
    }
  }, [
    hoveredNodeId,
    selectedNodeId,
    creativeTitle,
    priceUsd,
    totalDenominator,
    cohortName,
    r1Breakdown,
    mutedSignals,
    signalAttribution,
    creatorSignals,
    effectiveMetrics,
    redditThreads.length,
    selectedCfLabel,
    round3FlipsCount,
    hasRound3,
  ]);

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
          title: `Layer 3B · Crew Captain Social Gravity (${effectiveMetrics.cascade.toFixed(1)}x Cascade)`,
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
          title: `Layer 4 · Round 2 Social Contagion Shift (+${effectiveMetrics.flips} Flips)`,
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
          title: `Layer 5 · PURCHASED Verdict Cluster (${effectiveMetrics.buy} Agents)`,
          subtitle: `Converted players ready for 2K Account / D2C Web Store activation`,
          accent: "from-[#19C37D] to-[#00F5D4]",
          players: allInspectableReactions.filter(
            (r) => getRoundState(r) === "PURCHASED"
          ),
          mode: "players" as const,
        };
      case "verdict_eval":
        return {
          title: `Layer 5 · EVALUATING Verdict Cluster (${effectiveMetrics.eval} Agents)`,
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
          title: `Layer 5 · PASS / ABANDONED Cluster (${effectiveMetrics.pass} Agents)`,
          subtitle: `Low-intent players where offer price exceeds current Willingness-to-Pay`,
          accent: "from-slate-400 to-slate-600",
          players: allInspectableReactions.filter(
            (r) => getRoundState(r) === "ABANDONED"
          ),
          mode: "players" as const,
        };
      case "verdict_boycott":
        return {
          title: `Layer 5 · BOYCOTT / SLEEPING DOG Cluster (${effectiveMetrics.boycott} Agents)`,
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
    effectiveMetrics,
    flippedReactions,
    round3FlipsCount,
    selectedCfLabel,
    r3RescuedReactions,
  ]);

  const totalEvaluated =
    effectiveMetrics.buy +
    effectiveMetrics.eval +
    effectiveMetrics.pass +
    effectiveMetrics.boycott;
  const buyPct =
    totalEvaluated > 0
      ? Math.round((effectiveMetrics.buy / totalEvaluated) * 100)
      : 0;
  const evalPct =
    totalEvaluated > 0
      ? Math.round((effectiveMetrics.eval / totalEvaluated) * 100)
      : 0;
  const passPct =
    totalEvaluated > 0
      ? Math.round((effectiveMetrics.pass / totalEvaluated) * 100)
      : 0;
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

  const signalChannelOrder: SignalChannelId[] = [
    "sig_creators",
    "sig_crews",
    "sig_reddit",
  ];

  return (
    <div className="relative flex-1 h-full min-h-0 rounded-2xl border border-white/[0.08] bg-[#040407] overflow-hidden flex flex-col justify-between select-none shadow-[inset_0_0_80px_rgba(66,133,244,0.06)]">
      {/* Hidden Audio Element for Gemini 3.1 Flash Multi-Speaker TTS Walkthrough */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={() => {
          setIsPlayingAudio(false);
          stopAudioMeter();
        }}
        onPause={() => {
          setIsPlayingAudio(false);
          stopAudioMeter();
        }}
        className="hidden"
      />

      {/* Ambient Google Gemini Dark Nebula Background + Neural Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[220px] rounded-full blur-[90px] opacity-30 transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(circle, rgba(66,133,244,0.55) 0%, rgba(155,114,203,0.35) 50%, rgba(217,101,112,0) 100%)",
          }}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[280px] rounded-full blur-[110px] transition-opacity duration-700 ${
            isRunning || isPlayingAudio ? "opacity-45" : "opacity-20"
          }`}
          style={{
            background:
              "radial-gradient(circle, rgba(155,114,203,0.5) 0%, rgba(217,101,112,0.3) 55%, rgba(0,245,212,0) 100%)",
            transform: isPlayingAudio
              ? `translate(-50%, -50%) scale(${1 + audioLevel * 0.18})`
              : "translate(-50%, -50%) scale(1)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* ================= TOP FLOATING EXPLAINABILITY HUD BAR ================= */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-1">
        {/* Left: Synthetic Audience Scale Toggle + Single-Photon Attribution Trace + Reset */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Synthetic Audience Scale Toggle: 20 | 100 | 1K | 6.5K */}
          <div
            data-testid="neural-audience-scale-toggle"
            role="group"
            aria-label="Scale synthetic audience size"
            className="flex items-center gap-0.5 h-7 rounded-full bg-black/65 border border-white/[0.12] p-0.5 backdrop-blur-xl"
          >
            <span className="px-2 text-[9px] font-mono uppercase tracking-wider text-white/45 flex items-center gap-1">
              <Users className="w-2.5 h-2.5 text-[#A8C7FA]" />
              <span className="hidden sm:inline">Audiences</span>
            </span>
            {(
              [
                {
                  size: 20 as const,
                  label: "20",
                  title: "Test against 20 Core Gemini Personas",
                },
                {
                  size: 100 as const,
                  label: "100",
                  title: "Test against 100-Agent Contagion Swarm",
                },
                {
                  size: 1000 as const,
                  label: "1K",
                  title: "Scale to 1,000-Player Spanner Graph Cohort",
                },
                {
                  size: 6500 as const,
                  label: "6.5K",
                  title: "Scale across Full 6,500-Player Spanner Identity Graph",
                },
              ] as const
            ).map((opt) => {
              const active = swarmSize === opt.size;
              return (
                <button
                  key={opt.size}
                  type="button"
                  data-testid={`neural-scale-${opt.size}`}
                  onClick={() => onChangeSwarmSize?.(opt.size)}
                  title={opt.title}
                  className={`relative px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums transition-all ${
                    active
                      ? "bg-gradient-to-r from-[#4285F4]/35 to-[#9B72CB]/35 border border-[#A8C7FA]/60 text-white font-semibold shadow-[0_0_12px_rgba(66,133,244,0.3)]"
                      : "text-white/50 hover:text-white/85"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setTraceModeActive((prev) => !prev)}
            data-testid="trace-flip-btn"
            className={`h-7 px-2.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 border transition-all backdrop-blur-xl ${
              traceModeActive
                ? "bg-[#00F5D4]/15 border-[#00F5D4]/70 text-[#00F5D4] shadow-[0_0_20px_rgba(0,245,212,0.25)]"
                : "bg-white/[0.04] border-white/[0.1] text-white/70 hover:text-white hover:border-white/25"
            }`}
          >
            <GitBranch className="w-3 h-3" />
            <span>
              {traceModeActive && tracedPlayer
                ? `Tracing ${tracedPlayer.tag} (${tracedPlayer.r1State} → ${tracedPlayer.r2State})`
                : "Trace 1 Flip"}
            </span>
          </button>

          {traceModeActive && flippedReactions.length > 1 && (
            <button
              type="button"
              onClick={() => setTracePlayerIndex((prev) => prev + 1)}
              className="h-7 px-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-[10px] font-mono text-white/75 hover:text-white transition-colors"
              title="Trace next flipped player"
            >
              Next ↻
            </button>
          )}

          {anySignalMuted && (
            <button
              type="button"
              onClick={() =>
                setMutedSignals({
                  sig_creators: false,
                  sig_crews: false,
                  sig_reddit: false,
                })
              }
              className="h-7 px-2.5 rounded-full bg-loss-red/15 border border-loss-red/40 text-[10px] font-mono font-semibold text-loss-red hover:bg-loss-red/25 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>
                {effectiveMetrics.deltaBuy} BUY (Reset Signals)
              </span>
            </button>
          )}
        </div>

        {/* Center: 4-Step Interactive Scrubber Pills (Shown when Voice Walkthrough is active or loaded) */}
        {audioBeats.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 rounded-full bg-black/60 border border-white/[0.1] p-0.5 backdrop-blur-xl">
            {[
              { idx: 0, label: "① R1 Alone" },
              { idx: 1, label: "② Contagion" },
              { idx: 2, label: "③ Player Flip" },
              { idx: 3, label: "④ Verdict" },
            ].map((step) => {
              const active = activeBeatIndex === step.idx;
              return (
                <button
                  key={step.idx}
                  type="button"
                  onClick={() => handleScrubToBeat(step.idx)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono transition-all ${
                    active
                      ? "bg-gradient-to-r from-[#4285F4]/35 to-[#9B72CB]/35 border border-[#A8C7FA]/50 text-white font-semibold"
                      : "text-white/50 hover:text-white/85"
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Dual-Voice Courtside Walkthrough Button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleVoiceWalkthrough}
            disabled={isSynthesizingAudio}
            data-testid="explain-flow-voice-btn"
            className={`h-7 px-3 rounded-full text-[11px] font-medium flex items-center gap-1.5 border transition-all backdrop-blur-xl ${
              isPlayingAudio
                ? "bg-gradient-to-r from-[#4285F4]/30 via-[#9B72CB]/30 to-[#D96570]/30 border-[#A8C7FA]/75 text-white shadow-[0_0_24px_rgba(66,133,244,0.35)]"
                : "bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.12] hover:border-[#A8C7FA]/50 text-white/85"
            }`}
          >
            {isSynthesizingAudio ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#A8C7FA] animate-ping" />
                <span>Synthesizing Dual-Voice...</span>
              </>
            ) : isPlayingAudio ? (
              <>
                <Pause className="w-3 h-3 text-[#A8C7FA]" />
                <span>Pause Walkthrough</span>
                {/* Live 4-bar voice waveform visualizer */}
                <span className="flex items-end gap-0.5 h-3 ml-0.5">
                  {[0.55, 1.0, 0.75, 0.9].map((mult, i) => (
                    <span
                      key={i}
                      style={{
                        height: `${Math.max(25, Math.min(100, (0.25 + audioLevel * mult) * 100))}%`,
                      }}
                      className="w-0.5 bg-[#00F5D4] rounded-full transition-all duration-75"
                    />
                  ))}
                </span>
              </>
            ) : audioDataUrl ? (
              <>
                <Play className="w-3 h-3 text-[#00F5D4]" />
                <span>Replay Walkthrough</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3 text-[#A8C7FA]" />
                <span>Explain Flow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SVG Neural Synaptic Spine & Travelling Energy Comets (ViewBox 0 0 1000 600) */}
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full z-0"
      >
        <defs>
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

          <linearGradient id="gemini-trace-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFB800" />
            <stop offset="50%" stopColor="#00F5D4" />
            <stop offset="100%" stopColor="#19C37D" />
          </linearGradient>

          <filter id="gemini-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ================= LAYER 1 (500,72) -> LAYER 2 R1 (500,170) ================= */}
        {(swarmSize === 6500
          ? [
              "M 500 72 C 500 108, 500 132, 500 170",
              "M 440 72 C 440 110, 475 135, 485 170",
              "M 560 72 C 560 110, 525 135, 515 170",
              "M 390 72 C 395 112, 455 138, 470 170",
              "M 610 72 C 605 112, 545 138, 530 170",
              "M 340 72 C 350 116, 435 142, 455 170",
              "M 660 72 C 650 116, 565 142, 545 170",
              "M 295 72 C 310 120, 415 145, 440 170",
              "M 705 72 C 690 120, 585 145, 560 170",
            ]
          : swarmSize === 1000
            ? [
                "M 500 72 C 500 108, 500 132, 500 170",
                "M 440 72 C 440 110, 475 135, 485 170",
                "M 560 72 C 560 110, 525 135, 515 170",
                "M 390 72 C 395 112, 455 138, 470 170",
                "M 610 72 C 605 112, 545 138, 530 170",
                "M 340 72 C 350 116, 435 142, 455 170",
                "M 660 72 C 650 116, 565 142, 545 170",
              ]
            : swarmSize === 100
              ? [
                  "M 500 72 C 500 108, 500 132, 500 170",
                  "M 440 72 C 440 110, 475 135, 485 170",
                  "M 560 72 C 560 110, 525 135, 515 170",
                  "M 390 72 C 395 112, 455 138, 470 170",
                  "M 610 72 C 605 112, 545 138, 530 170",
                ]
              : [
                  "M 500 72 C 500 108, 500 132, 500 170",
                  "M 440 72 C 440 110, 475 135, 485 170",
                  "M 560 72 C 560 110, 525 135, 515 170",
                ]
        ).map((d, i) => {
          const isTraceWire = traceModeActive && i === 0;
          const dimForTrace = traceModeActive && i !== 0;
          const idleSpeed =
            swarmSize === 6500
              ? "680ms"
              : swarmSize === 1000
                ? "880ms"
                : swarmSize === 100
                  ? "1120ms"
                  : "1400ms";
          return (
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
                stroke={
                  isTraceWire
                    ? "url(#gemini-trace-gold)"
                    : "url(#gemini-beam-vertical)"
                }
                strokeWidth={isTraceWire ? 3.8 : i === 0 ? 3 : 1.75}
                filter="url(#gemini-glow)"
                initial={{ pathLength: 0, opacity: 0.25 }}
                animate={{
                  pathLength: isR1Active ? 1 : 0.35,
                  opacity: dimForTrace ? 0.15 : isR1Active ? 0.95 : 0.3,
                }}
                transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
              />
              {(isRunning || isR1Active) && !prefersReducedMotion && !dimForTrace && (
                <path
                  d={d}
                  fill="none"
                  stroke={isTraceWire ? "#FFB800" : "#A8C7FA"}
                  strokeWidth={isTraceWire ? 3.8 : i === 0 ? 3.2 : 2}
                  strokeLinecap="round"
                  strokeDasharray="10 26"
                  className="dag-edge-active"
                  style={{
                    animationDuration: isRunning || isTraceWire ? "420ms" : idleSpeed,
                  }}
                />
              )}
            </g>
          );
        })}

        {/* ================= LAYER 2 R1 (500,230) -> LAYER 3 SIGNALS (190, 500, 810 at Y=308) ================= */}
        {[
          {
            d: "M 460 230 C 390 262, 240 266, 190 308",
            grad: "url(#gemini-beam-vertical)",
            sig: "sig_creators" as const,
          },
          {
            d: "M 500 230 C 500 262, 500 274, 500 308",
            grad: "url(#gemini-beam-cyan)",
            sig: "sig_crews" as const,
          },
          {
            d: "M 540 230 C 610 262, 760 266, 810 308",
            grad: "url(#gemini-beam-vertical)",
            sig: "sig_reddit" as const,
          },
        ].map((edge, i) => {
          const isMuted = mutedSignals[edge.sig];
          const isTraceWire =
            traceModeActive && tracedPlayer?.signalNode === edge.sig;
          const dimForTrace =
            traceModeActive && tracedPlayer?.signalNode !== edge.sig;
          return (
            <g key={`l2-l3-${i}`}>
              <path
                d={edge.d}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray={isMuted ? "4 6" : undefined}
                strokeWidth="2"
              />
              <motion.path
                d={edge.d}
                fill="none"
                stroke={isTraceWire ? "url(#gemini-trace-gold)" : edge.grad}
                strokeWidth={isTraceWire ? 3.6 : 2.4}
                filter="url(#gemini-glow)"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{
                  pathLength: isMuted ? 0.15 : isR1Active ? 1 : 0.2,
                  opacity: isMuted
                    ? 0.08
                    : dimForTrace
                      ? 0.14
                      : isR1Active
                        ? 0.9
                        : 0.25,
                }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              />
              {(isRunning || isR2Active) &&
                !prefersReducedMotion &&
                !isMuted &&
                !dimForTrace && (
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={isTraceWire ? "#FFB800" : "#E9D5FF"}
                    strokeWidth={isTraceWire ? 3.6 : 2.6}
                    strokeLinecap="round"
                    strokeDasharray="8 28"
                    className="dag-edge-active"
                    style={{
                      animationDuration:
                        isRunning || isTraceWire ? "420ms" : "1600ms",
                    }}
                  />
                )}
            </g>
          );
        })}

        {/* ================= LAYER 3 SIGNALS (Y=358) -> LAYER 4 R2 (X=hasRound3 ? 360 : 500, Y=425) ================= */}
        {(() => {
          const r2X = hasRound3 ? 360 : 500;
          const l3ToL4 = [
            `M 190 358 C 210 392, ${r2X - 70} 395, ${r2X - 25} 425`,
            `M 500 358 C 500 390, ${r2X} 395, ${r2X} 425`,
            `M 810 358 C 790 392, ${r2X + 70} 395, ${r2X + 25} 425`,
          ];
          return l3ToL4.map((d, i) => {
            const sig = signalChannelOrder[i];
            const isMuted = mutedSignals[sig];
            const isTraceWire =
              traceModeActive && tracedPlayer?.signalNode === sig;
            const dimForTrace =
              traceModeActive && tracedPlayer?.signalNode !== sig;
            return (
              <g key={`l3-l4-${i}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray={isMuted ? "4 6" : undefined}
                  strokeWidth="2"
                />
                <motion.path
                  d={d}
                  fill="none"
                  stroke={
                    isTraceWire
                      ? "url(#gemini-trace-gold)"
                      : "url(#gemini-beam-cyan)"
                  }
                  strokeWidth={isTraceWire ? 3.6 : 2.4}
                  filter="url(#gemini-glow)"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{
                    pathLength: isMuted ? 0.1 : isR2Active ? 1 : 0.15,
                    opacity: isMuted
                      ? 0.08
                      : dimForTrace
                        ? 0.14
                        : isR2Active
                          ? 0.92
                          : 0.22,
                  }}
                  transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                />
                {(activeStage === "r2_firing" || isR2Active) &&
                  !prefersReducedMotion &&
                  !isMuted &&
                  !dimForTrace && (
                    <path
                      d={d}
                      fill="none"
                      stroke={isTraceWire ? "#00F5D4" : "#00F5D4"}
                      strokeWidth={isTraceWire ? 3.8 : 2.6}
                      strokeLinecap="round"
                      strokeDasharray="9 28"
                      className="dag-edge-active"
                      style={{
                        animationDuration:
                          isRunning || isTraceWire ? "360ms" : "1500ms",
                      }}
                    />
                  )}
              </g>
            );
          });
        })()}

        {/* ================= DYNAMIC R2 -> R3 WHAT-IF BRIDGE & RESCUE BEAM ================= */}
        {hasRound3 && (
          <g>
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

            <motion.path
              d="M 680 485 C 620 520, 290 505, 145 535"
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
                d="M 680 485 C 620 520, 290 505, 145 535"
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

        {/* ================= LAYER 4 R2 (Y=482) -> LAYER 5 VERDICTS (145, 385, 615, 855 at Y=535) ================= */}
        {(() => {
          const r2X = hasRound3 ? 360 : 500;
          const verdictTargets = [
            {
              id: "verdict_buy" as const,
              x: 145,
              grad: "url(#gemini-beam-buy)",
              pulse: "#19C37D",
              weight: Math.max(1.8, (buyPct / 100) * 5.2),
            },
            {
              id: "verdict_eval" as const,
              x: 385,
              grad: "url(#gemini-beam-eval)",
              pulse: "#FFB800",
              weight: Math.max(1.5, (evalPct / 100) * 4.5),
            },
            {
              id: "verdict_pass" as const,
              x: 615,
              grad: "url(#gemini-beam-pass)",
              pulse: "#94A3B8",
              weight: Math.max(1.3, (passPct / 100) * 4.0),
            },
            {
              id: "verdict_boycott" as const,
              x: 855,
              grad: "url(#gemini-beam-boycott)",
              pulse: "#FF4D5E",
              weight: Math.max(1.3, (boycottPct / 100) * 4.0),
            },
          ];

          return verdictTargets.map((vt, i) => {
            const d = `M ${r2X} 482 C ${r2X} 512, ${vt.x} 508, ${vt.x} 535`;
            const isTraceWire =
              traceModeActive && tracedPlayer?.verdictNode === vt.id;
            const dimForTrace =
              traceModeActive && tracedPlayer?.verdictNode !== vt.id;
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
                  stroke={isTraceWire ? "url(#gemini-trace-gold)" : vt.grad}
                  strokeWidth={isTraceWire ? 4.0 : vt.weight}
                  filter="url(#gemini-glow)"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{
                    pathLength: isR2Active ? 1 : 0.2,
                    opacity: dimForTrace ? 0.14 : isR2Active ? 0.9 : 0.25,
                  }}
                  transition={{
                    duration: 0.55,
                    delay: i * 0.04,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                />
                {isR2Active && !prefersReducedMotion && !dimForTrace && (
                  <path
                    d={d}
                    fill="none"
                    stroke={isTraceWire ? "#19C37D" : vt.pulse}
                    strokeWidth={
                      isTraceWire ? 4.0 : Math.max(2, vt.weight * 0.85)
                    }
                    strokeLinecap="round"
                    strokeDasharray="10 30"
                    className="dag-edge-active"
                    style={{
                      animationDuration:
                        i === 0 || isTraceWire
                          ? isRunning || isTraceWire
                            ? "340ms"
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
      <div className="relative z-10 flex-1 flex flex-col justify-between px-6 py-2 min-h-0">
        {/* LAYER 1: SEED COHORT & OFFER CAPSULE NODE */}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onMouseEnter={() => setHoveredNodeId("seed")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() =>
              setSelectedNodeId((prev) => (prev === "seed" ? null : "seed"))
            }
            whileTap={{ scale: 0.98 }}
            className={`group relative rounded-full px-5 py-1.5 transition-all text-left border backdrop-blur-xl flex items-center gap-3 ${
              isNodeSpotlighted("seed")
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
              {totalDenominator.toLocaleString()} Agents
            </span>
          </motion.button>
        </div>

        {/* LAYER 2: ROUND 1 · ISOLATED NEURAL EVALUATION NODE */}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onMouseEnter={() => setHoveredNodeId("r1")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              onSelectRound(1);
              setSelectedNodeId((prev) => (prev === "r1" ? null : "r1"));
            }}
            animate={{
              scale:
                activeStage === "r1_firing" || currentBeat?.stage === "r1"
                  ? 1.02 + audioLevel * 0.02
                  : 1,
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className={`group relative rounded-2xl px-5 py-2 transition-all text-left border backdrop-blur-xl w-full max-w-xl ${
              isNodeSpotlighted("r1") || activeRound === 1
                ? "bg-[#111528]/95 border-[#669DF6]/80 shadow-[0_0_36px_rgba(66,133,244,0.34)]"
                : "bg-[#0B0D16]/90 border-white/[0.12] hover:border-[#669DF6]/50 shadow-[0_0_20px_rgba(66,133,244,0.12)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStage === "r1_firing" || currentBeat?.stage === "r1"
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
                  {r1Breakdown.buy.toLocaleString()} BUY
                </span>
                <span className="px-1.5 py-0.5 rounded bg-vc-gold/15 text-vc-gold border border-vc-gold/30">
                  {r1Breakdown.eval.toLocaleString()} EVAL
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 border border-white/10">
                  {r1Breakdown.pass.toLocaleString()} PASS
                </span>
                <span className="px-1.5 py-0.5 rounded bg-loss-red/15 text-loss-red border border-loss-red/30">
                  {r1Breakdown.boycott.toLocaleString()} BOYC
                </span>
              </div>
            </div>

            {(isRunning || allInspectableReactions.length > 0) && (
              <div className="mt-1 pt-1 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[11px] truncate">
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="font-mono font-semibold text-[#A8C7FA] shrink-0">
                    {traceModeActive && tracedPlayer
                      ? `${tracedPlayer.tag} (${tracedPlayer.r1State})`
                      : currentR1Thought.tag}
                  </span>
                  <span className="text-white/65 truncate">
                    &ldquo;
                    {traceModeActive && tracedPlayer
                      ? tracedPlayer.r1Quote
                      : currentR1Thought.quote}
                    &rdquo;
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#A8C7FA] shrink-0 tabular-nums">
                  {totalDenominator.toLocaleString()} Twin Scale
                </span>
              </div>
            )}
          </motion.button>
        </div>

        {/* LAYER 3: 3 PARALLEL CONTAGION SIGNAL NODES WITH CLICK-TO-MUTE ABLATION TOGGLES */}
        <div className="grid grid-cols-3 gap-3 max-w-3xl w-full mx-auto">
          {/* Node 3A: Creator Co-Streams */}
          <motion.div
            onMouseEnter={() => setHoveredNodeId("sig_creators")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_creators" ? null : "sig_creators"
              )
            }
            className={`cursor-pointer rounded-2xl px-3.5 py-2 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              mutedSignals.sig_creators
                ? "bg-[#090A10]/70 border-white/[0.05] opacity-50"
                : isNodeSpotlighted("sig_creators")
                  ? "bg-[#1A1228]/95 border-[#9B72CB]/85 shadow-[0_0_28px_rgba(155,114,203,0.38)]"
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
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums ${
                  mutedSignals.sig_creators
                    ? "bg-white/[0.05] text-white/35 line-through"
                    : "bg-win-green/15 border border-win-green/30 text-win-green"
                }`}
              >
                +{signalAttribution.creators.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={(e) => toggleMuteSignal("sig_creators", e)}
                data-testid="mute-sig-creators"
                title={
                  mutedSignals.sig_creators
                    ? "Unmute Creator signal"
                    : "Mute Creator signal to test counterfactual drop"
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                  mutedSignals.sig_creators
                    ? "bg-loss-red/20 border-loss-red/40 text-loss-red"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white"
                }`}
              >
                {mutedSignals.sig_creators ? "OFF" : "ON"}
              </button>
            </div>
          </motion.div>

          {/* Node 3B: Crew Captain Social Gravity */}
          <motion.div
            onMouseEnter={() => setHoveredNodeId("sig_crews")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_crews" ? null : "sig_crews"
              )
            }
            className={`cursor-pointer rounded-2xl px-3.5 py-2 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              mutedSignals.sig_crews
                ? "bg-[#090A10]/70 border-white/[0.05] opacity-50"
                : isNodeSpotlighted("sig_crews")
                  ? "bg-[#0E1C26]/95 border-[#00F5D4]/85 shadow-[0_0_28px_rgba(0,245,212,0.35)]"
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
                  {effectiveMetrics.cascade.toFixed(1)}x Squad Cascade
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums ${
                  mutedSignals.sig_crews
                    ? "bg-white/[0.05] text-white/35 line-through"
                    : "bg-win-green/15 border border-win-green/30 text-win-green"
                }`}
              >
                +{signalAttribution.crews.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={(e) => toggleMuteSignal("sig_crews", e)}
                data-testid="mute-sig-crews"
                title={
                  mutedSignals.sig_crews
                    ? "Unmute Crew Captain signal"
                    : "Mute Crew Captains to test counterfactual drop"
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                  mutedSignals.sig_crews
                    ? "bg-loss-red/20 border-loss-red/40 text-loss-red"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white"
                }`}
              >
                {mutedSignals.sig_crews ? "OFF" : "ON"}
              </button>
            </div>
          </motion.div>

          {/* Node 3C: r/NBA2K Community Pulse */}
          <motion.div
            onMouseEnter={() => setHoveredNodeId("sig_reddit")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() =>
              setSelectedNodeId((prev) =>
                prev === "sig_reddit" ? null : "sig_reddit"
              )
            }
            className={`cursor-pointer rounded-2xl px-3.5 py-2 text-left border backdrop-blur-xl transition-all flex items-center justify-between gap-2 ${
              mutedSignals.sig_reddit
                ? "bg-[#090A10]/70 border-white/[0.05] opacity-50"
                : isNodeSpotlighted("sig_reddit")
                  ? "bg-[#24131C]/95 border-[#D96570]/85 shadow-[0_0_28px_rgba(217,101,112,0.38)]"
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
                  {redditThreads.length || 3} Threads
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums ${
                  mutedSignals.sig_reddit
                    ? "bg-white/[0.05] text-white/35 line-through"
                    : "bg-vc-gold/15 border border-vc-gold/30 text-vc-gold"
                }`}
              >
                +{signalAttribution.reddit.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={(e) => toggleMuteSignal("sig_reddit", e)}
                data-testid="mute-sig-reddit"
                title={
                  mutedSignals.sig_reddit
                    ? "Unmute Reddit signal"
                    : "Mute Reddit signal to test counterfactual drop"
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border transition-colors ${
                  mutedSignals.sig_reddit
                    ? "bg-loss-red/20 border-loss-red/40 text-loss-red"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white"
                }`}
              >
                {mutedSignals.sig_reddit ? "OFF" : "ON"}
              </button>
            </div>
          </motion.div>
        </div>

        {/* LAYER 4: ROUND 2 · SOCIAL CONTAGION SHIFT (+ DYNAMIC R3 WHAT-IF RESCUE BRANCH) */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* R2 Social Contagion Node */}
          <motion.button
            type="button"
            layout
            onMouseEnter={() => setHoveredNodeId("r2")}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              onSelectRound(2);
              setSelectedNodeId((prev) => (prev === "r2" ? null : "r2"));
            }}
            animate={{
              scale:
                activeStage === "r2_firing" || currentBeat?.stage === "r2"
                  ? 1.025 + audioLevel * 0.025
                  : 1,
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.38 }}
            className={`group relative rounded-2xl px-5 py-2 text-left border backdrop-blur-xl transition-all ${
              hasRound3 ? "w-full sm:w-[420px]" : "w-full max-w-xl"
            } ${
              isNodeSpotlighted("r2") || (activeRound === 2 && !hasRound3)
                ? "bg-[#151226]/95 border-[#9B72CB]/85 shadow-[0_0_40px_rgba(155,114,203,0.35)]"
                : "bg-[#0C0E18]/90 border-white/[0.14] hover:border-[#9B72CB]/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStage === "r2_firing" || currentBeat?.stage === "r2"
                      ? "bg-[#00F5D4] animate-ping"
                      : "bg-[#9B72CB]"
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  R2 · Social Contagion Cascade
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-win-green/20 border border-win-green/40 text-win-green font-mono text-[10px] font-semibold tabular-nums">
                  +{effectiveMetrics.flips.toLocaleString()} Flips
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#9B72CB]/20 border border-[#9B72CB]/40 text-[#E9D5FF] font-mono text-[10px] font-semibold tabular-nums">
                  +{effectiveMetrics.lift.toFixed(1)}% Lift
                </span>
              </div>
            </div>

            {(isRunning || allInspectableReactions.length > 0) && (
              <div className="mt-1 pt-1 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] truncate">
                <span className="font-mono font-semibold text-[#00F5D4] shrink-0">
                  {traceModeActive && tracedPlayer
                    ? tracedPlayer.tag
                    : currentR2Thought.tag}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-win-green/15 text-win-green text-[9px] font-mono shrink-0">
                  {traceModeActive && tracedPlayer
                    ? `via ${tracedPlayer.signalLabel}`
                    : currentR2Thought.driver}
                </span>
                <span className="text-white/70 truncate">
                  &ldquo;
                  {traceModeActive && tracedPlayer
                    ? tracedPlayer.r2Quote
                    : currentR2Thought.quote}
                  &rdquo;
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
                onMouseEnter={() => setHoveredNodeId("r3")}
                onMouseLeave={() => setHoveredNodeId(null)}
                initial={{ opacity: 0, scale: 0.88, x: -16 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.88, x: -16 }}
                transition={{ type: "spring", bounce: 0.22, duration: 0.42 }}
                onClick={() => {
                  onSelectRound(3);
                  setSelectedNodeId((prev) => (prev === "r3" ? null : "r3"));
                }}
                className={`rounded-2xl px-4 py-2 text-left border backdrop-blur-xl transition-all w-full sm:w-[270px] ${
                  isNodeSpotlighted("r3") || activeRound === 3
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
                    +{round3FlipsCount.toLocaleString()} Rescued
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
              count: effectiveMetrics.buy,
              pct: buyPct,
              icon: CheckCircle2,
              color: "text-win-green",
              bar: "bg-win-green",
              borderActive:
                "border-win-green/85 bg-[#0A2018]/95 shadow-[0_0_28px_rgba(25,195,125,0.35)]",
              borderIdle: "border-win-green/30 hover:border-win-green/65 bg-[#091412]/90",
            },
            {
              id: "verdict_eval" as const,
              label: "EVALUATING",
              count: effectiveMetrics.eval,
              pct: evalPct,
              icon: Clock,
              color: "text-vc-gold",
              bar: "bg-vc-gold",
              borderActive:
                "border-vc-gold/85 bg-[#211A0A]/95 shadow-[0_0_28px_rgba(255,184,0,0.3)]",
              borderIdle: "border-vc-gold/30 hover:border-vc-gold/65 bg-[#141109]/90",
            },
            {
              id: "verdict_pass" as const,
              label: "ABANDONED",
              count: effectiveMetrics.pass,
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
              count: effectiveMetrics.boycott,
              pct: boycottPct,
              icon: AlertOctagon,
              color: "text-loss-red",
              bar: "bg-loss-red",
              borderActive:
                "border-loss-red/85 bg-[#240D12]/95 shadow-[0_0_28px_rgba(255,77,94,0.3)]",
              borderIdle: "border-loss-red/30 hover:border-loss-red/65 bg-[#160B0E]/90",
            },
          ].map((v) => {
            const Icon = v.icon;
            const isSpotlight = isNodeSpotlighted(v.id);
            return (
              <motion.button
                key={v.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setHoveredNodeId(v.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() =>
                  setSelectedNodeId((prev) => (prev === v.id ? null : v.id))
                }
                className={`rounded-2xl px-3.5 py-2 text-left border backdrop-blur-xl transition-all ${
                  isSpotlight ? v.borderActive : v.borderIdle
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
                    {v.count.toLocaleString()}
                    <span className="text-[10px] font-normal text-white/40">
                      /{totalDenominator.toLocaleString()}
                    </span>
                  </span>
                </div>

                <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.08] overflow-hidden">
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

      {/* ================= BOTTOM MAGNETIC X-RAY HOVER & VOICE CAPTION BAR ================= */}
      <div className="relative z-20 px-4 pb-2.5 pt-1 flex justify-center">
        <div
          data-testid="neural-xray-bar"
          className="w-full max-w-3xl min-h-[34px] rounded-full border border-white/[0.1] bg-[#090B13]/90 backdrop-blur-xl px-4 py-1.5 flex items-center justify-between gap-3 text-[11px]"
        >
          {audioError ? (
            <div className="flex items-center gap-2 text-loss-red truncate">
              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{audioError}</span>
            </div>
          ) : currentBeat && (isPlayingAudio || activeBeatIndex !== null) ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                  currentBeat.speaker === "Player"
                    ? "bg-[#00F5D4]/20 border border-[#00F5D4]/50 text-[#00F5D4]"
                    : "bg-[#4285F4]/20 border border-[#4285F4]/50 text-[#A8C7FA]"
                }`}
              >
                {currentBeat.speakerLabel}
              </span>
              <span className="text-white/90 truncate font-medium">
                &ldquo;{currentBeat.caption}&rdquo;
              </span>
            </div>
          ) : hoverExplanation ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 ${hoverExplanation.color}`}
              >
                {hoverExplanation.badge}
              </span>
              <span className="h-3 w-px bg-white/15 shrink-0" />
              <span className="text-white/80 truncate">
                {hoverExplanation.text}
              </span>
            </div>
          ) : traceModeActive && tracedPlayer ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 font-mono text-[10px]">
              <span className="text-[#00F5D4] font-semibold shrink-0">
                {tracedPlayer.tag} ({tracedPlayer.ovr} OVR)
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/75 shrink-0">
                R1 Alone: {tracedPlayer.r1State}
              </span>
              <ArrowRight className="w-3 h-3 text-white/35 shrink-0" />
              <span className="px-1.5 py-0.5 rounded bg-[#9B72CB]/20 text-[#E9D5FF] shrink-0">
                Signal: {tracedPlayer.signalLabel}
              </span>
              <ArrowRight className="w-3 h-3 text-white/35 shrink-0" />
              <span className="px-1.5 py-0.5 rounded bg-win-green/20 text-win-green font-semibold shrink-0">
                R2: {tracedPlayer.r2State}
              </span>
              <span className="text-white/65 font-sans truncate ml-1">
                &ldquo;{tracedPlayer.r2Quote}&rdquo;
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-white/50 text-[11px]">
              <span className="flex items-center gap-1.5 truncate">
                <Eye className="w-3 h-3 text-[#A8C7FA] shrink-0" />
                <span className="truncate">
                  Hover any node for plain-English X-Ray · Click{" "}
                  <strong className="text-white/75 font-medium">ON/OFF</strong> on
                  signals to test causal drop · Click{" "}
                  <strong className="text-white/75 font-medium">
                    Explain Flow
                  </strong>{" "}
                  for dual-voice walkthrough
                </span>
              </span>
            </div>
          )}
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
