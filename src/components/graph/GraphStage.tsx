"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphData, GraphNode, CohortContext, SegmentationLens } from "@/lib/types";

const ForceGraphCanvas = dynamic(() => import("./ForceGraphCanvas"), {
  ssr: false,
});

export interface GraphStageProps {
  data: GraphData;
  is3D: boolean;
  selectedNode: GraphNode | null;
  onNodeClick: (node: GraphNode) => void;
  cohortContext?: CohortContext | null;
  clusterByLabel?: boolean;
  highlightBridges?: boolean;
  segmentationLens?: SegmentationLens;
}

export default function GraphStage({
  data,
  is3D,
  selectedNode,
  onNodeClick,
  cohortContext,
  clusterByLabel = false,
  highlightBridges = false,
  segmentationLens = "FRANCHISE",
}: GraphStageProps) {
  const [dimensions, setDimensions] = useState({ width: 1280, height: 800 });
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
    <div className="relative h-full w-full overflow-hidden bg-court-black hardwood-surface">
      <ForceGraphCanvas
        data={data}
        is3D={is3D}
        selectedNode={selectedNode}
        onNodeClick={onNodeClick}
        width={dimensions.width}
        height={dimensions.height}
        clusterByLabel={clusterByLabel}
        highlightBridges={highlightBridges}
        segmentationLens={segmentationLens}
      />
    </div>
  );
}
