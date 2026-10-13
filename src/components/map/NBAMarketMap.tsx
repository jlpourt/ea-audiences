"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { GraphData, GraphNode, CohortContext } from "@/lib/types";
import { archetypeLabel } from "@/lib/archetypes";
import {
  Users,
  X,
  Search,
  RefreshCw,
} from "lucide-react";

export interface NBAMarketRecord {
  id: string;
  dma_market: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  player_count: number;
  avg_spend: number;
  cliff_count: number;
  nba2k26_bridge_count: number;
  avg_gravity_score: number;
  top_archetype: string;
  top_archetype_label: string;
  team_affinity: string;
}

export type MarketMetricToggle = "players" | "spend" | "cliff" | "bridge";

export interface NBAMarketMapProps {
  graphData?: GraphData;
  cohortContext?: CohortContext | null;
  onSelectNode?: (node: GraphNode) => void;
  onActivateAudience?: (title: string, query: string) => void;
  onReturnToGraph?: () => void;
}

const METRIC_TABS: Array<{
  id: MarketMetricToggle;
  label: string;
  color: string;
  accentBg: string;
  unit: string;
}> = [
  { id: "players", label: "Players", color: "#E4002B", accentBg: "rgba(228,0,43,0.15)", unit: "players" },
  { id: "spend", label: "VC Spend", color: "#F5B400", accentBg: "rgba(245,180,0,0.15)", unit: "USD" },
  { id: "cliff", label: "S2 Cliff Risk", color: "#FF4D5E", accentBg: "rgba(255,77,94,0.15)", unit: "at-risk" },
  { id: "bridge", label: "2K26 Holdouts", color: "#FF6B35", accentBg: "rgba(255,107,53,0.15)", unit: "holdouts" },
];

export function NBAMarketMap({
  onActivateAudience,
}: NBAMarketMapProps) {
  const [markets, setMarkets] = useState<NBAMarketRecord[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MarketMetricToggle>("players");
  const [selectedMarket, setSelectedMarket] = useState<NBAMarketRecord | null>(null);
  const [hoveredMarket, setHoveredMarket] = useState<NBAMarketRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({ width: 960, height: 500 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (mapContainerRef.current) {
        const { clientWidth, clientHeight } = mapContainerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setMapSize({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Fetch live market aggregates from markets route
  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/markets");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMarkets(data.markets || []);
    } catch (err: any) {
      console.error("[NBAMarketMap] fetch error:", err);
      setError(err?.message || "Failed to load NBA market telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  // Compute D3 projection paths
  const { pathGenerator, projection } = useMemo(() => {
    const proj = geoNaturalEarth1()
      .scale(mapSize.width / 5.4)
      .translate([mapSize.width / 2, mapSize.height / 2 + 10]);
    const pathGen = geoPath().projection(proj);
    return { pathGenerator: pathGen, projection: proj };
  }, [mapSize.width, mapSize.height]);

  // World GeoJSON features
  const countries = useMemo(() => {
    try {
      const countriesGeo = feature(worldData as any, (worldData as any).objects.countries);
      return (countriesGeo as any).features || [];
    } catch (e) {
      console.error("TopoJSON extraction failed:", e);
      return [];
    }
  }, []);

  // Filtered markets sorted by player_count descending so top 8 labels are deterministic
  const filteredMarkets = useMemo(() => {
    const base = !searchQuery.trim()
      ? markets
      : markets.filter((m) => {
          const q = searchQuery.toLowerCase();
          return (
            m.dma_market.toLowerCase().includes(q) ||
            m.team_affinity.toLowerCase().includes(q) ||
            m.country.toLowerCase().includes(q)
          );
        });
    return [...base].sort((a, b) => b.player_count - a.player_count);
  }, [markets, searchQuery]);

  // Max value calculation for sizing bubbles
  const maxValues = useMemo(() => {
    return {
      players: Math.max(...markets.map((m) => m.player_count), 1),
      spend: Math.max(...markets.map((m) => m.avg_spend), 1),
      cliff: Math.max(...markets.map((m) => m.cliff_count), 1),
      bridge: Math.max(...markets.map((m) => m.nba2k26_bridge_count), 1),
    };
  }, [markets]);

  const activeTabConfig = useMemo(() => {
    return METRIC_TABS.find((t) => t.id === selectedMetric) || METRIC_TABS[0];
  }, [selectedMetric]);

  const handleBuildAudience = (market: NBAMarketRecord) => {
    let query = `NBA 2K27 + NBA 2K26 + 2K Sports players in ${market.dma_market}`;
    if (selectedMetric === "cliff") {
      query = `NBA 2K27 MyCAREER builds below 85 OVR in ${market.dma_market} who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates (Season 2 Cliff)`;
    } else if (selectedMetric === "bridge") {
      query = `NBA 2K27 + NBA 2K26 + 2K Sports veteran players in ${market.dma_market} eligible for the NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade`;
    } else if (selectedMetric === "spend") {
      query = `High-spend NBA 2K27 + NBA 2K26 + 2K Sports players in ${market.dma_market} with $100+ lifetime spend`;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("courtside:run-query", {
          detail: { query, marketId: market.id, dmaMarket: market.dma_market },
        })
      );
    }

    if (onActivateAudience) {
      onActivateAudience(market.dma_market, query);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0A0A0C] text-[#F4F1EA] overflow-hidden select-none">
      {/* Clean Sub-Header Bar */}
      <div className="h-14 px-6 border-b border-white/[0.07] bg-[#121216]/90 backdrop-blur-md flex items-center justify-between gap-4 z-10 shrink-0">
        {/* Left: Title + Pill */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-semibold tracking-tight text-white truncate">
            NBA Market Telemetry
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.05] text-[#F4F1EA]/70 font-mono border border-white/[0.08] shrink-0">
            30 NBA DMAs + 5 Int&apos;l
          </span>
        </div>

        {/* Center: Compact 4-Tab Metric Switcher */}
        <div className="flex items-center bg-[#0A0A0C] p-1 rounded-xl border border-white/[0.08] shrink-0">
          {METRIC_TABS.map((tab) => {
            const isActive = selectedMetric === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedMetric(tab.id)}
                className={`pressable px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tab.color }}
                  />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Compact Search DMA Input */}
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search DMA..."
            className="w-48 pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E4002B]"
          />
        </div>
      </div>

      {/* Main Map Canvas */}
      <div ref={mapContainerRef} className="relative flex-1 w-full h-full overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="flex items-center gap-3 text-xs text-white/80">
              <RefreshCw className="w-4 h-4 courtside-Transfer-pulse text-[#E4002B]" />
              <span>Resolving NBA DMA Coordinates &amp; 2K26 Holdout Telemetry...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/40 text-sm text-red-200">
              {error}
            </div>
          </div>
        )}

        <svg width={mapSize.width} height={mapSize.height} className="w-full h-full">
          {/* Base Countries */}
          <g className="countries">
            {countries.map((geo: any, idx: number) => {
              const d = pathGenerator(geo);
              if (!d) return null;
              return (
                <path
                  key={idx}
                  d={d}
                  fill="#121216"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={0.75}
                  className="transition-colors hover:fill-[#1B1C22]"
                />
              );
            })}
          </g>

          {/* Market Bubbles */}
          <g className="market-bubbles">
            {filteredMarkets.map((market, idx) => {
              const coords = projection([market.lng, market.lat]);
              if (!coords) return null;
              const [cx, cy] = coords;

              let val = market.player_count;
              let max = maxValues.players;
              if (selectedMetric === "spend") {
                val = market.avg_spend;
                max = maxValues.spend;
              } else if (selectedMetric === "cliff") {
                val = market.cliff_count;
                max = maxValues.cliff;
              } else if (selectedMetric === "bridge") {
                val = market.nba2k26_bridge_count;
                max = maxValues.bridge;
              }

              const norm = Math.max(0, Math.min(1, val / max));
              const radius = Math.max(6, Math.min(18, Math.round(6 + norm * 12)));
              const isSelected = selectedMarket?.id === market.id;
              const isHovered = hoveredMarket?.id === market.id;

              return (
                <g
                  key={market.id}
                  transform={`translate(${cx}, ${cy})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedMarket(market)}
                  onMouseEnter={() => setHoveredMarket(market)}
                  onMouseLeave={() => setHoveredMarket(null)}
                >
                  {/* Subtle Outer Halo (radius + 3) */}
                  <circle
                    r={radius + 3}
                    fill={activeTabConfig.color}
                    opacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.08}
                    style={{
                      transition: "transform 260ms var(--ease-out), opacity 120ms var(--ease-out)",
                      transform: isSelected ? "scale(1.12)" : isHovered ? "scale(1.06)" : "scale(1)",
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  />

                  {/* Main Market Bubble (radius 6..18) */}
                  <circle
                    r={radius}
                    fill={activeTabConfig.color}
                    fillOpacity={isSelected ? 0.85 : 0.62}
                    stroke={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.35)"}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{
                      transition: "transform 260ms var(--ease-out), opacity 120ms var(--ease-out)",
                      transform: isSelected ? "scale(1.12)" : isHovered ? "scale(1.08)" : "scale(1)",
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  />

                  {/* Bubble label only for clean anchor markets, selected, or hovered */}
                  {(isSelected ||
                    isHovered ||
                    [
                      "Los Angeles",
                      "New York",
                      "Chicago",
                      "Miami",
                      "Dallas",
                      "London",
                      "Tokyo",
                      "Sydney",
                      "São Paulo",
                    ].includes(market.dma_market.replace(" DMA", ""))) && (
                    <text
                      y={-radius - 5}
                      textAnchor="middle"
                      fill="#F4F1EA"
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, sans-serif"
                      className="pointer-events-none drop-shadow-md"
                    >
                      {market.dma_market.replace(" DMA", "")}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredMarket && !selectedMarket && (
          <div
            className="absolute pointer-events-none z-30 px-3 py-2 rounded-xl apple-glass-heavy glass-enter text-xs space-y-1"
            style={{
              left: Math.min(
                mapSize.width - 200,
                (projection([hoveredMarket.lng, hoveredMarket.lat])?.[0] || 0) + 16
              ),
              top: Math.max(
                16,
                (projection([hoveredMarket.lng, hoveredMarket.lat])?.[1] || 0) - 40
              ),
              transition: "transform 260ms var(--ease-out), opacity 120ms var(--ease-out)",
            }}
          >
            <div className="font-semibold text-white">{hoveredMarket.dma_market.replace(/\s*\u2014\s*/g, " · ")}</div>
            <div className="text-[10px] text-white/55">{hoveredMarket.team_affinity.replace(/\s*\u2014\s*/g, " · ")}</div>
            <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between gap-4 font-mono text-[11px] tabular">
              <span className="text-white/60">
                {selectedMetric === "players"
                  ? "Players"
                  : selectedMetric === "spend"
                  ? "Avg Spend"
                  : selectedMetric === "cliff"
                  ? "S2 Cliff Risk"
                  : "2K26 Holdouts"}
              </span>
              <span className="font-semibold" style={{ color: activeTabConfig.color }}>
                {selectedMetric === "spend" ? "$" : ""}
                {selectedMetric === "players"
                  ? hoveredMarket.player_count.toLocaleString()
                  : selectedMetric === "spend"
                  ? hoveredMarket.avg_spend.toLocaleString()
                  : selectedMetric === "cliff"
                  ? hoveredMarket.cliff_count.toLocaleString()
                  : hoveredMarket.nba2k26_bridge_count.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Clean Right-Hand Market Drawer */}
      {selectedMarket && (
        <div className="absolute top-3 bottom-3 right-4 w-[350px] rounded-2xl z-30 apple-glass-heavy glass-enter flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">
                  {selectedMarket.dma_market.replace(/\s*\u2014\s*/g, " · ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[#E4002B]/20 text-[#E4002B] shrink-0">
                  {selectedMarket.country_code}
                </span>
              </div>
              <div className="text-[11px] text-[#F5B400] font-medium mt-0.5 truncate">
                {selectedMarket.team_affinity.replace(/\s*\u2014\s*/g, " · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMarket(null)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
              aria-label="Close market drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats Body */}
          <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-white/50 mb-0.5">TOTAL AUDIENCE</div>
                <div className="text-base font-mono font-semibold text-white tabular">
                  {selectedMarket.player_count.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40">Registered Players</div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-white/50 mb-0.5">AVG VC SPEND</div>
                <div className="text-base font-mono font-semibold text-[#F5B400] tabular">
                  ${selectedMarket.avg_spend.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40">Lifetime Value</div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-[#FF4D5E] font-medium mb-0.5">S2 CLIFF RISK</div>
                <div className="text-base font-mono font-semibold text-[#FF4D5E] tabular">
                  {selectedMarket.cliff_count.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40 tabular">
                  {Math.round((selectedMarket.cliff_count / Math.max(1, selectedMarket.player_count)) * 100)}% of market
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="text-[10px] text-[#FF6B35] font-medium mb-0.5">2K26 HOLDOUTS</div>
                <div className="text-base font-mono font-semibold text-[#FF6B35] tabular">
                  {selectedMarket.nba2k26_bridge_count.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40 tabular">
                  {Math.round((selectedMarket.nba2k26_bridge_count / Math.max(1, selectedMarket.player_count)) * 100)}% holdout veterans
                </div>
              </div>
            </div>

            {/* Upgrade Gravity Score Bar */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/75">2K26 → 2K27 Upgrade Gravity</span>
                <span className="font-mono font-semibold text-[#FF6B35] tabular">
                  {(selectedMarket.avg_gravity_score * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E4002B] to-[#FF6B35] rounded-full"
                  style={{ width: `${Math.min(100, selectedMarket.avg_gravity_score * 100)}%` }}
                />
              </div>
            </div>

            {/* Dominant Archetype */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-0.5">
              <div className="text-[10px] text-white/50">DOMINANT ARCHETYPE</div>
              <div className="text-xs font-semibold text-white">
                {selectedMarket.top_archetype_label.replace(/\s*\u2014\s*/g, " · ")}
              </div>
              <div className="text-[10px] text-white/40 font-mono">
                {archetypeLabel(selectedMarket.top_archetype as any)}
              </div>
            </div>

            {/* Coordinates & Territory */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs space-y-1 text-white/70 font-mono tabular">
              <div className="flex justify-between">
                <span className="text-white/45">Coordinates</span>
                <span>
                  {selectedMarket.lat.toFixed(2)}°N · {Math.abs(selectedMarket.lng).toFixed(2)}°{selectedMarket.lng < 0 ? "W" : "E"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">Territory</span>
                <span>{selectedMarket.country.replace(/\s*\u2014\s*/g, " · ")}</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-3.5 border-t border-white/[0.08] bg-[#0A0A0C]/80">
            <button
              type="button"
              onClick={() => handleBuildAudience(selectedMarket)}
              className="pressable w-full py-2.5 px-4 rounded-xl bg-[#E4002B] hover:bg-[#A3001F] text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-[#E4002B]/20"
            >
              <Users className="w-4 h-4" />
              Build Audience in {selectedMarket.dma_market.replace(" DMA", "")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Alias for backwards compatibility
export const GeoAudienceMap = NBAMarketMap;
export default NBAMarketMap;
