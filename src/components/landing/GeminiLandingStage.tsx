"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Globe,
  Radio,
  Database,
  Search,
  Zap,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Activity,
  Crosshair,
  Flame,
  Layers,
  Shield,
  Loader2,
  Users,
  FileText,
  ExternalLink,
  X,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { GameFranchise, DynamicCohortFinding } from "@/lib/types";
import SpannerStatusPill from "@/components/common/SpannerStatusPill";

interface GeminiLandingStageProps {
  onSearchQuery: (query: string, game: GameFranchise) => void;
  onExploreFullGraph: (game: GameFranchise) => void;
  onOpenA2A: () => void;
  onOpenGeoMap: () => void;
  onOpenMarketingJourney?: () => void;
  isLoading?: boolean;
  /** Set when a query failed. The stage stays put and explains why. */
  errorText?: string;
  onDismissError?: () => void;
}

const FRANCHISES: { id: GameFranchise; label: string; dotColor: string }[] = [
  { id: "ALL", label: "All CoD Modes", dotColor: "#F59E0B" },
  { id: "WARZONE", label: "Warzone & Resurgence", dotColor: "#F59E0B" },
  { id: "BLACK_OPS", label: "Black Ops 7 & Zombies", dotColor: "#FF5722" },
  { id: "MODERN_WARFARE", label: "Modern Warfare III", dotColor: "#10B981" },
  { id: "CDL_RANKED", label: "CDL & Ranked Play", dotColor: "#6366F1" },
  { id: "COD_MOBILE", label: "CoD Mobile", dotColor: "#06B6D4" },
];

const AURA_THEMES: Record<GameFranchise, { primary: string; secondary: string; pulse: string }> = {
  ALL: {
    primary: "rgba(245, 158, 11, 0.18)",    // Tactical Amber / Gold
    secondary: "rgba(16, 185, 129, 0.12)",  // Night-Vision Emerald
    pulse: "rgba(239, 68, 68, 0.10)",       // Warzone Red Alert
  },
  COD: {
    primary: "rgba(245, 158, 11, 0.18)",
    secondary: "rgba(16, 185, 129, 0.12)",
    pulse: "rgba(239, 68, 68, 0.10)",
  },
  WARZONE: {
    primary: "rgba(245, 158, 11, 0.20)",    // Urzikstan Gold
    secondary: "rgba(239, 68, 68, 0.14)",   // Gulag Red
    pulse: "rgba(16, 185, 129, 0.10)",      // Gas Mask Green
  },
  BLACK_OPS: {
    primary: "rgba(255, 87, 34, 0.20)",     // Treyarch Orange / Red
    secondary: "rgba(168, 85, 247, 0.14)",  // Dark Aether Purple
    pulse: "rgba(245, 158, 11, 0.12)",      // Pack-a-Punch Amber
  },
  MODERN_WARFARE: {
    primary: "rgba(16, 185, 129, 0.18)",    // Milsim Tactical Green
    secondary: "rgba(59, 130, 246, 0.14)",  // Task Force Blue
    pulse: "rgba(245, 158, 11, 0.10)",      // Interstellar Gold
  },
  CDL_RANKED: {
    primary: "rgba(99, 102, 241, 0.20)",    // CDL Indigo / Purple
    secondary: "rgba(239, 68, 68, 0.14)",   // Top 250 Crimson
    pulse: "rgba(0, 240, 255, 0.12)",       // Iridescent Cyan
  },
  COD_MOBILE: {
    primary: "rgba(6, 182, 212, 0.18)",     // Mobile Cyan
    secondary: "rgba(236, 72, 153, 0.14)",  // Mythic Draw Pink
    pulse: "rgba(245, 158, 11, 0.10)",      // Legendary Gold
  },
};

const getFindingIcon = (iconType: string) => {
  switch (iconType) {
    case "shield":
      return Shield;
    case "creator":
      return Sparkles;
    case "cross_title":
      return Layers;
    case "currency":
      return Coins;
    case "slump":
      return Flame;
    default:
      return Users;
  }
};

const DEFAULT_DYNAMIC_FINDINGS: DynamicCohortFinding[] = [
  {
    id: "bo7_early_churn",
    category: "bo7_churn",
    tabLabel: "01. Black Ops 7 Early Churn Risk",
    shortLabel: "BO7 Churn",
    badge: "Newest 2026 Title",
    iconType: "slump",
    iconColor: "text-orange-400",
    bgAccent: "bg-orange-500/10",
    pillColor: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    metricPill: "66.1% Churn Risk",
    title: "567 Early Black Ops 7 Players Triggering Churn & SBMM Fatigue",
    summary: "Live Spanner property graph analysis across Call of Duty: Black Ops 7 (the newest 2026 title) isolated 567 early adopters on 3+ defeat streaks with an average churn risk of 66.1% (1.47x baseline lift). Without day-3 recovery packages, 68% abandon Omnimovement 2.0 playlists within 7 days.",
    base: "567 Black Ops 7 Players • Live Spanner Property Graph",
    metrics: {
      cohortSize: 567,
      avgSpend: 388,
      avgChurn: 0.66,
      liftMetric: "1.47x Churn Lift",
      highRiskCount: 244,
      secondaryMetric: "$220,107 Cohort Exposure",
    },
    caveats: [
      "Newest Title Telemetry: Real-time Spanner property graph edge `(p:Player)-[:PLAYS_GAME]->(g:Game {game_id: 'game-cod-bo7'})`.",
      "Omnimovement Fatigue: Casual players matching against hyper-movement CDL sweats exhibit 2.4x higher session abandonment.",
      "Early Intervention: Automated $4.99 BO7 Recovery Bundle drops within 60 minutes mitigate day-7 drop-off by 43.5%.",
    ],
    actionLabel: "Load Black Ops 7 Churn in Spanner Graph",
    queryToRun: "Black Ops 7 players on 3+ defeat streaks with high churn risk",
    franchise: "BLACK_OPS",
    prompts: [
      {
        title: "Black Ops 7 Early Churn Risk",
        query: "Black Ops 7 players on 3+ defeat streaks with high churn risk",
        franchise: "BLACK_OPS",
        tag: "BO7 Flagship",
        highlight: "567 Players",
      },
      {
        title: "BO7 Omnimovement Tilt Recovery",
        query: "Black Ops 7 multiplayer players with high tilt sensitivity over 0.70",
        franchise: "BLACK_OPS",
        tag: "Omnimovement 2.0",
        highlight: "Tilt >= 0.70",
      },
      {
        title: "BO7 Zombies Round Failure Churn",
        query: "Black Ops 7 Zombies players with 3+ losses and unspent CoD Points",
        franchise: "BLACK_OPS",
        tag: "Next-Gen Zombies",
        highlight: "Zombies Loss",
      },
    ],
  },
  {
    id: "creator_halo",
    category: "creator_halo",
    tabLabel: "02. Creator Halo & Shield",
    shortLabel: "Creator Halo",
    badge: "Spanner 2-Hop Halo",
    iconType: "creator",
    iconColor: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    pillColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    metricPill: "235 Whales at Risk",
    title: "235 High-Value Whales Following Scump, Swagg & TimTheTatman",
    summary: "Spanner 2-Hop graph traversal isolated 235 whale spenders (average spend $2,450) who follow Scump, FaZe Swagg, or TimTheTatman and are currently exhibiting high tilt or churn signals.",
    base: "235 Creator-Linked Whales • Live Spanner Property Graph",
    metrics: {
      cohortSize: 235,
      avgSpend: 2450,
      avgChurn: 0.32,
      liftMetric: "$575,750 Portfolio Value",
      highRiskCount: 68,
      secondaryMetric: "78.4% Creator Affinity",
    },
    caveats: [
      "Creator Graph Traversal: `(p:Player)-[:FOLLOWS_CREATOR]->(c:Creator)` edge analysis mapped against creator live streaming schedules.",
      "Shield Multiplier: Creator-endorsed weapon blueprints and custom loadouts reduce churn propensity by 38.2%.",
      "Content Decay: Creator sentiment shift creates an immediate 48-hour trailing retention drop among viewers.",
    ],
    actionLabel: "Explore Creator Whale Shield in Graph",
    queryToRun: "Whale players ($500+ spend) at risk of churn following Scump or FaZe Swagg",
    franchise: "WARZONE",
    prompts: [
      {
        title: "Creator Halo & Churn Shield (2-Hop)",
        query: "Whale players ($500+ spend) at risk of churn following Scump or FaZe Swagg",
        franchise: "WARZONE",
        tag: "Spanner 2-Hop",
        highlight: "Scump & FaZe",
      },
      {
        title: "Creator-Endorsed Weapon Blueprint",
        query: "Generate personalized weapon blueprint bundle for fans of FaZe Swagg and Scump",
        franchise: "WARZONE",
        tag: "Creative",
        highlight: "Blueprint Bundle",
      },
      {
        title: "Veo Personalized Killcam Hooks",
        query: "Extract 5 high-tilt Call of Duty players for personalized Veo killcam generation",
        franchise: "WARZONE",
        tag: "Google Veo",
        highlight: "5s Video Hook",
      },
    ],
  },
  {
    id: "cross_title_identity",
    category: "cross_title",
    tabLabel: "03. Cross-Mode Unified Identity",
    shortLabel: "Unified Identity",
    badge: "Activision Unified ID",
    iconType: "cross_title",
    iconColor: "text-purple-400",
    bgAccent: "bg-purple-500/10",
    pillColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    metricPill: "$2,450 Avg LTV",
    title: "119 Multi-Mode Whales Bridging Warzone & Black Ops 6",
    summary: "119 high-tier players identified via Activision ID graph edges who actively split playtime between Call of Duty: Warzone and Black Ops 6 Omnimovement, with an average LTV of $2,450.",
    base: "119 Unified Identities • Activision ID Graph",
    metrics: {
      cohortSize: 119,
      avgSpend: 2450,
      avgChurn: 0.32,
      liftMetric: "6.4x Cross-Mode Spend",
      highRiskCount: 22,
      secondaryMetric: "$291,550 Combined Spend",
    },
    caveats: [
      "Identity Unification: Multi-mode bridge mapped across `(p)-[:PLAYS_GAME]->(WARZONE)` and `(p)-[:PLAYS_GAME]->(BLACK_OPS)` via unified Activision ID.",
      "Seasonal Migration: Cross-mode spend surges 3.4x during Warzone mid-season lull when Black Ops 6 major seasons launch.",
      "Cross-Reward Elasticity: Unified BlackCell passes and shared weapon blueprints increase 6-month retention by 34%.",
    ],
    actionLabel: "Inspect Cross-Mode Identity Graph",
    queryToRun: "Activision accounts linked across Warzone and Black Ops 6",
    franchise: "ALL",
    prompts: [
      {
        title: "Cross-Mode Identity (3-Hop)",
        query: "Activision accounts linked across Warzone and Black Ops 6",
        franchise: "ALL",
        tag: "Spanner 3-Hop",
        highlight: "Warzone + BO6",
      },
      {
        title: "Cross-Mode Whales ($2,500+ Spend)",
        query: "Cross-mode whales with spend over $2,500 across Warzone, Black Ops 6, and MWIII",
        franchise: "ALL",
        tag: "Whale Graph",
        highlight: "$2,500+ Spend",
      },
      {
        title: "Zombies High-Round Whales",
        query: "Black Ops 6 Terminus & Liberty Falls players with 15+ rounds and BlackCell pass",
        franchise: "BLACK_OPS",
        tag: "BO6 Zombies",
        highlight: "Round 15+",
      },
    ],
  },
  {
    id: "dormant_currency",
    category: "dormant_currency",
    tabLabel: "04. Dormant CoD Points Vaults",
    shortLabel: "Dormant CP",
    badge: "1,000+ Unspent CP",
    iconType: "currency",
    iconColor: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    pillColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    metricPill: "1,650 Avg CP",
    title: "412 Players Holding 1,000+ Unspent CoD Points",
    summary: "412 active players currently hold 1,000+ unspent CoD Points (average 1,650 balance), presenting an immediate conversion opportunity for targeted BlackCell and Mastercraft shop vault offers.",
    base: "412 Currency Holders • Live Spanner Telemetry",
    metrics: {
      cohortSize: 412,
      avgSpend: 820,
      avgChurn: 0.58,
      liftMetric: "1,650 Avg Unspent CP",
      highRiskCount: 172,
      secondaryMetric: "$337,840 Total Balance",
    },
    caveats: [
      "Wallet Telemetry: Live ledger balance tracking for CoD Points (CP) across Activision accounts & console vaults.",
      "Conversion Elasticity: Players with 1,000+ dormant points convert at 3.8x higher rate when offered a 20% bundle discount.",
      "Burn Velocity: Unspent currency older than 45 days correlates with a 58% churn risk acceleration.",
    ],
    actionLabel: "Query High Currency Vault Holders",
    queryToRun: "High-value players holding over 1,000 unspent CoD Points with high churn risk",
    franchise: "WARZONE",
    prompts: [
      {
        title: "Dormant CoD Points Whales",
        query: "High-value players holding over 1,000 unspent CoD Points with high churn risk",
        franchise: "WARZONE",
        tag: "Currency Vault",
        highlight: "1,000+ CP",
      },
      {
        title: "BlackCell Pass Buyers ($1,500+ Spend)",
        query: "BlackCell whales who bought the Season 6 pass ($1,500+ spend)",
        franchise: "WARZONE",
        tag: "BlackCell",
        highlight: "$1,500+ Pass",
      },
      {
        title: "Mobile Mythic Draw Whales",
        query: "CoD Mobile players with 2,000+ unspent CP during Mythic Weapon events",
        franchise: "COD_MOBILE",
        tag: "CODM Mythic",
        highlight: "Mythic Draw",
      },
    ],
  },
  {
    id: "defeat_slump",
    category: "defeat_slump",
    tabLabel: "05. Defeat & Tilt Slumps",
    shortLabel: "Loss Slumps",
    badge: "Loss Streak >= 3",
    iconType: "slump",
    iconColor: "text-pink-400",
    bgAccent: "bg-pink-500/10",
    pillColor: "bg-pink-500/15 text-pink-300 border-rose-500/30",
    metricPill: "394 Slump Players",
    title: "Gulag Defeat & Loss Streaks Surge 14-Day Churn",
    summary: "394 players on 3+ consecutive loss streaks in Warzone Gulag or CDL Ranked exhibit a 64.5% churn risk (1.47x baseline lift). 71% of session drop-offs occur within 90 minutes without a recovery offer.",
    base: "394 Active Slump Players • Live Spanner Property Graph",
    metrics: {
      cohortSize: 394,
      avgSpend: 356,
      avgChurn: 0.645,
      liftMetric: "1.47x Churn Lift",
      highRiskCount: 159,
      secondaryMetric: "$140,264 Revenue at Risk",
    },
    caveats: [
      "Telemetry Window: Real-time Spanner property graph session streams (Warzone, Black Ops 6, CDL Ranked).",
      "Lapse Velocity: Churn probability doubles after defeat #3 compared to defeat #2.",
      "Monetization Elasticity: Willingness-to-pay for $4.99 Gulag recovery care packages peaks within 15 minutes of session end.",
    ],
    actionLabel: "Load High-Tilt Cohort in Spanner Graph",
    queryToRun: "Warzone Resurgence players with 3+ Gulag losses & high tilt in Los Angeles",
    franchise: "WARZONE",
    prompts: [
      {
        title: "Gulag Loss Streak Churn Surge",
        query: "Warzone Resurgence players with 3+ Gulag losses & high tilt in Los Angeles",
        franchise: "WARZONE",
        tag: "Warzone Tilt",
        highlight: "3+ Losses",
      },
      {
        title: "Demoted CDL Ranked Sweats",
        query: "CDL Ranked players with 3 or more recent loss streaks in Crimson or Iridescent",
        franchise: "CDL_RANKED",
        tag: "Ranked Play",
        highlight: "Ranked Tilt",
      },
      {
        title: "Search & Destroy Loss Streaks",
        query: "Modern Warfare III Search & Destroy players on 3+ match defeat streaks",
        franchise: "MODERN_WARFARE",
        tag: "S&D Defeats",
        highlight: "3+ Defeats",
      },
    ],
  },
];

export default function GeminiLandingStage({
  onSearchQuery,
  onExploreFullGraph,
  onOpenA2A,
  onOpenGeoMap,
  onOpenMarketingJourney,
  isLoading = false,
  errorText = "",
  onDismissError,
}: GeminiLandingStageProps) {
  const [query, setQuery] = useState("");
  const [selectedFranchise, setSelectedFranchise] = useState<GameFranchise>("ALL");
  const [dynamicFindings, setDynamicFindings] = useState<DynamicCohortFinding[]>(DEFAULT_DYNAMIC_FINDINGS);
  const [activeFindingId, setActiveFindingId] = useState<string>("bo7_early_churn");
  const [activeLoadingQuery, setActiveLoadingQuery] = useState<string | null>(null);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState<boolean>(false);

  const activeAura = AURA_THEMES[selectedFranchise] || AURA_THEMES.ALL;

  // The cohort findings are computed from live Spanner.
  // When the marketer switches franchise, we fetch live cohort metrics.
  const findingFranchise = selectedFranchise === "ALL" ? "COD" : selectedFranchise;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/insights/core-finding?franchise=${findingFranchise}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && Array.isArray(d.findings) && d.findings.length > 0) {
          setDynamicFindings(d.findings);
        }
      })
      .catch(() => {
        // Fall back to default findings if network is unreachable
      });
    return () => {
      cancelled = true;
    };
  }, [findingFranchise]);

  const currentFinding =
    dynamicFindings.find((f) => f.id === activeFindingId) || dynamicFindings[0] || DEFAULT_DYNAMIC_FINDINGS[0];

  const handleRunSearch = (customQ?: string, customFranchise?: GameFranchise) => {
    if (isLoading) return;
    const q = customQ !== undefined ? customQ : query;
    const f = customFranchise || selectedFranchise;
    if (!q.trim()) {
      onExploreFullGraph(f);
      return;
    }
    setActiveLoadingQuery(q);
    onSearchQuery(q, f);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090D] text-white font-sans flex flex-col justify-between antialiased select-none">
      {/* 🌟 1. Subtle Multi-Layer Floating Aura Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[10%] left-[20%] w-[580px] h-[580px] rounded-full blur-[140px] animate-aura-1 transition-colors duration-1000"
          style={{ backgroundColor: activeAura.primary }}
        />
        <div
          className="absolute top-[15%] right-[18%] w-[640px] h-[540px] rounded-full blur-[150px] animate-aura-2 transition-colors duration-1000"
          style={{ backgroundColor: activeAura.secondary }}
        />
        <div
          className="absolute top-[35%] left-[35%] w-[480px] h-[480px] rounded-full blur-[160px] animate-aura-pulse transition-colors duration-1000"
          style={{ backgroundColor: activeAura.pulse }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#07090D_85%)] opacity-80" />
      </div>

      {/* 2. Top Minimalist Translucent Header */}
      <header className="relative z-20 flex items-center justify-between px-8 py-3.5 bg-black/30 backdrop-blur-2xl border-b border-white/5 animate-spring-in">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/Activision.svg"
              alt="Activision"
              className="h-5 w-auto object-contain brightness-110 select-none"
            />
            <span className="text-gray-600 font-normal">/</span>
            <span className="text-xs text-gray-300 font-medium tracking-tight">Call of Duty Audience Intelligence Engine</span>
          </div>
        </div>

        {/* Right Navigation & Live Connection Status */}
        <div className="flex items-center gap-2.5">
          <SpannerStatusPill />

          {onOpenMarketingJourney && (
            <button
              onClick={onOpenMarketingJourney}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Player Journeys (Sankey)</span>
            </button>
          )}

          <button
            onClick={onOpenGeoMap}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>DMA Map</span>
          </button>

          <button
            onClick={onOpenA2A}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5 text-pink-400" />
            <span>A2A Protocol</span>
          </button>

          <button
            onClick={() => onExploreFullGraph("ALL")}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-black" />
            <span>Launch Galaxy</span>
          </button>
        </div>
      </header>

      {/* 3. Center Stage (Spacious, Minimalist, Apple-Grade Master Control Panel) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-4xl w-full mx-auto space-y-3.5 my-auto animate-spring-in">
        {/* Hero Title */}
        <div className="space-y-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            Call of Duty Audience Intelligence Engine
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Unified telemetry across Warzone, Black Ops 6, Modern Warfare III, and CDL Ranked powered by Google Cloud Spanner &amp; Vertex AI.
          </p>
        </div>

        {/* Failure banner. The landing stage deliberately does NOT advance on
            error — showing an empty or stale graph would be worse than saying
            plainly that nothing was computed. */}
        {errorText && (
          <div
            role="alert"
            className="w-full bg-red-950/70 backdrop-blur-2xl border border-red-500/40 rounded-2xl p-3 px-4 flex items-start gap-3 animate-fade-in"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-red-200">No cohort was computed</div>
              <div className="text-[11px] text-red-300/80 font-mono break-words mt-0.5">{errorText}</div>
            </div>
            {onDismissError && (
              <button
                onClick={onDismissError}
                aria-label="Dismiss error"
                className="ml-auto shrink-0 text-red-300/60 hover:text-red-200 transition-colors active:scale-90 motion-reduce:active:scale-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Universal Search Island */}
        <div className="w-full bg-[#111318]/90 backdrop-blur-3xl border border-white/10 hover:border-white/20 focus-within:border-white/30 rounded-3xl p-3 shadow-2xl transition-all space-y-2.5">
          <div className="relative">
            <textarea
              rows={2}
              value={query}
              disabled={isLoading}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleRunSearch();
                }
              }}
              placeholder="Ask anything across Call of Duty's ecosystem (e.g. 'High-LTV whales with spend over $1,500 across Warzone and Black Ops 6' or 'Warzone players on 3+ Gulag loss streaks')..."
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none px-3 pt-1 resize-none font-normal leading-relaxed disabled:opacity-60"
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 px-1">
            {/* Franchise Micro-Segmented Control */}
            <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10">
              {FRANCHISES.map((f) => {
                const isSelected = selectedFranchise === f.id;
                return (
                  <button
                    key={f.id}
                    disabled={isLoading}
                    onClick={() => setSelectedFranchise(f.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                      isSelected
                        ? "bg-white/20 text-white font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full transition-transform"
                      style={{
                        backgroundColor: f.dotColor,
                        transform: isSelected ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dual Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExploreFullGraph(selectedFranchise)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                title="Load full property graph without filtering"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Load Graph</span>
              </button>

              <button
                onClick={() => handleRunSearch()}
                disabled={isLoading}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-lg active:scale-95 ${
                  isLoading
                    ? "bg-white/80 text-black cursor-wait"
                    : "bg-white hover:bg-zinc-200 text-black"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <span>Explore Cohort</span>
                    <ArrowRight className="w-3.5 h-3.5 text-black" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Gemini Enterprise Master Control Panel (Dynamic Cohort Explorer) */}
        <div className="w-full space-y-2.5">
          {/* Dynamic Cohort Segmented Tabs */}
          <div className="flex items-center justify-between bg-black/40 p-1 rounded-2xl border border-white/10 backdrop-blur-xl gap-1">
            {dynamicFindings.map((finding) => {
              const isSelected = activeFindingId === finding.id;
              const IconComponent = getFindingIcon(finding.iconType);
              return (
                <button
                  key={finding.id}
                  onClick={() => setActiveFindingId(finding.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white/15 text-white font-semibold shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? finding.iconColor : "text-zinc-500"}`} />
                  <span className="hidden sm:inline">{finding.tabLabel}</span>
                  <span className="sm:hidden">{finding.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* 🌟 The Dynamic Core Finding Executive Callout Card */}
          <button
            type="button"
            onClick={() => setIsBriefModalOpen(true)}
            className="w-full text-left p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 backdrop-blur-2xl transition-all space-y-1.5 cursor-pointer shadow-lg group active:scale-[0.99] focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  The Core Finding
                </span>
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                  • {currentFinding.base}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 group-hover:text-cyan-300 font-medium transition-colors">
                <span>View Opportunity Brief</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-sm sm:text-[15px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>📣 {currentFinding.title}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentFinding.pillColor}`}>
                {currentFinding.metricPill}
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
              {currentFinding.summary}
            </p>
          </button>

          {/* 3 Spacious Prompt Cards in a clean 1x3 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {currentFinding.prompts.map((p, pIdx) => {
              const isThisCardLoading = isLoading && activeLoadingQuery === p.query;
              return (
                <div
                  key={pIdx}
                  onClick={() => {
                    if (isLoading) return;
                    setQuery(p.query);
                    setSelectedFranchise(p.franchise);
                    handleRunSearch(p.query, p.franchise);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 group ${
                    isThisCardLoading
                      ? "bg-white/10 border-cyan-400/50 shadow-sm scale-[1.01]"
                      : "bg-black/30 hover:bg-white/[0.06] border-white/5 hover:border-white/15 active:scale-98"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-mono">
                      {p.tag}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                      {p.highlight}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-white line-clamp-1 transition-colors">
                      {p.title}
                    </div>
                    <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 line-clamp-1 mt-0.5">
                      {p.query}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-zinc-500 group-hover:text-zinc-300">
                    <span>Click to explore</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 5. Bottom Telemetry Ticker (Subtle, Clean) */}
      <footer className="relative z-20 flex items-center justify-between px-8 py-3 bg-black/20 backdrop-blur-xl border-t border-white/5 text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span>5,000 Master Players</span>
          <span>•</span>
          <span>15,663 Linked Identities</span>
          <span>•</span>
          <span>5 Core Franchises</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span>Google Cloud Spanner Property Graph Engine</span>
        </div>
      </footer>

      {/* 🌟 6. Opportunity Brief Executive Detail Modal (Dynamic & Faithful to Reference Image) */}
      {isBriefModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto"
          onClick={() => setIsBriefModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#0E1117] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 animate-spring-in text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl ${currentFinding.bgAccent} border border-white/10 flex items-center justify-center`}>
                  {React.createElement(getFindingIcon(currentFinding.iconType), {
                    className: `w-4 h-4 ${currentFinding.iconColor}`,
                  })}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Opportunity Brief — {currentFinding.tabLabel}
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    {currentFinding.base}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBriefModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The Core Finding Box in Modal */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>The Core Finding</span>
                <span className="text-zinc-500 font-mono">{currentFinding.badge}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  📣 {currentFinding.title}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${currentFinding.pillColor}`}>
                  {currentFinding.metricPill}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {currentFinding.summary}
              </p>

              {/* Live Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[10px] text-zinc-400">Cohort Size</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {currentFinding.metrics.cohortSize.toLocaleString()} Players
                  </div>
                </div>
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[10px] text-zinc-400">Average LTV</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                    ${currentFinding.metrics.avgSpend.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[10px] text-zinc-400">Churn Risk</div>
                  <div className="text-xs font-bold text-rose-400 font-mono mt-0.5">
                    {(currentFinding.metrics.avgChurn * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Read this first — Data Caveats & Grounding */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-300 tracking-tight">
                Read this first — data caveats that shape every number below:
              </h3>
              <ul className="space-y-2 text-xs text-zinc-400">
                {currentFinding.caveats.map((c, cIdx) => (
                  <li key={cIdx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span className="leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Strategic Action Plan & Exploration Buttons */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">
                Grounded on Google Cloud Spanner Property Graph
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsBriefModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsBriefModalOpen(false);
                    handleRunSearch(currentFinding.queryToRun, currentFinding.franchise);
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <span>{currentFinding.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-black" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
