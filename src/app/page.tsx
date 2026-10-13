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

  const [graphData, setGraphData] = useState<GraphData>({
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
    title: "Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster",
    priceUsd: 4.99,
  });

  const [isCreativeStudioOpen, setIsCreativeStudioOpen] =
    useState<boolean>(false);
  const [creativeOfferTitle, setCreativeOfferTitle] = useState<string>(
    "Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster"
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
          setGraphData({ nodes: data.nodes, links: data.links || [] });
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

        setGraphData({ nodes: data.nodes || [], links: data.links || [] });
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

        {/* Right: Telemetry & Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <SpannerStatusPill />

          <button
            type="button"
            onClick={() => setIsSavedDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium text-gray-200 hover:text-white transition-all"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Saved ({savedAudiencesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFocusGroupOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-amber-300" />
            <span>Focus Group</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreativeStudioOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-all"
          >
            <Palette className="w-3.5 h-3.5 text-cyan-300" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setIsActivationFeedOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-all"
          >
            <Radio className="w-3.5 h-3.5 text-rose-300" />
            <span>Activate</span>
          </button>
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
