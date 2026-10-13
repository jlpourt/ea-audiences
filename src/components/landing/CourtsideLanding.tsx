"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  ArrowRight,
  Globe,
  Radio,
  Database,
  TrendingUp,
  Flame,
  Layers,
  Shield,
  Loader2,
  Users,
  ExternalLink,
  X,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { GameFranchise, DynamicCohortFinding } from "@/lib/types";
import type { ConditionChip } from "@/components/audience/AudienceBuilder";
import SpannerStatusPill from "@/components/common/SpannerStatusPill";

export interface CourtsideLandingProps {
  onSearchQuery?: (query: string, game: GameFranchise) => void;
  onExploreFullGraph?: (game: GameFranchise) => void;
  onOpenA2A?: () => void;
  onOpenGeoMap?: () => void;
  onOpenMarketingJourney?: () => void;
  isLoading?: boolean;
  errorText?: string;
  onDismissError?: () => void;

  // Legacy / extended props for full compatibility with page.tsx
  selectedGame?: GameFranchise;
  onGameChange?: (game: GameFranchise) => void;
  onRunBuilderQuery?: (
    query: string,
    franchise: GameFranchise,
    excludeConditionIds?: string[]
  ) => void;
  onLaunchPlay?: (
    playNumber: 1 | 2 | 3,
    query: string,
    franchise: GameFranchise,
    offerPreset: { title: string; priceUsd: number; altPriceUsd?: number }
  ) => void;
  onOpenWorkspaceView?: (
    view:
      | "audience-cohorts"
      | "cross-franchise"
      | "social-clans"
      | "marketing-journey"
      | "geo-map"
  ) => void;
  onOpenSavedAudiences?: () => void;
  onOpenActivationFeed?: () => void;
  onOpenFocusGroup?: () => void;
  onSaveAudience?: () => void;
  isSearching?: boolean;
  matchedCount?: number;
  renderedCount?: number;
  executionMs?: number;
  translateMs?: number;
  modelUsed?: string;
  generatedGql?: string;
  whereClause?: string;
  matchPattern?: string;
  conditions?: ConditionChip[];
  errorMessage?: string | null;
}

const FRANCHISES: { id: GameFranchise; label: string; dotColor: string }[] = [
  { id: "ALL", label: "All 2K", dotColor: "#E4002B" },
  { id: "NBA2K", label: "NBA 2K27", dotColor: "#E4002B" },
  { id: "NBA2K26", label: "NBA 2K26", dotColor: "#FF6B35" },
  { id: "NBA2KMOBILE", label: "NBA 2K Mobile", dotColor: "#00D2FF" },
  { id: "WWE2K", label: "WWE & PGA 2K", dotColor: "#F5B400" },
  { id: "BL4", label: "Borderlands & Civ VII", dotColor: "#F28C28" },
];

const AURA_THEMES: Record<
  GameFranchise,
  { primary: string; secondary: string; pulse: string }
> = {
  ALL: {
    primary: "rgba(228, 0, 43, 0.18)", // 2K Crimson #E4002B
    secondary: "rgba(0, 210, 255, 0.13)", // Cyan #00D2FF
    pulse: "rgba(245, 180, 0, 0.10)", // VC Gold #F5B400
  },
  NBA2K: {
    primary: "rgba(228, 0, 43, 0.20)", // 2K Crimson #E4002B
    secondary: "rgba(245, 180, 0, 0.15)", // Championship Gold #F5B400
    pulse: "rgba(25, 195, 125, 0.10)", // Court Emerald
  },
  NBA2K26: {
    primary: "rgba(255, 107, 53, 0.20)", // Veteran Amber #FF6B35
    secondary: "rgba(228, 0, 43, 0.15)", // 2K Crimson #E4002B
    pulse: "rgba(245, 180, 0, 0.11)", // Loyalty Gold
  },
  NBA2KMOBILE: {
    primary: "rgba(0, 210, 255, 0.19)", // Electric Cyan #00D2FF
    secondary: "rgba(59, 130, 246, 0.15)", // Mobile Blue #3B82F6
    pulse: "rgba(228, 0, 43, 0.10)", // 2K Accent
  },
  WWE2K: {
    primary: "rgba(245, 180, 0, 0.19)", // Championship Gold #F5B400
    secondary: "rgba(16, 185, 129, 0.15)", // PGA Emerald #10B981
    pulse: "rgba(228, 0, 43, 0.10)", // 2K Sports Red
  },
  PGA2K: {
    primary: "rgba(16, 185, 129, 0.19)",
    secondary: "rgba(245, 180, 0, 0.14)",
    pulse: "rgba(0, 210, 255, 0.10)",
  },
  TOPSPIN: {
    primary: "rgba(31, 168, 160, 0.19)",
    secondary: "rgba(245, 180, 0, 0.14)",
    pulse: "rgba(228, 0, 43, 0.10)",
  },
  BL4: {
    primary: "rgba(242, 140, 40, 0.20)", // Borderlands Orange #F28C28
    secondary: "rgba(168, 85, 247, 0.15)", // Siren Violet #A855F7
    pulse: "rgba(0, 210, 255, 0.11)", // Vault Cyan
  },
  CIV7: {
    primary: "rgba(242, 140, 40, 0.18)",
    secondary: "rgba(168, 85, 247, 0.14)",
    pulse: "rgba(245, 180, 0, 0.11)",
  },
  MAFIA: {
    primary: "rgba(242, 140, 40, 0.18)",
    secondary: "rgba(228, 0, 43, 0.14)",
    pulse: "rgba(168, 85, 247, 0.10)",
  },
};

const getFindingIcon = (iconType: string) => {
  switch (iconType) {
    case "shield":
      return Shield;
    case "creator":
    case "sparkles":
      return Award;
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

const PROMPT_SPECS: Record<string, string> = {
  "NBA 2K26 → 2K27 Holdout Veterans": "$150+ spend · Active 2K27 Crew",
  "92+ OVR NBA 2K26 Park Grinders": "$200+ spend · 92+ OVR builds",
  "2K26 Crew Captains Bridging to 2K27": "Rec & Pro-Am squad captains",
  "Season 2 Build Cliff · Active Crew Mates": "<85 OVR · $50+ VC · 7d lapsed",
  "Park Loss Streak & Rage-Quit Risk": "3+ Park losses · High tilt risk",
  "Build Lab Theorycrafters Below 85 OVR": "Sub-85 OVR · Unspent VC balance",
  "MyTEAM Galaxy Opal Whales (HoF Pass)": "10+ Galaxy Opals · HoF Pass",
  "High-Velocity VC Vault Holders": "$500+ LTV · 50,000+ VC balance",
  "NBA 2K Mobile Daily Pack Ritualists": "Mobile + Console MyTEAM sync",
  "NBA 2K27 + WWE 2K25 & PGA TOUR 2K25 Bridge": "NBA 2K27 · WWE 2K25 · PGA 2K25",
  "Borderlands 4 & Civilization VII Cross-Play": "2K Account · BL4 & Civ VII",
  "MyNBA Sim GMs Playing Civilization VII": "MyNBA Era Sim + Civ VII",
  "Agent 00, Troydan & CashNasty Park/MyTEAM Halo": "Agent 00 · Troydan · CashNasty",
  "DBG, Tydebo & KOT4Q Build Lab Followers": "Meta build & MyNBA followers",
  "Moxsy & Assemble Cross-2K Creator Fans": "Borderlands 4 & WWE 2K creators",
};

const BRIEF_BULLET_LABELS = ["Why It Matters", "Recommended Play", "Expected Impact"];

const DEFAULT_DYNAMIC_FINDINGS: DynamicCohortFinding[] = [
  {
    id: "2k26-bridge",
    category: "cross_title",
    tabLabel: "01. 2K26 → 2K27 Bridge",
    shortLabel: "2K26 Bridge",
    badge: "3-Hop Upgrade Bridge",
    iconType: "cross_title",
    iconColor: "text-orange-400",
    bgAccent: "bg-orange-500/10",
    pillColor: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    metricPill: "418 Holdout Veterans",
    title: "418 NBA 2K26 Veterans Ready to Upgrade",
    summary:
      "High-spend NBA 2K26 veterans ($150+ VC, 90+ OVR) whose Crew mates already play NBA 2K27.",
    base: "418 NBA 2K26 Holdout Veterans · 2K Identity Graph",
    metrics: {
      cohortSize: 418,
      avgSpend: 342,
      avgChurn: 0.44,
      liftMetric: "+$9.5M-$55.0M Upgrade Lift",
      highRiskCount: 164,
      secondaryMetric: "$69.99 HoF Loyalty Upgrade + 100K VC",
    },
    caveats: [
      "418 high-spend NBA 2K26 veterans ($342 avg LTV) have 2+ Crew mates already active in NBA 2K27.",
      "Dispatch the $69.99 Hall of Fame Loyalty Upgrade + 100K VC + Carry-Over Cap Breakers via 2K Account.",
      "Converts at 3.1x baseline without discounting standard retail SKU margins.",
    ],
    actionLabel: "Explore Cohort in Graph",
    queryToRun:
      "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27",
    franchise: "NBA2K26",
    prompts: [
      {
        title: "NBA 2K26 → 2K27 Holdout Veterans",
        query:
          "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27",
        franchise: "NBA2K26",
        tag: "2K26 → 2K27 Bridge",
        highlight: "418 Veterans",
      },
      {
        title: "92+ OVR NBA 2K26 Park Grinders",
        query:
          "NBA 2K26 Park and Rec veterans with $200+ spend who haven't upgraded to NBA 2K27",
        franchise: "NBA2K26",
        tag: "HoF Upgrade",
        highlight: "$69.99 + 100K VC",
      },
      {
        title: "2K26 Crew Captains Bridging to 2K27",
        query:
          "NBA 2K26 players in active Crews where teammates already play NBA 2K27 Season 1",
        franchise: "NBA2K26",
        tag: "2-Hop Crew",
        highlight: "3.1x Conversion",
      },
    ],
  },
  {
    id: "season2-cliff",
    category: "churn_contagion",
    tabLabel: "02. Season 2 Build Cliff",
    shortLabel: "Season 2 Cliff",
    badge: "Season 2 Tip-Off Oct 16",
    iconType: "slump",
    iconColor: "text-rose-400",
    bgAccent: "bg-rose-500/10",
    pillColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    metricPill: "284 Stalled Builds",
    title: "284 Sub-85 Builds at Season 2 Cliff",
    summary:
      "Sub-85 OVR MyCAREER spenders inactive 7+ days whose Crew captains logged in within 72 hours.",
    base: "284 Stalled MyCAREER Builds · 2K Identity Graph",
    metrics: {
      cohortSize: 284,
      avgSpend: 218,
      avgChurn: 0.64,
      liftMetric: "+28.4% S2 Retention",
      highRiskCount: 284,
      secondaryMetric: "$4.99 Crew Re-Up Bundle",
    },
    caveats: [
      "Builds stalled at 78-84 OVR show 2.6x higher Season 2 churn risk when solo-queuing.",
      "Co-trigger the $4.99 Crew Re-Up Bundle (15,000 VC + 2x Crew REP) with a captain squad invite.",
      "Lifts 14-day Season 2 return rate by +28.4% across active Rec and Pro-Am Crews.",
    ],
    actionLabel: "Explore Cohort in Graph",
    queryToRun:
      "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
    franchise: "NBA2K",
    prompts: [
      {
        title: "Season 2 Build Cliff · Active Crew Mates",
        query:
          "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
        franchise: "NBA2K",
        tag: "2-Hop Crew",
        highlight: "284 Players",
      },
      {
        title: "Park Loss Streak & Rage-Quit Risk",
        query:
          "NBA 2K27 Park and Rec grinders on 3+ loss streaks with high rage-quit churn risk",
        franchise: "NBA2K",
        tag: "Tilt Recovery",
        highlight: "Loss Streak >= 3",
      },
      {
        title: "Build Lab Theorycrafters Below 85 OVR",
        query:
          "NBA 2K27 Build Lab theorycrafters below 85 OVR holding unspent VC balances",
        franchise: "NBA2K",
        tag: "Cap Breakers",
        highlight: "<85 OVR Builds",
      },
    ],
  },
  {
    id: "myteam-whales",
    category: "whale_spillover",
    tabLabel: "03. MyTEAM Opal Whales",
    shortLabel: "MyTEAM Whales",
    badge: "Hall of Fame Pass Collectors",
    iconType: "currency",
    iconColor: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    pillColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    metricPill: "196 HoF Whales",
    title: "196 MyTEAM Galaxy Opal Pack Whales",
    summary:
      "Hall of Fame Pass holders with 10+ Galaxy Opals ($1,420 avg LTV) primed for pack offers.",
    base: "196 MyTEAM Opal Whales · 2K Identity Graph",
    metrics: {
      cohortSize: 196,
      avgSpend: 1420,
      avgChurn: 0.24,
      liftMetric: "+$16.4M-$43.7M Pack Yield",
      highRiskCount: 34,
      secondaryMetric: "$14.99 vs $19.99 Offer Battle",
    },
    caveats: [
      "Top-decile MyTEAM collectors hold 10+ Galaxy Opals and average $1,420 lifetime spend.",
      "Pressure-test $14.99 vs $19.99 Galaxy Opal Deluxe Pack with guaranteed topper in Focus Group.",
      "68% also open packs on NBA 2K Mobile within 4 hours of Friday drops.",
    ],
    actionLabel: "Explore Cohort in Graph",
    queryToRun:
      "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
    franchise: "NBA2K",
    prompts: [
      {
        title: "MyTEAM Galaxy Opal Whales (HoF Pass)",
        query:
          "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
        franchise: "NBA2K",
        tag: "Offer Battle",
        highlight: "10+ Opals",
      },
      {
        title: "High-Velocity VC Vault Holders",
        query:
          "NBA 2K27 MyTEAM players with $500+ lifetime spend and 50,000+ unspent VC balance",
        franchise: "NBA2K",
        tag: "VC Treasury",
        highlight: "50K+ VC",
      },
      {
        title: "NBA 2K Mobile Daily Pack Ritualists",
        query:
          "NBA 2K Mobile daily ritualists linked to NBA 2K27 MyTEAM with high pack spend",
        franchise: "NBA2KMOBILE",
        tag: "Mobile Sync",
        highlight: "Daily Streak",
      },
    ],
  },
  {
    id: "2k-crossplay",
    category: "cross_title",
    tabLabel: "04. Multi-Title 2K Cross-Play",
    shortLabel: "2K Cross-Play",
    badge: "Unified 2K Account Graph",
    iconType: "shield",
    iconColor: "text-cyan-400",
    bgAccent: "bg-cyan-500/10",
    pillColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    metricPill: "512 Multi-2K Players",
    title: "512 Multi-Title 2K Cross-Players",
    summary:
      "Unified 2K Account players active across NBA 2K27, WWE 2K25, PGA 2K25, and Borderlands 4.",
    base: "512 Multi-Franchise 2K Accounts · 2K Identity Spine",
    metrics: {
      cohortSize: 512,
      avgSpend: 685,
      avgChurn: 0.29,
      liftMetric: "2.8x Cross-2K LTV",
      highRiskCount: 78,
      secondaryMetric: "Zero-CAC 2K Portfolio Cross-Sell",
    },
    caveats: [
      "Unified 2K Account links console, PC, and mobile play across 12 2K titles.",
      "Target NBA 2K27 players during mid-season lulls with WWE 2K25 MyFACTION and PGA 2K25 bundles.",
      "Multi-title 2K players generate 2.8x higher annual LTV with zero external paid-media CAC.",
    ],
    actionLabel: "Explore Cohort in Graph",
    queryToRun:
      "Multi-franchise 2K players linked via 2K Account playing NBA 2K27 alongside WWE 2K25, PGA TOUR 2K25, Borderlands 4, or Civilization VII",
    franchise: "ALL",
    prompts: [
      {
        title: "NBA 2K27 + WWE 2K25 & PGA TOUR 2K25 Bridge",
        query:
          "2K Sports players bridging NBA 2K27 with WWE 2K25 MyFACTION and PGA TOUR 2K25",
        franchise: "WWE2K",
        tag: "2K Sports",
        highlight: "WWE + PGA 2K",
      },
      {
        title: "Borderlands 4 & Civilization VII Cross-Play",
        query:
          "Players with unified 2K Account playing NBA 2K27 alongside Borderlands 4 or Civilization VII",
        franchise: "BL4",
        tag: "2K Core",
        highlight: "BL4 + Civ VII",
      },
      {
        title: "MyNBA Sim GMs Playing Civilization VII",
        query:
          "MyNBA Franchise Sim players who also play Sid Meier's Civilization VII or PGA TOUR 2K25",
        franchise: "ALL",
        tag: "Strategy Sim",
        highlight: "2.8x LTV",
      },
    ],
  },
  {
    id: "creator-crews",
    category: "creator_halo",
    tabLabel: "05. Creator & Crew Squads",
    shortLabel: "Creators & Crews",
    badge: "2-Hop Creator & Crew Halo",
    iconType: "creator",
    iconColor: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    pillColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    metricPill: "364 Creator Squads",
    title: "364 Creator-Led Crew Squads",
    summary:
      "Level 30+ Crew players following top 2K creators with 87% bundle conversion affinity.",
    base: "364 Creator-Linked Crew Players · 2K Identity Graph",
    metrics: {
      cohortSize: 364,
      avgSpend: 590,
      avgChurn: 0.31,
      liftMetric: "87.4% Creator Affinity",
      highRiskCount: 62,
      secondaryMetric: "Creator Locker Code & Crew Co-Promo",
    },
    caveats: [
      "364 Level 30+ Crew members follow Agent 00, Troydan, CashNasty, KOT4Q, DBG, Tydebo, or Moxsy.",
      "Synchronize creator Locker Code drops with Cap Breaker and MyTEAM Friday pack releases.",
      "Drives 3.2x faster bundle conversion within 24 hours of creator build breakdown streams.",
    ],
    actionLabel: "Explore Cohort in Graph",
    queryToRun:
      "High-value 2K players in active Crews following Agent 00, Troydan, CashNasty, KOT4Q, DBG, Tydebo, or Moxsy",
    franchise: "ALL",
    prompts: [
      {
        title: "Agent 00, Troydan & CashNasty Park/MyTEAM Halo",
        query:
          "NBA 2K27 players following Agent 00, Troydan, or CashNasty with high VC spend",
        franchise: "NBA2K",
        tag: "Creator Halo",
        highlight: "Agent 00 · Troydan",
      },
      {
        title: "DBG, Tydebo & KOT4Q Build Lab Followers",
        query:
          "Players following DBG, Tydebo, or Kenny Beecham KOT4Q across NBA 2K27 and NBA 2K26",
        franchise: "NBA2K",
        tag: "Build Lab",
        highlight: "DBG · KOT4Q",
      },
      {
        title: "Moxsy & Assemble Cross-2K Creator Fans",
        query:
          "2K players following Moxsy in Borderlands 4 or Assemble in WWE 2K25",
        franchise: "BL4",
        tag: "Cross-2K Creators",
        highlight: "Moxsy · Assemble",
      },
    ],
  },
];

export default function CourtsideLanding({
  onSearchQuery,
  onExploreFullGraph,
  onOpenA2A,
  onOpenGeoMap,
  onOpenMarketingJourney,
  isLoading: isLoadingProp,
  errorText: errorTextProp,
  onDismissError,
  selectedGame: selectedGameProp,
  onGameChange,
  onRunBuilderQuery,
  onOpenWorkspaceView,
  onOpenActivationFeed,
  isSearching = false,
  errorMessage,
}: CourtsideLandingProps) {
  const [query, setQuery] = useState("");
  const [selectedFranchise, setSelectedFranchise] = useState<GameFranchise>(
    selectedGameProp || "ALL"
  );
  const [dynamicFindings, setDynamicFindings] = useState<DynamicCohortFinding[]>(
    DEFAULT_DYNAMIC_FINDINGS
  );
  const [activeFindingId, setActiveFindingId] = useState<string>("2k26-bridge");
  const [activeLoadingQuery, setActiveLoadingQuery] = useState<string | null>(
    null
  );
  const [isBriefModalOpen, setIsBriefModalOpen] = useState<boolean>(false);
  const [footerStats, setFooterStats] = useState<{
    players: number;
    identities: number;
  }>({
    players: 2850,
    identities: 6853,
  });

  const isLoading = Boolean(isLoadingProp ?? isSearching);
  const errorText = errorTextProp ?? errorMessage ?? "";

  useEffect(() => {
    if (selectedGameProp && selectedGameProp !== selectedFranchise) {
      setSelectedFranchise(selectedGameProp);
    }
  }, [selectedGameProp]);

  const activeAura = AURA_THEMES[selectedFranchise] || AURA_THEMES.ALL;

  // Hydrate live counts while keeping all 5 pure-2K tabs intact
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/insights/graph-stats`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && d.ok) {
          setFooterStats({
            players: d.players || 2850,
            identities: d.identities || 6853,
          });
          const p1 = d.play_counts?.play1_season2_cliff;
          const p2 = d.play_counts?.play2_cross_label_gravity;
          const p3 = d.play_counts?.play3_myteam_whales;
          setDynamicFindings((prev) =>
            prev.map((f) => {
              if (f.id === "2k26-bridge" && typeof p2 === "number" && p2 > 0) {
                return {
                  ...f,
                  title: `${p2} NBA 2K26 Veterans Ready to Upgrade`,
                  metricPill: `${p2} Holdout Veterans`,
                  metrics: { ...f.metrics, cohortSize: p2 },
                };
              }
              if (f.id === "season2-cliff" && typeof p1 === "number" && p1 > 0) {
                return {
                  ...f,
                  title: `${p1} Sub-85 Builds at Season 2 Cliff`,
                  metricPill: `${p1} Stalled Builds`,
                  metrics: { ...f.metrics, cohortSize: p1, highRiskCount: p1 },
                };
              }
              if (f.id === "myteam-whales" && typeof p3 === "number" && p3 > 0) {
                return {
                  ...f,
                  title: `${p3} MyTEAM Galaxy Opal Pack Whales`,
                  metricPill: `${p3} HoF Whales`,
                  metrics: { ...f.metrics, cohortSize: p3 },
                };
              }
              return f;
            })
          );
        }
      })
      .catch(() => {
        // Keep initial snapshot numbers if unreachable
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFranchise]);

  const currentFinding =
    dynamicFindings.find((f) => f.id === activeFindingId) ||
    dynamicFindings[0] ||
    DEFAULT_DYNAMIC_FINDINGS[0];

  const handleSelectFranchise = (f: GameFranchise) => {
    setSelectedFranchise(f);
    if (onGameChange) onGameChange(f);
  };

  const triggerExploreFullGraph = (f: GameFranchise) => {
    if (onExploreFullGraph) {
      onExploreFullGraph(f);
    } else if (onOpenWorkspaceView) {
      if (onGameChange) onGameChange(f);
      onOpenWorkspaceView("audience-cohorts");
    }
  };

  const handleRunSearch = (
    customQ?: string,
    customFranchise?: GameFranchise
  ) => {
    if (isLoading) return;
    const q = customQ !== undefined ? customQ : query;
    const f = customFranchise || selectedFranchise;
    if (!q.trim()) {
      triggerExploreFullGraph(f);
      return;
    }
    setActiveLoadingQuery(q);
    if (onSearchQuery) {
      onSearchQuery(q, f);
    } else if (onRunBuilderQuery) {
      onRunBuilderQuery(q, f, []);
    }
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
              src="/brands/2k/2k-logo.svg"
              data-logo-asset="/brands/2k/logos/2k.svg"
              alt="2K"
              className="h-5 w-auto object-contain brightness-110 select-none"
            />
            <img
              src="/brands/2k/nba2k-logo.svg"
              data-logo-asset="/brands/2k/logos/nba2k.svg"
              alt="NBA 2K"
              className="h-4 w-auto object-contain brightness-110 select-none hidden sm:inline-block"
            />
            <span className="text-gray-600 font-normal">/</span>
            <span className="text-xs text-gray-300 font-medium tracking-tight">
              2K Courtside
            </span>
          </div>
        </div>

        {/* Right Navigation & Live Connection Status */}
        <div className="flex items-center gap-2">
          <SpannerStatusPill />

          <button
            type="button"
            onClick={() => {
              if (onOpenMarketingJourney) onOpenMarketingJourney();
              else if (onOpenWorkspaceView)
                onOpenWorkspaceView("marketing-journey");
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Journeys</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenGeoMap) onOpenGeoMap();
              else if (onOpenWorkspaceView) onOpenWorkspaceView("geo-map");
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Markets</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenA2A) onOpenA2A();
              else if (onOpenActivationFeed) onOpenActivationFeed();
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span>Activate</span>
          </button>

          <button
            type="button"
            onClick={() => triggerExploreFullGraph("ALL")}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-black" />
            <span>Explore Graph</span>
          </button>
        </div>
      </header>

      {/* 3. Center Stage (Spacious, Minimalist, Apple-Grade Master Control Panel) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-4xl w-full mx-auto space-y-3.5 my-auto animate-spring-in">
        {/* Hero Title */}
        <div className="space-y-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            2K Courtside
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Cross-title player identity, lifecycle cohorts, and offer testing across the 2K ecosystem.
          </p>
        </div>

        {/* Failure banner */}
        {errorText && (
          <div
            role="alert"
            className="w-full bg-red-950/70 backdrop-blur-2xl border border-red-500/40 rounded-2xl p-3 px-4 flex items-start gap-3 animate-fade-in"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-red-200">
                No cohort was computed
              </div>
              <div className="text-[11px] text-red-300/80 font-mono break-words mt-0.5">
                {errorText}
              </div>
            </div>
            {onDismissError && (
              <button
                type="button"
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
              rows={1}
              value={query}
              disabled={isLoading}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleRunSearch();
                }
              }}
              placeholder="Ask anything across 2K (e.g., NBA 2K26 holdouts with active 2K27 Crew mates)..."
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none px-3 py-1 resize-none font-normal leading-relaxed disabled:opacity-60"
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 px-1">
            {/* Franchise Micro-Segmented Control */}
            <div className="flex flex-wrap items-center bg-black/40 p-0.5 rounded-xl border border-white/10">
              {FRANCHISES.map((f) => {
                const isSelected = selectedFranchise === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSelectFranchise(f.id)}
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
                type="button"
                onClick={() => triggerExploreFullGraph(selectedFranchise)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                title="Load full property graph without filtering"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Load Graph</span>
              </button>

              <button
                type="button"
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

        {/* 4. Dynamic Cohort Explorer (5 Segmented Tabs + Single Core Finding Callout Card + 3 Prompt Cards) */}
        <div className="w-full space-y-2.5">
          {/* Dynamic Cohort Segmented Tabs */}
          <div className="flex items-center justify-between bg-black/40 p-1 rounded-2xl border border-white/10 backdrop-blur-xl gap-1">
            {dynamicFindings.map((finding) => {
              const isSelected = activeFindingId === finding.id;
              const IconComponent = getFindingIcon(finding.iconType);
              return (
                <button
                  key={finding.id}
                  type="button"
                  onClick={() => setActiveFindingId(finding.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white/15 text-white font-semibold shadow-sm border border-white/10"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  }`}
                >
                  <IconComponent
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? finding.iconColor : "text-zinc-500"
                    }`}
                  />
                  <span className="hidden md:inline truncate">
                    {finding.tabLabel}
                  </span>
                  <span className="md:hidden truncate">
                    {finding.shortLabel}
                  </span>
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
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  CORE FINDING · {currentFinding.metricPill}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 group-hover:text-cyan-300 font-medium transition-colors">
                <span>Opportunity Brief</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-sm sm:text-[15px] font-semibold text-white tracking-tight">
                {currentFinding.title}
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentFinding.pillColor}`}
              >
                {currentFinding.metrics.liftMetric}
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {currentFinding.summary}
            </p>
          </button>

          {/* 3 Spacious Prompt Cards in a clean 1x3 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {currentFinding.prompts.map((p, pIdx) => {
              const isThisCardLoading =
                isLoading && activeLoadingQuery === p.query;
              const shortSpec =
                PROMPT_SPECS[p.title] || `${p.tag} · ${p.highlight}`;
              return (
                <div
                  key={pIdx}
                  onClick={() => {
                    if (isLoading) return;
                    setQuery(p.query);
                    handleSelectFranchise(p.franchise);
                    handleRunSearch(p.query, p.franchise);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 group ${
                    isThisCardLoading
                      ? "bg-white/10 border-cyan-400/50 shadow-sm scale-[1.01]"
                      : "bg-black/30 hover:bg-white/[0.06] border-white/5 hover:border-white/15 active:scale-98"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-mono">
                      {p.tag}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                      {p.highlight}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate transition-colors">
                      {p.title}
                    </div>
                    <p className="text-[11px] text-zinc-400 group-hover:text-zinc-300 mt-0.5 font-mono">
                      {shortSpec}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-zinc-400 group-hover:text-zinc-200">
                    <span>Explore cohort</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 5. Bottom Telemetry Ticker (Subtle, Clean) */}
      <footer className="relative z-20 flex items-center justify-between px-8 py-3 bg-black/20 backdrop-blur-xl border-t border-white/5 text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span>{footerStats.players.toLocaleString()} Players</span>
          <span>·</span>
          <span>
            {footerStats.identities.toLocaleString()} Linked IDs
          </span>
          <span>·</span>
          <span>12 2K Titles</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span>2K Courtside · Live Telemetry</span>
        </div>
      </footer>

      {/* 🌟 6. Opportunity Brief Executive Detail Modal */}
      {isBriefModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto"
          onClick={() => setIsBriefModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl bg-[#0E1117] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 animate-spring-in text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl ${currentFinding.bgAccent} border border-white/10 flex items-center justify-center`}
                >
                  {React.createElement(getFindingIcon(currentFinding.iconType), {
                    className: `w-4 h-4 ${currentFinding.iconColor}`,
                  })}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Opportunity Brief · {currentFinding.tabLabel}
                  </h2>
                  <p className="text-xs text-zinc-400 font-mono">
                    {currentFinding.base}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBriefModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The Core Finding Box in Modal */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>Core Finding</span>
                <span className="text-zinc-400 font-mono">
                  {currentFinding.badge}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {currentFinding.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${currentFinding.pillColor}`}
                >
                  {currentFinding.metricPill}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {currentFinding.summary}
              </p>

              {/* Live Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[11px] text-zinc-400">Cohort Size</div>
                  <div className="text-xs font-bold text-white font-mono mt-0.5">
                    {currentFinding.metrics.cohortSize.toLocaleString()} Players
                  </div>
                </div>
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[11px] text-zinc-400">Average LTV</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                    ${currentFinding.metrics.avgSpend.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="text-[11px] text-zinc-400">Churn Risk</div>
                  <div className="text-xs font-bold text-rose-400 font-mono mt-0.5">
                    {(currentFinding.metrics.avgChurn * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Concise 1-Line Bullets: Why It Matters, Recommended Play, Expected Impact */}
            <div className="space-y-2">
              <ul className="space-y-2 text-xs text-zinc-300">
                {currentFinding.caveats.map((c, cIdx) => (
                  <li key={cIdx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-mono font-semibold shrink-0">
                      {BRIEF_BULLET_LABELS[cIdx] || "Insight"}:
                    </span>
                    <span className="leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Strategic Action Plan & Exploration Buttons */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">
                2K Identity Graph · Live Cohort
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBriefModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBriefModalOpen(false);
                    handleRunSearch(
                      currentFinding.queryToRun,
                      currentFinding.franchise
                    );
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
