"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Palette,
  ShieldCheck,
  Send,
  Database,
  Radio,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
} from "lucide-react";
import { ActivationChannel } from "@/lib/types";
import { HoldToConfirm } from "@/components/brand/HoldToConfirm";
import { ModelBadge } from "@/components/brand/ModelBadge";
import { TabularNumber } from "@/components/brand/TabularNumber";

export interface ActivationDAGProps {
  isOpen: boolean;
  onClose: () => void;
  audienceId?: string;
  audienceName?: string;
  matchedCount?: number;
  selectedChannels?: ActivationChannel[];
  offerId?: string;
  nlQuery?: string;
  onDispatched?: (results: any) => void;
}

type NodeStatus = "idle" | "running" | "paused_hitl" | "completed" | "error";

interface DAGNodeState {
  id: string;
  label: string;
  sublabel: string;
  badge?: string;
  modelId?: string;
  status: NodeStatus;
  x: number;
  y: number;
  metadata?: string;
}

export function ActivationDAG({
  isOpen,
  onClose,
  audienceId = "aud-s2-cliff-rescue",
  audienceName = "NBA 2K27 Season 2 Cliff Rescue Cohort",
  matchedCount = 431,
  selectedChannels = ["2K_ACCOUNT_EMAIL", "IN_GAME_INBOX", "PUSH_2K_MOBILE"],
  offerId = "off-crew-reup-bundle",
  nlQuery = "MyCAREER builds under 85 OVR with $50+ VC spend and 7+ days inactivity",
  onDispatched,
}: ActivationDAGProps) {
  // DAG Execution Step: 0: Audience -> 1: Brief -> 2: Creative -> 3: HITL -> 4: Dispatching -> 5: Done
  const [executionStep, setExecutionStep] = useState<number>(0);
  const [dispatchResults, setDispatchResults] = useState<any[]>([]);
  const [pubsubMessageId, setPubsubMessageId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Auto-advance through agents up to HITL Policy Gate (Step 3)
  useEffect(() => {
    if (!isOpen) {
      setExecutionStep(0);
      setDispatchResults([]);
      setPubsubMessageId(null);
      setDispatchError(null);
      return;
    }

    // Step 0: Audience resolves immediately
    const t1 = setTimeout(() => setExecutionStep(1), 600); // Brief Agent
    const t2 = setTimeout(() => setExecutionStep(2), 1400); // Creative Agent
    const t3 = setTimeout(() => setExecutionStep(3), 2200); // HITL Gate Pause

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen]);

  // Execute Dispatch on HoldToConfirm
  const handleHITLApproval = async () => {
    setIsSubmitting(true);
    setDispatchError(null);
    setExecutionStep(4);

    try {
      const res = await fetch("/api/activation/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId,
          audienceName,
          matchedCount,
          channels: selectedChannels,
          offerId,
          nlQuery,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setPubsubMessageId(data.messageId);
      setDispatchResults(data.results || []);
      setExecutionStep(5);

      if (onDispatched) {
        onDispatched(data);
      }
    } catch (err: any) {
      console.error("[ActivationDAG] dispatch error:", err);
      setDispatchError(err?.message || "Dispatch failed");
      setExecutionStep(3); // return to HITL gate on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Node position coordinates for SVG
  const audienceStatus: NodeStatus = executionStep >= 1 ? "completed" : "running";
  const briefStatus: NodeStatus = executionStep >= 2 ? "completed" : executionStep === 1 ? "running" : "idle";
  const creativeStatus: NodeStatus = executionStep >= 3 ? "completed" : executionStep === 2 ? "running" : "idle";
  const hitlStatus: NodeStatus = executionStep >= 5 ? "completed" : executionStep === 4 ? "running" : executionStep === 3 ? "paused_hitl" : "idle";
  const channelStatus: NodeStatus = executionStep >= 5 ? "completed" : executionStep === 4 ? "running" : "idle";
  const bqStatus: NodeStatus = executionStep >= 5 ? "completed" : "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-6">
      <div className="glass-enter relative w-full max-w-5xl bg-[#0A0A0C] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#121216]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#E4002B]/20 border border-[#E4002B]/30 flex items-center justify-center">
              <Send className="w-4 h-4 text-[#E4002B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  Activation DAG & Multi-Agent Dispatch Pipeline
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[#19C37D]/20 text-[#19C37D] border border-[#19C37D]/30">
                  LIVE PIPELINE
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                2K Identity Graph → Synthesis Agents → HITL Gate → Dispatch Bus & Activation Ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audience Banner */}
        <div className="px-6 py-2.5 bg-[#121216]/60 border-b border-white/[0.06] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-white/40">AUDIENCE:</span>
            <span className="font-semibold text-white">{audienceName}</span>
            <span className="text-white/40">|</span>
            <span className="text-[#F5B400]">
              <TabularNumber value={matchedCount} /> Players Matched
            </span>
          </div>
          {pubsubMessageId && (
            <div className="flex items-center gap-2 text-[#19C37D]">
              <Radio className="w-3.5 h-3.5" />
              <span>Dispatch ID: {pubsubMessageId}</span>
            </div>
          )}
        </div>

        {/* DAG Visualization Area */}
        <div className="relative flex-1 p-8 overflow-x-auto min-h-[380px] flex flex-col justify-center">
          {/* SVG Connection Edges with animated dashed stream packets */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 960 380">
            <defs>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E4002B" />
                <stop offset="100%" stopColor="#19C37D" />
              </linearGradient>
            </defs>

            {/* Edge 1: Audience -> Brief */}
            <path
              d="M 180 180 L 260 180"
              stroke={executionStep >= 1 ? "#E4002B" : "rgba(255,255,255,0.1)"}
              strokeWidth={executionStep >= 1 ? 2.5 : 1}
              className={executionStep === 1 ? "dag-edge-active" : ""}
            />

            {/* Edge 2: Brief -> Creative */}
            <path
              d="M 390 180 L 460 180"
              stroke={executionStep >= 2 ? "#E4002B" : "rgba(255,255,255,0.1)"}
              strokeWidth={executionStep >= 2 ? 2.5 : 1}
              className={executionStep === 2 ? "dag-edge-active" : ""}
            />

            {/* Edge 3: Creative -> HITL Gate */}
            <path
              d="M 590 180 L 660 180"
              stroke={executionStep >= 3 ? (executionStep === 3 ? "#F5B400" : "#19C37D") : "rgba(255,255,255,0.1)"}
              strokeWidth={executionStep >= 3 ? 2.5 : 1}
              className={executionStep === 3 ? "dag-edge-amber" : executionStep > 3 ? "dag-edge-active" : ""}
            />

            {/* Edge 4: HITL Gate -> Channels */}
            <path
              d="M 780 180 L 840 180"
              stroke={executionStep >= 4 ? "#19C37D" : "rgba(255,255,255,0.1)"}
              strokeWidth={executionStep >= 4 ? 2.5 : 1}
              className={executionStep >= 4 ? "dag-edge-active" : ""}
            />
          </svg>

          {/* DAG Nodes Layout */}
          <div className="relative flex items-center justify-between gap-4 z-10">
            {/* Node 1: Audience Segment */}
            <div
              className={`w-44 p-4 rounded-2xl bg-[#121216] border transition-all duration-200 ${
                audienceStatus === "completed"
                  ? "border-[#19C37D]/60 shadow-lg shadow-[#19C37D]/10"
                  : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Users className="w-4 h-4 text-[#E4002B]" />
                <span className="text-[10px] font-mono text-white/50">STEP 1</span>
              </div>
              <div className="text-xs font-semibold text-white">Audience Segment</div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">2K Identity Graph</div>
              <div className="mt-3 text-[11px] font-mono font-semibold text-[#F5B400]">
                {matchedCount} Players
              </div>
            </div>

            {/* Node 2: Brief Agent */}
            <div
              className={`w-48 p-4 rounded-2xl bg-[#121216] border transition-all duration-200 ${
                briefStatus === "completed"
                  ? "border-[#19C37D]/60 shadow-lg shadow-[#19C37D]/10"
                  : briefStatus === "running"
                  ? "border-[#E4002B] scale-[1.02] shadow-lg shadow-[#E4002B]/20"
                  : "border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-4 h-4 text-[#F5B400]" />
                <ModelBadge modelId="Offer & Copy Brief" size="xs" />
              </div>
              <div className="text-xs font-semibold text-white">Brief Agent</div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">Automated Brief</div>
              <div className="mt-3 text-[10px] text-white/70">
                {briefStatus === "completed" ? "✓ Brief synthesized" : briefStatus === "running" ? "Reasoning..." : "Pending"}
              </div>
            </div>

            {/* Node 3: Creative Agent */}
            <div
              className={`w-48 p-4 rounded-2xl bg-[#121216] border transition-all duration-200 ${
                creativeStatus === "completed"
                  ? "border-[#19C37D]/60 shadow-lg shadow-[#19C37D]/10"
                  : creativeStatus === "running"
                  ? "border-[#E4002B] scale-[1.02] shadow-lg shadow-[#E4002B]/20"
                  : "border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Palette className="w-4 h-4 text-[#E4002B]" />
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-white/80">
                  MULTIMODAL
                </span>
              </div>
              <div className="text-xs font-semibold text-white">Creative Agent</div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">Art · Arena VO · Audio</div>
              <div className="mt-3 text-[10px] text-white/70">
                {creativeStatus === "completed" ? "✓ Pack art + Announcer" : creativeStatus === "running" ? "Generating..." : "Pending"}
              </div>
            </div>

            {/* Node 4: HITL Policy Gate */}
            <div
              className={`w-48 p-4 rounded-2xl bg-[#121216] border transition-all duration-200 ${
                hitlStatus === "completed"
                  ? "border-[#19C37D]/60 shadow-lg shadow-[#19C37D]/10"
                  : hitlStatus === "paused_hitl"
                  ? "border-[#F5B400] scale-[0.99] shadow-lg shadow-[#F5B400]/20"
                  : "border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    hitlStatus === "paused_hitl" ? "text-[#F5B400]" : hitlStatus === "completed" ? "text-[#19C37D]" : "text-white/40"
                  }`}
                />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/70">
                  GATE 1
                </span>
              </div>
              <div className="text-xs font-semibold text-white">Policy Gate (HITL)</div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">Operator Hold-to-Confirm</div>
              <div className="mt-3 text-[10px] font-medium">
                {hitlStatus === "completed" ? (
                  <span className="text-[#19C37D]">✓ Operator Approved</span>
                ) : hitlStatus === "paused_hitl" ? (
                  <span className="text-[#F5B400] animate-pulse">Awaiting Sign-Off</span>
                ) : (
                  <span className="text-white/40">Locked</span>
                )}
              </div>
            </div>

            {/* Node 5: Dispatched Channels & Activation Ledger */}
            <div
              className={`w-52 p-4 rounded-2xl bg-[#121216] border transition-all duration-200 ${
                channelStatus === "completed"
                  ? "border-[#19C37D]/60 shadow-lg shadow-[#19C37D]/10"
                  : "border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Database className="w-4 h-4 text-[#19C37D]" />
                <span className="text-[10px] font-mono text-[#19C37D]">DISPATCH & LEDGER</span>
              </div>
              <div className="text-xs font-semibold text-white">Activation Channels</div>
              <div className="text-[10px] text-white/50 font-mono mt-0.5">
                {selectedChannels.length} Channels Target
              </div>
              <div className="mt-2 space-y-1">
                {selectedChannels.slice(0, 3).map((ch) => (
                  <div key={ch} className="text-[10px] font-mono text-white/70 truncate">
                    · {ch.replace(/_/g, " ")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Hold-to-Confirm HITL Control Bar */}
        <div className="px-8 py-5 border-t border-white/[0.08] bg-[#121216]/95 flex items-center justify-between">
          <div className="text-xs">
            {executionStep === 3 ? (
              <div className="flex items-center gap-2 text-[#F5B400]">
                <Clock className="w-4 h-4 animate-spin" />
                <span className="font-semibold">Pipeline paused at Policy Gate. Hold button to execute live dispatch.</span>
              </div>
            ) : executionStep === 4 ? (
              <div className="flex items-center gap-2 text-[#E4002B]">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="font-semibold">Publishing to twok-courtside-activations and writing Activation Ledger...</span>
              </div>
            ) : executionStep >= 5 ? (
              <div className="flex items-center gap-2 text-[#19C37D]">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-semibold">
                  Activation successfully published to Dispatch Bus and written to Activation Ledger.
                </span>
              </div>
            ) : (
              <span className="text-white/50">Advancing through multi-agent DAG...</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {executionStep === 3 && (
              <HoldToConfirm
                label="Hold to Approve & Dispatch"
                confirmedLabel="Approved · Publishing"
                tone="red"
                onConfirm={handleHITLApproval}
                disabled={isSubmitting}
              />
            )}

            {executionStep >= 5 && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#19C37D] hover:bg-[#149b63] text-xs font-semibold text-black font-mono transition-colors"
              >
                Close & Return
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DAG Motion Styles */}
      <style jsx>{`
        .dag-edge-active {
          stroke-dasharray: 6 8;
          animation: a2aStream 600ms linear infinite;
        }
        .dag-edge-amber {
          stroke-dasharray: 6 8;
          animation: a2aStream 900ms linear infinite;
        }
        @keyframes a2aStream {
          to {
            stroke-dashoffset: -28;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivationDAG;
