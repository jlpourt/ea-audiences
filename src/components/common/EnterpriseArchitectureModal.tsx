"use client";

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Cpu,
  Database,
  GitBranch,
  Layers,
  ShieldCheck,
  Zap,
  Play,
  Pause,
  ArrowRight,
  Network,
  Sparkles,
  CheckCircle2,
  Code2,
  RefreshCw,
} from "lucide-react";

export type ArchitectureTabId = "federation" | "semantic" | "scale";

interface EnterpriseArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ArchitectureTabId;
}

interface StepSpec {
  id: number;
  shortLabel: string;
  badge: string;
  headline: string;
  highlightNodes: string[];
}

interface Point {
  x: number;
  y: number;
}

const ARCH_TABS: Array<{
  id: ArchitectureTabId;
  num: string;
  title: string;
}> = [
  {
    id: "federation",
    num: "01",
    title: "Snowflake & Databricks Federation",
  },
  {
    id: "semantic",
    num: "02",
    title: "Semantic Layer & Ontology",
  },
  {
    id: "scale",
    num: "03",
    title: "Interactive Scale & Living Context",
  },
];

const STEPS_BY_TAB: Record<ArchitectureTabId, StepSpec[]> = {
  federation: [
    {
      id: 0,
      shortLabel: "① Data Surfaces",
      badge: "ZERO RIP-AND-REPLACE",
      headline:
        "Snowflake (spend/LTV) and Databricks (telemetry/ML) stay in place while Spanner Graph powers 2-hop social edges.",
      highlightNodes: ["sf", "dbx", "spanner"],
    },
    {
      id: 1,
      shortLabel: "② ADK + MCP Pipe",
      badge: "DETERMINISTIC HYDRATION (<35MS)",
      headline:
        "ADK + MCP Tools pull governed Snowflake SQL, Unity Catalog features, and Spanner GQL with zero double-LLM hop latency.",
      highlightNodes: ["sf", "dbx", "spanner", "mcp", "gemini"],
    },
    {
      id: 2,
      shortLabel: "③ Genie A2A Bridge",
      badge: "AGENT-TO-AGENT DELEGATION",
      headline:
        "A2A delegates open-ended Lakehouse data science to Databricks Genie Agents, returning structured findings to Gemini.",
      highlightNodes: ["dbx", "a2a", "gemini"],
    },
    {
      id: 3,
      shortLabel: "④ Unified Simulation",
      badge: "LIVE IN COURTSIDE",
      headline:
        "Gemini 3.8 Flash fuses Snowflake LTV + Databricks Churn Hazard + Spanner Crew Gravity into one interactive simulation.",
      highlightNodes: ["sf", "dbx", "spanner", "mcp", "a2a", "gemini"],
    },
  ],
  semantic: [
    {
      id: 0,
      shortLabel: "① Business Intent",
      badge: "RAW VERNACULAR",
      headline:
        'Teams query in domain terms ("84 OVR Cliff", "High Tilt Risk", "Persuadable Holdouts")—never raw table joins.',
      highlightNodes: ["intent"],
    },
    {
      id: 1,
      shortLabel: "② Semantic Registry",
      badge: "GOVERNED METRIC VIEWS",
      headline:
        "MCP exposes canonical metrics from Databricks Unity Catalog & Snowflake YAML so LTV, mROAS, and CATE match everywhere.",
      highlightNodes: ["intent", "sem_metrics"],
    },
    {
      id: 2,
      shortLabel: "③ Graph Ontology",
      badge: "ENTITY RELATIONSHIPS",
      headline:
        "Property Graph Ontology maps Players → Crews → Captains → Creators into explicit, traversal-ready 2-hop paths.",
      highlightNodes: ["intent", "sem_ontology", "sem_metrics"],
    },
    {
      id: 3,
      shortLabel: "④ Verified Execution",
      badge: "ZERO HALLUCINATION",
      headline:
        "Gemini compiles intent into parameterized GQL & Warehouse SQL (@params only), verified against live schema contracts.",
      highlightNodes: [
        "sem_metrics",
        "sem_ontology",
        "out_gql",
        "out_sql",
        "out_kpi",
      ],
    },
  ],
  scale: [
    {
      id: 0,
      shortLabel: "① Bifurcated Compute",
      badge: "WHY 6,500 AGENTS RUN INSTANTLY",
      headline:
        "Gemini 3.8 Flash simulates behavioral inflection points while vectorized engines compute graph & survival math in <30ms.",
      highlightNodes: ["brain_llm", "brain_vec", "scale_canvas"],
    },
    {
      id: 1,
      shortLabel: "② Live MCP Introspection",
      badge: "ZERO MANUAL DOCS",
      headline:
        "MCP Schema Servers introspect Unity Catalog, Snowflake YAML, and TypeScript ASTs live—variable definitions never drift.",
      highlightNodes: ["ctx_mcp", "ctx_cache"],
    },
    {
      id: 2,
      shortLabel: "③ Context Caching",
      badge: "-85% TOKEN COST · ZERO DRIFT",
      headline:
        "Architectural rules (GEMINI.md), metric formulas, and Graph DDL stay pinned in Vertex AI Context Caching across turns.",
      highlightNodes: ["ctx_cache", "ctx_guard"],
    },
    {
      id: 3,
      shortLabel: "④ CI Contract Guardian",
      badge: "AUTOMATED SCHEMA GUARDRAILS",
      headline:
        "Gemini 3.5 Flash-Lite contract agents verify every generated GQL/SQL query and variable against the live schema.",
      highlightNodes: ["ctx_mcp", "ctx_cache", "ctx_guard", "scale_canvas"],
    },
  ],
};

/** Crisp custom vector icons for Snowflake, Databricks, and Gemini */
function SnowflakeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07L19.07 4.93"
        stroke="#29B5E8"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="#0B0D16"
        stroke="#29B5E8"
        strokeWidth="2"
      />
    </svg>
  );
}

function DatabricksIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3L3 8l9 5 9-5-9-5z"
        stroke="#FF3621"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 12.5l9 5 9-5M3 17l9 5 9-5"
        stroke="#FF3621"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GeminiSparkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z"
        fill="url(#gemini-spark-grad)"
      />
      <defs>
        <linearGradient id="gemini-spark-grad" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#00F5D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Smooth horizontal or vertical cubic bezier path between two measured DOM ports */
function buildBezierPath(
  a: Point | undefined,
  b: Point | undefined,
  orientation: "horizontal" | "vertical" = "horizontal"
): string {
  if (!a || !b) return "";
  if (orientation === "vertical") {
    const dy = (b.y - a.y) * 0.52;
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
  }
  const dx = (b.x - a.x) * 0.48;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function EnterpriseArchitectureButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="enterprise-arch-btn"
      title="Enterprise Architecture Blueprint: Snowflake · Databricks Genie (A2A) · ADK/MCP · Semantic Scale"
      className={`group relative flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-[#4285F4]/15 hover:border-[#669DF6]/60 text-white/70 hover:text-white transition-all active:scale-95 ${
        compact ? "w-7 h-7" : "w-8 h-8"
      }`}
    >
      <Network className="w-3.5 h-3.5 text-[#A8C7FA] group-hover:text-[#00F5D4] transition-colors" />
      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00F5D4] opacity-80 group-hover:animate-ping" />
    </button>
  );
}

export default function EnterpriseArchitectureModal({
  isOpen,
  onClose,
  initialTab = "federation",
}: EnterpriseArchitectureModalProps) {
  const [activeTab, setActiveTab] = useState<ArchitectureTabId>(initialTab);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [ports, setPorts] = useState<Record<string, Point>>({});
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({
    w: 1000,
    h: 450,
  });

  const steps = STEPS_BY_TAB[activeTab];
  const currentStep = steps[activeStep] || steps[0];

  // Measure exact DOM coordinates of every [data-port] anchor inside stageRef
  const measurePorts = useCallback(() => {
    const container = stageRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;
    setStageSize({ w: cRect.width, h: cRect.height });

    const nextPorts: Record<string, Point> = {};
    const portEls = container.querySelectorAll<HTMLElement>("[data-port]");
    portEls.forEach((el) => {
      const id = el.getAttribute("data-port");
      if (!id) return;
      const r = el.getBoundingClientRect();
      nextPorts[id] = {
        x: r.left - cRect.left + r.width / 2,
        y: r.top - cRect.top + r.height / 2,
      };
    });
    setPorts(nextPorts);
  }, []);

  // Re-measure on open, tab switch, step switch, and window resize
  useLayoutEffect(() => {
    if (!isOpen) return;
    measurePorts();
    const t1 = setTimeout(measurePorts, 60);
    const t2 = setTimeout(measurePorts, 260);
    window.addEventListener("resize", measurePorts);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measurePorts);
    };
  }, [isOpen, activeTab, activeStep, measurePorts]);

  // Reset step to 0 when switching architecture tabs
  useEffect(() => {
    setActiveStep(0);
  }, [activeTab]);

  // Auto-cycle steps every 4.2s when auto-play is active
  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [isOpen, isAutoPlaying, steps.length]);

  if (!isOpen) return null;

  const isHighlighted = (nodeId: string) => {
    if (hoveredNode === nodeId) return true;
    return currentStep.highlightNodes.includes(nodeId);
  };

  // Dynamic wires for active tab based on exact measured port positions
  const activeWires = (() => {
    if (activeTab === "federation") {
      return [
        // Snowflake -> ADK/MCP top port
        {
          id: "sf-mcp",
          d: buildBezierPath(ports["sf-out"], ports["mcp-in-top"], "horizontal"),
          grad: "url(#arch-mcp-grad)",
          color: "#29B5E8",
          active: activeStep === 0 || activeStep === 1 || activeStep === 3,
        },
        // Databricks -> ADK/MCP mid port
        {
          id: "dbx-mcp",
          d: buildBezierPath(
            ports["dbx-out-top"],
            ports["mcp-in-mid"],
            "horizontal"
          ),
          grad: "url(#arch-mcp-grad)",
          color: "#4285F4",
          active: activeStep === 1 || activeStep === 3,
        },
        // Databricks Genie -> A2A Protocol Bridge
        {
          id: "dbx-a2a",
          d: buildBezierPath(ports["dbx-out-bot"], ports["a2a-in"], "horizontal"),
          grad: "url(#arch-a2a-grad)",
          color: "#FF3621",
          active: activeStep === 0 || activeStep === 2 || activeStep === 3,
        },
        // Spanner Graph -> ADK/MCP bottom port
        {
          id: "spanner-mcp",
          d: buildBezierPath(
            ports["spanner-out"],
            ports["mcp-in-bot"],
            "horizontal"
          ),
          grad: "url(#arch-spanner-grad)",
          color: "#00F5D4",
          active: activeStep === 0 || activeStep === 1 || activeStep === 3,
        },
        // ADK/MCP -> Gemini top port
        {
          id: "mcp-gemini",
          d: buildBezierPath(
            ports["mcp-out"],
            ports["gemini-in-top"],
            "horizontal"
          ),
          grad: "url(#arch-mcp-grad)",
          color: "#00F5D4",
          active: activeStep === 1 || activeStep === 3,
        },
        // A2A Bridge -> Gemini bottom port
        {
          id: "a2a-gemini",
          d: buildBezierPath(
            ports["a2a-out"],
            ports["gemini-in-bot"],
            "horizontal"
          ),
          grad: "url(#arch-a2a-grad)",
          color: "#FFB800",
          active: activeStep === 2 || activeStep === 3,
        },
      ];
    }

    if (activeTab === "semantic") {
      return [
        // Business Intent -> Governed Metric Views
        {
          id: "intent-metrics",
          d: buildBezierPath(
            ports["intent-out-l"],
            ports["metrics-in"],
            "vertical"
          ),
          grad: "url(#arch-mcp-grad)",
          color: "#4285F4",
          active: activeStep >= 0,
        },
        // Business Intent -> Property Graph Ontology
        {
          id: "intent-ont",
          d: buildBezierPath(ports["intent-out-r"], ports["ont-in"], "vertical"),
          grad: "url(#arch-spanner-grad)",
          color: "#00F5D4",
          active: activeStep >= 0,
        },
        // Horizontal Bridge: Metric Views <-> Graph Ontology
        {
          id: "metrics-ont-bridge",
          d: buildBezierPath(
            ports["metrics-side"],
            ports["ont-side"],
            "horizontal"
          ),
          grad: "url(#arch-a2a-grad)",
          color: "#9B72CB",
          active: activeStep >= 2,
        },
        // Metric Views -> Out 1 (GQL) & Out 2 (SQL)
        {
          id: "metrics-out1",
          d: buildBezierPath(
            ports["metrics-out-l"],
            ports["out1-in"],
            "vertical"
          ),
          grad: "url(#arch-spanner-grad)",
          color: "#00F5D4",
          active: activeStep === 3,
        },
        {
          id: "metrics-out2",
          d: buildBezierPath(
            ports["metrics-out-r"],
            ports["out2-in"],
            "vertical"
          ),
          grad: "url(#arch-mcp-grad)",
          color: "#4285F4",
          active: activeStep === 3,
        },
        // Graph Ontology -> Out 2 (SQL) & Out 3 (KPI)
        {
          id: "ont-out2",
          d: buildBezierPath(ports["ont-out-l"], ports["out2-in"], "vertical"),
          grad: "url(#arch-mcp-grad)",
          color: "#669DF6",
          active: activeStep === 3,
        },
        {
          id: "ont-out3",
          d: buildBezierPath(ports["ont-out-r"], ports["out3-in"], "vertical"),
          grad: "url(#arch-spanner-grad)",
          color: "#19C37D",
          active: activeStep === 3,
        },
      ];
    }

    return [];
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enterprise Architecture Blueprint"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 sm:p-6 font-sans select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-[1180px] h-[84vh] max-h-[760px] rounded-2xl border border-white/[0.1] bg-[#040407] shadow-[0_28px_90px_rgba(0,0,0,0.92)] flex flex-col justify-between overflow-hidden text-white"
      >
        {/* Ambient Gemini Dark Nebula Glow + Dot Grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[620px] h-[240px] rounded-full blur-[95px] opacity-30"
            style={{
              background:
                "radial-gradient(circle, rgba(66,133,244,0.55) 0%, rgba(155,114,203,0.35) 55%, rgba(0,245,212,0) 100%)",
            }}
          />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[680px] h-[240px] rounded-full blur-[110px] opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(0,245,212,0.4) 0%, rgba(155,114,203,0.3) 60%, transparent 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        {/* ================= TOP BAR: 3 ARCHITECTURE TABS + CLOSE ================= */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.08] bg-white/[0.015] backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4285F4]/30 via-[#9B72CB]/30 to-[#00F5D4]/30 border border-[#669DF6]/50 flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-[#00F5D4]" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold tracking-tight text-white">
                Architecture Blueprint
              </h2>
              <span className="px-1.5 py-0.5 rounded bg-[#4285F4]/15 border border-[#4285F4]/35 text-[9px] font-mono text-[#A8C7FA] uppercase">
                Live Reference Stack
              </span>
            </div>
          </div>

          {/* 3 Architecture Switcher Pills */}
          <div
            role="tablist"
            aria-label="Architecture blueprints"
            className="flex items-center gap-1 rounded-xl bg-black/65 border border-white/[0.09] p-1"
          >
            {ARCH_TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  data-testid={`arch-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-left transition-all flex items-center gap-2 ${
                    active ? "text-white" : "text-white/50 hover:text-white/85"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="arch-active-tab-pill"
                      transition={{ type: "spring", bounce: 0, duration: 0.32 }}
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#4285F4]/25 via-[#9B72CB]/25 to-[#00F5D4]/20 border border-[#A8C7FA]/45 -z-10"
                    />
                  )}
                  <span className="text-[10px] font-mono text-[#00F5D4] font-semibold">
                    {t.num}
                  </span>
                  <span className="text-xs font-medium">{t.title}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Auto-Play Step Toggle + Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAutoPlaying((prev) => !prev)}
              className={`h-7 px-2.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 border transition-all ${
                isAutoPlaying
                  ? "bg-[#00F5D4]/15 border-[#00F5D4]/50 text-[#00F5D4]"
                  : "bg-white/[0.04] border-white/[0.1] text-white/60 hover:text-white"
              }`}
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="w-2.5 h-2.5" />
                  <span>Auto-Flow</span>
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5" />
                  <span>Paused</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close architecture modal"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= SUB-BAR: 4 INTERACTIVE STEP SCRUBBER PILLS ================= */}
        <div className="relative z-20 flex items-center justify-center gap-1.5 px-5 pt-3 pb-1">
          {steps.map((s, idx) => {
            const active = activeStep === idx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setIsAutoPlaying(false);
                  setActiveStep(idx);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-mono transition-all flex items-center gap-1.5 border ${
                  active
                    ? "bg-gradient-to-r from-[#4285F4]/30 via-[#9B72CB]/30 to-[#00F5D4]/25 border-[#A8C7FA]/65 text-white font-semibold shadow-[0_0_20px_rgba(66,133,244,0.3)]"
                    : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:text-white/80"
                }`}
              >
                <span>{s.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* ================= MAIN ANIMATED DIAGRAM STAGE ================= */}
        <div
          ref={stageRef}
          className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center px-8 py-2 overflow-hidden"
        >
          {/* Pixel-Accurate Measured SVG Overlay */}
          <svg
            width={stageSize.w}
            height={stageSize.h}
            viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
            className="pointer-events-none absolute inset-0 w-full h-full z-0"
          >
            <defs>
              <linearGradient id="arch-mcp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#29B5E8" />
                <stop offset="50%" stopColor="#4285F4" />
                <stop offset="100%" stopColor="#00F5D4" />
              </linearGradient>
              <linearGradient id="arch-a2a-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF3621" />
                <stop offset="50%" stopColor="#9B72CB" />
                <stop offset="100%" stopColor="#FFB800" />
              </linearGradient>
              <linearGradient
                id="arch-spanner-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#00F5D4" />
                <stop offset="100%" stopColor="#19C37D" />
              </linearGradient>
            </defs>

            {activeWires.map((wire) => {
              if (!wire.d) return null;
              return (
                <g key={wire.id}>
                  <path
                    d={wire.d}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="2"
                  />
                  <motion.path
                    d={wire.d}
                    fill="none"
                    stroke={wire.grad}
                    strokeWidth={wire.active ? 3 : 1.5}
                    animate={{ opacity: wire.active ? 0.92 : 0.22 }}
                    transition={{ duration: 0.35 }}
                  />
                  {wire.active && (
                    <path
                      d={wire.d}
                      fill="none"
                      stroke={wire.color}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeDasharray="10 28"
                      className="dag-edge-active"
                      style={{ animationDuration: "680ms" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <AnimatePresence mode="wait">
            {activeTab === "federation" && (
              <motion.div
                key="tab-federation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onAnimationComplete={measurePorts}
                className="relative z-10 w-full h-full max-w-[1060px] flex items-center justify-between gap-8"
              >
                {/* COLUMN 1: 3 EXISTING DATA SURFACES */}
                <div className="flex flex-col justify-between h-[410px] w-[260px] shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 pl-1">
                    1 · Data Surfaces
                  </div>

                  {/* Node: Snowflake Data Cloud */}
                  <div
                    onMouseEnter={() => setHoveredNode("sf")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`relative rounded-2xl p-3.5 border backdrop-blur-xl transition-all ${
                      isHighlighted("sf")
                        ? "bg-[#0B1924]/95 border-[#29B5E8]/80 shadow-[0_0_28px_rgba(41,181,232,0.28)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-55"
                    }`}
                  >
                    {/* Right Port Dot */}
                    <span
                      data-port="sf-out"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#29B5E8] border-2 border-[#040407] shadow-[0_0_8px_#29B5E8]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SnowflakeIcon className="w-4 h-4" />
                        <span className="text-xs font-semibold text-white">
                          Snowflake Cloud
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[#29B5E8]/15 text-[#29B5E8] text-[9px] font-mono font-semibold">
                        WAREHOUSE
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["vc_spend_90d", "d2c_bookings", "ltv_usd"].map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-[10px] font-mono text-white/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Node: Databricks + Genie Agent */}
                  <div
                    onMouseEnter={() => setHoveredNode("dbx")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`relative rounded-2xl p-3.5 border backdrop-blur-xl transition-all ${
                      isHighlighted("dbx")
                        ? "bg-[#22100E]/95 border-[#FF3621]/80 shadow-[0_0_28px_rgba(255,54,33,0.28)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-55"
                    }`}
                  >
                    {/* Dual Right Port Dots (Top -> MCP, Bottom -> A2A) */}
                    <span
                      data-port="dbx-out-top"
                      className="absolute -right-1.5 top-[34%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[#040407] shadow-[0_0_8px_#4285F4]"
                    />
                    <span
                      data-port="dbx-out-bot"
                      className="absolute -right-1.5 top-[68%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FF3621] border-2 border-[#040407] shadow-[0_0_8px_#FF3621]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DatabricksIcon className="w-4 h-4" />
                        <span className="text-xs font-semibold text-white">
                          Databricks + Genie
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[#FF3621]/15 text-[#FF3621] text-[9px] font-mono font-semibold">
                        LAKEHOUSE
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["Unity Catalog", "churn_hazard", "Genie Agent"].map(
                        (tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-[10px] font-mono text-white/75"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {/* Node: Cloud Spanner Graph */}
                  <div
                    onMouseEnter={() => setHoveredNode("spanner")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`relative rounded-2xl p-3.5 border backdrop-blur-xl transition-all ${
                      isHighlighted("spanner")
                        ? "bg-[#0A1E1C]/95 border-[#00F5D4]/80 shadow-[0_0_28px_rgba(0,245,212,0.28)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-55"
                    }`}
                  >
                    {/* Right Port Dot */}
                    <span
                      data-port="spanner-out"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407] shadow-[0_0_8px_#00F5D4]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[#00F5D4]" />
                        <span className="text-xs font-semibold text-white">
                          Spanner Graph
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[#00F5D4]/15 text-[#00F5D4] text-[9px] font-mono font-semibold">
                        26MS GQL
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["6.5K Players", "84 Crews", "2-Hop Contagion"].map(
                        (tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-[10px] font-mono text-white/75"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: DUAL INTEGRATION PROTOCOLS (ADK/MCP vs A2A) */}
                <div className="flex flex-col justify-between h-[410px] w-[275px] shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 text-center">
                    2 · Dual Protocol Bridge
                  </div>

                  {/* Protocol A: ADK + MCP Tool Layer */}
                  <div
                    onMouseEnter={() => setHoveredNode("mcp")}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveStep(1);
                    }}
                    className={`relative cursor-pointer rounded-2xl p-4 border backdrop-blur-xl transition-all my-auto ${
                      isHighlighted("mcp")
                        ? "bg-[#10182C]/95 border-[#669DF6]/85 shadow-[0_0_34px_rgba(66,133,244,0.35)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-55"
                    }`}
                  >
                    {/* 3 Left Input Ports (Snowflake, Databricks, Spanner) + 1 Right Output Port */}
                    <span
                      data-port="mcp-in-top"
                      className="absolute -left-1.5 top-[26%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#29B5E8] border-2 border-[#040407]"
                    />
                    <span
                      data-port="mcp-in-mid"
                      className="absolute -left-1.5 top-[52%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="mcp-in-bot"
                      className="absolute -left-1.5 top-[78%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="mcp-out"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407] shadow-[0_0_8px_#00F5D4]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#669DF6]" />
                        <span className="text-xs font-semibold text-white">
                          ADK + MCP Tools
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#4285F4]/20 border border-[#4285F4]/40 text-[9px] font-mono font-semibold text-[#A8C7FA]">
                        1-HOP DATA
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-white/70 leading-snug">
                      Deterministic SQL, feature hydration &amp; OAuth row-level
                      security.
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-[#00F5D4]">
                      <span>Zero LLM Hop Overhead</span>
                      <span>~35ms</span>
                    </div>
                  </div>

                  {/* Protocol B: A2A Agent-to-Agent Protocol */}
                  <div
                    onMouseEnter={() => setHoveredNode("a2a")}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveStep(2);
                    }}
                    className={`relative cursor-pointer rounded-2xl p-4 border backdrop-blur-xl transition-all my-auto ${
                      isHighlighted("a2a")
                        ? "bg-[#1D1228]/95 border-[#9B72CB]/85 shadow-[0_0_34px_rgba(155,114,203,0.35)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-55"
                    }`}
                  >
                    {/* Left Input Port + Right Output Port */}
                    <span
                      data-port="a2a-in"
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FF3621] border-2 border-[#040407]"
                    />
                    <span
                      data-port="a2a-out"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FFB800] border-2 border-[#040407] shadow-[0_0_8px_#FFB800]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FFB800]" />
                        <span className="text-xs font-semibold text-white">
                          A2A Protocol Bridge
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#FFB800]/20 border border-[#FFB800]/40 text-[9px] font-mono font-semibold text-[#FFB800]">
                        AGENT ↔ AGENT
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-white/70 leading-snug">
                      Delegates exploratory Lakehouse tasks to Databricks Genie
                      Agents.
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-[#E9D5FF]">
                      <span>JSON-RPC (/api/a2a)</span>
                      <span>Multi-Step</span>
                    </div>
                  </div>
                </div>

                {/* COLUMN 3: UNIFIED GEMINI + COURTSIDE ENGINE */}
                <div className="flex flex-col justify-between h-[410px] w-[285px] shrink-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/40 pl-1">
                    3 · Agentic Decision Plane
                  </div>

                  <div
                    onMouseEnter={() => setHoveredNode("gemini")}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`relative my-auto rounded-2xl p-4 border backdrop-blur-xl transition-all space-y-3 ${
                      isHighlighted("gemini")
                        ? "bg-gradient-to-b from-[#13182E]/95 to-[#171126]/95 border-[#00F5D4]/80 shadow-[0_0_42px_rgba(0,245,212,0.3)]"
                        : "bg-[#0B0D16]/85 border-white/[0.1]"
                    }`}
                  >
                    {/* Left Input Ports (Top from MCP, Bottom from A2A) */}
                    <span
                      data-port="gemini-in-top"
                      className="absolute -left-1.5 top-[34%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407] shadow-[0_0_8px_#00F5D4]"
                    />
                    <span
                      data-port="gemini-in-bot"
                      className="absolute -left-1.5 top-[68%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FFB800] border-2 border-[#040407] shadow-[0_0_8px_#FFB800]"
                    />

                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center shrink-0">
                        <GeminiSparkIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          Gemini 3.8 + ADK Runtime
                        </div>
                        <div className="text-[10px] font-mono text-[#00F5D4]">
                          2K Courtside Orchestrator
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/[0.07]">
                      {[
                        {
                          label: "Snowflake · MCP",
                          val: "Spend & D2C",
                          color: "text-[#29B5E8]",
                        },
                        {
                          label: "Databricks · A2A",
                          val: "Survival & Tilt ML",
                          color: "text-[#FF3621]",
                        },
                        {
                          label: "Spanner · GQL",
                          val: "3.1x Crew Cascade",
                          color: "text-[#00F5D4]",
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between gap-2 rounded-lg bg-black/50 px-2.5 py-1.5 text-[10px] font-mono whitespace-nowrap"
                        >
                          <span className="text-white/55">{row.label}</span>
                          <span className={`font-semibold ${row.color}`}>
                            {row.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "semantic" && (
              <motion.div
                key="tab-semantic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onAnimationComplete={measurePorts}
                className="relative z-10 w-full h-full max-w-[1000px] flex flex-col justify-between py-3"
              >
                {/* LAYER 1: BUSINESS VERNACULAR INPUT */}
                <div className="flex justify-center">
                  <div
                    className={`relative rounded-2xl px-5 py-3 border backdrop-blur-xl flex flex-wrap items-center gap-2.5 transition-all ${
                      isHighlighted("intent")
                        ? "bg-[#11162A]/95 border-[#669DF6]/80 shadow-[0_0_30px_rgba(66,133,244,0.3)]"
                        : "bg-[#0B0D16]/85 border-white/[0.1]"
                    }`}
                  >
                    <span
                      data-port="intent-out-l"
                      className="absolute -bottom-1.5 left-[32%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="intent-out-r"
                      className="absolute -bottom-1.5 left-[68%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407]"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#A8C7FA] font-semibold">
                      1 · Business Terms
                    </span>
                    {[
                      '"84 OVR Paywall Cliff"',
                      '"High Tilt Risk"',
                      '"Crew Captains"',
                      '"Persuadable Holdouts"',
                    ].map((term) => (
                      <span
                        key={term}
                        className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-white"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>

                {/* LAYER 2: DUAL SEMANTIC & ONTOLOGY SPINE */}
                <div className="grid grid-cols-2 gap-12 max-w-4xl w-full mx-auto">
                  {/* Left: Warehouse Semantic Metric Layer */}
                  <div
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveStep(1);
                    }}
                    className={`relative cursor-pointer rounded-2xl p-4 border backdrop-blur-xl transition-all ${
                      isHighlighted("sem_metrics")
                        ? "bg-[#13182C]/95 border-[#4285F4]/85 shadow-[0_0_34px_rgba(66,133,244,0.32)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-60"
                    }`}
                  >
                    <span
                      data-port="metrics-in"
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="metrics-side"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#9B72CB] border-2 border-[#040407]"
                    />
                    <span
                      data-port="metrics-out-l"
                      className="absolute -bottom-1.5 left-[35%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="metrics-out-r"
                      className="absolute -bottom-1.5 left-[70%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#4285F4] border-2 border-[#040407]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-[#669DF6]" />
                        <span className="text-xs font-semibold text-white">
                          2A · Governed Metric Views (MCP)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-[#A8C7FA] px-2 py-0.5 rounded bg-[#4285F4]/15">
                        Unity Catalog + Snowflake
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="rounded-lg bg-black/50 p-2 border border-white/[0.06]">
                        <div className="text-white/45">Paywall Cliff</div>
                        <div className="text-[#00F5D4] font-semibold mt-0.5">
                          ovr BETWEEN 82 AND 84
                        </div>
                      </div>
                      <div className="rounded-lg bg-black/50 p-2 border border-white/[0.06]">
                        <div className="text-white/45">High Tilt Risk</div>
                        <div className="text-[#FFB800] font-semibold mt-0.5">
                          loss_streak &gt;= 3 · hazard β
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Property Graph Ontology */}
                  <div
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveStep(2);
                    }}
                    className={`relative cursor-pointer rounded-2xl p-4 border backdrop-blur-xl transition-all ${
                      isHighlighted("sem_ontology")
                        ? "bg-[#0D2122]/95 border-[#00F5D4]/85 shadow-[0_0_34px_rgba(0,245,212,0.3)]"
                        : "bg-[#0B0D16]/85 border-white/[0.08] opacity-60"
                    }`}
                  >
                    <span
                      data-port="ont-in"
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#00F5D4] border-2 border-[#040407]"
                    />
                    <span
                      data-port="ont-side"
                      className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#9B72CB] border-2 border-[#040407]"
                    />
                    <span
                      data-port="ont-out-l"
                      className="absolute -bottom-1.5 left-[30%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#669DF6] border-2 border-[#040407]"
                    />
                    <span
                      data-port="ont-out-r"
                      className="absolute -bottom-1.5 left-[68%] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#19C37D] border-2 border-[#040407]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[#00F5D4]" />
                        <span className="text-xs font-semibold text-white">
                          2B · Property Graph Ontology
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-[#00F5D4] px-2 py-0.5 rounded bg-[#00F5D4]/15">
                        Spanner Graph DDL
                      </span>
                    </div>
                    <div className="mt-2.5 rounded-lg bg-black/50 p-2.5 border border-white/[0.06] flex items-center justify-between text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-[#4285F4]/20 text-[#A8C7FA]">
                        (Player)
                      </span>
                      <span className="text-white/40">—[:IN_CREW]→</span>
                      <span className="px-2 py-0.5 rounded bg-[#00F5D4]/20 text-[#00F5D4]">
                        (Crew)
                      </span>
                      <span className="text-white/40">←[:LEADS]—</span>
                      <span className="px-2 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800]">
                        (Captain)
                      </span>
                    </div>
                  </div>
                </div>

                {/* LAYER 3: CONTRACT-VERIFIED OUTPUTS */}
                <div className="grid grid-cols-3 gap-4 max-w-4xl w-full mx-auto">
                  {[
                    {
                      id: "out_gql",
                      port: "out1-in",
                      portColor: "bg-[#00F5D4]",
                      title: "Parameterized GQL",
                      sub: "Spanner Graph (@params only)",
                      badge: "0 Hallucinated Joins",
                      color: "text-[#00F5D4] border-[#00F5D4]/50",
                    },
                    {
                      id: "out_sql",
                      port: "out2-in",
                      portColor: "bg-[#4285F4]",
                      title: "Federated Warehouse SQL",
                      sub: "Snowflake & Databricks Genie",
                      badge: "Same Metric Formula",
                      color: "text-[#A8C7FA] border-[#4285F4]/50",
                    },
                    {
                      id: "out_kpi",
                      port: "out3-in",
                      portColor: "bg-[#19C37D]",
                      title: "Executive CATE & mROAS",
                      sub: "Persuadables vs. Sleeping Dogs",
                      badge: "Audited Attribution",
                      color: "text-win-green border-win-green/50",
                    },
                  ].map((card) => (
                    <div
                      key={card.id}
                      className={`relative rounded-2xl p-3.5 border backdrop-blur-xl bg-[#0B0D16]/90 transition-all ${
                        isHighlighted(card.id)
                          ? `${card.color} shadow-[0_0_24px_rgba(0,245,212,0.2)]`
                          : "border-white/[0.08]"
                      }`}
                    >
                      <span
                        data-port={card.port}
                        className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ${card.portColor} border-2 border-[#040407]`}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          {card.title}
                        </span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-win-green" />
                      </div>
                      <div className="text-[10px] text-white/55 mt-1">
                        {card.sub}
                      </div>
                      <div className="mt-2 inline-block px-2 py-0.5 rounded bg-white/[0.05] text-[9px] font-mono text-white/80">
                        {card.badge}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "scale" && (
              <motion.div
                key="tab-scale"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onAnimationComplete={measurePorts}
                className="relative z-10 w-full h-full max-w-[1060px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-center py-2"
              >
                {/* LEFT PANEL: INTERACTIVE ANALYTICS AT SCALE (BIFURCATED COMPUTE) */}
                <div className="relative h-full rounded-2xl border border-white/[0.09] bg-[#080A12]/90 p-5 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#00F5D4]" />
                      <span className="text-xs font-semibold text-white">
                        Part A · Interactive Analytics at Scale
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#00F5D4]/15 border border-[#00F5D4]/35 text-[9px] font-mono text-[#00F5D4]">
                      20 → 6,500 AGENTS
                    </span>
                  </div>

                  {/* Two Parallel Engines Merging into Interactive Canvas */}
                  <div className="space-y-3 my-auto">
                    <div
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setActiveStep(0);
                      }}
                      className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                        isHighlighted("brain_llm")
                          ? "bg-[#151228] border-[#9B72CB]/80 shadow-[0_0_24px_rgba(155,114,203,0.3)]"
                          : "bg-black/50 border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GeminiSparkIcon className="w-4 h-4" />
                          <span className="text-xs font-semibold text-white">
                            1. Agentic Reasoning Plane (Gemini 3.8 Flash)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#E9D5FF]">
                          Causal &amp; Behavioral
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-white/75">
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          20 Core Personas
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          100 Contagion Swarm
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          What-If Hypotheses
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-[9px] font-mono text-[#00F5D4]">
                        + FUSED IN REAL TIME WITH +
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setActiveStep(0);
                      }}
                      className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                        isHighlighted("brain_vec")
                          ? "bg-[#0A1F22] border-[#00F5D4]/80 shadow-[0_0_24px_rgba(0,245,212,0.28)]"
                          : "bg-black/50 border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-[#00F5D4]" />
                          <span className="text-xs font-semibold text-white">
                            2. Vectorized Compute Plane (&lt;30ms)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#00F5D4]">
                          Zero LLM Math Lag
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-white/75">
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          Spanner 6.5K Graph
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          ScaNN 3,072-d Twins
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/[0.06]">
                          Weibull &amp; Meridian mROAS
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gradient-to-r from-[#4285F4]/20 via-[#9B72CB]/20 to-[#19C37D]/20 border border-win-green/45 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Result: Instant 6.5K Scaling &amp; ON/OFF Signal Ablation
                    </span>
                    <span className="text-[10px] font-mono text-win-green font-semibold">
                      0ms UI Recalc
                    </span>
                  </div>
                </div>

                {/* RIGHT PANEL: RETAINING DEFINITIONS & ARCHITECTURAL INTENT */}
                <div className="relative h-full rounded-2xl border border-white/[0.09] bg-[#080A12]/90 p-5 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#A8C7FA]" />
                      <span className="text-xs font-semibold text-white">
                        Part B · Zero-Maintenance Codebase Context
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#4285F4]/15 border border-[#4285F4]/35 text-[9px] font-mono text-[#A8C7FA]">
                      NO STALE WIKIS
                    </span>
                  </div>

                  <div className="space-y-3 my-auto">
                    {[
                      {
                        id: "ctx_mcp",
                        stepIdx: 1,
                        icon: RefreshCw,
                        title: "1. Automated Schema Introspection (MCP)",
                        badge: "LIVE METADATA",
                        desc: "Reads Unity Catalog INFORMATION_SCHEMA, Snowflake YAML & TypeScript ASTs directly at query time.",
                        accent: "border-[#4285F4]/80 bg-[#10182C]",
                      },
                      {
                        id: "ctx_cache",
                        stepIdx: 2,
                        icon: Code2,
                        title: "2. Vertex AI Context Caching + Repo Contracts",
                        badge: "-85% COST",
                        desc: "Pins GEMINI.md architectural rules, Graph DDL & metric formulas in cached memory across every turn.",
                        accent: "border-[#9B72CB]/80 bg-[#1A1228]",
                      },
                      {
                        id: "ctx_guard",
                        stepIdx: 3,
                        icon: ShieldCheck,
                        title: "3. Automated Contract-Guardian Agent",
                        badge: "CI + RUNTIME",
                        desc: "Gemini 3.5 Flash-Lite verifies every generated GQL/SQL query & variable against the live schema.",
                        accent: "border-win-green/80 bg-[#0B2118]",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = isHighlighted(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setIsAutoPlaying(false);
                            setActiveStep(item.stepIdx);
                          }}
                          className={`cursor-pointer rounded-xl p-3 border transition-all ${
                            active
                              ? `${item.accent} shadow-[0_0_24px_rgba(66,133,244,0.25)]`
                              : "bg-black/50 border-white/[0.08] opacity-65"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-[#00F5D4]" />
                              <span className="text-xs font-semibold text-white">
                                {item.title}
                              </span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.07] text-[9px] font-mono text-[#00F5D4]">
                              {item.badge}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/70 leading-snug">
                            {item.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ================= BOTTOM MAGNETIC TALK-TRACK CUE BAR ================= */}
        <div className="relative z-20 px-5 pb-3.5 pt-1 flex justify-center">
          <div className="w-full max-w-4xl rounded-full border border-white/[0.12] bg-[#090B14]/95 backdrop-blur-xl px-4 py-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#4285F4]/30 to-[#00F5D4]/25 border border-[#00F5D4]/50 text-[10px] font-mono font-bold text-[#00F5D4] shrink-0">
                {currentStep.badge}
              </span>
              <span className="text-white/90 truncate font-medium">
                {currentStep.headline}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsAutoPlaying(false);
                setActiveStep((prev) => (prev + 1) % steps.length);
              }}
              className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[10px] font-mono text-white/80 hover:text-white flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
