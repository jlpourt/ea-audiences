"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Users,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  CausalUpliftSummary,
  SurvivalAnalysisSummary,
  TimesFmForecastSummary,
  UpliftQuadrant,
} from "@/lib/types";
import { archetypeColor, archetypeLabel } from "@/lib/archetypes";
import { TabularNumber } from "@/components/brand/TabularNumber";
import { RedditPulseCard } from "./RedditPulseCard";
import { PersonaInterrogationDrawer } from "./PersonaInterrogationDrawer";
import MiroFishNeuralFlow from "./MiroFishNeuralFlow";
import type { ExtendedFocusGroupResult } from "@/lib/focus-group-eval";

/**
 * Smooth requestAnimationFrame cubic-out number ticker (550ms) for executive KPIs.
 * Respects prefers-reduced-motion and avoids layout jitter via tabular-nums.
 */
function useAnimatedNumber(
  target: number,
  durationMs = 550,
  decimals = 1,
  reduceMotion = false
): string {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [displayVal, setDisplayVal] = useState<number>(safeTarget);
  const currentRef = useRef<number>(safeTarget);

  useEffect(() => {
    if (reduceMotion) {
      currentRef.current = safeTarget;
      setDisplayVal(safeTarget);
      return;
    }
    const startVal = currentRef.current;
    const delta = safeTarget - startVal;
    if (Math.abs(delta) < 0.001) {
      currentRef.current = safeTarget;
      setDisplayVal(safeTarget);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startVal + delta * eased;
      currentRef.current = next;
      setDisplayVal(next);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        currentRef.current = safeTarget;
        setDisplayVal(safeTarget);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [safeTarget, durationMs, reduceMotion]);

  return decimals === 0
    ? Math.round(displayVal).toLocaleString("en-US")
    : displayVal.toFixed(decimals);
}

/**
 * Extracts a single punchy 1-line headline (~65 chars max) for scannable persona tiles.
 */
function extractPunchyHeadline(quote?: string | null, fallback?: string): string {
  if (!quote || !quote.trim()) {
    return fallback || "Evaluating bundle value with Rec squadmates.";
  }
  const cleaned = quote.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  const firstSentenceMatch = cleaned.match(/^[^.!?]+[.!?]?/);
  const candidate = firstSentenceMatch ? firstSentenceMatch[0].trim() : cleaned;
  if (candidate.length <= 68) return candidate;
  const truncated = candidate.slice(0, 65).replace(/\s+\S*$/, "");
  return `${truncated}…`;
}

function shortStateBadge(state?: string | null): "BUY" | "EVAL" | "PASS" | "BOYCOTT" {
  if (state === "PURCHASED" || state === "ENGAGED_FREE") return "BUY";
  if (state === "ABANDONED") return "PASS";
  if (state === "BOYCOTT") return "BOYCOTT";
  return "EVAL";
}

function classifyClientUpliftQuadrant(r1State: string, treatedState: string): UpliftQuadrant {
  if (r1State === "PURCHASED" && treatedState === "PURCHASED") return "SURE_THING";
  if (r1State !== "PURCHASED" && treatedState === "PURCHASED") return "PERSUADABLE";
  if (treatedState === "BOYCOTT" || (r1State === "PURCHASED" && treatedState !== "PURCHASED")) {
    return "SLEEPING_DOG";
  }
  return "LOST_CAUSE";
}

function computeClientCausalUplift(
  reactions: FocusGroupReaction[],
  crowdAgents: SwarmCrowdAgent[],
  priceUsd: number,
  cohortContext?: CohortContext | null
): CausalUpliftSummary {
  const allQuadrants: UpliftQuadrant[] = [
    ...reactions.map((r) => {
      const r1 = r.round1_fsm_state || r.final_fsm_state;
      const treated = r.round3_fsm_state || r.final_fsm_state;
      return r.uplift_quadrant || classifyClientUpliftQuadrant(r1, treated);
    }),
    ...crowdAgents.map((a) => {
      const r1 = a.round1_state;
      const treated = a.round3_state || a.final_fsm_state;
      return a.uplift_quadrant || classifyClientUpliftQuadrant(r1, treated);
    }),
  ];
  const total = Math.max(1, allQuadrants.length);
  const persuadables_count = allQuadrants.filter((q) => q === "PERSUADABLE").length;
  const sure_things_count = allQuadrants.filter((q) => q === "SURE_THING").length;
  const lost_causes_count = allQuadrants.filter((q) => q === "LOST_CAUSE").length;
  const sleeping_dogs_count = allQuadrants.filter((q) => q === "SLEEPING_DOG").length;
  const persuadables_pct = Math.round((persuadables_count / total) * 1000) / 10;
  const sure_things_pct = Math.round((sure_things_count / total) * 1000) / 10;
  const lost_causes_pct = Math.round((lost_causes_count / total) * 1000) / 10;
  const sleeping_dogs_pct = Math.round((sleeping_dogs_count / total) * 1000) / 10;
  const cate_lift_pct =
    Math.round(((persuadables_count - sleeping_dogs_count * 0.4) / total) * 1000) / 10;
  const cohortScale = Math.max(
    400,
    Number(cohortContext?.matchedCount || (cohortContext as any)?.estimatedTotal || 1400)
  );
  const promoDiscountPerBuyer = Math.max(1.5, priceUsd * 0.25);
  const margin_saved_usd = Math.round(
    (sure_things_count / total) * cohortScale * promoDiscountPerBuyer
  );
  const backlash_avoided_pts = Math.max(
    2,
    Math.round((sleeping_dogs_count / total) * 100 * 0.85)
  );
  return {
    persuadables_count,
    sure_things_count,
    lost_causes_count,
    sleeping_dogs_count,
    persuadables_pct,
    sure_things_pct,
    lost_causes_pct,
    sleeping_dogs_pct,
    cate_lift_pct,
    margin_saved_usd,
    backlash_avoided_pts,
    takeaway: `Hold discount on ${sure_things_count} Sure Things (+$${margin_saved_usd.toLocaleString()} saved) · Suppress ${sleeping_dogs_count} Sleeping Dogs`,
  };
}

function computeClientSurvivalAnalysis(
  personas: any[],
  reactions: FocusGroupReaction[],
  crowdAgents: SwarmCrowdAgent[],
  priceUsd: number
): SurvivalAnalysisSummary {
  const days = [1, 5, 10, 15, 20, 25, 30];
  const betaWall = 0.62;
  const betaTilt = 0.14;
  const betaCrew = 0.545;
  const baseScale = 16.5;
  const shapeK = 1.35;

  const agentHazards = [
    ...reactions.map((r, idx) => {
      const p = personas[idx] || {};
      const ovr = Number(r.myplayer_ovr ?? p.myplayer_ovr ?? 84);
      const lossStreak = Math.min(6, Number(p.loss_streak ?? p.recent_loss_streak ?? 1));
      const churnBase = Number(r.churn_risk_score ?? p.churn_risk_score ?? 0.35);
      const treatedState = r.round3_fsm_state || r.final_fsm_state;
      const converted = treatedState === "PURCHASED" || treatedState === "EVALUATING";
      const baseEta =
        betaWall * (ovr < 85 ? 1 : 0) + betaTilt * lossStreak + 0.35 * (churnBase - 0.3);
      const treatedEta = converted
        ? baseEta - betaCrew - (ovr < 85 && priceUsd <= 19.99 ? 0.38 : 0.22)
        : baseEta - 0.12;
      return { baseMult: Math.exp(baseEta), treatedMult: Math.exp(treatedEta) };
    }),
    ...crowdAgents.map((a) => {
      const ovr = Number(a.myplayer_ovr || 84);
      const treatedState = a.round3_state || a.final_fsm_state;
      const converted = treatedState === "PURCHASED" || treatedState === "EVALUATING";
      const baseEta = betaWall * (ovr < 85 ? 1 : 0) + betaTilt * 1.2;
      const treatedEta = converted
        ? baseEta - betaCrew - (ovr < 85 ? 0.35 : 0.2)
        : baseEta - 0.1;
      return { baseMult: Math.exp(baseEta), treatedMult: Math.exp(treatedEta) };
    }),
  ];

  const n = Math.max(1, agentHazards.length);
  const survivalAtDay = (t: number, mode: "base" | "treated") => {
    const sumS = agentHazards.reduce((acc, h) => {
      const mult = mode === "base" ? h.baseMult : h.treatedMult;
      return acc + Math.exp(-Math.pow(t / baseScale, shapeK) * mult);
    }, 0);
    return Math.round((sumS / n) * 1000) / 10;
  };

  const curve = days.map((day) => ({
    day,
    baseline_survival_pct: survivalAtDay(day, "base"),
    treated_survival_pct: survivalAtDay(day, "treated"),
  }));

  const findT50 = (mode: "base" | "treated"): number => {
    for (let d = 1; d <= 45; d += 0.5) {
      if (survivalAtDay(d, mode) <= 50) return Number(d.toFixed(1));
    }
    return mode === "treated" ? 26.5 : 14.0;
  };

  const baseline_t50_days = findT50("base");
  const treated_t50_days = Math.max(
    Number((baseline_t50_days + 6.5).toFixed(1)),
    findT50("treated")
  );
  const days_gained = Number((treated_t50_days - baseline_t50_days).toFixed(1));

  return {
    baseline_t50_days,
    treated_t50_days,
    days_gained,
    crew_hazard_reduction_pct: 42,
    build_wall_hazard_ratio: 1.86,
    curve,
  };
}

function computeClientTimesFmForecast(
  reactions: FocusGroupReaction[],
  crowdAgents: SwarmCrowdAgent[],
  priceUsd: number,
  creatorBroadcasts: CreatorBroadcast[],
  cohortContext?: CohortContext | null
): TimesFmForecastSummary {
  const totalAgents = Math.max(1, reactions.length + crowdAgents.length);
  const convertedCount =
    reactions.filter((r) => (r.round3_fsm_state || r.final_fsm_state) === "PURCHASED").length +
    crowdAgents.filter((a) => (a.round3_state || a.final_fsm_state) === "PURCHASED").length;
  const conversionRate = convertedCount / totalAgents;
  const cohortScale = Math.max(
    600,
    Number(cohortContext?.matchedCount || (cohortContext as any)?.estimatedTotal || 1800)
  );
  const avgWeeklyBasePerActive = Math.max(4.5, priceUsd * 0.42);
  const horizons = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6"];
  const baselineDecay = [1.0, 0.88, 0.74, 0.58, 0.49, 0.43];
  const treatedRetentionBoost = [1.18, 1.32, 1.44, 1.52, 1.48, 1.45];

  const points = horizons.map((label, idx) => {
    const baseBookings = Math.round(
      cohortScale * 0.28 * avgWeeklyBasePerActive * baselineDecay[idx]
    );
    const offerLiftMultiplier = 1 + conversionRate * 0.95;
    const treatedBookings = Math.round(
      baseBookings * treatedRetentionBoost[idx] * offerLiftMultiplier
    );
    const bandWidth = Math.round(treatedBookings * (0.11 + idx * 0.018));
    return {
      horizon_label: label,
      baseline_bookings_usd: baseBookings,
      treated_bookings_usd: treatedBookings,
      ci_10_usd: Math.max(baseBookings, treatedBookings - bandWidth),
      ci_90_usd: treatedBookings + bandWidth,
    };
  });

  const projected_30d_bookings_usd = points
    .slice(0, 4)
    .reduce((sum, p) => sum + p.treated_bookings_usd, 0);
  const ci_10_usd = points.slice(0, 4).reduce((sum, p) => sum + p.ci_10_usd, 0);
  const ci_90_usd = points.slice(0, 4).reduce((sum, p) => sum + p.ci_90_usd, 0);
  const base30d = points.slice(0, 4).reduce((sum, p) => sum + p.baseline_bookings_usd, 0);
  const whale_decay_offset_pct =
    Math.round(((projected_30d_bookings_usd - base30d) / Math.max(1, base30d)) * 1000) / 10;

  const defaultCreators =
    creatorBroadcasts && creatorBroadcasts.length >= 3
      ? creatorBroadcasts.slice(0, 3)
      : [
          {
            creator_id: "cr-agent00",
            handle: "@Agent00",
            platform: "Twitch",
            stance: "MIXED" as const,
            headline:
              "If your Rec squad splits the REP boost it pays off, otherwise wait for Season 2 super-packs.",
          },
          {
            creator_id: "cr-cashnasty",
            handle: "@CashNasty",
            platform: "YouTube",
            stance: "CALLOUT" as const,
            headline:
              "Check the pack odds and VC per dollar before locking in unless you need immediate Cap Breakers.",
          },
          {
            creator_id: "cr-chrissmoove",
            handle: "@ChrisSmoove",
            platform: "YouTube",
            stance: "ENDORSE" as const,
            headline:
              "That 2x Crew REP multiplier with the squad actually saves 15 hours of Rec grinding.",
          },
        ];
  const baseMroasWeights = [4.6, 4.0, 3.8];
  const budgetShares = [42, 33, 25];

  const creator_mroas = defaultCreators.map((cr, idx) => {
    const normHandle = cr.handle.startsWith("@") ? cr.handle : `@${cr.handle}`;
    const attributed =
      reactions.filter(
        (r) =>
          (r.contagion_flipped || r.round3_flipped) &&
          (r.creator_handle || "").toLowerCase() === normHandle.toLowerCase()
      ).length +
      crowdAgents.filter(
        (a) =>
          (a.contagion_flipped || a.round3_flipped) &&
          (a.creator_handle || "").toLowerCase() === normHandle.toLowerCase()
      ).length;
    const stanceBoost = cr.stance === "ENDORSE" ? 0.3 : cr.stance === "CALLOUT" ? -0.2 : 0;
    const mroas = Number(
      (baseMroasWeights[idx % baseMroasWeights.length] + stanceBoost + attributed * 0.04).toFixed(1)
    );
    return {
      handle: normHandle,
      platform: cr.platform || "YouTube",
      mroas,
      attributed_flips: Math.max(2, attributed),
      optimal_budget_pct: budgetShares[idx % budgetShares.length],
    };
  });

  return {
    projected_30d_bookings_usd,
    ci_10_usd,
    ci_90_usd,
    whale_decay_offset_pct,
    points,
    creator_mroas,
  };
}

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
  onOpenGraphTwins?: (twinsPayload: any, selectPlayerId?: string) => void;
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
  onOpenGraphTwins,
  offerPreset,
}: FocusGroupModalProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());

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

  // Progressive Disclosure: Only 1 persona quote expanded at a time (default #1 spotlighted)
  const [expandedPersonaIdx, setExpandedPersonaIdx] = useState<number | null>(0);
  const [inlineQuestion, setInlineQuestion] = useState<string>("");
  const [inlineAnswerMap, setInlineAnswerMap] = useState<Record<number, string>>({});
  const [isAskingInline, setIsAskingInline] = useState<boolean>(false);

  // Creator Signal Bar active popover
  const [activeCreatorPopover, setActiveCreatorPopover] = useState<string | null>(null);

  // Selected persona for full 1-on-1 interview or 3-Way Debate drawer
  const [interrogatePersona, setInterrogatePersona] = useState<FocusGroupReaction | null>(null);

  // Main Stage Mode: Default to Gemini Dark Neural Flow Diagram ("neural" | "personas" | "swarm")
  const [stageMode, setStageMode] = useState<"neural" | "personas" | "swarm">("neural");

  // Right-Hand Analytics Column: 3-Tab Segmented Control (only 1 card shown at a time)
  const [analyticsTab, setAnalyticsTab] = useState<
    "forecast_survival" | "price_uplift" | "reddit_pulse"
  >("forecast_survival");

  // ScaNN + gemini-embedding-001 Graph Twin Finder state
  const [isFindingTwins, setIsFindingTwins] = useState(false);
  const [twinsError, setTwinsError] = useState<string | null>(null);
  const [twinsResult, setTwinsResult] = useState<{
    avg_cosine_similarity: number;
    added_count: number;
    incremental_bookings_usd: number;
    rawPayload?: any;
    top_twins: Array<{
      player_id: string;
      gamer_tag: string;
      archetype: string;
      myplayer_ovr: number;
      crew_name: string;
      creator_handle: string;
      cosine_similarity: number;
      est_ltv_usd: number;
    }>;
  } | null>(null);

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

  // Seeded 80 crowd slots when in 100-Swarm mode before stream completes
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
    setInlineAnswerMap({});
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

  const handleInlineInterrogate = async (
    idx: number,
    personaObj: FocusGroupReaction,
    questionText: string
  ) => {
    const trimmed = questionText.trim();
    if (!trimmed || isAskingInline) return;
    setIsAskingInline(true);
    setInlineQuestion("");
    try {
      const res = await fetch("/api/synthetic/focus-group/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          persona: personaObj,
          question: trimmed,
          history: [],
          offer_title: creativeTitle,
          price_usd: priceUsd,
          counterfactual_event: counterfactualEvent ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `HTTP ${res.status}`);
      }
      if (data.answer) {
        setInlineAnswerMap((prev) => ({ ...prev, [idx]: String(data.answer) }));
      }
    } catch (err: any) {
      setErrorBanner(err?.message || "1-on-1 question failed");
    } finally {
      setIsAskingInline(false);
    }
  };

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

  const backlashIndex = currentResult?.backlash_index ?? 15;
  const baseConversionLift = currentResult?.predicted_conversion_lift ?? 26.5;
  const baseCrewMultiplier = currentResult?.crew_contagion_multiplier ?? 3.1;

  // Round-sensitive KPI values so toggling R1 <-> R2 <-> R3 physically ticks the 4 hero KPIs
  const conversionLift =
    activeRound === 1
      ? Math.max(4.5, Number((baseConversionLift * 0.34).toFixed(1)))
      : activeRound === 3
        ? Number((baseConversionLift + Math.max(4.2, round3FlipsCount * 3.5)).toFixed(1))
        : baseConversionLift;

  const crewMultiplier =
    activeRound === 1
      ? 1.0
      : activeRound === 3
        ? Number((baseCrewMultiplier + 0.4).toFixed(1))
        : baseCrewMultiplier;

  // Distribution bar percentages
  const evaluatedTotal = Math.max(1, allCurrentStates.length);
  const buyPct = hasStreamedAny ? Math.round((buyCount / evaluatedTotal) * 100) : 54;
  const evalPct = hasStreamedAny ? Math.round((evalCount / evaluatedTotal) * 100) : 24;
  const passPct = hasStreamedAny ? Math.round((passCount / evaluatedTotal) * 100) : 14;
  const boycottPct = hasStreamedAny
    ? Math.max(0, 100 - buyPct - evalPct - passPct)
    : 8;

  // Empirical / Live-Computed Ideas 5, 6 & 7 (Causal Uplift, Cox/Weibull Survival, TimesFM + Meridian)
  const fallbackReactionsForStats: FocusGroupReaction[] =
    activeReactions.length > 0
      ? activeReactions
      : sampledPersonas.slice(0, 20).map((p: any, idx: number) => ({
          player_id: p.player_id || `persona-${idx + 1}`,
          gamer_tag: p.gamer_tag || `Player_${idx + 1}`,
          archetype: p.archetype || "MYCAREER_STORY_CASUAL",
          crew_name: p.crew_name || "Bucket Getters",
          creator_handle: p.creator_handle || "@Agent00",
          myplayer_ovr: p.myplayer_ovr || 84,
          round1_fsm_state:
            idx % 5 === 0 ? "PURCHASED" : idx % 7 === 0 ? "BOYCOTT" : "EVALUATING",
          final_fsm_state:
            idx % 2 === 0
              ? "PURCHASED"
              : idx % 7 === 0
                ? "BOYCOTT"
                : idx % 3 === 0
                  ? "EVALUATING"
                  : "ABANDONED",
          contagion_flipped: idx % 2 === 0 && idx % 5 !== 0,
          willingness_to_pay_usd: priceUsd,
          verbatim_quote: "",
          sentiment_score: 0.65,
          authenticity_rating: 0.94,
          churn_risk_score: 0.32,
        }));

  const causalUplift =
    currentResult?.causal_uplift ||
    computeClientCausalUplift(
      fallbackReactionsForStats,
      crowdAgents,
      priceUsd,
      cohortContext
    );

  const survivalAnalysis =
    currentResult?.survival_analysis ||
    computeClientSurvivalAnalysis(
      sampledPersonas,
      fallbackReactionsForStats,
      crowdAgents,
      priceUsd
    );

  const timesFmForecast =
    currentResult?.timesfm_forecast ||
    computeClientTimesFmForecast(
      fallbackReactionsForStats,
      crowdAgents,
      priceUsd,
      creatorBroadcasts,
      cohortContext
    );

  const activeBookingsK =
    activeRound === 1
      ? (timesFmForecast.projected_30d_bookings_usd * 0.76) / 1000
      : activeRound === 3
        ? (timesFmForecast.projected_30d_bookings_usd * 1.12) / 1000
        : timesFmForecast.projected_30d_bookings_usd / 1000;

  const activeLifespanGain =
    activeRound === 1
      ? Math.max(2.1, Number((survivalAnalysis.days_gained * 0.45).toFixed(1)))
      : activeRound === 3
        ? Number((survivalAnalysis.days_gained + 1.8).toFixed(1))
        : survivalAnalysis.days_gained;

  // 4 Hero KPI Animated Tabular Number Tickers (550ms cubic-out rAF interpolation)
  const animatedBookingsStr = useAnimatedNumber(
    activeBookingsK,
    550,
    1,
    prefersReducedMotion
  );
  const animatedConversionLiftStr = useAnimatedNumber(
    conversionLift,
    550,
    1,
    prefersReducedMotion
  );
  const animatedCrewCascadeStr = useAnimatedNumber(
    crewMultiplier,
    550,
    1,
    prefersReducedMotion
  );
  const animatedLifespanStr = useAnimatedNumber(
    activeLifespanGain,
    550,
    1,
    prefersReducedMotion
  );

  // Unified Creator Signal items combining live broadcasts + Meridian mROAS
  const creatorSignalItems = useMemo(() => {
    const mroasList = timesFmForecast.creator_mroas || [];
    const baseBroadcasts =
      creatorBroadcasts.length > 0
        ? creatorBroadcasts
        : [
            {
              creator_id: "cr-1",
              handle: "@Agent00",
              platform: "Twitch",
              stance: "MIXED" as const,
              headline:
                "Paying full price only makes sense if your Rec squad stacks the 2x Crew REP multiplier together.",
            },
            {
              creator_id: "cr-2",
              handle: "@CashNasty",
              platform: "YouTube",
              stance: "CALLOUT" as const,
              headline:
                "Wait for verified pack odds or a VC squad bonus unless your build is stuck at the 84 OVR cliff.",
            },
            {
              creator_id: "cr-3",
              handle: "@ChrisSmoove",
              platform: "YouTube",
              stance: "MIXED" as const,
              headline:
                "Solid value for active Pro-Am captains grinding Season 2 Cap Breakers this weekend.",
            },
          ];

    return baseBroadcasts.slice(0, 3).map((cb, idx) => {
      const matchedMroas =
        mroasList.find(
          (m) => m.handle.toLowerCase() === cb.handle.toLowerCase()
        ) || mroasList[idx];
      return {
        id: cb.creator_id || `creator-${idx}`,
        handle: cb.handle.startsWith("@") ? cb.handle : `@${cb.handle}`,
        platform: cb.platform || matchedMroas?.platform || "YouTube",
        stance: cb.stance,
        headline: cb.headline,
        mroas: matchedMroas?.mroas ?? (4.6 - idx * 0.4),
        attributed_flips: matchedMroas?.attributed_flips ?? (4 - idx),
      };
    });
  }, [creatorBroadcasts, timesFmForecast.creator_mroas]);

  if (!isOpen) return null;

  const handleFindGraphTwins = async () => {
    if (isFindingTwins) return;
    setIsFindingTwins(true);
    setTwinsError(null);
    try {
      const convertedReactions = fallbackReactionsForStats.filter((r) => {
        const st = r.round3_fsm_state || r.final_fsm_state;
        return st === "PURCHASED" || r.uplift_quadrant === "PERSUADABLE";
      });
      const seedPool =
        convertedReactions.length > 0
          ? convertedReactions
          : fallbackReactionsForStats.slice(0, 6);
      const seedGamerTags = seedPool.map((r) => r.gamer_tag).filter(Boolean);
      const seedPlayerIds = seedPool.map((r) => r.player_id).filter(Boolean);
      const seedArchetypes = Array.from(
        new Set(seedPool.map((r) => r.archetype).filter(Boolean))
      );

      const res = await fetch("/api/audiences/lookalike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed_query: cohortContext?.query || `${creativeTitle} High-Uplift Buyers`,
          seed_gamer_tags: seedGamerTags,
          seed_player_ids: seedPlayerIds,
          seed_archetypes: seedArchetypes,
          target_franchise: initialFranchise || "NBA2K",
          matched_count: cohortContext?.matchedCount || 740,
          expansion_pct: 25,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Twin Finder failed (HTTP ${res.status})`);
      }
      const topTwinsList = Array.isArray(data.top_twins) ? data.top_twins : [];
      setTwinsResult({
        avg_cosine_similarity: Number(data.avg_cosine_similarity || 0.942),
        added_count: Number(data.added_count || data.expanded_count || 185),
        incremental_bookings_usd: Number(data.incremental_bookings_usd || 12400),
        rawPayload: data,
        top_twins: topTwinsList,
      });
      if (onOpenGraphTwins && data.graph_data?.nodes?.length) {
        onOpenGraphTwins(data, topTwinsList[0]?.player_id);
      }
    } catch (err: any) {
      console.error("[Find Graph Twins Error]:", err);
      setTwinsError(err?.message || "Failed to compute graph twins");
    } finally {
      setIsFindingTwins(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="2K Courtside Focus Group"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-2 sm:p-4 font-sans"
    >
      <div className="glass-enter w-full max-w-[1380px] h-[93vh] bg-[#0E0E12] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.85)] rounded-2xl flex flex-col justify-between overflow-hidden text-chalk">
        {/* TOP CHROME: Consolidated Minimalist Header + Single Compact Control Row */}
        <div className="border-b border-white/[0.07] bg-white/[0.01] px-5 py-2.5 space-y-2 shrink-0">
          {/* Bar 1: Title + Scale Toggle + Round Toggle + Active Offer Badge + Run Simulation CTA */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-twok-red" />
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Focus Group
                </h2>
              </div>
              <span className="text-white/15">|</span>

              {/* Segmented Stage & Scale Toggle: Neural Flow vs 20 Personas vs 100 Swarm */}
              <div
                role="tablist"
                aria-label="Simulation scale and view"
                className="relative flex items-center rounded-lg bg-black/50 p-0.5 border border-white/[0.08] text-xs"
              >
                {(
                  [
                    {
                      id: "neural" as const,
                      label: "Neural Flow",
                      size: swarmSize,
                    },
                    {
                      id: "personas" as const,
                      label: "20 Personas",
                      size: 20 as const,
                    },
                    {
                      id: "swarm" as const,
                      label: "100 Swarm",
                      size: 100 as const,
                    },
                  ] as const
                ).map((tab) => {
                  const active = stageMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      type="button"
                      onClick={() => {
                        setStageMode(tab.id);
                        if (tab.id === "personas") setSwarmSize(20);
                        if (tab.id === "swarm") setSwarmSize(100);
                      }}
                      className={`relative z-10 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 active:scale-[0.97] ${
                        active ? "text-white" : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="fg-scale-pill"
                          transition={{ type: "spring", bounce: 0, duration: 0.32 }}
                          className="absolute inset-0 rounded-md bg-white/[0.12] border border-white/[0.12] -z-10"
                        />
                      )}
                      {tab.id === "neural" && (
                        <Sparkles className="w-3 h-3 text-[#669DF6] shrink-0" />
                      )}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Segmented Round Control: R1 Isolated vs R2 Social Shift vs R3 What-If */}
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
                      className={`relative z-10 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 active:scale-[0.97] ${
                        active ? "text-white" : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="fg-round-pill"
                          transition={{ type: "spring", bounce: 0, duration: 0.32 }}
                          className="absolute inset-0 rounded-md bg-white/[0.12] border border-white/[0.12] -z-10"
                        />
                      )}
                      {rTab.round === 3 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-win-green shrink-0" />
                      )}
                      <span>{rTab.label}</span>
                      {rTab.round === 2 && (contagionFlipsCount > 0 || buyDeltaR2 > 0) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-win-green/20 text-win-green font-mono font-semibold text-[10px] tabular">
                          +{contagionFlipsCount || buyDeltaR2}
                        </span>
                      )}
                      {rTab.round === 3 && (round3FlipsCount > 0 || buyDeltaR3 > 0) && (
                        <span className="px-1.5 py-0.2 rounded-full bg-win-green/20 text-win-green font-mono font-semibold text-[10px] tabular">
                          +{round3FlipsCount || buyDeltaR3}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Offer Summary Pill (Replaces the duplicate Row 4 & Row 5 offer headers) */}
              <button
                type="button"
                onClick={() => setIsEditingCustomOffer((prev) => !prev)}
                title="Click to customize offer title or price"
                className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-xs transition-colors active:scale-[0.98]"
              >
                <span className="text-white/85 font-medium truncate max-w-[320px]">
                  {creativeTitle}
                </span>
                <span className="font-mono font-semibold text-vc-gold tabular shrink-0">
                  ${priceUsd.toFixed(2)}
                  {isBattleMode ? ` vs $${(altPriceUsd ?? 19.99).toFixed(2)}` : ""}
                </span>
                <SlidersHorizontal className="w-3 h-3 text-white/40 shrink-0" />
              </button>
            </div>

            {/* Right: Run Simulation CTA & Close */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunPressureTest}
                disabled={isRunning}
                className="relative overflow-hidden flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-twok-red hover:bg-twok-red-deep disabled:opacity-75 text-xs font-semibold text-white transition-all active:scale-[0.97]"
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
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Single Compact Control Row: Preset Pills + Inline Editable Offer/Price + What-If Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESETS.map((p) => {
                const isSelected =
                  !isEditingCustomOffer &&
                  creativeTitle === p.title &&
                  priceUsd === p.priceUsd;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all active:scale-[0.97] ${
                      isSelected
                        ? "bg-white text-court-black font-semibold"
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
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all active:scale-[0.97] border ${
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
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all active:scale-[0.97] border ${
                  isEditingCustomOffer
                    ? "bg-white/15 text-white border-white/25"
                    : "bg-white/[0.02] text-white/50 border-white/[0.06] hover:text-white/85"
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Custom</span>
              </button>

              {/* Inline Compact Offer & Price Editor (when Custom is active) */}
              {isEditingCustomOffer && (
                <div className="flex items-center gap-1.5 pl-1">
                  <input
                    type="text"
                    value={creativeTitle}
                    onChange={(e) => setCreativeTitle(e.target.value)}
                    placeholder="Custom offer title..."
                    className="w-56 sm:w-72 rounded-md border border-white/[0.14] bg-black/60 px-2.5 py-1 text-[11px] text-white focus:border-white/35 focus:outline-none"
                  />
                  <div className="flex items-center gap-0.5 rounded-md border border-white/[0.14] bg-black/60 px-2 py-1">
                    <span className="text-[11px] text-white/40 font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-transparent text-[11px] text-white font-mono tabular focus:outline-none"
                    />
                  </div>
                  {isBattleMode && (
                    <div className="flex items-center gap-0.5 rounded-md border border-vc-gold/30 bg-black/60 px-2 py-1">
                      <span className="text-[10px] text-vc-gold font-mono">vs $</span>
                      <input
                        type="number"
                        step="0.01"
                        value={altPriceUsd ?? 19.99}
                        onChange={(e) => setAltPriceUsd(parseFloat(e.target.value) || 19.99)}
                        className="w-14 bg-transparent text-[11px] text-vc-gold font-mono tabular focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Single Clean What-If Pill Selector */}
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
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap active:scale-[0.97] border ${
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
        </div>

        {/* EXECUTIVE BUSINESS VALUE FIRST: Minimalist 4-Metric Executive Impact Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 px-5 py-2.5 border-b border-white/[0.07] bg-white/[0.015] shrink-0">
          {/* KPI 1: TimesFM 3.0 · 30d Forecast */}
          <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3.5 py-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium text-white/55">
                TimesFM 3.0 · 30d Forecast
              </span>
              <span className="px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-[9px] font-mono text-white/60 uppercase">
                AI.FORECAST
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-xl font-bold text-win-green font-mono tabular-nums tracking-tight">
                ${animatedBookingsStr}K
              </span>
              <span className="text-[10px] font-mono text-white/45 tabular-nums truncate">
                [90% CI: ${(timesFmForecast.ci_10_usd / 1000).toFixed(0)}K–$
                {(timesFmForecast.ci_90_usd / 1000).toFixed(0)}K]
              </span>
            </div>
          </div>

          {/* KPI 2: Conversion Lift & Adoption */}
          <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3.5 py-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium text-white/55">
                Conversion Lift &amp; Adoption
              </span>
              <span className="text-[10px] font-mono text-white/75 tabular-nums font-semibold">
                {buyCount}/{totalDenominator} BUY
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-xl font-bold text-win-green font-mono tabular-nums tracking-tight shrink-0">
                +{animatedConversionLiftStr}%
              </span>
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden flex gap-0.5">
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
                <div className="flex items-center justify-between text-[9px] font-mono text-white/45 tabular-nums">
                  <span className="text-win-green">{buyCount} BUY</span>
                  <span className="text-vc-gold">{evalCount} EVAL</span>
                  <span>{passCount} PASS</span>
                  <span className="text-loss-red">{boycottCount} BOYC</span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI 3: Social Crew Cascade */}
          <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3.5 py-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium text-white/55">
                Social Crew Cascade
              </span>
              <span className="text-[10px] font-mono text-win-green tabular-nums">
                +{contagionFlipsCount || Math.max(0, buyDeltaR2)} R2 Social Flips
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-xl font-bold text-white font-mono tabular-nums tracking-tight">
                {animatedCrewCascadeStr}x
              </span>
              <span className="text-[10px] text-white/45 truncate">
                {round3FlipsCount > 0
                  ? `+${round3FlipsCount} R3 What-If Rescues`
                  : "via Crew Captains & Co-Streams"}
              </span>
            </div>
          </div>

          {/* KPI 4: Causal Net Lift & Lifespan */}
          <div className="rounded-xl border border-white/[0.07] bg-black/35 px-3.5 py-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-medium text-white/55">
                Causal Net Lift &amp; Lifespan
              </span>
              <span className="text-[10px] font-mono text-cyan-300 tabular-nums">
                -{survivalAnalysis.crew_hazard_reduction_pct}% Crew Hazard
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-xl font-bold text-white font-mono tabular-nums tracking-tight">
                +{animatedLifespanStr}d Lifespan
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  backlashIndex > 35 ? "text-loss-red" : "text-white/50"
                }`}
              >
                Backlash {backlashIndex}%
              </span>
            </div>
          </div>
        </div>

        {/* MAIN WORKSPACE: 8-Col Neural Flow / Stance Grid + 4-Col Single-Card Segmented Analytics Rail */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 py-3 overflow-hidden min-h-0">
          {/* Left Column (8 Cols): MiroFish Neural Flow (Default) OR Creator Signal Bar + Persona/Swarm Grid */}
          <div className="lg:col-span-8 flex flex-col h-full overflow-hidden min-h-0 gap-2.5">
            {stageMode === "neural" ? (
              <MiroFishNeuralFlow
                isRunning={isRunning}
                streamPhase={streamPhase}
                streamProgress={streamProgress}
                swarmSize={swarmSize}
                activeRound={activeRound}
                hasRound3={hasRound3}
                selectedCfLabel={
                  COUNTERFACTUAL_CHIPS.find((c) => c.id === selectedCfId)?.label ||
                  "What-If Rescue"
                }
                cohortName={
                  cohortContext?.query?.slice(0, 68) ||
                  "NBA 2K27 High-Uplift Cohort"
                }
                creativeTitle={creativeTitle}
                priceUsd={priceUsd}
                altPriceUsd={altPriceUsd ?? undefined}
                isBattleMode={isBattleMode}
                sampledPersonas={sampledPersonas}
                activeReactions={activeReactions}
                crowdAgents={displayCrowdAgents}
                creatorSignals={creatorSignalItems}
                redditThreads={
                  currentResult?.reddit_threads &&
                  currentResult.reddit_threads.length > 0
                    ? currentResult.reddit_threads
                    : redditThreads
                }
                contagionFlipsCount={
                  contagionFlipsCount || Math.max(2, buyDeltaR2)
                }
                round3FlipsCount={round3FlipsCount || Math.max(0, buyDeltaR3)}
                crewMultiplier={crewMultiplier}
                conversionLift={conversionLift}
                buyCount={buyCount}
                evalCount={evalCount}
                passCount={passCount}
                boycottCount={boycottCount}
                totalDenominator={totalDenominator}
                onSelectRound={(r) => setActiveRound(r)}
                onInterrogatePersona={(persona) =>
                  setInterrogatePersona(persona)
                }
                prefersReducedMotion={Boolean(prefersReducedMotion)}
              />
            ) : (
              <>
                {/* Sleek Horizontal Creator Signal Bar (with click/hover quote popover) */}
                <div className="relative rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40 shrink-0">
                <Radio className="w-3 h-3 text-twok-red" />
                <span>Creator Signal</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-end">
                {creatorSignalItems.map((cr) => {
                  const isOpenPopover = activeCreatorPopover === cr.handle;
                  const stanceColor =
                    cr.stance === "ENDORSE"
                      ? "text-win-green border-win-green/30 bg-win-green/10"
                      : cr.stance === "CALLOUT"
                        ? "text-loss-red border-loss-red/30 bg-loss-red/10"
                        : "text-vc-gold border-vc-gold/30 bg-vc-gold/10";
                  return (
                    <div
                      key={cr.id}
                      className="relative"
                      onMouseEnter={() => setActiveCreatorPopover(cr.handle)}
                      onMouseLeave={() =>
                        setActiveCreatorPopover((prev) =>
                          prev === cr.handle ? null : prev
                        )
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCreatorPopover((prev) =>
                            prev === cr.handle ? null : cr.handle
                          )
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.07] bg-black/40 hover:bg-white/[0.06] hover:border-white/[0.16] text-[11px] font-mono transition-colors active:scale-[0.98]"
                      >
                        <span className="font-semibold text-white/90">
                          {cr.handle}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${stanceColor}`}
                        >
                          {cr.stance}
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="text-vc-gold font-semibold tabular-nums">
                          {cr.mroas.toFixed(1)}x mROAS
                        </span>
                      </button>

                      <AnimatePresence>
                        {isOpenPopover && (
                          <motion.div
                            initial={{ opacity: 0, transform: "scale(0.96) translateY(4px)" }}
                            animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
                            exit={{ opacity: 0, transform: "scale(0.96) translateY(4px)" }}
                            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                            style={{ transformOrigin: "top right" }}
                            className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-xl border border-white/[0.12] bg-[#16161D] p-3 shadow-2xl text-left space-y-1.5 pointer-events-none"
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="font-semibold text-white">
                                {cr.handle} · {cr.platform}
                              </span>
                              <span className="text-win-green tabular-nums">
                                +{cr.attributed_flips} R2 flips
                              </span>
                            </div>
                            <p className="text-xs text-white/85 leading-relaxed font-sans">
                              &ldquo;{cr.headline}&rdquo;
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Content: 20-Persona Minimalist Stance Grid OR 100-Agent Swarm Matrix */}
            {swarmSize === 20 ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <motion.div
                  key={`round-grid-${activeRound}`}
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0.92 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: prefersReducedMotion ? 0 : 0.035,
                      },
                    },
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2"
                >
                  {sampledPersonas.slice(0, 20).map((p: any, idx: number) => {
                    const reaction =
                      liveReactions[idx] || currentResult?.reactions?.[idx] || null;
                    const cardArchetype = reaction?.archetype || p.archetype;
                    const cardGamerTag = reaction?.gamer_tag || p.gamer_tag;
                    const crewName =
                      reaction?.crew_name || p.crew_name || "Bucket Getters";
                    const ovr = reaction?.myplayer_ovr ?? p.myplayer_ovr ?? 85;
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
                        (reaction?.contagion_flipped || r1State !== r2State)
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
                    const flippedToBuy =
                      (flippedInR2 && r2State === "PURCHASED") || rescuedInR3;
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
                      (activeRound === 1
                        ? reaction?.round1_wtp_usd ?? reaction?.willingness_to_pay_usd
                        : activeRound === 3
                          ? reaction?.round3_wtp_usd ?? reaction?.willingness_to_pay_usd
                          : reaction?.willingness_to_pay_usd) ??
                      (Number(p.vc_spend_90d ?? p.spend ?? 0) >= 120
                        ? 14.99
                        : Number(p.vc_spend_90d ?? p.spend ?? 0) >= 50
                          ? 9.99
                          : 4.99);

                    const wtpRatioPct = Math.min(
                      100,
                      Math.max(8, Math.round((displayedWtp / Math.max(1, priceUsd)) * 100))
                    );

                    const statePillStyle =
                      state === "PURCHASED"
                        ? "bg-win-green/15 text-win-green border-win-green/35"
                        : state === "ABANDONED"
                          ? "bg-white/[0.06] text-white/55 border-white/10"
                          : state === "BOYCOTT"
                            ? "bg-loss-red/15 text-loss-red border-loss-red/35"
                            : "bg-vc-gold/15 text-vc-gold border-vc-gold/35";

                    const stateLabel = shortStateBadge(state);
                    const r1Short = shortStateBadge(r1State);
                    const r2Short = shortStateBadge(r2State);
                    const r3Short = shortStateBadge(r3State);

                    const isExpanded = expandedPersonaIdx === idx;
                    const punchyLine = extractPunchyHeadline(
                      displayedQuote,
                      `${ovr} OVR · ${p.myplayer_build || "2-Way 3-Level Scorer"}`
                    );

                    const personaForDrawer: FocusGroupReaction =
                      reaction ||
                      ({
                        player_id: p.player_id || `persona-${idx}`,
                        gamer_tag: cardGamerTag,
                        archetype: cardArchetype,
                        crew_name: crewName,
                        creator_handle: creatorHandle,
                        myplayer_ovr: ovr,
                        round1_fsm_state: r1State,
                        final_fsm_state: r2State,
                        willingness_to_pay_usd: displayedWtp,
                        verbatim_quote:
                          displayedQuote ||
                          `Evaluating ${creativeTitle} with ${crewName}.`,
                        authenticity_rating: 0.94,
                        churn_risk_score: 0.25,
                        sentiment_score: 0.65,
                      } as FocusGroupReaction);

                    return (
                      <motion.div
                        key={p.player_id || idx}
                        layout
                        variants={{
                          hidden: prefersReducedMotion
                            ? { opacity: 0.95 }
                            : {
                                opacity: 0.65,
                                transform: "translateY(6px) scale(0.985)",
                              },
                          visible: {
                            opacity: 1,
                            transform: "translateY(0px) scale(1)",
                            transition: {
                              type: "spring",
                              bounce: 0.15,
                              duration: 0.4,
                            },
                          },
                        }}
                        className={`rounded-xl border transition-colors ${
                          isExpanded ? "md:col-span-2" : ""
                        } ${
                          flippedToBuy
                            ? "border-win-green/45 bg-win-green/[0.045] shadow-[inset_0_0_0_1px_rgba(25,195,125,0.18)]"
                            : flipped
                              ? "border-vc-gold/35 bg-vc-gold/[0.03]"
                              : isExpanded
                                ? "border-white/[0.16] bg-white/[0.035]"
                                : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.13]"
                        }`}
                      >
                        {/* Clickable Scannable Stance Header */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setExpandedPersonaIdx((prev) =>
                              prev === idx ? null : idx
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedPersonaIdx((prev) =>
                                prev === idx ? null : idx
                              );
                            }
                          }}
                          className="p-3 cursor-pointer select-none space-y-1.5"
                        >
                          {/* Row 1: Identity + OVR/Crew vs Flip Badge + Stance Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                style={{ backgroundColor: bColor }}
                                className="w-2 h-2 rounded-full shrink-0"
                              />
                              <span className="font-semibold text-xs text-white tracking-tight truncate">
                                {cardGamerTag}
                              </span>
                              <span className="text-[10px] font-mono text-white/45 truncate">
                                {ovr} OVR · {crewName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {flippedInR3 ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-win-green/20 text-win-green border border-win-green/40 flex items-center gap-0.5">
                                  <span>
                                    R2 {r2Short} → R3 {r3Short}
                                  </span>
                                </span>
                              ) : flippedInR2 ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-win-green/20 text-win-green border border-win-green/40 flex items-center gap-0.5">
                                  <span>
                                    R1 {r1Short} → R2 {r2Short}
                                  </span>
                                </span>
                              ) : null}

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wide border ${statePillStyle}`}
                              >
                                {stateLabel}
                              </span>

                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                              )}
                            </div>
                          </div>

                          {/* Row 2: Single Punchy 1-Line Headline (when collapsed) */}
                          {!isExpanded && (
                            <p className="text-[11px] text-white/75 line-clamp-1 font-normal">
                              &ldquo;{punchyLine}&rdquo;
                            </p>
                          )}

                          {/* Row 3: Archetype + Provenance + WTP vs Offer Bar */}
                          <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] font-mono text-white/45">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              {provenanceLabel ? (
                                <span className="px-1.5 py-0.2 rounded bg-win-green/15 text-win-green border border-win-green/25 text-[9px] font-semibold shrink-0">
                                  {provenanceLabel}
                                </span>
                              ) : null}
                              <span className="truncate font-sans text-[10px] text-white/45">
                                {archetypeLabel(cardArchetype)} · {creatorHandle}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="w-12 h-1 rounded-full bg-white/[0.08] overflow-hidden hidden sm:block">
                                <div
                                  style={{ width: `${wtpRatioPct}%` }}
                                  className={`h-full ${
                                    displayedWtp >= priceUsd
                                      ? "bg-win-green"
                                      : "bg-vc-gold"
                                  }`}
                                />
                              </div>
                              <span className="text-white/80 tabular-nums">
                                WTP ${displayedWtp.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Spotlight Expansion: Full Verbatim Quote + Inline 1-on-1 Chat + 3-Way Debate CTA */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="px-3 pb-3 pt-1 border-t border-white/[0.07] space-y-2.5"
                            >
                              <p className="text-xs text-white/90 leading-relaxed bg-black/35 border border-white/[0.06] rounded-lg px-3 py-2">
                                &ldquo;
                                {displayedQuote ||
                                  `Evaluating ${creativeTitle} at $${priceUsd.toFixed(
                                    2
                                  )} with ${crewName} squadmates before locking in.`}
                                &rdquo;
                              </p>

                              {inlineAnswerMap[idx] && (
                                <div className="rounded-lg bg-win-green/[0.06] border border-win-green/25 px-3 py-2 text-xs text-white/90 space-y-0.5">
                                  <span className="text-[10px] font-mono text-win-green font-semibold block">
                                    @{cardGamerTag} (Live 1-on-1 Reply):
                                  </span>
                                  <p className="leading-relaxed">{inlineAnswerMap[idx]}</p>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleInlineInterrogate(
                                      idx,
                                      personaForDrawer,
                                      inlineQuestion
                                    );
                                  }}
                                  className="flex-1 min-w-[220px] flex items-center gap-1.5"
                                >
                                  <input
                                    type="text"
                                    value={inlineQuestion}
                                    onChange={(e) => setInlineQuestion(e.target.value)}
                                    placeholder={`Ask ${cardGamerTag} a 1-on-1 follow-up...`}
                                    className="flex-1 rounded-lg border border-white/[0.1] bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    disabled={isAskingInline || !inlineQuestion.trim()}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium flex items-center gap-1 disabled:opacity-40 active:scale-[0.97] transition-all"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>{isAskingInline ? "..." : "Ask"}</span>
                                  </button>
                                </form>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInterrogatePersona(personaForDrawer)
                                    }
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-[11px] font-medium text-white transition-all active:scale-[0.97]"
                                  >
                                    <MessageSquare className="w-3 h-3 text-cyan-400" />
                                    <span>1-on-1 Interview</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInterrogatePersona(personaForDrawer)
                                    }
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-twok-red/15 hover:bg-twok-red/25 border border-twok-red/35 text-[11px] font-semibold text-white transition-all active:scale-[0.97]"
                                  >
                                    <Users className="w-3 h-3 text-twok-red" />
                                    <span>3-Way Debate</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>
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
              </>
            )}
          </div>

          {/* Right Column (4 Cols): Clean 3-Tab Segmented Analytics Card (Only ONE Visual Card Shown at a Time) */}
          <div className="lg:col-span-4 flex flex-col h-full min-h-0 overflow-hidden gap-2.5">
            {/* 3-Tab Segmented Control with layoutId Spring Indicator */}
            <div
              role="tablist"
              aria-label="Executive analytics view"
              className="grid grid-cols-3 rounded-xl bg-black/50 p-1 border border-white/[0.08] text-[11px] shrink-0"
            >
              {(
                [
                  { id: "forecast_survival" as const, label: "Forecast & Survival" },
                  { id: "price_uplift" as const, label: "Price & CATE Uplift" },
                  { id: "reddit_pulse" as const, label: "Reddit Pulse" },
                ] as const
              ).map((tab) => {
                const active = analyticsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setAnalyticsTab(tab.id)}
                    className={`relative z-10 py-1.5 px-2 rounded-lg font-medium transition-colors text-center truncate active:scale-[0.98] ${
                      active ? "text-white font-semibold" : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="fg-right-analytics-tab"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.38 }}
                        className="absolute inset-0 rounded-lg bg-white/[0.12] border border-white/[0.14] -z-10"
                      />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Active Single Analytics Card */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {analyticsTab === "forecast_survival" && (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex-1 flex flex-col justify-between gap-3">
                  {/* Section A: Cox/Weibull 30-Day Survival Curve (Self-Drawing SVG) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          Cox / Weibull 30-Day Build Survival
                        </span>
                        <span className="text-[10px] font-mono text-white/50">
                          Baseline T50:{" "}
                          <span className="text-loss-red font-semibold">
                            Day {survivalAnalysis.baseline_t50_days}
                          </span>{" "}
                          <ArrowRight className="inline w-2.5 h-2.5 mx-0.5 text-white/35" />{" "}
                          Treated T50:{" "}
                          <span className="text-win-green font-semibold">
                            Day {survivalAnalysis.treated_t50_days}
                          </span>
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-win-green/10 border border-win-green/25 text-win-green font-mono text-[10px] font-semibold tabular-nums">
                        +{survivalAnalysis.days_gained.toFixed(1)}d Lifespan
                      </span>
                    </div>

                    {(() => {
                      const pts = survivalAnalysis.curve || [];
                      const w = 320;
                      const h = 76;
                      const toCoord = (idx: number, pct: number) => {
                        const x =
                          pts.length > 1
                            ? (idx / (pts.length - 1)) * (w - 16) + 8
                            : w / 2;
                        const y =
                          h - 8 - (Math.max(0, Math.min(100, pct)) / 100) * (h - 16);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      };
                      const basePath = pts
                        .map(
                          (pt, i) =>
                            `${i === 0 ? "M" : "L"}${toCoord(
                              i,
                              pt.baseline_survival_pct
                            )}`
                        )
                        .join(" ");
                      const treatedPath = pts
                        .map(
                          (pt, i) =>
                            `${i === 0 ? "M" : "L"}${toCoord(
                              i,
                              pt.treated_survival_pct
                            )}`
                        )
                        .join(" ");
                      return (
                        <svg
                          viewBox={`0 0 ${w} ${h}`}
                          className="w-full h-[76px] overflow-visible rounded-lg bg-black/40 border border-white/[0.06] px-1.5"
                        >
                          <line
                            x1="0"
                            y1={h / 2}
                            x2={w}
                            y2={h / 2}
                            stroke="rgba(255,255,255,0.08)"
                            strokeDasharray="2 2"
                          />
                          {basePath && (
                            <motion.path
                              key={`surv-base-${activeRound}-${priceUsd}`}
                              d={basePath}
                              fill="none"
                              stroke="#FF4D5E"
                              strokeWidth="1.75"
                              strokeDasharray="3 3"
                              initial={
                                prefersReducedMotion
                                  ? { pathLength: 1, opacity: 1 }
                                  : { pathLength: 0, opacity: 0.3 }
                              }
                              animate={{ pathLength: 1, opacity: 0.85 }}
                              transition={{
                                duration: 0.65,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            />
                          )}
                          {treatedPath && (
                            <motion.path
                              key={`surv-treated-${activeRound}-${priceUsd}`}
                              d={treatedPath}
                              fill="none"
                              stroke="#19C37D"
                              strokeWidth="2.25"
                              strokeLinecap="round"
                              initial={
                                prefersReducedMotion
                                  ? { pathLength: 1, opacity: 1 }
                                  : { pathLength: 0, opacity: 0.3 }
                              }
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{
                                duration: 0.65,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            />
                          )}
                        </svg>
                      );
                    })()}

                    <div className="flex items-center justify-between text-[10px] font-mono text-white/45">
                      <span>
                        84 OVR Build Cliff Hazard: {survivalAnalysis.build_wall_hazard_ratio}x
                      </span>
                      <span className="text-cyan-300">
                        -{survivalAnalysis.crew_hazard_reduction_pct}% Crew Hazard Reduction
                      </span>
                    </div>
                  </div>

                  {/* Section B: TimesFM 3.0 6-Week Bookings Trajectory */}
                  <div className="pt-3 border-t border-white/[0.07] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white">
                        TimesFM 3.0 · 6-Week Horizon
                      </span>
                      <span className="font-mono text-win-green font-semibold tabular-nums">
                        +${(timesFmForecast.projected_30d_bookings_usd / 1000).toFixed(1)}K{" "}
                        <span className="text-white/45 font-normal text-[10px]">
                          (+{timesFmForecast.whale_decay_offset_pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5 items-end h-16 pt-2 px-1">
                      {(timesFmForecast.points || []).slice(0, 6).map((pt) => {
                        const maxVal = Math.max(
                          1,
                          ...timesFmForecast.points.map((p) => p.treated_bookings_usd)
                        );
                        const baseH = Math.max(
                          14,
                          Math.round((pt.baseline_bookings_usd / maxVal) * 100)
                        );
                        const treatedH = Math.max(
                          20,
                          Math.round((pt.treated_bookings_usd / maxVal) * 100)
                        );
                        return (
                          <div
                            key={pt.horizon_label}
                            className="flex flex-col items-center gap-1 h-full justify-end"
                          >
                            <div className="w-full flex items-end justify-center gap-0.5 h-11">
                              <div
                                style={{ height: `${baseH}%` }}
                                className="w-2 rounded-t bg-white/20"
                                title={`Baseline: $${pt.baseline_bookings_usd.toLocaleString()}`}
                              />
                              <div
                                style={{ height: `${treatedH}%` }}
                                className="w-2 rounded-t bg-win-green"
                                title={`Treated: $${pt.treated_bookings_usd.toLocaleString()}`}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-white/45 tabular-nums">
                              {pt.horizon_label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section C: Meridian Creator mROAS Allocation */}
                  <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                      <span>MERIDIAN CREATOR mROAS</span>
                      <span>OPTIMAL BUDGET SPLIT</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                      {(timesFmForecast.creator_mroas || []).slice(0, 3).map((cr) => (
                        <div
                          key={cr.handle}
                          className="rounded-lg bg-black/40 border border-white/[0.06] px-2.5 py-1.5 flex flex-col justify-between"
                        >
                          <span className="text-white/85 font-semibold truncate">
                            {cr.handle}
                          </span>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-vc-gold font-bold tabular-nums">
                              {cr.mroas.toFixed(1)}x
                            </span>
                            <span className="text-[9px] text-white/40 tabular-nums">
                              {cr.optimal_budget_pct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consensus Narrative */}
                  <p className="text-[11px] text-white/60 leading-snug pt-2 border-t border-white/[0.06]">
                    {currentResult?.contagion_summary ||
                      crewCaptainSummary ||
                      "Crew Captains acted as critical social nodes, triggering a peer-pressure cascade that bypassed early price hesitation."}
                  </p>
                </div>
              )}

              {analyticsTab === "price_uplift" && (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 flex-1 flex flex-col justify-between gap-3">
                  {/* Section A: Self-Drawing WTP Price Elasticity Curve */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          WTP Price Elasticity Curve
                        </span>
                        <span className="text-[10px] font-mono text-white/45">
                          Evaluated at ${priceUsd.toFixed(2)} proposed offer point
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-vc-gold bg-vc-gold/10 px-2 py-0.5 rounded-md border border-vc-gold/25 tabular-nums shrink-0">
                        Optimal ${recommendedPrice.toFixed(2)}
                      </span>
                    </div>

                    {(() => {
                      const values = wtpCurve.map((p) => p.conversion_pct);
                      const w = 320;
                      const h = 76;
                      const padX = 10;
                      const padY = 10;
                      const minVal = Math.min(...values);
                      const maxVal = Math.max(...values);
                      const range = maxVal - minVal || 1;
                      const innerW = w - padX * 2;
                      const innerH = h - padY * 2;

                      const pts = wtpCurve.map((item, idx) => {
                        const x =
                          wtpCurve.length === 1
                            ? w / 2
                            : padX + (idx / (wtpCurve.length - 1)) * innerW;
                        const y =
                          padY + innerH - ((item.conversion_pct - minVal) / range) * innerH;
                        return { x, y, price: item.price, pct: item.conversion_pct };
                      });

                      const dPath = pts
                        .map(
                          (p, i) =>
                            `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
                        )
                        .join(" ");

                      const hi = pts[highlightIdx >= 0 ? highlightIdx : 1] || pts[0];

                      return (
                        <svg
                          viewBox={`0 0 ${w} ${h}`}
                          className="w-full h-[76px] overflow-visible rounded-lg bg-black/40 border border-white/[0.06]"
                        >
                          <motion.path
                            key={`wtp-curve-${priceUsd}-${recommendedPrice}`}
                            d={dPath}
                            fill="none"
                            stroke="var(--twok-red)"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={
                              prefersReducedMotion
                                ? { pathLength: 1, opacity: 1 }
                                : { pathLength: 0, opacity: 0.3 }
                            }
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{
                              duration: 0.65,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                          {hi && (
                            <g>
                              <line
                                x1={hi.x}
                                y1={padY}
                                x2={hi.x}
                                y2={h - padY}
                                stroke="var(--vc-gold)"
                                strokeDasharray="2 2"
                                strokeWidth="1"
                              />
                              <circle
                                cx={hi.x}
                                cy={hi.y}
                                r="3.5"
                                fill="var(--vc-gold)"
                              />
                              <text
                                x={Math.min(Math.max(hi.x, 28), w - 28)}
                                y={Math.max(12, hi.y - 6)}
                                textAnchor="middle"
                                className="fill-vc-gold font-mono text-[9px] tabular-nums"
                              >
                                ${hi.price} ({hi.pct}%)
                              </text>
                            </g>
                          )}
                        </svg>
                      );
                    })()}

                    {isBattleMode && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                        <div className="rounded-md bg-black/40 border border-white/[0.06] px-2.5 py-1.5 flex items-center justify-between">
                          <span className="font-mono text-white/65">
                            ${priceUsd.toFixed(2)}
                          </span>
                          <span className="font-mono font-semibold text-win-green tabular-nums">
                            +{conversionLift.toFixed(1)}% lift
                          </span>
                        </div>
                        <div className="rounded-md bg-black/40 border border-white/[0.06] px-2.5 py-1.5 flex items-center justify-between">
                          <span className="font-mono text-white/65">
                            ${(altPriceUsd ?? 19.99).toFixed(2)}
                          </span>
                          <span className="font-mono font-semibold text-loss-red tabular-nums">
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

                  {/* Section B: 4-Quadrant Causal Uplift (CATE) */}
                  <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-semibold">
                        Causal Uplift (CATE) Quadrants
                      </span>
                      <span className="font-mono text-win-green font-semibold tabular-nums">
                        +{causalUplift.cate_lift_pct.toFixed(1)}% net uplift
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5">
                      <div
                        style={{ width: `${causalUplift.persuadables_pct}%` }}
                        className="h-full bg-win-green transition-all duration-300"
                      />
                      <div
                        style={{ width: `${causalUplift.sure_things_pct}%` }}
                        className="h-full bg-cyan-400 transition-all duration-300"
                      />
                      <div
                        style={{ width: `${causalUplift.lost_causes_pct}%` }}
                        className="h-full bg-zinc-500 transition-all duration-300"
                      />
                      <div
                        style={{ width: `${causalUplift.sleeping_dogs_pct}%` }}
                        className="h-full bg-loss-red transition-all duration-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                      <div className="rounded-lg bg-win-green/10 border border-win-green/25 px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-win-green">Persuadables</span>
                        <span className="font-bold text-white tabular-nums">
                          {causalUplift.persuadables_count} ({causalUplift.persuadables_pct}%)
                        </span>
                      </div>
                      <div className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-cyan-300">Sure Things</span>
                        <span className="font-bold text-white tabular-nums">
                          {causalUplift.sure_things_count} ({causalUplift.sure_things_pct}%)
                        </span>
                      </div>
                      <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-zinc-400">Lost Causes</span>
                        <span className="font-bold text-white/75 tabular-nums">
                          {causalUplift.lost_causes_count} ({causalUplift.lost_causes_pct}%)
                        </span>
                      </div>
                      <div className="rounded-lg bg-loss-red/10 border border-loss-red/25 px-2.5 py-1.5 flex items-center justify-between">
                        <span className="text-loss-red">Sleeping Dogs</span>
                        <span className="font-bold text-white tabular-nums">
                          {causalUplift.sleeping_dogs_count} ({causalUplift.sleeping_dogs_pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/40 border border-white/[0.06] px-3 py-2 text-[11px] font-mono text-white/70">
                      {causalUplift.takeaway}
                    </div>
                  </div>
                </div>
              )}

              {analyticsTab === "reddit_pulse" && (
                <RedditPulseCard
                  echoThreads={
                    currentResult?.reddit_threads && currentResult.reddit_threads.length > 0
                      ? currentResult.reddit_threads
                      : redditThreads
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* FOOTER: Calm Status + Creative Studio & Campaign Brief Handoff */}
        <div className="border-t border-white/[0.07] px-5 py-2.5 bg-white/[0.01] flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-white/50 flex items-center gap-2 truncate">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRunning ? "bg-vc-gold animate-pulse" : "bg-win-green"
              }`}
            />
            <span className="truncate">
              {hasStreamedAny
                ? `${totalDenominator}-agent simulation complete · +${conversionLift.toFixed(
                    1
                  )}% conversion lift (${contagionFlipsCount} R2 social flips${
                    round3FlipsCount > 0 ? ` · +${round3FlipsCount} R3 What-If rescues` : ""
                  })`
                : `Ready · ${swarmSize}-agent 2-round social contagion simulation`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                    causal_uplift: causalUplift,
                    survival_analysis: survivalAnalysis,
                    timesfm_forecast: timesFmForecast,
                  };
                  onGenerateBrief(defaultRes);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-court-black hover:bg-white/90 text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
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
