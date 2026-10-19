"use client";

import React, { useState, useEffect, useCallback } from "react";
import GraphStage from "@/components/graph/GraphStage";
import GraphControls from "@/components/graph/GraphControls";
import NLSearchBar from "@/components/search/NLSearchBar";
import EntityInspector from "@/components/sidebar/EntityInspector";
import { FocusGroupModal } from "@/components/focusgroup/FocusGroupModal";
import { CreativeStudioPanel } from "@/components/creative/CreativeStudioPanel";
import CampaignBriefModal from "@/components/brief/CampaignBriefModal";
import SeasonJourneySankey from "@/components/journey/SeasonJourneySankey";
import NBAMarketMap from "@/components/map/NBAMarketMap";
import ActivationFeed from "@/components/activation/ActivationFeed";
import ActivationDAG from "@/components/activation/ActivationDAG";
import CourtsideLanding from "@/components/landing/CourtsideLanding";
/* v2 storyline shell (Home / Design System agent). Contract: docs/v2/CONTRACT.md */
import { V2Shell } from "@/components/v2/shell/V2Shell";
import { StorylineProvider } from "@/components/v2/shell/StorylineProvider";
import { SaveAudienceSheet } from "@/components/audience/SaveAudienceSheet";
import { SavedAudiencesDrawer } from "@/components/audience/SavedAudiencesDrawer";
import SpannerStatusPill from "@/components/common/SpannerStatusPill";
import EnterpriseArchitectureModal, {
  EnterpriseArchitectureButton,
} from "@/components/common/EnterpriseArchitectureModal";
import {
  GraphData,
  GraphNode,
  ContextualViewType,
  GameFranchise,
  FocusGroupResult,
  CampaignBrief,
  CohortContext,
  SavedAudience,
  SegmentationLens,
} from "@/lib/types";
import { summarizePlayers } from "@/lib/segment";
import { buildLensContext, classifyNodeForLens, computeKeystoneCaptains } from "@/lib/lens";
import {
  ArrowLeft,
  Database,
  Palette,
  Radio,
  Users,
  X,
} from "lucide-react";

/* v2: StorylineProvider wraps the whole app so the storyline state (step,
   selected player, selected crews) survives trips into the graph workspace. */
export default function HomePage() {
  return (
    <StorylineProvider>
      <CourtsideApp />
    </StorylineProvider>
  );
}

function CourtsideApp() {
  const [showLanding, setShowLanding] = useState<boolean>(true);
  /* v2: the storyline Home is the default landing; "Classic" shows the previous one. */
  const [storylineMode, setStorylineMode] = useState<boolean>(true);
  const [currentView, setCurrentView] =
    useState<ContextualViewType>("audience-cohorts");
  const [selectedGame, setSelectedGame] = useState<GameFranchise>("ALL");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("ALL");
  const [is3D, setIs3D] = useState<boolean>(false);
  const [clusterByLabel, setClusterByLabel] = useState<boolean>(false);
  const [highlightBridges, setHighlightBridges] = useState<boolean>(false);
  const [segmentationLens, setSegmentationLens] =
    useState<SegmentationLens>("FRANCHISE");

  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [baseGraphData, setBaseGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);

  // Audience Builder / NL Search state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSegmentedView, setIsSegmentedView] = useState<boolean>(false);
  const [cohortContext, setCohortContext] = useState<CohortContext | null>(
    null
  );
  const [generatedGql, setGeneratedGql] = useState<string>("");
  const [whereClause, setWhereClause] = useState<string>("");
  const [matchPattern, setMatchPattern] = useState<string>("");
  const [conditions, setConditions] = useState<any[]>([]);
  const [translateMs, setTranslateMs] = useState<number>(0);
  const [executionMs, setExecutionMs] = useState<number>(0);
  const [modelUsed, setModelUsed] = useState<string>("live-telemetry-eval");
  const [builderError, setBuilderError] = useState<string | null>(null);
  // Graph workspace load errors (Spanner / API) are shown on the canvas, never hidden.
  const [graphError, setGraphError] = useState<string | null>(null);
  // Manual segmentation: players picked with Shift+click on the canvas.
  const [manualIds, setManualIds] = useState<Set<string>>(new Set());

  // Saved Audiences count
  const [savedAudiencesCount, setSavedAudiencesCount] = useState<number>(3);

  // Modals & Drawers
  const [isFocusGroupOpen, setIsFocusGroupOpen] = useState<boolean>(false);
  const [isFocusGroupLoading, setIsFocusGroupLoading] =
    useState<boolean>(false);
  const [isFindingTwins, setIsFindingTwins] = useState<boolean>(false);
  const [focusGroupResult, setFocusGroupResult] =
    useState<FocusGroupResult | null>(null);
  const [offerPreset, setOfferPreset] = useState<{
    title: string;
    priceUsd: number;
    altPriceUsd?: number;
  } | null>({
    title: "Crew Re-Up Bundle",
    priceUsd: 4.99,
  });

  const [isCreativeStudioOpen, setIsCreativeStudioOpen] =
    useState<boolean>(false);
  const [creativeOfferTitle, setCreativeOfferTitle] = useState<string>(
    "Crew Re-Up Bundle"
  );

  const [activeBrief, setActiveBrief] = useState<CampaignBrief | null>(null);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState<boolean>(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);

  const [isSaveSheetOpen, setIsSaveSheetOpen] = useState<boolean>(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState<boolean>(false);
  const [isActivationFeedOpen, setIsActivationFeedOpen] =
    useState<boolean>(false);
  const [isActivationDagOpen, setIsActivationDagOpen] =
    useState<boolean>(false);

  // Fetch saved audiences count
  useEffect(() => {
    fetch("/api/audiences/saved", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.audiences)) {
          setSavedAudiencesCount(d.audiences.length);
        }
      })
      .catch(() => {});
  }, [isSaveSheetOpen, isSavedDrawerOpen]);

  const fetchGraphView = useCallback(
    async (
      view: ContextualViewType,
      game: GameFranchise,
      archetype: string,
      selectPlayerId?: string
    ) => {
      try {
        const params = new URLSearchParams({ view, game, archetype });
        if (selectPlayerId) params.set("playerId", selectPlayerId);
        const res = await fetch(`/api/graph/view?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setGraphError(
            `Graph view failed (HTTP ${res.status}): ${data?.error || "unknown error"}`
          );
          return;
        }
        if (data.nodes) {
          setGraphError(null);
          setManualIds(new Set());
          const nextGraph = { nodes: data.nodes, links: data.links || [] };
          setGraphData(nextGraph);
          setBaseGraphData(nextGraph);
          if (data.execution_ms) setExecutionMs(data.execution_ms);
          if (selectPlayerId) {
            const found = (data.nodes as GraphNode[]).find(
              (n) => n.id === selectPlayerId
            );
            if (found) {
              setSelectedNode(found);
              setIsInspectorOpen(true);
            }
          }
        }
      } catch (e: any) {
        console.error("Error fetching graph view:", e);
        setGraphError(`Graph view request failed: ${e?.message || String(e)}`);
      }
    },
    []
  );

  useEffect(() => {
    if (!isSegmentedView) {
      fetchGraphView(currentView, selectedGame, archetypeFilter);
    }
  }, [
    currentView,
    selectedGame,
    archetypeFilter,
    isSegmentedView,
    fetchGraphView,
  ]);

  // Execute NL Audience Builder Query
  const runAudienceQuery = useCallback(
    async (
      query: string,
      franchise: GameFranchise = selectedGame,
      excludeConditionIds: string[] = [],
      openGraphAfter = false
    ) => {
      setIsSearching(true);
      setBuilderError(null);
      try {
        const res = await fetch("/api/audiences/nl-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            franchise,
            excludeConditions: excludeConditionIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBuilderError(data?.error || `Query failed (${res.status})`);
          return;
        }

        const nextGraph = { nodes: data.nodes || [], links: data.links || [] };
        setGraphData(nextGraph);
        setBaseGraphData(nextGraph);
        setGeneratedGql(data.generated_gql || "");
        setWhereClause(data.where_clause || "");
        setMatchPattern(
          data.aggregate_metrics?.multi_hop_metadata?.patternLabel || ""
        );
        setConditions(data.conditions || []);
        setTranslateMs(data.translate_ms || 0);
        setExecutionMs(data.execution_ms || 0);
        setModelUsed(data.model_used || "live-telemetry-eval");

        const metrics = data.aggregate_metrics || {};
        setCohortContext({
          query,
          franchise,
          matchedCount: metrics.matched_count || 0,
          renderedCount: metrics.rendered_count || 0,
          isSampled: metrics.is_sampled,
          estimatedTotal: metrics.matched_count || 0,
          dominantArchetype: metrics.dominant_archetype || "",
          avgSpend: metrics.avg_spend_usd,
          avgChurn: metrics.avg_churn_risk,
          avgTilt: metrics.avg_tilt,
          highChurnCount: metrics.high_churn_count,
          isLive: true,
          source: metrics.spanner_source,
          isMultiHop: metrics.is_multi_hop,
          multiHopMetadata: metrics.multi_hop_metadata,
        });

        setIsSegmentedView(true);
        setIsInspectorOpen(true);

        if (openGraphAfter) {
          setCurrentView("audience-cohorts");
          setShowLanding(false);
        }
      } catch (e: any) {
        setBuilderError(e?.message || "Failed to execute audience query.");
      } finally {
        setIsSearching(false);
      }
    },
    [selectedGame]
  );

  // Listen for CustomEvents from NBAMarketMap (`courtside:run-query`) and player selection (`courtside:select-player`)
  useEffect(() => {
    const onCustomQuery = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.query) {
        runAudienceQuery(detail.query, detail.franchise || "ALL", [], true);
      }
    };
    const onSelectPlayerEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      const pid = detail?.playerId;
      if (!pid) return;
      const found = graphData.nodes.find((n) => n.id === pid);
      if (found) {
        setSelectedNode(found);
        setIsInspectorOpen(true);
        setShowLanding(false);
      } else {
        setCurrentView("single-identity");
        fetchGraphView("single-identity", selectedGame, "ALL", pid);
        setShowLanding(false);
      }
    };

    window.addEventListener("courtside:run-query", onCustomQuery);
    window.addEventListener("courtside:select-player", onSelectPlayerEvent);
    return () => {
      window.removeEventListener("courtside:run-query", onCustomQuery);
      window.removeEventListener(
        "courtside:select-player",
        onSelectPlayerEvent
      );
    };
  }, [runAudienceQuery, graphData.nodes, fetchGraphView, selectedGame]);

  const handleLaunchPlay = (
    playNumber: 1 | 2 | 3,
    query: string,
    franchise: GameFranchise,
    preset: { title: string; priceUsd: number; altPriceUsd?: number }
  ) => {
    setSelectedGame(franchise);
    setOfferPreset(preset);
    setCreativeOfferTitle(preset.title);
    setClusterByLabel(playNumber === 2);
    setHighlightBridges(false);
    runAudienceQuery(query, franchise, [], true);
  };

  const handleExploreSocialHops = useCallback(
    async (
      targetPlayerId?: string,
      hopDepth: "all" | "1" | "2" | "3" = "all"
    ) => {
      try {
        const params = new URLSearchParams({
          view: "social-hops",
          game: selectedGame,
          hop: hopDepth,
        });
        if (targetPlayerId) params.set("playerId", targetPlayerId);
        const res = await fetch(`/api/graph/view?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          setGraphError(
            `Social hops failed (HTTP ${res.status}): ${data?.error || "unknown error"}`
          );
          return;
        }
        setGraphError(null);
        if (data?.nodes?.length) {
          const nextGraph = { nodes: data.nodes, links: data.links || [] };
          setGraphData(nextGraph);
          setBaseGraphData(nextGraph);
          setCurrentView("social-hops");
          setSegmentationLens("SOCIAL_HOPS");
          setIsSegmentedView(true);
          setManualIds(new Set());
          setHighlightBridges(false);
          setIsInspectorOpen(true);

          const summary = data.social_hop_summary || {};
          const egoTag = String(summary.ego_gamer_tag || "");
          const h1 = Number(summary.hop1_count || 0);
          const h2 = Number(summary.hop2_count || 0);
          const h3 = Number(summary.hop3_count || 0);
          const reach = Number(summary.total_network_reach || nextGraph.nodes.length);
          const stats = summarizePlayers(
            nextGraph.nodes.filter((n: GraphNode) => n.type === "PLAYER")
          );
          const edgeKinds: string[] = summary.edge_kinds || [];

          setCohortContext({
            query:
              hopDepth === "1"
                ? `1° ties of @${egoTag} (${h1} players)`
                : hopDepth === "2"
                ? `1°–2° network of @${egoTag} (${1 + h1 + h2} players)`
                : `1°–3° network of @${egoTag} (${reach} players)`,
            franchise: selectedGame,
            matchedCount: reach,
            renderedCount: nextGraph.nodes.length,
            estimatedTotal: reach,
            dominantArchetype: stats.dominantArchetype,
            avgSpend: stats.avgSpend,
            avgChurn: stats.avgChurn,
            avgTilt: stats.avgTilt,
            highChurnCount: stats.highChurnCount,
            isLive: true,
            isMultiHop: true,
            multiHopMetadata: {
              hops: hopDepth === "1" ? 1 : hopDepth === "2" ? 2 : 3,
              patternLabel: `0° @${egoTag} → ${h1} (1°) → ${h2} (2°) → ${h3} (3°)`,
              summary: `Real ${edgeKinds.join(" / ") || "social"} edges from Spanner; 1° ties spend $${Math.round(
                Number(summary.squad_spend_usd || 0)
              ).toLocaleString()} lifetime.`,
              steps: [
                `0° @${egoTag}`,
                `1° ties (${h1})`,
                ...(hopDepth !== "1" ? [`2° ties (${h2})`] : []),
                ...(hopDepth === "all" || hopDepth === "3" ? [`3° ties (${h3})`] : []),
              ],
              bridgeNodes: nextGraph.nodes
                .filter((n: any) => n.type === "PLAYER" && n.id !== summary.ego_player_id)
                .slice(0, 6)
                .map((n: any) => `@${String(n.name).replace(/\s*\(\d°\)$/, "")}`),
            },
          });

          if (targetPlayerId) {
            const egoNode = nextGraph.nodes.find(
              (n: GraphNode) => n.id === targetPlayerId
            );
            if (egoNode) setSelectedNode(egoNode);
          }
        }
      } catch (err) {
        console.error("Failed to load 1st/2nd/3rd hop social graph:", err);
      }
    },
    [selectedGame]
  );

  // Expand a selected player's real 2-hop Spanner neighborhood (Crew, 8 Active Squadmates, Platform Identities, Cross-2K Titles) onto the live graph
  const handleExpandPlayerNeighborhood = useCallback(
    async (playerId: string) => {
      try {
        const res = await fetch(
          `/api/graph/view?view=single-identity&playerId=${encodeURIComponent(
            playerId
          )}&expand=1`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        const incomingNodes: GraphNode[] = data.nodes || [];
        const incomingLinks: any[] = data.links || [];

        setGraphData((prev) => {
          const existingMap = new Map(prev.nodes.map((n) => [n.id, n]));
          incomingNodes.forEach((n) => {
            if (!existingMap.has(n.id)) {
              existingMap.set(n.id, n);
            } else if (n.id === playerId) {
              existingMap.set(n.id, { ...existingMap.get(n.id)!, ...n });
            }
          });
          const mergedNodes = Array.from(existingMap.values());

          const linkKey = (l: any) => {
            const s = typeof l.source === "object" ? l.source.id : String(l.source);
            const t = typeof l.target === "object" ? l.target.id : String(l.target);
            return `${s}->${t}:${l.label || ""}`;
          };
          const seenLinks = new Set(prev.links.map(linkKey));
          const mergedLinks = [...prev.links];
          incomingLinks.forEach((l) => {
            const k = linkKey(l);
            if (!seenLinks.has(k)) {
              seenLinks.add(k);
              mergedLinks.push(l);
            }
          });

          return { nodes: mergedNodes, links: mergedLinks };
        });

        const enrichedSelf = incomingNodes.find((n) => n.id === playerId);
        if (enrichedSelf) {
          setSelectedNode((prev) =>
            prev && prev.id === playerId ? { ...prev, ...enrichedSelf } : prev
          );
        }
      } catch (err) {
        console.error("Failed to expand player 2-hop neighborhood:", err);
      }
    },
    []
  );

  // Filter / Prune the live graph & cohort by Spanner CATE Decision Segment
  const handleApplyDecisionFilter = useCallback(
    (
      segment: "ALL" | "PERSUADABLE" | "CAPTAIN" | "SURE_THING" | "SLEEPING_DOG",
      recommendedOffer?: { title: string; priceUsd: number }
    ) => {
      if (recommendedOffer && recommendedOffer.title) {
        setOfferPreset({
          title: recommendedOffer.title,
          priceUsd: recommendedOffer.priceUsd,
        });
        setCreativeOfferTitle(recommendedOffer.title);
      }

      const sourceGraph =
        baseGraphData.nodes.length > 0 ? baseGraphData : graphData;
      if (segment === "ALL") {
        setGraphData(sourceGraph);
        return;
      }

      // Same CATE lens rules as the canvas and the inspector (src/lib/lens.ts),
      // so the pruned graph always matches the counts on the buttons.
      const playerNodes = sourceGraph.nodes.filter((n) => n.type === "PLAYER");
      const lensCtx = buildLensContext(playerNodes);
      const captains = computeKeystoneCaptains(sourceGraph.nodes, sourceGraph.links);
      const allowedPlayerIds = new Set<string>();
      playerNodes.forEach((n) => {
        const bucket = classifyNodeForLens(n, captains, "CATE_UPLIFT", lensCtx)?.bucketId;
        if (segment === "CAPTAIN" && bucket === "SEED_CREW_CAPTAIN") allowedPlayerIds.add(n.id);
        else if (
          segment === "PERSUADABLE" &&
          (bucket === "PERSUADABLE" || bucket === "SEED_CREW_CAPTAIN")
        )
          allowedPlayerIds.add(n.id);
        else if (segment === "SURE_THING" && bucket === "SURE_THING_D2C") allowedPlayerIds.add(n.id);
        else if (segment === "SLEEPING_DOG" && bucket === "SLEEPING_DOG") allowedPlayerIds.add(n.id);
      });

      const playerIdSet = new Set(playerNodes.map((n) => n.id));
      const connectedNonPlayerIds = new Set<string>();
      const filteredLinks = sourceGraph.links.filter((l: any) => {
        const s = typeof l.source === "object" ? l.source.id : String(l.source);
        const t = typeof l.target === "object" ? l.target.id : String(l.target);
        const sIsAllowedPlayer = allowedPlayerIds.has(s);
        const tIsAllowedPlayer = allowedPlayerIds.has(t);
        if (sIsAllowedPlayer && !playerIdSet.has(t)) {
          connectedNonPlayerIds.add(t);
          return true;
        }
        if (tIsAllowedPlayer && !playerIdSet.has(s)) {
          connectedNonPlayerIds.add(s);
          return true;
        }
        if (sIsAllowedPlayer && tIsAllowedPlayer) return true;
        return false;
      });

      const filteredNodes = sourceGraph.nodes.filter(
        (n) =>
          (n.type === "PLAYER" && allowedPlayerIds.has(n.id)) ||
          (n.type !== "PLAYER" && connectedNonPlayerIds.has(n.id))
      );

      if (filteredNodes.length > 0) {
        setGraphData({ nodes: filteredNodes, links: filteredLinks });
      }
    },
    [baseGraphData, graphData]
  );

  // Manual segmentation: Shift+click toggles a player; "Build segment" turns the
  // picked players (plus the titles / crews / creators they connect to on the
  // canvas) into a cohort whose analytics are computed from their Spanner rows.
  const toggleManualSelect = useCallback((node: GraphNode) => {
    setManualIds((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, []);

  const buildManualSegment = useCallback(() => {
    const idOf = (v: any) => (typeof v === "object" && v ? v.id : String(v));
    const nodeById = new Map(graphData.nodes.map((n) => [n.id, n]));
    const picked = graphData.nodes.filter(
      (n) => n.type === "PLAYER" && manualIds.has(n.id)
    );
    if (picked.length === 0) return;
    const keep = new Set(picked.map((n) => n.id));
    const segLinks = graphData.links
      .map((l) => ({ ...l, source: idOf(l.source), target: idOf(l.target) }))
      .filter((l) => {
        const sIn = keep.has(l.source as string);
        const tIn = keep.has(l.target as string);
        if (!sIn && !tIn) return false;
        const sPlayer = nodeById.get(l.source as string)?.type === "PLAYER";
        const tPlayer = nodeById.get(l.target as string)?.type === "PLAYER";
        // Player-to-player edges only when both ends were picked.
        return sPlayer && tPlayer ? sIn && tIn : true;
      });
    segLinks.forEach((l) => {
      keep.add(l.source as string);
      keep.add(l.target as string);
    });
    const segNodes = graphData.nodes.filter((n) => keep.has(n.id));
    const stats = summarizePlayers(picked);
    const studioLabel = stats.studioMix
      .map((m) => `${m.studio === "ROCKSTAR" ? "Rockstar" : m.studio === "ZYNGA" ? "Zynga" : "2K"} ${m.players}`)
      .join(" · ");
    const nextGraph = { nodes: segNodes, links: segLinks };
    setGraphData(nextGraph);
    setBaseGraphData(nextGraph);
    setCohortContext({
      query: `Manual segment · ${picked.length} players (${studioLabel})`,
      franchise: selectedGame,
      matchedCount: picked.length,
      renderedCount: picked.length,
      estimatedTotal: picked.length,
      isSampled: false,
      dominantArchetype: stats.dominantArchetype,
      avgSpend: stats.avgSpend,
      avgChurn: stats.avgChurn,
      avgTilt: stats.avgTilt,
      highChurnCount: stats.highChurnCount,
      isLive: true,
      isManualSegment: true,
      source: "Spanner Players + PLAYS_GAME (canvas selection)",
    });
    setIsSegmentedView(true);
    setSelectedNode(null);
    setIsInspectorOpen(true);
    setManualIds(new Set());
  }, [graphData, manualIds, selectedGame]);

  // Graph Twins: every number shown comes from /api/audiences/lookalike, which
  // ranks all players in Spanner by cosine similarity to the seed centroid.
  const applyTwinsPayload = useCallback(
    (twinsPayload: any, seedLabel: string, selectPlayerId?: string) => {
      const nextGraph = {
        nodes: twinsPayload.graph_data?.nodes || [],
        links: twinsPayload.graph_data?.links || [],
      };
      setGraphData(nextGraph);
      setBaseGraphData(nextGraph);
      setShowLanding(false);
      setCurrentView("audience-cohorts");
      setIsSegmentedView(true);
      setHighlightBridges(false);
      setIsInspectorOpen(true);
      setManualIds(new Set());
      setGraphError(null);

      const added = Number(twinsPayload.added_count);
      const range = twinsPayload.similarity_range;
      const rangeText = range
        ? `cosine ${Number(range.min).toFixed(3)}–${Number(range.max).toFixed(3)}`
        : "no players selected";
      setCohortContext({
        query: `Graph twins of ${seedLabel} (+${added.toLocaleString()})`,
        franchise: selectedGame,
        matchedCount: added,
        renderedCount: Number(twinsPayload.rendered_count || 0),
        isSampled: Number(twinsPayload.rendered_count || 0) < added,
        estimatedTotal: added,
        dominantArchetype: twinsPayload.twins_dominant_archetype || "",
        avgSpend: twinsPayload.twins_avg_spend_usd ?? undefined,
        avgChurn: twinsPayload.twins_avg_churn ?? undefined,
        highChurnCount: twinsPayload.twins_high_churn_count ?? undefined,
        isLive: true,
        isMultiHop: true,
        source: "Spanner (all players scored)",
        multiHopMetadata: {
          hops: 1,
          patternLabel: `${Number(twinsPayload.seed_count)} seed players → ${added.toLocaleString()} twins (${twinsPayload.selection}, ${rangeText})`,
          summary: `${twinsPayload.method} Scored ${Number(twinsPayload.players_scored).toLocaleString()} players.`,
          steps: [
            `${Number(twinsPayload.seed_count)} seeds`,
            `${Number(twinsPayload.players_scored).toLocaleString()} players scored`,
            `+${added.toLocaleString()} twins`,
          ],
          bridgeNodes: (twinsPayload.top_twins || [])
            .slice(0, 6)
            .map((t: any) => `@${String(t.gamer_tag).replace(/^@/, "")}`),
        },
      });
      if (selectPlayerId) {
        const found = nextGraph.nodes.find((n: any) => n.id === selectPlayerId);
        setSelectedNode(found || null);
      } else {
        setSelectedNode(null);
      }
    },
    [selectedGame]
  );

  const handleFindGraphTwins = useCallback(
    async (seedNode?: GraphNode | null) => {
      const playerNodes = graphData.nodes.filter((n) => n.type === "PLAYER");
      // Seed = the selected player, otherwise every player of the current cohort on canvas.
      const seedIds =
        seedNode && seedNode.type === "PLAYER"
          ? [seedNode.id]
          : playerNodes.slice(0, 500).map((n) => n.id);
      if (seedIds.length === 0) {
        setGraphError("Graph Twins needs a seed: select a player or load a cohort first.");
        return;
      }
      setIsFindingTwins(true);
      try {
        const res = await fetch("/api/audiences/lookalike", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed_player_ids: seedIds,
            matched_count:
              seedNode && seedNode.type === "PLAYER"
                ? undefined
                : cohortContext?.matchedCount || playerNodes.length,
            expansion_pct: seedNode && seedNode.type === "PLAYER" ? undefined : 25,
          }),
        });
        const twinsPayload = await res.json();
        if (!res.ok || !twinsPayload?.ok) {
          setGraphError(
            `Graph Twins failed (HTTP ${res.status}): ${twinsPayload?.error || "unknown error"}`
          );
          return;
        }
        applyTwinsPayload(
          twinsPayload,
          seedNode && seedNode.type === "PLAYER"
            ? `@${seedNode.name}`
            : cohortContext?.query || `${seedIds.length} players`
        );
      } catch (err: any) {
        console.error("Failed to expand Graph Twins:", err);
        setGraphError(`Graph Twins request failed: ${err?.message || String(err)}`);
      } finally {
        setIsFindingTwins(false);
      }
    },
    [graphData.nodes, cohortContext, applyTwinsPayload]
  );

  const handleGenerateBrief = async (fgResult: FocusGroupResult) => {
    setIsGeneratingBrief(true);
    try {
      const res = await fetch("/api/campaign/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchise: fgResult.franchise || selectedGame,
          cohort_query:
            fgResult.target_cohort_query ||
            cohortContext?.query ||
            "NBA 2K27 Season 1 Retention Segment",
          audience_size: cohortContext?.matchedCount,
          focus_group_result: fgResult,
        }),
      });
      if (res.ok) {
        const brief = await res.json();
        setActiveBrief(brief);
        setIsFocusGroupOpen(false);
        setIsBriefModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to generate brief:", e);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  if (showLanding) {
    return (
      <>
        {storylineMode ? (
          <V2Shell
            homeProps={{
              onSearch: (q, f) => {
                const fr = (f as GameFranchise) || selectedGame;
                setSelectedGame(fr);
                runAudienceQuery(q, fr, [], true);
              },
              isSearching,
              searchError: builderError,
              onDismissSearchError: () => setBuilderError(null),
              onOpenCreativeStudio: () => setIsCreativeStudioOpen(true),
            }}
            onExplore={() => {
              setIsSegmentedView(false);
              setCohortContext(null);
              setSelectedNode(null);
              setArchetypeFilter("ALL");
              setCurrentView("audience-cohorts");
              setShowLanding(false);
            }}
            onClassic={() => setStorylineMode(false)}
          />
        ) : (
        <>
        <button
          type="button"
          onClick={() => setStorylineMode(true)}
          className="v2-press fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[12.5px] font-medium text-[var(--text)] shadow-[var(--shadow-lg)] hover:bg-[var(--surface-hover)]"
        >
          <ArrowLeft size={14} />
          Back to storyline
        </button>
        <CourtsideLanding
          onSearchQuery={(q, f) => {
            setSelectedGame(f);
            runAudienceQuery(q, f, [], true);
          }}
          onExploreFullGraph={(f) => {
            setIsSegmentedView(false);
            setCohortContext(null);
            setSelectedNode(null);
            setSelectedGame(f);
            setArchetypeFilter("ALL");
            setCurrentView("audience-cohorts");
            setShowLanding(false);
          }}
          onOpenMarketingJourney={() => {
            setCurrentView("marketing-journey");
            setShowLanding(false);
          }}
          onOpenGeoMap={() => {
            setCurrentView("geo-map");
            setShowLanding(false);
          }}
          onOpenA2A={() => setIsActivationFeedOpen(true)}
          isLoading={isSearching}
          errorText={builderError || ""}
          onDismissError={() => setBuilderError(null)}
          selectedGame={selectedGame}
          onGameChange={setSelectedGame}
          onRunBuilderQuery={(q, f, ex) => runAudienceQuery(q, f, ex, true)}
          onLaunchPlay={handleLaunchPlay}
          onOpenWorkspaceView={(view) => {
            setCurrentView(view);
            if (view === "cross-franchise") setClusterByLabel(true);
            setShowLanding(false);
          }}
          onOpenSavedAudiences={() => setIsSavedDrawerOpen(true)}
          onOpenActivationFeed={() => setIsActivationFeedOpen(true)}
          onOpenFocusGroup={() => setIsFocusGroupOpen(true)}
          onSaveAudience={() => setIsSaveSheetOpen(true)}
          isSearching={isSearching}
          matchedCount={cohortContext?.matchedCount ?? 0}
          renderedCount={cohortContext?.renderedCount ?? 0}
          executionMs={executionMs}
          translateMs={translateMs}
          modelUsed={modelUsed}
          generatedGql={generatedGql}
          whereClause={whereClause}
          matchPattern={matchPattern}
          conditions={conditions}
          errorMessage={builderError}
        />
        </>
        )}

        <FocusGroupModal
          isOpen={isFocusGroupOpen}
          onClose={() => setIsFocusGroupOpen(false)}
          targetNode={selectedNode}
          cohortContext={cohortContext}
          selectedGame={selectedGame}
          graphData={graphData}
          initialResult={focusGroupResult}
          initialCreativeTitle={offerPreset?.title}
          initialFranchise={selectedGame}
          isGeneratingBrief={isGeneratingBrief}
          onGenerateBrief={handleGenerateBrief}
          onOpenCreativeStudio={(title) => {
            setCreativeOfferTitle(title);
            setIsFocusGroupOpen(false);
            setIsCreativeStudioOpen(true);
          }}
          offerPreset={offerPreset}
        />

        <CreativeStudioPanel
          isOpen={isCreativeStudioOpen}
          onClose={() => setIsCreativeStudioOpen(false)}
          audienceName={
            cohortContext?.query?.slice(0, 64) ||
            "Season 2 Cliff · Active Crew Mates"
          }
          offerTitle={creativeOfferTitle}
          cohortContext={cohortContext}
          onApproved={() => {
            setIsCreativeStudioOpen(false);
            setIsActivationDagOpen(true);
          }}
        />

        <SaveAudienceSheet
          isOpen={isSaveSheetOpen}
          onClose={() => setIsSaveSheetOpen(false)}
          cohortContext={cohortContext}
          generatedGql={generatedGql}
          seedPlayerIds={graphData.nodes.filter((n) => n.type === "PLAYER").map((n) => n.id)}
        />

        <SavedAudiencesDrawer
          isOpen={isSavedDrawerOpen}
          onClose={() => setIsSavedDrawerOpen(false)}
          onSelectAudience={(aud: SavedAudience) => {
            runAudienceQuery(
              aud.nl_query,
              (aud.franchise as GameFranchise) || "ALL",
              [],
              true
            );
          }}
          onActivateAudience={(aud: SavedAudience) => {
            setCohortContext({
              query: aud.nl_query,
              matchedCount: aud.matched_count,
              estimatedTotal: aud.matched_count,
              dominantArchetype: aud.dominant_archetype || "",
              avgSpend: aud.avg_spend ?? undefined,
              isLive: true,
            });
            setIsActivationDagOpen(true);
          }}
        />

        <ActivationFeed
          isOpen={isActivationFeedOpen}
          onClose={() => setIsActivationFeedOpen(false)}
        />

        <CampaignBriefModal
          brief={activeBrief}
          isOpen={isBriefModalOpen}
          onClose={() => setIsBriefModalOpen(false)}
          onApproveAndDeploy={() => {
            setIsBriefModalOpen(false);
            setIsActivationDagOpen(true);
          }}
        />

        <ActivationDAG
          isOpen={isActivationDagOpen}
          onClose={() => setIsActivationDagOpen(false)}
          audienceId={`aud-${Date.now()}`}
          audienceName={
            cohortContext?.query?.slice(0, 72) ||
            "Season 2 Cliff · Active Crew Mates"
          }
          matchedCount={cohortContext?.matchedCount ?? 0}
          selectedChannels={[
            "IN_GAME_INBOX",
            "2K_ACCOUNT_EMAIL",
            "PUSH_2K_MOBILE",
          ]}
          nlQuery={cohortContext?.query}
        />
      </>
    );
  }

  return (
    <main className="flex flex-col w-screen h-screen overflow-hidden bg-[#06080E] text-white font-sans antialiased select-none">
      {/* Unified 52px Apple HUD Top Bar */}
      <header className="h-[52px] shrink-0 z-30 flex items-center justify-between gap-3 px-4 bg-[#080B12]/90 backdrop-blur-2xl border-b border-white/[0.07]">
        {/* Left: Back to Search + Inline GraphControls */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowLanding(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-white transition-all group shrink-0"
            title="Return to Search"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Search</span>
          </button>

          <GraphControls
            currentView={currentView}
            onViewChange={(v) => setCurrentView(v)}
            selectedGame={selectedGame}
            onGameChange={(g) => {
              setSelectedGame(g);
              setIsSegmentedView(false);
              setCohortContext(null);
            }}
            archetypeFilter={archetypeFilter}
            onArchetypeChange={(a) => {
              setArchetypeFilter(a);
              setIsSegmentedView(false);
              setCohortContext(null);
            }}
            segmentationLens={segmentationLens}
            onLensChange={(nextLens) => {
              setSegmentationLens(nextLens);
              if (nextLens === "SOCIAL_HOPS") {
                handleExploreSocialHops(
                  selectedNode?.type === "PLAYER" ? selectedNode.id : undefined,
                  "all"
                );
              } else if (currentView === "social-hops") {
                setCurrentView("audience-cohorts");
                setIsSegmentedView(false);
                fetchGraphView("audience-cohorts", selectedGame, archetypeFilter);
              }
            }}
            is3D={is3D}
            onToggle3D={() => setIs3D((v) => !v)}
            clusterByLabel={clusterByLabel}
            onToggleClusterByLabel={() => setClusterByLabel((v) => !v)}
            highlightBridges={highlightBridges}
            onToggleHighlightBridges={() => setHighlightBridges((v) => !v)}
            isInspectorOpen={isInspectorOpen}
            nodeCount={graphData.nodes.length}
            edgeCount={graphData.links.length}
          />
        </div>

        {/* Right: Telemetry & Consolidated Action Group */}
        <div className="flex items-center gap-2 shrink-0">
          <SpannerStatusPill />

          <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.08] p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setIsSavedDrawerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved ({savedAudiencesCount})</span>
            </button>

            <span className="h-3.5 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => setIsFocusGroupOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/15 transition-all"
            >
              <Users className="w-3.5 h-3.5 text-amber-300" />
              <span>Focus Group</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreativeStudioOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setIsActivationFeedOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>Activate</span>
            </button>
          </div>

          <EnterpriseArchitectureButton onClick={() => setIsArchModalOpen(true)} />
        </div>
      </header>

      {/* Stage Container below the 52px header */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div className="w-full h-full">
          {currentView === "marketing-journey" ? (
            <SeasonJourneySankey
              graphData={graphData}
              onSelectPlayer={(playerId: string) => {
                const found = graphData.nodes.find((n) => n.id === playerId);
                if (found) {
                  setSelectedNode(found);
                  setIsInspectorOpen(true);
                  setCurrentView("audience-cohorts");
                } else {
                  setCurrentView("single-identity");
                  fetchGraphView(
                    "single-identity",
                    selectedGame,
                    "ALL",
                    playerId
                  );
                }
              }}
              onPressureTest={(cohortTitle: string, query: string) => {
                setCreativeOfferTitle(cohortTitle);
                runAudienceQuery(query, "NBA2K", [], false);
                setIsFocusGroupOpen(true);
              }}
              onActivate={() => setIsActivationDagOpen(true)}
              onReturnToGraph={() => setCurrentView("audience-cohorts")}
            />
          ) : currentView === "geo-map" ? (
            <NBAMarketMap
              onReturnToGraph={() => setCurrentView("audience-cohorts")}
            />
          ) : (
            <GraphStage
              data={graphData}
              is3D={is3D}
              selectedNode={selectedNode}
              onNodeClick={(node) => {
                setSelectedNode(node);
                setIsInspectorOpen(true);
              }}
              cohortContext={cohortContext}
              clusterByLabel={clusterByLabel}
              highlightBridges={highlightBridges}
              segmentationLens={segmentationLens}
              manualSelectionIds={manualIds}
              onToggleManualSelect={toggleManualSelect}
            />
          )}
        </div>

        {graphError && (
          <div
            role="alert"
            className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-[640px] rounded-xl border border-rose-500/40 bg-rose-950/80 px-3.5 py-2 text-[11.5px] text-rose-100 shadow-2xl"
          >
            {graphError}
          </div>
        )}

        {manualIds.size > 0 && (
          <div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-[#0B0E15]/95 px-3 py-1.5 text-[11.5px] text-white shadow-2xl"
            data-testid="manual-segment-chip"
          >
            <span className="font-mono tabular-nums">{manualIds.size} selected</span>
            <span className="h-3 w-px bg-white/15" />
            <button
              type="button"
              onClick={buildManualSegment}
              className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-white/90"
            >
              Build segment
            </button>
            <button
              type="button"
              onClick={() => setManualIds(new Set())}
              className="rounded-lg px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        {/* Floating Bottom-Center NL Search Bar */}
        {(currentView === "audience-cohorts" ||
          currentView === "cross-franchise" ||
          currentView === "social-clans" ||
          currentView === "single-identity" ||
          currentView === "social-hops") && (
          <NLSearchBar
            selectedGame={selectedGame}
            isInspectorOpen={
              isInspectorOpen &&
              Boolean(selectedNode || isSegmentedView || cohortContext)
            }
            onSearchResults={(
              newGraphData,
              _summary,
              gql,
              metrics,
              queryPrompt,
              raw
            ) => {
              setGraphData(newGraphData);
              setBaseGraphData(newGraphData);
              setGeneratedGql(gql);
              setIsSegmentedView(true);
              setIsInspectorOpen(true);
              setCohortContext({
                query: queryPrompt || "Segmented cohort",
                franchise: selectedGame,
                matchedCount:
                  metrics?.matched_count || newGraphData.nodes.length,
                renderedCount:
                  metrics?.rendered_count || newGraphData.nodes.length,
                isSampled: metrics?.is_sampled,
                estimatedTotal:
                  metrics?.matched_count || newGraphData.nodes.length,
                dominantArchetype: metrics?.dominant_archetype || "",
                avgSpend: metrics?.avg_spend_usd,
                avgChurn: metrics?.avg_churn_risk,
                avgTilt: metrics?.avg_tilt,
                highChurnCount: metrics?.high_churn_count,
                isLive: true,
                source: metrics?.spanner_source,
                isMultiHop: metrics?.is_multi_hop,
                multiHopMetadata: metrics?.multi_hop_metadata,
              });
              if (raw?.conditions) setConditions(raw.conditions);
            }}
            onLaunchFocusGroup={() => setIsFocusGroupOpen(true)}
            onFindGraphTwins={() => handleFindGraphTwins(selectedNode)}
            isFindingTwins={isFindingTwins}
            cohortContext={cohortContext}
            isLoading={isSearching}
            setIsLoading={setIsSearching}
            isFocusGroupLoading={isFocusGroupLoading}
            onResetToMacro={() => {
              setIsSegmentedView(false);
              setCohortContext(null);
              setSelectedNode(null);
              fetchGraphView(currentView, selectedGame, archetypeFilter);
            }}
          />
        )}

        {/* Right-Hand Entity & Cohort Inspector */}
        {(selectedNode || isSegmentedView || cohortContext) &&
          isInspectorOpen &&
          currentView !== "marketing-journey" &&
          currentView !== "geo-map" && (
            <EntityInspector
              node={selectedNode}
              cohortContext={cohortContext}
              graphData={graphData}
              onSelectNode={(n) => setSelectedNode(n)}
              onClose={() => {
                if (selectedNode) {
                  setSelectedNode(null);
                } else {
                  setIsInspectorOpen(false);
                }
              }}
              onLaunchFocusGroup={(n) => {
                if (n) setSelectedNode(n);
                setIsFocusGroupOpen(true);
              }}
              onFindGraphTwins={(n) => handleFindGraphTwins(n || selectedNode)}
              isFindingTwins={isFindingTwins}
              onEmitA2A={() => setIsActivationDagOpen(true)}
              onOpenCreativeStudio={() => setIsCreativeStudioOpen(true)}
              onSaveAudience={() => setIsSaveSheetOpen(true)}
              onToggleSocialGravity={() => setHighlightBridges((v) => !v)}
              onExpandPlayerNeighborhood={handleExpandPlayerNeighborhood}
              onExploreSocialHops={handleExploreSocialHops}
              onLaunchSocialPlay={(title, priceUsd) => {
                setOfferPreset({ title, priceUsd });
                setCreativeOfferTitle(title);
                setIsFocusGroupOpen(true);
              }}
              onApplyDecisionFilter={handleApplyDecisionFilter}
              isFocusGroupLoading={isFocusGroupLoading}
            />
          )}

        {/* Collapsed Cohort Chip when Inspector is minimized */}
        {cohortContext &&
          !isInspectorOpen &&
          currentView !== "marketing-journey" &&
          currentView !== "geo-map" && (
            <div className="absolute top-3 right-4 z-30 pointer-events-auto animate-spring-in">
              <div className="apple-glass-heavy flex items-center gap-2 pl-3 pr-2 py-2 rounded-2xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate max-w-[220px]">
                    {cohortContext.query}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    {(cohortContext.matchedCount || 0).toLocaleString()} players
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(true)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-all"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInspectorOpen(true);
                    setIsSegmentedView(false);
                    setCohortContext(null);
                    setSelectedNode(null);
                  }}
                  title="Clear cohort"
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        {/* Subtle Synthetic Data Labeling Badge */}
        <div className="pointer-events-none absolute bottom-2 left-4 z-10 hidden xl:flex items-center gap-1.5 rounded-full bg-black/50 border border-white/[0.06] px-2.5 py-0.5 text-[10px] font-mono text-zinc-400">
          <span>Synthetic EBC Telemetry Cohort · Live GCP Execution</span>
        </div>
      </div>

      {/* Modals & Sheets */}
      <FocusGroupModal
        isOpen={isFocusGroupOpen}
        onClose={() => setIsFocusGroupOpen(false)}
        targetNode={selectedNode}
        cohortContext={cohortContext}
        selectedGame={selectedGame}
        graphData={graphData}
        initialResult={focusGroupResult}
        initialCreativeTitle={offerPreset?.title}
        initialFranchise={selectedGame}
        isGeneratingBrief={isGeneratingBrief}
        onGenerateBrief={handleGenerateBrief}
        onOpenCreativeStudio={(title) => {
          setCreativeOfferTitle(title);
          setIsFocusGroupOpen(false);
          setIsCreativeStudioOpen(true);
        }}
        onOpenGraphTwins={(twinsPayload, selectPlayerId) => {
          if (twinsPayload?.graph_data?.nodes?.length) {
            applyTwinsPayload(twinsPayload, "Focus Group buyers", selectPlayerId);
            setIsFocusGroupOpen(false);
          }
        }}
        offerPreset={offerPreset}
      />

      <CreativeStudioPanel
        isOpen={isCreativeStudioOpen}
        onClose={() => setIsCreativeStudioOpen(false)}
        audienceName={
          cohortContext?.query?.slice(0, 64) ||
          "Season 2 Cliff · Active Crew Mates"
        }
        offerTitle={creativeOfferTitle}
        cohortContext={cohortContext}
        onApproved={() => {
          setIsCreativeStudioOpen(false);
          setIsActivationDagOpen(true);
        }}
      />

      <CampaignBriefModal
        brief={activeBrief}
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        onApproveAndDeploy={() => {
          setIsBriefModalOpen(false);
          setIsActivationDagOpen(true);
        }}
      />

      <SaveAudienceSheet
        isOpen={isSaveSheetOpen}
        onClose={() => setIsSaveSheetOpen(false)}
        cohortContext={cohortContext}
        generatedGql={generatedGql}
        seedPlayerIds={graphData.nodes.filter((n) => n.type === "PLAYER").map((n) => n.id)}
      />

      <SavedAudiencesDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        onSelectAudience={(aud: SavedAudience) => {
          runAudienceQuery(
            aud.nl_query,
            (aud.franchise as GameFranchise) || "ALL",
            [],
            true
          );
        }}
        onActivateAudience={(aud: SavedAudience) => {
          setCohortContext({
            query: aud.nl_query,
            matchedCount: aud.matched_count,
            estimatedTotal: aud.matched_count,
            dominantArchetype: aud.dominant_archetype || "",
            avgSpend: aud.avg_spend ?? undefined,
            isLive: true,
          });
          setIsActivationDagOpen(true);
        }}
      />

      <ActivationFeed
        isOpen={isActivationFeedOpen}
        onClose={() => setIsActivationFeedOpen(false)}
      />

      <ActivationDAG
        isOpen={isActivationDagOpen}
        onClose={() => setIsActivationDagOpen(false)}
        audienceId={`aud-${Date.now()}`}
        audienceName={
          cohortContext?.query?.slice(0, 72) ||
          "Season 2 Cliff · Active Crew Mates"
        }
        matchedCount={cohortContext?.matchedCount ?? 0}
        selectedChannels={[
          "IN_GAME_INBOX",
          "2K_ACCOUNT_EMAIL",
          "PUSH_2K_MOBILE",
        ]}
        nlQuery={cohortContext?.query}
      />

      <EnterpriseArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </main>
  );
}
