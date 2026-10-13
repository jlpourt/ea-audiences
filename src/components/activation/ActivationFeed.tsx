"use client";

import React, { useState, useEffect } from "react";
import {
  Radio,
  RefreshCw,
  X,
  ArrowRight,
  Database,
  Send,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { ActivationRecord, A2AMessageType } from "@/lib/types";
import { TabularNumber } from "@/components/brand/TabularNumber";
import { ActivationDAG } from "./ActivationDAG";

export interface ActivationFeedProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchDAG?: () => void;
}

export function ActivationFeed({ isOpen, onClose, onLaunchDAG }: ActivationFeedProps) {
  const [activations, setActivations] = useState<ActivationRecord[]>([]);
  const [a2aMessages, setA2aMessages] = useState<A2AMessageType[]>([]);
  const [activeTab, setActiveTab] = useState<"activations" | "a2a">("activations");
  const [loading, setLoading] = useState<boolean>(false);
  const [isDAGOpen, setIsDAGOpen] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actRes, a2aRes] = await Promise.all([
        fetch("/api/activation/log?limit=25"),
        fetch("/api/a2a"),
      ]);

      if (actRes.ok) {
        const d = await actRes.json();
        setActivations(d.records || []);
      }
      if (a2aRes.ok) {
        const d = await a2aRes.json();
        setA2aMessages(d.messages || []);
      }
    } catch (err) {
      console.error("[ActivationFeed] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      const interval = setInterval(fetchData, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="glass-enter fixed top-0 right-0 bottom-0 z-40 w-[420px] bg-[#0E1015]/98 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col font-sans text-xs animate-drawer-in select-none">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-[#19C37D] animate-pulse" />
            <div>
              <span className="font-semibold text-white tracking-tight text-xs block">
                Courtside Activation & A2A Stream
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                Activation Ledger · Dispatch Bus · A2A Protocol
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchData}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "courtside-Transfer-pulse" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & DAG Trigger */}
        <div className="p-3 border-b border-white/[0.06] bg-black/30 flex items-center justify-between gap-2">
          <div className="flex bg-[#121216] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setActiveTab("activations")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "activations"
                  ? "bg-white/[0.12] text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              Activation Ledger ({activations.length})
            </button>
            <button
              onClick={() => setActiveTab("a2a")}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === "a2a"
                  ? "bg-white/[0.12] text-white"
                  : "text-white/50 hover:text-white"
              }`}
            >
              A2A Handshakes ({a2aMessages.length})
            </button>
          </div>

          <button
            onClick={() => {
              if (onLaunchDAG) onLaunchDAG();
              else setIsDAGOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#E4002B] hover:bg-[#A3001F] text-white font-semibold text-[10px] flex items-center gap-1 shadow-md shadow-[#E4002B]/20 transition-colors"
          >
            <Send className="w-3 h-3" />
            Launch DAG
          </button>
        </div>

        {/* Feed List */}
        <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
          {activeTab === "activations" ? (
            activations.length === 0 ? (
              <div className="p-6 text-center text-white/40 space-y-2">
                <Database className="w-6 h-6 mx-auto text-white/20" />
                <p>No activation records found in Activation Ledger.</p>
                <p className="text-[10px]">Approve an audience through the DAG to publish live.</p>
              </div>
            ) : (
              activations.map((act) => (
                <div
                  key={act.activation_id}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-1.5 py-0.5 rounded font-mono font-semibold bg-[#19C37D]/20 text-[#19C37D]">
                      {act.channel}
                    </span>
                    <span className="text-white/40 font-mono">
                      {new Date(act.published_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="font-semibold text-white text-xs">
                    {act.payload?.audienceName || act.audience_id}
                  </div>

                  {act.pubsub_message_id && (
                    <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-mono">
                      <Radio className="w-3 h-3 text-[#19C37D]" />
                      <span>Dispatch ID: {act.pubsub_message_id}</span>
                    </div>
                  )}

                  {act.payload?.matchedCount && (
                    <div className="text-[10px] text-white/50">
                      Dispatched to <span className="text-white font-mono">{act.payload.matchedCount}</span> targeted players
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            a2aMessages.length === 0 ? (
              <div className="p-6 text-center text-white/40 space-y-2">
                <Radio className="w-6 h-6 mx-auto text-white/20" />
                <p>No active A2A agent messages.</p>
              </div>
            ) : (
              a2aMessages.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-white">{m.sender}</span>
                      <ArrowRight className="w-3 h-3 text-white/40" />
                      <span className="text-white/80">{m.recipient}</span>
                    </div>
                    <span className="text-white/40 font-mono">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-[#19C37D]">{m.intent}</div>

                  <pre className="text-[10px] text-white/70 bg-black/40 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(m.payload, null, 2)}
                  </pre>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Internal DAG Modal */}
      {isDAGOpen && (
        <ActivationDAG
          isOpen={isDAGOpen}
          onClose={() => setIsDAGOpen(false)}
          onDispatched={() => {
            fetchData();
          }}
        />
      )}

      <style jsx>{`
        @keyframes drawerIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-drawer-in {
          animation: drawerIn 320ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
      `}</style>
    </>
  );
}

// Alias for backwards compatibility
export const A2ANegotiationFeed = ActivationFeed;
export default ActivationFeed;
