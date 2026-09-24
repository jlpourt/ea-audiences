"use client";

import React, { useState, useMemo } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { CohortContext, GraphData, GraphNode } from "@/lib/types";
import { archetypeLabel, isWhaleArchetype } from "@/lib/archetypes";
import { Globe, Users, Zap, ArrowRight } from "lucide-react";

interface GeoRegion {
  id: string;
  name: string;
  code: string;
  country: string;
  coordinates: [number, number]; // [longitude, latitude]
  addressablePlayers: number;
  avgSpendUsd: number;
  dominantArchetype: string;
  whaleCount: number;
  serverPingMs: number;
  activeLossStreakPlayers: number;
  gcpRegion: string;
}

const REGIONS: GeoRegion[] = [
  {
    id: "us-nyc",
    name: "New York DMA",
    code: "NYC",
    country: "United States",
    coordinates: [-74.006, 40.7128],
    addressablePlayers: 184000,
    avgSpendUsd: 480,
    dominantArchetype: "BLACKCELL_WHALE",
    whaleCount: 1420,
    serverPingMs: 9,
    activeLossStreakPlayers: 340,
    gcpRegion: "us-east4 (N. Virginia)",
  },
  {
    id: "us-lax",
    name: "Los Angeles DMA",
    code: "LAX",
    country: "United States",
    coordinates: [-118.2437, 34.0522],
    addressablePlayers: 215000,
    avgSpendUsd: 520,
    dominantArchetype: "BLACKCELL_WHALE",
    whaleCount: 1890,
    serverPingMs: 11,
    activeLossStreakPlayers: 410,
    gcpRegion: "us-west2 (Los Angeles)",
  },
  {
    id: "us-dfw",
    name: "Dallas / Fort Worth DMA",
    code: "DFW",
    country: "United States",
    coordinates: [-96.797, 32.7767],
    addressablePlayers: 142000,
    avgSpendUsd: 390,
    dominantArchetype: "COMPETITIVE_GRINDER",
    whaleCount: 880,
    serverPingMs: 14,
    activeLossStreakPlayers: 620,
    gcpRegion: "us-south1 (Dallas)",
  },
  {
    id: "us-chi",
    name: "Chicago DMA",
    code: "CHI",
    country: "United States",
    coordinates: [-87.6298, 41.8781],
    addressablePlayers: 160000,
    avgSpendUsd: 340,
    dominantArchetype: "CASUAL_SOCIALIZER",
    whaleCount: 710,
    serverPingMs: 12,
    activeLossStreakPlayers: 290,
    gcpRegion: "us-central1 (Iowa)",
  },
  {
    id: "uk-lon",
    name: "London Metro & South East",
    code: "LON",
    country: "United Kingdom",
    coordinates: [-0.1278, 51.5074],
    addressablePlayers: 320000,
    avgSpendUsd: 640,
    dominantArchetype: "BLACKCELL_WHALE",
    whaleCount: 3450,
    serverPingMs: 7,
    activeLossStreakPlayers: 890,
    gcpRegion: "europe-west2 (London)",
  },
  {
    id: "es-mad",
    name: "Madrid & Iberian Peninsula",
    code: "MAD",
    country: "Spain",
    coordinates: [-3.7038, 40.4168],
    addressablePlayers: 195000,
    avgSpendUsd: 310,
    dominantArchetype: "COMPETITIVE_GRINDER",
    whaleCount: 1120,
    serverPingMs: 16,
    activeLossStreakPlayers: 780,
    gcpRegion: "europe-southwest1 (Madrid)",
  },
  {
    id: "fr-par",
    name: "Paris Île-de-France",
    code: "PAR",
    country: "France",
    coordinates: [2.3522, 48.8566],
    addressablePlayers: 240000,
    avgSpendUsd: 490,
    dominantArchetype: "BLACKCELL_WHALE",
    whaleCount: 2100,
    serverPingMs: 8,
    activeLossStreakPlayers: 540,
    gcpRegion: "europe-west9 (Paris)",
  },
  {
    id: "de-ber",
    name: "Berlin & DACH Region",
    code: "BER",
    country: "Germany",
    coordinates: [13.405, 52.52],
    addressablePlayers: 280000,
    avgSpendUsd: 420,
    dominantArchetype: "COMPETITIVE_GRINDER",
    whaleCount: 1950,
    serverPingMs: 9,
    activeLossStreakPlayers: 810,
    gcpRegion: "europe-west3 (Frankfurt)",
  },
  {
    id: "br-sao",
    name: "São Paulo & South America",
    code: "SAO",
    country: "Brazil",
    coordinates: [-46.6333, -23.5505],
    addressablePlayers: 290000,
    avgSpendUsd: 180,
    dominantArchetype: "COMPETITIVE_GRINDER",
    whaleCount: 940,
    serverPingMs: 18,
    activeLossStreakPlayers: 920,
    gcpRegion: "southamerica-east1 (São Paulo)",
  },
  {
    id: "sa-ruh",
    name: "Riyadh & GCC Region",
    code: "RUH",
    country: "Saudi Arabia",
    coordinates: [46.6753, 24.7136],
    addressablePlayers: 175000,
    avgSpendUsd: 890,
    dominantArchetype: "AZERITE_COLLECTOR",
    whaleCount: 4100,
    serverPingMs: 19,
    activeLossStreakPlayers: 210,
    gcpRegion: "me-central2 (Dammam)",
  },
  {
    id: "jp-tyo",
    name: "Tokyo & East Asia",
    code: "TYO",
    country: "Japan",
    coordinates: [139.6917, 35.6895],
    addressablePlayers: 130000,
    avgSpendUsd: 410,
    dominantArchetype: "LORE_SEEKER",
    whaleCount: 820,
    serverPingMs: 10,
    activeLossStreakPlayers: 150,
    gcpRegion: "asia-northeast1 (Tokyo)",
  },
];

interface GeoAudienceMapProps {
  graphData?: GraphData | null;
  cohortContext?: CohortContext | null;
  onSelectPlayer?: (player: GraphNode) => void;
  onSelectRegion?: (region: GeoRegion) => void;
  onLaunchFocusGroup?: () => void;
}

/** Spend at or above this is treated as whale behaviour (top ~2% of the base). */
const WHALE_SPEND_FLOOR = 1000;

/**
 * The loss-streak recovery SKU for each Call of Duty mode, taken from
 * `data/marketing_offers.json`.
 */
const RECOVERY_OFFER_BY_FRANCHISE: Record<string, string> = {
  ALL: "$4.99 Gulag Loss-Streak Recovery Care Package",
  COD: "$4.99 Gulag Loss-Streak Recovery Care Package",
  WARZONE: "$4.99 Gulag Loss-Streak Recovery Care Package",
  BLACK_OPS: "$9.99 Zombies GobbleGum Ultra Mega Pack",
  MODERN_WARFARE: "$19.99 Search & Destroy Clutch Pro Bundle",
  CDL_RANKED: "$4.99 Ranked Play Demotion Recovery Pack",
  COD_MOBILE: "$2.99 Mobile Starter Claw Pack",
};

/** Approximate round-trip latency to the nearest GCP edge, by DMA. */
const GCP_EDGE_BY_DMA: Record<string, { region: string; pingMs: number }> = {
  "New York DMA": { region: "us-east4 (N. Virginia)", pingMs: 9 },
  "Los Angeles DMA": { region: "us-west2 (Los Angeles)", pingMs: 11 },
  "Dallas / Fort Worth DMA": { region: "us-south1 (Dallas)", pingMs: 14 },
  "Chicago DMA": { region: "us-central1 (Iowa)", pingMs: 12 },
  "London Metro": { region: "europe-west2 (London)", pingMs: 7 },
  Manchester: { region: "europe-west2 (London)", pingMs: 12 },
  "Paris Île-de-France": { region: "europe-west9 (Paris)", pingMs: 8 },
  "Berlin & DACH": { region: "europe-west3 (Frankfurt)", pingMs: 10 },
  Madrid: { region: "europe-southwest1 (Madrid)", pingMs: 8 },
  "Riyadh & GCC": { region: "me-central2 (Dammam)", pingMs: 16 },
  Tokyo: { region: "asia-northeast1 (Tokyo)", pingMs: 10 },
  "São Paulo": { region: "southamerica-east1 (São Paulo)", pingMs: 18 },
};

/**
 * Aggregate the player nodes currently in the graph into geographic markets.
 *
 * Everything returned here is measured from the cohort actually on screen.
 * When the graph is a sample of a larger match set, per-region counts are
 * scaled to the full cohort and flagged via `isProjected` so the UI can say so
 * rather than quietly presenting an extrapolation as a headcount.
 */
function deriveRegions(
  graphData: GraphData | null | undefined,
  cohortContext: CohortContext | null | undefined
): { regions: GeoRegion[]; isLive: boolean; sampleSize: number; isProjected: boolean; scale: number } {
  const players = (graphData?.nodes || []).filter(
    (n) => n.type === "PLAYER" && typeof n.lat === "number" && typeof n.lng === "number"
  );

  if (players.length === 0) {
    return { regions: REGIONS, isLive: false, sampleSize: 0, isProjected: false, scale: 1 };
  }

  const rendered = cohortContext?.renderedCount || players.length;
  const matched = cohortContext?.matchedCount || rendered;
  const isProjected = !!cohortContext?.isSampled && matched > rendered && rendered > 0;
  const scale = isProjected ? matched / rendered : 1;

  const buckets = new Map<string, GraphNode[]>();
  for (const p of players) {
    const key = p.dma_market || p.country || "Unattributed";
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }

  const regions: GeoRegion[] = Array.from(buckets.entries()).map(([name, group]) => {
    const spends = group.map((p) => p.spend || 0);
    const totalSpend = spends.reduce((s, v) => s + v, 0);

    // Modal archetype within the market.
    const archCounts = new Map<string, number>();
    for (const p of group) {
      const a = p.archetype || "UNKNOWN";
      archCounts.set(a, (archCounts.get(a) || 0) + 1);
    }
    const dominantArchetype =
      Array.from(archCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "UNKNOWN";

    const edge = GCP_EDGE_BY_DMA[name];

    return {
      id: `geo-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      name,
      // Short code for the map pin: initials of the market name.
      code: name
        .split(/[\s/&]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((w) => w[0].toUpperCase())
        .join(""),
      country: group[0].country || "—",
      coordinates: [
        group.reduce((s, p) => s + (p.lng || 0), 0) / group.length,
        group.reduce((s, p) => s + (p.lat || 0), 0) / group.length,
      ] as [number, number],
      addressablePlayers: Math.round(group.length * scale),
      avgSpendUsd: Math.round(totalSpend / group.length),
      dominantArchetype,
      whaleCount: Math.round(
        group.filter((p) => isWhaleArchetype(p.archetype) || (p.spend || 0) >= WHALE_SPEND_FLOOR).length * scale
      ),
      serverPingMs: edge?.pingMs ?? 15,
      activeLossStreakPlayers: Math.round(group.filter((p) => (p.loss_streak || 0) >= 3).length * scale),
      gcpRegion: edge?.region ?? "multi-region",
    };
  });

  regions.sort((a, b) => b.addressablePlayers - a.addressablePlayers);

  return { regions, isLive: true, sampleSize: players.length, isProjected, scale };
}

export default function GeoAudienceMap({
  graphData,
  cohortContext,
  onSelectPlayer,
  onSelectRegion,
  onLaunchFocusGroup,
}: GeoAudienceMapProps) {
  const { regions, isLive, sampleSize, isProjected } = useMemo(
    () => deriveRegions(graphData, cohortContext),
    [graphData, cohortContext]
  );

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<GeoRegion | null>(null);

  // Selection follows the data: if the cohort changes and the previously
  // selected market is no longer represented, fall back to the largest one.
  const selectedRegion =
    regions.find((r) => r.id === selectedRegionId) || regions[0] || REGIONS[0];

  const isWhaleCohort = isWhaleArchetype(cohortContext?.dominantArchetype);
  const isGrinderCohort =
    cohortContext?.dominantArchetype === "COMPETITIVE_GRINDER" ||
    cohortContext?.dominantArchetype === "RANKED_SWEAT";

  // Highest-LTV players actually present in the selected market.
  const topPlayersInRegion = useMemo(() => {
    if (!isLive) return [] as GraphNode[];
    return (graphData?.nodes || [])
      .filter(
        (n) =>
          n.type === "PLAYER" &&
          (n.dma_market || n.country || "Unattributed") === selectedRegion.name
      )
      .sort((a, b) => (b.spend || 0) - (a.spend || 0))
      .slice(0, 5);
  }, [graphData, selectedRegion.name, isLive]);

  // SVG Width & Height for accurate projection
  const width = 960;
  const height = 480;

  // D3 Natural Earth Geographic Projection & Path Generator
  const { countriesPaths, graticulesPath, projectedPoints, backboneArcs } = useMemo(() => {
    const projection = geoNaturalEarth1()
      .scale(155)
      .translate([width / 2, height / 2 + 10]);

    const pathGenerator = geoPath().projection(projection);

    // Extract real countries from TopoJSON
    const countriesGeo: any = feature(worldData as any, (worldData as any).objects.countries);
    const countryPathsList = (countriesGeo.features || []).map((f: any, idx: number) => ({
      id: f.id || idx,
      d: pathGenerator(f) || "",
    }));

    // Generate graticule lines
    const graticule = geoGraticule();
    const graticules = pathGenerator(graticule()) || "";

    // Project market points
    const points = regions.map((r) => {
      const [px, py] = projection(r.coordinates) || [0, 0];
      return { ...r, px, py };
    });

    // Backbone arcs are derived from the projected positions of the largest
    // markets. They were previously five hardcoded SVG paths that pointed at
    // fixed pixel coordinates and drifted the moment the data changed.
    const hubs = points.slice(0, 6);
    const arcs: string[] = [];
    for (let i = 0; i < hubs.length - 1; i++) {
      const a = hubs[i];
      const b = hubs[i + 1];
      const mx = (a.px + b.px) / 2;
      const my = (a.py + b.py) / 2 - Math.abs(b.px - a.px) * 0.18;
      arcs.push(`M ${a.px},${a.py} Q ${mx},${my} ${b.px},${b.py}`);
    }

    return {
      countriesPaths: countryPathsList,
      graticulesPath: graticules,
      projectedPoints: points,
      backboneArcs: arcs,
    };
  }, [regions]);

  return (
    <div className="relative w-full h-full bg-[#080A0E] overflow-hidden flex font-sans select-none">
      {/* 1. Authentic D3 Vector World Map Stage */}
      <div className="relative flex-1 h-full flex items-center justify-center p-6 overflow-hidden">
        {/* Subtle Ambient Map Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none opacity-40" />

        {/* Real D3 High-Res Vector SVG Map */}
        <div className="relative w-full max-w-5xl aspect-[2/1] max-h-[80vh] flex items-center justify-center">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full filter drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="countryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#141B26" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0B1018" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* Latitude / Longitude Graticule Grid */}
            <path
              d={graticulesPath}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.75"
              strokeDasharray="2,2"
            />

            {/* Real World Country Boundaries */}
            <g>
              {countriesPaths.map((c: any) => (
                <path
                  key={c.id}
                  d={c.d}
                  fill="url(#countryGrad)"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="0.85"
                  className="transition-colors duration-200 hover:fill-[#1C2636] hover:stroke-white/30"
                />
              ))}
            </g>

            {/* Backbone arcs between the largest markets in the current cohort */}
            <g stroke="rgba(52, 211, 153, 0.3)" strokeWidth="1" strokeDasharray="3,3" fill="none">
              {backboneArcs.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </svg>

          {/* 2. Interactive market hotspots positioned at projected coordinates */}
          {projectedPoints.map((r) => {
            const isSelected = selectedRegion.id === r.id;
            const isHovered = hoveredRegion?.id === r.id;
            const isHighlighted = isWhaleCohort
              ? isWhaleArchetype(r.dominantArchetype)
              : isGrinderCohort
              ? r.dominantArchetype === "COMPETITIVE_GRINDER" || r.dominantArchetype === "RANKED_SWEAT"
              : true;

            const size = isSelected ? 22 : isHighlighted ? 17 : 13;
            const leftPct = (r.px / width) * 100;
            const topPct = (r.py / height) * 100;

            return (
              <button
                key={r.id}
                type="button"
                aria-label={`${r.name} — ${r.addressablePlayers.toLocaleString()} players`}
                onClick={() => {
                  setSelectedRegionId(r.id);
                  onSelectRegion?.(r);
                }}
                onMouseEnter={() => setHoveredRegion(r)}
                onMouseLeave={() => setHoveredRegion(null)}
                onFocus={() => setHoveredRegion(r)}
                onBlur={() => setHoveredRegion(null)}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 transition-transform active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-full"
              >
                {/* Outer Pulse Rings for Active Cohort Hubs */}
                {isHighlighted && (
                  <div
                    className={`absolute inset-0 rounded-full animate-ping opacity-35 ${
                      isSelected ? "bg-emerald-400" : "bg-white"
                    }`}
                    style={{
                      width: size * 2.2,
                      height: size * 2.2,
                      left: -size * 0.6,
                      top: -size * 0.6,
                    }}
                  />
                )}

                {/* Core DMA Node Button */}
                <div
                  style={{ width: size, height: size }}
                  className={`rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isSelected
                      ? "bg-emerald-400 border-white shadow-[0_0_24px_rgba(52,211,153,0.9)] scale-125"
                      : isHighlighted
                      ? "bg-white border-white/80 shadow-[0_0_14px_rgba(255,255,255,0.7)]"
                      : "bg-white/20 border-white/30 hover:bg-white/50"
                  }`}
                >
                  <span
                    className={`text-[8px] font-bold ${
                      isSelected ? "text-black" : isHighlighted ? "text-black" : "text-white"
                    }`}
                  >
                    {r.code}
                  </span>
                </div>

                {/* Hover Tooltip HUD Card */}
                {(isHovered || isSelected) && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-1.5 rounded-xl bg-black/90 backdrop-blur-2xl border border-white/20 text-white text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-2xl animate-spring-in z-30">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{r.name}</span>
                      {/* Formatted to real magnitude — dividing by 1,000 used to
                          render every genuine market count as "0K". */}
                      <span className="text-emerald-400 font-mono">
                        {r.addressablePlayers >= 1000
                          ? `${(r.addressablePlayers / 1000).toFixed(1)}K`
                          : r.addressablePlayers.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Avg Spend: ${r.avgSpendUsd} • Ping: {r.serverPingMs}ms
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Right Region Telemetry Drawer (Apple-style Clean Card) */}
      <div className="w-96 border-l border-white/10 bg-[#0E1015]/95 backdrop-blur-2xl p-6 flex flex-col justify-between z-30 space-y-4 overflow-y-auto">
        {/* Drawer Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="min-w-0">
              {/* Provenance badge: a placeholder map must never read as live. */}
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider block ${
                  isLive ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {isLive ? "Live Cohort Geography" : "Sample Geography — run a query"}
              </span>
              <h3 className="text-base font-semibold text-white mt-0.5 tracking-tight truncate">
                {selectedRegion.name}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {selectedRegion.country} • {selectedRegion.gcpRegion}
              </p>
            </div>
            <div className="w-8 h-8 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Globe className="w-4 h-4" />
            </div>
          </div>

          {isLive && (
            <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed">
              Aggregated from {sampleSize.toLocaleString()} player nodes across{" "}
              {regions.length} market{regions.length === 1 ? "" : "s"}.
              {isProjected && (
                <>
                  {" "}
                  Counts are scaled to the full cohort of{" "}
                  {(cohortContext?.matchedCount || 0).toLocaleString()} and are
                  estimates.
                </>
              )}
            </p>
          )}

          {/* Regional Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">
                {isProjected ? "Est. Market Size" : "Players in Market"}
              </span>
              <span className="text-base font-semibold text-white font-mono mt-0.5 block">
                {selectedRegion.addressablePlayers.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">
                {isProjected ? "projected from sample" : "matched by this query"}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">High-Value Spenders</span>
              <span className="text-base font-semibold text-amber-300 font-mono mt-0.5 block">
                {selectedRegion.whaleCount.toLocaleString()}
              </span>
              {/* Caption matches the threshold the code actually applies. */}
              <span className="text-[10px] text-gray-500 block mt-0.5">
                &ge;${WHALE_SPEND_FLOOR.toLocaleString()} LTV or collector archetype
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Avg Market Spend</span>
              <span className="text-base font-semibold text-emerald-400 font-mono mt-0.5 block">
                ${selectedRegion.avgSpendUsd.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">lifetime, per account</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Dominant Archetype</span>
              <span className="text-xs font-semibold text-cyan-400 mt-1 block leading-tight">
                {archetypeLabel(selectedRegion.dominantArchetype)}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">
                {selectedRegion.gcpRegion.split(" ")[0]} • {selectedRegion.serverPingMs}ms edge
              </span>
            </div>
          </div>

          {/* Situational Trigger Alert */}
          {selectedRegion.activeLossStreakPlayers > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Situational Trigger in Market</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
                <strong>{selectedRegion.activeLossStreakPlayers.toLocaleString()} players</strong> in{" "}
                {selectedRegion.name} are on a 3+ loss streak.
              </p>
              <div className="text-[10px] text-emerald-400 font-medium pt-1">
                ✓ Recommended: {RECOVERY_OFFER_BY_FRANCHISE[cohortContext?.franchise || "COD"] ||
                  RECOVERY_OFFER_BY_FRANCHISE.COD}
              </div>
            </div>
          )}

          {/* Top players in this market — the map is now a way into the cohort,
              not a dead end. */}
          {isLive && topPlayersInRegion.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block">
                Highest LTV in {selectedRegion.code}
              </span>
              {topPlayersInRegion.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPlayer?.(p)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] text-left transition-all active:scale-[0.98]"
                >
                  <span className="text-[11px] text-white truncate">{p.name}</span>
                  <span className="text-[11px] text-amber-300 font-mono shrink-0">
                    ${(p.spend || 0).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <button
            onClick={onLaunchFocusGroup}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-black" />
            <span>Simulate Focus Group for {selectedRegion.code}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
