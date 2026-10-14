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
import SpannerStatusPill from "@/components/common/SpannerStatusPill";
import EnterpriseArchitectureModal, {
  EnterpriseArchitectureButton,
} from "@/components/common/EnterpriseArchitectureModal";

export interface ConditionChip {
  id: string;
  field: string;
  op: string;
  value: string;
  label: string;
  rawFragment?: string;
}

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
  "NBA 2K26 → 2K27 Holdouts": "$150+ LTV · Active 2K27 Crew",
  "Crew Tipping Point (3/5 in 2K27)": "Concordia Stag-Hunt · 3.4x lift",
  "92+ OVR Park Grinders": "$200+ spend · 92+ OVR builds",
  "Season 2 Build Cliff (<85 OVR)": "<85 OVR · $50+ VC · 7d lapsed",
  "Reactive Build-Meta Rebirth": "Sub-86 OVR · Loss streak >= 2",
  "Keystone Captains (Squad VaR)": "5-stack Rec/Pro-Am organizers",
  "MyTEAM Galaxy Opal Whales": "10+ Galaxy Opals · HoF Pass",
  "TimesFM Velocity Decay Guard": "$350+ LTV · Q4 spend deceleration",
  "2K D2C Web Store (+22% Margin)": "Hold discount · Zero 30% store fee",
  "WWE 2K25 & PGA TOUR 2K25 Bridge": "NBA 2K27 · WWE 2K25 · PGA 2K25",
  "Borderlands 4 & Civ VII Cross-Play": "2K Account · BL4 & Civ VII",
  "NBA 2K Mobile Companion Sync": "Mobile + Console MyTEAM sync",
  "Agent 00 & Troydan Park Halo": "Agent 00 · Troydan · CashNasty",
  "DBG & KOT4Q Build Lab Fans": "Meta build & MyNBA followers",
  "Moxsy & Assemble Cross-2K Fans": "Borderlands 4 & WWE 2K creators",
};

const BRIEF_BULLET_LABELS = ["Signal", "Play", "Impact"];

const DEFAULT_DYNAMIC_FINDINGS: DynamicCohortFinding[] = [
  {
    id: "2k26-bridge",
    category: "cross_title",
    tabLabel: "2K26 Holdouts",
    shortLabel: "2K26 Holdouts",
    badge: "3-Hop Upgrade Bridge",
    iconType: "cross_title",
    iconColor: "text-orange-400",
    bgAccent: "bg-orange-500/10",
    pillColor: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    metricPill: "730 Holdouts",
    title: "730 NBA 2K26 Veterans Ready to Upgrade",
    summary:
      "High-LTV 2K26 holdouts with 2+ Crew mates already active in NBA 2K27.",
    base: "730 NBA 2K26 Holdouts · 2K Identity Graph",
    metrics: {
      cohortSize: 730,
      avgSpend: 342,
      avgChurn: 0.44,
      liftMetric: "+$9.5M–$55M Lift",
      highRiskCount: 286,
      secondaryMetric: "$69.99 HoF Loyalty Upgrade",
    },
    caveats: [
      "730 NBA 2K26 veterans ($342 avg LTV) have active 2K27 Crew mates.",
      "Send $69.99 HoF Loyalty Upgrade + 100K VC via 2K Account.",
      "3.1x conversion lift without discounting base retail SKU.",
    ],
    actionLabel: "Explore in Graph",
    queryToRun:
      "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27",
    franchise: "NBA2K26",
    prompts: [
      {
        title: "NBA 2K26 → 2K27 Holdouts",
        query:
          "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27",
        franchise: "NBA2K26",
        tag: "2K26 Bridge",
        highlight: "730 Holdouts",
      },
      {
        title: "Crew Tipping Point (3/5 in 2K27)",
        query:
          "NBA 2K26 holdout veterans at the Concordia Crew tipping point with active NBA 2K27 Crew mates",
        franchise: "NBA2K26",
        tag: "CATE Uplift",
        highlight: "3.4x Lift",
      },
      {
        title: "92+ OVR Park Grinders",
        query:
          "NBA 2K26 Park and Rec veterans with $200+ spend who haven't upgraded to NBA 2K27",
        franchise: "NBA2K26",
        tag: "HoF Upgrade",
        highlight: "+100K VC",
      },
    ],
  },
  {
    id: "season2-cliff",
    category: "churn_contagion",
    tabLabel: "Season 2 Cliff",
    shortLabel: "S2 Cliff",
    badge: "Season 2 Retention",
    iconType: "slump",
    iconColor: "text-rose-400",
    bgAccent: "bg-rose-500/10",
    pillColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    metricPill: "681 Stalled Builds",
    title: "681 Sub-85 OVR Builds at the Season 2 Cliff",
    summary:
      "Stalled MyCAREER spenders inactive 7+ days whose Crew captains logged in within 72h.",
    base: "681 Stalled Builds · 2K Identity Graph",
    metrics: {
      cohortSize: 681,
      avgSpend: 218,
      avgChurn: 0.64,
      liftMetric: "+28.4% S2 Retention",
      highRiskCount: 681,
      secondaryMetric: "$4.99 Crew Re-Up Bundle",
    },
    caveats: [
      "Builds stalled at 78–84 OVR face 2.6x higher solo-queue churn risk.",
      "Co-trigger $4.99 Crew Re-Up Bundle with a Crew Captain squad invite.",
      "+28.4% Season 2 return rate while suppressing tilted Sleeping Dogs.",
    ],
    actionLabel: "Explore in Graph",
    queryToRun:
      "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
    franchise: "NBA2K",
    prompts: [
      {
        title: "Season 2 Build Cliff (<85 OVR)",
        query:
          "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
        franchise: "NBA2K",
        tag: "2-Hop Crew",
        highlight: "681 Builds",
      },
      {
        title: "Reactive Build-Meta Rebirth",
        query:
          "Sub-86 OVR NBA 2K27 builds with sunk VC experiencing reactive frustration and loss streaks",
        franchise: "NBA2K",
        tag: "Ceccarelli Trigger",
        highlight: "677 Tilted",
      },
      {
        title: "Keystone Captains (Squad VaR)",
        query:
          "NBA 2K27 Build Lab theorycrafters below 85 OVR holding unspent VC balances",
        franchise: "NBA2K",
        tag: "5-Stack VaR",
        highlight: "$1.4K VaR",
      },
    ],
  },
  {
    id: "myteam-whales",
    category: "whale_spillover",
    tabLabel: "MyTEAM Whales",
    shortLabel: "Whales",
    badge: "HoF Pass & D2C Margin",
    iconType: "currency",
    iconColor: "text-amber-400",
    bgAccent: "bg-amber-500/10",
    pillColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    metricPill: "447 HoF Whales",
    title: "447 MyTEAM Opal Whales & D2C Arbitrage",
    summary:
      "HoF Pass collectors ($1,420 avg LTV) routed to 2K D2C Web Store (+22% gross margin) & TimesFM velocity guard.",
    base: "447 MyTEAM Whales · 2K Identity Graph",
    metrics: {
      cohortSize: 447,
      avgSpend: 1420,
      avgChurn: 0.24,
      liftMetric: "+22% D2C Margin",
      highRiskCount: 74,
      secondaryMetric: "2K Web Store + Offer Battle",
    },
    caveats: [
      "Top MyTEAM collectors hold 10+ Galaxy Opals ($1,420 avg LTV).",
      "Route Sure Things to 2K D2C Web Store (0% discount, no 30% console fee).",
      "Use BigQuery TimesFM 3.0 to catch Q2/Q3 whale velocity decay before Q4.",
    ],
    actionLabel: "Explore in Graph",
    queryToRun:
      "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
    franchise: "NBA2K",
    prompts: [
      {
        title: "MyTEAM Galaxy Opal Whales",
        query:
          "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass",
        franchise: "NBA2K",
        tag: "Offer Battle",
        highlight: "447 Whales",
      },
      {
        title: "TimesFM Velocity Decay Guard",
        query:
          "High-LTV NBA 2K27 whales showing mid-season spending velocity decay for TimesFM 3.0 intervention",
        franchise: "NBA2K",
        tag: "Goldstein Q4 Guard",
        highlight: "378 Decaying",
      },
      {
        title: "2K D2C Web Store (+22% Margin)",
        query:
          "High-velocity 2K Account VC spenders eligible for Direct-to-Consumer (D2C) Web Store margin arbitrage",
        franchise: "NBA2K",
        tag: "Zelnick D2C",
        highlight: "787 D2C Ready",
      },
    ],
  },
  {
    id: "2k-crossplay",
    category: "cross_title",
    tabLabel: "2K Cross-Play",
    shortLabel: "Cross-Play",
    badge: "Unified 2K Account",
    iconType: "shield",
    iconColor: "text-cyan-400",
    bgAccent: "bg-cyan-500/10",
    pillColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    metricPill: "5,502 Cross-2K",
    title: "5,502 Multi-Franchise 2K Account Players",
    summary:
      "Unified 2K Account players bridging NBA 2K27 with WWE 2K25, PGA 2K25, Borderlands 4, and Civ VII.",
    base: "5,502 Cross-2K Accounts · 2K Identity Spine",
    metrics: {
      cohortSize: 5502,
      avgSpend: 685,
      avgChurn: 0.29,
      liftMetric: "2.8x Cross-2K LTV",
      highRiskCount: 168,
      secondaryMetric: "Zero-CAC Portfolio Cross-Sell",
    },
    caveats: [
      "2K Account links console, PC, and mobile across 12 titles.",
      "Cross-sell WWE 2K25, PGA 2K25, and Borderlands 4 during seasonal lulls.",
      "2.8x annual LTV at zero external paid-media acquisition cost.",
    ],
    actionLabel: "Explore in Graph",
    queryToRun:
      "Multi-franchise 2K players linked via 2K Account playing NBA 2K27 alongside WWE 2K25, PGA TOUR 2K25, Borderlands 4, or Civilization VII",
    franchise: "ALL",
    prompts: [
      {
        title: "WWE 2K25 & PGA TOUR 2K25 Bridge",
        query:
          "2K Sports players bridging NBA 2K27 with WWE 2K25 MyFACTION and PGA TOUR 2K25",
        franchise: "WWE2K",
        tag: "2K Sports",
        highlight: "5,502 Cross-2K",
      },
      {
        title: "Borderlands 4 & Civ VII Cross-Play",
        query:
          "Players with unified 2K Account playing NBA 2K27 alongside Borderlands 4 or Civilization VII",
        franchise: "BL4",
        tag: "2K Core",
        highlight: "BL4 + Civ VII",
      },
      {
        title: "NBA 2K Mobile Companion Sync",
        query:
          "NBA 2K Mobile daily ritualists linked to NBA 2K27 MyTEAM with high pack spend",
        franchise: "NBA2KMOBILE",
        tag: "Mobile Bridge",
        highlight: "2.8x LTV",
      },
    ],
  },
  {
    id: "creator-crews",
    category: "creator_halo",
    tabLabel: "Creator Crews",
    shortLabel: "Creators",
    badge: "2-Hop Creator Halo",
    iconType: "creator",
    iconColor: "text-emerald-400",
    bgAccent: "bg-emerald-500/10",
    pillColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    metricPill: "1,477 Creator Fans",
    title: "1,477 Creator-Led Crew Squads",
    summary:
      "84 Crews and 1,477 players following Agent 00, Troydan, KOT4Q, DBG, and Moxsy (3.2x faster bundle conversion).",
    base: "1,477 Creator-Linked Players · 84 Crews",
    metrics: {
      cohortSize: 1477,
      avgSpend: 590,
      avgChurn: 0.31,
      liftMetric: "87.4% Affinity",
      highRiskCount: 142,
      secondaryMetric: "Creator Locker Code Co-Promo",
    },
    caveats: [
      "1,477 Crew members follow top NBA 2K, WWE 2K, and Borderlands creators.",
      "Sync Creator Locker Code drops with Friday MyTEAM and Cap Breaker releases.",
      "3.2x faster bundle conversion within 24h of creator build streams.",
    ],
    actionLabel: "Explore in Graph",
    queryToRun:
      "High-value 2K players in active Crews following Agent 00, Troydan, CashNasty, KOT4Q, DBG, Tydebo, or Moxsy",
    franchise: "ALL",
    prompts: [
      {
        title: "Agent 00 & Troydan Park Halo",
        query:
          "NBA 2K27 players following Agent 00, Troydan, or CashNasty with high VC spend",
        franchise: "NBA2K",
        tag: "Creator Halo",
        highlight: "Agent 00 · Troydan",
      },
      {
        title: "DBG & KOT4Q Build Lab Fans",
        query:
          "Players following DBG, Tydebo, or Kenny Beecham KOT4Q across NBA 2K27 and NBA 2K26",
        franchise: "NBA2K",
        tag: "Build Lab",
        highlight: "DBG · KOT4Q",
      },
      {
        title: "Moxsy & Assemble Cross-2K Fans",
        query:
          "2K players following Moxsy in Borderlands 4 or Assemble in WWE 2K25",
        franchise: "BL4",
        tag: "Cross-2K",
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
  onOpenFocusGroup,
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
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);
  const [footerStats, setFooterStats] = useState<{
    players: number;
    crews: number;
    cross2k: number;
    identities: number;
  }>({
    players: 6500,
    crews: 84,
    cross2k: 5502,
    identities: 15787,
  });
  const [pillarCounts, setPillarCounts] = useState<{
    cateHoldouts: number;
    d2cWebstore: number;
    whaleDecay: number;
    buildRebirth: number;
  }>({
    cateHoldouts: 730,
    d2cWebstore: 787,
    whaleDecay: 378,
    buildRebirth: 677,
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
            players: d.players || 6500,
            crews: d.crews || 84,
            cross2k: d.cross_2k_players || 5502,
            identities: d.identities || 15787,
          });
          const p1 = d.play_counts?.play1_season2_cliff;
          const p2 = d.play_counts?.play2_cross_label_gravity;
          const p3 = d.play_counts?.play3_myteam_whales;
          const p5 = d.play_counts?.play5_creator_crews;
          const p6 = d.play_counts?.play6_whale_decay;
          const p7 = d.play_counts?.play7_d2c_webstore;
          const p8 = d.play_counts?.play8_build_rebirth;
          const cross2kTotal = d.cross_2k_players;
          setPillarCounts({
            cateHoldouts: typeof p2 === "number" && p2 > 0 ? p2 : 730,
            d2cWebstore: typeof p7 === "number" && p7 > 0 ? p7 : 787,
            whaleDecay: typeof p6 === "number" && p6 > 0 ? p6 : 378,
            buildRebirth: typeof p8 === "number" && p8 > 0 ? p8 : 677,
          });
          setDynamicFindings((prev) =>
            prev.map((f) => {
              if (f.id === "2k26-bridge" && typeof p2 === "number" && p2 > 0) {
                return {
                  ...f,
                  title: `${p2.toLocaleString()} NBA 2K26 Veterans Ready to Upgrade`,
                  metricPill: `${p2.toLocaleString()} Holdouts`,
                  base: `${p2.toLocaleString()} NBA 2K26 Holdouts · 2K Identity Graph`,
                  metrics: { ...f.metrics, cohortSize: p2 },
                  prompts: f.prompts.map((pr, idx) =>
                    idx === 0 ? { ...pr, highlight: `${p2.toLocaleString()} Holdouts` } : pr
                  ),
                };
              }
              if (f.id === "season2-cliff" && typeof p1 === "number" && p1 > 0) {
                return {
                  ...f,
                  title: `${p1.toLocaleString()} Sub-85 OVR Builds at the Season 2 Cliff`,
                  metricPill: `${p1.toLocaleString()} Stalled Builds`,
                  base: `${p1.toLocaleString()} Stalled Builds · 2K Identity Graph`,
                  metrics: {
                    ...f.metrics,
                    cohortSize: p1,
                    highRiskCount: p1,
                  },
                  prompts: f.prompts.map((pr, idx) =>
                    idx === 0
                      ? { ...pr, highlight: `${p1.toLocaleString()} Builds` }
                      : idx === 1 && typeof p8 === "number" && p8 > 0
                        ? { ...pr, highlight: `${p8.toLocaleString()} Tilted` }
                        : pr
                  ),
                };
              }
              if (f.id === "myteam-whales" && typeof p3 === "number" && p3 > 0) {
                return {
                  ...f,
                  title: `${p3.toLocaleString()} MyTEAM Opal Whales & D2C Arbitrage`,
                  metricPill: `${p3.toLocaleString()} HoF Whales`,
                  base: `${p3.toLocaleString()} MyTEAM Whales · 2K Identity Graph`,
                  metrics: { ...f.metrics, cohortSize: p3 },
                  prompts: f.prompts.map((pr, idx) =>
                    idx === 0
                      ? { ...pr, highlight: `${p3.toLocaleString()} Whales` }
                      : idx === 1 && typeof p6 === "number" && p6 > 0
                        ? { ...pr, highlight: `${p6.toLocaleString()} Decaying` }
                        : idx === 2 && typeof p7 === "number" && p7 > 0
                          ? { ...pr, highlight: `${p7.toLocaleString()} D2C Ready` }
                          : pr
                  ),
                };
              }
              if (
                f.id === "2k-crossplay" &&
                typeof cross2kTotal === "number" &&
                cross2kTotal > 0
              ) {
                return {
                  ...f,
                  title: `${cross2kTotal.toLocaleString()} Multi-Franchise 2K Account Players`,
                  metricPill: `${cross2kTotal.toLocaleString()} Cross-2K`,
                  base: `${cross2kTotal.toLocaleString()} Cross-2K Accounts · 2K Identity Spine`,
                  metrics: { ...f.metrics, cohortSize: cross2kTotal },
                  prompts: f.prompts.map((pr, idx) =>
                    idx === 0
                      ? { ...pr, highlight: `${cross2kTotal.toLocaleString()} Cross-2K` }
                      : pr
                  ),
                };
              }
              if (f.id === "creator-crews" && typeof p5 === "number" && p5 > 0) {
                return {
                  ...f,
                  title: `${p5.toLocaleString()} Creator-Led Crew Squads`,
                  metricPill: `${p5.toLocaleString()} Creator Fans`,
                  base: `${p5.toLocaleString()} Creator-Linked Players · ${d.crews || 84} Crews`,
                  metrics: { ...f.metrics, cohortSize: p5 },
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

          <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.08] p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (onOpenMarketingJourney) onOpenMarketingJourney();
                else if (onOpenWorkspaceView)
                  onOpenWorkspaceView("marketing-journey");
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/[0.06] text-gray-300 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Journeys</span>
            </button>

            {onOpenFocusGroup && (
              <button
                type="button"
                onClick={onOpenFocusGroup}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-amber-500/15 text-amber-300 text-xs font-medium transition-all disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Focus Group</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onOpenA2A) onOpenA2A();
                else if (onOpenActivationFeed) onOpenActivationFeed();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/[0.06] text-gray-300 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>Activate</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => triggerExploreFullGraph("ALL")}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-black" />
            <span>Explore Graph</span>
          </button>

          <EnterpriseArchitectureButton onClick={() => setIsArchModalOpen(true)} />
        </div>
      </header>

      {/* 3. Center Stage (Spacious, Minimalist, Apple-Grade Master Control Panel) */}
      <main className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-4 max-w-4xl w-full mx-auto space-y-4 my-auto animate-spring-in">
        {/* Hero Title */}
        <div className="space-y-1 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
            2K Courtside
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Cross-title player identity, causal cohorts, and offer testing across 2K.
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
                    <Loader2 className="w-3.5 h-3.5 courtside-Transfer-pulse text-black" />
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

        {/* 4. Minimalist Cohort Explorer (5 Clean Tabs + Compact Core Finding + 3 Short Play Cards) */}
        <div className="w-full space-y-2">
          {/* Dynamic Cohort Segmented Tabs */}
          <div className="flex flex-wrap items-center justify-center bg-black/40 p-1 rounded-2xl border border-white/10 backdrop-blur-xl gap-1">
            {dynamicFindings.map((finding) => {
              const isSelected = activeFindingId === finding.id;
              const IconComponent = getFindingIcon(finding.iconType);
              return (
                <button
                  key={finding.id}
                  type="button"
                  onClick={() => setActiveFindingId(finding.id)}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-medium transition-all ${
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

          {/* 🌟 Compact 2-Line Core Finding Callout */}
          <button
            type="button"
            onClick={() => setIsBriefModalOpen(true)}
            className="w-full text-left px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 backdrop-blur-2xl transition-all space-y-1 cursor-pointer shadow-lg group active:scale-[0.99] focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                <span className="text-sm font-semibold text-white tracking-tight truncate">
                  {currentFinding.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border shrink-0 ${currentFinding.pillColor}`}
                >
                  {currentFinding.metrics.liftMetric}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 group-hover:text-cyan-300 font-medium transition-colors shrink-0">
                <span>Brief</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>

            <p className="text-xs text-zinc-400 truncate pl-4">
              {currentFinding.summary}
            </p>
          </button>

          {/* 3 Compact, High-Signal 1-Click Play Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {currentFinding.prompts.map((p, pIdx) => {
              const isThisCardLoading =
                isLoading && activeLoadingQuery === p.query;
              const shortSpec =
                PROMPT_SPECS[p.title] || `${p.tag} · ${p.highlight}`;
              return (
                <button
                  key={pIdx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setQuery(p.query);
                    handleSelectFranchise(p.franchise);
                    handleRunSearch(p.query, p.franchise);
                  }}
                  className={`text-left px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 group ${
                    isThisCardLoading
                      ? "bg-white/10 border-cyan-400/50 shadow-sm scale-[1.01]"
                      : "bg-black/35 hover:bg-white/[0.06] border-white/[0.07] hover:border-white/20 active:scale-98"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-xs font-semibold text-zinc-100 group-hover:text-white truncate transition-colors">
                      {p.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 font-mono font-semibold shrink-0 tabular-nums">
                      {p.highlight}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 font-mono truncate">
                      {shortSpec}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 5. Bottom Telemetry Ticker (Subtle, Clean) */}
      <footer className="relative z-20 flex items-center justify-between px-8 py-3 bg-black/20 backdrop-blur-xl border-t border-white/5 text-[11px] text-zinc-400 font-mono">
        <div className="flex flex-wrap items-center gap-2 tabular-nums">
          <span>{footerStats.players.toLocaleString()} Players</span>
          <span>·</span>
          <span>{footerStats.crews.toLocaleString()} Crews</span>
          <span>·</span>
          <span>{footerStats.cross2k.toLocaleString()} Cross-2K</span>
          <span>·</span>
          <span>
            {footerStats.identities.toLocaleString()} Linked IDs
          </span>
          <span>·</span>
          <span>12 2K Titles</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] text-zinc-400">
            Synthetic EBC Telemetry Cohort · Live GCP Execution
          </span>
          <span>·</span>
          <span>2K Courtside</span>
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

      <EnterpriseArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  );
}
