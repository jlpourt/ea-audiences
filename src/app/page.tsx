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
import { SaveAudienceSheet } from "@/components/audience/SaveAudienceSheet";
import { SavedAudiencesDrawer } from "@/components/audience/SavedAudiencesDrawer";
import SpannerStatusPill from "@/components/common/SpannerStatusPill";
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
import {
  ArrowLeft,
  Database,
  Palette,
  Radio,
  Users,
  X,
} from "lucide-react";

export default function HomePage() {
  const [showLanding, setShowLanding] = useState<boolean>(true);
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

  // Saved Audiences count
  const [savedAudiencesCount, setSavedAudiencesCount] = useState<number>(3);

  // Modals & Drawers
  const [isFocusGroupOpen, setIsFocusGroupOpen] = useState<boolean>(false);
  const [isFocusGroupLoading, setIsFocusGroupLoading] =
    useState<boolean>(false);
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
        if (res.ok && data.nodes) {
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
      } catch (e) {
        console.error("Error fetching graph view:", e);
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
          dominantArchetype:
            metrics.dominant_archetype || "MYCAREER_STORY_CASUAL",
          avgSpend: metrics.avg_spend_usd || 180,
          avgChurn: metrics.avg_churn_risk || 0.38,
          avgTilt: metrics.avg_tilt || 0.42,
          highChurnCount: metrics.high_churn_count || 0,
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
        runAudienceQuery(detail.query, detail.franchise || "NBA2K", [], true);
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
    setHighlightBridges(playNumber === 1 || playNumber === 2);
    runAudienceQuery(query, franchise, [], true);
  };

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
          priceUsd: recommendedOffer.priceUsd || 4.99,
        });
        setCreativeOfferTitle(recommendedOffer.title);
      }

      const sourceGraph =
        baseGraphData.nodes.length > 0 ? baseGraphData : graphData;
      if (segment === "ALL") {
        setGraphData(sourceGraph);
        return;
      }

      const allowedPlayerIds = new Set<string>();
      sourceGraph.nodes.forEach((n) => {
        if (n.type !== "PLAYER") return;
        const pTel = n.game_telemetry || {};
        const quad = String(pTel.uplift_quadrant || "PERSUADABLE");
        const action = String(
          pTel.decision_action || "DISPATCH_PERSONALIZED_OFFER"
        );
        const role = String(pTel.crew_role || "MEMBER");

        if (segment === "CAPTAIN") {
          if (
            action === "SEED_CREW_CAPTAIN" ||
            role === "CAPTAIN" ||
            n.archetype === "REC_CREW_CAPTAIN"
          ) {
            allowedPlayerIds.add(n.id);
          }
        } else if (segment === "PERSUADABLE") {
          if (quad === "PERSUADABLE" || action === "SEED_CREW_CAPTAIN") {
            allowedPlayerIds.add(n.id);
          }
        } else if (segment === "SURE_THING") {
          if (quad === "SURE_THING") allowedPlayerIds.add(n.id);
        } else if (segment === "SLEEPING_DOG") {
          if (quad === "SLEEPING_DOG") allowedPlayerIds.add(n.id);
        }
      });

      const connectedNonPlayerIds = new Set<string>();
      const filteredLinks = sourceGraph.links.filter((l: any) => {
        const s = typeof l.source === "object" ? l.source.id : String(l.source);
        const t = typeof l.target === "object" ? l.target.id : String(l.target);
        const sIsAllowedPlayer = allowedPlayerIds.has(s);
        const tIsAllowedPlayer = allowedPlayerIds.has(t);
        if (sIsAllowedPlayer && !t.startsWith("p-")) {
          connectedNonPlayerIds.add(t);
          return true;
        }
        if (tIsAllowedPlayer && !s.startsWith("p-")) {
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
          audience_size: cohortContext?.matchedCount || 284,
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
          matchedCount={cohortContext?.matchedCount || 284}
          renderedCount={cohortContext?.renderedCount || 64}
          executionMs={executionMs}
          translateMs={translateMs}
          modelUsed={modelUsed}
          generatedGql={generatedGql}
          whereClause={whereClause}
          matchPattern={matchPattern}
          conditions={conditions}
          errorMessage={builderError}
        />

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
        />

        <SavedAudiencesDrawer
          isOpen={isSavedDrawerOpen}
          onClose={() => setIsSavedDrawerOpen(false)}
          onSelectAudience={(aud: SavedAudience) => {
            runAudienceQuery(
              aud.nl_query,
              (aud.franchise as GameFranchise) || "NBA2K",
              [],
              true
            );
          }}
          onActivateAudience={(aud: SavedAudience) => {
            setCohortContext({
              query: aud.nl_query,
              matchedCount: aud.matched_count,
              estimatedTotal: aud.matched_count,
              dominantArchetype:
                aud.dominant_archetype || "MYCAREER_STORY_CASUAL",
              avgSpend: aud.avg_spend || 180,
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
          matchedCount={cohortContext?.matchedCount || 284}
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
            onLensChange={setSegmentationLens}
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
            />
          )}
        </div>

        {/* Floating Bottom-Center NL Search Bar */}
        {(currentView === "audience-cohorts" ||
          currentView === "cross-franchise" ||
          currentView === "social-clans" ||
          currentView === "single-identity") && (
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
                query: queryPrompt || "Segmented 2K Cohort",
                franchise: selectedGame,
                matchedCount:
                  metrics?.matched_count || newGraphData.nodes.length,
                renderedCount:
                  metrics?.rendered_count || newGraphData.nodes.length,
                isSampled: metrics?.is_sampled,
                estimatedTotal:
                  metrics?.matched_count || newGraphData.nodes.length,
                dominantArchetype:
                  metrics?.dominant_archetype || "MYCAREER_STORY_CASUAL",
                avgSpend: metrics?.avg_spend_usd || 185,
                avgChurn: metrics?.avg_churn_risk || 0.38,
                avgTilt: metrics?.avg_tilt || 0.42,
                highChurnCount: metrics?.high_churn_count || 0,
                isLive: true,
                source: metrics?.spanner_source,
                isMultiHop: metrics?.is_multi_hop,
                multiHopMetadata: metrics?.multi_hop_metadata,
              });
              if (raw?.conditions) setConditions(raw.conditions);
            }}
            onLaunchFocusGroup={() => setIsFocusGroupOpen(true)}
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
              onEmitA2A={() => setIsActivationDagOpen(true)}
              onOpenCreativeStudio={() => setIsCreativeStudioOpen(true)}
              onSaveAudience={() => setIsSaveSheetOpen(true)}
              onToggleSocialGravity={() => setHighlightBridges((v) => !v)}
              onExpandPlayerNeighborhood={handleExpandPlayerNeighborhood}
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
            const nextGraph = {
              nodes: twinsPayload.graph_data.nodes,
              links: twinsPayload.graph_data.links || [],
            };
            setGraphData(nextGraph);
            setBaseGraphData(nextGraph);
            setShowLanding(false);
            setCurrentView("audience-cohorts");
            setIsSegmentedView(true);
            setHighlightBridges(true);
            setIsInspectorOpen(true);
            const addedCount = Number(
              twinsPayload.added_count || twinsPayload.expanded_count || 185
            );
            const expandedTotal = Number(
              twinsPayload.expanded_total ||
                (cohortContext?.matchedCount || 681) + addedCount
            );
            const avgSimPct = (
              Number(twinsPayload.avg_cosine_similarity || 0.942) * 100
            ).toFixed(1);
            setCohortContext({
              query: `ScaNN Graph Twins (+${addedCount} Twins · ${avgSimPct}% Cosine Match)`,
              franchise: selectedGame,
              matchedCount: expandedTotal,
              renderedCount: nextGraph.nodes.filter((n: any) => n.type === "PLAYER")
                .length,
              estimatedTotal: expandedTotal,
              dominantArchetype:
                twinsPayload.top_twins?.[0]?.archetype ||
                cohortContext?.dominantArchetype ||
                "REC_CREW_CAPTAIN",
              avgSpend: cohortContext?.avgSpend || 245,
              avgChurn: cohortContext?.avgChurn || 0.34,
              avgTilt: cohortContext?.avgTilt || 0.36,
              highChurnCount: cohortContext?.highChurnCount || 48,
              isLive: true,
              isMultiHop: true,
              multiHopMetadata: {
                hops: 2,
                patternLabel: `Seed Buyers → Shared Crew / Creator Halo → +${addedCount} ScaNN Graph Twins (${avgSimPct}% Match)`,
                summary: `Expanded high-uplift Focus Group buyers via Vertex AI gemini-embedding-001 (3,072-d) + 1-hop Crew/Creator overlap (+$${Math.round(
                  Number(twinsPayload.incremental_bookings_usd || 12400) / 1000
                )}K Est. Bookings).`,
                steps: [
                  "Focus Group High-Uplift Buyers",
                  "1-Hop Shared Crew & Creator Halo",
                  `+${addedCount} ScaNN 3,072-d Graph Twins`,
                ],
                bridgeNodes: (twinsPayload.top_twins || [])
                  .slice(0, 6)
                  .map((t: any) => `@${String(t.gamer_tag).replace(/^@/, "")}`),
              },
            });
            if (selectPlayerId) {
              const found = nextGraph.nodes.find(
                (n: any) => n.id === selectPlayerId
              );
              if (found) setSelectedNode(found);
            } else {
              setSelectedNode(null);
            }
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
      />

      <SavedAudiencesDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        onSelectAudience={(aud: SavedAudience) => {
          runAudienceQuery(
            aud.nl_query,
            (aud.franchise as GameFranchise) || "NBA2K",
            [],
            true
          );
        }}
        onActivateAudience={(aud: SavedAudience) => {
          setCohortContext({
            query: aud.nl_query,
            matchedCount: aud.matched_count,
            estimatedTotal: aud.matched_count,
            dominantArchetype:
              aud.dominant_archetype || "MYCAREER_STORY_CASUAL",
            avgSpend: aud.avg_spend || 180,
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
        matchedCount={cohortContext?.matchedCount || 284}
        selectedChannels={[
          "IN_GAME_INBOX",
          "2K_ACCOUNT_EMAIL",
          "PUSH_2K_MOBILE",
        ]}
        nlQuery={cohortContext?.query}
      />
    </main>
  );
}
