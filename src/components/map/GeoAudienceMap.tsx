"use client";

import React, { useState, useMemo } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { CohortContext } from "@/lib/types";
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
    dominantArchetype: "ULTIMATE_TEAM_WHALE",
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
  cohortContext?: CohortContext | null;
  onSelectRegion?: (region: GeoRegion) => void;
  onLaunchFocusGroup?: () => void;
}

export default function GeoAudienceMap({
  cohortContext,
  onSelectRegion,
  onLaunchFocusGroup,
}: GeoAudienceMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<GeoRegion>(REGIONS[0]);
  const [hoveredRegion, setHoveredRegion] = useState<GeoRegion | null>(null);

  const isWhaleCohort = cohortContext?.dominantArchetype === "ULTIMATE_TEAM_WHALE";
  const isGrinderCohort = cohortContext?.dominantArchetype === "COMPETITIVE_GRINDER";

  // SVG Width & Height for accurate projection
  const width = 960;
  const height = 480;

  // D3 Natural Earth Geographic Projection & Path Generator
  const { countriesPaths, graticulesPath, projectedPoints } = useMemo(() => {
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

    // Project DMA points
    const points = REGIONS.map((r) => {
      const [px, py] = projection(r.coordinates) || [0, 0];
      return {
        ...r,
        px,
        py,
      };
    });

    return {
      countriesPaths: countryPathsList,
      graticulesPath: graticules,
      projectedPoints: points,
    };
  }, []);

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

            {/* Connecting Fiber Arcs from GCP Central Edges */}
            <g stroke="rgba(52, 211, 153, 0.3)" strokeWidth="1" strokeDasharray="3,3" fill="none">
              {/* NYC to London */}
              <path d="M 314,135 Q 400,90 480,105" />
              {/* LAX to NYC */}
              <path d="M 198,154 Q 256,120 314,135" />
              {/* London to Riyadh */}
              <path d="M 480,105 Q 560,140 635,188" />
              {/* NYC to Sao Paulo */}
              <path d="M 314,135 Q 360,250 405,335" />
              {/* Riyadh to Tokyo */}
              <path d="M 635,188 Q 720,160 799,149" />
            </g>
          </svg>

          {/* 2. Interactive DMA Hotspot Nodes Positioned Exactly at Projected Coordinates */}
          {projectedPoints.map((r) => {
            const isSelected = selectedRegion.id === r.id;
            const isHovered = hoveredRegion?.id === r.id;
            const isHighlighted = isWhaleCohort
              ? r.dominantArchetype === "ULTIMATE_TEAM_WHALE"
              : isGrinderCohort
              ? r.dominantArchetype === "COMPETITIVE_GRINDER"
              : true;

            const size = isSelected ? 22 : isHighlighted ? 17 : 13;
            const leftPct = (r.px / width) * 100;
            const topPct = (r.py / height) * 100;

            return (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRegion(r);
                  onSelectRegion?.(r);
                }}
                onMouseEnter={() => setHoveredRegion(r)}
                onMouseLeave={() => setHoveredRegion(null)}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
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
                      <span className="text-emerald-400 font-mono">
                        {(r.addressablePlayers / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Avg Spend: ${r.avgSpendUsd} • Ping: {r.serverPingMs}ms
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Right Region Telemetry Drawer (Apple-style Clean Card) */}
      <div className="w-96 border-l border-white/10 bg-[#0E1015]/95 backdrop-blur-2xl p-6 flex flex-col justify-between z-30 space-y-4">
        {/* Drawer Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                Regional DMA Intelligence
              </span>
              <h3 className="text-base font-semibold text-white mt-0.5 tracking-tight">
                {selectedRegion.name}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedRegion.country} • {selectedRegion.gcpRegion}
              </p>
            </div>
            <div className="w-8 h-8 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <Globe className="w-4 h-4" />
            </div>
          </div>

          {/* Regional Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Addressable Cohort</span>
              <span className="text-base font-semibold text-white font-mono mt-0.5 block">
                {selectedRegion.addressablePlayers.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">active ABK players</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Whale Population</span>
              <span className="text-base font-semibold text-amber-300 font-mono mt-0.5 block">
                {selectedRegion.whaleCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">&gt;$3,500 LTV spenders</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Avg Market Spend</span>
              <span className="text-base font-semibold text-emerald-400 font-mono mt-0.5 block">
                ${selectedRegion.avgSpendUsd}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">per active account</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[10px] text-gray-500 uppercase block">Battle.net Match Ping</span>
              <span className="text-base font-semibold text-cyan-400 font-mono mt-0.5 block">
                {selectedRegion.serverPingMs} ms
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">GCP low-latency edge</span>
            </div>
          </div>

          {/* Situational Trigger Alert */}
          <div className="mt-4 p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Situational Trigger in DMA</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
              <strong>{selectedRegion.activeLossStreakPlayers} players</strong> in {selectedRegion.name} are currently on a 3+ loss streak in competitive queues.
            </p>
            <div className="text-[10px] text-emerald-400 font-medium pt-1">
              ✓ Recommended: Deliver $9.99 BlackCell Pass & Loss Shield
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <button
            onClick={onLaunchFocusGroup}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black hover:bg-gray-200 text-xs font-semibold shadow-lg transition-all"
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
