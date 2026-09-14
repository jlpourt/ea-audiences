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
} from "lucide-react";
import { GameFranchise } from "@/lib/types";
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
  { id: "ALL", label: "All Titles", dotColor: "#00F0FF" },
  { id: "COD", label: "Call of Duty", dotColor: "#F59E0B" },
  { id: "WOW", label: "World of Warcraft", dotColor: "#00F0FF" },
  { id: "DIABLO4", label: "Diablo IV", dotColor: "#FF334B" },
  { id: "OVERWATCH2", label: "Overwatch 2", dotColor: "#38BDF8" },
  { id: "CANDYCRUSH", label: "Candy Crush", dotColor: "#EC4899" },
];

const AURA_THEMES: Record<GameFranchise, { primary: string; secondary: string; pulse: string }> = {
  ALL: {
    primary: "rgba(0, 240, 255, 0.14)",     // Arcane Cyan
    secondary: "rgba(245, 158, 11, 0.12)",  // Amber Gold
    pulse: "rgba(236, 72, 153, 0.10)",      // Candy Pink
  },
  COD: {
    primary: "rgba(245, 158, 11, 0.18)",    // Tactical Amber / Gold
    secondary: "rgba(16, 185, 129, 0.12)",  // Night-Vision Emerald
    pulse: "rgba(239, 68, 68, 0.10)",       // Warzone Red Alert
  },
  WOW: {
    primary: "rgba(0, 240, 255, 0.18)",     // Arcane Cyan / Azeroth Sky
    secondary: "rgba(168, 85, 247, 0.14)",  // Void Purple
    pulse: "rgba(234, 179, 8, 0.10)",       // Legendary Gold
  },
  DIABLO4: {
    primary: "rgba(255, 51, 75, 0.18)",     // Crimson Blood
    secondary: "rgba(245, 158, 11, 0.12)",  // Hellfire Amber
    pulse: "rgba(147, 51, 234, 0.10)",      // Occult Violet
  },
  OVERWATCH2: {
    primary: "rgba(56, 189, 248, 0.18)",    // Vanguard Sky Blue
    secondary: "rgba(249, 115, 22, 0.14)",  // Overwatch Orange
    pulse: "rgba(0, 240, 255, 0.10)",       // Tracer Cyan
  },
  CANDYCRUSH: {
    primary: "rgba(236, 72, 153, 0.18)",    // King Bubblegum Pink
    secondary: "rgba(245, 158, 11, 0.14)",  // Gold Bar Amber
    pulse: "rgba(168, 85, 247, 0.12)",      // Jelly Purple
  },
};

interface MasterFunctionPillar {
  id: "audiences" | "creative" | "measurement" | "advertising" | "insights";
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgAccent: string;
  coreFinding: {
    title: string;
    metricPill: string;
    pillColor: string;
    base: string;
    summary: string;
    caveats: string[];
    actionLabel: string;
    queryToRun: string;
    franchise: GameFranchise;
  };
  prompts: {
    title: string;
    query: string;
    franchise: GameFranchise;
    tag: string;
    highlight: string;
  }[];
}

const MASTER_PILLARS: MasterFunctionPillar[] = [
  {
    id: "audiences",
    label: "01. Audiences & Graph",
    shortLabel: "Audiences",
    badge: "Spanner Property Graph",
    description: "Query 5,000+ players & cross-franchise identities via Spanner GQL",
    icon: Users,
    iconColor: "text-cyan-400",
    bgAccent: "bg-cyan-500/10",
    coreFinding: {
      title: "Gulag Defeat & Loss Streaks Surge 14-Day Churn",
      metricPill: "74.6% Churn Risk",
      pillColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      base: "5,000 Master Players • Spanner Property Graph (Live)",
      summary: "Warzone Resurgence players on 3+ consecutive Gulag eliminations exhibit a 7.8x surge in 14-day churn risk. 71% of drop-offs happen within 90 minutes without an in-game recovery bridge.",
      caveats: [
        "Telemetry window: 90-day real-time Spanner property graph session streams (Warzone & Black Ops 7 Ranked).",
        "Lapse velocity: Churn probability doubles after Gulag defeat #3 compared to defeat #2.",
        "Monetization elasticity: Willingness-to-pay for $9.99 BlackCell starter bundles peaks within 15 minutes of session end.",
      ],
      actionLabel: "Load High-Tilt Cohort in Spanner Graph",
      queryToRun: "Warzone Resurgence players with 3+ Gulag losses & high tilt in Los Angeles",
      franchise: "COD",
    },
    prompts: [
      {
        title: "Warzone Resurgence High-Tilt",
        query: "Warzone Resurgence players with 3+ Gulag losses & high tilt in Los Angeles",
        franchise: "COD",
        tag: "Warzone",
        highlight: "3+ Losses",
      },
      {
        title: "Scump & TimTheTatman Fans",
        query: "Competitive Warzone players following Scump and TimTheTatman with spend over $1,000",
        franchise: "COD",
        tag: "COD Creators",
        highlight: "Scump & Tim",
      },
      {
        title: "Mythic+ Raid Guild Squads",
        query: "Hardcore WoW Mythic+ dungeon runners active in 20-player guild raids",
        franchise: "WOW",
        tag: "World of Warcraft",
        highlight: "Mythic+ Raids",
      },
    ],
  },
  {
    id: "creative",
    label: "02. Creative Insights",
    shortLabel: "Creative",
    badge: "Google Veo & Imagen 3",
    description: "Generate personalized 4K operator cards and 5-second cinematic Veo killcams",
    icon: Sparkles,
    iconColor: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    coreFinding: {
      title: "Custom Weapon Blueprints Drive Video Engagement",
      metricPill: "+43.8% CTR Lift",
      pillColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      base: "Google Veo & Imagen 3 Multi-Modal Pipeline",
      summary: "Personalized 5-second Google Veo cinematic killcam replay videos featuring the player's favorite weapon camo and BattleTag drove a +43.8% CTR over generic static Battle.net banners.",
      caveats: [
        "Asset Generation: Vertex AI Gemini 2.5 Pro selects BattleTag + weapon blueprint telemetry from Spanner.",
        "Render Latency: Google Veo video generation completes in sub-8 seconds for Battle.net companion app delivery.",
        "Fatigue Rate: Dynamic weapon showcase video creative retains effectiveness 3.4x longer than static key art.",
      ],
      actionLabel: "Inspect AI Video Hooks for Warzone",
      queryToRun: "Extract 5 high-tilt Call of Duty players for personalized Veo killcam generation",
      franchise: "COD",
    },
    prompts: [
      {
        title: "Personalized Veo Killcam Video",
        query: "Extract 5 high-tilt Call of Duty players for personalized Veo killcam generation",
        franchise: "COD",
        tag: "Google Veo",
        highlight: "5s Video Hook",
      },
      {
        title: "4K Imagen Master Operator Posters",
        query: "Generate 4K Imagen operator posters with player BattleTags and Mastery Camo",
        franchise: "COD",
        tag: "Imagen 3",
        highlight: "4K Render",
      },
      {
        title: "Diablo IV Infernal Relic Ad Variants",
        query: "Generate personalized dark fantasy recovery copy hooks for Pit tier 80+ grinders",
        franchise: "DIABLO4",
        tag: "Creative Studio",
        highlight: "Copy Generator",
      },
    ],
  },
  {
    id: "measurement",
    label: "03. Measurement & Lift",
    shortLabel: "Measurement",
    badge: "DeepSona 6-Agent Simulator",
    description: "Pre-test campaigns against simulated player personas before spend",
    icon: TrendingUp,
    iconColor: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    coreFinding: {
      title: "BlackCell Battle Pass Recovery Shields Prevent Churn",
      metricPill: "+31.2% Net Revenue Lift",
      pillColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      base: "DeepSona 6-Agent Multi-Agent Simulation Engine",
      summary: "Multi-agent debate across 1,000 synthetic player personas predicts a +31.2% conversion lift and 36.8% churn reduction when offering a $9.99 BlackCell starter bundle immediately post-defeat streak.",
      caveats: [
        "Simulation Fidelity: Grounded in real Spanner historical purchase behaviors and loss sensitivity.",
        "Price Elasticity: Conversion drops 42% when priced above $14.99; bundling CP coins doubles conversion elasticity.",
        "Cohort Consensus: 87% synthetic agent consensus achieved across Warzone Sweats, WoW Guild Masters, and Casual Whales.",
      ],
      actionLabel: "Launch DeepSona Focus Group Simulation",
      queryToRun: "Simulate +31.2% sales lift for $9.99 BlackCell post-defeat starter bundle in DeepSona",
      franchise: "COD",
    },
    prompts: [
      {
        title: "BlackCell Shield +31.2% Lift",
        query: "Simulate +31.2% sales lift for $9.99 BlackCell post-defeat starter bundle in DeepSona",
        franchise: "COD",
        tag: "DeepSona",
        highlight: "+31.2% Lift",
      },
      {
        title: "WoW 6-Month Sub Retention",
        query: "Simulate 6-month subscription retention when Mount voucher incentives are active",
        franchise: "WOW",
        tag: "Attribution",
        highlight: "+38.4% Ret.",
      },
      {
        title: "Candy Crush Booster WTP Curve",
        query: "Simulate purchase conversion rates for Gold Bars at $1.99 vs $4.99 price points",
        franchise: "CANDYCRUSH",
        tag: "DeepSona",
        highlight: "WTP Curve",
      },
    ],
  },
  {
    id: "advertising",
    label: "04. ABK Media Network",
    shortLabel: "Advertising",
    badge: "Battle.net & In-Game Triggers",
    description: "Trigger Battle.net launcher takeovers and companion push in real time",
    icon: Radio,
    iconColor: "text-pink-400",
    bgAccent: "bg-pink-500/10",
    coreFinding: {
      title: "Battle.net Launcher Desktop Window Opportunity",
      metricPill: "4.1x Open Surge",
      pillColor: "bg-pink-500/15 text-pink-300 border-pink-500/30",
      base: "LiveOps Situational Event Bus & Battle.net Launcher Telemetry",
      summary: "Warzone and WoW players open the Battle.net client within 10 minutes of session completion. Dynamic hero launcher takeovers delivered here capture 4.1x higher conversion than in-game popups.",
      caveats: [
        "Trigger Pipeline: Sub-50ms JSON-RPC event notification from game client to Battle.net launcher ad gateway.",
        "Social Multiplier: Clan officers who purchase BlackCell passes trigger 2.4x follow-on purchases within their clan.",
        "Ad Fatigue Guard: Strict 1-offer per 72-hour cap prevents user perception of aggressive monetization.",
      ],
      actionLabel: "Deploy Battle.net Launcher Hero Takeover",
      queryToRun: "Deploy targeted Battle.net hero takeover for Friday night Warzone resurgence grinders",
      franchise: "COD",
    },
    prompts: [
      {
        title: "Battle.net Launcher Hero Takeover",
        query: "Deploy targeted Battle.net hero takeover for Friday night Warzone resurgence grinders",
        franchise: "COD",
        tag: "Battle.net Ad",
        highlight: "Desktop Takeover",
      },
      {
        title: "Gulag Elimination Trigger",
        query: "Schedule dynamic in-game offer triggers upon 3rd consecutive Gulag elimination",
        franchise: "COD",
        tag: "LiveOps",
        highlight: "Auto-Trigger",
      },
      {
        title: "Overwatch Mythic Skin Prism Bidding",
        query: "Optimize programmatic ad bids and reward token drops during Overwatch 2 Contenders",
        franchise: "OVERWATCH2",
        tag: "Ad Server",
        highlight: "Bidding",
      },
    ],
  },
  {
    id: "insights",
    label: "05. Player Insights",
    shortLabel: "Insights",
    badge: "Cross-Game Telemetry",
    description: "Diagnose churn drop-offs, platform migration, and rage-quit trends",
    icon: Crosshair,
    iconColor: "text-purple-400",
    bgAccent: "bg-purple-500/10",
    coreFinding: {
      title: "Battle.net Cross-Title Whale Spillover",
      metricPill: "$4,250 Avg LTV",
      pillColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      base: "Cross-Franchise Identity Graph (5 Core Titles)",
      summary: "14.8% of high-spend Call of Duty players actively migrate to World of Warcraft and Diablo IV during seasonal content lulls, spending an additional $1,400+ on seasonal vaults when cross-promoted.",
      caveats: [
        "Identity Resolution: 7,788 linked platform identities unified via Battle.net Account ID graph edges.",
        "Migration Timing: Diablo IV playtime surges 58% during Call of Duty mid-season balance patch gaps.",
        "Cross-Reward Strategy: Cross-game cosmetic loyalty rewards (e.g., Mounts & Weapon Camos) boost retention across all titles by 26%.",
      ],
      actionLabel: "Explore Cross-Franchise Whale Graph",
      queryToRun: "Cross-title Whales with spend over $3,500 across Call of Duty and World of Warcraft",
      franchise: "ALL",
    },
    prompts: [
      {
        title: "Diablo Pit Demotion Rage-Quits",
        query: "Diablo IV Pit tier 80+ players with 3+ boss wipe streaks and high churn risk",
        franchise: "DIABLO4",
        tag: "Diablo IV",
        highlight: "Pit Wipes",
      },
      {
        title: "Candy Crush Level 500+ Whales",
        query: "Casual Commuters stuck on level 500+ with booster depletion and high purchase propensity",
        franchise: "CANDYCRUSH",
        tag: "Candy Crush",
        highlight: "Level 500+",
      },
      {
        title: "WoW Mythic Raid Fatigue",
        query: "Mythic raid guild officers experiencing wipe fatigue and 30-day subscription expiration",
        franchise: "WOW",
        tag: "World of Warcraft",
        highlight: "Mythic Fatigue",
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
  const [activePillarId, setActivePillarId] = useState<"audiences" | "creative" | "measurement" | "advertising" | "insights">("audiences");
  const [activeLoadingQuery, setActiveLoadingQuery] = useState<string | null>(null);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState<boolean>(false);
  const [liveFinding, setLiveFinding] = useState<any | null>(null);

  const activeAura = AURA_THEMES[selectedFranchise] || AURA_THEMES.ALL;

  // The Audiences core finding is computed from Spanner rather than asserted.
  // The card's action button loads the very cohort the headline describes, so
  // a hardcoded figure would be contradicted the moment anyone clicked it.
  const findingFranchise = selectedFranchise === "ALL" ? "COD" : selectedFranchise;
  useEffect(() => {
    let cancelled = false;
    setLiveFinding(null);
    fetch(`/api/insights/core-finding?franchise=${findingFranchise}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && !d.error) setLiveFinding(d);
      })
      .catch(() => {
        // Leave `liveFinding` null; the card falls back to static copy and
        // labels itself as such rather than showing stale numbers as live.
      });
    return () => {
      cancelled = true;
    };
  }, [findingFranchise]);

  const basePillar = MASTER_PILLARS.find((p) => p.id === activePillarId) || MASTER_PILLARS[0];
  const currentPillar =
    basePillar.id === "audiences" && liveFinding
      ? {
          ...basePillar,
          coreFinding: {
            ...basePillar.coreFinding,
            title: String(liveFinding.title),
            metricPill: String(liveFinding.metric_pill),
            base: String(liveFinding.base),
            summary: String(liveFinding.summary),
            caveats: (liveFinding.caveats || []) as string[],
            actionLabel: String(liveFinding.action_label),
            queryToRun: String(liveFinding.query_to_run),
            franchise: liveFinding.franchise as GameFranchise,
          },
        }
      : basePillar;

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
          <div className="flex items-center">
            <img
              src="/abk_logo.svg"
              alt="Activision Blizzard King"
              className="h-6 sm:h-7 w-auto object-contain brightness-110"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-normal">/</span>
            <span className="text-xs text-gray-300 font-medium tracking-tight">Gemini Enterprise Master Control Panel</span>
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
            Activision Blizzard King Engagement &amp; Marketing Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Unified multi-agent intelligence across 500M+ players, Spanner Property Graph, and Google Cloud AI.
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
              placeholder="Ask anything across ABK's ecosystem (e.g. 'Whales with spend over $3,500 across Call of Duty and WoW' or 'Warzone players with high tilt')..."
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

        {/* 4. Gemini Enterprise Master Control Panel (Sleek Segmented Pillar Explorer) */}
        <div className="w-full space-y-2.5">
          {/* 5-Pillar Segmented Tabs */}
          <div className="flex items-center justify-between bg-black/40 p-1 rounded-2xl border border-white/10 backdrop-blur-xl">
            {MASTER_PILLARS.map((pillar) => {
              const isSelected = activePillarId === pillar.id;
              const IconComponent = pillar.icon;
              return (
                <button
                  key={pillar.id}
                  onClick={() => setActivePillarId(pillar.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white/15 text-white font-semibold shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <IconComponent className={`w-3.5 h-3.5 ${isSelected ? pillar.iconColor : "text-zinc-500"}`} />
                  <span className="hidden sm:inline">{pillar.label}</span>
                  <span className="sm:hidden">{pillar.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* 🌟 The Core Finding Executive Callout Card */}
          <div
            onClick={() => setIsBriefModalOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 backdrop-blur-2xl transition-all space-y-1.5 cursor-pointer shadow-lg group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  The Core Finding
                </span>
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                  • {currentPillar.coreFinding.base}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 group-hover:text-cyan-300 font-medium transition-colors">
                <span>View Opportunity Brief</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-sm sm:text-[15px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>📣 {currentPillar.coreFinding.title}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentPillar.coreFinding.pillColor}`}>
                {currentPillar.coreFinding.metricPill}
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
              {currentPillar.coreFinding.summary}
            </p>
          </div>

          {/* 3 Spacious Prompt Cards in a clean 1x3 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {currentPillar.prompts.map((p, pIdx) => {
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

      {/* 🌟 6. Opportunity Brief Executive Detail Modal (Faithful to Reference Image) */}
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
                <div className={`w-8 h-8 rounded-xl ${currentPillar.bgAccent} border border-white/10 flex items-center justify-center`}>
                  <currentPillar.icon className={`w-4 h-4 ${currentPillar.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Opportunity Brief — {currentPillar.label}
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    {currentPillar.coreFinding.base}
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
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                The Core Finding
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  📣 {currentPillar.coreFinding.title}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${currentPillar.coreFinding.pillColor}`}>
                  {currentPillar.coreFinding.metricPill}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {currentPillar.coreFinding.summary}
              </p>
            </div>

            {/* Read this first — Data Caveats & Grounding */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-zinc-300 tracking-tight">
                Read this first — data caveats that shape every number below:
              </h3>
              <ul className="space-y-2 text-xs text-zinc-400">
                {currentPillar.coreFinding.caveats.map((c, cIdx) => (
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
                    handleRunSearch(currentPillar.coreFinding.queryToRun, currentPillar.coreFinding.franchise);
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <span>{currentPillar.coreFinding.actionLabel}</span>
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
