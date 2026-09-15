"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphData, GraphNode, CohortContext } from "@/lib/types";
import { GitBranch, Shield, Zap, ArrowRight } from "lucide-react";

const ForceGraphCanvas = dynamic(() => import("./ForceGraphCanvas"), {
  ssr: false,
});

interface GraphStageProps {
  data: GraphData;
  is3D: boolean;
  selectedNode: GraphNode | null;
  onNodeClick: (node: GraphNode) => void;
  cohortContext?: CohortContext | null;
}

export default function GraphStage({
  data,
  is3D,
  selectedNode,
  onNodeClick,
  cohortContext,
}: GraphStageProps) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateDims = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  if (!mounted) return null;

  const isMultiHop = cohortContext?.isMultiHop;
  const meta = cohortContext?.multiHopMetadata;

  return (
    <div className="relative w-full h-full bg-[#080A0E] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_0%,transparent_70%)]" />

      {/* Spanner Multi-Hop Traversal Floating Overlay */}
      {isMultiHop && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0A0E17]/90 border border-emerald-500/40 backdrop-blur-md shadow-2xl shadow-emerald-950/40 animate-fade-in">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono font-semibold border border-emerald-500/30">
            <GitBranch className="w-3 h-3 animate-pulse" />
            <span>Spanner Multi-Hop Traversal</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-mono">
            {meta?.steps && meta.steps.length > 0 ? (
              meta.steps.map((step, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ArrowRight className="w-3 h-3 text-emerald-400" />}
                  <span
                    className={`font-medium ${
                      idx === 0
                        ? "text-emerald-300"
                        : idx === 1
                        ? "text-emerald-400"
                        : idx === 2
                        ? "text-cyan-300"
                        : "text-rose-300"
                    }`}
                  >
                    {step}
                  </span>
                </React.Fragment>
              ))
            ) : (
              <>
                <span className="text-emerald-300 font-medium">Player</span>
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Clan / Creator</span>
                <ArrowRight className="w-3 h-3 text-cyan-400" />
                <span className="text-cyan-300 font-medium">Squadmate</span>
              </>
            )}
          </div>

          <span className="text-[10px] text-gray-400 border-l border-white/10 pl-2.5">
            Path particles live
          </span>
        </div>
      )}

      <ForceGraphCanvas
        data={data}
        is3D={is3D}
        selectedNode={selectedNode}
        onNodeClick={onNodeClick}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
}
