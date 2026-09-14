"use client";

import React, { useState } from "react";
import { CohortContext } from "@/lib/types";
import { isWhaleArchetype } from "@/lib/archetypes";

interface SensitivitySimulatorProps {
  cohortContext?: CohortContext | null;
  baseSpend: number;
  baseRoas: number;
}

export default function SensitivitySimulator({
  cohortContext,
  baseSpend,
  baseRoas,
}: SensitivitySimulatorProps) {
  const [price, setPrice] = useState(4.99);
  const [budget, setBudget] = useState(baseSpend || 120000);
  const [lossThreshold, setLossThreshold] = useState(3);
  const [discount, setDiscount] = useState(25);

  const audienceSize = cohortContext?.estimatedTotal || 4200;
  const isWhaleCohort = isWhaleArchetype(cohortContext?.dominantArchetype);

  const elasticityFactor = isWhaleCohort
    ? Math.max(0.6, 1.2 - (price / 80))
    : Math.max(0.2, 1.4 - (price / 12));

  const predictedLift = Math.min(48.5, Math.max(8.2, Number((24.0 * elasticityFactor * (1 + discount / 100)).toFixed(1))));
  const churnMitigation = Math.min(38.0, Math.max(5.0, Number((18.0 * (lossThreshold === 3 ? 1.2 : lossThreshold === 2 ? 1.0 : 0.7)).toFixed(1))));
  const estimatedBuyers = Math.round(audienceSize * (0.042 * (1 + predictedLift / 100)));
  const projectedRevenue = Math.round(budget * baseRoas * (1 + predictedLift / 100));

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-5 font-sans text-xs">
      {/* Sliders */}
      <div className="grid grid-cols-3 gap-5">
        {/* Slider 1: Price */}
        <div className="space-y-2 bg-black/40 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-medium">Offer Price</span>
            <span className="text-white font-semibold text-sm font-mono">${price.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.99"
            max="49.99"
            step="1.00"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>$0.99</span>
            <span>$49.99</span>
          </div>
        </div>

        {/* Slider 2: Budget */}
        <div className="space-y-2 bg-black/40 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-medium">Media Budget</span>
            <span className="text-white font-semibold text-sm font-mono">${(budget / 1000).toFixed(0)}K</span>
          </div>
          <input
            type="range"
            min="10000"
            max="500000"
            step="10000"
            value={budget}
            onChange={(e) => setBudget(parseInt(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>$10K</span>
            <span>$500K</span>
          </div>
        </div>

        {/* Slider 3: Loss Threshold */}
        <div className="space-y-2 bg-black/40 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-medium">Loss Streak Trigger</span>
            <span className="text-white font-semibold text-sm font-mono">{lossThreshold} Losses</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={lossThreshold}
            onChange={(e) => setLossThreshold(parseInt(e.target.value))}
            className="w-full accent-white cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>1 Match</span>
            <span>5 Matches</span>
          </div>
        </div>
      </div>

      {/* Recalculated Metric Cards */}
      <div className="grid grid-cols-4 gap-3 pt-2">
        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-left">
          <span className="text-[10px] text-gray-500 block uppercase">Conversion Lift</span>
          <span className="text-base font-semibold text-emerald-400 font-mono">+{predictedLift}%</span>
          <span className="text-[11px] text-gray-400 block mt-0.5">~{estimatedBuyers.toLocaleString()} Buyers</span>
        </div>

        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-left">
          <span className="text-[10px] text-gray-500 block uppercase">Churn Saved</span>
          <span className="text-base font-semibold text-cyan-400 font-mono">+{churnMitigation}%</span>
          <span className="text-[11px] text-gray-400 block mt-0.5">rage-quit recovery</span>
        </div>

        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-left">
          <span className="text-[10px] text-gray-500 block uppercase">Net Revenue</span>
          <span className="text-base font-semibold text-amber-300 font-mono">${(projectedRevenue / 1000).toFixed(0)}K</span>
          <span className="text-[11px] text-gray-400 block mt-0.5">incremental rev</span>
        </div>

        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-left">
          <span className="text-[10px] text-gray-500 block uppercase">Price Elasticity</span>
          <span className="text-base font-semibold text-white font-mono">{elasticityFactor.toFixed(2)}x</span>
          <span className="text-[11px] text-gray-400 block mt-0.5">curve sensitivity</span>
        </div>
      </div>
    </div>
  );
}
