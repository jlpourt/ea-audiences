"use client";

import React, { useState, useEffect, useCallback } from "react";
import GraphStage from "@/components/graph/GraphStage";
import GeoAudienceMap from "@/components/map/GeoAudienceMap";
import GraphControls from "@/components/graph/GraphControls";
import NLSearchBar from "@/components/search/NLSearchBar";
import EntityInspector from "@/components/sidebar/EntityInspector";
import DeepSonaModal from "@/components/deepsona/DeepSonaModal";
import CampaignBriefModal from "@/components/brief/CampaignBriefModal";
import A2ANegotiationFeed from "@/components/a2a/A2ANegotiationFeed";
import GeminiLandingStage from "@/components/landing/GeminiLandingStage";
import PlayerMarketingJourneySankey from "@/components/journey/PlayerMarketingJourneySankey";
import SpannerDataSourceToggle, { SpannerDataSource } from "@/components/common/SpannerDataSourceToggle";
import { GraphData, GraphNode, ContextualViewType, GameFranchise, DeepSonaResult, CampaignBrief } from "@/lib/types";
import { Radio, Users, Sparkles, ArrowLeft, Database, Search, Loader2 } from "lucide-react";

export default function CommandCenterPage() {
  const [isLandingView, setIsLandingView] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<SpannerDataSource>("live_spanner");
  const [currentView, setCurrentView] = useState<ContextualViewType>("audience-cohorts");
  const [selectedGame, setSelectedGame] = useState<GameFranchise>("ALL");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("ALL");
  const [is3D, setIs3D] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isSegmentedView, setIsSegmentedView] = useState<boolean>(false);
  const [cohortContext, setCohortContext] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isNlLoading, setIsNlLoading] = useState<boolean>(false);

  // DeepSona Preloading & Loading states
  const [isDeepSonaLoading, setIsDeepSonaLoading] = useState<boolean>(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [deepSonaPreloadedResult, setDeepSonaPreloadedResult] = useState<DeepSonaResult | null>(null);
  const [preloadedCreativeTitle, setPreloadedCreativeTitle] = useState<string>("");
  const [preloadedFranchise, setPreloadedFranchise] = useState<string>("");

  // Modals & Panels state
  const [isDeepSonaOpen, setIsDeepSonaOpen] = useState<boolean>(false);
  const [isBriefOpen, setIsBriefOpen] = useState<boolean>(false);
  const [isA2ABusOpen, setIsA2ABusOpen] = useState<boolean>(false);
  const [currentBrief, setCurrentBrief] = useState<CampaignBrief | null>(null);

  // Fetch Graph Data based on current view, franchise, and filters
  const fetchGraphView = useCallback(async () => {
    if (currentView === "geo-map" || isSegmentedView) return;
    try {
      const params = new URLSearchParams();
      params.set("view", currentView);
      params.set("game", selectedGame);
      if (archetypeFilter !== "ALL") params.set("archetype", archetypeFilter);
      if (selectedNode) params.set("playerId", selectedNode.id);

      const res = await fetch(`/api/graph/view?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.error("Error loading graph view:", e);
    }
  }, [currentView, selectedGame, archetypeFilter, selectedNode, isSegmentedView]);

  useEffect(() => {
    fetchGraphView();
  }, [fetchGraphView]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleSearchResults = (
    newData: GraphData,
    summary: string,
    gql: string,
    metrics: any,
    queryPrompt?: string
  ) => {
    setIsSegmentedView(true);
    setGraphData(newData);
    if (metrics) {
      setCohortContext({
        query: queryPrompt || "Segmented Cohort",
        franchise: selectedGame,
        matchedCount: metrics.matched_count || 0,
        estimatedTotal: metrics.estimated_total || 0,
        dominantArchetype: metrics.dominant_archetype || "COMPETITIVE_GRINDER",
        avgSpend: metrics.avg_spend_usd || 850,
      });
    }
  };

  const handleLandingSearch = async (queryText: string, franchise: GameFranchise) => {
    setIsSegmentedView(true);
    setSelectedGame(franchise);
    setIsNlLoading(true);

    try {
      const res = await fetch("/api/audiences/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText, game: franchise, dataSource }),
      });

      if (res.ok) {
        const data = await res.json();
        handleSearchResults(
          { nodes: data.nodes, links: data.links },
          data.natural_language_summary,
          data.generated_gql,
          data.aggregate_metrics,
          queryText
        );
        // Seamlessly transition ONLY after graph data is populated
        setIsLandingView(false);
      }
    } catch (e) {
      console.error("Landing query error:", e);
    } finally {
      setIsNlLoading(false);
    }
  };

  const handleLandingExploreFull = (franchise: GameFranchise) => {
    setIsSegmentedView(false);
    setSelectedGame(franchise);
    setArchetypeFilter("ALL");
    setCurrentView("audience-cohorts");
    setIsLandingView(false);
  };

  const handleLaunchDeepSona = async (node?: GraphNode) => {
    if (isDeepSonaLoading) return;
    const target = node || selectedNode;
    if (node) setSelectedNode(node);

    setIsDeepSonaLoading(true);

    const activeFranchise =
      selectedGame === "ALL"
        ? (cohortContext?.franchise && cohortContext.franchise !== "ALL" ? cohortContext.franchise : "Activision Blizzard King")
        : selectedGame === "COD"
        ? "Call of Duty: Warzone"
        : selectedGame === "WOW"
        ? "World of Warcraft"
        : selectedGame === "DIABLO4"
        ? "Diablo IV"
        : selectedGame === "OVERWATCH2"
        ? "Overwatch 2"
        : "Candy Crush Saga";

    let targetTitle = "Contextual Marketing & Retention Intervention";
    let spend = 120000;
    if (cohortContext?.query) {
      targetTitle = `${cohortContext.query} — Real-Time Intervention`;
    } else if (target) {
      targetTitle = `${target.name} • ${target.archetype || "Player"} Direct Contextual Offer`;
    } else if (selectedGame === "COD") {
      targetTitle = "Call of Duty: Warzone BlackCell Battle Pass & 1,100 CP Starter ($9.99 - $29.99)";
      spend = 220000;
    } else if (selectedGame === "WOW") {
      targetTitle = "World of Warcraft 6-Month Subscription Bundle & Mount Voucher ($14.99 - $77.94)";
      spend = 190000;
    } else if (selectedGame === "DIABLO4") {
      targetTitle = "Diablo IV: Vessel of Hatred Deluxe & Infernal Relic Cache ($19.99 - $59.99)";
      spend = 160000;
    } else if (selectedGame === "OVERWATCH2") {
      targetTitle = "Overwatch 2 Mythic Skin Prism Bundle & 2,200 Coins ($9.99 - $39.99)";
      spend = 140000;
    } else {
      targetTitle = "Candy Crush Saga Infinite Lives & 50 Gold Bars Bundle ($4.99 - $19.99)";
      spend = 110000;
    }

    setPreloadedCreativeTitle(targetTitle);
    setPreloadedFranchise(activeFranchise);

    const playerNodes = graphData.nodes.filter(
      (n) => n.type === "PLAYER" && (selectedGame === "ALL" || n.franchise === selectedGame || (n.franchise || "").includes(selectedGame === "COD" ? "COD" : selectedGame))
    );
    let sampledPlayers: any[] = [];
    if (playerNodes.length > 0) {
      const sortedByTilt = [...playerNodes].sort(
        (a, b) => (b.tilt || 0) - (a.tilt || 0) || (b.loss_streak || 0) - (a.loss_streak || 0)
      );
      const sortedBySpend = [...playerNodes].sort((a, b) => (b.spend || 0) - (a.spend || 0));
      const socialCandidates = playerNodes.filter(
        (p) => (p.archetype || "").includes("SOCIAL") || (p.archetype || "").includes("RUSH") || (p.archetype || "").includes("SQUAD")
      );
      const casualCandidates = [...playerNodes].sort((a, b) => (a.spend || 0) - (b.spend || 0));

      const p1 = target?.type === "PLAYER" ? target : sortedByTilt[0] || playerNodes[0];
      const p2 = sortedBySpend.find((p) => p.id !== p1.id) || playerNodes[1 % playerNodes.length];
      const p3 = socialCandidates.find((p) => p.id !== p1.id && p.id !== p2.id) || playerNodes[2 % playerNodes.length];
      const p4 = casualCandidates.find((p) => p.id !== p1.id && p.id !== p2.id && p.id !== p3.id) || playerNodes[3 % playerNodes.length];

      sampledPlayers = [p1, p2, p3, p4];
    }

    try {
      const res = await fetch("/api/synthetic/deepsona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: `camp-abk-${Date.now()}`,
          franchise: activeFranchise,
          creative_title: targetTitle,
          proposed_spend: spend,
          target_roas: 2.45,
          cohort_context: {
            ...cohortContext,
            franchise: selectedGame,
          },
          sampled_players: sampledPlayers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDeepSonaPreloadedResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeepSonaLoading(false);
      setIsDeepSonaOpen(true);
    }
  };

  const handleEmitA2A = async (node?: GraphNode) => {
    const target = node || selectedNode;
    try {
      await fetch("/api/a2a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: "Jamie_DeepSonaAgent",
          recipient: "Curtis_CreativeStudioAgent",
          intent: "EMIT_AUDIENCE_BRIEF",
          payload: {
            player_id: target?.id || "cohort-aggregate",
            display_name: target?.name || cohortContext?.query || "Synthesized Audience Cohort",
            franchise: target?.franchise || selectedGame,
            archetype: target?.archetype || cohortContext?.dominantArchetype || "COMPETITIVE_GRINDER",
            churn_risk: target?.churn_risk || cohortContext?.avgChurn || 0.45,
            friction_point: "Situational Friction & Monetization Intent Trigger",
          },
        }),
      });
      setIsA2ABusOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateBrief = async (result: DeepSonaResult) => {
    if (isGeneratingBrief) return;
    setIsGeneratingBrief(true);
    try {
      const res = await fetch("/api/campaign/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchise: result.franchise || (selectedGame === "ALL" ? "Call of Duty: Warzone" : selectedGame),
          segment: result.target_cohort_query || (cohortContext?.query ? cohortContext.query : "Segmented Audience Cohort"),
          creative_title: result.creative_title,
          predicted_conversion_lift: result.predicted_conversion_lift,
          audience_size: cohortContext?.estimatedTotal || 245000,
        }),
      });
      if (res.ok) {
        const brief = await res.json();
        setCurrentBrief(brief);
        setIsDeepSonaOpen(false);
        setIsBriefOpen(true);
      }
    } catch (e) {
      console.error(e);
      setIsDeepSonaOpen(false);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // If in Landing / Search Mode, render Gemini Enterprise inspired start page
  if (isLandingView) {
    return (
      <GeminiLandingStage
        onSearchQuery={handleLandingSearch}
        onExploreFullGraph={handleLandingExploreFull}
        onOpenA2A={() => setIsA2ABusOpen(true)}
        onOpenGeoMap={() => {
          setCurrentView("geo-map");
          setIsLandingView(false);
        }}
        onOpenMarketingJourney={() => {
          setCurrentView("marketing-journey");
          setIsLandingView(false);
        }}
        isLoading={isNlLoading}
        dataSource={dataSource}
        onDataSourceChange={setDataSource}
      />
    );
  }

  // Interactive Graph Canvas View
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080A0E] font-sans antialiased select-none">
      {/* Sleek Apple-Style Top Navigation */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3.5 bg-black/40 backdrop-blur-xl border-b border-white/10 pointer-events-auto">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setIsLandingView(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all group"
            title="Return to Search & Start Page"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Search</span>
          </button>

          <div
            onClick={() => setIsLandingView(true)}
            className="flex items-center cursor-pointer hover:opacity-85 transition-opacity"
            title="Return to Start Page"
          >
            <img
              src="/abk_logo.svg"
              alt="Activision Blizzard King"
              className="h-6 sm:h-7 w-auto object-contain brightness-110"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-normal">/</span>
            <span className="text-xs text-gray-300 font-medium">Audience Intelligence Engine</span>
          </div>
        </div>

        {/* Right Actions & Engine Toggle */}
        <div className="flex items-center gap-2.5">
          <SpannerDataSourceToggle
            dataSource={dataSource}
            onToggle={setDataSource}
          />

          <button
            onClick={() => handleLaunchDeepSona()}
            disabled={isDeepSonaLoading}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isDeepSonaLoading
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "bg-white/10 hover:bg-white/15 border border-white/15 text-white"
            }`}
          >
            {isDeepSonaLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Synthesizing Focus Group...</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-gray-300" />
                <span>Synthetic Focus Group</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsA2ABusOpen(!isA2ABusOpen)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isA2ABusOpen
                ? "bg-white text-black border-white"
                : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isA2ABusOpen ? "text-black" : "text-emerald-400"}`} />
            <span>A2A Protocol</span>
          </button>
        </div>
      </header>

      {/* Floating Graph Controls */}
      <div className="pointer-events-auto mt-12">
        <GraphControls
          currentView={currentView}
          onViewChange={(v) => {
            setIsSegmentedView(false);
            setCurrentView(v);
          }}
          selectedGame={selectedGame}
          onGameChange={(g) => {
            setIsSegmentedView(false);
            setSelectedGame(g);
          }}
          archetypeFilter={archetypeFilter}
          onArchetypeChange={(a) => {
            setIsSegmentedView(false);
            setArchetypeFilter(a);
          }}
          is3D={is3D}
          onToggle3D={() => setIs3D(!is3D)}
          nodeCount={graphData.nodes.length}
          edgeCount={graphData.links.length}
        />
      </div>

      {/* Main Interactive Stage */}
      <div className="w-full h-full">
        {currentView === "geo-map" ? (
          <GeoAudienceMap />
        ) : currentView === "marketing-journey" ? (
          <PlayerMarketingJourneySankey
            graphData={graphData}
            onSelectPlayer={(p) => setSelectedNode(p)}
            onLaunchDeepSona={(target, customTitle) => handleLaunchDeepSona(target)}
            onEmitA2A={(target) => handleEmitA2A(target)}
            onReturnToGraph={() => setCurrentView("audience-cohorts")}
          />
        ) : (
          <GraphStage
            data={graphData}
            is3D={is3D}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>

      {/* Natural Language Search Overlay — Only shown on graph/macro view, not blocking Sankey view */}
      {currentView !== "marketing-journey" && (
        <NLSearchBar
          selectedGame={selectedGame}
          onSearchResults={handleSearchResults}
          onLaunchDeepSona={() => handleLaunchDeepSona()}
          isLoading={isNlLoading}
          setIsLoading={setIsNlLoading}
          isDeepSonaLoading={isDeepSonaLoading}
          dataSource={dataSource}
          onResetToMacro={() => {
            setIsSegmentedView(false);
            setCohortContext(null);
            setSelectedNode(null);
            fetchGraphView();
          }}
        />
      )}

      {/* Right Drawer: Selected Entity Inspector or Active Cohort Overview */}
      {(selectedNode || isSegmentedView || cohortContext) && (
        <EntityInspector
          node={selectedNode}
          cohortContext={cohortContext}
          graphData={graphData}
          onSelectNode={(n) => setSelectedNode(n)}
          onClose={() => {
            if (selectedNode) {
              setSelectedNode(null);
            } else {
              setIsSegmentedView(false);
              setCohortContext(null);
            }
          }}
          onLaunchDeepSona={handleLaunchDeepSona}
          onEmitA2A={handleEmitA2A}
          isDeepSonaLoading={isDeepSonaLoading}
        />
      )}

      {/* DeepSona Multi-Agent Synthetic Testing Modal */}
      <DeepSonaModal
        isOpen={isDeepSonaOpen}
        onClose={() => setIsDeepSonaOpen(false)}
        targetNode={selectedNode}
        cohortContext={cohortContext}
        selectedGame={selectedGame}
        graphData={graphData}
        initialResult={deepSonaPreloadedResult}
        initialCreativeTitle={preloadedCreativeTitle}
        initialFranchise={preloadedFranchise}
        isGeneratingBrief={isGeneratingBrief}
        onGenerateBrief={handleGenerateBrief}
      />

      {/* Campaign Brief Walkthrough Modal */}
      {currentBrief && (
        <CampaignBriefModal
          isOpen={isBriefOpen}
          onClose={() => setIsBriefOpen(false)}
          brief={currentBrief}
        />
      )}

      {/* A2A Agent-to-Agent Event Bus Feed */}
      <A2ANegotiationFeed
        isOpen={isA2ABusOpen}
        onClose={() => setIsA2ABusOpen(false)}
      />
    </main>
  );
}
