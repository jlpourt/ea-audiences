"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphData, GraphNode, CohortContext } from "@/lib/types";

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

  return (
    <div className="relative w-full h-full bg-[#080A0E] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_0%,transparent_70%)]" />

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
